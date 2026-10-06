import { formatDay, plural, toDay, trunc, words } from "@/lib/openItems";
import type { SafetyControl, WorkPermitStatus, WorkPermitType } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 180;
export const MIN_TEXT = 5;
export const MIN_NAME = 2;
export const MIN_GROUP = 3;
export const GOOD = 0.9;
export const WATCH = 0.7;
export const PAGE = 10;
export const LONG_DAYS = 14;

export type Flag = "closedLate" | "openPast" | "noControls" | "noIssuer" | "noReceiver" | "noLocation" | "closedBeforeStart" | "noCloseDate" | "longLived";
export type Filter = "all" | "late" | "stale" | "controls" | "names" | "long";

export const FLAG_ORDER: Flag[] = ["closedLate", "openPast", "noControls", "noIssuer", "noReceiver", "noLocation", "closedBeforeStart", "noCloseDate", "longLived"];

export const FLAG_LABEL: Record<Flag, string> = {
  closedLate: "Closed after expiry",
  openPast: "Open past expiry",
  noControls: "No controls recorded",
  noIssuer: "No issuer recorded",
  noReceiver: "No receiver recorded",
  noLocation: "No location recorded",
  closedBeforeStart: "Closed before it started",
  noCloseDate: "No close date",
  longLived: `Valid over ${LONG_DAYS} days`,
};

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All permits" },
  { key: "late", label: "Closed late" },
  { key: "stale", label: "Open past expiry" },
  { key: "controls", label: "No controls" },
  { key: "names", label: "Names or place missing" },
  { key: "long", label: "Long permits" },
];

const PLACEHOLDER = /^(n\/?a|none|nil|ok|okay|done|closed|tbd|unknown|-+|\.+|x+)$/i;
const OPEN: WorkPermitStatus[] = ["ACTIVE", "SUSPENDED"];
const ISSUED: WorkPermitStatus[] = ["ACTIVE", "SUSPENDED", "CLOSED"];

export interface Row {
  key: string;
  reference: string;
  title: string;
  type: WorkPermitType;
  location: string | null;
  issuer: string | null;
  receiver: string | null;
  status: WorkPermitStatus;
  from: number;
  until: number;
  validDays: number;
  closed: number | null;
  daysLate: number | null;
  daysPast: number | null;
  controls: string | null;
  measured: boolean;
  onTime: boolean;
  flags: Flag[];
  clean: boolean;
  serious: boolean;
}

export interface Group {
  key: string;
  label: string;
  count: number;
  clean: number;
  share: number | null;
}

export interface Discipline {
  from: number;
  to: number;
  rows: Row[];
  types: Group[];
  receivers: Group[];
  permits: number;
  closed: number;
  measured: number;
  onTime: number;
  onTimeShare: number | null;
  late: number;
  openPast: number;
  noControls: number;
  highRisk: number;
  clean: number;
  staleOutside: string[];
  liveNoControls: string[];
  drafts: number;
  cancelled: number;
  skipped: number;
  future: number;
}

export type DisciplineResult = { ok: true; data: Discipline } | { ok: false; reason: "noPermits" };

export function recorded(value: string | null | undefined, min: number): boolean {
  const text = (value ?? "").trim();

  return text.length >= min && !PLACEHOLDER.test(text);
}

function clean(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();

  return text.length > 0 ? text : null;
}

export function typeLabel(type: WorkPermitType): string {
  return words(type);
}

function before(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function groupOf(key: string, label: string, rows: Row[]): Group {
  const done = rows.filter((row) => row.clean).length;

  return { key, label, count: rows.length, clean: done, share: rows.length > 0 ? done / rows.length : null };
}

export function bandOf(group: { count: number; share: number | null }): "good" | "watch" | "bad" | null {
  if (group.share === null || group.count < MIN_GROUP) {
    return null;
  }

  return group.share >= GOOD ? "good" : group.share >= WATCH ? "watch" : "bad";
}

export function buildDiscipline(data: SafetyControl, today: number, windowDays: number): DisciplineResult {
  const all = data.permits ?? [];
  const drafts = all.filter((item) => item.status === "DRAFT").length;
  const cancelled = all.filter((item) => item.status === "CANCELLED").length;
  const issued = all.filter((item) => ISSUED.includes(item.status));

  if (issued.length === 0) {
    return { ok: false, reason: "noPermits" };
  }

  const windowFrom = today - windowDays + 1;
  const rows: Row[] = [];
  const staleOutside: string[] = [];
  const liveNoControls: string[] = [];
  let skipped = 0;
  let future = 0;

  for (const item of issued) {
    const from = toDay(item.validFrom);
    const until = toDay(item.validUntil);

    if (!Number.isFinite(from) || !Number.isFinite(until)) {
      skipped += 1;
      continue;
    }

    if (from > today) {
      future += 1;
      continue;
    }

    const open = OPEN.includes(item.status);
    const highRisk = item.permitType !== "GENERAL";

    if (item.status === "ACTIVE" && until >= today && highRisk && !recorded(item.controls, MIN_TEXT)) {
      liveNoControls.push(item.reference);
    }

    if (from < windowFrom) {
      if (open && until < today) {
        staleOutside.push(item.reference);
      }

      continue;
    }

    const closedDay = item.status === "CLOSED" ? toDay(item.closedDate) : NaN;
    const closedKnown = Number.isFinite(closedDay);
    const measured = item.status === "CLOSED" && closedKnown && closedDay >= from;
    const flags = new Set<Flag>();

    if (measured && closedDay > until) {
      flags.add("closedLate");
    }

    if (open && until < today) {
      flags.add("openPast");
    }

    if (highRisk && !recorded(item.controls, MIN_TEXT)) {
      flags.add("noControls");
    }

    if (!recorded(item.issuerName, MIN_NAME)) {
      flags.add("noIssuer");
    }

    if (!recorded(item.receiverName, MIN_NAME)) {
      flags.add("noReceiver");
    }

    if (!recorded(item.location, MIN_NAME)) {
      flags.add("noLocation");
    }

    if (item.status === "CLOSED" && closedKnown && closedDay < from) {
      flags.add("closedBeforeStart");
    }

    if (item.status === "CLOSED" && !closedKnown) {
      flags.add("noCloseDate");
    }

    if (until - from + 1 > LONG_DAYS) {
      flags.add("longLived");
    }

    const ordered = FLAG_ORDER.filter((flag) => flags.has(flag));

    rows.push({
      key: item.id,
      reference: item.reference,
      title: item.title,
      type: item.permitType,
      location: clean(item.location),
      issuer: clean(item.issuerName),
      receiver: clean(item.receiverName),
      status: item.status,
      from,
      until,
      validDays: until - from + 1,
      closed: closedKnown ? closedDay : null,
      daysLate: flags.has("closedLate") ? closedDay - until : null,
      daysPast: flags.has("openPast") ? today - until : null,
      controls: recorded(item.controls, MIN_TEXT) ? clean(item.controls) : null,
      measured,
      onTime: measured && closedDay <= until,
      flags: ordered,
      clean: ordered.every((flag) => flag === "longLived"),
      serious: flags.has("closedLate") || flags.has("openPast"),
    });
  }

  rows.sort((a, b) => Number(b.serious) - Number(a.serious) || b.flags.length - a.flags.length || b.from - a.from || before(a.reference, b.reference));
  staleOutside.sort(before);
  liveNoControls.sort(before);

  const receiverRows = new Map<string, { names: Map<string, number>; rows: Row[] }>();

  for (const row of rows) {
    const key = (row.receiver ?? "").toLowerCase();
    const entry = receiverRows.get(key) ?? { names: new Map<string, number>(), rows: [] };

    if (row.receiver) {
      entry.names.set(row.receiver, (entry.names.get(row.receiver) ?? 0) + 1);
    }

    entry.rows.push(row);
    receiverRows.set(key, entry);
  }

  const receivers: Group[] = [...receiverRows.entries()]
    .map(([key, entry]) => {
      const names = [...entry.names.entries()].sort((a, b) => b[1] - a[1] || before(a[0], b[0]));

      return groupOf(key || "none", names[0] ? names[0][0] : "No receiver recorded", entry.rows);
    })
    .sort((a, b) => Number(a.key === "none") - Number(b.key === "none") || b.count - a.count || before(a.label, b.label));

  const types: Group[] = [...new Set(rows.map((row) => row.type))]
    .map((type) => groupOf(type, typeLabel(type), rows.filter((row) => row.type === type)))
    .sort((a, b) => b.count - a.count || before(a.label, b.label));

  const measured = rows.filter((row) => row.measured).length;
  const onTime = rows.filter((row) => row.onTime).length;

  return {
    ok: true,
    data: {
      from: windowFrom,
      to: today,
      rows,
      types,
      receivers,
      permits: rows.length,
      closed: rows.filter((row) => row.status === "CLOSED").length,
      measured,
      onTime,
      onTimeShare: measured > 0 ? onTime / measured : null,
      late: rows.filter((row) => row.flags.includes("closedLate")).length,
      openPast: rows.filter((row) => row.flags.includes("openPast")).length,
      noControls: rows.filter((row) => row.flags.includes("noControls")).length,
      highRisk: rows.filter((row) => row.type !== "GENERAL").length,
      clean: rows.filter((row) => row.clean).length,
      staleOutside,
      liveNoControls,
      drafts,
      cancelled,
      skipped,
      future,
    },
  };
}

export function filterRows(rows: Row[], filter: Filter): Row[] {
  if (filter === "late") {
    return rows.filter((row) => row.flags.includes("closedLate"));
  }

  if (filter === "stale") {
    return rows.filter((row) => row.flags.includes("openPast"));
  }

  if (filter === "controls") {
    return rows.filter((row) => row.flags.includes("noControls"));
  }

  if (filter === "names") {
    return rows.filter((row) => row.flags.some((flag) => flag === "noIssuer" || flag === "noReceiver" || flag === "noLocation"));
  }

  if (filter === "long") {
    return rows.filter((row) => row.flags.includes("longLived"));
  }

  return rows;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function dayCount(count: number): string {
  return `${count} ${plural(count, "day", "days")}`;
}

export function flagText(flag: Flag, row: Row): string {
  if (flag === "closedLate" && row.daysLate !== null) {
    return `Closed ${dayCount(row.daysLate)} after expiry`;
  }

  if (flag === "openPast" && row.daysPast !== null) {
    return `Open ${dayCount(row.daysPast)} past expiry`;
  }

  if (flag === "longLived") {
    return `Valid for ${dayCount(row.validDays)}`;
  }

  return FLAG_LABEL[flag];
}

export function disciplineMarkdown(data: Discipline, shown: Row[], projectName: string, windowLabel: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Permit discipline: ${projectName}`, "");
  lines.push(`${data.permits} ${plural(data.permits, "permit", "permits")} started in the last ${windowLabel}, from ${formatDay(data.from)} to ${formatDay(data.to)}.`, "");
  lines.push(`- ${data.onTime} of ${data.measured} closed permits were closed on or before their expiry date (${pct(data.onTimeShare)})`);
  lines.push(`- ${data.late} closed after they expired, ${data.openPast} still open past their expiry date`);
  lines.push(`- ${data.noControls} of ${data.highRisk} high-risk permits have no controls recorded`);
  lines.push(`- ${data.clean} of ${data.permits} are fully in order`, "");

  if (data.types.length > 0) {
    lines.push("| Permit type | Permits | In order | Share |", "| --- | ---: | ---: | ---: |");

    for (const group of data.types) {
      lines.push(`| ${group.label} | ${group.count} | ${group.clean} | ${pct(group.share)} |`);
    }

    lines.push("");
  }

  if (shown.length > 0) {
    lines.push(filterLabel ? `Permits (${filterLabel.toLowerCase()}):` : "Permits:", "", "| Reference | Permit | Type | Valid | Status | Notes |", "| --- | --- | --- | --- | --- | --- |");

    for (const row of shown.slice(0, 25)) {
      lines.push(`| ${cell(row.reference)} | ${cell(trunc(row.title, 40))} | ${typeLabel(row.type)} | ${formatDay(row.from)} to ${formatDay(row.until)} | ${words(row.status)} | ${row.flags.map((flag) => flagText(flag, row)).join("; ") || "—"} |`);
    }

    lines.push("");
  }

  lines.push(
    `A permit is in order when it was closed on or before its expiry date (or is still within it) and has controls, an issuer, a receiver and a location recorded. Controls are expected on every permit type except general work. A field left empty, or holding only a placeholder such as "n/a" or "ok", counts as not recorded. Draft and cancelled permits are left out.`,
    "",
  );

  return lines.join("\n");
}
