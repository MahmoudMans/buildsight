import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { ScheduleActivity, ScheduleControl } from "@/types/project";

export const BEHIND_PP = 0.1;
export const SAMPLES = 90;
export const LIST_LIMIT = 8;
export const NO_DISCIPLINE = "No discipline";

export interface Row {
  id: string;
  code: string;
  name: string;
  discipline: string;
  weight: number;
  start: number;
  finish: number;
  status: ScheduleActivity["status"];
  planned: number;
  actual: number;
  gap: number;
  work: number;
  critical: boolean;
}

export interface Group {
  name: string;
  count: number;
  weight: number;
  share: number;
  planned: number;
  actual: number;
  gap: number;
  work: number;
  behind: number;
  ahead: number;
  done: number;
  late: number;
}

export interface Point {
  day: number;
  planned: number;
}

export interface Counts {
  total: number;
  complete: number;
  inProgress: number;
  notStarted: number;
  onHold: number;
  behind: number;
  ahead: number;
  shouldHaveStarted: number;
}

export interface Progress {
  asOf: number;
  usedToday: boolean;
  startDay: number;
  endDay: number;
  rows: Row[];
  groups: Group[];
  curve: Point[];
  planned: number;
  actual: number;
  gap: number;
  ratio: number | null;
  leftPlanned: number;
  leftActual: number;
  work: number;
  counts: Counts;
  skipped: number;
  baselineFinish: number | null;
  forecastFinish: number | null;
}

export type ProgressResult = { ok: true; progress: Progress } | { ok: false; reason: "empty" | "invalid" };

function clamp(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function plannedAt(start: number, finish: number, day: number): number {
  return clamp((day - start + 1) / (finish - start + 1));
}

function actualOf(activity: ScheduleActivity): number {
  if (activity.status === "COMPLETED" || activity.actualFinish) {
    return 1;
  }

  const value = Number(activity.progressPercentage);

  return Number.isFinite(value) ? clamp(value / 100) : 0;
}

function dayOrNull(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

function weighted(rows: Row[], pick: (row: Row) => number): number {
  const total = rows.reduce((sum, row) => sum + row.weight, 0);

  return total === 0 ? 0 : rows.reduce((sum, row) => sum + row.weight * pick(row), 0) / total;
}

export function buildProgress(data: ScheduleControl, today: number): ProgressResult {
  const activities = data.activities ?? [];

  if (activities.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const dataDay = dayOrNull(data.intelligence?.dataDate);
  const asOf = dataDay ?? today;
  const rows: Row[] = [];
  let skipped = 0;

  for (const activity of activities) {
    const start = toDay(activity.currentStart);
    const finish = toDay(activity.currentFinish);

    if (!Number.isFinite(start) || !Number.isFinite(finish) || finish < start) {
      skipped += 1;
      continue;
    }

    const duration = Number(activity.originalDurationDays);
    const weight = Math.max(1, Number.isFinite(duration) && duration > 0 ? duration : finish - start + 1);
    const planned = plannedAt(start, finish, asOf);
    const actual = actualOf(activity);
    const discipline = (activity.discipline ?? "").trim();

    rows.push({
      id: activity.id,
      code: activity.activityCode,
      name: activity.name,
      discipline: discipline === "" ? NO_DISCIPLINE : discipline,
      weight,
      start,
      finish,
      status: activity.status,
      planned,
      actual,
      gap: actual - planned,
      work: weight * (planned - actual),
      critical: activity.critical === true,
    });
  }

  if (rows.length === 0) {
    return { ok: false, reason: "invalid" };
  }

  const startDay = Math.min(...rows.map((row) => row.start));
  const endDay = Math.max(...rows.map((row) => row.finish));
  const planned = weighted(rows, (row) => row.planned);
  const actual = weighted(rows, (row) => row.actual);
  const step = Math.max(1, Math.ceil((endDay - startDay + 2) / SAMPLES));
  const days = new Set<number>();

  for (let day = startDay - 1; day < endDay; day += step) {
    days.add(day);
  }

  days.add(endDay);

  if (asOf > startDay - 1 && asOf < endDay) {
    days.add(asOf);
  }

  const curve: Point[] = [...days]
    .sort((a, b) => a - b)
    .map((day) => ({ day, planned: weighted(rows, (row) => plannedAt(row.start, row.finish, day)) }));

  const byGroup = new Map<string, Row[]>();

  for (const row of rows) {
    const list = byGroup.get(row.discipline);

    if (list) {
      list.push(row);
    } else {
      byGroup.set(row.discipline, [row]);
    }
  }

  const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);

  const groups: Group[] = [...byGroup.entries()].map(([name, list]) => {
    const weight = list.reduce((sum, row) => sum + row.weight, 0);
    const groupPlanned = weighted(list, (row) => row.planned);
    const groupActual = weighted(list, (row) => row.actual);

    return {
      name,
      count: list.length,
      weight,
      share: totalWeight === 0 ? 0 : weight / totalWeight,
      planned: groupPlanned,
      actual: groupActual,
      gap: groupActual - groupPlanned,
      work: list.reduce((sum, row) => sum + row.work, 0),
      behind: list.filter((row) => row.status !== "COMPLETED" && row.gap <= -BEHIND_PP).length,
      ahead: list.filter((row) => row.gap >= BEHIND_PP).length,
      done: list.filter((row) => row.status === "COMPLETED").length,
      late: list.filter((row) => row.status === "NOT_STARTED" && row.planned > 0 && row.actual === 0).length,
    } satisfies Group;
  });

  groups.sort((a, b) => a.gap - b.gap || b.weight - a.weight || a.name.localeCompare(b.name));

  const counts: Counts = {
    total: rows.length,
    complete: rows.filter((row) => row.status === "COMPLETED").length,
    inProgress: rows.filter((row) => row.status === "IN_PROGRESS").length,
    notStarted: rows.filter((row) => row.status === "NOT_STARTED").length,
    onHold: rows.filter((row) => row.status === "ON_HOLD").length,
    behind: rows.filter((row) => row.status !== "COMPLETED" && row.gap <= -BEHIND_PP).length,
    ahead: rows.filter((row) => row.gap >= BEHIND_PP).length,
    shouldHaveStarted: rows.filter((row) => row.status === "NOT_STARTED" && row.planned > 0 && row.actual === 0).length,
  };

  return {
    ok: true,
    progress: {
      asOf,
      usedToday: dataDay === null,
      startDay,
      endDay,
      rows,
      groups,
      curve,
      planned,
      actual,
      gap: actual - planned,
      ratio: planned > 0 ? actual / planned : null,
      leftPlanned: 1 - planned,
      leftActual: 1 - actual,
      work: rows.reduce((sum, row) => sum + row.work, 0),
      counts,
      skipped,
      baselineFinish: dayOrNull(data.intelligence?.baselineFinishDate),
      forecastFinish: dayOrNull(data.intelligence?.cpmForecastFinishDate),
    },
  };
}

export function behindRows(progress: Progress, discipline: string | null, limit: number): { rows: Row[]; total: number } {
  const pool = progress.rows.filter((row) => row.status !== "COMPLETED" && row.work > 0.5 && (discipline === null || row.discipline === discipline));

  pool.sort((a, b) => b.work - a.work || a.code.localeCompare(b.code, undefined, { numeric: true }));

  return { rows: pool.slice(0, limit), total: pool.length };
}

export function aheadRows(progress: Progress, discipline: string | null, limit: number): { rows: Row[]; total: number } {
  const pool = progress.rows.filter((row) => row.work < -0.5 && (discipline === null || row.discipline === discipline));

  pool.sort((a, b) => a.work - b.work || a.code.localeCompare(b.code, undefined, { numeric: true }));

  return { rows: pool.slice(0, limit), total: pool.length };
}

export function pctText(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function ppText(gap: number): string {
  const points = gap * 100;

  if (Math.abs(points) < 0.05) {
    return "0 pts";
  }

  const text = Math.abs(points) < 10 ? Math.abs(points).toFixed(1) : String(Math.round(Math.abs(points)));

  return `${points > 0 ? "+" : "−"}${text} pts`;
}

export function workText(work: number): string {
  const days = Math.round(Math.abs(work) * 10) / 10;

  if (days === 0) {
    return "on plan";
  }

  const shown = days % 1 === 0 ? String(days) : days.toFixed(1);

  return `${shown} ${days === 1 ? "day" : "days"} of work ${work > 0 ? "behind" : "ahead"}`;
}

export function verdict(progress: Progress): { tone: "good" | "watch" | "bad"; text: string } {
  const points = progress.gap * 100;

  if (progress.planned === 0) {
    return { tone: "good", text: "Nothing is planned to be done yet, so there is nothing to be behind on." };
  }

  if (points <= -BEHIND_PP * 100) {
    return { tone: "bad", text: `Actual progress is ${Math.abs(Math.round(points))} points behind where the schedule expects the work to be.` };
  }

  if (points < -2) {
    return { tone: "watch", text: `Actual progress is slightly behind the schedule, by ${Math.abs(points).toFixed(1)} points.` };
  }

  if (points > 2) {
    return { tone: "good", text: `Actual progress is ${points.toFixed(1)} points ahead of where the schedule expects the work to be.` };
  }

  return { tone: "good", text: "Actual progress is in line with where the schedule expects the work to be." };
}

export function progressMarkdown(progress: Progress, projectName: string, today: number): string {
  const lines: string[] = [];
  const { counts } = progress;

  lines.push(`# Progress against schedule: ${projectName}`, "");
  lines.push(`As of ${formatDay(progress.asOf)}${progress.usedToday ? " (today; the schedule has no data date)" : " (schedule data date)"}. Printed ${formatDay(today)}.`, "");
  lines.push(
    `- Expected by now: ${pctText(progress.planned)}`,
    `- Actual: ${pctText(progress.actual)}`,
    `- Gap: ${ppText(progress.gap)}`,
    `- Net work behind: ${workText(progress.work)}`,
    `- Activities: ${counts.total} (${counts.complete} complete, ${counts.inProgress} in progress, ${counts.notStarted} not started, ${counts.onHold} on hold)`,
    `- Behind by ${Math.round(BEHIND_PP * 100)} points or more: ${counts.behind}; should have started: ${counts.shouldHaveStarted}`,
    "",
  );
  lines.push("| Discipline | Activities | Share of work | Expected | Actual | Gap | Behind |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  for (const group of progress.groups) {
    lines.push(`| ${cell(group.name)} | ${group.count} | ${pctText(group.share)} | ${pctText(group.planned)} | ${pctText(group.actual)} | ${ppText(group.gap)} | ${group.behind} |`);
  }

  lines.push("");

  const worst = behindRows(progress, null, LIST_LIMIT);

  if (worst.rows.length > 0) {
    lines.push("## Furthest behind", "");

    for (const row of worst.rows) {
      lines.push(`- ${cell(row.code)} ${cell(trunc(row.name, 60))} (${cell(row.discipline)}): expected ${pctText(row.planned)}, actual ${pctText(row.actual)}, ${workText(row.work)}`);
    }

    lines.push("");
  }

  lines.push(
    `Progress is weighted by each activity's duration, not by cost or quantity. Expected progress spreads each activity evenly between its current start and finish dates through the date above; activities the schedule has already moved will not show as behind. Actual progress is the percent complete reported on each activity, and completed activities count as 100%.`,
    "",
  );

  if (progress.skipped > 0) {
    lines.push(`${progress.skipped} ${plural(progress.skipped, "activity has", "activities have")} no usable dates and ${plural(progress.skipped, "was", "were")} left out.`, "");
  }

  return lines.join("\n");
}
