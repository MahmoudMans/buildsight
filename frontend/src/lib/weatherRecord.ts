import { DAY_MS, formatDay, plural, toDay, trunc, words } from "@/lib/openItems";
import { monthLong, monthOf, monthShort, monthStart } from "@/lib/safetyRates";
import type { ProductionControl, ProjectDelayEvent, WeatherCondition } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ months: number; label: string }> = [
  { months: 3, label: "3 months" },
  { months: 6, label: "6 months" },
  { months: 12, label: "12 months" },
];

export const DEFAULT_WINDOW = 6;
export const WEEKS = 10;

export const CONDITIONS: ReadonlyArray<WeatherCondition> = ["CLEAR", "CLOUDY", "RAIN", "WIND", "EXTREME_HEAT", "EXTREME_COLD", "OTHER"];

export const CONDITION_LABEL: Record<WeatherCondition, string> = {
  CLEAR: "Clear",
  CLOUDY: "Cloudy",
  RAIN: "Rain",
  WIND: "Wind",
  EXTREME_HEAT: "Extreme heat",
  EXTREME_COLD: "Extreme cold",
  OTHER: "Other",
};

export const CONDITION_CODE: Record<WeatherCondition, string> = {
  CLEAR: "C",
  CLOUDY: "Cl",
  RAIN: "R",
  WIND: "W",
  EXTREME_HEAT: "H",
  EXTREME_COLD: "X",
  OTHER: "O",
};

export const ADVERSE: ReadonlyArray<WeatherCondition> = ["RAIN", "WIND", "EXTREME_HEAT", "EXTREME_COLD"];
const NORMAL: ReadonlyArray<WeatherCondition> = ["CLEAR", "CLOUDY"];

export function isAdverse(condition: WeatherCondition): boolean {
  return ADVERSE.includes(condition);
}

export interface DayLog {
  day: number;
  condition: WeatherCondition;
  hours: number;
  reports: number;
}

export interface MonthRow {
  month: number;
  label: string;
  short: string;
  reported: number;
  counts: Record<WeatherCondition, number>;
  adverse: number;
  adverseHours: number | null;
  normalHours: number | null;
  lost: number;
  missing: number;
}

export interface GridCell {
  day: number;
  kind: "report" | "missing" | "rest" | "future";
  condition: WeatherCondition | null;
  hours: number;
  today: boolean;
}

export interface WeatherDelay {
  id: string;
  reference: string;
  title: string;
  from: number;
  to: number;
  open: boolean;
  claimed: number;
  adverseLogged: number;
  reportedDays: number;
  excusable: boolean;
  compensable: boolean;
  status: string;
  verdict: "supported" | "short" | "none";
}

export interface Weather {
  from: number;
  to: number;
  months: MonthRow[];
  grid: GridCell[][];
  reported: number;
  adverse: number;
  adverseShare: number | null;
  lost: number;
  worst: MonthRow | null;
  missing: number;
  longestSpell: { length: number; from: number } | null;
  delays: WeatherDelay[] | null;
  uncovered: number | null;
  drafts: number;
  skipped: number;
  duplicates: number;
  latest: number | null;
}

export type WeatherResult = { ok: true; weather: Weather } | { ok: false; reason: "empty" };

function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function weekday(day: number): number {
  return new Date(day * DAY_MS).getUTCDay();
}

function mondayOf(day: number): number {
  const offset = (weekday(day) + 6) % 7;

  return day - offset;
}

function zero(): Record<WeatherCondition, number> {
  return { CLEAR: 0, CLOUDY: 0, RAIN: 0, WIND: 0, EXTREME_HEAT: 0, EXTREME_COLD: 0, OTHER: 0 };
}

export function buildWeather(production: ProductionControl, events: ProjectDelayEvent[] | null, today: number, monthsShown: number): WeatherResult {
  const days = new Map<number, DayLog>();
  let drafts = 0;
  let skipped = 0;
  let duplicates = 0;

  for (const report of production.siteReports ?? []) {
    if (report.status === "DRAFT") {
      drafts += 1;
      continue;
    }

    const day = toDay(report.reportDate);

    if (!Number.isFinite(day)) {
      skipped += 1;
      continue;
    }

    if (day > today) {
      continue;
    }

    const existing = days.get(day);

    if (existing) {
      duplicates += 1;
      existing.reports += 1;
      existing.hours += finite(report.totalLaborHours);

      if (isAdverse(report.weatherCondition) && !isAdverse(existing.condition)) {
        existing.condition = report.weatherCondition;
      }
    } else {
      days.set(day, { day, condition: report.weatherCondition, hours: finite(report.totalLaborHours), reports: 1 });
    }
  }

  if (days.size === 0) {
    return { ok: false, reason: "empty" };
  }

  const all = [...days.values()].sort((a, b) => a.day - b.day);
  const first = all[0]?.day ?? today;
  const latest = all[all.length - 1]?.day ?? null;
  const current = monthOf(today);
  const startMonth = current - (monthsShown - 1);
  const from = monthStart(startMonth);
  const through = today - 1;

  const inWindow = all.filter((entry) => entry.day >= from);
  const normalInWindow = inWindow.filter((entry) => NORMAL.includes(entry.condition) && entry.hours > 0);
  const overall = normalInWindow.length > 0 ? normalInWindow.reduce((sum, entry) => sum + entry.hours, 0) / normalInWindow.length : null;

  const rows: MonthRow[] = [];

  for (let month = startMonth; month <= current; month += 1) {
    const start = monthStart(month);
    const end = monthStart(month + 1) - 1;
    const here = all.filter((entry) => entry.day >= start && entry.day <= end);
    const counts = zero();

    for (const entry of here) {
      counts[entry.condition] += 1;
    }

    const adverseDays = here.filter((entry) => isAdverse(entry.condition));
    const normalDays = here.filter((entry) => NORMAL.includes(entry.condition) && entry.hours > 0);
    const normalHours = normalDays.length > 0 ? normalDays.reduce((sum, entry) => sum + entry.hours, 0) / normalDays.length : null;
    const base = normalHours ?? overall;
    const lost = base === null ? 0 : adverseDays.reduce((sum, entry) => sum + Math.max(0, base - entry.hours), 0);

    let missing = 0;

    for (let day = Math.max(start, first); day <= Math.min(end, through); day += 1) {
      if (weekday(day) !== 0 && weekday(day) !== 6 && !days.has(day)) {
        missing += 1;
      }
    }

    rows.push({
      month,
      label: monthLong(month),
      short: monthShort(month),
      reported: here.length,
      counts,
      adverse: adverseDays.length,
      adverseHours: adverseDays.length > 0 ? adverseDays.reduce((sum, entry) => sum + entry.hours, 0) / adverseDays.length : null,
      normalHours,
      lost,
      missing,
    });
  }

  const adverseAll = inWindow.filter((entry) => isAdverse(entry.condition));
  const worst = rows.reduce<MonthRow | null>((best, row) => (row.adverse > 0 && row.adverse > (best?.adverse ?? 0) ? row : best), null);

  let spell: { length: number; from: number } | null = null;
  let run = 0;
  let runFrom = 0;

  for (const entry of inWindow) {
    const previous = days.get(entry.day - 1);

    if (isAdverse(entry.condition)) {
      if (run > 0 && previous && isAdverse(previous.condition)) {
        run += 1;
      } else {
        run = 1;
        runFrom = entry.day;
      }

      if (spell === null || run > spell.length) {
        spell = { length: run, from: runFrom };
      }
    } else {
      run = 0;
    }
  }

  const gridStart = mondayOf(today) - (WEEKS - 1) * 7;
  const grid: GridCell[][] = [];

  for (let week = 0; week < WEEKS; week += 1) {
    const cells: GridCell[] = [];

    for (let d = 0; d < 7; d += 1) {
      const day = gridStart + week * 7 + d;
      const log = days.get(day);
      const weekend = weekday(day) === 0 || weekday(day) === 6;

      cells.push({
        day,
        kind: log ? "report" : day >= today ? "future" : day < first ? "rest" : weekend ? "rest" : "missing",
        condition: log?.condition ?? null,
        hours: log?.hours ?? 0,
        today: day === today,
      });
    }

    grid.push(cells);
  }

  let delays: WeatherDelay[] | null = null;
  let uncovered: number | null = null;

  if (events !== null) {
    const covered = new Set<number>();
    const list: WeatherDelay[] = [];

    for (const event of events) {
      if (event.cause !== "WEATHER") {
        continue;
      }

      const start = toDay(event.startDate);

      if (!Number.isFinite(start)) {
        continue;
      }

      const endDay = toDay(event.endDate);
      const open = !Number.isFinite(endDay);
      const end = open ? today : Math.min(endDay, today);

      if (end < from || start > today) {
        continue;
      }

      const span = all.filter((entry) => entry.day >= start && entry.day <= end);
      const logged = span.filter((entry) => isAdverse(entry.condition)).length;
      const claimed = Math.max(0, finite(event.forecastDelayDays));

      for (const entry of span) {
        covered.add(entry.day);
      }

      list.push({
        id: event.id,
        reference: event.reference,
        title: event.title,
        from: start,
        to: end,
        open,
        claimed,
        adverseLogged: logged,
        reportedDays: span.length,
        excusable: event.excusable,
        compensable: event.compensable,
        status: event.status,
        verdict: logged === 0 ? "none" : claimed > logged ? "short" : "supported",
      });
    }

    list.sort((a, b) => b.from - a.from || a.reference.localeCompare(b.reference, undefined, { numeric: true }));
    delays = list;
    uncovered = adverseAll.filter((entry) => !covered.has(entry.day)).length;
  }

  return {
    ok: true,
    weather: {
      from,
      to: today,
      months: rows,
      grid,
      reported: inWindow.length,
      adverse: adverseAll.length,
      adverseShare: inWindow.length > 0 ? adverseAll.length / inWindow.length : null,
      lost: rows.reduce((sum, row) => sum + row.lost, 0),
      worst,
      missing: rows.reduce((sum, row) => sum + row.missing, 0),
      longestSpell: spell,
      delays,
      uncovered,
      drafts,
      skipped,
      duplicates,
      latest,
    },
  };
}

export function hoursText(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function verdictText(delay: WeatherDelay): string {
  if (delay.verdict === "none") {
    return delay.reportedDays === 0 ? "No site reports in this period, so nothing backs the claim." : "No adverse weather day is logged in this period.";
  }

  if (delay.verdict === "short") {
    return `Claims ${delay.claimed} ${plural(delay.claimed, "day", "days")} of delay but only ${delay.adverseLogged} adverse ${plural(delay.adverseLogged, "day is", "days are")} logged.`;
  }

  return `${delay.adverseLogged} adverse ${plural(delay.adverseLogged, "day is", "days are")} logged against ${delay.claimed} ${plural(delay.claimed, "day", "days")} claimed.`;
}

export function weatherMarkdown(weather: Weather, projectName: string, today: number): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Weather record: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Site reports from ${formatDay(weather.from)} to ${formatDay(today)}.`, "");
  lines.push(`- ${weather.adverse} adverse weather ${plural(weather.adverse, "day", "days")} in ${weather.reported} reported ${plural(weather.reported, "day", "days")} (${pct(weather.adverseShare)})`);
  lines.push(`- About ${hoursText(weather.lost)} labour hours below a normal day on those days`);
  lines.push(`- ${weather.missing} ${plural(weather.missing, "weekday", "weekdays")} with no site report`, "");

  lines.push("| Month | Reported | Clear | Cloudy | Rain | Wind | Heat | Cold | Other | Adverse | No report |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const row of weather.months) {
    lines.push(`| ${row.label} | ${row.reported} | ${row.counts.CLEAR} | ${row.counts.CLOUDY} | ${row.counts.RAIN} | ${row.counts.WIND} | ${row.counts.EXTREME_HEAT} | ${row.counts.EXTREME_COLD} | ${row.counts.OTHER} | ${row.adverse} | ${row.missing} |`);
  }

  if (weather.delays !== null && weather.delays.length > 0) {
    lines.push("", "Weather delay events:", "");

    for (const delay of weather.delays) {
      lines.push(`- ${cell(delay.reference)} ${cell(trunc(delay.title, 60))}, ${formatDay(delay.from)} to ${delay.open ? "open" : formatDay(delay.to)}: ${verdictText(delay)} ${words(delay.status)}${delay.excusable ? ", excusable" : ""}${delay.compensable ? ", compensable" : ""}.`);
    }
  }

  lines.push(
    "",
    "An adverse day is a site report recording rain, wind, extreme heat or extreme cold. Labour hours below a normal day compare each adverse day with the average labour on clear or cloudy days in the same month, and are only an indication. Draft reports are left out, and where a day has several reports the adverse condition is used. A weekday with no report cannot be evidenced either way.",
    "",
  );

  return lines.join("\n");
}
