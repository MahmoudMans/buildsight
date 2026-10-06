import { DAY_MS, formatDay, plural, toDay } from "@/lib/openItems";
import type { ScheduleActivity, ScheduleControl, ScheduleDependencyType } from "@/types/project";

export type SlipMode = "longer" | "later";

export const MAX_SLIP = 60;
export const MAX_DAYS = 365;
export const DEFAULT_SLIP = 5;
export const SHIFT_LIMIT = 12;
export const QUICK_PICKS = 8;
const SEARCH_LIMIT = 365;
const PICK_POOL = 40;
const EPS = 1e-6;

interface Link {
  other: number;
  type: ScheduleDependencyType;
  lag: number;
}

interface Network {
  activities: ScheduleActivity[];
  count: number;
  preds: Link[][];
  succs: Link[][];
  order: number[];
  done: boolean[];
  started: boolean[];
  nominal: number[];
  earliest: number[];
  dataDay: number;
  position: Map<string, number>;
}

interface Extra {
  index: number;
  longer: number;
  later: number;
}

interface Pass {
  start: Float64Array;
  finish: Float64Array;
  driver: Int32Array;
  end: number;
  last: number;
}

export interface Prepared {
  net: Network;
  base: Pass;
  live: number[];
  picks: number[];
  slack: Float64Array;
}

export type PrepareResult = { ok: true; prepared: Prepared } | { ok: false; reason: "empty" | "invalid" | "no-links" | "cycle" | "complete"; detail: string | null };

export interface Waiting {
  id: string;
  code: string;
  name: string;
  type: ScheduleDependencyType;
  lag: number;
  finish: number;
  spare: number | null;
  driving: boolean;
}

export interface ChainStep {
  id: string;
  code: string;
  name: string;
  start: number;
  finish: number;
  type: ScheduleDependencyType | null;
  lag: number;
}

export interface Shift {
  id: string;
  code: string;
  name: string;
  before: number;
  after: number;
  delta: number;
  floatBefore: number;
  floatAfter: number;
  nowCritical: boolean;
  target: boolean;
}

export interface Explored {
  target: ScheduleActivity;
  started: boolean;
  remaining: number;
  slack: number;
  targetStart: number;
  targetFinish: number;
  days: number;
  mode: SlipMode;
  finishBefore: number;
  finishAfter: number;
  delta: number;
  moved: Shift[];
  movedCount: number;
  downstream: number;
  nowCritical: number;
  waiting: Waiting[];
  held: boolean;
  chain: ChainStep[];
  tolerance: number | null;
  toleranceCapped: boolean;
  holds: Waiting[];
}

export function prepare(data: ScheduleControl): PrepareResult {
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
  const succs: Link[][] = Array.from({ length: count }, () => []);
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

    const lag = Number.isFinite(dependency.lagDays) ? dependency.lagDays : 0;

    preds[to]?.push({ other: from, type: dependency.dependencyType, lag });
    succs[from]?.push({ other: to, type: dependency.dependencyType, lag });
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
      indegree[next.other] = (indegree[next.other] ?? 0) - 1;

      if (indegree[next.other] === 0) {
        queue.push(next.other);
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

  const live = activities.map((_, index) => index).filter((index) => !done[index]);

  if (live.length === 0) {
    return { ok: false, reason: "complete", detail: null };
  }

  const net: Network = { activities, count, preds, succs, order, done, started, nominal, earliest, dataDay, position };
  const base = run(net, null);
  const slack = floats(net, base);

  const shortlist = [...live].sort((a, b) => (slack[a] ?? 0) - (slack[b] ?? 0) || (base.finish[a] ?? 0) - (base.finish[b] ?? 0)).slice(0, PICK_POOL);
  const reach = new Map<number, number>(shortlist.map((index) => [index, reachable(net, index)]));

  const picks = shortlist.sort((a, b) => {
    const gap = Math.round(((slack[a] ?? 0) - (slack[b] ?? 0)) * 10);

    if (gap !== 0) {
      return gap;
    }

    return (reach.get(b) ?? 0) - (reach.get(a) ?? 0) || (base.finish[a] ?? 0) - (base.finish[b] ?? 0);
  });

  return { ok: true, prepared: { net, base, live, picks, slack } };
}

function candidate(type: ScheduleDependencyType, lag: number, length: number, predStart: number, predFinish: number): number {
  return type === "SS" ? predStart + lag : type === "FF" ? predFinish + lag - length : type === "SF" ? predStart + lag - length : predFinish + lag;
}

function run(net: Network, extra: Extra | null): Pass {
  const { count, order, preds, done, started, nominal, earliest } = net;
  const start = new Float64Array(count);
  const finish = new Float64Array(count);
  const driver = new Int32Array(count).fill(-1);
  let last = -1;
  let end = -Infinity;

  for (const index of order) {
    if (done[index]) {
      continue;
    }

    const hit = extra !== null && extra.index === index;
    const length = (nominal[index] ?? 0) + (hit ? extra.longer : 0);
    let begin = earliest[index] ?? 0;
    let by = -1;

    if (!started[index]) {
      for (const link of preds[index] ?? []) {
        const value = candidate(link.type, link.lag, length, start[link.other] ?? 0, finish[link.other] ?? 0);

        if (value > begin) {
          begin = value;
          by = link.other;
        }
      }

      if (hit) {
        begin += extra.later;
      }
    }

    start[index] = begin;
    finish[index] = begin + length;
    driver[index] = by;

    if (finish[index] > end) {
      end = finish[index] as number;
      last = index;
    }
  }

  return { start, finish, driver, end: Number.isFinite(end) ? end : 0, last };
}

function floats(net: Network, pass: Pass): Float64Array {
  const { count, order, succs, done, started, nominal } = net;
  const lateFinish = new Float64Array(count).fill(pass.end);
  const slack = new Float64Array(count);

  for (let step = order.length - 1; step >= 0; step -= 1) {
    const index = order[step] as number;

    if (done[index]) {
      continue;
    }

    let limit = pass.end;
    const own = nominal[index] ?? 0;

    for (const link of succs[index] ?? []) {
      const next = link.other;

      if (done[next] || started[next]) {
        continue;
      }

      const nextLength = nominal[next] ?? 0;
      const nextFinish = lateFinish[next] ?? pass.end;
      const nextStart = nextFinish - nextLength;
      const bound =
        link.type === "SS" ? nextStart - link.lag + own : link.type === "FF" ? nextFinish - link.lag : link.type === "SF" ? nextFinish - link.lag + own : nextStart - link.lag;

      if (bound < limit) {
        limit = bound;
      }
    }

    lateFinish[index] = limit;
    slack[index] = Math.round((limit - (pass.finish[index] ?? 0)) * 10) / 10;
  }

  return slack;
}

function reachable(net: Network, from: number): number {
  const seen = new Set<number>();
  const stack = [from];

  while (stack.length > 0) {
    const current = stack.pop() as number;

    for (const link of net.succs[current] ?? []) {
      if (!seen.has(link.other) && !net.done[link.other]) {
        seen.add(link.other);
        stack.push(link.other);
      }
    }
  }

  return seen.size;
}

export function activityOptions(prepared: Prepared): Array<{ id: string; code: string; name: string; started: boolean }> {
  const { net } = prepared;

  return prepared.live
    .map((index) => net.activities[index] as ScheduleActivity)
    .map((item) => ({ id: item.id, code: item.activityCode, name: item.name, started: net.started[net.position.get(item.id) ?? 0] === true }))
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
}

export function quickPicks(prepared: Prepared): Array<{ id: string; code: string; name: string; float: number }> {
  const { net } = prepared;

  return prepared.picks.slice(0, QUICK_PICKS).map((index) => {
    const item = net.activities[index] as ScheduleActivity;

    return { id: item.id, code: item.activityCode, name: item.name, float: prepared.slack[index] ?? 0 };
  });
}

export function defaultActivity(prepared: Prepared): string {
  const first = prepared.picks[0];

  return first === undefined ? "" : (prepared.net.activities[first] as ScheduleActivity).id;
}

function day(net: Network, offset: number): number {
  return net.dataDay + Math.round(offset);
}

function relation(net: Network, pass: Pass, index: number, link: Link, outgoing: boolean): { spare: number | null; driving: boolean } {
  const target = outgoing ? link.other : index;
  const source = outgoing ? index : link.other;

  if (net.started[target] || net.done[target] || net.done[source]) {
    return { spare: null, driving: false };
  }

  const length = (net.nominal[target] ?? 0);
  const value = candidate(link.type, link.lag, length, pass.start[source] ?? 0, pass.finish[source] ?? 0);
  const spare = Math.max(0, (pass.start[target] ?? 0) - value);

  return { spare, driving: spare < EPS };
}

export function explore(prepared: Prepared, id: string, days: number, mode: SlipMode): Explored | null {
  const { net, base } = prepared;
  const index = net.position.get(id);

  if (index === undefined || net.done[index]) {
    return null;
  }

  const target = net.activities[index] as ScheduleActivity;
  const effective: SlipMode = mode === "later" && net.started[index] ? "longer" : mode;
  const amount = Math.max(0, days);
  const make = (value: number): Extra => ({ index, longer: effective === "longer" ? value : 0, later: effective === "later" ? value : 0 });
  const after = run(net, make(amount));
  const moved: Shift[] = [];
  const pushed = Math.max(0, after.end - base.end);
  let nowCritical = 0;

  for (const other of prepared.live) {
    const item = net.activities[other] as ScheduleActivity;
    const delta = (after.finish[other] ?? 0) - (base.finish[other] ?? 0);

    if (delta < EPS) {
      continue;
    }

    const floatBefore = prepared.slack[other] ?? 0;
    const floatAfter = Math.max(0, Math.round((floatBefore + pushed - delta) * 10) / 10);
    const critical = floatBefore > EPS && floatAfter <= EPS;

    if (critical) {
      nowCritical += 1;
    }

    moved.push({
      id: item.id,
      code: item.activityCode,
      name: item.name,
      before: day(net, base.finish[other] ?? 0),
      after: day(net, after.finish[other] ?? 0),
      delta: Math.round(delta * 10) / 10,
      floatBefore,
      floatAfter,
      nowCritical: critical,
      target: other === index,
    });
  }

  moved.sort((a, b) => Number(b.target) - Number(a.target) || b.delta - a.delta || a.before - b.before);

  const gap = (value: number) => run(net, make(value)).end - base.end;
  let tolerance: number | null = null;
  let capped = false;

  if (gap(SEARCH_LIMIT) < EPS) {
    capped = true;
  } else {
    let low = 0;
    let high = SEARCH_LIMIT;

    while (high - low > 1) {
      const middle = Math.floor((low + high) / 2);

      if (gap(middle) < EPS) {
        low = middle;
      } else {
        high = middle;
      }
    }

    tolerance = low;
  }

  const waiting: Waiting[] = [];

  for (const link of net.preds[index] ?? []) {
    const item = net.activities[link.other] as ScheduleActivity;
    const rel = relation(net, base, index, link, false);

    waiting.push({
      id: item.id,
      code: item.activityCode,
      name: item.name,
      type: link.type,
      lag: link.lag,
      finish: day(net, base.finish[link.other] ?? 0),
      spare: rel.spare,
      driving: rel.driving,
    });
  }

  waiting.sort((a, b) => Number(b.driving) - Number(a.driving) || (a.spare ?? 999) - (b.spare ?? 999) || a.code.localeCompare(b.code, undefined, { numeric: true }));

  const holds: Waiting[] = [];

  for (const link of net.succs[index] ?? []) {
    const item = net.activities[link.other] as ScheduleActivity;

    if (net.done[link.other]) {
      continue;
    }

    const rel = relation(net, base, index, link, true);

    holds.push({
      id: item.id,
      code: item.activityCode,
      name: item.name,
      type: link.type,
      lag: link.lag,
      finish: day(net, base.finish[link.other] ?? 0),
      spare: rel.spare,
      driving: rel.driving,
    });
  }

  holds.sort((a, b) => Number(b.driving) - Number(a.driving) || (a.spare ?? 999) - (b.spare ?? 999) || a.code.localeCompare(b.code, undefined, { numeric: true }));

  const chain: ChainStep[] = [];
  const guard = new Set<number>();
  let cursor = index;
  let through: Link | null = null;

  while (cursor >= 0 && !guard.has(cursor)) {
    guard.add(cursor);

    const item = net.activities[cursor] as ScheduleActivity;

    chain.push({
      id: item.id,
      code: item.activityCode,
      name: item.name,
      start: day(net, base.start[cursor] ?? 0),
      finish: day(net, base.finish[cursor] ?? 0),
      type: through ? through.type : null,
      lag: through ? through.lag : 0,
    });

    const by = base.driver[cursor] ?? -1;

    through = by >= 0 ? ((net.preds[cursor] ?? []).find((link) => link.other === by) ?? null) : null;
    cursor = by;
  }

  chain.reverse();

  const held = (base.driver[index] ?? -1) < 0 && !net.started[index] && (net.earliest[index] ?? 0) > 0;

  return {
    target,
    started: net.started[index] === true,
    remaining: net.nominal[index] ?? 0,
    slack: prepared.slack[index] ?? 0,
    targetStart: day(net, base.start[index] ?? 0),
    targetFinish: day(net, base.finish[index] ?? 0),
    days: amount,
    mode: effective,
    finishBefore: day(net, base.end),
    finishAfter: day(net, after.end),
    delta: Math.round((after.end - base.end) * 10) / 10,
    moved,
    movedCount: moved.length,
    downstream: reachable(net, index),
    nowCritical,
    waiting,
    held,
    chain,
    tolerance,
    toleranceCapped: capped,
    holds,
  };
}

export function toleranceText(result: Explored): string {
  const later = result.mode === "later";

  if (result.toleranceCapped) {
    return later ? "It can start a year late without moving the finish." : "It can run a year long without moving the finish.";
  }

  const room = result.tolerance ?? 0;

  if (room === 0) {
    return later ? "It has no room: any delay to its start moves the finish." : "It has no room: any overrun moves the finish.";
  }

  return later
    ? `The finish holds if it starts up to ${room} ${plural(room, "day", "days")} late.`
    : `The finish holds if it overruns by up to ${room} ${plural(room, "day", "days")}.`;
}

export function slipMarkdown(result: Explored, projectName: string, today: number): string {
  const lines: string[] = [];
  const verb = result.mode === "later" ? "starts" : "takes";
  const tail = result.mode === "later" ? "later" : "longer";

  lines.push(`# Slip check: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. What if ${result.target.activityCode} ${result.target.name} ${verb} ${result.days} ${plural(result.days, "day", "days")} ${tail}?`, "");
  lines.push(
    result.delta > 0
      ? `- Project finish moves from ${formatDay(result.finishBefore)} to ${formatDay(result.finishAfter)} (${result.delta} ${plural(result.delta, "day", "days")} later).`
      : `- Project finish stays on ${formatDay(result.finishBefore)}: the slip is absorbed by float.`,
    `- ${result.movedCount} ${plural(result.movedCount, "activity moves", "activities move")}, ${result.nowCritical} ${plural(result.nowCritical, "runs", "run")} out of float.`,
    `- ${toleranceText(result)}`,
    "",
  );

  if (result.moved.length > 0) {
    lines.push("| Activity | Finish before | Finish after | Moves by | Float before | Float after |");
    lines.push("| --- | --- | --- | ---: | ---: | ---: |");

    for (const shift of result.moved.slice(0, SHIFT_LIMIT)) {
      lines.push(`| ${shift.code} ${shift.name.replace(/\|/g, "/")} | ${formatDay(shift.before)} | ${formatDay(shift.after)} | ${shift.delta} d | ${shift.floatBefore} d | ${shift.floatAfter} d |`);
    }

    if (result.moved.length > SHIFT_LIMIT) {
      lines.push("", `and ${result.moved.length - SHIFT_LIMIT} more.`);
    }

    lines.push("");
  }

  return lines.join("\n");
}

export function linkText(type: ScheduleDependencyType, lag: number): string {
  const base = type === "SS" ? "Start to start" : type === "FF" ? "Finish to finish" : type === "SF" ? "Start to finish" : "Finish to start";

  if (!Number.isFinite(lag) || lag === 0) {
    return base;
  }

  return `${base}, ${lag > 0 ? "+" : "−"}${Math.abs(lag)} ${plural(Math.abs(lag), "day", "days")}`;
}

export function failText(result: Extract<PrepareResult, { ok: false }>): string {
  switch (result.reason) {
    case "empty":
      return "The schedule has no activities yet, so there is nothing to test.";
    case "complete":
      return "Every activity is complete, so no slip can reach the finish date any more.";
    case "no-links":
      return "The activities have no logic links, so a slip cannot be followed through to the work that comes after it. Add predecessor links on the schedule page.";
    case "invalid":
      return result.detail ? `The schedule network is not valid: ${result.detail}.` : "The schedule network is not valid, so a slip cannot be traced through it.";
    default:
      return `The schedule logic contains a loop${result.detail ? ` (${result.detail})` : ""}. Remove the circular links to use the slip explorer.`;
  }
}

export function linkMap(prepared: Prepared): Map<string, { spare: number | null; driving: boolean }> {
  const { net, base } = prepared;
  const result = new Map<string, { spare: number | null; driving: boolean }>();

  for (let from = 0; from < net.count; from += 1) {
    for (const link of net.succs[from] ?? []) {
      result.set(`${from}>${link.other}>${link.type}`, relation(net, base, from, link, true));
    }
  }

  return result;
}

export function modelDay(prepared: Prepared, offset: number): number {
  return day(prepared.net, offset);
}
