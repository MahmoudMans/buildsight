import { DAY_MS, formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { SafetyControl, WorkPermitStatus, WorkPermitType } from "@/types/project";

export const HORIZONS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 14, label: "2 weeks" },
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
];

export const DEFAULT_HORIZON = 28;
export const LONG_PERMIT = 14;
export const PAGE = 12;

export type Inclusion = "issued" | "withDrafts";

export const INCLUSIONS: ReadonlyArray<{ key: Inclusion; label: string }> = [
  { key: "withDrafts", label: "Issued and draft" },
  { key: "issued", label: "Issued only" },
];

export type Level = "high" | "watch" | "info";

export const LEVEL_LABEL: Record<Level, string> = {
  high: "Coordinate first",
  watch: "Coordinate",
  info: "Same place",
};

const LEVEL_RANK: Record<Level, number> = { high: 0, watch: 1, info: 2 };

export const TYPE_LABEL: Record<WorkPermitType, string> = {
  HOT_WORK: "Hot work",
  WORK_AT_HEIGHT: "Work at height",
  CONFINED_SPACE: "Confined space",
  EXCAVATION: "Excavation",
  ELECTRICAL_ISOLATION: "Electrical isolation",
  LIFTING: "Lifting",
  GENERAL: "General",
};

export const TYPES: ReadonlyArray<WorkPermitType> = ["HOT_WORK", "WORK_AT_HEIGHT", "CONFINED_SPACE", "EXCAVATION", "ELECTRICAL_ISOLATION", "LIFTING", "GENERAL"];

interface Rule {
  a: WorkPermitType;
  b: WorkPermitType;
  level: Level;
  why: string;
}

export const RULES: ReadonlyArray<Rule> = [
  { a: "HOT_WORK", b: "CONFINED_SPACE", level: "high", why: "A hot work ignition source and a confined space in the same place." },
  { a: "HOT_WORK", b: "WORK_AT_HEIGHT", level: "watch", why: "Sparks can fall onto people working above or below." },
  { a: "WORK_AT_HEIGHT", b: "LIFTING", level: "watch", why: "Lifted loads can pass over people working at height." },
  { a: "EXCAVATION", b: "LIFTING", level: "watch", why: "Crane loads and plant working beside an open excavation." },
  { a: "ELECTRICAL_ISOLATION", b: "CONFINED_SPACE", level: "watch", why: "Isolation and entry need one controlled sequence." },
];

export interface Permit {
  id: string;
  reference: string;
  title: string;
  type: WorkPermitType;
  location: string | null;
  area: string | null;
  from: number;
  to: number;
  validUntil: number;
  status: WorkPermitStatus;
  draft: boolean;
  stale: boolean;
  long: boolean;
  span: number;
  issuer: string | null;
  receiver: string | null;
  conflicts: number;
}

export interface Conflict {
  a: Permit;
  b: Permit;
  from: number;
  to: number;
  days: number;
  level: Level;
  why: string;
  place: string;
}

export interface Plan {
  permits: Permit[];
  conflicts: Conflict[];
  perDay: number[];
  start: number;
  end: number;
  horizon: number;
  peak: number;
  peakDay: number | null;
  issued: number;
  drafts: number;
  stale: Permit[];
  long: Permit[];
  noLocation: Permit[];
  byType: Array<{ type: WorkPermitType; count: number }>;
  skipped: number;
  excluded: number;
}

export type PlanResult = { ok: true; plan: Plan } | { ok: false; reason: "empty" };

function normalise(location: string | null): string | null {
  const text = (location ?? "").toLowerCase().replace(/\s+/g, " ").trim();

  return text === "" ? null : text;
}

function sameArea(a: string | null, b: string | null): boolean {
  if (a === null || b === null) {
    return false;
  }

  if (a === b) {
    return true;
  }

  const [short, long] = a.length <= b.length ? [a, b] : [b, a];

  return long.startsWith(short) && [",", " ", "-", "/", ":"].includes(long.charAt(short.length));
}

function ruleFor(a: WorkPermitType, b: WorkPermitType): Rule | null {
  return RULES.find((rule) => (rule.a === a && rule.b === b) || (rule.a === b && rule.b === a)) ?? null;
}

export function buildPlan(data: SafetyControl, today: number, horizon: number, inclusion: Inclusion): PlanResult {
  const end = today + horizon - 1;
  const all: Permit[] = [];
  let skipped = 0;
  let excluded = 0;

  for (const raw of data.permits ?? []) {
    const from = toDay(raw.validFrom);
    const until = toDay(raw.validUntil);

    if (!Number.isFinite(from) || !Number.isFinite(until)) {
      skipped += 1;
      continue;
    }

    const active = raw.status === "ACTIVE";
    const draft = raw.status === "DRAFT";

    if (!active && !(draft && inclusion === "withDrafts")) {
      excluded += 1;
      continue;
    }

    const stale = active && until < today;
    const to = stale ? today : until;

    all.push({
      id: raw.id,
      reference: raw.reference,
      title: raw.title,
      type: raw.permitType,
      location: raw.location,
      area: normalise(raw.location),
      from,
      to: Math.max(from, to),
      validUntil: until,
      status: raw.status,
      draft,
      stale,
      long: until - from + 1 > LONG_PERMIT,
      span: Math.max(0, until - from + 1),
      issuer: raw.issuerName,
      receiver: raw.receiverName,
      conflicts: 0,
    });
  }

  if (all.length === 0 && excluded === 0 && skipped === 0) {
    return { ok: false, reason: "empty" };
  }

  const permits = all.filter((permit) => permit.to >= today && permit.from <= end).sort((a, b) => a.from - b.from || a.reference.localeCompare(b.reference, undefined, { numeric: true }));
  const conflicts: Conflict[] = [];

  for (let i = 0; i < permits.length; i += 1) {
    for (let j = i + 1; j < permits.length; j += 1) {
      const a = permits[i] as Permit;
      const b = permits[j] as Permit;

      if (a.type === b.type || a.type === "GENERAL" || b.type === "GENERAL" || !sameArea(a.area, b.area)) {
        continue;
      }

      const from = Math.max(a.from, b.from, today);
      const to = Math.min(a.to, b.to, end);

      if (to < from) {
        continue;
      }

      const rule = ruleFor(a.type, b.type);

      conflicts.push({
        a,
        b,
        from,
        to,
        days: to - from + 1,
        level: rule ? rule.level : "info",
        why: rule ? rule.why : "Different kinds of work are permitted in the same place at the same time.",
        place: (a.location ?? "").length <= (b.location ?? "").length ? (a.location ?? "") : (b.location ?? ""),
      });

      a.conflicts += 1;
      b.conflicts += 1;
    }
  }

  conflicts.sort((x, y) => LEVEL_RANK[x.level] - LEVEL_RANK[y.level] || x.from - y.from || y.days - x.days);

  const perDay: number[] = [];

  for (let day = today; day <= end; day += 1) {
    perDay.push(permits.filter((permit) => permit.from <= day && permit.to >= day).length);
  }

  const peak = Math.max(0, ...perDay);
  const peakIndex = perDay.indexOf(peak);
  const counts = new Map<WorkPermitType, number>();

  for (const permit of permits) {
    counts.set(permit.type, (counts.get(permit.type) ?? 0) + 1);
  }

  return {
    ok: true,
    plan: {
      permits,
      conflicts,
      perDay,
      start: today,
      end,
      horizon,
      peak,
      peakDay: peak > 0 ? today + peakIndex : null,
      issued: permits.filter((permit) => !permit.draft).length,
      drafts: permits.filter((permit) => permit.draft).length,
      stale: permits.filter((permit) => permit.stale),
      long: permits.filter((permit) => permit.long),
      noLocation: permits.filter((permit) => permit.area === null),
      byType: TYPES.filter((type) => counts.has(type)).map((type) => ({ type, count: counts.get(type) ?? 0 })),
      skipped,
      excluded,
    },
  };
}

export function rangeText(from: number, to: number): string {
  return from === to ? formatDay(from) : `${formatDay(from)} to ${formatDay(to)}`;
}

export function dayCount(count: number): string {
  return `${count} ${plural(count, "day", "days")}`;
}

export function weekdayShort(day: number): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(day * DAY_MS));
}

export function planMarkdown(plan: Plan, projectName: string, today: number, inclusion: Inclusion): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const flagged = plan.conflicts.filter((conflict) => conflict.level !== "info");

  lines.push(`# Permit overlaps: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Permits in force between ${formatDay(plan.start)} and ${formatDay(plan.end)}${inclusion === "withDrafts" ? ", including drafts" : ", issued permits only"}.`, "");
  lines.push(`- ${plan.permits.length} ${plural(plan.permits.length, "permit", "permits")} (${plan.issued} issued, ${plan.drafts} draft)`);
  lines.push(`- ${flagged.length} ${plural(flagged.length, "overlap", "overlaps")} to coordinate, ${plan.conflicts.length - flagged.length} other ${plural(plan.conflicts.length - flagged.length, "overlap", "overlaps")} in the same place`);
  lines.push(`- Peak ${plan.peak} at once${plan.peakDay !== null ? ` on ${formatDay(plan.peakDay)}` : ""}`, "");

  if (plan.conflicts.length > 0) {
    lines.push("| Level | Place | Permit | Permit | Overlap | Why |", "| --- | --- | --- | --- | --- | --- |");

    for (const conflict of plan.conflicts) {
      lines.push(`| ${LEVEL_LABEL[conflict.level]} | ${cell(conflict.place)} | ${cell(conflict.a.reference)} ${TYPE_LABEL[conflict.a.type]} | ${cell(conflict.b.reference)} ${TYPE_LABEL[conflict.b.type]} | ${rangeText(conflict.from, conflict.to)} | ${cell(conflict.why)} |`);
    }

    lines.push("");
  }

  if (plan.stale.length > 0) {
    lines.push(`Active but past their end date: ${plan.stale.map((permit) => `${cell(permit.reference)} (${cell(trunc(permit.title, 40))})`).join(", ")}.`, "");
  }

  lines.push(
    "An overlap is two permits of different types, in force on the same day, for the same place. Places are matched on the location text, so Block A also matches Block A, level 3. The kinds of pairing flagged as worth coordinating are hot work with confined space, hot work with work at height, work at height with lifting, excavation with lifting, and electrical isolation with confined space. Any other pair of different permit types in the same place is listed as a lower level. Only active permits are checked, plus drafts when they are included; suspended, closed and cancelled permits are not.",
    "",
  );

  return lines.join("\n");
}
