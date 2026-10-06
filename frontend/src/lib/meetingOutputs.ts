import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { GovernanceAction, GovernanceControl, GovernanceDecision, GovernanceMeeting, GovernanceMeetingType } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 180;
export const PAGE = 10;

export type Filter = "all" | "empty" | "overdue";

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All meetings" },
  { key: "empty", label: "Nothing linked" },
  { key: "overdue", label: "Overdue actions" },
];

export const AGE_BUCKETS: ReadonlyArray<{ key: string; label: string; max: number }> = [
  { key: "fresh", label: "Up to 2 weeks", max: 14 },
  { key: "month", label: "2 to 4 weeks", max: 30 },
  { key: "stale", label: "1 to 2 months", max: 60 },
  { key: "old", label: "Over 2 months", max: Number.POSITIVE_INFINITY },
];

export const TYPE_LABEL: Record<GovernanceMeetingType, string> = {
  PROGRESS: "Progress",
  COORDINATION: "Coordination",
  DESIGN: "Design",
  COMMERCIAL: "Commercial",
  HSE: "Health and safety",
  QUALITY: "Quality",
  EXECUTIVE: "Executive",
  OTHER: "Other",
};

export interface MeetingRow {
  id: string;
  number: string;
  title: string;
  type: GovernanceMeetingType;
  day: number;
  decisions: number;
  pending: number;
  decisionsOverdue: number;
  actions: number;
  done: number;
  open: number;
  overdue: number;
  blocked: number;
  oldestOpen: number | null;
  closeDays: number[];
  hasOutputs: boolean;
}

export interface TypeRow {
  type: GovernanceMeetingType;
  label: string;
  held: number;
  withOutputs: number;
  outputShare: number | null;
  decisions: number;
  actions: number;
  done: number;
  closure: number | null;
  overdue: number;
  open: number;
  medianClose: number | null;
}

export interface Outputs {
  from: number;
  to: number;
  meetings: MeetingRow[];
  types: TypeRow[];
  held: number;
  withOutputs: number;
  outputShare: number | null;
  decisions: number;
  pending: number;
  decisionsOverdue: number;
  actions: number;
  done: number;
  open: number;
  overdue: number;
  blocked: number;
  closure: number | null;
  medianClose: number | null;
  ages: Array<{ key: string; label: string; count: number }>;
  unlinkedDecisions: number;
  unlinkedActions: number;
  danglingDecisions: number;
  danglingActions: number;
  skipped: number;
  future: number;
}

export type OutputsResult = { ok: true; outputs: Outputs } | { ok: false; reason: "empty" };

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function dayOf(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

function isOpen(action: GovernanceAction): boolean {
  return action.status === "OPEN" || action.status === "IN_PROGRESS" || action.status === "BLOCKED";
}

export function buildOutputs(data: GovernanceControl, today: number, windowDays: number): OutputsResult {
  const allMeetings = data.meetings ?? [];

  if (allMeetings.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const decisions = data.decisions ?? [];
  const actions = (data.actions ?? []).filter((action) => action.status !== "VOID");
  const from = today - windowDays + 1;
  const meetingById = new Map<string, GovernanceMeeting>(allMeetings.map((meeting) => [meeting.id, meeting]));
  const decisionById = new Map<string, GovernanceDecision>(decisions.map((decision) => [decision.id, decision]));
  const rows: MeetingRow[] = [];
  const byId = new Map<string, MeetingRow>();
  let skipped = 0;
  let future = 0;

  for (const meeting of allMeetings) {
    if (meeting.status !== "HELD") {
      continue;
    }

    const day = dayOf(meeting.heldAt) ?? dayOf(meeting.scheduledAt);

    if (day === null) {
      skipped += 1;
      continue;
    }

    if (day > today) {
      future += 1;
      continue;
    }

    if (day < from) {
      continue;
    }

    const row: MeetingRow = { id: meeting.id, number: meeting.meetingNumber, title: meeting.title, type: meeting.meetingType, day, decisions: 0, pending: 0, decisionsOverdue: 0, actions: 0, done: 0, open: 0, overdue: 0, blocked: 0, oldestOpen: null, closeDays: [], hasOutputs: false };

    rows.push(row);
    byId.set(meeting.id, row);
  }

  let unlinkedDecisions = 0;
  let danglingDecisions = 0;

  for (const decision of decisions) {
    if (!decision.meetingId) {
      unlinkedDecisions += 1;
      continue;
    }

    if (!meetingById.has(decision.meetingId)) {
      danglingDecisions += 1;
      continue;
    }

    const row = byId.get(decision.meetingId);

    if (row) {
      row.decisions += 1;

      if (decision.status === "PROPOSED") {
        row.pending += 1;
      }

      if (decision.overdue) {
        row.decisionsOverdue += 1;
      }
    }
  }

  let unlinkedActions = 0;
  let danglingActions = 0;
  const ages: number[] = [];

  for (const action of actions) {
    let meetingId: string | null = action.meetingId ?? null;

    if (!meetingId && action.decisionId) {
      meetingId = decisionById.get(action.decisionId)?.meetingId ?? null;
    }

    if (!meetingId) {
      unlinkedActions += 1;
      continue;
    }

    if (!meetingById.has(meetingId)) {
      danglingActions += 1;
      continue;
    }

    const row = byId.get(meetingId);

    if (!row) {
      continue;
    }

    row.actions += 1;

    if (action.status === "DONE") {
      row.done += 1;

      const finished = dayOf(action.completedAt);

      if (finished !== null) {
        row.closeDays.push(Math.max(0, finished - row.day));
      }
    } else if (isOpen(action)) {
      const due = dayOf(action.dueDate);
      const late = action.overdue || (due !== null && due < today);

      row.open += 1;

      if (late) {
        row.overdue += 1;
      }

      if (action.status === "BLOCKED") {
        row.blocked += 1;
      }

      const age = Math.max(0, today - row.day);

      row.oldestOpen = row.oldestOpen === null ? age : Math.max(row.oldestOpen, age);
      ages.push(age);
    }
  }

  for (const row of rows) {
    row.hasOutputs = row.decisions > 0 || row.actions > 0;
  }

  rows.sort((a, b) => b.day - a.day || a.number.localeCompare(b.number, undefined, { numeric: true }));

  const byType = new Map<GovernanceMeetingType, MeetingRow[]>();

  for (const row of rows) {
    byType.set(row.type, [...(byType.get(row.type) ?? []), row]);
  }

  const types: TypeRow[] = [...byType.entries()].map(([type, list]) => {
    const actionTotal = list.reduce((sum, row) => sum + row.actions, 0);
    const doneTotal = list.reduce((sum, row) => sum + row.done, 0);
    const withOutputs = list.filter((row) => row.hasOutputs).length;

    return {
      type,
      label: TYPE_LABEL[type] ?? type,
      held: list.length,
      withOutputs,
      outputShare: list.length > 0 ? withOutputs / list.length : null,
      decisions: list.reduce((sum, row) => sum + row.decisions, 0),
      actions: actionTotal,
      done: doneTotal,
      closure: actionTotal > 0 ? doneTotal / actionTotal : null,
      overdue: list.reduce((sum, row) => sum + row.overdue, 0),
      open: list.reduce((sum, row) => sum + row.open, 0),
      medianClose: median(list.flatMap((row) => row.closeDays)),
    };
  });

  types.sort((a, b) => b.held - a.held || a.label.localeCompare(b.label));

  const actionTotal = rows.reduce((sum, row) => sum + row.actions, 0);
  const doneTotal = rows.reduce((sum, row) => sum + row.done, 0);
  const withOutputs = rows.filter((row) => row.hasOutputs).length;

  return {
    ok: true,
    outputs: {
      from,
      to: today,
      meetings: rows,
      types,
      held: rows.length,
      withOutputs,
      outputShare: rows.length > 0 ? withOutputs / rows.length : null,
      decisions: rows.reduce((sum, row) => sum + row.decisions, 0),
      pending: rows.reduce((sum, row) => sum + row.pending, 0),
      decisionsOverdue: rows.reduce((sum, row) => sum + row.decisionsOverdue, 0),
      actions: actionTotal,
      done: doneTotal,
      open: rows.reduce((sum, row) => sum + row.open, 0),
      overdue: rows.reduce((sum, row) => sum + row.overdue, 0),
      blocked: rows.reduce((sum, row) => sum + row.blocked, 0),
      closure: actionTotal > 0 ? doneTotal / actionTotal : null,
      medianClose: median(rows.flatMap((row) => row.closeDays)),
      ages: AGE_BUCKETS.map((bucket, index) => {
        const floor = index === 0 ? -1 : (AGE_BUCKETS[index - 1] as (typeof AGE_BUCKETS)[number]).max;

        return { key: bucket.key, label: bucket.label, count: ages.filter((age) => age > floor && age <= bucket.max).length };
      }),
      unlinkedDecisions,
      unlinkedActions,
      danglingDecisions,
      danglingActions,
      skipped,
      future,
    },
  };
}

export function filterMeetings(rows: MeetingRow[], filter: Filter): MeetingRow[] {
  if (filter === "empty") {
    return rows.filter((row) => !row.hasOutputs);
  }

  if (filter === "overdue") {
    return rows.filter((row) => row.overdue > 0);
  }

  return rows;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function daysText(value: number): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);

  return `${text} ${plural(value, "day", "days")}`;
}

export function perMeeting(total: number, held: number): string {
  if (held === 0) {
    return "—";
  }

  const value = total / held;

  return value >= 10 ? String(Math.round(value)) : (Math.round(value * 10) / 10).toString();
}

export function outputsMarkdown(outputs: Outputs, shown: MeetingRow[], projectName: string, today: number, windowLabel: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Meeting outputs: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Meetings held in the last ${windowLabel}, with the decisions and actions linked to them.`, "");
  lines.push(`- ${outputs.held} ${plural(outputs.held, "meeting", "meetings")} held; ${outputs.withOutputs} (${pct(outputs.outputShare)}) have a decision or action linked`);
  lines.push(`- ${outputs.decisions} ${plural(outputs.decisions, "decision", "decisions")}, ${outputs.pending} still proposed, ${outputs.decisionsOverdue} overdue`);
  lines.push(`- ${outputs.actions} ${plural(outputs.actions, "action", "actions")}: ${outputs.done} done (${pct(outputs.closure)}), ${outputs.open} open, ${outputs.overdue} overdue${outputs.medianClose !== null ? `; median ${daysText(outputs.medianClose)} from the meeting to completion` : ""}`, "");

  if (outputs.types.length > 0) {
    lines.push("| Meeting type | Held | With outputs | Decisions | Actions | Done | Overdue |", "| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

    for (const row of outputs.types) {
      lines.push(`| ${cell(row.label)} | ${row.held} | ${pct(row.outputShare)} | ${row.decisions} | ${row.actions} | ${pct(row.closure)} | ${row.overdue} |`);
    }

    lines.push("");
  }

  if (shown.length > 0) {
    lines.push(`${filterLabel ? `Meetings (${filterLabel.toLowerCase()}):` : "Meetings:"}`, "", "| Meeting | Date | Decisions | Actions | Done | Overdue |", "| --- | --- | ---: | ---: | ---: | ---: |");

    for (const row of shown.slice(0, 20)) {
      lines.push(`| ${cell(row.number)} ${cell(trunc(row.title, 40))} | ${formatDay(row.day)} | ${row.decisions} | ${row.actions} | ${row.done} | ${row.overdue} |`);
    }

    lines.push("");
  }

  lines.push(
    `Only meetings recorded as held are counted. A decision belongs to a meeting when it is linked to it, and an action belongs to a meeting when it is linked to it directly or through a decision taken at it; void actions are left out. A meeting with nothing linked may still have produced outputs that were recorded without a link, so treat it as a prompt to check, not a verdict. Closure is the share of linked actions that are done. An open action is overdue when its due date has passed. Time to complete runs from the meeting date to the completion date of each finished action.${outputs.unlinkedDecisions + outputs.unlinkedActions > 0 ? ` ${outputs.unlinkedDecisions} ${plural(outputs.unlinkedDecisions, "decision", "decisions")} and ${outputs.unlinkedActions} ${plural(outputs.unlinkedActions, "action", "actions")} are not linked to any meeting, whatever the period.` : ""}`,
    "",
  );

  return lines.join("\n");
}
