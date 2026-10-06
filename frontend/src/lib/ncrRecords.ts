import { formatDay, plural, toDay, trunc, words } from "@/lib/openItems";
import type { NcrCategory, NcrSeverity, QualityControl } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 180;
export const MIN_TEXT = 5;
export const MIN_GROUP = 3;
export const GOOD = 0.9;
export const WATCH = 0.7;
export const PAGE = 10;

export type Gap = "noRoot" | "noAction" | "noVerification";
export type DateFlag = "noCloseDate" | "closedBeforeRaised";
export type Flag = Gap | DateFlag;
export type Filter = "all" | "rootCause" | "action" | "verification" | "serious";

export const FLAG_LABEL: Record<Flag, string> = {
  noRoot: "No root cause",
  noAction: "No corrective action",
  noVerification: "No verification",
  noCloseDate: "No close date",
  closedBeforeRaised: "Closed before raised",
};

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All closed NCRs" },
  { key: "rootCause", label: "No root cause" },
  { key: "action", label: "No corrective action" },
  { key: "verification", label: "No verification" },
  { key: "serious", label: "Critical or major with a gap" },
];

const SEVERITY_WEIGHT: Record<NcrSeverity, number> = { CRITICAL: 3, MAJOR: 2, MINOR: 1 };
const SEVERITY_ORDER: NcrSeverity[] = ["CRITICAL", "MAJOR", "MINOR"];
const PLACEHOLDER = /^(n\/?a|none|nil|ok|okay|done|closed|tbd|unknown|-+|\.+|x+)$/i;

export interface Closed {
  key: string;
  reference: string;
  title: string;
  category: NcrCategory;
  severity: NcrSeverity;
  owner: string | null;
  raised: number;
  closedDay: number;
  daysOpen: number | null;
  rootCause: string | null;
  action: string | null;
  verification: string | null;
  gaps: Gap[];
  dateFlags: DateFlag[];
  complete: boolean;
  serious: boolean;
}

export interface Group {
  key: string;
  label: string;
  closed: number;
  complete: number;
  share: number | null;
}

export interface Records {
  from: number;
  to: number;
  rows: Closed[];
  severities: Group[];
  categories: Group[];
  owners: Group[];
  closed: number;
  complete: number;
  completeShare: number | null;
  noRoot: number;
  noAction: number;
  noVerification: number;
  serious: number;
  seriousBase: number;
  readyIncomplete: string[];
  voided: number;
  skipped: number;
  future: number;
}

export type RecordsResult = { ok: true; data: Records } | { ok: false; reason: "noNcrs" | "noneClosed" };

export function recorded(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();

  return text.length >= MIN_TEXT && !PLACEHOLDER.test(text);
}

function clean(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();

  return text.length > 0 ? text : null;
}

export function categoryLabel(category: NcrCategory): string {
  return category === "TEST_FAILURE" ? "Test failure" : words(category);
}

export function severityLabel(severity: NcrSeverity): string {
  return words(severity);
}

function groupOf(key: string, label: string, rows: Closed[]): Group {
  const complete = rows.filter((row) => row.complete).length;

  return { key, label, closed: rows.length, complete, share: rows.length > 0 ? complete / rows.length : null };
}

export function bandOf(group: { closed: number; share: number | null }): "good" | "watch" | "bad" | null {
  if (group.share === null || group.closed < MIN_GROUP) {
    return null;
  }

  return group.share >= GOOD ? "good" : group.share >= WATCH ? "watch" : "bad";
}

export function buildRecords(data: QualityControl, today: number, windowDays: number): RecordsResult {
  const all = data.ncrs ?? [];
  const live = all.filter((item) => item.status !== "VOID");
  const voided = all.length - live.length;

  if (live.length === 0) {
    return { ok: false, reason: "noNcrs" };
  }

  if (!live.some((item) => item.status === "CLOSED")) {
    return { ok: false, reason: "noneClosed" };
  }

  const from = today - windowDays + 1;
  const rows: Closed[] = [];
  let skipped = 0;
  let future = 0;

  for (const item of live) {
    if (item.status !== "CLOSED") {
      continue;
    }

    const closedDate = toDay(item.closedDate);
    const day = Number.isFinite(closedDate) ? closedDate : toDay(item.updatedAt);

    if (!Number.isFinite(day)) {
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

    const raised = toDay(item.raisedDate);
    const gaps: Gap[] = [];
    const dateFlags: DateFlag[] = [];

    if (!recorded(item.rootCause)) {
      gaps.push("noRoot");
    }

    if (!recorded(item.correctiveAction)) {
      gaps.push("noAction");
    }

    if (!recorded(item.verificationNotes)) {
      gaps.push("noVerification");
    }

    if (!Number.isFinite(closedDate)) {
      dateFlags.push("noCloseDate");
    }

    if (Number.isFinite(raised) && Number.isFinite(closedDate) && closedDate < raised) {
      dateFlags.push("closedBeforeRaised");
    }

    rows.push({
      key: item.id,
      reference: item.reference,
      title: item.title,
      category: item.category,
      severity: item.severity,
      owner: clean(item.ownerName),
      raised,
      closedDay: day,
      daysOpen: Number.isFinite(raised) && Number.isFinite(closedDate) && closedDate >= raised ? closedDate - raised : null,
      rootCause: recorded(item.rootCause) ? clean(item.rootCause) : null,
      action: recorded(item.correctiveAction) ? clean(item.correctiveAction) : null,
      verification: recorded(item.verificationNotes) ? clean(item.verificationNotes) : null,
      gaps,
      dateFlags,
      complete: gaps.length === 0,
      serious: gaps.length > 0 && (item.severity === "CRITICAL" || item.severity === "MAJOR"),
    });
  }

  rows.sort((a, b) => Number(b.serious) - Number(a.serious) || b.gaps.length + b.dateFlags.length - (a.gaps.length + a.dateFlags.length) || SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity] || b.closedDay - a.closedDay || a.reference.localeCompare(b.reference));

  const ownerRows = new Map<string, { names: Map<string, number>; rows: Closed[] }>();

  for (const row of rows) {
    const key = (row.owner ?? "").toLowerCase();
    const entry = ownerRows.get(key) ?? { names: new Map<string, number>(), rows: [] };

    if (row.owner) {
      entry.names.set(row.owner, (entry.names.get(row.owner) ?? 0) + 1);
    }

    entry.rows.push(row);
    ownerRows.set(key, entry);
  }

  const owners: Group[] = [...ownerRows.entries()]
    .map(([key, entry]) => {
      const names = [...entry.names.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

      return groupOf(key || "none", names[0] ? names[0][0] : "No owner recorded", entry.rows);
    })
    .sort((a, b) => Number(a.key === "none") - Number(b.key === "none") || b.closed - a.closed || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0));

  const categories: Group[] = [...new Set(rows.map((row) => row.category))]
    .map((category) => groupOf(category, categoryLabel(category), rows.filter((row) => row.category === category)))
    .sort((a, b) => b.closed - a.closed || a.label.localeCompare(b.label));

  const complete = rows.filter((row) => row.complete).length;
  const base = rows.filter((row) => row.severity === "CRITICAL" || row.severity === "MAJOR");

  return {
    ok: true,
    data: {
      from,
      to: today,
      rows,
      severities: SEVERITY_ORDER.map((severity) => groupOf(severity, severityLabel(severity), rows.filter((row) => row.severity === severity))).filter((group) => group.closed > 0),
      categories,
      owners,
      closed: rows.length,
      complete,
      completeShare: rows.length > 0 ? complete / rows.length : null,
      noRoot: rows.filter((row) => row.gaps.includes("noRoot")).length,
      noAction: rows.filter((row) => row.gaps.includes("noAction")).length,
      noVerification: rows.filter((row) => row.gaps.includes("noVerification")).length,
      serious: rows.filter((row) => row.serious).length,
      seriousBase: base.length,
      readyIncomplete: live.filter((item) => item.status === "READY_FOR_VERIFICATION" && !recorded(item.correctiveAction)).map((item) => item.reference),
      voided,
      skipped,
      future,
    },
  };
}

export function filterRows(rows: Closed[], filter: Filter): Closed[] {
  if (filter === "rootCause") {
    return rows.filter((row) => row.gaps.includes("noRoot"));
  }

  if (filter === "action") {
    return rows.filter((row) => row.gaps.includes("noAction"));
  }

  if (filter === "verification") {
    return rows.filter((row) => row.gaps.includes("noVerification"));
  }

  if (filter === "serious") {
    return rows.filter((row) => row.serious);
  }

  return rows;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function flagsOf(row: Closed): Flag[] {
  return [...row.gaps, ...row.dateFlags];
}

export function recordsMarkdown(data: Records, shown: Closed[], projectName: string, windowLabel: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# NCR closure records: ${projectName}`, "");
  lines.push(`${data.closed} ${plural(data.closed, "NCR", "NCRs")} closed in the last ${windowLabel}, from ${formatDay(data.from)} to ${formatDay(data.to)}.`, "");
  lines.push(`- ${data.complete} of ${data.closed} have a root cause, a corrective action and verification recorded (${pct(data.completeShare)})`);
  lines.push(`- ${data.noRoot} with no root cause, ${data.noAction} with no corrective action, ${data.noVerification} with no verification`);
  lines.push(`- ${data.serious} of ${data.seriousBase} critical or major ${plural(data.seriousBase, "NCR was", "NCRs were")} closed with a gap`, "");

  if (data.severities.length > 0) {
    lines.push("| Severity | Closed | Complete | Share |", "| --- | ---: | ---: | ---: |");

    for (const group of data.severities) {
      lines.push(`| ${group.label} | ${group.closed} | ${group.complete} | ${pct(group.share)} |`);
    }

    lines.push("");
  }

  if (shown.length > 0) {
    lines.push(`${filterLabel ? `NCRs (${filterLabel.toLowerCase()}):` : "NCRs:"}`, "", "| Reference | NCR | Severity | Closed | Owner | Gaps |", "| --- | --- | --- | --- | --- | --- |");

    for (const row of shown.slice(0, 25)) {
      lines.push(`| ${cell(row.reference)} | ${cell(trunc(row.title, 40))} | ${severityLabel(row.severity)} | ${formatDay(row.closedDay)} | ${cell(row.owner ?? "—")} | ${flagsOf(row).map((flag) => FLAG_LABEL[flag]).join(", ") || "—"} |`);
    }

    lines.push("");
  }

  lines.push(
    `A closed NCR is complete when it has a root cause, a corrective action and verification notes. A field left empty, or holding only a placeholder such as "n/a" or "ok" (fewer than ${MIN_TEXT} characters), counts as not recorded. Voided NCRs are left out.`,
    "",
  );

  return lines.join("\n");
}
