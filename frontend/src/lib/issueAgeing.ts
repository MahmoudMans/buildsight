import { formatDay, plural, toDay, trunc, words } from "@/lib/openItems";
import type { IssueSeverity, IssueStatus, RiskControl } from "@/types/project";

export const NOT_STARTED_DAYS = 14;
export const LONG_OPEN_DAYS = 60;
export const MIN_GROUP = 3;
export const GOOD = 0.9;
export const WATCH = 0.7;
export const PAGE = 10;

export type Flag = "overdue" | "notStarted" | "noOwner" | "noTarget" | "targetBeforeRaised" | "longOpen";
export type Filter = "all" | "overdue" | "notStarted" | "gaps" | "serious";

export const FLAG_ORDER: Flag[] = ["overdue", "notStarted", "noOwner", "noTarget", "targetBeforeRaised", "longOpen"];
const GAP_FLAGS: Flag[] = ["noOwner", "noTarget", "targetBeforeRaised"];

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All open issues" },
  { key: "overdue", label: "Past target" },
  { key: "notStarted", label: "Not started" },
  { key: "gaps", label: "Owner or target problem" },
  { key: "serious", label: "Critical or high with a problem" },
];

export const BUCKETS: ReadonlyArray<{ label: string; min: number; max: number }> = [
  { label: "Up to 2 weeks", min: 0, max: 14 },
  { label: "15 to 30 days", min: 15, max: 30 },
  { label: "31 to 60 days", min: 31, max: 60 },
  { label: "61 to 90 days", min: 61, max: 90 },
  { label: "Over 90 days", min: 91, max: Number.POSITIVE_INFINITY },
];

const SEVERITY_ORDER: IssueSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export interface Row {
  key: string;
  reference: string;
  title: string;
  severity: IssueSeverity;
  status: IssueStatus;
  owner: string | null;
  sourceRisk: string | null;
  raised: number | null;
  target: number | null;
  age: number | null;
  overdueDays: number | null;
  dueIn: number | null;
  flags: Flag[];
  serious: boolean;
}

export interface Group {
  key: string;
  label: string;
  count: number;
  withTarget: number;
  onTime: number;
  onTimeShare: number | null;
  started: number;
  startedShare: number | null;
}

export interface Bucket {
  label: string;
  count: number;
  overdue: number;
  share: number | null;
}

export interface Ageing {
  rows: Row[];
  buckets: Bucket[];
  severities: Group[];
  owners: Group[];
  open: number;
  closed: number;
  overdue: number;
  overdueMedian: number | null;
  ageMedian: number | null;
  oldest: number | null;
  notStarted: number;
  noOwner: number;
  noTarget: number;
  targetBeforeRaised: number;
  longOpen: number;
  serious: number;
  seriousBase: number;
  undated: number;
}

export type AgeingResult = { ok: true; data: Ageing } | { ok: false; reason: "noIssues" | "allClosed" };

function before(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
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
  const withTarget = rows.filter((row) => row.target !== null);
  const onTime = withTarget.filter((row) => row.overdueDays === null).length;
  const started = rows.filter((row) => row.status === "IN_PROGRESS").length;

  return {
    key,
    label,
    count: rows.length,
    withTarget: withTarget.length,
    onTime,
    onTimeShare: withTarget.length > 0 ? onTime / withTarget.length : null,
    started,
    startedShare: rows.length > 0 ? started / rows.length : null,
  };
}

function roundedMedian(values: number[]): number | null {
  const value = median(values);

  return value === null ? null : Math.round(value);
}

export function buildAgeing(data: RiskControl, today: number): AgeingResult {
  const all = data.issues ?? [];

  if (all.length === 0) {
    return { ok: false, reason: "noIssues" };
  }

  const live = all.filter((issue) => issue.status === "OPEN" || issue.status === "IN_PROGRESS");
  const closed = all.length - live.length;

  if (live.length === 0) {
    return { ok: false, reason: "allClosed" };
  }

  const rows: Row[] = [];

  for (const issue of live) {
    const raisedDay = toDay(issue.createdAt);
    const targetDay = toDay(issue.targetResolutionDate);
    const hasRaised = Number.isFinite(raisedDay);
    const hasTarget = Number.isFinite(targetDay);
    const age = hasRaised ? Math.max(0, today - raisedDay) : null;
    const owner = (issue.ownerName ?? "").trim();
    const flags: Flag[] = [];

    if (hasTarget && targetDay < today) {
      flags.push("overdue");
    }

    if (issue.status === "OPEN" && age !== null && age > NOT_STARTED_DAYS) {
      flags.push("notStarted");
    }

    if (owner.length === 0) {
      flags.push("noOwner");
    }

    if (!hasTarget) {
      flags.push("noTarget");
    }

    if (hasTarget && hasRaised && targetDay < raisedDay) {
      flags.push("targetBeforeRaised");
    }

    if (age !== null && age > LONG_OPEN_DAYS) {
      flags.push("longOpen");
    }

    const ordered = FLAG_ORDER.filter((flag) => flags.includes(flag));
    const high = issue.severity === "CRITICAL" || issue.severity === "HIGH";

    rows.push({
      key: issue.id,
      reference: issue.reference,
      title: issue.title,
      severity: issue.severity,
      status: issue.status,
      owner: owner.length > 0 ? owner : null,
      sourceRisk: (issue.sourceRiskReference ?? "").trim() || null,
      raised: hasRaised ? raisedDay : null,
      target: hasTarget ? targetDay : null,
      age,
      overdueDays: hasTarget && targetDay < today ? today - targetDay : null,
      dueIn: hasTarget && targetDay >= today ? targetDay - today : null,
      flags: ordered,
      serious: high && (ordered.includes("overdue") || ordered.includes("notStarted") || ordered.includes("noOwner")),
    });
  }

  const ageOf = (row: Row) => (row.age === null ? -1 : row.age);

  rows.sort((a, b) => Number(b.serious) - Number(a.serious) || b.flags.length - a.flags.length || ageOf(b) - ageOf(a) || before(a.reference, b.reference) || before(a.key, b.key));

  const dated = rows.filter((row) => row.age !== null);
  const overdue = rows.filter((row) => row.overdueDays !== null);
  const ownerKeys = [...new Set(rows.map((row) => row.owner ?? ""))];
  const high = rows.filter((row) => row.severity === "CRITICAL" || row.severity === "HIGH");

  return {
    ok: true,
    data: {
      rows,
      buckets: BUCKETS.map((bucket) => {
        const inside = dated.filter((row) => (row.age as number) >= bucket.min && (row.age as number) <= bucket.max);

        return { label: bucket.label, count: inside.length, overdue: inside.filter((row) => row.overdueDays !== null).length, share: dated.length > 0 ? inside.length / dated.length : null };
      }),
      severities: SEVERITY_ORDER.map((severity) => groupOf(severity, words(severity), rows.filter((row) => row.severity === severity))).filter((group) => group.count > 0),
      owners: ownerKeys.map((key) => groupOf(key, key === "" ? "No owner" : key, rows.filter((row) => (row.owner ?? "") === key))).sort((a, b) => b.count - a.count || before(a.label, b.label)),
      open: rows.length,
      closed,
      overdue: overdue.length,
      overdueMedian: roundedMedian(overdue.map((row) => row.overdueDays as number)),
      ageMedian: roundedMedian(dated.map((row) => row.age as number)),
      oldest: dated.length > 0 ? Math.max(...dated.map((row) => row.age as number)) : null,
      notStarted: rows.filter((row) => row.flags.includes("notStarted")).length,
      noOwner: rows.filter((row) => row.flags.includes("noOwner")).length,
      noTarget: rows.filter((row) => row.flags.includes("noTarget")).length,
      targetBeforeRaised: rows.filter((row) => row.flags.includes("targetBeforeRaised")).length,
      longOpen: rows.filter((row) => row.flags.includes("longOpen")).length,
      serious: rows.filter((row) => row.serious).length,
      seriousBase: high.length,
      undated: rows.length - dated.length,
    },
  };
}

export function filterRows(rows: Row[], filter: Filter): Row[] {
  if (filter === "overdue") {
    return rows.filter((row) => row.flags.includes("overdue"));
  }

  if (filter === "notStarted") {
    return rows.filter((row) => row.flags.includes("notStarted"));
  }

  if (filter === "gaps") {
    return rows.filter((row) => row.flags.some((flag) => GAP_FLAGS.includes(flag)));
  }

  if (filter === "serious") {
    return rows.filter((row) => row.serious);
  }

  return rows;
}

export function flagText(flag: Flag, row: Row): string {
  if (flag === "overdue") {
    return `Past target by ${dayCount(row.overdueDays ?? 0)}`;
  }

  if (flag === "notStarted") {
    return `Not started, ${dayCount(row.age ?? 0)} old`;
  }

  if (flag === "noOwner") {
    return "No owner";
  }

  if (flag === "noTarget") {
    return "No target date";
  }

  if (flag === "targetBeforeRaised") {
    return "Target before raised date";
  }

  return `Open ${dayCount(row.age ?? 0)}`;
}

export function ageingMarkdown(data: Ageing, shown: Row[], projectName: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Issue ageing: ${projectName}`, "");
  lines.push(`${data.open} open ${plural(data.open, "issue", "issues")} (open or in progress); ${data.closed} resolved or closed ${plural(data.closed, "issue is", "issues are")} left out.`, "");
  lines.push(`- ${data.overdue} past ${plural(data.overdue, "its", "their")} target date${data.overdueMedian !== null ? `, median ${dayCount(data.overdueMedian)} past` : ""}`);
  lines.push(`- Median age ${data.ageMedian !== null ? dayCount(data.ageMedian) : "unknown"}${data.oldest !== null ? `, oldest ${dayCount(data.oldest)}` : ""}`);
  lines.push(`- ${data.notStarted} still marked open (not started) after ${NOT_STARTED_DAYS} days, ${data.longOpen} open for over ${LONG_OPEN_DAYS} days`);
  lines.push(`- ${data.noOwner} with no owner, ${data.noTarget} with no target date`);
  lines.push(`- ${data.serious} of ${data.seriousBase} critical or high ${plural(data.seriousBase, "issue is", "issues are")} past target, not started or without an owner`, "");

  lines.push("| Age | Issues | Past target |", "| --- | ---: | ---: |");

  for (const bucket of data.buckets) {
    lines.push(`| ${bucket.label} | ${bucket.count} | ${bucket.overdue} |`);
  }

  lines.push("");

  if (shown.length > 0) {
    lines.push(filterLabel ? `Issues (${filterLabel.toLowerCase()}):` : "Issues:", "", "| Reference | Issue | Severity | Raised | Target | Problems |", "| --- | --- | --- | --- | --- | --- |");

    for (const row of shown.slice(0, 25)) {
      lines.push(`| ${cell(row.reference)} | ${cell(trunc(row.title, 40))} | ${words(row.severity)} | ${row.raised !== null ? formatDay(row.raised) : "—"} | ${row.target !== null ? formatDay(row.target) : "—"} | ${row.flags.map((flag) => flagText(flag, row)).join(", ") || "—"} |`);
    }

    lines.push("");
  }

  lines.push(
    `Only issues that are open or in progress are counted. Age is the days since the issue was created. An issue is past target when its target date is before today. An issue still marked open, not in progress, after ${NOT_STARTED_DAYS} days is counted as not started. Resolved and closed issues carry no resolution date, so how quickly they were closed cannot be measured.`,
    "",
  );

  return lines.join("\n");
}
