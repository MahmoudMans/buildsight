import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { ProductionControl, ResourceControl } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
  { days: 112, label: "16 weeks" },
];

export const DEFAULT_WINDOW = 56;
export const TOLERANCE = 0.15;
export const MIN_GAP = 16;
export const HOURS_TOL = 0.5;
export const UTIL_TOL = 2;
export const DAY_HOURS = 24;
export const PAGE = 10;
export const DAY_ROWS = 6;

export type Verdict = "matches" | "loggedMore" | "reportedMore" | "loggedOnly" | "reportedOnly";
export type Flag = "duplicate" | "overDay" | "negative" | "overAvailable" | "hoursDontAddUp" | "utilisationOff" | "unknownEquipment" | "unknownPackage";
export type PackageFilter = "all" | "disagree";
export type RecordFilter = "all" | "hours" | "duplicate" | "links";

export const VERDICT_LABEL: Record<Verdict, string> = {
  matches: "Roughly agree",
  loggedMore: "Plant logged, less reported",
  reportedMore: "More reported than logged",
  loggedOnly: "Logged, nothing reported",
  reportedOnly: "Reported, no plant logged",
};

export const FLAG_ORDER: Flag[] = ["duplicate", "overDay", "negative", "overAvailable", "hoursDontAddUp", "utilisationOff", "unknownEquipment", "unknownPackage"];

export const FLAG_LABEL: Record<Flag, string> = {
  duplicate: "Logged more than once a day",
  overDay: "More than 24 hours in a day",
  negative: "Negative hours",
  overAvailable: "Operating beyond available hours",
  hoursDontAddUp: "Hours do not add up",
  utilisationOff: "Utilisation does not match the hours",
  unknownEquipment: "Equipment not on the register",
  unknownPackage: "Work package not on the register",
};

const FLAG_GROUP: Record<Flag, Exclude<RecordFilter, "all">> = {
  duplicate: "duplicate",
  overDay: "hours",
  negative: "hours",
  overAvailable: "hours",
  hoursDontAddUp: "hours",
  utilisationOff: "hours",
  unknownEquipment: "links",
  unknownPackage: "links",
};

export const PACKAGE_FILTERS: ReadonlyArray<{ key: PackageFilter; label: string }> = [
  { key: "all", label: "All packages" },
  { key: "disagree", label: "Disagreeing only" },
];

export const RECORD_FILTERS: ReadonlyArray<{ key: RecordFilter; label: string }> = [
  { key: "all", label: "Any problem" },
  { key: "hours", label: "Hours" },
  { key: "duplicate", label: "Duplicates" },
  { key: "links", label: "Not on register" },
];

export interface PackageRow {
  id: string;
  code: string;
  name: string;
  logged: number;
  reported: number;
  gap: number;
  verdict: Verdict;
  items: string[];
}

export interface RecordRow {
  key: string;
  code: string;
  description: string | null;
  day: number;
  packageCode: string | null;
  available: number;
  operating: number;
  idle: number;
  downtime: number;
  utilisation: number;
  dupCount: number;
  flags: Flag[];
}

export interface DayRow {
  day: number;
  hours: number;
  items: string[];
}

export interface CheckRow {
  flag: Flag;
  label: string;
  count: number;
}

export interface Plant {
  packages: PackageRow[];
  flagged: RecordRow[];
  checks: CheckRow[];
  unreportedDays: DayRow[];
  unloggedDays: DayRow[];
  from: number;
  to: number;
  windowDays: number;
  logged: number;
  assigned: number;
  unassigned: number;
  unassignedShare: number | null;
  reported: number;
  coverage: number | null;
  disagree: number;
  under: number;
  over: number;
  records: number;
  problems: number;
  drafts: number;
  skipped: number;
  future: number;
}

export type PlantResult = { ok: true; plant: Plant } | { ok: false; reason: "empty" };

function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function before(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function verdictOf(logged: number, reported: number): Verdict {
  const gap = logged - reported;
  const big = Math.max(logged, reported);

  if (logged > 0 && reported === 0) {
    return logged >= MIN_GAP ? "loggedOnly" : "matches";
  }

  if (reported > 0 && logged === 0) {
    return reported >= MIN_GAP ? "reportedOnly" : "matches";
  }

  if (Math.abs(gap) < MIN_GAP || Math.abs(gap) / big <= TOLERANCE) {
    return "matches";
  }

  return gap > 0 ? "loggedMore" : "reportedMore";
}

export function hoursText(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function oneDecimal(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(Math.round(value * 10) / 10);
}

export function pct(value: number | null): string {
  if (value === null) return "—";
  const whole = Math.round(value * 100);
  return whole > 999 ? ">999%" : `${whole}%`;
}

export function flagText(flag: Flag, row: RecordRow): string {
  if (flag === "duplicate") {
    return `Logged ${row.dupCount} times that day`;
  }

  if (flag === "overDay") {
    return "Over 24 h in a day";
  }

  if (flag === "negative") {
    return "Negative hours";
  }

  if (flag === "overAvailable") {
    return `Operating ${oneDecimal(row.operating)} h of ${oneDecimal(row.available)} h available`;
  }

  if (flag === "hoursDontAddUp") {
    return `Hours add up to ${oneDecimal(row.operating + row.idle + row.downtime)} of ${oneDecimal(row.available)} h`;
  }

  if (flag === "utilisationOff") {
    return `Utilisation ${Math.round(row.utilisation)}%, hours say ${row.available > 0 ? Math.round((row.operating / row.available) * 100) : 0}%`;
  }

  return flag === "unknownEquipment" ? "Equipment not on register" : "Package not on register";
}

function flagsFor(row: Omit<RecordRow, "flags" | "dupCount">): Flag[] {
  const flags: Flag[] = [];
  const sum = row.operating + row.idle + row.downtime;

  if (Math.max(row.available, row.operating, row.idle, row.downtime) > DAY_HOURS) {
    flags.push("overDay");
  }

  if (Math.min(row.available, row.operating, row.idle, row.downtime) < 0) {
    flags.push("negative");
  }

  if (row.operating > row.available + HOURS_TOL) {
    flags.push("overAvailable");
  }

  if (Math.abs(sum - row.available) > HOURS_TOL) {
    flags.push("hoursDontAddUp");
  }

  if (row.available > 0 && Math.abs(row.utilisation - (row.operating / row.available) * 100) > UTIL_TOL) {
    flags.push("utilisationOff");
  }

  return flags;
}

export function buildPlant(resources: ResourceControl, production: ProductionControl, today: number, windowDays: number): PlantResult {
  const from = today - windowDays + 1;
  const register = new Map((resources.equipment ?? []).map((item) => [item.id, item]));
  const packages = new Map((production.workPackages ?? []).map((pack) => [pack.id, { code: pack.code, name: pack.name }]));
  const draftReports = new Set((production.siteReports ?? []).filter((report) => report.status === "DRAFT").map((report) => report.id));
  const reportDays = new Set<number>();

  for (const report of production.siteReports ?? []) {
    const day = toDay(report.reportDate);

    if (report.status !== "DRAFT" && Number.isFinite(day) && day >= from && day <= today) {
      reportDays.add(day);
    }
  }

  const rows = new Map<string, PackageRow & { itemSet: Set<string> }>();
  const loggedDays = new Map<number, { hours: number; codes: Set<string> }>();
  const reportedDays = new Map<number, { hours: number; codes: Set<string> }>();
  const recordDays = new Set<number>();
  const records: Array<Omit<RecordRow, "flags" | "dupCount"> & { equipmentId: string; packageId: string | null }> = [];
  let anyData = (resources.equipmentUsage ?? []).length > 0;
  let skipped = 0;
  let future = 0;
  let drafts = 0;

  function row(id: string, fallbackCode: string, fallbackName: string) {
    const known = packages.get(id);
    const existing = rows.get(id);

    if (existing) {
      return existing;
    }

    const created = { id, code: known?.code ?? fallbackCode, name: known?.name ?? fallbackName, logged: 0, reported: 0, gap: 0, verdict: "matches" as Verdict, items: [] as string[], itemSet: new Set<string>() };

    rows.set(id, created);

    return created;
  }

  for (const item of resources.equipmentUsage ?? []) {
    const day = toDay(item.workDate);

    if (!Number.isFinite(day)) {
      skipped += 1;
      continue;
    }

    if (day > today) {
      future += 1;
      continue;
    }

    if (day < from) {
      continue;
    }

    const known = item.workPackageId !== null && packages.has(item.workPackageId);

    records.push({
      key: item.id,
      equipmentId: item.equipmentId,
      packageId: item.workPackageId,
      code: item.equipmentCode,
      description: register.get(item.equipmentId)?.description ?? null,
      day,
      packageCode: known && item.workPackageId !== null ? packages.get(item.workPackageId)?.code ?? null : null,
      available: finite(item.availableHours),
      operating: finite(item.operatingHours),
      idle: finite(item.idleHours),
      downtime: finite(item.downtimeHours),
      utilisation: finite(item.utilizationPercentage),
    });
  }

  const seen = new Map<string, number>();

  for (const record of records) {
    const key = `${record.equipmentId}|${record.day}`;

    seen.set(key, (seen.get(key) ?? 0) + 1);
  }

  let logged = 0;
  let assigned = 0;
  const flagged: RecordRow[] = [];
  const counts = new Map<Flag, number>();

  for (const record of records) {
    const dupCount = seen.get(`${record.equipmentId}|${record.day}`) ?? 1;
    const flags = flagsFor(record);

    if (dupCount > 1) {
      flags.unshift("duplicate");
    }

    if (register.size > 0 && !register.has(record.equipmentId)) {
      flags.push("unknownEquipment");
    }

    if (record.packageId !== null && packages.size > 0 && !packages.has(record.packageId)) {
      flags.push("unknownPackage");
    }

    const ordered = FLAG_ORDER.filter((flag) => flags.includes(flag));

    for (const flag of ordered) {
      counts.set(flag, (counts.get(flag) ?? 0) + 1);
    }

    const { equipmentId: _equipmentId, packageId: _packageId, ...rest } = record;

    if (ordered.length > 0) {
      flagged.push({ ...rest, dupCount, flags: ordered });
    }

    const hours = Math.max(0, record.operating);

    recordDays.add(record.day);

    if (hours <= 0) {
      continue;
    }

    logged += hours;

    const dayRow = loggedDays.get(record.day) ?? { hours: 0, codes: new Set<string>() };

    dayRow.hours += hours;
    dayRow.codes.add(record.code);
    loggedDays.set(record.day, dayRow);

    if (record.packageId !== null && packages.has(record.packageId)) {
      const target = row(record.packageId, "", "");

      assigned += hours;
      target.logged += hours;
      target.itemSet.add(record.code);
    }
  }

  let reported = 0;

  for (const entry of production.productionEntries ?? []) {
    const hours = finite(entry.equipmentHours);

    anyData = anyData || hours > 0;

    const day = toDay(entry.reportDate);

    if (!Number.isFinite(day)) {
      skipped += 1;
      continue;
    }

    if (hours <= 0 || day < from || day > today) {
      continue;
    }

    if (draftReports.has(entry.siteReportId)) {
      drafts += 1;
      continue;
    }

    reported += hours;
    row(entry.workPackageId, entry.workPackageCode, entry.workPackageName).reported += hours;
    reportDays.add(day);

    const dayRow = reportedDays.get(day) ?? { hours: 0, codes: new Set<string>() };

    dayRow.hours += hours;
    dayRow.codes.add(entry.workPackageCode);
    reportedDays.set(day, dayRow);
  }

  if (!anyData) {
    return { ok: false, reason: "empty" };
  }

  const list: PackageRow[] = [];

  for (const value of rows.values()) {
    const { itemSet, ...rest } = value;

    list.push({ ...rest, gap: value.logged - value.reported, verdict: verdictOf(value.logged, value.reported), items: [...itemSet].sort(before) });
  }

  list.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || a.code.localeCompare(b.code, undefined, { numeric: true }));
  flagged.sort((a, b) => b.flags.length - a.flags.length || b.day - a.day || before(a.code, b.code) || before(a.key, b.key));

  const dayList = (source: Map<number, { hours: number; codes: Set<string> }>, keep: (day: number) => boolean): DayRow[] =>
    [...source.entries()]
      .filter(([day, value]) => value.hours > 0 && keep(day))
      .map(([day, value]) => ({ day, hours: value.hours, items: [...value.codes].sort(before) }))
      .sort((a, b) => b.hours - a.hours || b.day - a.day);

  const under = list.filter((item) => item.verdict === "loggedMore" || item.verdict === "loggedOnly").length;
  const over = list.filter((item) => item.verdict === "reportedMore" || item.verdict === "reportedOnly").length;
  const unassigned = logged - assigned;

  return {
    ok: true,
    plant: {
      packages: list,
      flagged,
      checks: FLAG_ORDER.map((flag) => ({ flag, label: FLAG_LABEL[flag], count: counts.get(flag) ?? 0 })),
      unreportedDays: dayList(loggedDays, (day) => !reportDays.has(day)),
      unloggedDays: dayList(reportedDays, (day) => !recordDays.has(day)),
      from,
      to: today,
      windowDays,
      logged,
      assigned,
      unassigned,
      unassignedShare: logged > 0 ? unassigned / logged : null,
      reported,
      coverage: logged > 0 ? reported / logged : null,
      disagree: under + over,
      under,
      over,
      records: records.length,
      problems: flagged.length,
      drafts,
      skipped,
      future,
    },
  };
}

export function filterPackages(list: PackageRow[], filter: PackageFilter): PackageRow[] {
  return filter === "disagree" ? list.filter((item) => item.verdict !== "matches") : list;
}

export function filterRecords(list: RecordRow[], filter: RecordFilter): RecordRow[] {
  return filter === "all" ? list : list.filter((row) => row.flags.some((flag) => FLAG_GROUP[flag] === filter));
}

export function gapText(item: PackageRow): string {
  if (item.verdict === "matches") {
    return `${hoursText(Math.abs(item.gap))} h apart`;
  }

  return item.gap > 0 ? `${hoursText(item.gap)} h logged but not reported` : `${hoursText(-item.gap)} h reported beyond the plant logged`;
}

export function plantMarkdown(plant: Plant, list: PackageRow[], records: RecordRow[], projectName: string, windowLabel: string): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Plant reconciliation: ${projectName}`, "");
  lines.push(`Plant hours in the last ${windowLabel}, from ${formatDay(plant.from)} to ${formatDay(plant.to)}.`, "");
  lines.push(`- ${hoursText(plant.logged)} h of operating time logged, ${hoursText(plant.reported)} h of equipment time reported on site reports (${pct(plant.coverage)})`);
  lines.push(`- ${hoursText(plant.unassigned)} h (${pct(plant.unassignedShare)}) logged without a work package on the register`);
  lines.push(`- ${plant.disagree} ${plural(plant.disagree, "package disagrees", "packages disagree")}: ${plant.under} with more logged than reported, ${plant.over} with more reported than logged`);
  lines.push(`- ${plant.problems} of ${plant.records} plant ${plural(plant.records, "record has", "records have")} a problem`, "");

  if (list.length > 0) {
    lines.push("| Package | Logged h | Reported h | Gap h | Reading |", "| --- | ---: | ---: | ---: | --- |");

    for (const item of list) {
      lines.push(`| ${cell(item.code)} ${cell(trunc(item.name, 40))} | ${hoursText(item.logged)} | ${hoursText(item.reported)} | ${item.gap > 0 ? "+" : item.gap < 0 ? "−" : ""}${hoursText(Math.abs(item.gap))} | ${VERDICT_LABEL[item.verdict]} |`);
    }

    lines.push("");
  }

  if (records.length > 0) {
    lines.push("| Equipment | Date | Hours (available / operating / idle / down) | Problems |", "| --- | --- | --- | --- |");

    for (const row of records.slice(0, 25)) {
      lines.push(`| ${cell(row.code)} | ${formatDay(row.day)} | ${oneDecimal(row.available)} / ${oneDecimal(row.operating)} / ${oneDecimal(row.idle)} / ${oneDecimal(row.downtime)} | ${row.flags.map((flag) => flagText(flag, row)).join("; ")} |`);
    }

    lines.push("");
  }

  if (plant.unreportedDays.length > 0) {
    lines.push(`Days with plant logged but no site report: ${plant.unreportedDays.slice(0, 8).map((item) => `${formatDay(item.day)} (${hoursText(item.hours)} h)`).join(", ")}${plant.unreportedDays.length > 8 ? `, and ${plant.unreportedDays.length - 8} more` : ""}.`, "");
  }

  lines.push(
    `Logged hours are the operating hours in the equipment usage log; reported hours are the equipment hours booked against work packages on submitted and approved site reports. Both are limited to the period above. A package roughly agrees when the two are within ${Math.round(TOLERANCE * 100)}% of each other or under ${MIN_GAP} hours apart. The two are entered separately, so some difference is normal. A usage record is flagged when its hours do not add up (operating, idle and downtime against available, within ${HOURS_TOL} h), its utilisation differs from operating over available by more than ${UTIL_TOL} points, it shows more than ${DAY_HOURS} hours or negative hours, it is logged twice for the same equipment and day, or it points to equipment or a work package that is not on the register.`,
    "",
  );

  return lines.join("\n");
}
