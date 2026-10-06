import { daysText, median, percentile, rateText, windowLabel } from "@/lib/closureSpeed";
import { formatDay, plural, toDay, trunc, words } from "@/lib/openItems";
import type { ScheduleConstraintType, ScheduleControl } from "@/types/project";

export const LIST_LIMIT = 8;
export const NO_OWNER = "No owner";

export type GroupBy = "type" | "owner";
export type OpenFilter = "all" | "late" | "critical";

export const GROUPS: ReadonlyArray<{ key: GroupBy; label: string }> = [
  { key: "type", label: "By kind of constraint" },
  { key: "owner", label: "By owner" },
];

export const OPEN_FILTERS: ReadonlyArray<{ key: OpenFilter; label: string }> = [
  { key: "all", label: "All open" },
  { key: "late", label: "Past due" },
  { key: "critical", label: "On critical path" },
];

export const AGE_BINS: ReadonlyArray<{ label: string; max: number }> = [
  { label: "0–7", max: 7 },
  { label: "8–14", max: 14 },
  { label: "15–30", max: 30 },
  { label: "31–60", max: 60 },
  { label: "61–90", max: 90 },
  { label: "90+", max: Infinity },
];

export interface Item {
  id: string;
  activityId: string;
  code: string;
  activity: string;
  type: ScheduleConstraintType;
  title: string;
  owner: string | null;
  created: number;
  due: number | null;
  status: "OPEN" | "RESOLVED" | "WAIVED";
  resolved: number | null;
  critical: boolean;
  nearCritical: boolean;
  age: number;
  daysLate: number;
  took: number | null;
}

export interface Group {
  key: string;
  name: string;
  open: number;
  overdue: number;
  oldest: number | null;
  cleared: number;
  dated: number;
  onTime: number;
  rate: number | null;
  median: number | null;
  onCritical: number;
}

export interface Bin {
  label: string;
  count: number;
  overdue: number;
}

export interface ConstraintLog {
  items: Item[];
  open: Item[];
  groups: Group[];
  bins: Bin[];
  windowDays: number | null;
  openCount: number;
  overdueCount: number;
  onCritical: number;
  cleared: number;
  dated: number;
  onTime: number;
  rate: number | null;
  median: number | null;
  p90: number | null;
  waived: number;
  undated: number;
  oldest: Item | null;
  slowest: Array<Item & { took: number }>;
  total: number;
  skipped: number;
}

export type LogResult = { ok: true; log: ConstraintLog } | { ok: false; reason: "empty" | "invalid" };

function dayOrNull(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

export function typeLabel(type: string): string {
  return words(type);
}

function normalise(owner: string | null): string | null {
  const text = (owner ?? "").trim().replace(/\s+/g, " ");

  return text === "" ? null : text;
}

export function buildConstraintLog(data: ScheduleControl, today: number, windowDays: number | null, groupBy: GroupBy): LogResult {
  const constraints = data.constraints ?? [];

  if (constraints.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const activities = new Map((data.activities ?? []).map((item) => [item.id, item]));
  const since = windowDays === null ? -Infinity : today - windowDays;
  const items: Item[] = [];
  let skipped = 0;
  let undated = 0;

  for (const raw of constraints) {
    const created = toDay(raw.createdAt);

    if (!Number.isFinite(created)) {
      skipped += 1;
      continue;
    }

    const status = raw.status === "RESOLVED" || raw.status === "WAIVED" ? raw.status : "OPEN";
    const due = dayOrNull(raw.dueDate);
    const resolved = dayOrNull(raw.resolvedDate);
    const activity = activities.get(raw.activityId);

    if (status === "RESOLVED" && resolved === null) {
      undated += 1;
    }

    items.push({
      id: raw.id,
      activityId: raw.activityId,
      code: raw.activityCode,
      activity: activity ? activity.name : "",
      type: raw.constraintType,
      title: raw.title,
      owner: normalise(raw.ownerName),
      created: Math.min(created, today),
      due,
      status,
      resolved: resolved === null ? null : Math.max(resolved, created),
      critical: activity?.critical === true,
      nearCritical: activity?.nearCritical === true,
      age: Math.max(0, today - created),
      daysLate: status === "OPEN" ? (due !== null && due < today ? today - due : 0) : status === "RESOLVED" && due !== null && resolved !== null && resolved > due ? resolved - due : 0,
      took: status === "RESOLVED" && resolved !== null ? Math.max(0, resolved - created) : null,
    });
  }

  if (items.length === 0) {
    return { ok: false, reason: "invalid" };
  }

  const open = items.filter((item) => item.status === "OPEN");
  const clearedAll = items.filter((item) => item.status === "RESOLVED" && item.resolved !== null && item.resolved > since && item.resolved <= today);
  const withDue = clearedAll.filter((item) => item.due !== null);
  const onTime = withDue.filter((item) => (item.resolved as number) <= (item.due as number)).length;
  const took = clearedAll.map((item) => item.took as number);
  const bins: Bin[] = AGE_BINS.map((bin) => ({ label: bin.label, count: 0, overdue: 0 }));

  for (const item of open) {
    const slot = AGE_BINS.findIndex((bin) => item.age <= bin.max);
    const target = bins[slot < 0 ? bins.length - 1 : slot];

    if (target) {
      target.count += 1;
      target.overdue += item.daysLate > 0 ? 1 : 0;
    }
  }

  const keyOf = (item: Item) => (groupBy === "type" ? item.type : (item.owner ?? NO_OWNER).toLowerCase());
  const nameOf = (item: Item) => (groupBy === "type" ? typeLabel(item.type) : (item.owner ?? NO_OWNER));
  const names = new Map<string, string>();

  for (const item of items) {
    if (!names.has(keyOf(item))) {
      names.set(keyOf(item), nameOf(item));
    }
  }

  const groups: Group[] = [...names.entries()].map(([key, name]) => {
    const openHere = open.filter((item) => keyOf(item) === key);
    const clearedHere = clearedAll.filter((item) => keyOf(item) === key);
    const datedHere = clearedHere.filter((item) => item.due !== null);
    const onTimeHere = datedHere.filter((item) => (item.resolved as number) <= (item.due as number)).length;

    return {
      key,
      name,
      open: openHere.length,
      overdue: openHere.filter((item) => item.daysLate > 0).length,
      oldest: openHere.length === 0 ? null : Math.max(...openHere.map((item) => item.age)),
      cleared: clearedHere.length,
      dated: datedHere.length,
      onTime: onTimeHere,
      rate: datedHere.length === 0 ? null : onTimeHere / datedHere.length,
      median: median(clearedHere.map((item) => item.took as number)),
      onCritical: openHere.filter((item) => item.critical || item.nearCritical).length,
    } satisfies Group;
  });

  groups.sort((a, b) => b.overdue - a.overdue || b.open - a.open || b.cleared - a.cleared || a.name.localeCompare(b.name));

  const oldest = [...open].sort((a, b) => b.age - a.age)[0] ?? null;

  return {
    ok: true,
    log: {
      items,
      open: sortOpen(open),
      groups: groups.filter((group) => group.open > 0 || group.cleared > 0),
      bins,
      windowDays,
      openCount: open.length,
      overdueCount: open.filter((item) => item.daysLate > 0).length,
      onCritical: open.filter((item) => item.critical || item.nearCritical).length,
      cleared: clearedAll.length,
      dated: withDue.length,
      onTime,
      rate: withDue.length === 0 ? null : onTime / withDue.length,
      median: median(took),
      p90: percentile(took, 0.9),
      waived: items.filter((item) => item.status === "WAIVED").length,
      undated,
      oldest,
      slowest: clearedAll
        .map((item) => ({ ...item, took: item.took as number }))
        .sort((a, b) => b.took - a.took || a.code.localeCompare(b.code, undefined, { numeric: true }))
        .slice(0, LIST_LIMIT),
      total: items.length,
      skipped,
    },
  };
}

function sortOpen(open: Item[]): Item[] {
  return [...open].sort((a, b) => b.daysLate - a.daysLate || Number(b.critical) - Number(a.critical) || b.age - a.age || a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export function filterOpen(open: Item[], filter: OpenFilter): Item[] {
  if (filter === "late") {
    return open.filter((item) => item.daysLate > 0);
  }

  if (filter === "critical") {
    return open.filter((item) => item.critical || item.nearCritical);
  }

  return open;
}

export function constraintMarkdown(log: ConstraintLog, groupBy: GroupBy, projectName: string, today: number): string {
  const lines: string[] = [];
  const span = log.windowDays === null ? "every constraint cleared to date" : `constraints cleared in the last ${windowLabel(log.windowDays).toLowerCase()}`;

  lines.push(`# Constraint log: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Open figures are as they stand today; clearing figures cover ${span}.`, "");
  lines.push(
    `- Open: ${log.openCount} (${log.overdueCount} past due, ${log.onCritical} on critical or near-critical activities)`,
    `- Cleared: ${log.cleared}, typically in ${daysText(log.median)} (9 in 10 within ${daysText(log.p90)})`,
    `- Cleared by the due date: ${rateText(log.rate)}${log.dated > 0 ? ` of ${log.dated}` : ""}`,
    `- Waived: ${log.waived}`,
    `- Oldest open: ${log.oldest ? `${log.oldest.code} ${trunc(log.oldest.title, 50)}, ${log.oldest.age} days` : "none"}`,
    "",
  );

  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`| ${groupBy === "type" ? "Kind" : "Owner"} | Open | Past due | Oldest open | Cleared | Typical to clear | On time |`);
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const group of log.groups) {
    lines.push(`| ${cell(group.name)} | ${group.open} | ${group.overdue} | ${group.oldest === null ? "—" : `${group.oldest} d`} | ${group.cleared} | ${daysText(group.median)} | ${rateText(group.rate)} |`);
  }

  lines.push("");

  const late = filterOpen(log.open, "late").slice(0, LIST_LIMIT);

  if (late.length > 0) {
    lines.push("## Past due now", "");

    for (const item of late) {
      lines.push(`- ${cell(item.code)} ${cell(trunc(item.title, 60))} (${typeLabel(item.type)}, ${cell(item.owner ?? NO_OWNER)}): ${item.daysLate} ${plural(item.daysLate, "day", "days")} past due${item.critical ? ", critical activity" : item.nearCritical ? ", near-critical activity" : ""}`);
    }

    lines.push("");
  }

  lines.push("Age runs from the day the constraint was logged. Clearing time runs from logged to resolved. A constraint counts as cleared on time when it was resolved on or before its due date. Waived constraints are not counted as cleared.", "");

  if (log.undated > 0) {
    lines.push(`${log.undated} resolved ${plural(log.undated, "constraint has", "constraints have")} no resolved date and ${plural(log.undated, "was", "were")} left out of the clearing figures.`, "");
  }

  return lines.join("\n");
}
