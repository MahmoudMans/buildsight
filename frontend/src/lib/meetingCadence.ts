import { DAY_MS, formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { GovernanceControl, GovernanceMeeting, GovernanceMeetingType } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 180;
export const AHEAD = 28;
export const LAPSE = 1.5;
export const MIN_HELD = 3;
export const PAGE = 10;

export type Rhythm = "onRhythm" | "slipping" | "lapsed" | "occasional" | "none";
export type Kind = "held" | "cancelled" | "missed" | "upcoming";
export type Filter = "all" | "attention";

export const RHYTHM_LABEL: Record<Rhythm, string> = {
  onRhythm: "On rhythm",
  slipping: "Slipping",
  lapsed: "Lapsed",
  occasional: "Occasional",
  none: "Not held yet",
};

export const KIND_LABEL: Record<Kind, string> = {
  held: "Held",
  cancelled: "Cancelled",
  missed: "Not held",
  upcoming: "Planned",
};

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All types" },
  { key: "attention", label: "Need attention" },
];

export const TYPE_LABEL: Record<GovernanceMeetingType, string> = {
  PROGRESS: "Progress",
  COORDINATION: "Coordination",
  DESIGN: "Design",
  COMMERCIAL: "Commercial",
  HSE: "Health and safety",
  QUALITY: "Quality",
  EXECUTIVE: "Executive",
  OTHER: "Other",
};

export interface Event {
  id: string;
  number: string;
  title: string;
  type: GovernanceMeetingType;
  kind: Kind;
  day: number;
  scheduled: number;
  minutesMissing: boolean;
  late: number | null;
}

export interface TypeRow {
  type: GovernanceMeetingType;
  label: string;
  rhythm: Rhythm;
  events: Event[];
  held: number;
  cancelled: number;
  upcoming: number;
  minutesMissing: number;
  onDay: number | null;
  gap: number | null;
  lastHeld: number | null;
  sinceLast: number | null;
  next: number | null;
  nextSource: "booked" | "minutes" | null;
  missed: number;
  missedSinceLast: number;
}

export interface Cadence {
  from: number;
  to: number;
  types: TypeRow[];
  missed: Event[];
  held: number;
  minutesMissing: number;
  onRhythm: number;
  attention: number;
  skipped: number;
  future: number;
}

export type CadenceResult = { ok: true; cadence: Cadence } | { ok: false; reason: "empty" };

const ORDER: Rhythm[] = ["lapsed", "slipping", "onRhythm", "occasional", "none"];

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function needsAttention(row: TypeRow): boolean {
  return row.rhythm === "lapsed" || row.rhythm === "slipping";
}

function rowFor(type: GovernanceMeetingType, meetings: GovernanceMeeting[], today: number, from: number, to: number): { row: TypeRow; skipped: number; future: number } {
  let skipped = 0;
  let future = 0;
  const events: Event[] = [];
  const heldDays: number[] = [];
  const heldAll: Array<{ day: number; next: number | null }> = [];
  const missedAll: Event[] = [];
  let upcomingAll: number | null = null;
  let onDayCount = 0;
  let onDayBase = 0;

  for (const meeting of meetings) {
    const scheduled = toDay(meeting.scheduledAt);
    const heldAt = toDay(meeting.heldAt);

    if (meeting.status === "HELD") {
      const day = Number.isFinite(heldAt) ? heldAt : scheduled;

      if (!Number.isFinite(day)) {
        skipped += 1;
        continue;
      }

      if (day > today) {
        future += 1;
        continue;
      }

      heldAll.push({ day, next: Number.isFinite(toDay(meeting.nextMeetingAt)) ? toDay(meeting.nextMeetingAt) : null });

      if (day >= from) {
        heldDays.push(day);

        if (Number.isFinite(heldAt) && Number.isFinite(scheduled)) {
          onDayBase += 1;

          if (heldAt === scheduled) {
            onDayCount += 1;
          }
        }

        events.push({ id: meeting.id, number: meeting.meetingNumber, title: meeting.title, type, kind: "held", day, scheduled: Number.isFinite(scheduled) ? scheduled : day, minutesMissing: meeting.missingMinutes, late: Number.isFinite(scheduled) ? Math.max(0, day - scheduled) : null });
      }

      continue;
    }

    if (!Number.isFinite(scheduled)) {
      skipped += 1;
      continue;
    }

    if (meeting.status === "CANCELLED") {
      if (scheduled >= from && scheduled <= to) {
        events.push({ id: meeting.id, number: meeting.meetingNumber, title: meeting.title, type, kind: "cancelled", day: scheduled, scheduled, minutesMissing: false, late: null });
      }

      continue;
    }

    if (scheduled < today) {
      const event: Event = { id: meeting.id, number: meeting.meetingNumber, title: meeting.title, type, kind: "missed", day: scheduled, scheduled, minutesMissing: false, late: today - scheduled };

      missedAll.push(event);

      if (scheduled >= from) {
        events.push(event);
      }

      continue;
    }

    if (upcomingAll === null || scheduled < upcomingAll) {
      upcomingAll = scheduled;
    }

    if (scheduled <= to) {
      events.push({ id: meeting.id, number: meeting.meetingNumber, title: meeting.title, type, kind: "upcoming", day: scheduled, scheduled, minutesMissing: false, late: null });
    }
  }

  const days = [...new Set(heldDays)].sort((a, b) => a - b);
  const gaps = days.slice(1).map((day, index) => day - (days[index] as number));
  const gap = days.length >= MIN_HELD ? median(gaps) : null;
  const latest = heldAll.sort((a, b) => b.day - a.day)[0];
  const lastHeld = latest ? latest.day : null;
  const sinceLast = lastHeld !== null ? today - lastHeld : null;
  const minutesNext = latest && latest.next !== null && latest.next >= today ? latest.next : null;
  const next = upcomingAll ?? minutesNext;
  const missedSinceLast = missedAll.filter((event) => lastHeld === null || event.day > lastHeld).length;
  let rhythm: Rhythm;

  if (lastHeld === null) {
    rhythm = "none";
  } else if (gap === null) {
    rhythm = "occasional";
  } else if (next === null && sinceLast !== null && sinceLast > gap * LAPSE) {
    rhythm = "lapsed";
  } else if ((sinceLast !== null && sinceLast > gap * LAPSE) || missedSinceLast > 0) {
    rhythm = "slipping";
  } else {
    rhythm = "onRhythm";
  }

  events.sort((a, b) => a.day - b.day);

  return {
    skipped,
    future,
    row: {
      type,
      label: TYPE_LABEL[type] ?? type,
      rhythm,
      events,
      held: days.length === 0 ? 0 : events.filter((event) => event.kind === "held").length,
      cancelled: events.filter((event) => event.kind === "cancelled").length,
      upcoming: events.filter((event) => event.kind === "upcoming").length,
      minutesMissing: events.filter((event) => event.kind === "held" && event.minutesMissing).length,
      onDay: onDayBase > 0 ? onDayCount / onDayBase : null,
      gap,
      lastHeld,
      sinceLast,
      next,
      nextSource: upcomingAll !== null ? "booked" : minutesNext !== null ? "minutes" : null,
      missed: missedAll.length,
      missedSinceLast,
    },
  };
}

export function buildCadence(data: GovernanceControl, today: number, windowDays: number): CadenceResult {
  const meetings = data.meetings ?? [];

  if (meetings.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const from = today - windowDays + 1;
  const to = today + AHEAD;
  const byType = new Map<GovernanceMeetingType, GovernanceMeeting[]>();

  for (const meeting of meetings) {
    byType.set(meeting.meetingType, [...(byType.get(meeting.meetingType) ?? []), meeting]);
  }

  const types: TypeRow[] = [];
  let skipped = 0;
  let future = 0;

  for (const [type, list] of byType) {
    const built = rowFor(type, list, today, from, to);

    types.push(built.row);
    skipped += built.skipped;
    future += built.future;
  }

  types.sort((a, b) => ORDER.indexOf(a.rhythm) - ORDER.indexOf(b.rhythm) || (b.sinceLast ?? -1) - (a.sinceLast ?? -1) || a.label.localeCompare(b.label));

  const missed: Event[] = [];

  for (const meeting of meetings) {
    if (meeting.status !== "PLANNED") {
      continue;
    }

    const scheduled = toDay(meeting.scheduledAt);

    if (Number.isFinite(scheduled) && scheduled < today) {
      missed.push({ id: meeting.id, number: meeting.meetingNumber, title: meeting.title, type: meeting.meetingType, kind: "missed", day: scheduled, scheduled, minutesMissing: false, late: today - scheduled });
    }
  }

  missed.sort((a, b) => b.day - a.day || a.number.localeCompare(b.number, undefined, { numeric: true }));

  return {
    ok: true,
    cadence: {
      from,
      to,
      types,
      missed,
      held: types.reduce((sum, row) => sum + row.held, 0),
      minutesMissing: types.reduce((sum, row) => sum + row.minutesMissing, 0),
      onRhythm: types.filter((row) => row.rhythm === "onRhythm").length,
      attention: types.filter(needsAttention).length,
      skipped,
      future,
    },
  };
}

export function filterTypes(rows: TypeRow[], filter: Filter): TypeRow[] {
  return filter === "attention" ? rows.filter(needsAttention) : rows;
}

export function daysText(value: number): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);

  return `${text} ${plural(value, "day", "days")}`;
}

export function gapText(gap: number | null): string {
  if (gap === null) {
    return "no regular pattern yet";
  }

  const days = Math.round(gap);

  if (days >= 6 && days <= 8) {
    return "about weekly";
  }

  if (days >= 12 && days <= 16) {
    return "about fortnightly";
  }

  if (days >= 26 && days <= 35) {
    return "about monthly";
  }

  return `about every ${daysText(days)}`;
}

export function reasonText(row: TypeRow): string {
  const usual = row.gap !== null ? daysText(Math.round(row.gap)) : "";

  if (row.rhythm === "lapsed" && row.sinceLast !== null) {
    return `Nothing is booked and it last met ${daysText(row.sinceLast)} ago, against a usual gap of ${usual}.`;
  }

  if (row.rhythm === "slipping") {
    const parts: string[] = [];

    if (row.missedSinceLast > 0) {
      parts.push(`${row.missedSinceLast} booked ${plural(row.missedSinceLast, "meeting has", "meetings have")} passed without being recorded as held.`);
    }

    if (row.sinceLast !== null && row.gap !== null && row.sinceLast > row.gap * LAPSE) {
      parts.push(`It last met ${daysText(row.sinceLast)} ago, against a usual gap of ${usual}.`);
    }

    return parts.join(" ");
  }

  if (row.rhythm === "occasional") {
    return row.held === 0 ? "Not held in this period, so no rhythm can be judged." : `Held ${row.held} ${plural(row.held, "time", "times")} in this period, too few to judge a rhythm.`;
  }

  if (row.rhythm === "none") {
    return "None has been recorded as held.";
  }

  return "";
}

export function agoText(day: number, today: number): string {
  const gap = today - day;

  return gap === 0 ? "today" : gap > 0 ? `${daysText(gap)} ago` : `in ${daysText(-gap)}`;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function monthTicks(from: number, to: number): Array<{ day: number; label: string }> {
  const ticks: Array<{ day: number; label: string }> = [];
  const start = new Date(from * DAY_MS);
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth() + 1;

  if (month > 11) {
    month = 0;
    year += 1;
  }

  const format = (date: Date, withYear: boolean) => new Intl.DateTimeFormat("en-GB", { month: "short", ...(withYear ? { year: "2-digit" as const } : {}), timeZone: "UTC" }).format(date);

  for (let step = 0; step < 40; step += 1) {
    const date = new Date(Date.UTC(year, month + step, 1));
    const day = Math.floor(date.getTime() / DAY_MS);

    if (day > to) {
      break;
    }

    ticks.push({ day, label: format(date, ticks.length === 0 || date.getUTCMonth() === 0) });
  }

  return ticks;
}

export function cadenceMarkdown(rows: TypeRow[], missed: Event[], projectName: string, today: number, windowLabel: string): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Meeting cadence: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Meetings over the last ${windowLabel}.`, "");
  lines.push("| Meeting type | Rhythm | Usual gap | Last held | Next | Held | Cancelled | Not held |", "| --- | --- | --- | --- | --- | ---: | ---: | ---: |");

  for (const row of rows) {
    lines.push(`| ${cell(row.label)} | ${RHYTHM_LABEL[row.rhythm]} | ${row.gap === null ? "—" : gapText(row.gap).replace("about ", "")} | ${row.lastHeld !== null ? formatDay(row.lastHeld) : "never"} | ${row.next !== null ? formatDay(row.next) : "nothing booked"} | ${row.held} | ${row.cancelled} | ${row.missed} |`);
  }

  lines.push("");

  if (missed.length > 0) {
    lines.push("Meetings scheduled in the past and never recorded as held or cancelled:", "", "| Meeting | Type | Scheduled | Overdue |", "| --- | --- | --- | ---: |");

    for (const event of missed.slice(0, 15)) {
      lines.push(`| ${cell(event.number)} ${cell(trunc(event.title, 40))} | ${TYPE_LABEL[event.type] ?? event.type} | ${formatDay(event.day)} | ${daysText(event.late ?? 0)} |`);
    }

    lines.push("");
  }

  lines.push(
    `A meeting type has a usual gap once it has been held ${MIN_HELD} or more times in the period; the gap is the median number of days between one held meeting and the next. A type is lapsed when nothing is booked and the time since it last met is more than ${LAPSE} times the usual gap, and slipping when it is that overdue with a meeting booked, or when a booked meeting has passed without being recorded as held. Types held fewer than ${MIN_HELD} times are occasional, so no rhythm is judged. Not held means a meeting still marked as planned although its date has passed, which is usually a meeting that took place but was never recorded, or one that was never cancelled in the register.`,
    "",
  );

  return lines.join("\n");
}
