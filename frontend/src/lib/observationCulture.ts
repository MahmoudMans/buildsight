import { DAY_MS, formatDay, plural, toDay } from "@/lib/openItems";
import type { HazardCategory, SafetyControl, SafetyObservation } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 180;
export const CONCENTRATED = 0.5;
export const MIN_FOR_SHARE = 10;
export const RECURRING_MONTHS = 3;
export const RISING_BY = 2;
export const QUIET_SHARE = 0.25;
export const PAGE = 8;

export type HazardFlag = "recurring" | "rising";

export const HAZARD_LABEL: Record<HazardCategory, string> = {
  PPE: "PPE",
  HOUSEKEEPING: "Housekeeping",
  WORK_AT_HEIGHT: "Work at height",
  ELECTRICAL: "Electrical",
  LIFTING: "Lifting",
  EXCAVATION: "Excavation",
  ACCESS_EGRESS: "Access and egress",
  TOOLS_EQUIPMENT: "Tools and equipment",
  FIRE: "Fire",
  ENVIRONMENTAL: "Environmental",
  TRAFFIC: "Traffic",
  OTHER: "Other",
};

export const FLAG_LABEL: Record<HazardFlag, string> = {
  recurring: "Recurring",
  rising: "Rising",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface Month {
  key: string;
  label: string;
  start: number;
  partial: boolean;
  total: number;
  positive: number;
  unsafe: number;
  share: number | null;
}

export interface Observer {
  key: string;
  name: string;
  named: boolean;
  count: number;
  positive: number;
  unsafe: number;
  share: number;
  last: number;
}

export interface Hazard {
  key: HazardCategory;
  label: string;
  now: number;
  before: number;
  months: number;
  flags: HazardFlag[];
}

export interface Culture {
  from: number;
  to: number;
  months: Month[];
  observers: Observer[];
  hazards: Hazard[];
  total: number;
  positive: number;
  unsafe: number;
  positiveShare: number | null;
  last30: number;
  prev30: number;
  observerCount: number;
  unnamed: number;
  top: Observer | null;
  topShare: number | null;
  concentrated: boolean;
  weeksMeasured: number;
  quietWeeks: number;
  longestGap: number | null;
  voided: number;
  skipped: number;
  future: number;
}

export type CultureResult = { ok: true; data: Culture } | { ok: false; reason: "noObservations" };

export function weekStart(day: number): number {
  return day - ((day + 3) % 7);
}

function isPositive(item: SafetyObservation): boolean {
  return item.observationType === "SAFE_ACT" || item.observationType === "GOOD_PRACTICE";
}

function monthStart(year: number, month: number): number {
  return Math.floor(Date.UTC(year, month, 1) / DAY_MS);
}

function monthKey(day: number): string {
  const date = new Date(day * DAY_MS);

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function buildCulture(data: SafetyControl, today: number, windowDays: number): CultureResult {
  const all = data.observations ?? [];
  const live = all.filter((item) => item.status !== "VOID");
  const voided = all.length - live.length;

  if (live.length === 0) {
    return { ok: false, reason: "noObservations" };
  }

  const from = today - windowDays + 1;
  const beforeFrom = from - windowDays;
  const inside: Array<{ item: SafetyObservation; day: number }> = [];
  const earlier: Array<{ item: SafetyObservation; day: number }> = [];
  let skipped = 0;
  let future = 0;

  for (const item of live) {
    const day = toDay(item.observedDate);

    if (!Number.isFinite(day)) {
      skipped += 1;
    } else if (day > today) {
      future += 1;
    } else if (day >= from) {
      inside.push({ item, day });
    } else if (day >= beforeFrom) {
      earlier.push({ item, day });
    }
  }

  const months: Month[] = [];
  const first = new Date(from * DAY_MS);
  const last = new Date(today * DAY_MS);
  let year = first.getUTCFullYear();
  let month = first.getUTCMonth();

  while (year < last.getUTCFullYear() || (year === last.getUTCFullYear() && month <= last.getUTCMonth())) {
    const start = monthStart(year, month);
    const next = month === 11 ? monthStart(year + 1, 0) : monthStart(year, month + 1);
    const rows = inside.filter((row) => row.day >= start && row.day < next);
    const positive = rows.filter((row) => isPositive(row.item)).length;

    months.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: `${MONTHS[month] ?? ""} ${String(year).slice(2)}`,
      start,
      partial: start < from || next - 1 > today,
      total: rows.length,
      positive,
      unsafe: rows.length - positive,
      share: rows.length > 0 ? positive / rows.length : null,
    });

    month += 1;

    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const byObserver = new Map<string, { names: Map<string, number>; count: number; positive: number; last: number }>();

  for (const row of inside) {
    const name = (row.item.observerName ?? "").trim();
    const key = name.toLowerCase();
    const entry = byObserver.get(key) ?? { names: new Map<string, number>(), count: 0, positive: 0, last: -Infinity };

    if (name) {
      entry.names.set(name, (entry.names.get(name) ?? 0) + 1);
    }

    entry.count += 1;
    entry.positive += isPositive(row.item) ? 1 : 0;
    entry.last = Math.max(entry.last, row.day);
    byObserver.set(key, entry);
  }

  const total = inside.length;
  const observers: Observer[] = [...byObserver.entries()]
    .map(([key, entry]) => {
      const names = [...entry.names.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

      return {
        key: key || "none",
        name: names[0] ? names[0][0] : "No observer recorded",
        named: key !== "",
        count: entry.count,
        positive: entry.positive,
        unsafe: entry.count - entry.positive,
        share: total > 0 ? entry.count / total : 0,
        last: entry.last,
      };
    })
    .sort((a, b) => Number(b.named) - Number(a.named) || b.count - a.count || a.name.localeCompare(b.name));

  const named = observers.filter((observer) => observer.named);
  const top = named[0] ?? null;
  const unnamed = observers.find((observer) => !observer.named)?.count ?? 0;

  const nowByHazard = new Map<HazardCategory, { count: number; months: Set<string> }>();
  const beforeByHazard = new Map<HazardCategory, number>();

  for (const row of inside) {
    if (isPositive(row.item)) {
      continue;
    }

    const entry = nowByHazard.get(row.item.hazardCategory) ?? { count: 0, months: new Set<string>() };

    entry.count += 1;
    entry.months.add(monthKey(row.day));
    nowByHazard.set(row.item.hazardCategory, entry);
  }

  for (const row of earlier) {
    if (!isPositive(row.item)) {
      beforeByHazard.set(row.item.hazardCategory, (beforeByHazard.get(row.item.hazardCategory) ?? 0) + 1);
    }
  }

  const hazards: Hazard[] = [...nowByHazard.entries()]
    .map(([key, entry]) => {
      const before = beforeByHazard.get(key) ?? 0;
      const flags: HazardFlag[] = [];

      if (entry.months.size >= RECURRING_MONTHS) {
        flags.push("recurring");
      }

      if (entry.count - before >= RISING_BY) {
        flags.push("rising");
      }

      return { key, label: HAZARD_LABEL[key] ?? key, now: entry.count, before, months: entry.months.size, flags };
    })
    .sort((a, b) => b.now - a.now || b.months - a.months || a.label.localeCompare(b.label));

  const days = [...new Set(inside.map((row) => row.day))].sort((a, b) => a - b);
  let longestGap: number | null = null;

  if (days.length > 0) {
    longestGap = (days[0] as number) - from;

    for (let i = 1; i < days.length; i += 1) {
      longestGap = Math.max(longestGap, (days[i] as number) - (days[i - 1] as number) - 1);
    }

    longestGap = Math.max(longestGap, today - (days[days.length - 1] as number));
  }

  const weekSet = new Set(inside.map((row) => weekStart(row.day)));
  let weeksMeasured = 0;
  let quietWeeks = 0;

  for (let start = weekStart(from) < from ? weekStart(from) + 7 : weekStart(from); start + 6 <= today; start += 7) {
    weeksMeasured += 1;

    if (!weekSet.has(start)) {
      quietWeeks += 1;
    }
  }

  const positive = inside.filter((row) => isPositive(row.item)).length;
  const topShare = top && total > 0 ? top.share : null;

  return {
    ok: true,
    data: {
      from,
      to: today,
      months,
      observers,
      hazards,
      total,
      positive,
      unsafe: total - positive,
      positiveShare: total > 0 ? positive / total : null,
      last30: inside.filter((row) => row.day >= today - 29).length,
      prev30: inside.filter((row) => row.day >= today - 59 && row.day <= today - 30).length,
      observerCount: named.length,
      unnamed,
      top,
      topShare,
      concentrated: top !== null && total >= MIN_FOR_SHARE && (topShare ?? 0) >= CONCENTRATED,
      weeksMeasured,
      quietWeeks,
      longestGap,
      voided,
      skipped,
      future,
    },
  };
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function gapText(value: number | null): string {
  return value === null ? "—" : `${value} ${plural(value, "day", "days")}`;
}

export function cultureMarkdown(data: Culture, projectName: string, windowLabel: string): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Observation culture: ${projectName}`, "");
  lines.push(`Last ${windowLabel}, from ${formatDay(data.from)} to ${formatDay(data.to)}: ${data.total} safety ${plural(data.total, "observation", "observations")}, ${data.positive} positive and ${data.unsafe} unsafe (${pct(data.positiveShare)} positive).`, "");
  lines.push(`- ${data.last30} in the last 30 days, ${data.prev30} in the 30 days before`);
  lines.push(`- ${data.observerCount} named ${plural(data.observerCount, "observer", "observers")}${data.unnamed > 0 ? `, ${data.unnamed} ${plural(data.unnamed, "observation has", "observations have")} no observer recorded` : ""}`);

  if (data.top && data.topShare !== null) {
    lines.push(`- Most active observer: ${cell(data.top.name)}, ${data.top.count} of ${data.total} (${pct(data.topShare)})`);
  }

  lines.push(`- ${data.quietWeeks} of ${data.weeksMeasured} complete ${plural(data.weeksMeasured, "week", "weeks")} had no observation; the longest stretch without one was ${gapText(data.longestGap)}`, "");

  if (data.observers.length > 0) {
    lines.push("| Observer | Observations | Share | Positive | Last observation |", "| --- | ---: | ---: | ---: | --- |");

    for (const observer of data.observers.slice(0, 15)) {
      lines.push(`| ${cell(observer.name)} | ${observer.count} | ${pct(observer.share)} | ${pct(observer.count > 0 ? observer.positive / observer.count : null)} | ${formatDay(observer.last)} |`);
    }

    lines.push("");
  }

  if (data.hazards.length > 0) {
    lines.push("| Hazard category | Unsafe observations | Before | Months seen | Note |", "| --- | ---: | ---: | ---: | --- |");

    for (const hazard of data.hazards) {
      lines.push(`| ${hazard.label} | ${hazard.now} | ${hazard.before} | ${hazard.months} | ${hazard.flags.map((flag) => FLAG_LABEL[flag]).join(", ") || "—"} |`);
    }

    lines.push("");
  }

  lines.push(
    `Positive observations are safe acts and good practice, unsafe observations are unsafe acts and unsafe conditions, and voided records are left out. Before means the same length of time immediately before this period. A hazard category is recurring when it was seen in at least ${RECURRING_MONTHS} calendar months of the period, and rising when it has at least ${RISING_BY} more observations than before.`,
    "",
  );

  return lines.join("\n");
}
