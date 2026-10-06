import { DAY_MS, formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { ScheduleActivity, ScheduleControl } from "@/types/project";

export const NO_DISCIPLINE = "No discipline";
export const GAP_WEEKS = 2;
export const MAX_WEEKS = 104;
export const DETAIL_LIMIT = 30;
const WEEK = 7;

export const RANGES: ReadonlyArray<{ key: string; weeks: number | null; label: string }> = [
  { key: "12", weeks: 12, label: "12 weeks" },
  { key: "26", weeks: 26, label: "6 months" },
  { key: "52", weeks: 52, label: "12 months" },
  { key: "all", weeks: null, label: "Whole programme" },
];

export const DEFAULT_RANGE = "26";

export type Measure = "all" | "critical";

export const MEASURES: ReadonlyArray<{ key: Measure; label: string }> = [
  { key: "all", label: "All activities" },
  { key: "critical", label: "Critical only" },
];

export interface Act {
  id: string;
  code: string;
  name: string;
  discipline: string;
  start: number;
  end: number;
  planFinish: number;
  overrun: boolean;
  status: ScheduleActivity["status"];
  progress: number;
  critical: boolean;
  nearCritical: boolean;
}

export interface Gap {
  from: number;
  to: number;
  weeks: number;
}

export interface Lane {
  name: string;
  all: number[];
  critical: number[];
  activities: number;
  criticalActivities: number;
  first: number | null;
  last: number | null;
  peak: number;
  peakWeek: number | null;
  gaps: Gap[];
  activeWeeks: number;
  load: number;
}

export interface Flow {
  weeks: number[];
  lanes: Lane[];
  total: { all: number[]; critical: number[] };
  acts: Act[];
  peak: number;
  peakWeek: number | null;
  peakTrades: Array<{ name: string; count: number }>;
  busiest: Lane | null;
  gapCount: number;
  truncated: boolean;
  skipped: number;
}

export type FlowResult = { ok: true; flow: Flow } | { ok: false; reason: "empty" | "invalid" };

export function mondayOf(day: number): number {
  const weekday = (((day + 3) % 7) + 7) % 7;

  return day - weekday;
}

function dayOrNull(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

export function weekEnd(start: number): number {
  return start + WEEK - 1;
}

function overlaps(act: Act, start: number): boolean {
  return act.start <= weekEnd(start) && act.end >= start;
}

export function buildFlow(data: ScheduleControl, today: number, weeksShown: number | null): FlowResult {
  const activities = data.activities ?? [];

  if (activities.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const acts: Act[] = [];
  let skipped = 0;

  for (const activity of activities) {
    const planStart = toDay(activity.currentStart);
    const planFinish = toDay(activity.currentFinish);

    if (!Number.isFinite(planStart) || !Number.isFinite(planFinish)) {
      skipped += 1;
      continue;
    }

    const started = activity.status === "IN_PROGRESS" || activity.status === "COMPLETED" || Boolean(activity.actualStart);
    const done = activity.status === "COMPLETED" || Boolean(activity.actualFinish);
    const start = dayOrNull(activity.actualStart) ?? planStart;
    const finish = done ? (dayOrNull(activity.actualFinish) ?? planFinish) : started ? Math.max(planFinish, today) : planFinish;
    const discipline = (activity.discipline ?? "").trim();

    acts.push({
      id: activity.id,
      code: activity.activityCode,
      name: activity.name,
      discipline: discipline === "" ? NO_DISCIPLINE : discipline,
      start: Math.min(start, finish),
      end: Math.max(start, finish),
      planFinish,
      overrun: started && !done && planFinish < today,
      status: activity.status,
      progress: Number.isFinite(activity.progressPercentage) ? activity.progressPercentage : 0,
      critical: activity.critical === true,
      nearCritical: activity.nearCritical === true,
    });
  }

  if (acts.length === 0) {
    return { ok: false, reason: "invalid" };
  }

  const earliest = weeksShown === null ? mondayOf(Math.min(...acts.map((act) => act.start))) : mondayOf(today);
  const lastDay = weeksShown === null ? Math.max(...acts.map((act) => act.end)) : earliest + weeksShown * WEEK - 1;
  const wanted = Math.max(1, Math.floor((lastDay - earliest) / WEEK) + 1);
  const count = Math.min(MAX_WEEKS, wanted);
  const first = wanted > MAX_WEEKS ? Math.min(Math.max(earliest, mondayOf(today) - 13 * WEEK), mondayOf(lastDay) - (MAX_WEEKS - 1) * WEEK) : earliest;
  const weeks = Array.from({ length: count }, (_, index) => first + index * WEEK);

  const byLane = new Map<string, Act[]>();

  for (const act of acts) {
    const list = byLane.get(act.discipline);

    if (list) {
      list.push(act);
    } else {
      byLane.set(act.discipline, [act]);
    }
  }

  const lanes: Lane[] = [];

  for (const [name, list] of byLane) {
    const all = weeks.map((start) => list.filter((act) => overlaps(act, start)).length);
    const critical = weeks.map((start) => list.filter((act) => act.critical && overlaps(act, start)).length);
    const live = list.filter((act) => weeks.some((start) => overlaps(act, start)));

    if (live.length === 0) {
      continue;
    }

    const firstIndex = all.findIndex((value) => value > 0);
    const lastIndex = all.length - 1 - [...all].reverse().findIndex((value) => value > 0);
    const gaps: Gap[] = [];
    let run = 0;

    for (let index = firstIndex; index <= lastIndex; index += 1) {
      if ((all[index] ?? 0) === 0) {
        run += 1;
      } else {
        if (run >= GAP_WEEKS) {
          gaps.push({ from: index - run, to: index - 1, weeks: run });
        }

        run = 0;
      }
    }

    const peak = Math.max(...all);
    const isTrade = name !== NO_DISCIPLINE;

    lanes.push({
      name,
      all,
      critical,
      activities: live.length,
      criticalActivities: live.filter((act) => act.critical).length,
      first: firstIndex < 0 ? null : firstIndex,
      last: firstIndex < 0 ? null : lastIndex,
      peak,
      peakWeek: peak === 0 ? null : all.indexOf(peak),
      gaps: isTrade ? gaps : [],
      activeWeeks: all.filter((value) => value > 0).length,
      load: all.reduce((sum, value) => sum + value, 0),
    });
  }

  if (lanes.length === 0) {
    return { ok: true, flow: { weeks, lanes: [], total: { all: weeks.map(() => 0), critical: weeks.map(() => 0) }, acts, peak: 0, peakWeek: null, peakTrades: [], busiest: null, gapCount: 0, truncated: wanted > count, skipped } };
  }

  lanes.sort((a, b) => Number(a.name === NO_DISCIPLINE) - Number(b.name === NO_DISCIPLINE) || (a.first ?? Infinity) - (b.first ?? Infinity) || b.activities - a.activities || a.name.localeCompare(b.name));

  const total = { all: weeks.map((_, index) => lanes.reduce((sum, lane) => sum + (lane.all[index] ?? 0), 0)), critical: weeks.map((_, index) => lanes.reduce((sum, lane) => sum + (lane.critical[index] ?? 0), 0)) };
  const peak = Math.max(...total.all);
  const peakWeek = peak === 0 ? null : total.all.indexOf(peak);
  const peakTrades = peakWeek === null ? [] : lanes.map((lane) => ({ name: lane.name, count: lane.all[peakWeek] ?? 0 })).filter((item) => item.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const busiest = [...lanes].filter((lane) => lane.name !== NO_DISCIPLINE).sort((a, b) => b.load - a.load || a.name.localeCompare(b.name))[0] ?? null;

  return {
    ok: true,
    flow: {
      weeks,
      lanes,
      total,
      acts,
      peak,
      peakWeek,
      peakTrades,
      busiest,
      gapCount: lanes.reduce((sum, lane) => sum + lane.gaps.length, 0),
      truncated: wanted > count,
      skipped,
    },
  };
}

export function activeIn(flow: Flow, lane: string | null, week: number, onlyCritical: boolean): Act[] {
  const start = flow.weeks[week];

  if (start === undefined) {
    return [];
  }

  return flow.acts
    .filter((act) => (lane === null || act.discipline === lane) && (!onlyCritical || act.critical) && overlaps(act, start))
    .sort((a, b) => a.start - b.start || a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export function weekLabel(start: number): string {
  return formatDay(start).slice(0, 6).trim();
}

export function dayOfMonth(day: number): string {
  return String(new Date(day * DAY_MS).getUTCDate());
}

function monthOf(day: number): string {
  return new Date(day * DAY_MS).toLocaleDateString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
}

export function monthSpans(weeks: number[]): Array<{ label: string; span: number }> {
  const spans: Array<{ label: string; span: number }> = [];

  for (const week of weeks) {
    const label = monthOf(week);
    const last = spans[spans.length - 1];

    if (last && last.label === label) {
      last.span += 1;
    } else {
      spans.push({ label, span: 1 });
    }
  }

  return spans;
}

export function heatLevel(value: number, peak: number, floor = 4): 0 | 1 | 2 | 3 | 4 {
  if (!(value > 0)) {
    return 0;
  }

  const ratio = value / Math.max(peak, floor);

  return ratio <= 0.25 ? 1 : ratio <= 0.5 ? 2 : ratio <= 0.75 ? 3 : 4;
}

export function nowWeek(flow: Flow, today: number): number | null {
  const index = flow.weeks.findIndex((start) => start <= today && today <= weekEnd(start));

  return index < 0 ? null : index;
}

export function gapIndexes(lane: Lane): Set<number> {
  const set = new Set<number>();

  for (const gap of lane.gaps) {
    for (let index = gap.from; index <= gap.to; index += 1) {
      set.add(index);
    }
  }

  return set;
}

export function rangeText(flow: Flow, from: number, to: number): string {
  const a = flow.weeks[from];
  const b = flow.weeks[to];

  return a === undefined || b === undefined ? "" : `${formatDay(a)} to ${formatDay(weekEnd(b))}`;
}

export function gapText(flow: Flow, gap: Gap): string {
  return `idle for ${gap.weeks} ${plural(gap.weeks, "week", "weeks")}, ${rangeText(flow, gap.from, gap.to)}`;
}

export function flowMarkdown(flow: Flow, measure: Measure, projectName: string, today: number): string {
  const lines: string[] = [];
  const key = measure === "critical" ? "critical" : "all";

  lines.push(`# Trade flow: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. ${flow.weeks.length} ${plural(flow.weeks.length, "week", "weeks")} from ${formatDay(flow.weeks[0] ?? today)}. Each figure is the number of ${measure === "critical" ? "critical " : ""}activities in progress or planned in that week for that discipline.`, "");

  if (flow.lanes.length === 0) {
    lines.push("No activity falls in these weeks.", "");

    return lines.join("\n");
  }

  if (flow.peakWeek !== null) {
    lines.push(`- Busiest week: ${rangeText(flow, flow.peakWeek, flow.peakWeek)}, ${flow.peak} activities at once (${flow.peakTrades.map((item) => `${item.name} ${item.count}`).join(", ")})`);
  }

  lines.push(`- Disciplines: ${flow.lanes.length}`, `- Idle gaps of ${GAP_WEEKS} weeks or more: ${flow.gapCount}`, "");

  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push("| Discipline | Activities | First week | Last week | Busiest week | Idle gaps |");
  lines.push("| --- | ---: | --- | --- | ---: | --- |");

  for (const lane of flow.lanes) {
    const values = key === "critical" ? lane.critical : lane.all;
    const peak = Math.max(0, ...values);

    lines.push(
      `| ${cell(lane.name)} | ${lane.activities} | ${lane.first === null ? "—" : formatDay(flow.weeks[lane.first] ?? NaN)} | ${lane.last === null ? "—" : formatDay(flow.weeks[lane.last] ?? NaN)} | ${peak} | ${lane.gaps.length === 0 ? "none" : lane.gaps.map((gap) => gapText(flow, gap)).join("; ")} |`,
    );
  }

  lines.push("");

  if (flow.peakWeek !== null) {
    const busy = activeIn(flow, null, flow.peakWeek, measure === "critical").slice(0, 12);

    lines.push(`## In progress in the busiest week`, "");

    for (const act of busy) {
      lines.push(`- ${cell(act.code)} ${cell(trunc(act.name, 50))} (${cell(act.discipline)}), ${formatDay(act.start)} to ${formatDay(act.end)}${act.critical ? ", critical" : ""}`);
    }

    lines.push("");
  }

  lines.push(
    "A week counts an activity if it is planned, or has run, on any day of that week (Monday to Sunday). Started activities that have overrun their finish date are counted up to today. A gap is a run of two or more empty weeks between two weeks in which the discipline has work, within the weeks shown; activities with no discipline are not checked for gaps.",
    "",
  );

  if (flow.truncated) {
    lines.push(`Only ${MAX_WEEKS} weeks are shown, starting ${formatDay(flow.weeks[0] ?? today)}; the rest of the programme is left out.`, "");
  }

  return lines.join("\n");
}
