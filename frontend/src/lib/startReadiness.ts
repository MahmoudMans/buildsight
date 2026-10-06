import { formatDay, plural, toDay, trunc, words } from "@/lib/openItems";
import type { ScheduleActivity, ScheduleConstraintType, ScheduleControl } from "@/types/project";

export const HORIZONS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 14, label: "2 weeks" },
  { days: 28, label: "4 weeks" },
  { days: 42, label: "6 weeks" },
];

export const DEFAULT_HORIZON = 28;
export const ROLL_LIMIT = 6;
export const STALE_DAYS = 7;

export type Kind = "ready" | "predecessors" | "constraints" | "both" | "hold";
export type Filter = "all" | "notReady" | "ready" | "late";
export type SortKey = "attention" | "start";

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "Everything" },
  { key: "notReady", label: "Not ready" },
  { key: "late", label: "Should have started" },
  { key: "ready", label: "Ready" },
];

export const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "attention", label: "Needs attention" },
  { key: "start", label: "Start date" },
];

export type BlockerKind = "unfinished" | "unstarted" | "lag";

export interface Blocker {
  id: string;
  code: string;
  name: string;
  type: "FS" | "SS";
  lag: number;
  kind: BlockerKind;
  status: ScheduleActivity["status"];
  progress: number;
  release: number;
  late: boolean;
  afterStart: boolean;
}

export interface Hold {
  id: string;
  type: ScheduleConstraintType;
  title: string;
  owner: string | null;
  due: number;
  overdue: boolean;
}

export interface Entry {
  id: string;
  code: string;
  name: string;
  discipline: string | null;
  start: number;
  finish: number;
  duration: number;
  status: ScheduleActivity["status"];
  toStart: number;
  late: boolean;
  blockers: Blocker[];
  holds: Hold[];
  kind: Kind;
  critical: boolean;
  nearCritical: boolean;
  float: number | null;
}

export interface BlockerRoll {
  id: string;
  code: string;
  name: string;
  status: ScheduleActivity["status"];
  progress: number;
  release: number;
  late: boolean;
  holds: Array<{ code: string; name: string }>;
}

export interface OwnerRoll {
  owner: string;
  count: number;
  overdue: number;
  earliest: number;
  activities: string[];
}

export interface Counts {
  total: number;
  ready: number;
  notReady: number;
  late: number;
  lateNotReady: number;
  soon: number;
  onHold: number;
  predecessors: number;
  constraints: number;
  both: number;
}

export interface Readiness {
  entries: Entry[];
  horizonDays: number;
  counts: Counts;
  blockers: BlockerRoll[];
  owners: OwnerRoll[];
  dataDate: number | null;
  staleDays: number;
  linkCount: number;
  skipped: number;
}

export type ReadinessResult = { ok: true; readiness: Readiness } | { ok: false; reason: "empty" | "invalid" };

function dayOrNull(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

function isStarted(activity: ScheduleActivity): boolean {
  return activity.status === "IN_PROGRESS" || activity.status === "COMPLETED" || Boolean(activity.actualStart);
}

function isDone(activity: ScheduleActivity): boolean {
  return activity.status === "COMPLETED" || Boolean(activity.actualFinish);
}

export function buildReadiness(data: ScheduleControl, today: number, horizonDays: number): ReadinessResult {
  const activities = data.activities ?? [];

  if (activities.length === 0) {
    return { ok: false, reason: "empty" };
  }

  if (!activities.some((item) => Number.isFinite(toDay(item.currentStart)) && Number.isFinite(toDay(item.currentFinish)))) {
    return { ok: false, reason: "invalid" };
  }

  const byId = new Map<string, ScheduleActivity>(activities.map((item) => [item.id, item]));
  const incoming = new Map<string, Array<{ from: string; type: string; lag: number }>>();

  for (const link of data.dependencies ?? []) {
    if (link.dependencyType !== "FS" && link.dependencyType !== "SS") {
      continue;
    }

    const list = incoming.get(link.successorActivityId);
    const entry = { from: link.predecessorActivityId, type: link.dependencyType, lag: Number.isFinite(link.lagDays) ? link.lagDays : 0 };

    if (list) {
      list.push(entry);
    } else {
      incoming.set(link.successorActivityId, [entry]);
    }
  }

  const openHolds = new Map<string, Hold[]>();

  for (const item of data.constraints ?? []) {
    if (item.status !== "OPEN") {
      continue;
    }

    const due = toDay(item.dueDate);
    const list = openHolds.get(item.activityId) ?? [];

    list.push({ id: item.id, type: item.constraintType, title: item.title, owner: (item.ownerName ?? "").trim() === "" ? null : (item.ownerName as string).trim(), due, overdue: Number.isFinite(due) && due < today });
    openHolds.set(item.activityId, list);
  }

  const entries: Entry[] = [];
  let skipped = 0;

  for (const activity of activities) {
    const notStarted = !isStarted(activity) && (activity.status === "NOT_STARTED" || activity.status === "ON_HOLD");

    if (!notStarted) {
      continue;
    }

    const start = toDay(activity.currentStart);
    const finish = toDay(activity.currentFinish);

    if (!Number.isFinite(start) || !Number.isFinite(finish)) {
      skipped += 1;
      continue;
    }

    if (start > today + horizonDays) {
      continue;
    }

    const blockers: Blocker[] = [];

    for (const link of incoming.get(activity.id) ?? []) {
      const pred = byId.get(link.from);

      if (!pred || pred.id === activity.id) {
        continue;
      }

      const type = link.type === "SS" ? "SS" : "FS";
      const base = { id: pred.id, code: pred.activityCode, name: pred.name, type, lag: link.lag, status: pred.status, progress: Number.isFinite(pred.progressPercentage) ? pred.progressPercentage : 0 } as const;
      const predStart = toDay(pred.currentStart);
      const predFinish = toDay(pred.currentFinish);

      if (type === "FS") {
        if (isDone(pred)) {
          const doneDay = dayOrNull(pred.actualFinish) ?? predFinish;
          const ready = Number.isFinite(doneDay) ? doneDay + link.lag : NaN;

          if (link.lag > 0 && Number.isFinite(ready) && ready > today) {
            blockers.push({ ...base, kind: "lag", release: ready, late: false, afterStart: false });
          }

          continue;
        }

        const release = Number.isFinite(predFinish) ? predFinish + link.lag : NaN;

        blockers.push({ ...base, kind: "unfinished", release, late: Number.isFinite(release) && release < today, afterStart: Number.isFinite(release) && release >= start });
      } else {
        if (isStarted(pred)) {
          const startedDay = dayOrNull(pred.actualStart) ?? predStart;
          const ready = Number.isFinite(startedDay) ? startedDay + link.lag : NaN;

          if (link.lag > 0 && Number.isFinite(ready) && ready > today) {
            blockers.push({ ...base, kind: "lag", release: ready, late: false, afterStart: false });
          }

          continue;
        }

        const release = Number.isFinite(predStart) ? predStart + link.lag : NaN;

        blockers.push({ ...base, kind: "unstarted", release, late: Number.isFinite(release) && release < today, afterStart: Number.isFinite(release) && release >= start });
      }
    }

    blockers.sort((a, b) => (Number.isFinite(a.release) ? a.release : Infinity) - (Number.isFinite(b.release) ? b.release : Infinity) || a.code.localeCompare(b.code, undefined, { numeric: true }));

    const holds = (openHolds.get(activity.id) ?? []).sort((a, b) => (Number.isFinite(a.due) ? a.due : Infinity) - (Number.isFinite(b.due) ? b.due : Infinity));
    const hold = activity.status === "ON_HOLD";
    const kind: Kind = hold ? "hold" : blockers.length > 0 && holds.length > 0 ? "both" : blockers.length > 0 ? "predecessors" : holds.length > 0 ? "constraints" : "ready";
    const float = Number(activity.totalFloatDays);

    entries.push({
      id: activity.id,
      code: activity.activityCode,
      name: activity.name,
      discipline: (activity.discipline ?? "").trim() === "" ? null : (activity.discipline as string).trim(),
      start,
      finish,
      duration: Number.isFinite(activity.originalDurationDays) ? activity.originalDurationDays : Math.max(1, finish - start + 1),
      status: activity.status,
      toStart: start - today,
      late: start < today,
      blockers,
      holds,
      kind,
      critical: activity.critical === true,
      nearCritical: activity.nearCritical === true,
      float: Number.isFinite(float) ? float : null,
    });
  }

  const blockerMap = new Map<string, BlockerRoll>();
  const ownerMap = new Map<string, OwnerRoll>();

  for (const entry of entries) {
    if (entry.kind === "hold") {
      continue;
    }

    for (const blocker of entry.blockers) {
      if (blocker.kind === "lag") {
        continue;
      }

      const found = blockerMap.get(blocker.id);

      if (found) {
        found.holds.push({ code: entry.code, name: entry.name });
      } else {
        blockerMap.set(blocker.id, { id: blocker.id, code: blocker.code, name: blocker.name, status: blocker.status, progress: blocker.progress, release: blocker.release, late: blocker.late, holds: [{ code: entry.code, name: entry.name }] });
      }
    }

    for (const hold of entry.holds) {
      const owner = hold.owner ?? "No owner";
      const found = ownerMap.get(owner.toLowerCase());

      if (found) {
        found.count += 1;
        found.overdue += hold.overdue ? 1 : 0;
        found.earliest = Math.min(found.earliest, Number.isFinite(hold.due) ? hold.due : Infinity);
        found.activities.push(entry.code);
      } else {
        ownerMap.set(owner.toLowerCase(), { owner, count: 1, overdue: hold.overdue ? 1 : 0, earliest: Number.isFinite(hold.due) ? hold.due : Infinity, activities: [entry.code] });
      }
    }
  }

  const counts: Counts = {
    total: entries.length,
    ready: entries.filter((entry) => entry.kind === "ready").length,
    notReady: entries.filter((entry) => entry.kind !== "ready").length,
    late: entries.filter((entry) => entry.late).length,
    lateNotReady: entries.filter((entry) => entry.late && entry.kind !== "ready").length,
    soon: entries.filter((entry) => !entry.late).length,
    onHold: entries.filter((entry) => entry.kind === "hold").length,
    predecessors: entries.filter((entry) => entry.kind === "predecessors").length,
    constraints: entries.filter((entry) => entry.kind === "constraints").length,
    both: entries.filter((entry) => entry.kind === "both").length,
  };

  const dataDate = dayOrNull(data.intelligence?.dataDate);

  return {
    ok: true,
    readiness: {
      entries: sortEntries(entries, "attention"),
      horizonDays,
      counts,
      blockers: [...blockerMap.values()].sort((a, b) => b.holds.length - a.holds.length || Number(b.late) - Number(a.late) || a.release - b.release || a.code.localeCompare(b.code, undefined, { numeric: true })),
      owners: [...ownerMap.values()].sort((a, b) => b.overdue - a.overdue || b.count - a.count || a.earliest - b.earliest || a.owner.localeCompare(b.owner)),
      dataDate,
      staleDays: dataDate === null ? 0 : Math.max(0, today - dataDate),
      linkCount: (data.dependencies ?? []).length,
      skipped,
    },
  };
}

function rank(entry: Entry): number {
  const open = entry.kind !== "ready" && entry.kind !== "hold";

  if (entry.kind === "hold") {
    return entry.late ? 2 : 3;
  }

  return entry.late ? (open ? 0 : 2) : open ? 3 : 4;
}

export function sortEntries(entries: Entry[], key: SortKey): Entry[] {
  const list = [...entries];
  const byCode = (a: Entry, b: Entry) => a.code.localeCompare(b.code, undefined, { numeric: true });

  if (key === "start") {
    return list.sort((a, b) => a.start - b.start || byCode(a, b));
  }

  return list.sort((a, b) => rank(a) - rank(b) || a.start - b.start || Number(b.critical) - Number(a.critical) || byCode(a, b));
}

export function filterEntries(entries: Entry[], filter: Filter): Entry[] {
  if (filter === "notReady") {
    return entries.filter((entry) => entry.kind !== "ready");
  }

  if (filter === "ready") {
    return entries.filter((entry) => entry.kind === "ready");
  }

  if (filter === "late") {
    return entries.filter((entry) => entry.late);
  }

  return entries;
}

export function kindLabel(kind: Kind): string {
  return kind === "ready" ? "Ready" : kind === "hold" ? "On hold" : kind === "predecessors" ? "Waiting on work" : kind === "constraints" ? "Held by constraints" : "Work and constraints";
}

export function startText(entry: Entry): string {
  if (entry.toStart < 0) {
    return `${-entry.toStart} ${plural(-entry.toStart, "day", "days")} past its planned start`;
  }

  if (entry.toStart === 0) {
    return "Starts today";
  }

  return entry.toStart === 1 ? "Starts tomorrow" : `Starts in ${entry.toStart} days`;
}

export function blockerText(blocker: Blocker): string {
  const when = Number.isFinite(blocker.release) ? formatDay(blocker.release) : "no date";

  if (blocker.kind === "lag") {
    return `${blocker.code} ${trunc(blocker.name, 40)} is ${blocker.type === "FS" ? "finished" : "started"}, but a ${blocker.lag}-day lag runs until ${when}`;
  }

  if (blocker.kind === "unstarted") {
    return `${blocker.code} ${trunc(blocker.name, 40)} has to start first (${blocker.progress}% done), ${blocker.late ? `it should have started by ${when}` : `due to start ${when}`}`;
  }

  return `${blocker.code} ${trunc(blocker.name, 40)} must finish first (${blocker.progress}% done), due ${when}${blocker.late ? ", already late" : ""}`;
}

export function holdText(hold: Hold): string {
  return `${words(hold.type)}: ${trunc(hold.title, 56)}${hold.owner ? `, ${hold.owner}` : ", no owner"}, due ${Number.isFinite(hold.due) ? formatDay(hold.due) : "no date"}${hold.overdue ? " (overdue)" : ""}`;
}

export function readinessMarkdown(readiness: Readiness, entries: Entry[], projectName: string, today: number): string {
  const lines: string[] = [];
  const { counts } = readiness;

  lines.push(`# Start readiness: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Activities not yet started that are planned to start within the next ${readiness.horizonDays} days, or should already have started.`, "");
  lines.push(
    `- Activities: ${counts.total} (${counts.late} should have started, ${counts.soon} starting soon)`,
    `- Ready to start: ${counts.ready}`,
    `- Not ready: ${counts.notReady} (${counts.predecessors} waiting on earlier work, ${counts.constraints} held by constraints, ${counts.both} both, ${counts.onHold} on hold)`,
    "",
  );

  if (entries.length > 0) {
    lines.push("| Activity | Planned start | Status | Why |");
    lines.push("| --- | --- | --- | --- |");

    const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

    for (const entry of entries.slice(0, 60)) {
      const why = [...entry.blockers.map(blockerText), ...entry.holds.map(holdText)];

      lines.push(`| ${cell(entry.code)} ${cell(trunc(entry.name, 50))} | ${formatDay(entry.start)} | ${kindLabel(entry.kind)}${entry.late ? ", late" : ""} | ${cell(why.length === 0 ? (entry.kind === "ready" ? "Nothing recorded stops it starting" : "Marked on hold") : why.join("; "))} |`);
    }

    if (entries.length > 60) {
      lines.push("", `${entries.length - 60} more not shown.`);
    }

    lines.push("");
  }

  if (readiness.blockers.length > 0) {
    lines.push("## Work holding up the most starts", "");

    for (const blocker of readiness.blockers.slice(0, ROLL_LIMIT)) {
      lines.push(`- ${blocker.code} ${trunc(blocker.name, 50)} (${blocker.progress}% done, ${blocker.late ? "late" : `due ${formatDay(blocker.release)}`}) holds ${blocker.holds.length} ${plural(blocker.holds.length, "start", "starts")}: ${blocker.holds.slice(0, 4).map((hold) => hold.code).join(", ")}`);
    }

    lines.push("");
  }

  if (readiness.owners.length > 0) {
    lines.push("## Open constraints by owner", "");

    for (const owner of readiness.owners.slice(0, ROLL_LIMIT)) {
      lines.push(`- ${owner.owner}: ${owner.count} ${plural(owner.count, "constraint", "constraints")}${owner.overdue > 0 ? `, ${owner.overdue} overdue` : ""} (${owner.activities.slice(0, 4).join(", ")})`);
    }

    lines.push("");
  }

  lines.push(
    "An activity is ready when nothing recorded stops it starting: every finish-to-start predecessor is finished, every start-to-start predecessor has started, any lag has run out and it has no open constraint. Finish-to-finish and start-to-finish links do not hold up a start and are ignored. This reflects what the schedule records, not what is happening on site.",
    "",
  );

  if (readiness.linkCount === 0) {
    lines.push("The schedule has no links between activities, so readiness only reflects open constraints.", "");
  }

  if (readiness.staleDays > STALE_DAYS) {
    lines.push(`The schedule was last updated on ${formatDay(today - readiness.staleDays)}, so work that has started since may still show as not started.`, "");
  }

  return lines.join("\n");
}
