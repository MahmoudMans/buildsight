import { MIN_SAMPLE, buildClosureSpeed } from "@/lib/closureSpeed";
import { MODULES, MODULE_LABEL, buildOpenItems, formatDay, plural, toDay, type ModuleKey, type Sources } from "@/lib/openItems";
import { buildProgress } from "@/lib/progressCurve";
import { buildReadiness } from "@/lib/startReadiness";
import type { ScheduleControl } from "@/types/project";

export const CLOSURE_WINDOW_DAYS = 180;
export const READY_HORIZON_DAYS = 28;
export const HISTORY_LIMIT = 90;
export const SPARK_MIN_POINTS = 2;

export type MetricKey =
  | "overdueItems"
  | "criticalItems"
  | "onTimeRate"
  | "daysToClose"
  | "progressGap"
  | "overdueConstraints"
  | "lateStarts"
  | "finishVariance"
  | "scheduleScore";

export type Unit = "count" | "percent" | "days" | "points" | "score";
export type Goal = "atMost" | "atLeast";
export type Status = "met" | "near" | "missed" | "none";
export type Origin = "items" | "schedule";

export interface MetricDef {
  key: MetricKey;
  label: string;
  about: string;
  unit: Unit;
  goal: Goal;
  defaultTarget: number;
  min: number;
  max: number;
  step: number;
  slack: number;
  origin: Origin;
}

export const METRICS: ReadonlyArray<MetricDef> = [
  { key: "overdueItems", label: "Overdue open items", about: "Open items from every module that are past their due date.", unit: "count", goal: "atMost", defaultTarget: 5, min: 0, max: 999, step: 1, slack: 2, origin: "items" },
  { key: "criticalItems", label: "Critical open items", about: "Open items rated critical, whether or not they are overdue.", unit: "count", goal: "atMost", defaultTarget: 0, min: 0, max: 999, step: 1, slack: 1, origin: "items" },
  { key: "onTimeRate", label: "Closed on time", about: `Share of items with a due date that were closed on or before it, over the last ${CLOSURE_WINDOW_DAYS} days.`, unit: "percent", goal: "atLeast", defaultTarget: 85, min: 0, max: 100, step: 5, slack: 5, origin: "items" },
  { key: "daysToClose", label: "Typical days to close", about: `Median days from an item being raised to being closed, over the last ${CLOSURE_WINDOW_DAYS} days.`, unit: "days", goal: "atMost", defaultTarget: 14, min: 1, max: 365, step: 1, slack: 2, origin: "items" },
  { key: "progressGap", label: "Points behind plan", about: "How far actual progress sits below the planned curve, weighted by activity duration. Zero when on or ahead of plan.", unit: "points", goal: "atMost", defaultTarget: 2, min: 0, max: 100, step: 0.5, slack: 1, origin: "schedule" },
  { key: "overdueConstraints", label: "Overdue constraints", about: "Open schedule constraints past their due date.", unit: "count", goal: "atMost", defaultTarget: 3, min: 0, max: 999, step: 1, slack: 1, origin: "schedule" },
  { key: "lateStarts", label: "Late starts not ready", about: `Activities already past their planned start that still have an unfinished predecessor, an open constraint or a hold (look-ahead of ${READY_HORIZON_DAYS} days).`, unit: "count", goal: "atMost", defaultTarget: 2, min: 0, max: 999, step: 1, slack: 1, origin: "schedule" },
  { key: "finishVariance", label: "Finish against baseline", about: "Days the forecast finish sits after the approved baseline finish. Negative means earlier.", unit: "days", goal: "atMost", defaultTarget: 7, min: -365, max: 1000, step: 1, slack: 3, origin: "schedule" },
  { key: "scheduleScore", label: "Schedule score", about: "The score reported by the schedule module, where higher is better.", unit: "score", goal: "atLeast", defaultTarget: 70, min: 0, max: 100, step: 5, slack: 5, origin: "schedule" },
];

export const METRIC_KEYS: MetricKey[] = METRICS.map((metric) => metric.key);

export const DEFS = Object.fromEntries(METRICS.map((metric) => [metric.key, metric])) as Record<MetricKey, MetricDef>;

export const STATUS_LABEL: Record<Status, string> = {
  met: "Met",
  near: "Close",
  missed: "Missed",
  none: "No data",
};

export interface Inputs {
  sources: Sources | null;
  failed: ModuleKey[];
  schedule: ScheduleControl | null;
}

export interface Reading {
  key: MetricKey;
  value: number | null;
  why: string | null;
  partial: string | null;
}

function round(value: number, places = 1): number {
  const factor = 10 ** places;

  return Math.round(value * factor) / factor;
}

function leftOut(failed: ModuleKey[]): string | null {
  return failed.length === 0 ? null : `Leaves out ${failed.map((key) => MODULE_LABEL[key] ?? key).join(", ")}, which could not be read.`;
}

export function readMetrics(inputs: Inputs, today: number): Reading[] {
  const { sources, failed, schedule } = inputs;
  const readings: Reading[] = [];
  const noSources = "The project data behind this measure could not be loaded.";
  const noSchedule = "The schedule could not be loaded.";
  const put = (key: MetricKey, value: number | null, why: string | null, partial: string | null = null) => {
    readings.push({ key, value: value === null || !Number.isFinite(value) ? null : value, why: value === null || !Number.isFinite(value) ? (why ?? "Not enough data.") : null, partial: value === null ? null : partial });
  };

  if (sources === null || failed.length >= MODULES.length) {
    put("overdueItems", null, noSources);
    put("criticalItems", null, noSources);
    put("onTimeRate", null, noSources);
    put("daysToClose", null, noSources);
  } else {
    const items = buildOpenItems(sources, today);
    const note = leftOut(failed);
    const closure = buildClosureSpeed(sources, failed, today, CLOSURE_WINDOW_DAYS);

    put("overdueItems", items.filter((item) => Number.isFinite(item.due) && item.due < today).length, null, note);
    put("criticalItems", items.filter((item) => item.severity === "critical").length, null, note);
    put(
      "onTimeRate",
      closure.dated >= MIN_SAMPLE && closure.onTimeRate !== null ? round(closure.onTimeRate * 100) : null,
      `Only ${closure.dated} ${plural(closure.dated, "closed item has", "closed items have")} a due date in the last ${CLOSURE_WINDOW_DAYS} days; at least ${MIN_SAMPLE} are needed.`,
      note,
    );
    put(
      "daysToClose",
      closure.closed >= MIN_SAMPLE && closure.median !== null ? round(closure.median) : null,
      `Only ${closure.closed} ${plural(closure.closed, "item was", "items were")} closed in the last ${CLOSURE_WINDOW_DAYS} days; at least ${MIN_SAMPLE} are needed.`,
      note,
    );
  }

  if (schedule === null) {
    for (const key of ["progressGap", "overdueConstraints", "lateStarts", "finishVariance", "scheduleScore"] as const) {
      put(key, null, noSchedule);
    }

    return order(readings);
  }

  const progress = buildProgress(schedule, today);

  put("progressGap", progress.ok ? Math.max(0, round(-progress.progress.gap * 100)) : null, "The schedule has no activities with usable dates.");

  const constraints = schedule.constraints ?? [];

  put(
    "overdueConstraints",
    constraints.filter((item) => item.status === "OPEN" && Number.isFinite(toDay(item.dueDate)) && toDay(item.dueDate) < today).length,
    null,
  );

  const ready = buildReadiness(schedule, today, READY_HORIZON_DAYS);

  put("lateStarts", ready.ok ? ready.readiness.counts.lateNotReady : null, "The schedule has no activities with usable dates.");

  const baseline = toDay(schedule.intelligence?.baselineFinishDate);
  const forecast = toDay(schedule.intelligence?.cpmForecastFinishDate);

  put("finishVariance", Number.isFinite(baseline) && Number.isFinite(forecast) ? forecast - baseline : null, "The schedule has no approved baseline finish or no forecast finish yet.");
  put("scheduleScore", typeof schedule.intelligence?.scheduleScore === "number" ? round(schedule.intelligence.scheduleScore) : null, "The schedule module has not produced a score.");

  return order(readings);
}

function order(readings: Reading[]): Reading[] {
  return METRIC_KEYS.map((key) => readings.find((reading) => reading.key === key)).filter((reading): reading is Reading => reading !== undefined);
}

export function slackOf(def: MetricDef, target: number): number {
  return Math.max(def.slack, Math.abs(target) * 0.25);
}

export function statusOf(def: MetricDef, value: number | null, target: number): Status {
  if (value === null || !Number.isFinite(value)) {
    return "none";
  }

  const slack = slackOf(def, target);

  if (def.goal === "atMost") {
    return value <= target ? "met" : value <= target + slack ? "near" : "missed";
  }

  return value >= target ? "met" : value >= target - slack ? "near" : "missed";
}

export function valueText(def: MetricDef, value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  const shown = Math.abs(value) < 10 && value % 1 !== 0 ? value.toFixed(1) : String(Math.round(value * 10) / 10);

  switch (def.unit) {
    case "percent":
      return `${shown}%`;
    case "days":
      return def.key === "finishVariance" && value > 0 ? `+${shown} d` : `${shown} d`;
    case "points":
      return `${shown} pts`;
    default:
      return shown;
  }
}

function changeText(def: MetricDef, amount: number): string {
  const shown = amount < 10 && amount % 1 !== 0 ? amount.toFixed(1) : String(Math.round(amount * 10) / 10);

  return def.unit === "percent" || def.unit === "points" ? `${shown} pts` : def.unit === "days" ? `${shown} d` : shown;
}

export function goalText(def: MetricDef): string {
  return def.goal === "atMost" ? "at most" : "at least";
}

export function unitText(def: MetricDef): string {
  switch (def.unit) {
    case "percent":
      return "%";
    case "days":
      return "days";
    case "points":
      return "pts";
    default:
      return "";
  }
}

export function clampTarget(def: MetricDef, value: number): number {
  return Math.min(def.max, Math.max(def.min, value));
}

export function parseDraft(def: MetricDef, text: string): number | null {
  const trimmed = text.trim().replace(",", ".");

  if (trimmed === "" || !/^-?\d*\.?\d+$|^-?\d+\.$/.test(trimmed)) {
    return null;
  }

  const value = Number(trimmed);

  return Number.isFinite(value) && value >= def.min && value <= def.max ? value : null;
}

export function rangeHint(def: MetricDef): string {
  return `Enter a number from ${def.min} to ${def.max}.`;
}

export interface Setting {
  target: number;
  tracked: boolean;
}

export type Settings = Record<MetricKey, Setting>;

export function defaultSettings(): Settings {
  return Object.fromEntries(METRICS.map((def) => [def.key, { target: def.defaultTarget, tracked: true }])) as Settings;
}

export function parseSettings(text: string | null): Settings {
  const base = defaultSettings();

  if (!text) {
    return base;
  }

  try {
    const raw = JSON.parse(text) as unknown;

    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return base;
    }

    for (const def of METRICS) {
      const entry = (raw as Record<string, unknown>)[def.key];

      if (typeof entry !== "object" || entry === null) {
        continue;
      }

      const target = (entry as Record<string, unknown>).target;
      const tracked = (entry as Record<string, unknown>).tracked;

      base[def.key] = {
        target: typeof target === "number" && Number.isFinite(target) ? clampTarget(def, target) : def.defaultTarget,
        tracked: typeof tracked === "boolean" ? tracked : true,
      };
    }
  } catch {
    return defaultSettings();
  }

  return base;
}

export function serialiseSettings(settings: Settings): string {
  return JSON.stringify(settings);
}

export function sameSettings(a: Settings, b: Settings): boolean {
  return METRIC_KEYS.every((key) => a[key].target === b[key].target && a[key].tracked === b[key].tracked);
}

export interface Snapshot {
  day: number;
  values: Partial<Record<MetricKey, number>>;
}

export function parseHistory(text: string | null): Snapshot[] {
  if (!text) {
    return [];
  }

  try {
    const raw = JSON.parse(text) as unknown;

    if (!Array.isArray(raw)) {
      return [];
    }

    const byDay = new Map<number, Snapshot>();

    for (const entry of raw) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }

      const day = (entry as Record<string, unknown>).day;
      const values = (entry as Record<string, unknown>).values;

      if (typeof day !== "number" || !Number.isFinite(day) || typeof values !== "object" || values === null) {
        continue;
      }

      const clean: Partial<Record<MetricKey, number>> = {};

      for (const key of METRIC_KEYS) {
        const value = (values as Record<string, unknown>)[key];

        if (typeof value === "number" && Number.isFinite(value)) {
          clean[key] = value;
        }
      }

      byDay.set(day, { day, values: clean });
    }

    return [...byDay.values()].sort((a, b) => a.day - b.day).slice(-HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function serialiseHistory(history: Snapshot[]): string {
  return JSON.stringify(history);
}

export function valuesOf(readings: Reading[]): Partial<Record<MetricKey, number>> {
  const values: Partial<Record<MetricKey, number>> = {};

  for (const reading of readings) {
    if (reading.value !== null && reading.partial === null) {
      values[reading.key] = reading.value;
    }
  }

  return values;
}

export function recordSnapshot(history: Snapshot[], day: number, values: Partial<Record<MetricKey, number>>): Snapshot[] {
  if (Object.keys(values).length === 0) {
    return history;
  }

  const earlier = history.find((entry) => entry.day === day);
  const merged: Snapshot = { day, values: { ...(earlier?.values ?? {}), ...values } };

  return [...history.filter((entry) => entry.day !== day), merged].sort((a, b) => a.day - b.day).slice(-HISTORY_LIMIT);
}

export interface SeriesPoint {
  day: number;
  value: number;
}

export function seriesOf(history: Snapshot[], key: MetricKey): SeriesPoint[] {
  const points: SeriesPoint[] = [];

  for (const entry of history) {
    const value = entry.values[key];

    if (value !== undefined) {
      points.push({ day: entry.day, value });
    }
  }

  return points;
}

export interface Trend {
  from: number;
  delta: number;
  tone: "better" | "worse" | "same";
  text: string;
}

export function trendOf(def: MetricDef, series: SeriesPoint[]): Trend | null {
  const first = series[0];
  const last = series[series.length - 1];

  if (series.length < SPARK_MIN_POINTS || !first || !last) {
    return null;
  }

  const delta = round(last.value - first.value);
  const tone = delta === 0 ? "same" : (def.goal === "atMost" ? delta < 0 : delta > 0) ? "better" : "worse";
  const size = changeText(def, Math.abs(delta));

  return {
    from: first.day,
    delta,
    tone,
    text: delta === 0 ? `Unchanged since ${formatDay(first.day)}` : `${delta > 0 ? "Up" : "Down"} ${size} since ${formatDay(first.day)}`,
  };
}

export function storageKey(projectId: string): string {
  return `buildsight.targets.${projectId}`;
}

export function historyKey(projectId: string): string {
  return `buildsight.targets.history.${projectId}`;
}

export function readStore(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStore(key: string, value: string | null): boolean {
  try {
    if (typeof window === "undefined") {
      return false;
    }

    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }

    return true;
  } catch {
    return false;
  }
}

export interface Row {
  def: MetricDef;
  reading: Reading;
  setting: Setting;
  status: Status;
}

export function rowsOf(readings: Reading[], settings: Settings): Row[] {
  return readings.map((reading) => {
    const def = DEFS[reading.key];
    const setting = settings[reading.key];

    return { def, reading, setting, status: statusOf(def, reading.value, setting.target) };
  });
}

export function tally(rows: Row[]): Record<Status, number> {
  const counts: Record<Status, number> = { met: 0, near: 0, missed: 0, none: 0 };

  for (const row of rows) {
    if (row.setting.tracked) {
      counts[row.status] += 1;
    }
  }

  return counts;
}

export function targetsMarkdown(rows: Row[], history: Snapshot[], projectName: string, today: number): string {
  const lines: string[] = [];
  const tracked = rows.filter((row) => row.setting.tracked);
  const counts = tally(rows);

  lines.push(`# Targets: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. ${counts.met} met, ${counts.near} close, ${counts.missed} missed, ${counts.none} without data, out of ${tracked.length} tracked.`, "");
  lines.push("| Measure | Now | Target | Status | Since first recorded |");
  lines.push("| --- | ---: | --- | --- | --- |");

  for (const row of tracked) {
    const trend = trendOf(row.def, seriesOf(history, row.def.key));

    lines.push(`| ${row.def.label} | ${valueText(row.def, row.reading.value)}${row.reading.partial ? " *" : ""} | ${goalText(row.def)} ${valueText(row.def, row.setting.target)} | ${STATUS_LABEL[row.status]} | ${trend ? trend.text : "—"} |`);
  }

  lines.push("");

  if (tracked.some((row) => row.reading.partial)) {
    lines.push("* Some project data could not be read, so this figure may be understated.", "");
  }

  lines.push(
    "“Close” means within a quarter of the target (or a minimum margin for small targets) on the wrong side of it. Targets are set in this browser and are not shared with the team. Earlier values are only those recorded on days the page was opened.",
    "",
  );

  return lines.join("\n");
}

export function historySpan(history: Snapshot[]): { days: number; from: number | null; to: number | null } {
  const first = history[0];
  const last = history[history.length - 1];

  return { days: history.length, from: first ? first.day : null, to: last ? last.day : null };
}
