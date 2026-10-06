import { DAY_MS, formatDay, plural, toDay, trunc, words } from "@/lib/openItems";
import type { DelayCause, DelayStatus, RiskControl } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 365;
export const PAGE = 10;
export const LANES = 12;

export type PairKind = "mixed" | "bothExcusable" | "bothCulpable";
export type PairFilter = "all" | "mixed" | "sameCause";

export const PAIR_KIND_LABEL: Record<PairKind, string> = {
  mixed: "Excusable with non-excusable",
  bothExcusable: "Both excusable",
  bothCulpable: "Both non-excusable",
};

export const FILTERS: ReadonlyArray<{ key: PairFilter; label: string }> = [
  { key: "all", label: "All overlaps" },
  { key: "mixed", label: "Excusable with non-excusable" },
  { key: "sameCause", label: "Same cause" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface Span {
  key: string;
  reference: string;
  title: string;
  cause: DelayCause;
  causeLabel: string;
  owner: string | null;
  excusable: boolean;
  compensable: boolean;
  status: DelayStatus;
  start: number;
  end: number;
  from: number;
  to: number;
  days: number;
  recordedEnd: boolean;
  forecastDays: number;
  left: number;
  width: number;
}

export interface Pair {
  key: string;
  a: Span;
  b: Span;
  from: number;
  to: number;
  days: number;
  kind: PairKind;
  sameCause: boolean;
}

export interface CauseRow {
  cause: DelayCause;
  label: string;
  delays: number;
  days: number;
  shared: number;
  share: number | null;
}

export interface Run {
  from: number;
  to: number;
  days: number;
  peak: number;
  left: number;
  width: number;
}

export interface Tick {
  label: string;
  left: number;
}

export interface Concurrency {
  from: number;
  to: number;
  windowDays: number;
  spans: Span[];
  pairs: Pair[];
  causes: CauseRow[];
  runs: Run[];
  ticks: Tick[];
  delays: number;
  sumDays: number;
  calendarDays: number;
  overlapDays: number;
  overlapShare: number | null;
  concurrentDays: number;
  peak: number;
  peakDay: number | null;
  forecastWindows: number;
  outside: number;
  skipped: number;
  future: number;
}

export type ConcurrencyResult = { ok: true; data: Concurrency } | { ok: false; reason: "noDelays" };

function num(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function before(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function causeLabel(cause: DelayCause): string {
  return words(cause);
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function dayCount(count: number): string {
  return `${count} ${plural(count, "day", "days")}`;
}

export function buildConcurrency(data: RiskControl, today: number, windowDays: number): ConcurrencyResult {
  const all = data.delays ?? [];

  if (all.length === 0) {
    return { ok: false, reason: "noDelays" };
  }

  const from = today - windowDays + 1;
  const spans: Span[] = [];
  let skipped = 0;
  let future = 0;
  let outside = 0;

  for (const item of all) {
    const start = toDay(item.startDate);

    if (!Number.isFinite(start)) {
      skipped += 1;
      continue;
    }

    if (start > today) {
      future += 1;
      continue;
    }

    const recordedEnd = toDay(item.endDate);
    const hasEnd = Number.isFinite(recordedEnd) && recordedEnd >= start;
    const forecastDays = Math.max(0, num(item.forecastDelayDays));
    const end = hasEnd ? recordedEnd : start + Math.max(forecastDays, 1) - 1;
    const clippedStart = Math.max(start, from);
    const clippedEnd = Math.min(end, today);

    if (clippedStart > clippedEnd) {
      outside += 1;
      continue;
    }

    spans.push({
      key: item.id,
      reference: item.reference,
      title: item.title,
      cause: item.cause,
      causeLabel: causeLabel(item.cause),
      owner: (item.ownerName ?? "").trim() || null,
      excusable: Boolean(item.excusable),
      compensable: Boolean(item.compensable),
      status: item.status,
      start,
      end,
      from: clippedStart,
      to: clippedEnd,
      days: clippedEnd - clippedStart + 1,
      recordedEnd: hasEnd,
      forecastDays,
      left: round2(((clippedStart - from) / windowDays) * 100),
      width: round2(((clippedEnd - clippedStart + 1) / windowDays) * 100),
    });
  }

  spans.sort((a, b) => a.start - b.start || before(a.reference, b.reference));

  const count = new Array<number>(windowDays).fill(0);
  const excusableCount = new Array<number>(windowDays).fill(0);
  const culpableCount = new Array<number>(windowDays).fill(0);
  const cover = new Map<DelayCause, number[]>();

  for (const span of spans) {
    const own = cover.get(span.cause) ?? new Array<number>(windowDays).fill(0);

    for (let day = span.from; day <= span.to; day += 1) {
      const index = day - from;

      count[index] = (count[index] ?? 0) + 1;

      if (span.excusable) {
        excusableCount[index] = (excusableCount[index] ?? 0) + 1;
      } else {
        culpableCount[index] = (culpableCount[index] ?? 0) + 1;
      }

      own[index] = 1;
    }

    cover.set(span.cause, own);
  }

  const distinct = new Array<number>(windowDays).fill(0);

  for (const own of cover.values()) {
    own.forEach((flag, index) => {
      distinct[index] = (distinct[index] ?? 0) + flag;
    });
  }

  const causes: CauseRow[] = [...cover.entries()]
    .map(([cause, own]) => {
      const days = own.reduce((total, flag) => total + flag, 0);
      const shared = own.reduce((total, flag, index) => total + (flag === 1 && (distinct[index] ?? 0) >= 2 ? 1 : 0), 0);

      return { cause, label: causeLabel(cause), delays: spans.filter((span) => span.cause === cause).length, days, shared, share: days > 0 ? shared / days : null };
    })
    .sort((a, b) => b.days - a.days || before(a.label, b.label));

  const pairs: Pair[] = [];

  for (let i = 0; i < spans.length; i += 1) {
    for (let j = i + 1; j < spans.length; j += 1) {
      const a = spans[i] as Span;
      const b = spans[j] as Span;
      const overlapFrom = Math.max(a.from, b.from);
      const overlapTo = Math.min(a.to, b.to);

      if (overlapFrom > overlapTo) {
        continue;
      }

      pairs.push({
        key: `${a.key}|${b.key}`,
        a,
        b,
        from: overlapFrom,
        to: overlapTo,
        days: overlapTo - overlapFrom + 1,
        kind: a.excusable && b.excusable ? "bothExcusable" : !a.excusable && !b.excusable ? "bothCulpable" : "mixed",
        sameCause: a.cause === b.cause,
      });
    }
  }

  pairs.sort((x, y) => y.days - x.days || y.from - x.from || before(x.a.reference, y.a.reference) || before(x.b.reference, y.b.reference));

  const runs: Run[] = [];
  let open: Run | null = null;

  for (let index = 0; index < windowDays; index += 1) {
    const here = count[index] ?? 0;

    if (here >= 2) {
      if (open === null) {
        open = { from: from + index, to: from + index, days: 1, peak: here, left: 0, width: 0 };
      } else {
        open.to = from + index;
        open.days += 1;
        open.peak = Math.max(open.peak, here);
      }
    } else if (open !== null) {
      runs.push(open);
      open = null;
    }
  }

  if (open !== null) {
    runs.push(open);
  }

  for (const run of runs) {
    run.left = round2(((run.from - from) / windowDays) * 100);
    run.width = round2((run.days / windowDays) * 100);
  }

  const sumDays = spans.reduce((total, span) => total + span.days, 0);
  const calendarDays = count.filter((value) => value > 0).length;
  const peak = count.reduce((top, value) => Math.max(top, value), 0);
  const peakIndex = peak > 0 ? count.indexOf(peak) : -1;
  const ticks: Tick[] = [];
  const first = new Date(from * DAY_MS);
  let year = first.getUTCFullYear();
  let month = first.getUTCMonth();

  for (;;) {
    const day = Math.floor(Date.UTC(year, month, 1) / DAY_MS);

    if (day > today) {
      break;
    }

    if (day >= from) {
      ticks.push({ label: MONTHS[month] ?? "", left: round2(((day - from) / windowDays) * 100) });
    }

    month += 1;

    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return {
    ok: true,
    data: {
      from,
      to: today,
      windowDays,
      spans,
      pairs,
      causes,
      runs,
      ticks,
      delays: spans.length,
      sumDays,
      calendarDays,
      overlapDays: sumDays - calendarDays,
      overlapShare: sumDays > 0 ? (sumDays - calendarDays) / sumDays : null,
      concurrentDays: count.reduce((total, _value, index) => total + ((excusableCount[index] ?? 0) > 0 && (culpableCount[index] ?? 0) > 0 ? 1 : 0), 0),
      peak,
      peakDay: peakIndex >= 0 ? from + peakIndex : null,
      forecastWindows: spans.filter((span) => !span.recordedEnd).length,
      outside,
      skipped,
      future,
    },
  };
}

export function filterPairs(pairs: Pair[], filter: PairFilter): Pair[] {
  if (filter === "mixed") {
    return pairs.filter((pair) => pair.kind === "mixed");
  }

  if (filter === "sameCause") {
    return pairs.filter((pair) => pair.sameCause);
  }

  return pairs;
}

export function concurrencyMarkdown(data: Concurrency, shown: Pair[], projectName: string, windowLabel: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Delay concurrency: ${projectName}`, "");
  lines.push(`${data.delays} delay ${plural(data.delays, "event", "events")} active in the last ${windowLabel}, from ${formatDay(data.from)} to ${formatDay(data.to)}.`, "");
  lines.push(`- Adding up each delay's days gives ${data.sumDays}, but the delays cover ${data.calendarDays} calendar ${plural(data.calendarDays, "day", "days")}`);
  lines.push(`- ${data.overlapDays} ${plural(data.overlapDays, "day is", "days are")} counted more than once because delays overlap (${pct(data.overlapShare)} of the days added up)`);
  lines.push(`- ${data.concurrentDays} ${plural(data.concurrentDays, "day", "days")} had an excusable delay running alongside a non-excusable one`);
  lines.push(`- Most delays running at once: ${data.peak}${data.peakDay !== null ? `, first on ${formatDay(data.peakDay)}` : ""}`, "");

  if (data.causes.length > 0) {
    lines.push("| Cause | Delays | Days | Days shared with another cause | Share |", "| --- | ---: | ---: | ---: | ---: |");

    for (const row of data.causes) {
      lines.push(`| ${row.label} | ${row.delays} | ${row.days} | ${row.shared} | ${pct(row.share)} |`);
    }

    lines.push("");
  }

  if (shown.length > 0) {
    lines.push(filterLabel ? `Overlaps (${filterLabel.toLowerCase()}):` : "Overlaps:", "", "| Delay | Overlaps with | Days | From | To | Kind |", "| --- | --- | ---: | --- | --- | --- |");

    for (const pair of shown.slice(0, 25)) {
      lines.push(`| ${cell(pair.a.reference)} ${cell(trunc(pair.a.title, 30))} (${pair.a.causeLabel.toLowerCase()}) | ${cell(pair.b.reference)} ${cell(trunc(pair.b.title, 30))} (${pair.b.causeLabel.toLowerCase()}) | ${pair.days} | ${formatDay(pair.from)} | ${formatDay(pair.to)} | ${PAIR_KIND_LABEL[pair.kind]} |`);
    }

    lines.push("");
  }

  lines.push(
    "A delay occupies the dates from its start to its end date; a delay with no end date occupies its forecast delay days from its start (at least one day). Only days up to today are counted. This shows when delays overlapped, not who is entitled to what, which depends on the contract.",
    "",
  );

  return lines.join("\n");
}
