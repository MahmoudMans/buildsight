const DAY_MS = 86_400_000;
const MAX_OCTETS = 75;

export interface IcsEvent {
  uid: string;
  day: number;
  summary: string;
  description?: string;
  categories?: string;
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

function octets(char: string): number {
  return new TextEncoder().encode(char).length;
}

function fold(line: string): string {
  if (new TextEncoder().encode(line).length <= MAX_OCTETS) {
    return line;
  }

  const pieces: string[] = [];
  let current = "";
  let used = 0;

  for (const char of line) {
    const size = octets(char);
    const limit = pieces.length === 0 ? MAX_OCTETS : MAX_OCTETS - 1;

    if (used + size > limit) {
      pieces.push(current);
      current = "";
      used = 0;
    }

    current += char;
    used += size;
  }

  pieces.push(current);

  return pieces.join("\r\n ");
}

function dateValue(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10).replace(/-/g, "");
}

function stamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildIcs(events: ReadonlyArray<IcsEvent>, calendarName: string, now: Date = new Date()): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BuildSight//Project calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(calendarName)}`,
  ];

  for (const event of events) {
    if (!Number.isFinite(event.day)) {
      continue;
    }

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid.replace(/[^A-Za-z0-9._@-]/g, "-")}@buildsight`);
    lines.push(`DTSTAMP:${stamp(now)}`);
    lines.push(`DTSTART;VALUE=DATE:${dateValue(event.day)}`);
    lines.push(`DTEND;VALUE=DATE:${dateValue(event.day + 1)}`);
    lines.push(`SUMMARY:${escapeText(event.summary)}`);

    if (event.description) {
      lines.push(`DESCRIPTION:${escapeText(event.description)}`);
    }

    if (event.categories) {
      lines.push(`CATEGORIES:${escapeText(event.categories)}`);
    }

    lines.push("TRANSP:TRANSPARENT");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  return `${lines.map(fold).join("\r\n")}\r\n`;
}

export function icsFileName(name: string, stamped: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return `${base || "project"}-calendar-${stamped}.ics`;
}

export function downloadIcs(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
