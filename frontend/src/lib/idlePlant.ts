import { formatDay, money, plural, toDay, trunc } from "@/lib/openItems";
import type { EquipmentOwnership, EquipmentStatus, ResourceControl } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 14, label: "2 weeks" },
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
];

export const DEFAULT_WINDOW = 28;
export const LOW_USE = 0.4;
export const HIGH_DOWNTIME = 0.2;
export const BUSY_USE = 0.65;
export const MIN_DAYS = 5;
export const PAGE = 10;

const WEEK = 7;

export type Verdict = "breakdown" | "idleHire" | "idleOwned" | "fair" | "busy" | "offHire" | "noData";
export type OwnerFilter = "all" | "hired" | "owned";
export type SortKey = "wasted" | "use";

export const VERDICT_LABEL: Record<Verdict, string> = {
  breakdown: "Breaks down often",
  idleHire: "Off-hire candidate",
  idleOwned: "Under-used, owned",
  fair: "Moderate use",
  busy: "Well used",
  offHire: "Already off hire",
  noData: "No hours logged",
};

export const OWNER_FILTERS: ReadonlyArray<{ key: OwnerFilter; label: string }> = [
  { key: "all", label: "All plant" },
  { key: "hired", label: "Hired" },
  { key: "owned", label: "Owned" },
];

export const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "wasted", label: "Most wasted" },
  { key: "use", label: "Least used" },
];

export interface Unit {
  id: string;
  code: string;
  description: string;
  category: string;
  ownership: EquipmentOwnership;
  hired: boolean;
  status: EquipmentStatus;
  dailyCost: number;
  days: number;
  available: number;
  operating: number;
  idle: number;
  down: number;
  use: number | null;
  idleShare: number | null;
  downShare: number | null;
  spend: number;
  wasted: number;
  idleCost: number;
  downCost: number;
  lastUsed: number | null;
  sinceUsed: number | null;
  weeks: Array<number | null>;
  verdict: Verdict;
}

export interface Totals {
  units: number;
  logged: number;
  available: number;
  operating: number;
  idle: number;
  down: number;
  use: number | null;
  downShare: number | null;
  spend: number;
  wasted: number;
  idleCost: number;
  downCost: number;
  wastedShare: number | null;
  perWeek: number;
  hiredWasted: number;
  candidates: number;
  candidateWasted: number;
  breakdowns: number;
}

export interface Week {
  from: number;
  to: number;
  idleCost: number;
  downCost: number;
  use: number | null;
}

export interface Plant {
  units: Unit[];
  weeks: Week[];
  windowDays: number;
  from: number;
  latest: number | null;
  skipped: number;
  unpriced: number;
}

export type PlantResult = { ok: true; plant: Plant } | { ok: false; reason: "empty" };

function num(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function dayOrNull(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

export function eur(value: number): string {
  return Math.abs(value) < 1000 ? `€${Math.round(value)}` : money(value);
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function verdictOf(unit: Pick<Unit, "status" | "days" | "use" | "downShare" | "hired">): Verdict {
  if (unit.status === "OFF_HIRE") {
    return "offHire";
  }

  if (unit.days === 0 || unit.use === null) {
    return "noData";
  }

  if (unit.days < MIN_DAYS) {
    return "fair";
  }

  if ((unit.downShare ?? 0) >= HIGH_DOWNTIME) {
    return "breakdown";
  }

  if (unit.use < LOW_USE) {
    return unit.hired ? "idleHire" : "idleOwned";
  }

  return unit.use >= BUSY_USE ? "busy" : "fair";
}

export function buildPlant(data: ResourceControl, today: number, windowDays: number): PlantResult {
  const equipment = data.equipment ?? [];

  if (equipment.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const win = Math.max(WEEK, Math.round(windowDays));
  const from = today - win + 1;
  const weekCount = Math.max(1, Math.round(win / WEEK));
  const byUnit = new Map<string, Array<{ day: number; available: number; operating: number; idle: number; down: number }>>();
  let skipped = 0;
  let latest: number | null = null;

  for (const row of data.equipmentUsage ?? []) {
    const day = dayOrNull(row.workDate);

    if (day === null) {
      skipped += 1;
      continue;
    }

    latest = latest === null ? day : Math.max(latest, day);

    const list = byUnit.get(row.equipmentId) ?? [];

    list.push({ day, available: Math.max(0, num(row.availableHours)), operating: Math.max(0, num(row.operatingHours)), idle: Math.max(0, num(row.idleHours)), down: Math.max(0, num(row.downtimeHours)) });
    byUnit.set(row.equipmentId, list);
  }

  const weekBuckets: Week[] = Array.from({ length: weekCount }, (_, index) => {
    const to = today - WEEK * (weekCount - 1 - index);

    return { from: to - WEEK + 1, to, idleCost: 0, downCost: 0, use: null };
  });
  const weekHours = weekBuckets.map(() => ({ available: 0, operating: 0 }));
  let unpriced = 0;
  const units: Unit[] = [];

  for (const item of equipment) {
    const rows = byUnit.get(item.id) ?? [];
    const dailyCost = Math.max(0, num(item.dailyCost));
    const hired = item.ownership === "RENTED" || item.ownership === "SUBCONTRACTOR";
    const inWindow = rows.filter((row) => row.day >= from && row.day <= today && row.available > 0);
    const available = inWindow.reduce((sum, row) => sum + row.available, 0);
    const operating = inWindow.reduce((sum, row) => sum + row.operating, 0);
    const idle = inWindow.reduce((sum, row) => sum + row.idle, 0);
    const down = inWindow.reduce((sum, row) => sum + row.down, 0);
    const idleCost = inWindow.reduce((sum, row) => sum + dailyCost * (row.idle / row.available), 0);
    const downCost = inWindow.reduce((sum, row) => sum + dailyCost * (row.down / row.available), 0);
    const used = rows.filter((row) => row.operating > 0);
    const lastUsed = used.length === 0 ? null : Math.max(...used.map((row) => row.day));

    if (dailyCost === 0) {
      unpriced += 1;
    }

    const weeks = weekBuckets.map((bucket, index) => {
      const slice = inWindow.filter((row) => row.day >= bucket.from && row.day <= bucket.to);
      const hours = slice.reduce((sum, row) => sum + row.available, 0);
      const op = slice.reduce((sum, row) => sum + row.operating, 0);
      const wk = weekBuckets[index] as Week;
      const tally = weekHours[index] as { available: number; operating: number };

      wk.idleCost += slice.reduce((sum, row) => sum + dailyCost * (row.idle / row.available), 0);
      wk.downCost += slice.reduce((sum, row) => sum + dailyCost * (row.down / row.available), 0);
      tally.available += hours;
      tally.operating += op;

      return hours > 0 ? op / hours : null;
    });

    const base = {
      status: item.status,
      days: inWindow.length,
      use: available > 0 ? operating / available : null,
      downShare: available > 0 ? down / available : null,
      hired,
    };

    units.push({
      id: item.id,
      code: item.code,
      description: item.description,
      category: item.category,
      ownership: item.ownership,
      hired,
      status: item.status,
      dailyCost,
      days: inWindow.length,
      available,
      operating,
      idle,
      down,
      use: base.use,
      idleShare: available > 0 ? idle / available : null,
      downShare: base.downShare,
      spend: dailyCost * inWindow.length,
      wasted: idleCost + downCost,
      idleCost,
      downCost,
      lastUsed,
      sinceUsed: lastUsed === null ? null : Math.max(0, today - lastUsed),
      weeks,
      verdict: verdictOf(base),
    });
  }

  weekBuckets.forEach((bucket, index) => {
    const tally = weekHours[index] as { available: number; operating: number };

    bucket.use = tally.available > 0 ? tally.operating / tally.available : null;
  });

  return { ok: true, plant: { units, weeks: weekBuckets, windowDays: win, from, latest, skipped, unpriced } };
}

export function filterUnits(units: Unit[], owner: OwnerFilter): Unit[] {
  return owner === "hired" ? units.filter((unit) => unit.hired) : owner === "owned" ? units.filter((unit) => !unit.hired) : units;
}

export function sortUnits(units: Unit[], key: SortKey): Unit[] {
  const byCode = (a: Unit, b: Unit) => a.code.localeCompare(b.code, undefined, { numeric: true });

  if (key === "use") {
    return [...units].sort((a, b) => (a.use ?? Infinity) - (b.use ?? Infinity) || b.wasted - a.wasted || byCode(a, b));
  }

  return [...units].sort((a, b) => b.wasted - a.wasted || (a.use ?? Infinity) - (b.use ?? Infinity) || byCode(a, b));
}

export function summarise(units: Unit[], windowDays: number): Totals {
  const sum = (pick: (unit: Unit) => number) => units.reduce((total, unit) => total + pick(unit), 0);
  const available = sum((unit) => unit.available);
  const spend = sum((unit) => unit.spend);
  const wasted = sum((unit) => unit.wasted);
  const candidates = units.filter((unit) => unit.verdict === "idleHire");

  return {
    units: units.length,
    logged: units.filter((unit) => unit.days > 0).length,
    available,
    operating: sum((unit) => unit.operating),
    idle: sum((unit) => unit.idle),
    down: sum((unit) => unit.down),
    use: available > 0 ? sum((unit) => unit.operating) / available : null,
    downShare: available > 0 ? sum((unit) => unit.down) / available : null,
    spend,
    wasted,
    idleCost: sum((unit) => unit.idleCost),
    downCost: sum((unit) => unit.downCost),
    wastedShare: spend > 0 ? wasted / spend : null,
    perWeek: wasted / (Math.max(WEEK, windowDays) / WEEK),
    hiredWasted: units.filter((unit) => unit.hired).reduce((total, unit) => total + unit.wasted, 0),
    candidates: candidates.length,
    candidateWasted: candidates.reduce((total, unit) => total + unit.wasted, 0),
    breakdowns: units.filter((unit) => unit.verdict === "breakdown").length,
  };
}

export function adviceText(unit: Unit, windowDays: number): string {
  const weekly = (unit.wasted * WEEK) / Math.max(WEEK, windowDays);

  if (unit.verdict === "idleHire") {
    return `Used ${pct(unit.use)} of the time. Handing it back would save up to ${eur(weekly)} a week.`;
  }

  if (unit.verdict === "breakdown") {
    return `${pct(unit.downShare)} of its available hours were lost to breakdowns or repair.`;
  }

  if (unit.verdict === "idleOwned") {
    return `Used ${pct(unit.use)} of the time. Worth redeploying to another job or selling.`;
  }

  if (unit.verdict === "offHire") {
    return unit.days > 0 ? "Marked as off hire, though hours were logged in this period." : "Marked as off hire.";
  }

  if (unit.verdict === "noData") {
    return "No hours were logged in this period.";
  }

  if (unit.days < MIN_DAYS) {
    return `Only ${unit.days} ${plural(unit.days, "day", "days")} logged, too few to judge.`;
  }

  return unit.verdict === "busy" ? "Well used." : `Used ${pct(unit.use)} of the time.`;
}

export function sinceText(unit: Unit): string {
  if (unit.lastUsed === null) {
    return "No operating hours logged";
  }

  return unit.sinceUsed === 0 ? "Used today" : `${unit.sinceUsed} ${plural(unit.sinceUsed as number, "day", "days")} ago`;
}

export function plantMarkdown(plant: Plant, units: Unit[], totals: Totals, projectName: string, today: number): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Idle plant: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Equipment hours logged over the ${plant.windowDays} days from ${formatDay(plant.from)}.`, "");
  lines.push(`- Idle and broken-down time cost about ${eur(totals.wasted)} (${totals.wastedShare === null ? "—" : pct(totals.wastedShare)} of plant cost), roughly ${eur(totals.perWeek)} a week`);
  lines.push(`- Hired plant accounts for ${eur(totals.hiredWasted)} of that; ${totals.candidates} hired ${plural(totals.candidates, "unit is", "units are")} used less than ${Math.round(LOW_USE * 100)}% of the time (${eur(totals.candidateWasted)} wasted)`);
  lines.push(`- Fleet utilisation ${pct(totals.use)}, downtime ${pct(totals.downShare)} of available hours`, "");

  lines.push("| Unit | Ownership | Used | Idle | Down | Wasted | Last operated | Verdict |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | --- | --- |");

  for (const unit of units) {
    lines.push(`| ${cell(unit.code)} ${cell(trunc(unit.description, 36))} | ${unit.ownership.toLowerCase()} | ${pct(unit.use)} | ${pct(unit.idleShare)} | ${pct(unit.downShare)} | ${eur(unit.wasted)} | ${unit.lastUsed === null ? "never" : formatDay(unit.lastUsed)} | ${VERDICT_LABEL[unit.verdict]} |`);
  }

  lines.push(
    "",
    `Used is operating hours as a share of the hours the unit was available. The cost of idle or broken-down time is each unit's daily cost multiplied by the share of every logged day that was idle or down, so a unit that sits idle for half of each day is charged half its daily cost. Daily cost is whatever has been entered for the unit, an internal rate for owned plant. A hired unit is an off-hire candidate when it was used less than ${Math.round(LOW_USE * 100)}% of the time, and a unit is flagged as breaking down when ${Math.round(HIGH_DOWNTIME * 100)}% or more of its available hours were lost; units with fewer than ${MIN_DAYS} logged days are not judged.`,
    "",
  );

  if (plant.unpriced > 0) {
    lines.push(`${plant.unpriced} ${plural(plant.unpriced, "unit has", "units have")} no daily cost, so ${plural(plant.unpriced, "it adds", "they add")} nothing to the money figures.`, "");
  }

  return lines.join("\n");
}
