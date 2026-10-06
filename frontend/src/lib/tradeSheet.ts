import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import { blockerText, buildReadiness, holdText, kindLabel, type Hold, type Kind } from "@/lib/startReadiness";
import { NO_DISCIPLINE, mondayOf, weekEnd } from "@/lib/tradeFlow";
import type { ScheduleActivity, ScheduleControl } from "@/types/project";

export const HORIZONS: ReadonlyArray<{ weeks: number; label: string }> = [
  { weeks: 2, label: "2 weeks" },
  { weeks: 3, label: "3 weeks" },
  { weeks: 4, label: "4 weeks" },
];

export const DEFAULT_WEEKS = 2;
export const STALE_DAYS = 7;

const WEEK = 7;

export type Phase = "overrun" | "lateStart" | "starts" | "startsFinishes" | "finishes" | "underway" | "continues";

export const PHASE_LABEL: Record<Phase, string> = {
  overrun: "Past finish date",
  lateStart: "Late start",
  starts: "Starts",
  startsFinishes: "Starts and finishes",
  finishes: "Finishes",
  underway: "Under way",
  continues: "Continues",
};

const PHASE_RANK: Record<Phase, number> = { overrun: 0, lateStart: 1, starts: 2, startsFinishes: 3, finishes: 4, underway: 5, continues: 6 };

export interface Row {
  key: string;
  id: string;
  code: string;
  name: string;
  discipline: string;
  start: number;
  finish: number;
  progress: number;
  status: ScheduleActivity["status"];
  started: boolean;
  phase: Phase;
  first: boolean;
  kind: Kind | null;
  critical: boolean;
  nearCritical: boolean;
  float: number | null;
  blockers: string[];
  holds: Hold[];
  daysLate: number;
}

export interface Week {
  start: number;
  end: number;
  current: boolean;
  rows: Row[];
}

export interface Trade {
  name: string;
  activities: number;
  starting: number;
  notReady: number;
  holds: number;
}

export interface Sheet {
  discipline: string | null;
  from: number;
  to: number;
  weeks: Week[];
  trades: Trade[];
  activities: number;
  starting: number;
  ready: number;
  notReady: number;
  lateStarts: number;
  overruns: number;
  critical: number;
  holds: Array<Hold & { code: string; name: string }>;
  holdsOverdue: number;
  dataDate: number | null;
  staleDays: number;
  linkCount: number;
  skipped: number;
}

export type SheetResult = { ok: true; sheet: Sheet } | { ok: false; reason: "empty" | "invalid" };

function disciplineOf(activity: ScheduleActivity): string {
  const text = (activity.discipline ?? "").trim();

  return text === "" ? NO_DISCIPLINE : text;
}

function isStarted(activity: ScheduleActivity): boolean {
  return activity.status === "IN_PROGRESS" || activity.status === "COMPLETED" || Boolean(activity.actualStart);
}

function isDone(activity: ScheduleActivity): boolean {
  return activity.status === "COMPLETED" || Boolean(activity.actualFinish);
}

export function shortDay(day: number): string {
  return formatDay(day).slice(0, 6).trim();
}

export function weekRange(start: number, end: number): string {
  return `${shortDay(start)} to ${shortDay(end)}`;
}

function phaseOf(started: boolean, lateStart: boolean, overrun: boolean, firstWeek: boolean, startsHere: boolean, finishesHere: boolean): Phase {
  if (overrun) {
    return "overrun";
  }

  if (lateStart) {
    return "lateStart";
  }

  if (!started && startsHere) {
    return finishesHere ? "startsFinishes" : "starts";
  }

  if (finishesHere) {
    return "finishes";
  }

  return started && firstWeek ? "underway" : "continues";
}

export function buildSheet(data: ScheduleControl, today: number, weeks: number, discipline: string | null): SheetResult {
  const activities = data.activities ?? [];

  if (activities.length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (!activities.some((item) => Number.isFinite(toDay(item.currentStart)) && Number.isFinite(toDay(item.currentFinish)))) {
    return { ok: false, reason: "invalid" };
  }

  const count = Math.max(1, Math.round(weeks));
  const firstMonday = mondayOf(today);
  const to = weekEnd(firstMonday + (count - 1) * WEEK);
  const readiness = buildReadiness(data, today, to - today);
  const entryById = new Map((readiness.ok ? readiness.readiness.entries : []).map((entry) => [entry.id, entry]));
  const openHolds = new Map<string, Hold[]>();

  for (const item of data.constraints ?? []) {
    if (item.status !== "OPEN") {
      continue;
    }

    const due = toDay(item.dueDate);
    const owner = (item.ownerName ?? "").trim();
    const list = openHolds.get(item.activityId) ?? [];

    list.push({ id: item.id, type: item.constraintType, title: item.title, owner: owner === "" ? null : owner, due, overdue: Number.isFinite(due) && due < today });
    openHolds.set(item.activityId, list);
  }

  for (const list of openHolds.values()) {
    list.sort((a, b) => (Number.isFinite(a.due) ? a.due : Infinity) - (Number.isFinite(b.due) ? b.due : Infinity));
  }

  const weekList: Week[] = Array.from({ length: count }, (_, index) => {
    const start = firstMonday + index * WEEK;

    return { start, end: weekEnd(start), current: index === 0, rows: [] };
  });

  const tradeMap = new Map<string, { activities: Set<string>; starting: Set<string>; notReady: Set<string>; holds: number }>();
  let skipped = 0;

  const onSheet: Array<{ activity: ScheduleActivity; start: number; finish: number }> = [];

  for (const activity of activities) {
    if (isDone(activity)) {
      continue;
    }

    const start = toDay(activity.currentStart);
    const finish = toDay(activity.currentFinish);

    if (!Number.isFinite(start) || !Number.isFinite(finish)) {
      skipped += 1;
      continue;
    }

    const effStart = Math.max(start, today);
    const effFinish = Math.max(finish, today);

    if (effStart > to || effFinish < today) {
      continue;
    }

    onSheet.push({ activity, start, finish });
  }

  for (const { activity, start, finish } of onSheet) {
    const trade = disciplineOf(activity);
    const started = isStarted(activity);
    const effStart = Math.max(start, today);
    const effFinish = Math.max(finish, today);
    const entry = entryById.get(activity.id) ?? null;
    const holds = openHolds.get(activity.id) ?? [];
    const slot = tradeMap.get(trade) ?? { activities: new Set<string>(), starting: new Set<string>(), notReady: new Set<string>(), holds: 0 };

    slot.activities.add(activity.id);
    slot.holds += holds.length;

    if (!started) {
      slot.starting.add(activity.id);

      if (entry && entry.kind !== "ready") {
        slot.notReady.add(activity.id);
      }
    }

    tradeMap.set(trade, slot);

    if (discipline !== null && trade !== discipline) {
      continue;
    }

    const blockers = entry ? entry.blockers.map(blockerText) : [];
    const float = Number(activity.totalFloatDays);
    let first = true;

    weekList.forEach((week, index) => {
      if (effStart > week.end || effFinish < week.start) {
        return;
      }

      const lateStart = !started && start < today && index === 0;
      const overrun = started && finish < today && index === 0;
      const startsHere = !started && effStart >= week.start && effStart <= week.end;
      const finishesHere = effFinish >= week.start && effFinish <= week.end;
      const phase = phaseOf(started, lateStart, overrun, index === 0, startsHere, finishesHere);

      week.rows.push({
        key: `${week.start}:${activity.id}`,
        id: activity.id,
        code: activity.activityCode,
        name: activity.name,
        discipline: trade,
        start,
        finish,
        progress: Number.isFinite(activity.progressPercentage) ? Math.min(100, Math.max(0, Math.round(activity.progressPercentage))) : 0,
        status: activity.status,
        started,
        phase,
        first,
        kind: !started ? (entry ? entry.kind : activity.status === "ON_HOLD" ? "hold" : holds.length > 0 ? "constraints" : "ready") : null,
        critical: activity.critical === true,
        nearCritical: activity.nearCritical === true,
        float: Number.isFinite(float) ? float : null,
        blockers: first ? blockers : [],
        holds: first || phase !== "continues" ? holds : [],
        daysLate: lateStart ? today - start : overrun ? today - finish : 0,
      });

      first = false;
    });
  }

  for (const week of weekList) {
    week.rows.sort((a, b) => PHASE_RANK[a.phase] - PHASE_RANK[b.phase] || a.start - b.start || a.code.localeCompare(b.code, undefined, { numeric: true }));
  }

  const seen = new Map<string, Row>();

  for (const week of weekList) {
    for (const row of week.rows) {
      if (!seen.has(row.id)) {
        seen.set(row.id, row);
      }
    }
  }

  const distinct = [...seen.values()];
  const starting = distinct.filter((row) => !row.started);
  const holdRows: Sheet["holds"] = [];

  for (const row of distinct) {
    for (const hold of openHolds.get(row.id) ?? []) {
      holdRows.push({ ...hold, code: row.code, name: row.name });
    }
  }

  holdRows.sort((a, b) => Number(b.overdue) - Number(a.overdue) || (Number.isFinite(a.due) ? a.due : Infinity) - (Number.isFinite(b.due) ? b.due : Infinity) || a.code.localeCompare(b.code, undefined, { numeric: true }));

  const trades: Trade[] = [...tradeMap.entries()]
    .map(([name, slot]) => ({ name, activities: slot.activities.size, starting: slot.starting.size, notReady: slot.notReady.size, holds: slot.holds }))
    .sort((a, b) => Number(a.name === NO_DISCIPLINE) - Number(b.name === NO_DISCIPLINE) || b.activities - a.activities || a.name.localeCompare(b.name));

  const dataDate = readiness.ok ? readiness.readiness.dataDate : null;

  return {
    ok: true,
    sheet: {
      discipline,
      from: today,
      to,
      weeks: weekList,
      trades,
      activities: distinct.length,
      starting: starting.length,
      ready: starting.filter((row) => row.kind === "ready").length,
      notReady: starting.filter((row) => row.kind !== "ready").length,
      lateStarts: starting.filter((row) => row.phase === "lateStart").length,
      overruns: distinct.filter((row) => row.phase === "overrun").length,
      critical: distinct.filter((row) => row.critical).length,
      holds: holdRows,
      holdsOverdue: holdRows.filter((hold) => hold.overdue).length,
      dataDate,
      staleDays: dataDate === null ? 0 : Math.max(0, today - dataDate),
      linkCount: (data.dependencies ?? []).length,
      skipped,
    },
  };
}

export function floatText(row: Row): string | null {
  if (row.float === null) {
    return null;
  }

  return row.float <= 0 ? "no float" : `${row.float} d float`;
}

export function daysLateText(row: Row): string | null {
  if (row.daysLate <= 0) {
    return null;
  }

  return row.phase === "overrun" ? `${row.daysLate} ${plural(row.daysLate, "day", "days")} past its finish date` : `${row.daysLate} ${plural(row.daysLate, "day", "days")} past its planned start`;
}

export function readyLabel(row: Row): string | null {
  return row.kind === null ? null : kindLabel(row.kind);
}

export function tradeTitle(sheet: Sheet): string {
  return sheet.discipline === null ? "All trades" : sheet.discipline;
}

export function notesOf(row: Row): string[] {
  const lines = [...row.blockers, ...row.holds.map(holdText)];

  return lines;
}

export function sheetMarkdown(sheet: Sheet, projectName: string, today: number, committed: ReadonlySet<string>): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Trade sheet: ${projectName}, ${tradeTitle(sheet)}`, "");
  lines.push(`Prepared ${formatDay(today)} for ${formatDay(sheet.from)} to ${formatDay(sheet.to)}. Work that is not yet finished and is planned, or already under way, in these weeks.`, "");
  lines.push(`- ${sheet.activities} ${plural(sheet.activities, "activity", "activities")} on the sheet, ${sheet.starting} yet to start (${sheet.ready} ready, ${sheet.notReady} not ready)`);
  lines.push(`- ${sheet.lateStarts} should have started already, ${sheet.overruns} ${plural(sheet.overruns, "is", "are")} past ${plural(sheet.overruns, "its", "their")} finish date`);
  lines.push(`- ${sheet.holds.length} open ${plural(sheet.holds.length, "constraint", "constraints")}${sheet.holdsOverdue > 0 ? `, ${sheet.holdsOverdue} overdue` : ""}`, "");

  for (const week of sheet.weeks) {
    lines.push(`## Week of ${weekRange(week.start, week.end)}${week.current ? " (this week)" : ""}`, "");

    if (week.rows.length === 0) {
      lines.push("Nothing planned.", "");
      continue;
    }

    lines.push(`| Plan | Activity | ${sheet.discipline === null ? "Trade | " : ""}Planned | Done | Stage | Notes |`);
    lines.push(`| :---: | --- | ${sheet.discipline === null ? "--- | " : ""}--- | ---: | --- | --- |`);

    for (const row of week.rows) {
      const stage = [PHASE_LABEL[row.phase], readyLabel(row), row.critical ? "critical" : null].filter(Boolean).join(", ");
      const notes = notesOf(row);

      lines.push(`| ${committed.has(row.key) ? "[x]" : "[ ]"} | ${cell(row.code)} ${cell(trunc(row.name, 50))} | ${sheet.discipline === null ? `${cell(row.discipline)} | ` : ""}${shortDay(row.start)} to ${shortDay(row.finish)} | ${row.progress}% | ${stage} | ${cell(notes.length === 0 ? "" : notes.join("; "))} |`);
    }

    lines.push("");
  }

  if (sheet.holds.length > 0) {
    lines.push("## Open constraints", "");

    for (const hold of sheet.holds.slice(0, 30)) {
      lines.push(`- ${hold.code} ${trunc(hold.name, 40)}: ${holdText(hold)}`);
    }

    lines.push("");
  }

  lines.push(
    "Weeks run Monday to Sunday. An activity is listed in every week it is planned or under way, starting from this week. Ready means nothing recorded stops it starting: its finish-to-start predecessors are finished, its start-to-start predecessors have started, any lag has run out and it has no open constraint. This reflects what the schedule records, not what is happening on site.",
    "",
  );

  if (sheet.staleDays > STALE_DAYS) {
    lines.push(`The schedule was last updated on ${formatDay(today - sheet.staleDays)}, so work that has started since may still show as not started.`, "");
  }

  return lines.join("\n");
}
