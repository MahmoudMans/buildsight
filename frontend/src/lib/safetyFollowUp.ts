import { DAY_MS, formatDay, plural, toDay, trunc, words } from "@/lib/openItems";
import type { SafetyAction, SafetyControl, SafetyIncident, SafetyObservation, SafetySeverity } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 180;
export const GRACE_DAYS = 7;
export const MIN_GROUP = 3;
export const GOOD = 0.9;
export const WATCH = 0.7;
export const PAGE = 10;

export type Kind = "incident" | "observation";
export type Flag = "closedNoAction" | "noAction" | "stillOpen" | "overdue" | "unverified" | "recent" | "followed";
export type Filter = "all" | "none" | "overdue" | "unverified" | "stillOpen";

export const FLAG_LABEL: Record<Flag, string> = {
  closedNoAction: "Closed, no action",
  noAction: "No action yet",
  stillOpen: "Closed, action open",
  overdue: "Action overdue",
  unverified: "Not verified",
  recent: "New",
  followed: "Followed up",
};

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All hazards" },
  { key: "none", label: "No action" },
  { key: "overdue", label: "Overdue action" },
  { key: "unverified", label: "Not verified" },
  { key: "stillOpen", label: "Closed, action open" },
];

const RANK: Record<Flag, number> = {
  closedNoAction: 0,
  noAction: 1,
  stillOpen: 2,
  overdue: 3,
  unverified: 4,
  recent: 5,
  followed: 6,
};

const SEVERITY_WEIGHT: Record<SafetySeverity, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
const SEVERITY_ORDER: SafetySeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface Unit {
  key: string;
  kind: Kind;
  reference: string;
  title: string;
  severity: SafetySeverity;
  typeLabel: string;
  location: string | null;
  raised: number;
  closed: boolean;
  immediate: boolean;
  actions: number;
  closedActions: number;
  openActions: number;
  overdueActions: number;
  unverifiedActions: number;
  worstLate: number;
  nextDue: number | null;
  firstActionDays: number | null;
  flags: Flag[];
  rank: number;
}

export interface Group {
  key: string;
  label: string;
  count: number;
  judged: number;
  withAction: number;
  coverage: number | null;
}

export interface Month {
  key: string;
  label: string;
  start: number;
  partial: boolean;
  total: number;
  followed: number;
  none: number;
  fresh: number;
  coverage: number | null;
}

export interface FollowUp {
  from: number;
  to: number;
  units: Unit[];
  months: Month[];
  severities: Group[];
  sources: Group[];
  raised: number;
  incidents: number;
  observations: number;
  judged: number;
  withAction: number;
  coverage: number | null;
  noAction: number;
  closedNoAction: number;
  fresh: number;
  overdueActions: number;
  overdueUnits: number;
  unverifiedActions: number;
  stillOpen: number;
  medianDays: number | null;
  standalone: number;
  dangling: number;
  voided: number;
  skippedUnits: number;
  future: number;
}

export type FollowUpResult = { ok: true; data: FollowUp } | { ok: false; reason: "noHazards" };

function refKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function monthStart(year: number, month: number): number {
  return Math.floor(Date.UTC(year, month, 1) / DAY_MS);
}

function groupOf(key: string, label: string, units: Unit[]): Group {
  const judged = units.filter((unit) => !unit.flags.includes("recent"));
  const withAction = judged.filter((unit) => unit.actions > 0).length;

  return { key, label, count: units.length, judged: judged.length, withAction, coverage: judged.length > 0 ? withAction / judged.length : null };
}

export function severityLabel(severity: SafetySeverity): string {
  return words(severity);
}

export function bandOf(group: { judged: number; coverage: number | null }): "good" | "watch" | "bad" | null {
  if (group.coverage === null || group.judged < MIN_GROUP) {
    return null;
  }

  return group.coverage >= GOOD ? "good" : group.coverage >= WATCH ? "watch" : "bad";
}

export function buildFollowUp(data: SafetyControl, today: number, windowDays: number): FollowUpResult {
  const incidents = data.incidents ?? [];
  const observations = data.observations ?? [];
  const actions = data.actions ?? [];

  const liveIncidents = incidents.filter((item) => item.status !== "VOID");
  const liveObservations = observations.filter((item) => item.status !== "VOID" && (item.observationType === "UNSAFE_ACT" || item.observationType === "UNSAFE_CONDITION"));
  const voided = incidents.length - liveIncidents.length + observations.filter((item) => item.status === "VOID" && (item.observationType === "UNSAFE_ACT" || item.observationType === "UNSAFE_CONDITION")).length;

  if (liveIncidents.length === 0 && liveObservations.length === 0) {
    return { ok: false, reason: "noHazards" };
  }

  const from = today - windowDays + 1;

  const incidentById = new Map<string, SafetyIncident>();
  const incidentByRef = new Map<string, SafetyIncident>();
  const observationById = new Map<string, SafetyObservation>();
  const observationByRef = new Map<string, SafetyObservation>();

  for (const item of incidents) {
    incidentById.set(item.id, item);

    if (refKey(item.reference)) {
      incidentByRef.set(refKey(item.reference), item);
    }
  }

  for (const item of observations) {
    observationById.set(item.id, item);

    if (refKey(item.reference)) {
      observationByRef.set(refKey(item.reference), item);
    }
  }

  const byIncident = new Map<string, SafetyAction[]>();
  const byObservation = new Map<string, SafetyAction[]>();
  let standalone = 0;
  let dangling = 0;

  for (const action of actions) {
    if (action.status === "VOID") {
      continue;
    }

    const hasLink = Boolean(action.incidentId) || Boolean(refKey(action.incidentReference)) || Boolean(action.observationId) || Boolean(refKey(action.observationReference));
    const incident = (action.incidentId ? incidentById.get(action.incidentId) : undefined) ?? (refKey(action.incidentReference) ? incidentByRef.get(refKey(action.incidentReference)) : undefined);
    const observation = (action.observationId ? observationById.get(action.observationId) : undefined) ?? (refKey(action.observationReference) ? observationByRef.get(refKey(action.observationReference)) : undefined);

    if (!incident && !observation) {
      if (hasLink) {
        dangling += 1;
      } else {
        standalone += 1;
      }

      continue;
    }

    if (incident) {
      byIncident.set(incident.id, [...(byIncident.get(incident.id) ?? []), action]);
    }

    if (observation) {
      byObservation.set(observation.id, [...(byObservation.get(observation.id) ?? []), action]);
    }
  }

  const units: Unit[] = [];
  let skippedUnits = 0;
  let future = 0;
  const overdueIds = new Set<string>();

  function measure(
    kind: Kind,
    id: string,
    reference: string,
    title: string,
    severity: SafetySeverity,
    typeLabel: string,
    location: string | null,
    raised: number,
    closed: boolean,
    immediate: boolean,
    linked: SafetyAction[],
  ) {
    if (!Number.isFinite(raised)) {
      skippedUnits += 1;
      return;
    }

    if (raised > today) {
      future += 1;
      return;
    }

    if (raised < from) {
      return;
    }

    const live = linked.filter((action) => action.status !== "VOID");
    const closedActions = live.filter((action) => action.status === "CLOSED");
    const openActions = live.filter((action) => action.status !== "CLOSED");
    const late = openActions.filter((action) => {
      const due = toDay(action.dueDate);

      return action.overdue === true || (Number.isFinite(due) && due < today);
    });
    const unverified = closedActions.filter((action) => (action.verificationNotes ?? "").trim().length === 0);
    const dues = openActions.map((action) => toDay(action.dueDate)).filter((due) => Number.isFinite(due));
    const lates = late.map((action) => {
      const due = toDay(action.dueDate);

      return Number.isFinite(due) ? Math.max(0, today - due) : 0;
    });
    const created = live.map((action) => toDay(action.createdAt)).filter((day) => Number.isFinite(day));
    const age = today - raised;

    for (const action of late) {
      overdueIds.add(action.id);
    }

    const flags: Flag[] = [];

    if (live.length === 0 && closed) {
      flags.push("closedNoAction");
    } else if (live.length === 0 && age > GRACE_DAYS) {
      flags.push("noAction");
    } else if (live.length === 0) {
      flags.push("recent");
    }

    if (closed && openActions.length > 0) {
      flags.push("stillOpen");
    }

    if (late.length > 0) {
      flags.push("overdue");
    }

    if (unverified.length > 0) {
      flags.push("unverified");
    }

    if (flags.length === 0) {
      flags.push("followed");
    }

    units.push({
      key: `${kind}:${id}`,
      kind,
      reference,
      title,
      severity,
      typeLabel,
      location,
      raised,
      closed,
      immediate,
      actions: live.length,
      closedActions: closedActions.length,
      openActions: openActions.length,
      overdueActions: late.length,
      unverifiedActions: unverified.length,
      worstLate: lates.length > 0 ? Math.max(...lates) : 0,
      nextDue: dues.length > 0 ? Math.min(...dues) : null,
      firstActionDays: created.length > 0 ? Math.max(0, Math.min(...created) - raised) : null,
      flags,
      rank: Math.min(...flags.map((flag) => RANK[flag])),
    });
  }

  for (const item of liveIncidents) {
    const reported = toDay(item.reportedDate);

    measure("incident", item.id, item.reference, item.title, item.severity, words(item.incidentType), item.location, Number.isFinite(reported) ? reported : toDay(item.occurredDate), item.status === "CLOSED", (item.immediateAction ?? "").trim().length > 0, byIncident.get(item.id) ?? []);
  }

  for (const item of liveObservations) {
    measure("observation", item.id, item.reference, item.title, item.severity, words(item.observationType), item.location, toDay(item.observedDate), item.status === "CLOSED", false, byObservation.get(item.id) ?? []);
  }

  units.sort((a, b) => a.rank - b.rank || SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || a.raised - b.raised || a.reference.localeCompare(b.reference));

  const judged = units.filter((unit) => !unit.flags.includes("recent"));
  const withAction = judged.filter((unit) => unit.actions > 0).length;
  const months: Month[] = [];
  const first = new Date(from * DAY_MS);
  const last = new Date(today * DAY_MS);
  let year = first.getUTCFullYear();
  let month = first.getUTCMonth();

  while (year < last.getUTCFullYear() || (year === last.getUTCFullYear() && month <= last.getUTCMonth())) {
    const start = monthStart(year, month);
    const next = month === 11 ? monthStart(year + 1, 0) : monthStart(year, month + 1);
    const inside = units.filter((unit) => unit.raised >= start && unit.raised < next);
    const fresh = inside.filter((unit) => unit.flags.includes("recent")).length;
    const followed = inside.filter((unit) => unit.actions > 0).length;
    const none = inside.length - fresh - followed;

    months.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: `${MONTHS[month] ?? ""} ${String(year).slice(2)}`,
      start,
      partial: start < from || next - 1 > today,
      total: inside.length,
      followed,
      none,
      fresh,
      coverage: followed + none > 0 ? followed / (followed + none) : null,
    });

    month += 1;

    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const incidentUnits = units.filter((unit) => unit.kind === "incident");
  const observationUnits = units.filter((unit) => unit.kind === "observation");

  return {
    ok: true,
    data: {
      from,
      to: today,
      units,
      months,
      severities: SEVERITY_ORDER.map((severity) => groupOf(severity, severityLabel(severity), units.filter((unit) => unit.severity === severity))).filter((group) => group.count > 0),
      sources: [groupOf("incident", "Incidents", incidentUnits), groupOf("observation", "Unsafe observations", observationUnits)].filter((group) => group.count > 0),
      raised: units.length,
      incidents: incidentUnits.length,
      observations: observationUnits.length,
      judged: judged.length,
      withAction,
      coverage: judged.length > 0 ? withAction / judged.length : null,
      noAction: judged.length - withAction,
      closedNoAction: units.filter((unit) => unit.flags.includes("closedNoAction")).length,
      fresh: units.length - judged.length,
      overdueActions: overdueIds.size,
      overdueUnits: units.filter((unit) => unit.flags.includes("overdue")).length,
      unverifiedActions: units.reduce((sum, unit) => sum + unit.unverifiedActions, 0),
      stillOpen: units.filter((unit) => unit.flags.includes("stillOpen")).length,
      medianDays: median(units.filter((unit) => unit.firstActionDays !== null).map((unit) => unit.firstActionDays as number)),
      standalone,
      dangling,
      voided,
      skippedUnits,
      future,
    },
  };
}

export function filterUnits(units: Unit[], filter: Filter): Unit[] {
  if (filter === "none") {
    return units.filter((unit) => unit.flags.includes("closedNoAction") || unit.flags.includes("noAction"));
  }

  if (filter === "overdue") {
    return units.filter((unit) => unit.flags.includes("overdue"));
  }

  if (filter === "unverified") {
    return units.filter((unit) => unit.flags.includes("unverified"));
  }

  if (filter === "stillOpen") {
    return units.filter((unit) => unit.flags.includes("stillOpen"));
  }

  return units;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function daysText(value: number | null): string {
  if (value === null) {
    return "—";
  }

  if (value === 0) {
    return "same day";
  }

  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);

  return `${text} ${rounded === 1 ? "day" : "days"}`;
}

export function actionText(unit: Unit): string {
  if (unit.actions === 0) {
    return "No action recorded";
  }

  const parts: string[] = [];

  if (unit.closedActions > 0) {
    parts.push(`${unit.closedActions} closed`);
  }

  if (unit.openActions > 0) {
    parts.push(`${unit.openActions} open`);
  }

  return `${unit.actions} ${plural(unit.actions, "action", "actions")}: ${parts.join(", ")}`;
}

export function followMarkdown(data: FollowUp, shown: Unit[], projectName: string, windowLabel: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Safety follow-up: ${projectName}`, "");
  lines.push(`Hazards raised in the last ${windowLabel}, from ${formatDay(data.from)} to ${formatDay(data.to)}: ${data.raised} (${data.incidents} ${plural(data.incidents, "incident", "incidents")}, ${data.observations} unsafe ${plural(data.observations, "observation", "observations")}).`, "");
  lines.push(`- ${data.withAction} of ${data.judged} ${plural(data.judged, "hazard has", "hazards have")} a corrective action recorded (${pct(data.coverage)})${data.fresh > 0 ? `; ${data.fresh} raised in the last ${GRACE_DAYS} days with none are not counted` : ""}`);
  lines.push(`- ${data.noAction} without an action${data.closedNoAction > 0 ? `, ${data.closedNoAction} of them already closed` : ""}`);
  lines.push(`- ${data.overdueActions} ${plural(data.overdueActions, "action is", "actions are")} overdue on ${data.overdueUnits} ${plural(data.overdueUnits, "hazard", "hazards")}`);
  lines.push(`- Median time until the first action was recorded: ${daysText(data.medianDays)}`, "");

  if (data.severities.length > 0) {
    lines.push("| Severity | Hazards | With an action | Coverage |", "| --- | ---: | ---: | ---: |");

    for (const group of data.severities) {
      lines.push(`| ${group.label} | ${group.judged} | ${group.withAction} | ${pct(group.coverage)} |`);
    }

    lines.push("");
  }

  if (shown.length > 0) {
    lines.push(`${filterLabel ? `Hazards (${filterLabel.toLowerCase()}):` : "Hazards:"}`, "", "| Reference | Hazard | Severity | Raised | Actions | Follow-up |", "| --- | --- | --- | --- | --- | --- |");

    for (const unit of shown.slice(0, 25)) {
      lines.push(`| ${cell(unit.reference)} | ${cell(trunc(unit.title, 40))} | ${severityLabel(unit.severity)} | ${formatDay(unit.raised)} | ${actionText(unit)} | ${unit.flags.map((flag) => FLAG_LABEL[flag]).join(", ")} |`);
    }

    lines.push("");
  }

  lines.push(
    `A hazard is an incident or an unsafe act or condition observation raised in the period, with voided records left out. An action counts when it names the hazard by id or by reference and is not void. A hazard raised in the last ${GRACE_DAYS} days with no action yet is not counted against coverage. Overdue means an action that is not closed and is past its due date.`,
    "",
  );

  return lines.join("\n");
}
