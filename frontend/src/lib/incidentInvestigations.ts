import { formatDay, plural, toDay, trunc, words } from "@/lib/openItems";
import type { SafetyControl, SafetyIncidentStatus, SafetyIncidentType, SafetySeverity } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 365;
export const MIN_TEXT = 5;
export const MIN_GROUP = 3;
export const REPORT_DAYS = 1;
export const OPEN_LONG = 30;
export const GOOD = 0.9;
export const WATCH = 0.7;
export const PAGE = 10;

export type Flag = "reportedLate" | "closedBeforeReported" | "noRoot" | "noInvestigation" | "noImmediate" | "openLong" | "reportedBeforeOccurred" | "noCloseDate";
export type Filter = "all" | "late" | "gaps" | "open" | "serious";

export const FLAG_ORDER: Flag[] = ["reportedLate", "closedBeforeReported", "noRoot", "noInvestigation", "noImmediate", "openLong", "reportedBeforeOccurred", "noCloseDate"];

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All incidents" },
  { key: "late", label: "Reported late" },
  { key: "gaps", label: "Closed with a gap" },
  { key: "open", label: "Still open" },
  { key: "serious", label: "Critical or high with a problem" },
];

export const BUCKETS: ReadonlyArray<{ label: string; min: number; max: number }> = [
  { label: "Same day", min: 0, max: 0 },
  { label: "Next day", min: 1, max: 1 },
  { label: "2 to 3 days", min: 2, max: 3 },
  { label: "4 to 7 days", min: 4, max: 7 },
  { label: "Over a week", min: 8, max: Number.POSITIVE_INFINITY },
];

const SEVERITY_ORDER: SafetySeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
const PLACEHOLDER = /^(n\/?a|none|nil|ok|okay|done|closed|tbd|unknown|-+|\.+|x+)$/i;
const GAP_FLAGS: Flag[] = ["noRoot", "noInvestigation", "noImmediate"];

export interface Row {
  key: string;
  reference: string;
  title: string;
  type: SafetyIncidentType;
  severity: SafetySeverity;
  status: SafetyIncidentStatus;
  occurred: number;
  reported: number | null;
  lag: number | null;
  closed: number | null;
  closedDays: number | null;
  openDays: number | null;
  immediate: string | null;
  rootCause: string | null;
  investigation: string | null;
  peopleAffected: number;
  lostTimeDays: number;
  flags: Flag[];
  isClosed: boolean;
  complete: boolean;
  serious: boolean;
}

export interface Group {
  key: string;
  label: string;
  count: number;
  measured: number;
  onTime: number;
  onTimeShare: number | null;
  closed: number;
  complete: number;
  completeShare: number | null;
}

export interface Bucket {
  label: string;
  count: number;
  share: number | null;
}

export interface Investigations {
  from: number;
  to: number;
  rows: Row[];
  severities: Group[];
  types: Group[];
  buckets: Bucket[];
  incidents: number;
  measured: number;
  onTime: number;
  onTimeShare: number | null;
  late: number;
  lagMedian: number | null;
  closed: number;
  complete: number;
  completeShare: number | null;
  noRoot: number;
  noInvestigation: number;
  noImmediate: number;
  open: number;
  openLong: number;
  serious: number;
  seriousBase: number;
  staleOutside: string[];
  voided: number;
  skipped: number;
  future: number;
}

export type InvestigationsResult = { ok: true; data: Investigations } | { ok: false; reason: "noIncidents" };

export function recorded(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();

  return text.length >= MIN_TEXT && !PLACEHOLDER.test(text);
}

function clean(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();

  return text.length > 0 ? text : null;
}

function before(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function typeLabel(type: SafetyIncidentType): string {
  return words(type);
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function dayCount(count: number): string {
  const value = Math.round(count * 10) / 10;

  return `${value} ${plural(value, "day", "days")}`;
}

export function bandOf(share: number | null, base: number): "good" | "watch" | "bad" | null {
  if (share === null || base < MIN_GROUP) {
    return null;
  }

  return share >= GOOD ? "good" : share >= WATCH ? "watch" : "bad";
}

function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

function groupOf(key: string, label: string, rows: Row[]): Group {
  const measured = rows.filter((row) => row.lag !== null);
  const onTime = measured.filter((row) => (row.lag as number) <= REPORT_DAYS).length;
  const closed = rows.filter((row) => row.isClosed);
  const complete = closed.filter((row) => row.complete).length;

  return {
    key,
    label,
    count: rows.length,
    measured: measured.length,
    onTime,
    onTimeShare: measured.length > 0 ? onTime / measured.length : null,
    closed: closed.length,
    complete,
    completeShare: closed.length > 0 ? complete / closed.length : null,
  };
}

export function buildInvestigations(data: SafetyControl, today: number, windowDays: number): InvestigationsResult {
  const all = data.incidents ?? [];
  const live = all.filter((item) => item.status !== "VOID");
  const voided = all.length - live.length;

  if (live.length === 0) {
    return { ok: false, reason: "noIncidents" };
  }

  const from = today - windowDays + 1;
  const rows: Row[] = [];
  const stale: Array<{ reference: string; occurred: number }> = [];
  let skipped = 0;
  let future = 0;

  for (const item of live) {
    const occurred = toDay(item.occurredDate);

    if (!Number.isFinite(occurred)) {
      skipped += 1;
      continue;
    }

    if (occurred > today) {
      future += 1;
      continue;
    }

    const reportedDay = toDay(item.reportedDate);
    const hasReported = Number.isFinite(reportedDay);
    const isClosed = item.status === "CLOSED";
    const startedOpen = hasReported ? reportedDay : occurred;

    if (occurred < from) {
      if (!isClosed && today - startedOpen > OPEN_LONG) {
        stale.push({ reference: item.reference, occurred });
      }

      continue;
    }

    const lag = hasReported && reportedDay >= occurred ? reportedDay - occurred : null;
    const closedDate = toDay(item.closedDate);
    const hasClosed = Number.isFinite(closedDate);
    const flags: Flag[] = [];

    if (lag !== null && lag > REPORT_DAYS) {
      flags.push("reportedLate");
    }

    if (isClosed && hasClosed && hasReported && closedDate < reportedDay) {
      flags.push("closedBeforeReported");
    }

    if (isClosed) {
      if (!recorded(item.rootCause)) {
        flags.push("noRoot");
      }

      if (!recorded(item.investigationNotes)) {
        flags.push("noInvestigation");
      }

      if (!recorded(item.immediateAction)) {
        flags.push("noImmediate");
      }
    }

    if (!isClosed && today - startedOpen > OPEN_LONG) {
      flags.push("openLong");
    }

    if (hasReported && reportedDay < occurred) {
      flags.push("reportedBeforeOccurred");
    }

    if (isClosed && !hasClosed) {
      flags.push("noCloseDate");
    }

    const ordered = FLAG_ORDER.filter((flag) => flags.includes(flag));
    const high = item.severity === "CRITICAL" || item.severity === "HIGH";
    const problem = ordered.includes("reportedLate") || ordered.some((flag) => GAP_FLAGS.includes(flag));

    rows.push({
      key: item.id,
      reference: item.reference,
      title: item.title,
      type: item.incidentType,
      severity: item.severity,
      status: item.status,
      occurred,
      reported: hasReported ? reportedDay : null,
      lag,
      closed: isClosed && hasClosed ? closedDate : null,
      closedDays: isClosed && hasClosed && hasReported && closedDate >= reportedDay ? closedDate - reportedDay : null,
      openDays: isClosed ? null : today - startedOpen,
      immediate: recorded(item.immediateAction) ? clean(item.immediateAction) : null,
      rootCause: recorded(item.rootCause) ? clean(item.rootCause) : null,
      investigation: recorded(item.investigationNotes) ? clean(item.investigationNotes) : null,
      peopleAffected: Number.isFinite(item.peopleAffected) ? item.peopleAffected : 0,
      lostTimeDays: Number.isFinite(item.lostTimeDays) ? item.lostTimeDays : 0,
      flags: ordered,
      isClosed,
      complete: isClosed && !ordered.some((flag) => GAP_FLAGS.includes(flag)),
      serious: high && problem,
    });
  }

  rows.sort((a, b) => Number(b.serious) - Number(a.serious) || b.flags.length - a.flags.length || b.occurred - a.occurred || before(a.reference, b.reference));

  const measured = rows.filter((row) => row.lag !== null);
  const onTime = measured.filter((row) => (row.lag as number) <= REPORT_DAYS).length;
  const closed = rows.filter((row) => row.isClosed);
  const complete = closed.filter((row) => row.complete).length;
  const base = rows.filter((row) => row.severity === "CRITICAL" || row.severity === "HIGH");

  return {
    ok: true,
    data: {
      from,
      to: today,
      rows,
      severities: SEVERITY_ORDER.map((severity) => groupOf(severity, words(severity), rows.filter((row) => row.severity === severity))).filter((group) => group.count > 0),
      types: [...new Set(rows.map((row) => row.type))]
        .map((type) => groupOf(type, typeLabel(type), rows.filter((row) => row.type === type)))
        .sort((a, b) => b.count - a.count || before(a.label, b.label)),
      buckets: BUCKETS.map((bucket) => {
        const count = measured.filter((row) => (row.lag as number) >= bucket.min && (row.lag as number) <= bucket.max).length;

        return { label: bucket.label, count, share: measured.length > 0 ? count / measured.length : null };
      }),
      incidents: rows.length,
      measured: measured.length,
      onTime,
      onTimeShare: measured.length > 0 ? onTime / measured.length : null,
      late: rows.filter((row) => row.flags.includes("reportedLate")).length,
      lagMedian: median(measured.map((row) => row.lag as number)),
      closed: closed.length,
      complete,
      completeShare: closed.length > 0 ? complete / closed.length : null,
      noRoot: closed.filter((row) => row.flags.includes("noRoot")).length,
      noInvestigation: closed.filter((row) => row.flags.includes("noInvestigation")).length,
      noImmediate: closed.filter((row) => row.flags.includes("noImmediate")).length,
      open: rows.filter((row) => !row.isClosed).length,
      openLong: rows.filter((row) => row.flags.includes("openLong")).length,
      serious: rows.filter((row) => row.serious).length,
      seriousBase: base.length,
      staleOutside: stale.sort((a, b) => a.occurred - b.occurred || before(a.reference, b.reference)).map((item) => item.reference),
      voided,
      skipped,
      future,
    },
  };
}

export function filterRows(rows: Row[], filter: Filter): Row[] {
  if (filter === "late") {
    return rows.filter((row) => row.flags.includes("reportedLate"));
  }

  if (filter === "gaps") {
    return rows.filter((row) => row.isClosed && row.flags.some((flag) => GAP_FLAGS.includes(flag)));
  }

  if (filter === "open") {
    return rows.filter((row) => !row.isClosed);
  }

  if (filter === "serious") {
    return rows.filter((row) => row.serious);
  }

  return rows;
}

export function flagText(flag: Flag, row: Row): string {
  if (flag === "reportedLate") {
    return `Reported ${row.lag} days after it happened`;
  }

  if (flag === "closedBeforeReported") {
    return "Closed before it was reported";
  }

  if (flag === "noRoot") {
    return "No root cause";
  }

  if (flag === "noInvestigation") {
    return "No investigation notes";
  }

  if (flag === "noImmediate") {
    return "No immediate action";
  }

  if (flag === "openLong") {
    return `Open for ${row.openDays} days`;
  }

  if (flag === "reportedBeforeOccurred") {
    return "Reported before it happened";
  }

  return "Closed with no close date";
}

export function investigationsMarkdown(data: Investigations, shown: Row[], projectName: string, windowLabel: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Incident investigations: ${projectName}`, "");
  lines.push(`${data.incidents} ${plural(data.incidents, "incident", "incidents")} in the last ${windowLabel}, from ${formatDay(data.from)} to ${formatDay(data.to)}.`, "");
  lines.push(`- ${data.onTime} of ${data.measured} reported within ${REPORT_DAYS} ${plural(REPORT_DAYS, "day", "days")} of happening (${pct(data.onTimeShare)})${data.lagMedian !== null ? `, median ${dayCount(data.lagMedian)}` : ""}`);
  lines.push(`- ${data.complete} of ${data.closed} closed ${plural(data.closed, "incident has", "incidents have")} an immediate action, a root cause and investigation notes recorded (${pct(data.completeShare)})`);
  lines.push(`- ${data.late} reported late, ${data.openLong} still open after ${OPEN_LONG} days`);
  lines.push(`- ${data.serious} of ${data.seriousBase} critical or high ${plural(data.seriousBase, "incident was", "incidents were")} reported late or closed with a gap`, "");

  if (data.severities.length > 0) {
    lines.push("| Severity | Incidents | Reported in a day | Closed complete |", "| --- | ---: | ---: | ---: |");

    for (const group of data.severities) {
      lines.push(`| ${group.label} | ${group.count} | ${pct(group.onTimeShare)} | ${pct(group.completeShare)} |`);
    }

    lines.push("");
  }

  if (shown.length > 0) {
    lines.push(filterLabel ? `Incidents (${filterLabel.toLowerCase()}):` : "Incidents:", "", "| Reference | Incident | Severity | Occurred | Problems |", "| --- | --- | --- | --- | --- |");

    for (const row of shown.slice(0, 25)) {
      lines.push(`| ${cell(row.reference)} | ${cell(trunc(row.title, 40))} | ${words(row.severity)} | ${formatDay(row.occurred)} | ${row.flags.map((flag) => flagText(flag, row)).join(", ") || "—"} |`);
    }

    lines.push("");
  }

  lines.push(
    `Incidents are counted in the period they occurred; voided incidents are left out. Reporting delay is the days from the incident to the date it was reported, and ${REPORT_DAYS} ${plural(REPORT_DAYS, "day", "days")} or less counts as prompt. A closed incident is complete when it has an immediate action, a root cause and investigation notes. A field left empty, or holding only a placeholder such as "n/a" or "ok" (fewer than ${MIN_TEXT} characters), counts as not recorded. An incident not yet closed is marked as long open after ${OPEN_LONG} days.`,
    "",
  );

  return lines.join("\n");
}
