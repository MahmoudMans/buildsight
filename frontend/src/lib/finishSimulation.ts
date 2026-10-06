import { DAY_MS, formatDay, toDay } from "@/lib/openItems";
import type { ScheduleActivity, ScheduleControl, ScheduleDependencyType } from "@/types/project";

export type Spread = "tight" | "normal" | "wide";

export const SPREADS: ReadonlyArray<{ key: Spread; label: string; faster: number; slower: number }> = [
  { key: "tight", label: "Tight", faster: 0.05, slower: 0.15 },
  { key: "normal", label: "Normal", faster: 0.1, slower: 0.3 },
  { key: "wide", label: "Wide", faster: 0.15, slower: 0.6 },
];

export const RUNS = 2000;
export const WIDEN_FACTOR = 1.5;
export const SLOWER_CAP = 2;
export const MIN_CRITICALITY = 0.01;
export const DRIVER_LIMIT = 10;
export const BIN_TARGET = 40;
export const PERCENTILES: ReadonlyArray<number> = [10, 25, 50, 70, 80, 90, 95];

export interface SimOptions {
  spread: Spread;
  widen: boolean;
  seed: number;
  runs?: number;
}

export interface Driver {
  id: string;
  code: string;
  name: string;
  status: ScheduleActivity["status"];
  criticality: number;
  sensitivity: number;
  days: number;
  fastest: number;
  slowest: number;
  float: number;
  constraints: number;
  widened: boolean;
}

export interface Bin {
  from: number;
  to: number;
  count: number;
}

export type AnchorSource = "cpm" | "forecast" | "planned" | "network";
export type TargetSource = "baseline" | "planned" | "none";

export interface SimOk {
  ok: true;
  runs: number;
  live: number;
  links: number;
  widened: number;
  anchor: number;
  anchorSource: AnchorSource;
  target: number;
  targetSource: TargetSource;
  shifts: number[];
  bins: Bin[];
  drivers: Driver[];
}

export interface SimFail {
  ok: false;
  reason: "empty" | "complete" | "no-links" | "invalid" | "cycle";
  detail: string | null;
}

export type SimResult = SimOk | SimFail;

interface Link {
  from: number;
  type: ScheduleDependencyType;
  lag: number;
}

function generator(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function triangular(u: number, min: number, mode: number, max: number): number {
  if (max <= min) {
    return mode;
  }

  const split = (mode - min) / (max - min);

  return u < split ? min + Math.sqrt(u * (max - min) * (mode - min)) : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
}

function firstDay(...values: Array<string | null | undefined>): { day: number; index: number } {
  for (let index = 0; index < values.length; index += 1) {
    const day = toDay(values[index]);

    if (Number.isFinite(day)) {
      return { day, index };
    }
  }

  return { day: NaN, index: -1 };
}

export function simulate(data: ScheduleControl, options: SimOptions): SimResult {
  const activities = data.activities ?? [];
  const count = activities.length;

  if (count === 0) {
    return { ok: false, reason: "empty", detail: null };
  }

  if (data.intelligence?.networkValid === false) {
    return { ok: false, reason: "invalid", detail: data.intelligence.networkError ?? null };
  }

  const position = new Map<string, number>(activities.map((item, index) => [item.id, index]));
  const preds: Link[][] = Array.from({ length: count }, () => []);
  const succs: number[][] = Array.from({ length: count }, () => []);
  const indegree: number[] = new Array<number>(count).fill(0);
  const seen = new Set<string>();
  let links = 0;

  for (const dependency of data.dependencies ?? []) {
    const from = position.get(dependency.predecessorActivityId);
    const to = position.get(dependency.successorActivityId);

    if (from === undefined || to === undefined || from === to) {
      continue;
    }

    const key = `${from}:${to}:${dependency.dependencyType}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    preds[to]?.push({ from, type: dependency.dependencyType, lag: Number.isFinite(dependency.lagDays) ? dependency.lagDays : 0 });
    succs[from]?.push(to);
    indegree[to] = (indegree[to] ?? 0) + 1;
    links += 1;
  }

  if (links === 0) {
    return { ok: false, reason: "no-links", detail: null };
  }

  const order: number[] = [];
  const queue: number[] = [];

  indegree.forEach((value, index) => {
    if (value === 0) {
      queue.push(index);
    }
  });

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head] as number;

    order.push(current);

    for (const next of succs[current] ?? []) {
      indegree[next] = (indegree[next] ?? 0) - 1;

      if (indegree[next] === 0) {
        queue.push(next);
      }
    }
  }

  if (order.length < count) {
    return { ok: false, reason: "cycle", detail: `${count - order.length} activities affected` };
  }

  const dataDay = (() => {
    const day = toDay(data.intelligence?.dataDate);

    return Number.isFinite(day) ? day : Math.floor(Date.now() / DAY_MS);
  })();

  const done = activities.map((item) => item.status === "COMPLETED" || item.actualFinish !== null);
  const started = activities.map((item, index) => !done[index] && (item.status === "IN_PROGRESS" || item.actualStart !== null));
  const nominal = activities.map((item, index) => (done[index] ? 0 : Math.max(0, Number.isFinite(item.remainingDurationDays) ? item.remainingDurationDays : 0)));

  const earliest = activities.map((item, index) => {
    if (done[index] || started[index]) {
      return 0;
    }

    const planned = toDay(item.currentStart) - dataDay;

    return Number.isFinite(planned) ? Math.max(0, planned) : 0;
  });

  const live = done.filter((flag) => !flag).length;

  if (live === 0) {
    return { ok: false, reason: "complete", detail: null };
  }

  const constrained = new Set<string>();

  for (const constraint of data.constraints ?? []) {
    if (constraint.status === "OPEN") {
      constrained.add(constraint.activityId);
    }
  }

  const spread = SPREADS.find((item) => item.key === options.spread) ?? (SPREADS[1] as (typeof SPREADS)[number]);
  const fastest: number[] = [];
  const slowest: number[] = [];
  const widenedFlags: boolean[] = [];
  let widened = 0;

  activities.forEach((item, index) => {
    const days = nominal[index] ?? 0;
    let slower = spread.slower;
    const risky = options.widen && (constrained.has(item.id) || item.overdue);

    if (risky) {
      slower = Math.min(SLOWER_CAP, slower * WIDEN_FACTOR);
    }

    const flag = risky && days > 0 && slower > spread.slower;

    if (flag) {
      widened += 1;
    }

    widenedFlags.push(flag);
    fastest.push(days * (1 - spread.faster));
    slowest.push(days * (1 + slower));
  });

  const start = new Float64Array(count);
  const finish = new Float64Array(count);
  const driver = new Int32Array(count);

  const forward = (lengths: ArrayLike<number>): number => {
    let last = -1;
    let best = -Infinity;

    for (const index of order) {
      if (done[index]) {
        start[index] = 0;
        finish[index] = 0;
        driver[index] = -1;
        continue;
      }

      const length = lengths[index] ?? 0;
      let begin = earliest[index] ?? 0;
      let by = -1;

      if (!started[index]) {
        for (const link of preds[index] ?? []) {
          const predStart = start[link.from] ?? 0;
          const predFinish = finish[link.from] ?? 0;
          const candidate =
            link.type === "SS"
              ? predStart + link.lag
              : link.type === "FF"
                ? predFinish + link.lag - length
                : link.type === "SF"
                  ? predStart + link.lag - length
                  : predFinish + link.lag;

          if (candidate > begin) {
            begin = candidate;
            by = link.from;
          }
        }
      }

      start[index] = begin;
      finish[index] = begin + length;
      driver[index] = by;

      const end = begin + length;

      if (end > best) {
        best = end;
        last = index;
      }
    }

    return last;
  };

  const base = forward(nominal);

  if (base < 0) {
    return { ok: false, reason: "complete", detail: null };
  }

  const nominalFinish = finish[base] ?? 0;
  const runs = Math.max(200, options.runs ?? RUNS);
  const random = generator(Math.imul(options.seed + 1, 2654435761));
  const liveIndexes = activities.map((_, index) => index).filter((index) => !done[index] && (nominal[index] ?? 0) > 0);
  const samples = new Map<number, Float32Array>(liveIndexes.map((index) => [index, new Float32Array(runs)]));
  const lengths = new Float64Array(count);
  const outcomes = new Float64Array(runs);
  const hits = new Int32Array(count);

  for (let run = 0; run < runs; run += 1) {
    for (const index of liveIndexes) {
      const value = triangular(random(), fastest[index] ?? 0, nominal[index] ?? 0, slowest[index] ?? 0);

      lengths[index] = value;

      const column = samples.get(index);

      if (column) {
        column[run] = value;
      }
    }

    const last = forward(lengths);

    outcomes[run] = (finish[last] ?? 0) - nominalFinish;

    let walk = last;

    while (walk >= 0) {
      hits[walk] = (hits[walk] ?? 0) + 1;
      walk = driver[walk] ?? -1;
    }
  }

  let mean = 0;

  for (const value of outcomes) {
    mean += value;
  }

  mean /= runs;

  let variance = 0;

  for (const value of outcomes) {
    variance += (value - mean) * (value - mean);
  }

  const outcomeSpread = Math.sqrt(variance / runs);

  const drivers: Driver[] = [];

  for (const index of liveIndexes) {
    const criticality = (hits[index] ?? 0) / runs;

    if (criticality < MIN_CRITICALITY) {
      continue;
    }

    const column = samples.get(index) as Float32Array;
    let columnMean = 0;

    for (const value of column) {
      columnMean += value;
    }

    columnMean /= runs;

    let covariance = 0;
    let columnVariance = 0;

    for (let run = 0; run < runs; run += 1) {
      const delta = (column[run] ?? 0) - columnMean;

      covariance += delta * ((outcomes[run] ?? 0) - mean);
      columnVariance += delta * delta;
    }

    const denominator = Math.sqrt(columnVariance / runs) * outcomeSpread * runs;
    const item = activities[index] as ScheduleActivity;

    drivers.push({
      id: item.id,
      code: item.activityCode,
      name: item.name,
      status: item.status,
      criticality,
      sensitivity: denominator > 0 ? covariance / denominator : 0,
      days: nominal[index] ?? 0,
      fastest: fastest[index] ?? 0,
      slowest: slowest[index] ?? 0,
      float: item.totalFloatDays,
      constraints: (data.constraints ?? []).filter((entry) => entry.status === "OPEN" && entry.activityId === item.id).length,
      widened: widenedFlags[index] ?? false,
    });
  }

  drivers.sort((a, b) => b.criticality - a.criticality || Math.abs(b.sensitivity) - Math.abs(a.sensitivity) || a.code.localeCompare(b.code));

  const shifts = Array.from(outcomes, (value) => Math.round(value)).sort((a, b) => a - b);

  const intelligence = data.intelligence;
  const project = data.project;
  const anchorPick = firstDay(intelligence?.cpmForecastFinishDate, project?.forecastEndDate, project?.plannedEndDate);
  const anchorSource: AnchorSource = anchorPick.index === 0 ? "cpm" : anchorPick.index === 1 ? "forecast" : anchorPick.index === 2 ? "planned" : "network";
  const anchor = anchorPick.index >= 0 ? anchorPick.day : dataDay + Math.round(nominalFinish);

  const targetPick = firstDay(intelligence?.baselineFinishDate, project?.plannedEndDate);
  const target = targetPick.day;
  const targetSource: TargetSource = targetPick.index === 0 ? "baseline" : targetPick.index === 1 ? "planned" : "none";
  const targetRelative = Number.isFinite(target) ? target - anchor : NaN;

  const lowValue = shifts[Math.floor(runs * 0.01)] ?? 0;
  const highValue = shifts[Math.min(runs - 1, Math.floor(runs * 0.99))] ?? 0;
  const lowEdge = Math.min(lowValue, 0, Number.isFinite(targetRelative) ? targetRelative : 0);
  const highEdge = Math.max(highValue, 0, Number.isFinite(targetRelative) ? targetRelative : 0);
  const width = Math.max(1, Math.ceil((highEdge - lowEdge + 1) / BIN_TARGET));
  const first = Math.floor(lowEdge / width) * width;
  const total = Math.max(1, Math.ceil((highEdge - first + 1) / width));
  const bins: Bin[] = Array.from({ length: total }, (_, index) => ({ from: first + index * width, to: first + (index + 1) * width, count: 0 }));

  for (const value of shifts) {
    const slot = Math.min(total - 1, Math.max(0, Math.floor((value - first) / width)));
    const bin = bins[slot];

    if (bin) {
      bin.count += 1;
    }
  }

  return {
    ok: true,
    runs,
    live,
    links,
    widened,
    anchor,
    anchorSource,
    target,
    targetSource,
    shifts,
    bins,
    drivers: drivers.slice(0, DRIVER_LIMIT),
  };
}

export function dayAtConfidence(result: SimOk, percent: number): number {
  const index = Math.min(result.shifts.length - 1, Math.max(0, Math.ceil((percent / 100) * result.shifts.length) - 1));

  return result.anchor + (result.shifts[index] ?? 0);
}

export function chanceBy(result: SimOk, day: number): number {
  if (!Number.isFinite(day)) {
    return NaN;
  }

  const limit = day - result.anchor;
  let low = 0;
  let high = result.shifts.length;

  while (low < high) {
    const middle = (low + high) >> 1;

    if ((result.shifts[middle] ?? 0) <= limit) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low / result.shifts.length;
}

export function sourceLabel(source: AnchorSource): string {
  switch (source) {
    case "cpm":
      return "Schedule forecast";
    case "forecast":
      return "Project forecast date";
    case "planned":
      return "Planned end date";
    default:
      return "Schedule logic";
  }
}

export function failMessage(result: SimFail): string {
  switch (result.reason) {
    case "empty":
      return "The schedule has no activities yet, so there is nothing to simulate.";
    case "complete":
      return "Every activity is complete, so the finish date is no longer uncertain.";
    case "no-links":
      return "The activities have no logic links, so the simulation cannot tell which ones hold up the others. Add predecessor links on the schedule page.";
    case "invalid":
      return result.detail ? `The schedule network is not valid: ${result.detail}.` : "The schedule network is not valid, so it cannot be simulated.";
    default:
      return `The schedule logic contains a loop${result.detail ? ` (${result.detail})` : ""}. Remove the circular links to run the simulation.`;
  }
}

export function summaryMarkdown(result: SimOk, projectName: string, spreadLabel: string): string {
  const lines: string[] = [`# Finish forecast confidence: ${projectName}`, ""];

  lines.push(`${result.runs.toLocaleString("en-GB")} simulated outcomes, ${spreadLabel.toLowerCase()} duration spread.`, "");
  lines.push(`- ${sourceLabel(result.anchorSource)}: ${formatDay(result.anchor)} (${Math.round(chanceBy(result, result.anchor) * 100)}% chance of finishing by then)`);

  for (const percent of [50, 80, 90]) {
    const day = dayAtConfidence(result, percent);

    lines.push(`- ${percent}% confidence: ${formatDay(day)} (${day - result.anchor >= 0 ? "+" : ""}${day - result.anchor} days)`);
  }

  if (Number.isFinite(result.target)) {
    lines.push(`- Chance of finishing by ${formatDay(result.target)}: ${Math.round(chanceBy(result, result.target) * 100)}%`);
  }

  if (result.drivers.length > 0) {
    lines.push("", "Activities most often on the longest path:");

    for (const driver of result.drivers.slice(0, 5)) {
      lines.push(`- ${driver.code} ${driver.name}: on the longest path in ${Math.round(driver.criticality * 100)}% of outcomes`);
    }
  }

  return `${lines.join("\n")}\n`;
}
