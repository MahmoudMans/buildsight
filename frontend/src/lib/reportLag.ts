import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { ProductionControl, SiteReport } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
  { days: 112, label: "16 weeks" },
];

export const DEFAULT_WINDOW = 56;
export const LATE_AFTER = 3;
export const BATCH_MIN = 4;
export const BATCH_SPAN = 3;
export const PAGE = 10;

export type BucketKey = "same" | "next" | "few" | "late";

export const BUCKETS: ReadonlyArray<{ key: BucketKey; label: string; max: number }> = [
  { key: "same", label: "Same day", max: 0 },
  { key: "next", label: "1 day", max: 1 },
  { key: "few", label: "2 to 3 days", max: LATE_AFTER },
  { key: "late", label: "4 days or more", max: Number.POSITIVE_INFINITY },
];

export type Counts = Record<BucketKey, number>;

export interface Filed {
  id: string;
  reference: string;
  reportDate: number;
  createdDay: number;
  lag: number;
  status: SiteReport["status"];
  labour: number;
}

export interface Draft {
  id: string;
  reference: string;
  reportDate: number;
  age: number;
  labour: number;
  entries: number;
}

export interface Week {
  from: number;
  counts: Counts;
  drafts: number;
  total: number;
}

export interface Weekday {
  index: number;
  label: string;
  count: number;
  median: number | null;
  counts: Counts;
  late: number;
}

export interface Batch {
  day: number;
  count: number;
  firstDate: number;
  lastDate: number;
  dates: number;
  behind: number;
  maxLag: number;
}

export interface Lag {
  from: number;
  to: number;
  filed: Filed[];
  drafts: Draft[];
  windowDrafts: number;
  weeks: Week[];
  weekdays: Weekday[];
  batches: Batch[];
  counts: Counts;
  median: number | null;
  longest: number;
  same: number;
  sameShare: number | null;
  late: number;
  lateShare: number | null;
  oldestDraft: number | null;
  staleDrafts: number;
  skipped: number;
  future: number;
}

export type LagResult = { ok: true; lag: Lag } | { ok: false; reason: "empty" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function bucketOf(lag: number): BucketKey {
  for (const bucket of BUCKETS) {
    if (lag <= bucket.max) {
      return bucket.key;
    }
  }

  return "late";
}

function emptyCounts(): Counts {
  return { same: 0, next: 0, few: 0, late: 0 };
}

export function weekStart(day: number): number {
  return day - ((day + 3) % 7);
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function buildLag(data: ProductionControl, today: number, windowDays: number): LagResult {
  const reports = data.siteReports ?? [];

  if (reports.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const from = today - windowDays + 1;
  const filed: Filed[] = [];
  const drafts: Draft[] = [];
  let skipped = 0;
  let future = 0;

  for (const report of reports) {
    const reportDate = toDay(report.reportDate);

    if (!Number.isFinite(reportDate)) {
      skipped += 1;
      continue;
    }

    if (reportDate > today) {
      future += 1;
      continue;
    }

    if (report.status === "DRAFT") {
      drafts.push({
        id: report.id,
        reference: report.reference,
        reportDate,
        age: today - reportDate,
        labour: finite(report.totalLaborHours),
        entries: finite(report.entryCount),
      });
      continue;
    }

    if (reportDate < from) {
      continue;
    }

    const createdDay = toDay(report.createdAt);

    if (!Number.isFinite(createdDay)) {
      skipped += 1;
      continue;
    }

    filed.push({
      id: report.id,
      reference: report.reference,
      reportDate,
      createdDay,
      lag: Math.max(0, createdDay - reportDate),
      status: report.status,
      labour: finite(report.totalLaborHours),
    });
  }

  drafts.sort((a, b) => b.age - a.age || a.reference.localeCompare(b.reference, undefined, { numeric: true }));

  const counts = emptyCounts();

  for (const item of filed) {
    counts[bucketOf(item.lag)] += 1;
  }

  const weeks: Week[] = [];

  for (let start = weekStart(from); start <= today; start += 7) {
    weeks.push({ from: start, counts: emptyCounts(), drafts: 0, total: 0 });
  }

  const weekFor = (day: number) => weeks.find((week) => day >= week.from && day < week.from + 7);

  for (const item of filed) {
    const week = weekFor(item.reportDate);

    if (week) {
      week.counts[bucketOf(item.lag)] += 1;
      week.total += 1;
    }
  }

  const windowDraftList = drafts.filter((item) => item.reportDate >= from);

  for (const item of windowDraftList) {
    const week = weekFor(item.reportDate);

    if (week) {
      week.drafts += 1;
      week.total += 1;
    }
  }

  const weekdays: Weekday[] = WEEKDAYS.map((label, index) => ({ index, label, count: 0, median: null, counts: emptyCounts(), late: 0 }));
  const lagsByDay: number[][] = WEEKDAYS.map(() => []);

  for (const item of filed) {
    const index = (item.reportDate + 3) % 7;
    const row = weekdays[index] as Weekday;

    row.count += 1;
    row.counts[bucketOf(item.lag)] += 1;
    (lagsByDay[index] as number[]).push(item.lag);

    if (item.lag > LATE_AFTER) {
      row.late += 1;
    }
  }

  weekdays.forEach((row, index) => {
    row.median = median(lagsByDay[index] as number[]);
  });

  const byCreated = new Map<number, Filed[]>();

  for (const item of filed) {
    byCreated.set(item.createdDay, [...(byCreated.get(item.createdDay) ?? []), item]);
  }

  const batches: Batch[] = [];

  for (const [day, items] of byCreated) {
    const dates = new Set(items.map((item) => item.reportDate));

    if (items.length >= BATCH_MIN && dates.size >= BATCH_SPAN) {
      batches.push({
        day,
        count: items.length,
        firstDate: Math.min(...items.map((item) => item.reportDate)),
        lastDate: Math.max(...items.map((item) => item.reportDate)),
        dates: dates.size,
        behind: items.filter((item) => item.lag >= 1).length,
        maxLag: Math.max(...items.map((item) => item.lag)),
      });
    }
  }

  batches.sort((a, b) => b.count - a.count || b.day - a.day);

  const lags = filed.map((item) => item.lag);
  const same = counts.same;
  const late = filed.filter((item) => item.lag > LATE_AFTER).length;

  return {
    ok: true,
    lag: {
      from,
      to: today,
      filed,
      drafts,
      windowDrafts: windowDraftList.length,
      weeks,
      weekdays,
      batches,
      counts,
      median: median(lags),
      longest: lags.length > 0 ? Math.max(...lags) : 0,
      same,
      sameShare: filed.length > 0 ? same / filed.length : null,
      late,
      lateShare: filed.length > 0 ? late / filed.length : null,
      oldestDraft: drafts.length > 0 ? (drafts[0] as Draft).age : null,
      staleDrafts: drafts.filter((item) => item.age > LATE_AFTER).length,
      skipped,
      future,
    },
  };
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function daysText(value: number): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);

  return `${text} ${plural(value, "day", "days")}`;
}

export function lagText(value: number): string {
  return value === 0 ? "Same day" : `${daysText(value)} later`;
}

export function medianText(value: number | null): string {
  return value === null ? "—" : value === 0 ? "Same day" : daysText(value);
}

export function lateList(lag: Lag): Filed[] {
  return lag.filed.filter((item) => item.lag > LATE_AFTER).sort((a, b) => b.lag - a.lag || b.reportDate - a.reportDate);
}

export function lagMarkdown(lag: Lag, projectName: string, today: number, windowLabel: string): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const late = lateList(lag);

  lines.push(`# Report filing lag: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Site reports dated ${formatDay(lag.from)} to ${formatDay(lag.to)} (the last ${windowLabel}).`, "");
  lines.push(`- ${lag.filed.length} ${plural(lag.filed.length, "report", "reports")} filed, median lag ${medianText(lag.median).toLowerCase()}, longest ${daysText(lag.longest)}`);
  lines.push(`- ${pct(lag.sameShare)} created on the day they cover; ${lag.late} (${pct(lag.lateShare)}) created more than ${LATE_AFTER} days later`);
  lines.push(`- ${lag.drafts.length} draft ${plural(lag.drafts.length, "report", "reports")} still open${lag.oldestDraft !== null ? `, the oldest ${daysText(lag.oldestDraft)} old` : ""}`);
  lines.push(`- ${lag.batches.length} ${plural(lag.batches.length, "day", "days")} when several days of reports were created in one go`, "");

  if (late.length > 0) {
    lines.push("| Report | Report date | Created | Lag |", "| --- | --- | --- | ---: |");

    for (const item of late.slice(0, 15)) {
      lines.push(`| ${cell(trunc(item.reference, 30))} | ${formatDay(item.reportDate)} | ${formatDay(item.createdDay)} | ${daysText(item.lag)} |`);
    }

    lines.push("");
  }

  if (lag.drafts.length > 0) {
    lines.push("Draft reports not yet filed:", "", "| Report | Report date | Age | Labour hours |", "| --- | --- | ---: | ---: |");

    for (const item of lag.drafts.slice(0, 15)) {
      lines.push(`| ${cell(trunc(item.reference, 30))} | ${formatDay(item.reportDate)} | ${daysText(item.age)} | ${Math.round(item.labour)} |`);
    }

    lines.push("");
  }

  lines.push(
    `Lag is the number of days from the date a site report covers to the day its record was created in the system. It is not the time to submit or approve the report, so a report opened on the day and completed later still counts as same day, and reports entered in bulk show the day of entry. Draft reports are not counted as filed. A report is late when created more than ${LATE_AFTER} days after its date. A day of batch filing is one on which ${BATCH_MIN} or more reports were created covering ${BATCH_SPAN} or more different dates.${lag.skipped > 0 ? ` ${lag.skipped} ${plural(lag.skipped, "report has", "reports have")} no usable date and ${plural(lag.skipped, "was", "were")} left out.` : ""}`,
    "",
  );

  return lines.join("\n");
}
