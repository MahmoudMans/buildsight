import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { ProductionControl, WorkPackage } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 14, label: "2 weeks" },
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
];

export const DEFAULT_WINDOW = 28;
export const STALE_DAYS = 7;
export const SPARK_WEEKS = 8;
export const PAGE = 10;
export const FAR_OUT_DAYS = 730;

const WEEK = 7;
const SLIPPING_RATIO = 0.75;
const TREND_CHANGE = 0.15;

export type State = "stalled" | "behind" | "slipping" | "onTrack" | "quantityDone";
export type Filter = "all" | "attention" | "onTrack";

export const STATE_LABEL: Record<State, string> = {
  stalled: "No output",
  behind: "Well behind",
  slipping: "Slipping",
  onTrack: "On pace",
  quantityDone: "Quantity complete",
};

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "Everything" },
  { key: "attention", label: "Needs attention" },
  { key: "onTrack", label: "On pace" },
];

const STATE_RANK: Record<State, number> = { stalled: 0, behind: 1, slipping: 2, onTrack: 3, quantityDone: 4 };

export interface Pack {
  id: string;
  code: string;
  name: string;
  unit: string;
  status: WorkPackage["status"];
  blockReason: string | null;
  planned: number;
  actual: number;
  remaining: number;
  percent: number;
  expected: number;
  end: number;
  daysLeft: number;
  overdue: boolean;
  days: number;
  output: number;
  pace: number;
  trend: "up" | "down" | "flat" | null;
  required: number | null;
  ratio: number | null;
  forecast: number | null;
  farOut: boolean;
  lateDays: number | null;
  state: State;
  weeks: number[];
  weeklyRequired: number | null;
  lastOutput: number | null;
}

export interface Waiting {
  id: string;
  code: string;
  name: string;
  unit: string;
  planned: number;
  start: number | null;
  late: boolean;
}

export interface RunRate {
  packs: Pack[];
  waiting: Waiting[];
  completed: number;
  counts: Record<State, number>;
  late: number;
  overdue: number;
  windowDays: number;
  asOf: number;
  latestReport: number | null;
  staleDays: number;
  draftEntries: number;
  skipped: number;
}

export type RunRateResult = { ok: true; rate: RunRate } | { ok: false; reason: "empty" };

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function dayOrNull(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

export function qty(value: number): string {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2;

  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: digits }).format(value);
}

export function paceText(value: number, unit: string): string {
  return `${qty(value)} ${unit}/day`;
}

export function buildRunRate(data: ProductionControl, today: number, windowDays: number): RunRateResult {
  const packages = (data.workPackages ?? []).filter((item) => item.status !== "CANCELLED");

  if (packages.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const reports = new Map((data.siteReports ?? []).map((report) => [report.id, report]));
  const accepted = (data.siteReports ?? []).filter((report) => report.status !== "DRAFT").map((report) => dayOrNull(report.reportDate)).filter((day): day is number => day !== null);
  const latestReport = accepted.length === 0 ? null : Math.max(...accepted);
  const asOf = latestReport === null ? today : Math.min(today, latestReport);
  const win = Math.max(1, Math.round(windowDays));
  const byPack = new Map<string, Array<{ day: number; quantity: number }>>();
  let draftEntries = 0;

  for (const entry of data.productionEntries ?? []) {
    const report = reports.get(entry.siteReportId);

    if (report && report.status === "DRAFT") {
      draftEntries += 1;
      continue;
    }

    const day = dayOrNull(entry.reportDate);

    if (day === null) {
      continue;
    }

    const list = byPack.get(entry.workPackageId) ?? [];

    list.push({ day, quantity: Math.max(0, num(entry.quantityCompleted)) });
    byPack.set(entry.workPackageId, list);
  }

  const packs: Pack[] = [];
  const waiting: Waiting[] = [];
  let completed = 0;
  let skipped = 0;

  for (const item of packages) {
    if (item.status === "COMPLETED") {
      completed += 1;
      continue;
    }

    const end = dayOrNull(item.plannedEndDate);
    const start = dayOrNull(item.plannedStartDate);
    const planned = num(item.plannedQuantity);

    if (item.status === "PLANNED") {
      waiting.push({ id: item.id, code: item.code, name: item.name, unit: item.unit, planned, start, late: start !== null && start < today });
      continue;
    }

    if (end === null || planned <= 0) {
      skipped += 1;
      continue;
    }

    const entries = byPack.get(item.id) ?? [];
    const actualStart = dayOrNull(item.actualStartDate);
    const firstEntry = entries.length === 0 ? null : Math.min(...entries.map((entry) => entry.day));
    const began = actualStart ?? firstEntry;
    const windowStart = asOf - win + 1;
    const since = began === null ? windowStart : Math.min(asOf, Math.max(windowStart, began));
    const days = Math.max(1, asOf - since + 1);
    const output = entries.filter((entry) => entry.day >= since && entry.day <= asOf).reduce((sum, entry) => sum + entry.quantity, 0);
    const pace = output / days;
    const earlier = entries.filter((entry) => entry.day >= asOf - 2 * win + 1 && entry.day <= asOf - win).reduce((sum, entry) => sum + entry.quantity, 0);
    const trend: Pack["trend"] = earlier === 0 ? (output > 0 && began !== null && began <= asOf - win ? "up" : null) : pace / (earlier / win) - 1 > TREND_CHANGE ? "up" : pace / (earlier / win) - 1 < -TREND_CHANGE ? "down" : "flat";
    const actual = Math.min(planned, Math.max(0, num(item.actualQuantity)));
    const remaining = Math.max(0, planned - actual);
    const daysLeft = end - today;
    const overdue = daysLeft < 0 && remaining > 0.5;
    const required = remaining > 0.5 ? remaining / Math.max(1, daysLeft) : null;
    const ratio = required === null || required <= 0 ? null : pace / required;
    const forecastDays = pace > 0 && remaining > 0.5 ? Math.ceil(remaining / pace) : null;
    const farOut = forecastDays !== null && forecastDays > FAR_OUT_DAYS;
    const forecast = forecastDays === null || farOut ? null : today + forecastDays;
    const state: State = remaining <= 0.5 ? "quantityDone" : pace <= 0 ? "stalled" : overdue ? "behind" : (ratio as number) >= 1 ? "onTrack" : (ratio as number) >= SLIPPING_RATIO ? "slipping" : "behind";
    const weeks = Array.from({ length: SPARK_WEEKS }, (_, index) => {
      const to = asOf - WEEK * (SPARK_WEEKS - 1 - index);
      const from = to - WEEK + 1;

      return entries.filter((entry) => entry.day >= from && entry.day <= to).reduce((sum, entry) => sum + entry.quantity, 0);
    });
    const last = entries.length === 0 ? null : Math.max(...entries.map((entry) => entry.day));

    packs.push({
      id: item.id,
      code: item.code,
      name: item.name,
      unit: item.unit,
      status: item.status,
      blockReason: (item.blockReason ?? "").trim() === "" ? null : (item.blockReason as string).trim(),
      planned,
      actual,
      remaining,
      percent: Math.min(100, Math.max(0, num(item.completionPercentage))),
      expected: Math.min(100, Math.max(0, num(item.expectedProgressPercentage))),
      end,
      daysLeft,
      overdue,
      days,
      output,
      pace,
      trend,
      required,
      ratio,
      forecast,
      farOut,
      lateDays: forecast === null ? null : forecast - end,
      state,
      weeks,
      weeklyRequired: required === null || overdue ? null : required * WEEK,
      lastOutput: last,
    });
  }

  packs.sort(
    (a, b) =>
      STATE_RANK[a.state] - STATE_RANK[b.state] ||
      (a.state === "stalled" ? a.daysLeft - b.daysLeft : (b.lateDays ?? Infinity) - (a.lateDays ?? Infinity)) ||
      a.code.localeCompare(b.code, undefined, { numeric: true }),
  );

  waiting.sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity) || a.code.localeCompare(b.code, undefined, { numeric: true }));

  const counts: Record<State, number> = { stalled: 0, behind: 0, slipping: 0, onTrack: 0, quantityDone: 0 };

  for (const pack of packs) {
    counts[pack.state] += 1;
  }

  return {
    ok: true,
    rate: {
      packs,
      waiting,
      completed,
      counts,
      late: packs.filter((pack) => pack.state === "slipping" || pack.state === "behind").length,
      overdue: packs.filter((pack) => pack.overdue).length,
      windowDays: win,
      asOf,
      latestReport,
      staleDays: Math.max(0, today - asOf),
      draftEntries,
      skipped,
    },
  };
}

export function filterPacks(packs: Pack[], filter: Filter): Pack[] {
  if (filter === "attention") {
    return packs.filter((pack) => pack.state === "stalled" || pack.state === "behind" || pack.state === "slipping");
  }

  return filter === "onTrack" ? packs.filter((pack) => pack.state === "onTrack" || pack.state === "quantityDone") : packs;
}

export function verdictText(pack: Pack): string {
  if (pack.state === "quantityDone") {
    return "The planned quantity has been delivered";
  }

  if (pack.state === "stalled") {
    return pack.lastOutput === null ? "No output has been logged" : `No output since ${formatDay(pack.lastOutput)}`;
  }

  if (pack.forecast === null) {
    return "At this pace the work would take more than two years";
  }

  const late = pack.lateDays as number;

  if (late > 0) {
    return `Would finish ${late} ${plural(late, "day", "days")} after the planned end`;
  }

  return late === 0 ? "Would finish on the planned end date" : `Would finish ${-late} ${plural(-late, "day", "days")} before the planned end`;
}

export function endText(pack: Pack): string {
  if (pack.state === "quantityDone") {
    return "Nothing left to build";
  }

  if (pack.overdue) {
    return `${-pack.daysLeft} ${plural(-pack.daysLeft, "day", "days")} past its planned end`;
  }

  return pack.daysLeft === 0 ? "Ends today" : `${pack.daysLeft} ${plural(pack.daysLeft, "day", "days")} left`;
}

export function trendText(trend: Pack["trend"]): string | null {
  return trend === "up" ? "Faster than the period before" : trend === "down" ? "Slower than the period before" : trend === "flat" ? "Steady against the period before" : null;
}

export function runMarkdown(rate: RunRate, packs: Pack[], projectName: string, today: number): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const total = rate.packs.length;

  lines.push(`# Run rate: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Pace is the quantity logged per calendar day over the ${rate.windowDays} days to ${formatDay(rate.asOf)}, set against the quantity still to build divided by the days left to each package's planned end.`, "");
  lines.push(`- ${total} ${plural(total, "package", "packages")} in progress: ${rate.counts.onTrack} on pace, ${rate.counts.slipping} slipping, ${rate.counts.behind} well behind, ${rate.counts.stalled} with no output`);
  lines.push(`- ${rate.overdue} ${plural(rate.overdue, "is", "are")} past ${plural(rate.overdue, "its", "their")} planned end with work left; ${rate.waiting.length} not started; ${rate.completed} completed`, "");

  if (packs.length > 0) {
    lines.push("| Package | Done | Left | Needs per day | Pace per day | Planned end | At this pace | Verdict |");
    lines.push("| --- | ---: | ---: | ---: | ---: | --- | --- | --- |");

    for (const pack of packs) {
      lines.push(
        `| ${cell(pack.code)} ${cell(trunc(pack.name, 40))} | ${Math.round(pack.percent)}% | ${qty(pack.remaining)} ${cell(pack.unit)} | ${pack.required === null ? "—" : pack.overdue ? "overdue" : qty(pack.required)} | ${qty(pack.pace)} | ${formatDay(pack.end)} | ${pack.forecast === null ? "—" : formatDay(pack.forecast)} | ${STATE_LABEL[pack.state]}${pack.blockReason ? `, blocked: ${cell(trunc(pack.blockReason, 50))}` : ""} |`,
      );
    }

    lines.push("");
  }

  lines.push(
    "Output counts what site reports other than drafts have logged against each package. A package is on pace when its recent pace covers what it needs each day, slipping when it covers at least three quarters of that, and well behind below that or once its planned end has passed. The forecast assumes the recent pace simply continues, with no allowance for weather, hold-ups or a change of crew.",
    "",
  );

  if (rate.staleDays > STALE_DAYS) {
    lines.push(`The latest site report is from ${formatDay(rate.asOf)}, so the pace is measured up to that date and may understate current output.`, "");
  }

  return lines.join("\n");
}
