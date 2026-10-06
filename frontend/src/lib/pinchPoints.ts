import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import { NO_DISCIPLINE, mondayOf, weekEnd } from "@/lib/tradeFlow";
import type { ScheduleActivity, ScheduleControl } from "@/types/project";

export const TIGHT_DAYS = 10;
export const PAGE = 10;
export const MAX_WEEKS = 104;

const WEEK = 7;

export const RANGES: ReadonlyArray<{ key: string; weeks: number; label: string }> = [
  { key: "12", weeks: 12, label: "12 weeks" },
  { key: "26", weeks: 26, label: "6 months" },
  { key: "52", weeks: 52, label: "12 months" },
];

export const DEFAULT_RANGE = "26";

export type Band = "none" | "tight" | "loose";

export const BAND_LABEL: Record<Band, string> = {
  none: "No room (0 days or less)",
  tight: `Tight (1 to ${TIGHT_DAYS} days)`,
  loose: `Room to spare (over ${TIGHT_DAYS} days)`,
};

export interface Item {
  id: string;
  code: string;
  name: string;
  discipline: string;
  start: number;
  finish: number;
  effStart: number;
  effFinish: number;
  float: number | null;
  band: Band;
  status: ScheduleActivity["status"];
  started: boolean;
  progress: number;
  holds: number;
}

export interface Week {
  start: number;
  end: number;
  current: boolean;
  none: number;
  tight: number;
  loose: number;
  total: number;
  items: Item[];
}

export interface TradeRow {
  name: string;
  open: number;
  none: number;
  tight: number;
  lowest: number | null;
  median: number | null;
  firstNone: number | null;
}

export interface Pinch {
  discipline: string | null;
  weeks: Week[];
  trades: TradeRow[];
  disciplines: string[];
  items: Item[];
  next: Item[];
  tightestIndex: number | null;
  negative: Item[];
  medianFloat: number | null;
  from: number;
  to: number;
  dataDate: number | null;
  noFloat: number;
  skipped: number;
}

export type PinchResult = { ok: true; pinch: Pinch } | { ok: false; reason: "empty" | "invalid" };

function dayOrNull(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

function isDone(activity: ScheduleActivity): boolean {
  return activity.status === "COMPLETED" || Boolean(activity.actualFinish);
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

export function bandOf(float: number | null, critical: boolean): Band | null {
  if (float === null) {
    return critical ? "none" : null;
  }

  return float <= 0 || critical ? "none" : float <= TIGHT_DAYS ? "tight" : "loose";
}

export function floatLabel(value: number | null): string {
  if (value === null) {
    return "no float";
  }

  return value < 0 ? `${value} d float` : value === 0 ? "no float" : `${value} d float`;
}

export function weekRange(start: number, end: number): string {
  return `${formatDay(start).slice(0, 6).trim()} to ${formatDay(end).slice(0, 6).trim()}`;
}

export function buildPinch(data: ScheduleControl, today: number, weeksShown: number, discipline: string | null): PinchResult {
  const activities = data.activities ?? [];

  if (activities.length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (!activities.some((item) => Number.isFinite(toDay(item.currentStart)) && Number.isFinite(toDay(item.currentFinish)))) {
    return { ok: false, reason: "invalid" };
  }

  const count = Math.min(MAX_WEEKS, Math.max(1, Math.round(weeksShown)));
  const firstMonday = mondayOf(today);
  const to = weekEnd(firstMonday + (count - 1) * WEEK);
  const holds = new Map<string, number>();

  for (const item of data.constraints ?? []) {
    if (item.status === "OPEN") {
      holds.set(item.activityId, (holds.get(item.activityId) ?? 0) + 1);
    }
  }

  const all: Item[] = [];
  let skipped = 0;
  let noFloat = 0;

  for (const activity of activities) {
    if (isDone(activity)) {
      continue;
    }

    const start = dayOrNull(activity.currentStart);
    const finish = dayOrNull(activity.currentFinish);

    if (start === null || finish === null) {
      skipped += 1;
      continue;
    }

    const rawFloat = Number(activity.totalFloatDays);
    const float = Number.isFinite(rawFloat) ? rawFloat : null;
    const band = bandOf(float, activity.critical === true);

    if (band === null) {
      noFloat += 1;
      continue;
    }

    const effStart = Math.max(start, today);
    const effFinish = Math.max(finish, today);

    if (effStart > to) {
      continue;
    }

    const text = (activity.discipline ?? "").trim();

    all.push({
      id: activity.id,
      code: activity.activityCode,
      name: activity.name,
      discipline: text === "" ? NO_DISCIPLINE : text,
      start,
      finish,
      effStart,
      effFinish,
      float,
      band,
      status: activity.status,
      started: activity.status === "IN_PROGRESS" || Boolean(activity.actualStart),
      progress: Number.isFinite(activity.progressPercentage) ? Math.min(100, Math.max(0, Math.round(activity.progressPercentage))) : 0,
      holds: holds.get(activity.id) ?? 0,
    });
  }

  const byFloat = (a: Item, b: Item) => (a.float ?? 0) - (b.float ?? 0) || a.effStart - b.effStart || a.code.localeCompare(b.code, undefined, { numeric: true });
  const disciplines = [...new Set(all.map((item) => item.discipline))].sort((a, b) => Number(a === NO_DISCIPLINE) - Number(b === NO_DISCIPLINE) || a.localeCompare(b));
  const items = all.filter((item) => discipline === null || item.discipline === discipline).sort(byFloat);

  const weeks: Week[] = Array.from({ length: count }, (_, index) => {
    const start = firstMonday + index * WEEK;
    const end = weekEnd(start);
    const inFlight = items.filter((item) => item.effStart <= end && item.effFinish >= start);

    return {
      start,
      end,
      current: index === 0,
      none: inFlight.filter((item) => item.band === "none").length,
      tight: inFlight.filter((item) => item.band === "tight").length,
      loose: inFlight.filter((item) => item.band === "loose").length,
      total: inFlight.length,
      items: inFlight,
    };
  });

  let tightest: number | null = null;

  weeks.forEach((week, index) => {
    if (week.none + week.tight === 0) {
      return;
    }

    const best = tightest === null ? null : (weeks[tightest] as Week);

    if (best === null || week.none > best.none || (week.none === best.none && week.tight > best.tight)) {
      tightest = index;
    }
  });

  const trades: TradeRow[] = disciplines
    .map((name) => {
      const mine = all.filter((item) => item.discipline === name);
      const floats = mine.map((item) => item.float).filter((value): value is number => value !== null);
      const none = mine.filter((item) => item.band === "none");
      const firstNone = none.length === 0 ? null : mondayOf(Math.min(...none.map((item) => item.effStart)));

      return {
        name,
        open: mine.length,
        none: none.length,
        tight: mine.filter((item) => item.band === "tight").length,
        lowest: floats.length === 0 ? null : Math.min(...floats),
        median: medianOf(floats),
        firstNone,
      };
    })
    .sort((a, b) => (a.lowest ?? Infinity) - (b.lowest ?? Infinity) || b.none - a.none || a.name.localeCompare(b.name));

  const dataDate = dayOrNull(data.intelligence?.dataDate);

  return {
    ok: true,
    pinch: {
      discipline,
      weeks,
      trades,
      disciplines,
      items,
      next: items.filter((item) => item.band === "tight"),
      tightestIndex: tightest,
      negative: items.filter((item) => item.float !== null && item.float < 0),
      medianFloat: medianOf(items.map((item) => item.float).filter((value): value is number => value !== null)),
      from: today,
      to,
      dataDate,
      noFloat,
      skipped,
    },
  };
}

export function itemLine(item: Item): string {
  const when = item.started ? `under way, finishes ${formatDay(item.finish).slice(0, 6).trim()}` : item.start < item.effStart ? "should have started" : `starts ${formatDay(item.start).slice(0, 6).trim()}`;

  return `${item.code} ${trunc(item.name, 44)} (${item.discipline}): ${floatLabel(item.float)}, ${when}`;
}

export function pinchMarkdown(pinch: Pinch, projectName: string, today: number): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const worst = pinch.tightestIndex === null ? null : (pinch.weeks[pinch.tightestIndex] as Week);
  const now = pinch.weeks[0];

  lines.push(`# Pinch points: ${projectName}${pinch.discipline ? `, ${pinch.discipline}` : ""}`, "");
  lines.push(`As of ${formatDay(today)}. Open work planned or under way from ${formatDay(pinch.from)} to ${formatDay(pinch.to)}, split by how many days each activity can slip before it moves the finish date.`, "");

  if (now) {
    lines.push(`- This week: ${now.none} with no room, ${now.tight} tight, ${now.loose} with room to spare`);
  }

  if (worst) {
    lines.push(`- Tightest week: ${weekRange(worst.start, worst.end)}, with ${worst.none} ${plural(worst.none, "activity", "activities")} with no room and ${worst.tight} tight`);
  } else {
    lines.push("- Tightest week: none, nothing in this range is within " + TIGHT_DAYS + " days of critical");
  }

  lines.push(`- Negative float: ${pinch.negative.length}; within ${TIGHT_DAYS} days of critical: ${pinch.next.length}`, "");

  lines.push("| Week | No room | Tight | Room to spare |");
  lines.push("| --- | ---: | ---: | ---: |");

  for (const week of pinch.weeks) {
    lines.push(`| ${weekRange(week.start, week.end)}${week.current ? " (this week)" : ""} | ${week.none} | ${week.tight} | ${week.loose} |`);
  }

  lines.push("");

  if (pinch.next.length > 0) {
    lines.push("## Next to go critical", "");

    for (const item of pinch.next.slice(0, 15)) {
      lines.push(`- ${cell(itemLine(item))}${item.holds > 0 ? `, ${item.holds} open ${plural(item.holds, "constraint", "constraints")}` : ""}`);
    }

    lines.push("");
  }

  lines.push(
    `Float is the number of days an activity can slip before the finish date moves, as calculated by the schedule. An activity counts in every week it is planned or under way, and unfinished work that has overrun is counted from today. Float is shared along a chain of activities, so when one activity uses it up the others on that chain lose it too.`,
    "",
  );

  return lines.join("\n");
}
