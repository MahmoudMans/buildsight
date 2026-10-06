import { formatDay, plural, toDay, trunc, words } from "@/lib/openItems";
import type { DelayCause, DelayStatus, ProductionControl, ProjectDelayEvent, SiteReportStatus, WeatherCondition } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 30, label: "30 days" },
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
];

export const DEFAULT_WINDOW = 90;
export const MIN_NOTE_CHARS = 20;
export const MIN_NOTE_WORDS = 4;
export const MIN_COPY_CHARS = 10;
export const DOCUMENTED = 0.5;
export const PAGE = 10;

export type Flag = "noNotes" | "thinNotes" | "copied" | "weatherMismatch" | "unloggedDelay";
export type State = "ok" | "thin" | "copied" | "missing";
export type Filter = "all" | "notes" | "copied" | "weather" | "unlogged";
export type Evidence = "none" | "noReports" | "thin" | "documented";

export const FLAG_ORDER: Flag[] = ["noNotes", "thinNotes", "copied", "weatherMismatch", "unloggedDelay"];

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All reports" },
  { key: "notes", label: "Notes missing or thin" },
  { key: "copied", label: "Copied notes" },
  { key: "weather", label: "Weather mismatch" },
  { key: "unlogged", label: "Possible unlogged delay" },
];

export const EVIDENCE_ORDER: Evidence[] = ["none", "noReports", "thin", "documented"];

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  none: "Not mentioned in any report",
  noReports: "No site report in the period",
  thin: "Mentioned in a few reports",
  documented: "Well documented",
};

const PLACEHOLDER = /^(n a|na|none|nil|ok|okay|normal|normal day|as usual|same|same as yesterday|no comments?|nothing|nothing to report|no issues?|tbc|tbd|x+)$/;
const NEGATED = /\b(?:no|not|without|nil|zero|never)\s+(?:\w+\s+){0,2}?(?:delays?|delayed|stoppages?|stopped|waiting|idle|rain|raining|rained|rainy|winds?|windy|showers?)\b/g;
const DELAY_WORDS = /\b(?:delay|delays|delayed|waiting|waited|held up|hold up|on hold|stopped|stoppage|stood down|idle|unable to|could not|couldn t|couldn't|no access|blocked|postponed|standing time|lost time|lost day)\b/;
const RAIN_WORDS = /\b(?:rain|rains|rained|raining|rainy|shower|showers|downpour|storm|stormy|flooded|flooding|drizzle|wet weather)\b/;
const WIND_WORDS = /\b(?:wind|winds|windy|gust|gusts|gusty)\b/;
const RAIN_CONTRADICTS: WeatherCondition[] = ["CLEAR", "CLOUDY", "EXTREME_HEAT"];

export interface Row {
  key: string;
  reference: string;
  day: number;
  status: SiteReportStatus;
  condition: WeatherCondition;
  notes: string | null;
  wordCount: number;
  state: State;
  flags: Flag[];
  copyOf: { reference: string; day: number } | null;
  delayMention: boolean;
  weatherNote: string | null;
}

export interface DelayRow {
  key: string;
  reference: string;
  title: string;
  cause: DelayCause;
  status: DelayStatus;
  start: number;
  end: number;
  days: number;
  reports: number;
  mentions: number;
  share: number | null;
  evidence: Evidence;
}

export interface Strip {
  key: string;
  day: number;
  state: State;
}

export interface Diary {
  from: number;
  to: number;
  rows: Row[];
  delays: DelayRow[];
  strip: Strip[];
  delaysKnown: boolean;
  judged: number;
  original: number;
  originalShare: number | null;
  thin: number;
  missing: number;
  copied: number;
  weatherMismatch: number;
  unlogged: number;
  documented: number;
  notMentioned: number;
  drafts: number;
  skipped: number;
  future: number;
  delaysFuture: number;
  delaysSkipped: number;
}

export type DiaryResult = { ok: true; data: Diary } | { ok: false; reason: "noReports" };

function before(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function norm(text: string | null | undefined): string {
  return (text ?? "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function noteState(text: string | null | undefined): "missing" | "thin" | "ok" {
  const clean = norm(text);

  if (clean.length === 0 || PLACEHOLDER.test(clean)) {
    return "missing";
  }

  const trimmed = (text ?? "").trim();

  return trimmed.length < MIN_NOTE_CHARS || clean.split(" ").length < MIN_NOTE_WORDS ? "thin" : "ok";
}

function stripNegated(text: string | null | undefined): string {
  return (text ?? "").toLowerCase().replace(NEGATED, " ");
}

export function mentionsDelay(text: string | null | undefined): boolean {
  return DELAY_WORDS.test(stripNegated(text));
}

export function mentionsRain(text: string | null | undefined): boolean {
  return RAIN_WORDS.test(stripNegated(text));
}

export function mentionsWind(text: string | null | undefined): boolean {
  return WIND_WORDS.test(stripNegated(text));
}

function weatherNoteOf(text: string | null | undefined, condition: WeatherCondition): string | null {
  if (mentionsRain(text) && RAIN_CONTRADICTS.includes(condition)) {
    return `Notes mention rain, weather recorded as ${words(condition).toLowerCase()}`;
  }

  if (mentionsWind(text) && condition === "CLEAR") {
    return "Notes mention wind, weather recorded as clear";
  }

  return null;
}

function spanOf(delay: ProjectDelayEvent, today: number): { start: number; end: number } | null {
  const start = toDay(delay.startDate);

  if (!Number.isFinite(start)) {
    return null;
  }

  const finish = toDay(delay.endDate);
  const forecast = Number.isFinite(delay.forecastDelayDays) ? delay.forecastDelayDays : 0;
  const raw = Number.isFinite(finish) && finish >= start ? finish : start + Math.max(forecast, 1) - 1;

  return { start, end: Math.min(raw, today) };
}

export function buildDiary(production: ProductionControl, delays: ProjectDelayEvent[] | null, today: number, windowDays: number): DiaryResult {
  const reports = production.siteReports ?? [];
  const submitted = reports.filter((report) => report.status !== "DRAFT");

  if (submitted.length === 0) {
    return { ok: false, reason: "noReports" };
  }

  const from = today - windowDays + 1;
  let skipped = 0;
  let future = 0;
  let drafts = 0;

  const dated: Array<{ report: (typeof reports)[number]; day: number }> = [];

  for (const report of reports) {
    const day = toDay(report.reportDate);

    if (!Number.isFinite(day)) {
      skipped += 1;
      continue;
    }

    if (day > today) {
      future += 1;
      continue;
    }

    if (report.status === "DRAFT") {
      if (day >= from) {
        drafts += 1;
      }

      continue;
    }

    dated.push({ report, day });
  }

  dated.sort((a, b) => a.day - b.day || before(a.report.reference, b.report.reference) || before(a.report.id, b.report.id));

  const first = new Map<string, { reference: string; day: number }>();
  const rows: Row[] = [];
  const known = delays !== null;
  const spans = (delays ?? []).map((delay) => spanOf(delay, today)).filter((span): span is { start: number; end: number } => span !== null);

  for (const { report, day } of dated) {
    const text = report.generalNotes;
    const kind = noteState(text);
    const key = norm(text);
    let copyOf: { reference: string; day: number } | null = null;

    if (kind !== "missing" && key.length >= MIN_COPY_CHARS) {
      const earlier = first.get(key);

      if (earlier) {
        copyOf = earlier;
      } else {
        first.set(key, { reference: report.reference, day });
      }
    }

    if (day < from) {
      continue;
    }

    const delayMention = mentionsDelay(text);
    const weatherNote = weatherNoteOf(text, report.weatherCondition);
    const flags: Flag[] = [];

    if (kind === "missing") {
      flags.push("noNotes");
    }

    if (kind === "thin") {
      flags.push("thinNotes");
    }

    if (copyOf) {
      flags.push("copied");
    }

    if (weatherNote) {
      flags.push("weatherMismatch");
    }

    if (known && delayMention && !spans.some((span) => day >= span.start && day <= span.end)) {
      flags.push("unloggedDelay");
    }

    const trimmed = (text ?? "").trim();

    rows.push({
      key: report.id,
      reference: report.reference,
      day,
      status: report.status,
      condition: report.weatherCondition,
      notes: trimmed.length > 0 ? trimmed : null,
      wordCount: key.length > 0 ? key.split(" ").length : 0,
      state: kind === "missing" ? "missing" : copyOf ? "copied" : kind === "thin" ? "thin" : "ok",
      flags: FLAG_ORDER.filter((flag) => flags.includes(flag)),
      copyOf,
      delayMention,
      weatherNote,
    });
  }

  const strip: Strip[] = [...rows].sort((a, b) => a.day - b.day || before(a.reference, b.reference)).map((row) => ({ key: row.key, day: row.day, state: row.state }));

  rows.sort((a, b) => b.flags.length - a.flags.length || b.day - a.day || before(a.reference, b.reference));

  const delayRows: DelayRow[] = [];
  let delaysFuture = 0;
  let delaysSkipped = 0;

  for (const delay of delays ?? []) {
    const span = spanOf(delay, today);

    if (span === null) {
      delaysSkipped += 1;
      continue;
    }

    if (span.start > today) {
      delaysFuture += 1;
      continue;
    }

    const lo = Math.max(span.start, from);
    const hi = Math.min(span.end, today);

    if (lo > hi) {
      continue;
    }

    const inside = rows.filter((row) => row.day >= lo && row.day <= hi);
    const mentions = inside.filter((row) => row.delayMention).length;
    const share = inside.length > 0 ? mentions / inside.length : null;

    delayRows.push({
      key: delay.id,
      reference: delay.reference,
      title: delay.title,
      cause: delay.cause,
      status: delay.status,
      start: span.start,
      end: span.end,
      days: hi - lo + 1,
      reports: inside.length,
      mentions,
      share,
      evidence: inside.length === 0 ? "noReports" : mentions === 0 ? "none" : (share as number) >= DOCUMENTED ? "documented" : "thin",
    });
  }

  delayRows.sort((a, b) => EVIDENCE_ORDER.indexOf(a.evidence) - EVIDENCE_ORDER.indexOf(b.evidence) || b.days - a.days || before(a.reference, b.reference) || before(a.key, b.key));

  const original = rows.filter((row) => row.state === "ok").length;

  return {
    ok: true,
    data: {
      from,
      to: today,
      rows,
      delays: delayRows,
      strip,
      delaysKnown: known,
      judged: rows.length,
      original,
      originalShare: rows.length > 0 ? original / rows.length : null,
      thin: rows.filter((row) => row.state === "thin").length,
      missing: rows.filter((row) => row.state === "missing").length,
      copied: rows.filter((row) => row.flags.includes("copied")).length,
      weatherMismatch: rows.filter((row) => row.flags.includes("weatherMismatch")).length,
      unlogged: rows.filter((row) => row.flags.includes("unloggedDelay")).length,
      documented: delayRows.filter((row) => row.evidence === "documented").length,
      notMentioned: delayRows.filter((row) => row.evidence === "none").length,
      drafts,
      skipped,
      future,
      delaysFuture,
      delaysSkipped,
    },
  };
}

export function filterRows(rows: Row[], filter: Filter): Row[] {
  if (filter === "notes") {
    return rows.filter((row) => row.flags.includes("noNotes") || row.flags.includes("thinNotes"));
  }

  if (filter === "copied") {
    return rows.filter((row) => row.flags.includes("copied"));
  }

  if (filter === "weather") {
    return rows.filter((row) => row.flags.includes("weatherMismatch"));
  }

  if (filter === "unlogged") {
    return rows.filter((row) => row.flags.includes("unloggedDelay"));
  }

  return rows;
}

export function flagText(flag: Flag, row: Row): string {
  if (flag === "noNotes") {
    return "No notes written";
  }

  if (flag === "thinNotes") {
    return "Notes too thin to be useful";
  }

  if (flag === "copied") {
    return row.copyOf ? `Same notes as ${row.copyOf.reference} (${formatDay(row.copyOf.day)})` : "Same notes as an earlier report";
  }

  if (flag === "weatherMismatch") {
    return row.weatherNote ?? "Notes and weather disagree";
  }

  return "Mentions a delay that is not in the delay register";
}

export function diaryMarkdown(data: Diary, shown: Row[], projectName: string, windowLabel: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Site diary evidence: ${projectName}`, "");
  lines.push(`${data.judged} submitted site ${plural(data.judged, "report", "reports")} in the last ${windowLabel}, from ${formatDay(data.from)} to ${formatDay(data.to)}.`, "");
  lines.push(`- ${data.original} of ${data.judged} have original, useful notes (${pct(data.originalShare)}); ${data.missing} have none, ${data.thin} are too thin, ${data.copied} repeat an earlier report word for word`);
  lines.push(`- ${data.weatherMismatch} ${plural(data.weatherMismatch, "report has notes that contradict", "reports have notes that contradict")} the weather recorded`);

  if (data.delaysKnown) {
    lines.push(`- ${data.unlogged} ${plural(data.unlogged, "report mentions a delay", "reports mention a delay")} on a day with no delay event in the register`);
    lines.push(`- ${data.documented} of ${data.delays.length} delay ${plural(data.delays.length, "event", "events")} in the period ${plural(data.documented, "is", "are")} well documented in the diary; ${data.notMentioned} ${plural(data.notMentioned, "is", "are")} not mentioned at all`);
  } else {
    lines.push("- The delay register could not be read, so delay evidence was not checked");
  }

  lines.push("");

  if (data.delays.length > 0) {
    lines.push("| Delay | Cause | Reports in the period | Mention a delay | Evidence |", "| --- | --- | ---: | ---: | --- |");

    for (const delay of data.delays.slice(0, 15)) {
      lines.push(`| ${cell(delay.reference)} ${cell(trunc(delay.title, 30))} | ${words(delay.cause)} | ${delay.reports} | ${delay.mentions} | ${EVIDENCE_LABEL[delay.evidence]} |`);
    }

    lines.push("");
  }

  if (shown.length > 0) {
    lines.push(filterLabel ? `Reports (${filterLabel.toLowerCase()}):` : "Reports:", "", "| Report | Date | Weather | Problems |", "| --- | --- | --- | --- |");

    for (const row of shown.slice(0, 25)) {
      lines.push(`| ${cell(row.reference)} | ${formatDay(row.day)} | ${words(row.condition)} | ${row.flags.map((flag) => flagText(flag, row)).join("; ") || "—"} |`);
    }

    lines.push("");
  }

  lines.push(
    `Draft reports are not judged. Notes count as missing when empty or a placeholder such as "normal day", and as thin when under ${MIN_NOTE_CHARS} characters or ${MIN_NOTE_WORDS} words. A report is a copy when its notes are word for word the same as an earlier report's. A report mentions a delay when the notes use words such as "delayed", "waiting", "stopped" or "stood down" (phrases such as "no delays" are ignored). A delay event runs from its start to its end date, or for its forecast days when no end date is set, up to today; it is well documented when at least ${Math.round(DOCUMENTED * 100)}% of the reports in that span mention a delay. The checks read the wording only, so treat them as prompts to look, not as findings.`,
    "",
  );

  return lines.join("\n");
}
