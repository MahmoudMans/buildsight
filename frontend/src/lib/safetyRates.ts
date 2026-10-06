import { DAY_MS, formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { ProductionControl, ResourceControl, SafetyControl, SafetyIncident, SafetyIncidentType } from "@/types/project";

export const BASES: ReadonlyArray<{ value: number; label: string }> = [
  { value: 200_000, label: "per 200,000 hours" },
  { value: 1_000_000, label: "per 1,000,000 hours" },
];

export type WindowKey = "12m" | "ytd" | "all";

export const WINDOWS: ReadonlyArray<{ key: WindowKey; label: string }> = [
  { key: "12m", label: "Last 12 months" },
  { key: "ytd", label: "This year" },
  { key: "all", label: "Whole project" },
];

export const DEFAULT_WINDOW: WindowKey = "12m";
export const DEFAULT_BASE = 200_000;
export const LOW_EXPOSURE = 50_000;
export const PAGE = 10;
export const MAX_MONTHS = 24;

const ROLLING = 12;

export type Cls = "nearMiss" | "firstAid" | "medical" | "lostTime" | "other";

export const CLASSES: ReadonlyArray<Cls> = ["nearMiss", "firstAid", "medical", "lostTime", "other"];

export const CLASS_LABEL: Record<Cls, string> = {
  nearMiss: "Near misses",
  firstAid: "First aid cases",
  medical: "Medical treatment cases",
  lostTime: "Lost-time injuries",
  other: "Damage, environmental and other",
};

export const CLASS_NOTE: Record<Cls, string> = {
  nearMiss: "No one hurt. A leading indicator.",
  firstAid: "Treated on site, not recordable.",
  medical: "Counts as recordable.",
  lostTime: "Counts as recordable, and as lost time.",
  other: "No injury recorded.",
};

export const RECORDABLE: Record<Cls, boolean> = {
  nearMiss: false,
  firstAid: false,
  medical: true,
  lostTime: true,
  other: false,
};

export interface Hours {
  source: "deployments" | "siteReports" | "none";
  byMonth: Map<number, number>;
  total: number;
  first: number | null;
  last: number | null;
  skipped: number;
}

export interface ClassRow {
  cls: Cls;
  label: string;
  note: string;
  count: number;
  rate: number | null;
  recordable: boolean;
}

export interface MonthRow {
  month: number;
  short: string;
  label: string;
  hours: number;
  counts: Record<Cls, number>;
  recordables: number;
  rolling: number | null;
  rollingHours: number;
  rollingRecordables: number;
  low: boolean;
}

export interface Rates {
  base: number;
  windowKey: WindowKey;
  from: number;
  to: number;
  hours: number;
  source: Hours["source"];
  hoursFrom: number | null;
  hoursTo: number | null;
  counts: Record<Cls, number>;
  recordables: number;
  lostTime: number;
  lostDays: number;
  recordableRate: number | null;
  lostTimeRate: number | null;
  severityRate: number | null;
  nearMissRatio: number | null;
  low: boolean;
  oneMoves: number | null;
  lastRecordable: number | null;
  sinceRecordable: number | null;
  classRows: ClassRow[];
  counted: SafetyIncident[];
  months: MonthRow[];
  unexposed: number;
  skipped: number;
  skippedHours: number;
  incidents: number;
}

export type RatesResult = { ok: true; rates: Rates } | { ok: false; reason: "empty" };

export interface RateSources {
  safety: SafetyControl;
  resources: ResourceControl | null;
  production: ProductionControl | null;
}

export function classOf(type: SafetyIncidentType): Cls {
  if (type === "NEAR_MISS") {
    return "nearMiss";
  }

  if (type === "FIRST_AID") {
    return "firstAid";
  }

  if (type === "MEDICAL_TREATMENT") {
    return "medical";
  }

  if (type === "LOST_TIME_INJURY") {
    return "lostTime";
  }

  return "other";
}

export function monthOf(day: number): number {
  const date = new Date(day * DAY_MS);

  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

export function monthStart(month: number): number {
  return Math.floor(Date.UTC(Math.floor(month / 12), month % 12, 1) / DAY_MS);
}

export function monthShort(month: number): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(monthStart(month) * DAY_MS));
}

export function monthLong(month: number): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(monthStart(month) * DAY_MS));
}

function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function collectHours(resources: ResourceControl | null, production: ProductionControl | null): Hours {
  const byMonth = new Map<number, number>();
  let skipped = 0;
  let total = 0;
  let first: number | null = null;
  let last: number | null = null;

  function add(date: string, hours: number) {
    const day = toDay(date);

    if (!Number.isFinite(day)) {
      skipped += 1;
      return;
    }

    const month = monthOf(day);

    byMonth.set(month, (byMonth.get(month) ?? 0) + hours);
    total += hours;
    first = first === null || day < first ? day : first;
    last = last === null || day > last ? day : last;
  }

  for (const row of resources?.deployments ?? []) {
    const hours = finite(row.totalLaborHours);

    if (hours > 0) {
      add(row.workDate, hours);
    }
  }

  if (total > 0) {
    return { source: "deployments", byMonth, total, first, last, skipped };
  }

  byMonth.clear();
  skipped = 0;
  first = null;
  last = null;

  for (const report of production?.siteReports ?? []) {
    const hours = finite(report.totalLaborHours);

    if (report.status !== "DRAFT" && hours > 0) {
      add(report.reportDate, hours);
    }
  }

  return { source: total > 0 ? "siteReports" : "none", byMonth, total, first, last, skipped };
}

export function rateOf(count: number, hours: number, base: number): number | null {
  return hours > 0 ? (count * base) / hours : null;
}

export function rateText(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return value >= 10 ? value.toFixed(1) : value.toFixed(2);
}

export function hoursText(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function compactHours(value: number): string {
  if (value >= 100_000) {
    return `${Math.round(value / 1000)}k`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(Math.round(value));
}

export function buildRates(sources: RateSources, today: number, windowKey: WindowKey, base: number): RatesResult {
  const hours = collectHours(sources.resources, sources.production);
  const live: Array<{ item: SafetyIncident; day: number; cls: Cls }> = [];
  let skipped = 0;

  for (const item of sources.safety.incidents ?? []) {
    if (item.status === "VOID") {
      continue;
    }

    const day = toDay(item.occurredDate);

    if (!Number.isFinite(day)) {
      skipped += 1;
      continue;
    }

    if (day <= today) {
      live.push({ item, day, cls: classOf(item.incidentType) });
    }
  }

  if (live.length === 0 && hours.source === "none") {
    return { ok: false, reason: "empty" };
  }

  const current = monthOf(today);
  const earliest = Math.min(...[...hours.byMonth.keys(), ...live.map((entry) => monthOf(entry.day)), current]);
  const startMonth = windowKey === "12m" ? current - (ROLLING - 1) : windowKey === "ytd" ? Math.floor(current / 12) * 12 : earliest;
  const from = monthStart(startMonth);

  const zero = (): Record<Cls, number> => ({ nearMiss: 0, firstAid: 0, medical: 0, lostTime: 0, other: 0 });
  const monthCounts = new Map<number, Record<Cls, number>>();

  for (const entry of live) {
    const month = monthOf(entry.day);
    const counts = monthCounts.get(month) ?? zero();

    counts[entry.cls] += 1;
    monthCounts.set(month, counts);
  }

  const recordablesIn = (counts: Record<Cls, number> | undefined) => (counts ? counts.medical + counts.lostTime : 0);

  const rollingFor = (month: number) => {
    let h = 0;
    let r = 0;

    for (let m = month - (ROLLING - 1); m <= month; m += 1) {
      h += hours.byMonth.get(m) ?? 0;
      r += recordablesIn(monthCounts.get(m));
    }

    return { hours: h, recordables: r };
  };

  const chartStart = windowKey === "all" ? Math.max(startMonth, current - (MAX_MONTHS - 1)) : startMonth;
  const months: MonthRow[] = [];

  for (let month = chartStart; month <= current; month += 1) {
    const counts = monthCounts.get(month) ?? zero();
    const roll = rollingFor(month);

    months.push({
      month,
      short: monthShort(month),
      label: monthLong(month),
      hours: hours.byMonth.get(month) ?? 0,
      counts,
      recordables: recordablesIn(counts),
      rolling: rateOf(roll.recordables, roll.hours, base),
      rollingHours: roll.hours,
      rollingRecordables: roll.recordables,
      low: roll.hours < LOW_EXPOSURE,
    });
  }

  let windowHours = 0;

  for (let month = startMonth; month <= current; month += 1) {
    windowHours += hours.byMonth.get(month) ?? 0;
  }

  const inWindow = live.filter((entry) => entry.day >= from);
  const counts = zero();
  let lostDays = 0;

  for (const entry of inWindow) {
    counts[entry.cls] += 1;
    lostDays += Math.max(0, finite(entry.item.lostTimeDays));
  }

  const recordables = counts.medical + counts.lostTime;
  const counted = inWindow
    .filter((entry) => RECORDABLE[entry.cls])
    .sort((a, b) => b.day - a.day || a.item.reference.localeCompare(b.item.reference, undefined, { numeric: true }))
    .map((entry) => entry.item);

  const recordableDays = live.filter((entry) => RECORDABLE[entry.cls]).map((entry) => entry.day);
  const lastRecordable = recordableDays.length > 0 ? Math.max(...recordableDays) : null;

  const unexposed = inWindow.filter((entry) => !hours.byMonth.has(monthOf(entry.day))).length;

  return {
    ok: true,
    rates: {
      base,
      windowKey,
      from,
      to: today,
      hours: windowHours,
      source: hours.source,
      hoursFrom: hours.first,
      hoursTo: hours.last,
      counts,
      recordables,
      lostTime: counts.lostTime,
      lostDays,
      recordableRate: rateOf(recordables, windowHours, base),
      lostTimeRate: rateOf(counts.lostTime, windowHours, base),
      severityRate: rateOf(lostDays, windowHours, base),
      nearMissRatio: recordables > 0 ? counts.nearMiss / recordables : null,
      low: windowHours > 0 && windowHours < LOW_EXPOSURE,
      oneMoves: rateOf(1, windowHours, base),
      lastRecordable,
      sinceRecordable: lastRecordable === null ? null : today - lastRecordable,
      classRows: CLASSES.map((cls) => ({
        cls,
        label: CLASS_LABEL[cls],
        note: CLASS_NOTE[cls],
        count: counts[cls],
        rate: rateOf(counts[cls], windowHours, base),
        recordable: RECORDABLE[cls],
      })),
      counted,
      months,
      unexposed,
      skipped,
      skippedHours: hours.skipped,
      incidents: inWindow.length,
    },
  };
}

export function sinceText(rates: Rates): string {
  if (rates.sinceRecordable === null) {
    return "None recorded";
  }

  return rates.sinceRecordable === 0 ? "Today" : `${rates.sinceRecordable} ${plural(rates.sinceRecordable, "day", "days")}`;
}

export function sourceText(source: Hours["source"]): string {
  return source === "deployments" ? "labour deployments" : source === "siteReports" ? "site reports" : "no source";
}

export function windowText(rates: Rates): string {
  return rates.windowKey === "all" ? `the whole project, from ${formatDay(rates.from)}` : `${formatDay(rates.from)} to ${formatDay(rates.to)}`;
}

export function baseText(base: number): string {
  return new Intl.NumberFormat("en-GB").format(base);
}

export function ratesMarkdown(rates: Rates, projectName: string, today: number): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const per = `per ${baseText(rates.base)} hours`;

  lines.push(`# Safety rates: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Window: ${windowText(rates)}. Hours come from ${sourceText(rates.source)}.`, "");
  lines.push(`- Hours worked: ${hoursText(rates.hours)}`);
  lines.push(`- Recordable rate: ${rateText(rates.recordableRate)} ${per} (${rates.recordables} ${plural(rates.recordables, "incident", "incidents")})`);
  lines.push(`- Lost-time rate: ${rateText(rates.lostTimeRate)} ${per} (${rates.lostTime} ${plural(rates.lostTime, "injury", "injuries")})`);
  lines.push(`- Severity rate: ${rateText(rates.severityRate)} ${per} (${rates.lostDays} ${plural(rates.lostDays, "day", "days")} lost)`);
  lines.push(`- Days since the last recordable incident: ${rates.sinceRecordable === null ? "none recorded" : rates.sinceRecordable}`, "");

  lines.push("| Incident class | Count | Rate | Counted as recordable |");
  lines.push("| --- | ---: | ---: | --- |");

  for (const row of rates.classRows) {
    lines.push(`| ${row.label} | ${row.count} | ${rateText(row.rate)} | ${row.recordable ? "yes" : "no"} |`);
  }

  lines.push("", "| Month | Hours | Recordables | Rolling 12-month rate |", "| --- | ---: | ---: | ---: |");

  for (const month of rates.months) {
    lines.push(`| ${month.label} | ${hoursText(month.hours)} | ${month.recordables} | ${rateText(month.rolling)}${month.low && month.rolling !== null ? " (low exposure)" : ""} |`);
  }

  if (rates.counted.length > 0) {
    lines.push("", "Recordable incidents in the window:", "");

    for (const item of rates.counted) {
      lines.push(`- ${formatDay(toDay(item.occurredDate))} ${cell(item.reference)} ${cell(trunc(item.title, 60))} (${item.incidentType === "LOST_TIME_INJURY" ? `lost time, ${item.lostTimeDays} ${plural(item.lostTimeDays, "day", "days")}` : "medical treatment"})`);
    }
  }

  lines.push(
    "",
    `A rate is incidents multiplied by ${baseText(rates.base)} and divided by the hours worked. Recordable means medical treatment or lost-time injuries; first aid cases, near misses, damage and environmental incidents are not counted. The severity rate uses the days lost recorded on incidents. Voided incidents are left out. Hours are the labour hours logged on site, so hours worked by crews that are not logged are missing and would push every rate up.`,
    "",
  );

  return lines.join("\n");
}
