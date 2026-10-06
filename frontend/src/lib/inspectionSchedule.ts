import { DAY_MS, formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { QualityControl, QualityDiscipline, QualityInspectionResult, QualityInspectionStatus, QualityInspectionType } from "@/types/project";

export const HORIZONS: ReadonlyArray<{ weeks: number; label: string }> = [
  { weeks: 2, label: "2 weeks" },
  { weeks: 4, label: "4 weeks" },
  { weeks: 6, label: "6 weeks" },
];

export const DEFAULT_HORIZON = 4;
export const SOON = 14;
export const LATE_DAYS = 3;
export const PAGE = 10;

export type Scope = "all" | "thirdParty";

export const SCOPES: ReadonlyArray<{ key: Scope; label: string }> = [
  { key: "all", label: "All inspections" },
  { key: "thirdParty", label: "Third party only" },
];

export const DISCIPLINES: ReadonlyArray<QualityDiscipline> = ["CIVIL", "STRUCTURAL", "ARCHITECTURAL", "MEP", "HSE", "QUALITY", "GENERAL"];

export const DISCIPLINE_LABEL: Record<QualityDiscipline, string> = {
  CIVIL: "Civil",
  STRUCTURAL: "Structural",
  ARCHITECTURAL: "Architectural",
  MEP: "MEP",
  HSE: "HSE",
  QUALITY: "Quality",
  GENERAL: "General",
};

export const TYPE_LABEL: Record<QualityInspectionType, string> = {
  INTERNAL: "Internal",
  CLIENT: "Client",
  CONSULTANT: "Consultant",
  REGULATORY: "Regulatory",
  TEST: "Test",
};

const THIRD_PARTY: ReadonlyArray<QualityInspectionType> = ["CLIENT", "CONSULTANT", "REGULATORY"];

export interface Item {
  id: string;
  reference: string;
  title: string;
  discipline: QualityDiscipline;
  type: QualityInspectionType;
  thirdParty: boolean;
  planned: number;
  actual: number | null;
  status: QualityInspectionStatus;
  result: QualityInspectionResult;
  inspector: string | null;
}

export interface Bucket {
  label: string;
  from: number;
  total: number;
  byDiscipline: Record<QualityDiscipline, number>;
  thirdParty: number;
}

export interface Punctuality {
  discipline: QualityDiscipline;
  held: number;
  onTime: number;
  late: number;
  veryLate: number;
  averageLate: number | null;
  worst: number;
}

export interface Schedule {
  overdue: Array<Item & { daysOver: number }>;
  inProgress: Item[];
  soon: Item[];
  buckets: Bucket[];
  later: number;
  overdueBucket: Bucket;
  punctuality: Punctuality[];
  held: number;
  onTime: number;
  onTimeShare: number | null;
  averageLate: number | null;
  veryLate: number;
  undated: number;
  nextThirdParty: Item | null;
  total: number;
  weeks: number;
  skipped: number;
}

export type ScheduleResult = { ok: true; schedule: Schedule } | { ok: false; reason: "empty" };

function zero(): Record<QualityDiscipline, number> {
  return { CIVIL: 0, STRUCTURAL: 0, ARCHITECTURAL: 0, MEP: 0, HSE: 0, QUALITY: 0, GENERAL: 0 };
}

function mondayOf(day: number): number {
  const weekday = new Date(day * DAY_MS).getUTCDay();

  return day - ((weekday + 6) % 7);
}

function bucket(label: string, from: number): Bucket {
  return { label, from, total: 0, byDiscipline: zero(), thirdParty: 0 };
}

export function buildSchedule(data: QualityControl, today: number, weeks: number, scope: Scope): ScheduleResult {
  const items: Item[] = [];
  let skipped = 0;

  for (const raw of data.inspections ?? []) {
    if (raw.status === "CANCELLED") {
      continue;
    }

    const planned = toDay(raw.plannedDate);

    if (!Number.isFinite(planned)) {
      skipped += 1;
      continue;
    }

    const actual = toDay(raw.actualDate);
    const thirdParty = THIRD_PARTY.includes(raw.inspectionType);

    if (scope === "thirdParty" && !thirdParty) {
      continue;
    }

    items.push({
      id: raw.id,
      reference: raw.reference,
      title: raw.title,
      discipline: raw.discipline,
      type: raw.inspectionType,
      thirdParty,
      planned,
      actual: Number.isFinite(actual) ? actual : null,
      status: raw.status,
      result: raw.result,
      inspector: raw.inspectorName,
    });
  }

  if (items.length === 0 && skipped === 0) {
    return { ok: false, reason: "empty" };
  }

  const byDate = (a: Item, b: Item) => a.planned - b.planned || Number(b.thirdParty) - Number(a.thirdParty) || a.reference.localeCompare(b.reference, undefined, { numeric: true });
  const overdue = items
    .filter((item) => item.status === "PLANNED" && item.planned < today)
    .map((item) => ({ ...item, daysOver: today - item.planned }))
    .sort((a, b) => b.daysOver - a.daysOver || a.reference.localeCompare(b.reference, undefined, { numeric: true }));
  const inProgress = items.filter((item) => item.status === "IN_PROGRESS").sort(byDate);
  const upcoming = items.filter((item) => item.status === "PLANNED" && item.planned >= today).sort(byDate);
  const soon = upcoming.filter((item) => item.planned <= today + SOON);

  const start = mondayOf(today);
  const buckets: Bucket[] = [];

  for (let index = 0; index < weeks; index += 1) {
    const from = start + index * 7;

    buckets.push(bucket(index === 0 ? "This week" : index === 1 ? "Next week" : `w/c ${formatDay(from).slice(0, 6).trim()}`, from));
  }

  let later = 0;

  for (const item of upcoming) {
    const index = Math.floor((item.planned - start) / 7);
    const target = buckets[index];

    if (!target) {
      later += 1;
      continue;
    }

    target.total += 1;
    target.byDiscipline[item.discipline] += 1;
    target.thirdParty += item.thirdParty ? 1 : 0;
  }

  const overdueBucket = bucket("Overdue", today);

  for (const item of overdue) {
    overdueBucket.total += 1;
    overdueBucket.byDiscipline[item.discipline] += 1;
    overdueBucket.thirdParty += item.thirdParty ? 1 : 0;
  }

  const done = items.filter((item) => item.status === "COMPLETED");
  const dated = done.filter((item) => item.actual !== null);
  const lateness = (item: Item) => (item.actual as number) - item.planned;
  const punctuality: Punctuality[] = [];

  for (const discipline of DISCIPLINES) {
    const held = dated.filter((item) => item.discipline === discipline);

    if (held.length === 0) {
      continue;
    }

    const lates = held.map(lateness).filter((value) => value > 0);

    punctuality.push({
      discipline,
      held: held.length,
      onTime: held.length - lates.length,
      late: lates.length,
      veryLate: lates.filter((value) => value > LATE_DAYS).length,
      averageLate: lates.length > 0 ? lates.reduce((sum, value) => sum + value, 0) / lates.length : null,
      worst: lates.length > 0 ? Math.max(...lates) : 0,
    });
  }

  punctuality.sort((a, b) => (a.onTime / a.held) - (b.onTime / b.held) || b.held - a.held);

  const lateAll = dated.map(lateness).filter((value) => value > 0);
  const nextThirdParty = upcoming.find((item) => item.thirdParty) ?? null;

  return {
    ok: true,
    schedule: {
      overdue,
      inProgress,
      soon,
      buckets,
      later,
      overdueBucket,
      punctuality,
      held: dated.length,
      onTime: dated.length - lateAll.length,
      onTimeShare: dated.length > 0 ? (dated.length - lateAll.length) / dated.length : null,
      averageLate: lateAll.length > 0 ? lateAll.reduce((sum, value) => sum + value, 0) / lateAll.length : null,
      veryLate: lateAll.filter((value) => value > LATE_DAYS).length,
      undated: done.length - dated.length,
      nextThirdParty,
      total: items.length,
      weeks,
      skipped,
    },
  };
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function daysText(count: number): string {
  return `${count} ${plural(count, "day", "days")}`;
}

export function dueText(item: Item, today: number): string {
  const diff = item.planned - today;

  return diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : diff > 1 ? `In ${diff} days` : `${daysText(-diff)} ago`;
}

export function scheduleMarkdown(schedule: Schedule, projectName: string, today: number, scope: Scope): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const row = (item: Item, extra: string) => `| ${formatDay(item.planned)} | ${cell(item.reference)} | ${cell(trunc(item.title, 50))} | ${DISCIPLINE_LABEL[item.discipline]} | ${TYPE_LABEL[item.type]} | ${extra} |`;

  lines.push(`# Inspection schedule: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}${scope === "thirdParty" ? ", third-party inspections only" : ""}.`, "");
  lines.push(`- ${schedule.overdue.length} planned ${plural(schedule.overdue.length, "inspection is", "inspections are")} past ${plural(schedule.overdue.length, "its", "their")} date without being held`);
  lines.push(`- ${schedule.soon.length} due in the next ${SOON} days, ${schedule.soon.filter((item) => item.thirdParty).length} of them third party`);
  lines.push(`- ${pct(schedule.onTimeShare)} of ${schedule.held} held inspections took place on or before the planned date`, "");

  if (schedule.overdue.length > 0) {
    lines.push("Overdue:", "", "| Planned | Reference | Inspection | Discipline | Type | Late |", "| --- | --- | --- | --- | --- | --- |");

    for (const item of schedule.overdue) {
      lines.push(row(item, daysText(item.daysOver)));
    }

    lines.push("");
  }

  if (schedule.soon.length > 0) {
    lines.push(`Due in the next ${SOON} days:`, "", "| Planned | Reference | Inspection | Discipline | Type | When |", "| --- | --- | --- | --- | --- | --- |");

    for (const item of schedule.soon) {
      lines.push(row(item, dueText(item, today)));
    }

    lines.push("");
  }

  lines.push("| Week | Planned inspections | Third party |", "| --- | ---: | ---: |");

  for (const week of schedule.buckets) {
    lines.push(`| ${week.label} | ${week.total} | ${week.thirdParty} |`);
  }

  lines.push(
    "",
    `Overdue means an inspection still marked planned after its planned date; one marked in progress is not counted. Held on time compares the date an inspection took place with the date it was planned for, so one held early or on the day is on time and one more than ${LATE_DAYS} days late counts as very late. Third party means client, consultant or regulatory inspections. Cancelled inspections are left out.`,
    "",
  );

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
}
