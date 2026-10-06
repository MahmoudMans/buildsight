import { STREAMS, type StreamKey } from "@/lib/backlog";
import { formatDay, plural, toDay, type ModuleKey, type Sources } from "@/lib/openItems";

export const WINDOWS: ReadonlyArray<{ key: string; days: number | null; label: string }> = [
  { key: "90", days: 90, label: "90 days" },
  { key: "180", days: 180, label: "6 months" },
  { key: "365", days: 365, label: "12 months" },
  { key: "all", days: null, label: "All time" },
];

export const DEFAULT_WINDOW = "180";
export const BINS: ReadonlyArray<{ label: string; max: number }> = [
  { label: "0–2", max: 2 },
  { label: "3–7", max: 7 },
  { label: "8–14", max: 14 },
  { label: "15–30", max: 30 },
  { label: "31–60", max: 60 },
  { label: "61–90", max: 90 },
  { label: "90+", max: Infinity },
];

export const MONTHS_SHOWN = 6;
export const RECORD_LIMIT = 6;
export const MIN_SAMPLE = 3;

export interface Rec {
  id: string;
  reference: string;
  title: string;
  owner: string | null;
  raised: number;
  due: number | null;
  closed: number | null;
}

export interface MonthPoint {
  label: string;
  closed: number;
  median: number | null;
  onTime: number | null;
}

export interface StreamStats {
  key: StreamKey;
  label: string;
  color: string;
  module: ModuleKey;
  available: boolean;
  closed: number;
  median: number | null;
  p90: number | null;
  fastest: number | null;
  slowest: number | null;
  dated: number;
  onTime: number;
  late: number;
  onTimeRate: number | null;
  avgLate: number | null;
  openNow: number;
  overdueNow: number;
  oldestOpen: number | null;
  stuck: Rec[];
  stuckCount: number;
  months: MonthPoint[];
  bins: number[];
  slowestClosed: Array<Rec & { took: number }>;
  undated: number;
  trend: "faster" | "slower" | "steady" | "unclear";
}

export interface ClosureSpeed {
  streams: StreamStats[];
  windowDays: number | null;
  closed: number;
  median: number | null;
  onTimeRate: number | null;
  dated: number;
  overdueNow: number;
  openNow: number;
  undated: number;
  skipped: number;
  slowest: StreamStats | null;
  fastest: StreamStats | null;
  best: StreamStats | null;
  worst: StreamStats | null;
}

function dayOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[middle] as number) : ((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2;
}

export function percentile(values: number[], share: number): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(share * sorted.length) - 1));

  return sorted[index] as number;
}

function monthStart(day: number, back: number): number {
  const date = new Date(day * 86_400_000);

  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - back, 1) / 86_400_000);
}

function monthLabel(day: number): string {
  return new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(new Date(day * 86_400_000));
}

export interface Raw {
  records: Rec[];
  open: Rec[];
  undated: number;
  skipped: number;
}

function sortRaw(
  list: Array<{ id: string; reference: string; title: string; owner: string | null; raised: number; due: number; done: boolean; closedOn: number }>,
  today: number,
): Raw {
  const records: Rec[] = [];
  const open: Rec[] = [];
  let undated = 0;
  let skipped = 0;

  for (const item of list) {
    if (!Number.isFinite(item.raised) || item.raised > today) {
      skipped += 1;
      continue;
    }

    const base = { id: item.id, reference: item.reference, title: item.title, owner: item.owner, raised: item.raised, due: dayOrNull(item.due) };

    if (!item.done) {
      open.push({ ...base, closed: null });
      continue;
    }

    if (!Number.isFinite(item.closedOn)) {
      undated += 1;
      continue;
    }

    if (item.closedOn > today) {
      skipped += 1;
      continue;
    }

    records.push({ ...base, closed: Math.max(item.closedOn, item.raised) });
  }

  return { records, open, undated, skipped };
}

export function collectRecords(sources: Sources, failed: string[], today: number): Map<StreamKey, Raw> {
  const lost = new Set(failed);
  const raw = new Map<StreamKey, Raw>();

  if (sources.quality && !lost.has("quality")) {
    raw.set(
      "snags",
      sortRaw(
        (sources.quality.punchItems ?? [])
          .filter((item) => item.status !== "VOID")
          .map((item) => ({ id: item.id, reference: item.reference, title: item.title, owner: item.ownerName, raised: toDay(item.raisedDate), due: toDay(item.dueDate), done: item.status === "CLOSED", closedOn: toDay(item.closedDate) })),
        today,
      ),
    );

    raw.set(
      "ncrs",
      sortRaw(
        (sources.quality.ncrs ?? [])
          .filter((item) => item.status !== "VOID")
          .map((item) => ({ id: item.id, reference: item.reference, title: item.title, owner: item.ownerName, raised: toDay(item.raisedDate), due: toDay(item.dueDate), done: item.status === "CLOSED", closedOn: toDay(item.closedDate) })),
        today,
      ),
    );
  }

  if (sources.documents && !lost.has("documents")) {
    raw.set(
      "rfis",
      sortRaw(
        (sources.documents.rfis ?? [])
          .filter((item) => item.status !== "VOID")
          .map((item) => ({ id: item.id, reference: item.reference, title: item.subject, owner: item.assignedTo, raised: toDay(item.raisedDate), due: toDay(item.dueDate), done: item.status !== "OPEN", closedOn: toDay(item.respondedDate) })),
        today,
      ),
    );
  }

  if (sources.safety && !lost.has("safety")) {
    raw.set(
      "observations",
      sortRaw(
        (sources.safety.observations ?? [])
          .filter((item) => item.status !== "VOID")
          .map((item) => ({ id: item.id, reference: item.reference, title: item.title, owner: item.ownerName, raised: toDay(item.observedDate), due: toDay(item.dueDate), done: item.status === "CLOSED", closedOn: toDay(item.closedDate) })),
        today,
      ),
    );

    raw.set(
      "safetyActions",
      sortRaw(
        (sources.safety.actions ?? [])
          .filter((item) => item.status !== "VOID")
          .map((item) => ({ id: item.id, reference: item.reference, title: item.title, owner: item.ownerName, raised: toDay(item.createdAt), due: toDay(item.dueDate), done: item.status === "CLOSED", closedOn: toDay(item.closedDate) })),
        today,
      ),
    );
  }

  if (sources.governance && !lost.has("governance")) {
    raw.set(
      "actions",
      sortRaw(
        (sources.governance.actions ?? [])
          .filter((item) => item.status !== "VOID")
          .map((item) => ({ id: item.id, reference: item.actionNumber, title: item.title, owner: item.ownerName, raised: toDay(item.createdAt), due: toDay(item.dueDate), done: item.status === "DONE", closedOn: toDay(item.completedAt) })),
        today,
      ),
    );
  }

  return raw;
}

export function buildClosureSpeed(sources: Sources, failed: string[], today: number, windowDays: number | null): ClosureSpeed {
  const raw = collectRecords(sources, failed, today);

  const since = windowDays === null ? -Infinity : today - windowDays;
  const midpoint = windowDays === null ? NaN : today - windowDays / 2;
  let undated = 0;
  let skipped = 0;

  const streams: StreamStats[] = STREAMS.map((info) => {
    const data = raw.get(info.key);

    if (!data) {
      return {
        key: info.key,
        label: info.label,
        color: info.color,
        module: info.module,
        available: false,
        closed: 0,
        median: null,
        p90: null,
        fastest: null,
        slowest: null,
        dated: 0,
        onTime: 0,
        late: 0,
        onTimeRate: null,
        avgLate: null,
        openNow: 0,
        overdueNow: 0,
        oldestOpen: null,
        stuck: [],
        stuckCount: 0,
        months: [],
        bins: BINS.map(() => 0),
        slowestClosed: [],
        undated: 0,
        trend: "unclear",
      } satisfies StreamStats;
    }

    undated += data.undated;
    skipped += data.skipped;

    const inWindow = data.records.filter((item) => (item.closed as number) > since);
    const took = inWindow.map((item) => (item.closed as number) - item.raised);
    const sorted = [...took].sort((a, b) => a - b);
    const withDue = inWindow.filter((item) => item.due !== null);
    const lateOnes = withDue.filter((item) => (item.closed as number) > (item.due as number));
    const lateDays = lateOnes.map((item) => (item.closed as number) - (item.due as number));
    const p90 = percentile(took, 0.9);

    const bins = BINS.map(() => 0);

    for (const value of took) {
      const slot = BINS.findIndex((bin) => value <= bin.max);

      bins[slot < 0 ? bins.length - 1 : slot] = (bins[slot < 0 ? bins.length - 1 : slot] ?? 0) + 1;
    }

    const overdue = data.open.filter((item) => item.due !== null && item.due < today);
    const ages = data.open.map((item) => today - item.raised);
    const enough = took.length >= MIN_SAMPLE && p90 !== null;
    const stuckAll = enough ? data.open.filter((item) => today - item.raised > (p90 as number)) : [];

    const months: MonthPoint[] = [];

    for (let back = MONTHS_SHOWN - 1; back >= 0; back -= 1) {
      const from = monthStart(today, back);
      const to = monthStart(today, back - 1);
      const inMonth = data.records.filter((item) => (item.closed as number) >= from && (item.closed as number) < to);
      const dueMonth = inMonth.filter((item) => item.due !== null);

      months.push({
        label: monthLabel(from),
        closed: inMonth.length,
        median: median(inMonth.map((item) => (item.closed as number) - item.raised)),
        onTime: dueMonth.length === 0 ? null : dueMonth.filter((item) => (item.closed as number) <= (item.due as number)).length / dueMonth.length,
      });
    }

    let trend: StreamStats["trend"] = "unclear";

    if (windowDays !== null) {
      const recent = inWindow.filter((item) => (item.closed as number) > midpoint).map((item) => (item.closed as number) - item.raised);
      const earlier = inWindow.filter((item) => (item.closed as number) <= midpoint).map((item) => (item.closed as number) - item.raised);
      const now = median(recent);
      const before = median(earlier);

      if (recent.length >= MIN_SAMPLE && earlier.length >= MIN_SAMPLE && now !== null && before !== null) {
        const gap = now - before;
        const limit = Math.max(2, before * 0.2);

        trend = gap > limit ? "slower" : gap < -limit ? "faster" : "steady";
      }
    }

    return {
      key: info.key,
      label: info.label,
      color: info.color,
      module: info.module,
      available: true,
      closed: inWindow.length,
      median: median(took),
      p90,
      fastest: sorted.length > 0 ? (sorted[0] as number) : null,
      slowest: sorted.length > 0 ? (sorted[sorted.length - 1] as number) : null,
      dated: withDue.length,
      onTime: withDue.length - lateOnes.length,
      late: lateOnes.length,
      onTimeRate: withDue.length === 0 ? null : (withDue.length - lateOnes.length) / withDue.length,
      avgLate: lateDays.length === 0 ? null : lateDays.reduce((sum, value) => sum + value, 0) / lateDays.length,
      openNow: data.open.length,
      overdueNow: overdue.length,
      oldestOpen: ages.length === 0 ? null : Math.max(...ages),
      stuck: [...stuckAll].sort((a, b) => a.raised - b.raised).slice(0, RECORD_LIMIT),
      stuckCount: stuckAll.length,
      months,
      bins,
      slowestClosed: inWindow
        .map((item) => ({ ...item, took: (item.closed as number) - item.raised }))
        .sort((a, b) => b.took - a.took || a.reference.localeCompare(b.reference, undefined, { numeric: true }))
        .slice(0, RECORD_LIMIT),
      undated: data.undated,
      trend,
    } satisfies StreamStats;
  });

  const live = streams.filter((item) => item.available);
  const pooled: number[] = [];
  let dated = 0;
  let onTime = 0;

  for (const info of STREAMS) {
    const data = raw.get(info.key);

    if (!data) {
      continue;
    }

    for (const item of data.records) {
      if ((item.closed as number) > since) {
        pooled.push((item.closed as number) - item.raised);

        if (item.due !== null) {
          dated += 1;
          onTime += (item.closed as number) <= item.due ? 1 : 0;
        }
      }
    }
  }

  const ranked = live.filter((item) => item.closed >= MIN_SAMPLE && item.median !== null);
  const reliable = live.filter((item) => item.dated >= MIN_SAMPLE && item.onTimeRate !== null);

  return {
    streams,
    windowDays,
    closed: pooled.length,
    median: median(pooled),
    onTimeRate: dated === 0 ? null : onTime / dated,
    dated,
    overdueNow: live.reduce((sum, item) => sum + item.overdueNow, 0),
    openNow: live.reduce((sum, item) => sum + item.openNow, 0),
    undated,
    skipped,
    slowest: ranked.length < 2 ? null : [...ranked].sort((a, b) => (b.median as number) - (a.median as number))[0] ?? null,
    fastest: ranked.length < 2 ? null : [...ranked].sort((a, b) => (a.median as number) - (b.median as number))[0] ?? null,
    best: reliable.length < 2 ? null : [...reliable].sort((a, b) => (b.onTimeRate as number) - (a.onTimeRate as number))[0] ?? null,
    worst: reliable.length < 2 ? null : [...reliable].sort((a, b) => (a.onTimeRate as number) - (b.onTimeRate as number))[0] ?? null,
  };
}

export function daysText(value: number | null): string {
  if (value === null) {
    return "—";
  }

  const rounded = Math.round(value * 2) / 2;

  return `${rounded % 1 === 0 ? rounded : rounded.toFixed(1)} d`;
}

export function rateText(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function trendText(trend: StreamStats["trend"]): string {
  return trend === "faster" ? "Getting faster" : trend === "slower" ? "Getting slower" : trend === "steady" ? "Steady" : "Too few to tell";
}

export function windowLabel(days: number | null): string {
  return WINDOWS.find((item) => item.days === days)?.label ?? "All time";
}

export function closureMarkdown(result: ClosureSpeed, projectName: string, today: number): string {
  const lines: string[] = [];

  lines.push(`# Closure speed: ${projectName}`, "");
  lines.push(
    `As of ${formatDay(today)}. ${result.windowDays === null ? "Every item closed to date" : `Items closed in the last ${windowLabel(result.windowDays).toLowerCase()}`}, measured from the day they were raised to the day they were closed.`,
    "",
  );
  lines.push(
    `- Closed: ${result.closed}`,
    `- Typical time to close (median): ${daysText(result.median)}`,
    `- Closed on or before the due date: ${rateText(result.onTimeRate)}${result.dated > 0 ? ` of ${result.dated}` : ""}`,
    `- Open and past due now: ${result.overdueNow} of ${result.openNow}`,
    "",
  );
  lines.push("| Stream | Closed | Median | 9 in 10 within | On time | Avg days late | Open and overdue |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const row of result.streams) {
    if (!row.available) {
      lines.push(`| ${row.label} | n/a | n/a | n/a | n/a | n/a | not loaded |`);
      continue;
    }

    lines.push(`| ${row.label} | ${row.closed} | ${daysText(row.median)} | ${daysText(row.p90)} | ${rateText(row.onTimeRate)} | ${daysText(row.avgLate)} | ${row.overdueNow} of ${row.openNow} |`);
  }

  lines.push("", "Median is the middle closing time. 9 in 10 within is the time by which 90% of closed items were done. On time counts items closed on or before their own due date.", "");

  if (result.undated > 0) {
    lines.push(`${result.undated} closed ${plural(result.undated, "item has", "items have")} no closing date and ${plural(result.undated, "was", "were")} left out.`, "");
  }

  return lines.join("\n");
}
