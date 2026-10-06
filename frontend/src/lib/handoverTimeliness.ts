import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { HandoverCategory, HandoverStatus, QualityControl } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 365;
export const MIN_GROUP = 3;
export const SOON_DAYS = 14;
export const GOOD = 0.9;
export const WATCH = 0.7;
export const PAGE = 10;

export type Outcome = "onTime" | "late" | "missing" | "unclear";
export type Flag = "missing" | "rejected" | "late" | "noReceivedDate" | "receivedInFuture" | "approvedBeforeReceived" | "noApprovalDate" | "notStartedButReceived" | "noOwner";
export type Filter = "all" | "missing" | "late" | "rejected" | "dates";

export const FLAG_ORDER: Flag[] = ["missing", "rejected", "late", "noReceivedDate", "receivedInFuture", "approvedBeforeReceived", "noApprovalDate", "notStartedButReceived", "noOwner"];
export const DATE_FLAGS: Flag[] = ["noReceivedDate", "receivedInFuture", "approvedBeforeReceived", "noApprovalDate", "notStartedButReceived"];

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All due items" },
  { key: "missing", label: "Still missing" },
  { key: "late", label: "Delivered late" },
  { key: "rejected", label: "Rejected" },
  { key: "dates", label: "Date problems" },
];

export const BUCKETS: ReadonlyArray<{ label: string; kind: "onTime" | "late" | "missing"; min: number; max: number }> = [
  { label: "On time", kind: "onTime", min: 0, max: 0 },
  { label: "1 to 7 days late", kind: "late", min: 1, max: 7 },
  { label: "8 to 30 days late", kind: "late", min: 8, max: 30 },
  { label: "Over 30 days late", kind: "late", min: 31, max: Number.POSITIVE_INFINITY },
  { label: "Still missing", kind: "missing", min: 0, max: 0 },
];

const CATEGORY_LABELS: Record<HandoverCategory, string> = {
  OM_MANUAL: "O&M manual",
  AS_BUILT: "As-built drawings",
  CERTIFICATE: "Certificate",
  WARRANTY: "Warranty",
  TEST_RECORD: "Test record",
  TRAINING: "Training",
  OTHER: "Other",
};

export interface Row {
  key: string;
  code: string;
  title: string;
  category: HandoverCategory;
  owner: string | null;
  status: HandoverStatus;
  due: number;
  received: number | null;
  approved: number | null;
  outcome: Outcome;
  lateDays: number | null;
  overdueDays: number | null;
  approvalDays: number | null;
  flags: Flag[];
  rank: number;
}

export interface Group {
  key: string;
  label: string;
  count: number;
  judged: number;
  onTime: number;
  onTimeShare: number | null;
  delivered: number;
  deliveredShare: number | null;
}

export interface Bucket {
  label: string;
  kind: "onTime" | "late" | "missing";
  count: number;
  share: number | null;
}

export interface Handover {
  from: number;
  to: number;
  rows: Row[];
  categories: Group[];
  owners: Group[];
  buckets: Bucket[];
  due: number;
  judged: number;
  onTime: number;
  onTimeShare: number | null;
  late: number;
  lateMedian: number | null;
  missing: number;
  rejected: number;
  unclear: number;
  dateProblems: number;
  approved: number;
  approvalMedian: number | null;
  dueSoon: string[];
  staleOutside: string[];
  upcoming: number;
  notRequired: number;
  skipped: number;
}

export type HandoverResult = { ok: true; data: Handover } | { ok: false; reason: "noItems" };

function before(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function categoryLabel(category: HandoverCategory): string {
  return CATEGORY_LABELS[category] ?? category;
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
  const onTime = rows.filter((row) => row.outcome === "onTime").length;
  const late = rows.filter((row) => row.outcome === "late").length;
  const missing = rows.filter((row) => row.outcome === "missing").length;
  const judged = onTime + late + missing;

  return {
    key,
    label,
    count: rows.length,
    judged,
    onTime,
    onTimeShare: judged > 0 ? onTime / judged : null,
    delivered: onTime + late,
    deliveredShare: judged > 0 ? (onTime + late) / judged : null,
  };
}

function ownerOf(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();

  return text.length > 0 ? text : null;
}

export function buildHandover(data: QualityControl, today: number, windowDays: number): HandoverResult {
  const all = data.handoverItems ?? [];
  const required = all.filter((item) => item.status !== "NOT_REQUIRED");
  const notRequired = all.length - required.length;

  if (required.length === 0) {
    return { ok: false, reason: "noItems" };
  }

  const from = today - windowDays;
  const to = today - 1;
  const rows: Row[] = [];
  const stale: Array<{ code: string; due: number }> = [];
  const soon: Array<{ code: string; due: number }> = [];
  let skipped = 0;
  let upcoming = 0;

  for (const item of required) {
    const due = toDay(item.dueDate);

    if (!Number.isFinite(due)) {
      skipped += 1;
      continue;
    }

    const receivedDay = toDay(item.receivedDate);
    const approvedDay = toDay(item.approvedDate);
    const hasReceived = Number.isFinite(receivedDay);
    const hasApproved = Number.isFinite(approvedDay);
    const sentByStatus = item.status === "SUBMITTED" || item.status === "APPROVED";
    const owner = ownerOf(item.ownerName);

    if (due >= today) {
      upcoming += 1;

      if (due <= today + SOON_DAYS && !hasReceived && !hasApproved && !sentByStatus) {
        soon.push({ code: item.code, due });
      }

      continue;
    }

    let outcome: Outcome;

    if (hasReceived && receivedDay <= today) {
      outcome = receivedDay <= due ? "onTime" : "late";
    } else if (hasReceived || hasApproved || sentByStatus) {
      outcome = "unclear";
    } else {
      outcome = "missing";
    }

    if (due < from) {
      if (outcome === "missing") {
        stale.push({ code: item.code, due });
      }

      continue;
    }

    const flags: Flag[] = [];

    if (outcome === "missing") {
      flags.push("missing");
    }

    if (item.status === "REJECTED") {
      flags.push("rejected");
    }

    if (outcome === "late") {
      flags.push("late");
    }

    if (outcome === "unclear") {
      flags.push(hasReceived ? "receivedInFuture" : "noReceivedDate");
    }

    if (hasReceived && hasApproved && approvedDay < receivedDay) {
      flags.push("approvedBeforeReceived");
    }

    if (item.status === "APPROVED" && !hasApproved) {
      flags.push("noApprovalDate");
    }

    if (item.status === "NOT_STARTED" && hasReceived) {
      flags.push("notStartedButReceived");
    }

    if (outcome === "missing" && owner === null) {
      flags.push("noOwner");
    }

    const ordered = FLAG_ORDER.filter((flag) => flags.includes(flag));
    const rank = outcome === "missing" ? 0 : ordered.includes("rejected") ? 1 : outcome === "late" ? 2 : outcome === "unclear" ? 3 : ordered.length > 0 ? 4 : 5;

    rows.push({
      key: item.id,
      code: item.code,
      title: item.title,
      category: item.category,
      owner,
      status: item.status,
      due,
      received: hasReceived ? receivedDay : null,
      approved: hasApproved ? approvedDay : null,
      outcome,
      lateDays: outcome === "late" ? receivedDay - due : null,
      overdueDays: outcome === "missing" ? today - due : null,
      approvalDays: item.status === "APPROVED" && hasReceived && hasApproved && approvedDay >= receivedDay ? approvedDay - receivedDay : null,
      flags: ordered,
      rank,
    });
  }

  const weight = (row: Row) => row.overdueDays ?? row.lateDays ?? 0;

  rows.sort((a, b) => a.rank - b.rank || weight(b) - weight(a) || b.flags.length - a.flags.length || b.due - a.due || before(a.code, b.code));

  const onTime = rows.filter((row) => row.outcome === "onTime").length;
  const late = rows.filter((row) => row.outcome === "late");
  const missing = rows.filter((row) => row.outcome === "missing").length;
  const judged = onTime + late.length + missing;
  const approvals = rows.filter((row) => row.approvalDays !== null).map((row) => row.approvalDays as number);

  const categoryKeys = [...new Set(rows.map((row) => row.category))];
  const ownerKeys = [...new Set(rows.map((row) => row.owner ?? ""))];

  return {
    ok: true,
    data: {
      from,
      to,
      rows,
      categories: categoryKeys.map((key) => groupOf(key, categoryLabel(key), rows.filter((row) => row.category === key))).sort((a, b) => b.count - a.count || before(a.label, b.label)),
      owners: ownerKeys.map((key) => groupOf(key, key === "" ? "No owner" : key, rows.filter((row) => (row.owner ?? "") === key))).sort((a, b) => b.count - a.count || before(a.label, b.label)),
      buckets: BUCKETS.map((bucket) => {
        const count =
          bucket.kind === "onTime"
            ? onTime
            : bucket.kind === "missing"
              ? missing
              : late.filter((row) => (row.lateDays as number) >= bucket.min && (row.lateDays as number) <= bucket.max).length;

        return { label: bucket.label, kind: bucket.kind, count, share: judged > 0 ? count / judged : null };
      }),
      due: rows.length,
      judged,
      onTime,
      onTimeShare: judged > 0 ? onTime / judged : null,
      late: late.length,
      lateMedian: median(late.map((row) => row.lateDays as number)),
      missing,
      rejected: rows.filter((row) => row.flags.includes("rejected")).length,
      unclear: rows.filter((row) => row.outcome === "unclear").length,
      dateProblems: rows.filter((row) => row.flags.some((flag) => DATE_FLAGS.includes(flag))).length,
      approved: approvals.length,
      approvalMedian: median(approvals),
      dueSoon: soon.sort((a, b) => a.due - b.due || before(a.code, b.code)).map((item) => item.code),
      staleOutside: stale.sort((a, b) => a.due - b.due || before(a.code, b.code)).map((item) => item.code),
      upcoming,
      notRequired,
      skipped,
    },
  };
}

export function filterRows(rows: Row[], filter: Filter): Row[] {
  if (filter === "missing") {
    return rows.filter((row) => row.outcome === "missing");
  }

  if (filter === "late") {
    return rows.filter((row) => row.outcome === "late");
  }

  if (filter === "rejected") {
    return rows.filter((row) => row.flags.includes("rejected"));
  }

  if (filter === "dates") {
    return rows.filter((row) => row.flags.some((flag) => DATE_FLAGS.includes(flag)));
  }

  return rows;
}

export function flagText(flag: Flag, row: Row): string {
  if (flag === "missing") {
    return `Not received, ${dayCount(row.overdueDays ?? 0)} overdue`;
  }

  if (flag === "rejected") {
    return "Rejected";
  }

  if (flag === "late") {
    return `Delivered ${dayCount(row.lateDays ?? 0)} late`;
  }

  if (flag === "noReceivedDate") {
    return "Sent, but no received date";
  }

  if (flag === "receivedInFuture") {
    return "Received date is in the future";
  }

  if (flag === "approvedBeforeReceived") {
    return "Approved before it was received";
  }

  if (flag === "noApprovalDate") {
    return "Approved, but no approval date";
  }

  if (flag === "notStartedButReceived") {
    return "Received, but status is not started";
  }

  return "Missing and no owner named";
}

export function handoverMarkdown(data: Handover, shown: Row[], projectName: string, windowLabel: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Handover timeliness: ${projectName}`, "");
  lines.push(`${data.due} handover ${plural(data.due, "item", "items")} fell due in the last ${windowLabel}, from ${formatDay(data.from)} to ${formatDay(data.to)}.`, "");
  lines.push(`- ${data.onTime} of ${data.judged} judged ${plural(data.judged, "item was", "items were")} received by the due date (${pct(data.onTimeShare)})`);
  lines.push(`- ${data.late} delivered late${data.lateMedian !== null ? `, median ${dayCount(data.lateMedian)} late` : ""}`);
  lines.push(`- ${data.missing} still not received, ${data.rejected} rejected`);

  if (data.approvalMedian !== null) {
    lines.push(`- Approval took a median of ${dayCount(data.approvalMedian)} from receipt (${data.approved} approved ${plural(data.approved, "item", "items")} measured)`);
  }

  if (data.unclear > 0) {
    lines.push(`- ${data.unclear} ${plural(data.unclear, "item cannot", "items cannot")} be judged because the received date is missing or in the future`);
  }

  lines.push("");

  if (data.categories.length > 0) {
    lines.push("| Category | Items | Received on time | Delivered at all |", "| --- | ---: | ---: | ---: |");

    for (const group of data.categories) {
      lines.push(`| ${group.label} | ${group.count} | ${pct(group.onTimeShare)} | ${pct(group.deliveredShare)} |`);
    }

    lines.push("");
  }

  if (shown.length > 0) {
    lines.push(filterLabel ? `Items (${filterLabel.toLowerCase()}):` : "Items:", "", "| Code | Item | Category | Due | Problems |", "| --- | --- | --- | --- | --- |");

    for (const row of shown.slice(0, 25)) {
      lines.push(`| ${cell(row.code)} | ${cell(trunc(row.title, 40))} | ${categoryLabel(row.category)} | ${formatDay(row.due)} | ${row.flags.map((flag) => flagText(flag, row)).join(", ") || "—"} |`);
    }

    lines.push("");
  }

  if (data.dueSoon.length > 0) {
    lines.push(`Falling due within ${SOON_DAYS} days and not yet received: ${data.dueSoon.slice(0, 10).join(", ")}${data.dueSoon.length > 10 ? ` and ${data.dueSoon.length - 10} more` : ""}.`, "");
  }

  lines.push(
    `Only items that fell due before today are judged; items due today or later are not. An item counts as on time when its received date is on or before the due date. An item with no received date, and no sign that it was sent, is counted as still missing. Items marked not required are left out.`,
    "",
  );

  return lines.join("\n");
}
