import { DAY_MS, formatDay, plural, toDay } from "@/lib/openItems";
import type { ResourceControl } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
];

export const DEFAULT_WINDOW = 28;
export const LONG_DAY = 10;
export const VERY_LONG_DAY = 12;
export const RUN_WATCH = 7;
export const RUN_HIGH = 12;
export const RECENT = 7;
export const PAGE = 10;

export type Band = "none" | "normal" | "long" | "veryLong";
export type Status = "high" | "watch" | "earlier" | "ok" | "off";
export type Filter = "all" | "attention";

export const STATUS_LABEL: Record<Status, string> = {
  high: "High",
  watch: "Watch",
  earlier: "Earlier",
  ok: "Within limits",
  off: "Off site",
};

const STATUS_RANK: Record<Status, number> = { high: 0, watch: 1, earlier: 2, ok: 3, off: 4 };

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All trades" },
  { key: "attention", label: "Needs attention" },
];

export interface Cell {
  day: number;
  band: Band;
  hoursPer: number | null;
  hours: number;
  workers: number;
  runPos: number;
  weekend: boolean;
  monday: boolean;
}

export interface Run {
  trade: string;
  from: number;
  to: number;
  length: number;
  current: boolean;
  hours: number;
  workers: number;
}

export interface LongDay {
  trade: string;
  day: number;
  hoursPer: number;
  hours: number;
  workers: number;
  veryLong: boolean;
}

export interface Trade {
  name: string;
  status: Status;
  cells: Cell[];
  workDays: number;
  hours: number;
  workers: number;
  overtime: number;
  avgPer: number | null;
  overtimeShare: number | null;
  longDays: number;
  veryLongDays: number;
  currentRun: number;
  longestRun: number;
  longestFrom: number | null;
  longestTo: number | null;
  lastDay: number | null;
  recentLong: boolean;
  recentVeryLong: boolean;
}

export interface Fatigue {
  trades: Trade[];
  longDays: LongDay[];
  runs: Run[];
  from: number;
  to: number;
  windowDays: number;
  latest: number;
  onSite: number;
  attention: number;
  workDays: number;
  avgPer: number | null;
  longCount: number;
  veryLongCount: number;
  longestCurrent: { trade: string; length: number } | null;
  noHeadcount: number;
  skipped: number;
}

export type FatigueResult = { ok: true; fatigue: Fatigue } | { ok: false; reason: "empty" };

interface DayRecord {
  day: number;
  hours: number;
  workers: number;
  overtime: number;
}

function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function bandOf(hoursPer: number | null): Band {
  if (hoursPer === null) {
    return "normal";
  }

  return hoursPer > VERY_LONG_DAY ? "veryLong" : hoursPer > LONG_DAY ? "long" : "normal";
}

function weekday(day: number): number {
  return new Date(day * DAY_MS).getUTCDay();
}

export function buildFatigue(data: ResourceControl, today: number, windowDays: number): FatigueResult {
  const trades = new Map<string, { name: string; days: Map<number, DayRecord> }>();
  let skipped = 0;
  let noHeadcount = 0;
  let latest: number | null = null;

  for (const row of data.deployments ?? []) {
    const day = toDay(row.workDate);

    if (!Number.isFinite(day)) {
      skipped += 1;
      continue;
    }

    const hours = finite(row.totalLaborHours);

    if (hours <= 0 || day > today) {
      continue;
    }

    const name = (row.trade ?? "").trim() || "Unassigned";
    const key = name.toLowerCase();
    const entry = trades.get(key) ?? { name, days: new Map<number, DayRecord>() };
    const record = entry.days.get(day) ?? { day, hours: 0, workers: 0, overtime: 0 };

    record.hours += hours;
    record.workers += Math.max(0, finite(row.workers));
    record.overtime += Math.max(0, finite(row.overtimeHours));

    if (finite(row.workers) <= 0) {
      noHeadcount += 1;
    }

    entry.days.set(day, record);
    trades.set(key, entry);
    latest = latest === null || day > latest ? day : latest;
  }

  if (latest === null) {
    return { ok: false, reason: "empty" };
  }

  const to = latest;
  const from = to - windowDays + 1;
  const recentFrom = to - (RECENT - 1);
  const rows: Trade[] = [];
  const longDays: LongDay[] = [];
  const runs: Run[] = [];

  for (const { name, days } of trades.values()) {
    const sorted = [...days.values()].sort((a, b) => a.day - b.day);
    const position = new Map<number, number>();
    const tradeRuns: Run[] = [];
    let open: Run | null = null;

    for (const record of sorted) {
      if (open !== null && record.day === open.to + 1) {
        open.to = record.day;
        open.length += 1;
        open.hours += record.hours;
        open.workers += record.workers;
      } else {
        open = { trade: name, from: record.day, to: record.day, length: 1, current: false, hours: record.hours, workers: record.workers };
        tradeRuns.push(open);
      }

      position.set(record.day, open.length);
    }

    const lastDay = sorted[sorted.length - 1]?.day ?? null;
    const lastRun = tradeRuns[tradeRuns.length - 1];

    if (lastRun && lastDay !== null && lastDay >= to - 1) {
      lastRun.current = true;
    }

    const cells: Cell[] = [];
    let hoursSum = 0;
    let workersSum = 0;
    let overtime = 0;
    let workDays = 0;
    let long = 0;
    let veryLong = 0;
    let recentLong = false;
    let recentVeryLong = false;

    for (let day = from; day <= to; day += 1) {
      const record = days.get(day);
      const hoursPer = record && record.workers > 0 ? record.hours / record.workers : null;
      const band: Band = record ? bandOf(hoursPer) : "none";

      cells.push({
        day,
        band,
        hoursPer,
        hours: record?.hours ?? 0,
        workers: record?.workers ?? 0,
        runPos: record ? (position.get(day) ?? 0) : 0,
        weekend: weekday(day) === 0 || weekday(day) === 6,
        monday: weekday(day) === 1,
      });

      if (!record) {
        continue;
      }

      workDays += 1;
      hoursSum += record.workers > 0 ? record.hours : 0;
      workersSum += record.workers;
      overtime += record.workers > 0 ? record.overtime : 0;

      if (band === "long" || band === "veryLong") {
        long += 1;
        veryLong += band === "veryLong" ? 1 : 0;
        longDays.push({ trade: name, day, hoursPer: hoursPer as number, hours: record.hours, workers: record.workers, veryLong: band === "veryLong" });

        if (day >= recentFrom) {
          recentLong = true;
          recentVeryLong = recentVeryLong || band === "veryLong";
        }
      }
    }

    const inWindow = tradeRuns.filter((run) => run.to >= from);
    const longest = inWindow.reduce<Run | null>((best, run) => (best === null || run.length > best.length ? run : best), null);
    const current = tradeRuns.find((run) => run.current);
    const currentRun = current ? current.length : 0;

    for (const run of inWindow) {
      if (run.length >= RUN_WATCH) {
        runs.push(run);
      }
    }

    const off = lastDay === null || lastDay < recentFrom;
    const status: Status = off
      ? "off"
      : currentRun >= RUN_HIGH || recentVeryLong
        ? "high"
        : currentRun >= RUN_WATCH || recentLong
          ? "watch"
          : (longest?.length ?? 0) >= RUN_WATCH || long > 0
            ? "earlier"
            : "ok";

    rows.push({
      name,
      status,
      cells,
      workDays,
      hours: hoursSum,
      workers: workersSum,
      overtime,
      avgPer: workersSum > 0 ? hoursSum / workersSum : null,
      overtimeShare: hoursSum > 0 ? overtime / hoursSum : null,
      longDays: long,
      veryLongDays: veryLong,
      currentRun,
      longestRun: longest?.length ?? 0,
      longestFrom: longest?.from ?? null,
      longestTo: longest?.to ?? null,
      lastDay,
      recentLong,
      recentVeryLong,
    });
  }

  rows.sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.currentRun - a.currentRun || (b.avgPer ?? 0) - (a.avgPer ?? 0) || a.name.localeCompare(b.name, undefined, { numeric: true }));
  longDays.sort((a, b) => b.hoursPer - a.hoursPer || b.day - a.day || a.trade.localeCompare(b.trade));
  runs.sort((a, b) => Number(b.current) - Number(a.current) || b.length - a.length || a.trade.localeCompare(b.trade));

  const active = rows.filter((row) => row.status !== "off");
  const hoursAll = rows.reduce((sum, row) => sum + row.hours, 0);
  const workersAll = rows.reduce((sum, row) => sum + row.workers, 0);
  const top = active.reduce<Trade | null>((best, row) => (row.currentRun > (best?.currentRun ?? 0) ? row : best), null);

  return {
    ok: true,
    fatigue: {
      trades: rows,
      longDays,
      runs,
      from,
      to,
      windowDays,
      latest,
      onSite: active.length,
      attention: rows.filter((row) => row.status === "high" || row.status === "watch").length,
      workDays: rows.reduce((sum, row) => sum + row.workDays, 0),
      avgPer: workersAll > 0 ? hoursAll / workersAll : null,
      longCount: longDays.length,
      veryLongCount: longDays.filter((item) => item.veryLong).length,
      longestCurrent: top && top.currentRun > 0 ? { trade: top.name, length: top.currentRun } : null,
      noHeadcount,
      skipped,
    },
  };
}

export function filterTrades(trades: Trade[], filter: Filter): Trade[] {
  return filter === "attention" ? trades.filter((trade) => trade.status === "high" || trade.status === "watch") : trades;
}

export function perText(value: number | null): string {
  return value === null ? "—" : `${value.toFixed(1)} h`;
}

export function daysText(count: number): string {
  return `${count} ${plural(count, "day", "days")}`;
}

export function reasonText(trade: Trade): string {
  const parts: string[] = [];

  if (trade.status === "off") {
    return trade.lastDay === null ? "No labour logged." : `Not on site in the last ${RECENT} days. Last logged ${formatDay(trade.lastDay)}.`;
  }

  if (trade.currentRun >= RUN_WATCH) {
    parts.push(`${daysText(trade.currentRun)} in a row with no rest day`);
  }

  if (trade.recentVeryLong) {
    parts.push(`a day over ${VERY_LONG_DAY} hours a worker in the last week`);
  } else if (trade.recentLong) {
    parts.push(`a day over ${LONG_DAY} hours a worker in the last week`);
  }

  if (parts.length > 0) {
    return `${parts.join(", ")}.`.replace(/^./, (c) => c.toUpperCase());
  }

  if (trade.status === "earlier") {
    const earlier: string[] = [];

    if (trade.longestRun >= RUN_WATCH) {
      earlier.push(`a run of ${daysText(trade.longestRun)} without a rest day`);
    }

    if (trade.longDays > 0) {
      earlier.push(`${trade.longDays} ${plural(trade.longDays, "day", "days")} over ${LONG_DAY} hours a worker`);
    }

    return `Earlier in the period: ${earlier.join(" and ")}. Nothing in the last week.`;
  }

  return "Within the limits for the period.";
}

export function fatigueMarkdown(fatigue: Fatigue, trades: Trade[], projectName: string, today: number): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Fatigue watch: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Labour logged for the ${fatigue.windowDays} days from ${formatDay(fatigue.from)} to ${formatDay(fatigue.to)}.`, "");
  lines.push(`- ${fatigue.attention} of ${fatigue.onSite} ${plural(fatigue.onSite, "trade", "trades")} on site need attention`);
  lines.push(`- ${fatigue.longCount} ${plural(fatigue.longCount, "trade day", "trade days")} over ${LONG_DAY} hours a worker, ${fatigue.veryLongCount} over ${VERY_LONG_DAY}`);
  lines.push(`- Average day ${perText(fatigue.avgPer)} a worker`, "");

  lines.push("| Trade | Status | Run now | Longest run | Days over 10 h | Average day | Overtime |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: |");

  for (const trade of trades) {
    lines.push(`| ${cell(trade.name)} | ${STATUS_LABEL[trade.status]} | ${trade.currentRun} | ${trade.longestRun} | ${trade.longDays} | ${perText(trade.avgPer)} | ${trade.overtimeShare === null ? "—" : `${Math.round(trade.overtimeShare * 100)}%`} |`);
  }

  const watched = trades.filter((trade) => trade.status === "high" || trade.status === "watch");

  if (watched.length > 0) {
    lines.push("", "Why they are flagged:", "");

    for (const trade of watched) {
      lines.push(`- ${cell(trade.name)}: ${reasonText(trade)}`);
    }
  }

  lines.push(
    "",
    `Hours a worker is the labour hours logged for a trade on a day divided by the workers logged, a crew average that hides a few people working much longer than the rest. A day is long above ${LONG_DAY} hours and very long above ${VERY_LONG_DAY}. A run is consecutive calendar days with labour logged for the trade, and a day with nothing logged counts as a rest day, so a missing log understates the runs. A trade is high when its current run reaches ${RUN_HIGH} days or it had a very long day in the last ${RECENT} days, and watch when the run reaches ${RUN_WATCH} days or it had a long day in the last ${RECENT} days.`,
    "",
  );

  return lines.join("\n");
}
