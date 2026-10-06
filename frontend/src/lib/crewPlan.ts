import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { ResourceControl, WorkforceDeployment, WorkforcePlanStatus } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
  { days: 112, label: "16 weeks" },
];

export const DEFAULT_WINDOW = 56;
export const SHORT = 0.85;
export const OVER = 1.15;
export const PAGE = 10;

export type Verdict = "short" | "onPlan" | "over" | "absent";
export type Filter = "all" | "short" | "over" | "absent";

export const VERDICT_LABEL: Record<Verdict, string> = {
  short: "Short of plan",
  onPlan: "On plan",
  over: "Over plan",
  absent: "Never on site",
};

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All plans" },
  { key: "short", label: "Short of plan" },
  { key: "over", label: "Over plan" },
  { key: "absent", label: "Never on site" },
];

export interface PlanRow {
  id: string;
  trade: string;
  packageId: string | null;
  status: WorkforcePlanStatus;
  from: number;
  to: number;
  measuredFrom: number;
  measuredTo: number;
  planned: number;
  siteDays: number;
  daysWithCrew: number;
  crewDays: number;
  plannedDays: number;
  average: number;
  peak: number;
  attendance: number;
  gap: number;
  hours: number;
  verdict: Verdict;
}

export interface TradeRow {
  key: string;
  trade: string;
  plans: number;
  crewDays: number;
  plannedDays: number;
  attendance: number;
  gap: number;
  verdict: Verdict;
}

export interface Week {
  from: number;
  planned: number;
  crew: number;
  attendance: number | null;
}

export interface CrewPlan {
  from: number;
  to: number;
  rows: PlanRow[];
  trades: TradeRow[];
  weeks: Week[];
  plannedDays: number;
  crewDays: number;
  attendance: number | null;
  siteDays: number;
  short: number;
  onPlan: number;
  over: number;
  absent: number;
  shortfall: number;
  drafts: number;
  noHeadcount: number;
  outside: number;
  noSiteDays: number;
  skippedPlans: number;
  skippedDeployments: number;
  future: number;
}

export type CrewPlanResult = { ok: true; data: CrewPlan } | { ok: false; reason: "noPlans" | "noCrews" };

export function weekStart(day: number): number {
  return day - ((day + 3) % 7);
}

function tradeKey(trade: string | null | undefined): string {
  return (trade ?? "").trim().toLowerCase();
}

function tradeLabel(trade: string | null | undefined): string {
  const text = (trade ?? "").trim();

  return text.length > 0 ? text : "No trade";
}

export function verdictOf(crewDays: number, plannedDays: number): Verdict {
  if (crewDays <= 0) {
    return "absent";
  }

  const attendance = crewDays / plannedDays;

  return attendance < SHORT ? "short" : attendance > OVER ? "over" : "onPlan";
}

export function buildCrewPlan(data: ResourceControl, today: number, windowDays: number): CrewPlanResult {
  const plans = data.workforcePlans ?? [];
  const deployments = data.deployments ?? [];

  if (plans.length === 0) {
    return { ok: false, reason: "noPlans" };
  }

  if (deployments.length === 0) {
    return { ok: false, reason: "noCrews" };
  }

  const from = today - windowDays + 1;
  const siteSet = new Set<number>();
  const byTrade = new Map<string, Map<number, WorkforceDeployment[]>>();
  let skippedDeployments = 0;
  let future = 0;

  for (const item of deployments) {
    const day = toDay(item.workDate);

    if (!Number.isFinite(day) || typeof item.workers !== "number" || !Number.isFinite(item.workers) || item.workers < 0) {
      skippedDeployments += 1;
      continue;
    }

    if (day > today) {
      future += 1;
      continue;
    }

    siteSet.add(day);

    const key = tradeKey(item.trade);
    const days = byTrade.get(key) ?? new Map<number, WorkforceDeployment[]>();

    days.set(day, [...(days.get(day) ?? []), item]);
    byTrade.set(key, days);
  }

  const siteDays = [...siteSet].sort((a, b) => a - b);
  const weekMap = new Map<number, { planned: number; crew: number }>();
  const rows: PlanRow[] = [];
  let drafts = 0;
  let noHeadcount = 0;
  let outside = 0;
  let noSiteDays = 0;
  let skippedPlans = 0;

  for (const plan of plans) {
    if (plan.status === "DRAFT") {
      drafts += 1;
      continue;
    }

    const start = toDay(plan.periodStart);
    const end = toDay(plan.periodEnd);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      skippedPlans += 1;
      continue;
    }

    if (typeof plan.plannedWorkers !== "number" || !Number.isFinite(plan.plannedWorkers) || plan.plannedWorkers <= 0) {
      noHeadcount += 1;
      continue;
    }

    const measuredFrom = Math.max(start, from);
    const measuredTo = Math.min(end, today);

    if (measuredFrom > measuredTo) {
      outside += 1;
      continue;
    }

    const days = siteDays.filter((day) => day >= measuredFrom && day <= measuredTo);

    if (days.length === 0) {
      noSiteDays += 1;
      continue;
    }

    const tradeDays = byTrade.get(tradeKey(plan.trade));
    let crewDays = 0;
    let daysWithCrew = 0;
    let peak = 0;
    let hours = 0;

    for (const day of days) {
      const matching = (tradeDays?.get(day) ?? []).filter((item) => plan.workPackageId === null || item.workPackageId === plan.workPackageId);
      const crew = matching.reduce((sum, item) => sum + item.workers, 0);

      crewDays += crew;
      peak = Math.max(peak, crew);
      hours += matching.reduce((sum, item) => sum + (Number.isFinite(item.totalLaborHours) ? item.totalLaborHours : 0), 0);

      if (crew > 0) {
        daysWithCrew += 1;
      }

      const week = weekMap.get(weekStart(day)) ?? { planned: 0, crew: 0 };

      week.planned += plan.plannedWorkers;
      week.crew += crew;
      weekMap.set(weekStart(day), week);
    }

    const plannedDays = plan.plannedWorkers * days.length;

    rows.push({
      id: plan.id,
      trade: tradeLabel(plan.trade),
      packageId: plan.workPackageId,
      status: plan.status,
      from: start,
      to: end,
      measuredFrom,
      measuredTo,
      planned: plan.plannedWorkers,
      siteDays: days.length,
      daysWithCrew,
      crewDays,
      plannedDays,
      average: crewDays / days.length,
      peak,
      attendance: crewDays / plannedDays,
      gap: plannedDays - crewDays,
      hours,
      verdict: verdictOf(crewDays, plannedDays),
    });
  }

  rows.sort((a, b) => b.gap - a.gap || a.trade.localeCompare(b.trade) || a.from - b.from);

  const tradeMap = new Map<string, TradeRow>();

  for (const row of rows) {
    const key = tradeKey(row.trade === "No trade" ? "" : row.trade);
    const existing = tradeMap.get(key);

    if (existing) {
      existing.plans += 1;
      existing.crewDays += row.crewDays;
      existing.plannedDays += row.plannedDays;
    } else {
      tradeMap.set(key, { key, trade: row.trade, plans: 1, crewDays: row.crewDays, plannedDays: row.plannedDays, attendance: 0, gap: 0, verdict: "onPlan" });
    }
  }

  const trades = [...tradeMap.values()]
    .map((item) => ({ ...item, attendance: item.crewDays / item.plannedDays, gap: item.plannedDays - item.crewDays, verdict: verdictOf(item.crewDays, item.plannedDays) }))
    .sort((a, b) => b.gap - a.gap || a.trade.localeCompare(b.trade));

  const weeks: Week[] = [];

  for (let week = weekStart(from); week <= weekStart(today); week += 7) {
    const found = weekMap.get(week);

    weeks.push({ from: week, planned: found?.planned ?? 0, crew: found?.crew ?? 0, attendance: found && found.planned > 0 ? found.crew / found.planned : null });
  }

  const plannedDays = rows.reduce((sum, row) => sum + row.plannedDays, 0);
  const crewDays = rows.reduce((sum, row) => sum + row.crewDays, 0);

  return {
    ok: true,
    data: {
      from,
      to: today,
      rows,
      trades,
      weeks,
      plannedDays,
      crewDays,
      attendance: plannedDays > 0 ? crewDays / plannedDays : null,
      siteDays: siteDays.filter((day) => day >= from).length,
      short: rows.filter((row) => row.verdict === "short").length,
      onPlan: rows.filter((row) => row.verdict === "onPlan").length,
      over: rows.filter((row) => row.verdict === "over").length,
      absent: rows.filter((row) => row.verdict === "absent").length,
      shortfall: rows.filter((row) => row.verdict === "short" || row.verdict === "absent").reduce((sum, row) => sum + row.gap, 0),
      drafts,
      noHeadcount,
      outside,
      noSiteDays,
      skippedPlans,
      skippedDeployments,
      future,
    },
  };
}

export function filterRows(rows: PlanRow[], filter: Filter): PlanRow[] {
  if (filter === "short") {
    return rows.filter((row) => row.verdict === "short" || row.verdict === "absent");
  }

  if (filter === "over") {
    return rows.filter((row) => row.verdict === "over").sort((a, b) => a.gap - b.gap || a.trade.localeCompare(b.trade));
  }

  if (filter === "absent") {
    return rows.filter((row) => row.verdict === "absent");
  }

  return rows;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function crewText(value: number): string {
  const rounded = Math.round(value * 10) / 10;

  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function numberText(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function periodText(row: PlanRow): string {
  return `${formatDay(row.from)} to ${formatDay(row.to)}`;
}

export function crewMarkdown(data: CrewPlan, shown: PlanRow[], projectName: string, windowLabel: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Crew size against plan: ${projectName}`, "");
  lines.push(`Last ${windowLabel}, from ${formatDay(data.from)} to ${formatDay(data.to)}. ${data.rows.length} approved or closed ${plural(data.rows.length, "plan", "plans")} measured over ${data.siteDays} ${plural(data.siteDays, "site day", "site days")}.`, "");
  lines.push(`- ${numberText(data.crewDays)} worker-days on site against ${numberText(data.plannedDays)} planned (${pct(data.attendance)})`);
  lines.push(`- ${data.short + data.absent} ${plural(data.short + data.absent, "plan", "plans")} below ${Math.round(SHORT * 100)}% of the planned crew${data.absent > 0 ? `, ${data.absent} never on site` : ""}, missing ${numberText(data.shortfall)} worker-days`);
  lines.push(`- ${data.over} ${plural(data.over, "plan", "plans")} above ${Math.round(OVER * 100)}% of the planned crew`, "");

  if (data.trades.length > 0) {
    lines.push("| Trade | Plans | Planned worker-days | On site | Crew against plan |", "| --- | ---: | ---: | ---: | ---: |");

    for (const row of data.trades) {
      lines.push(`| ${cell(row.trade)} | ${row.plans} | ${numberText(row.plannedDays)} | ${numberText(row.crewDays)} | ${pct(row.attendance)} |`);
    }

    lines.push("");
  }

  if (shown.length > 0) {
    lines.push(`${filterLabel ? `Plans (${filterLabel.toLowerCase()}):` : "Plans:"}`, "", "| Trade | Plan period | Planned crew | Average crew | Peak | Against plan | Verdict |", "| --- | --- | ---: | ---: | ---: | ---: | --- |");

    for (const row of shown.slice(0, 25)) {
      lines.push(`| ${cell(trunc(row.trade, 30))}${row.packageId ? " (package plan)" : ""} | ${periodText(row)} | ${row.planned} | ${crewText(row.average)} | ${row.peak} | ${pct(row.attendance)} | ${VERDICT_LABEL[row.verdict]} |`);
    }

    lines.push("");
  }

  lines.push(
    `A site day is a date on which any crew was recorded on site. For each plan, the crew on a site day is the number of workers deployed in the plan's trade on that day, or on its work package when the plan names one, and zero when none were recorded. Crew against plan is the worker-days on site divided by the planned headcount multiplied by the site days, counted only within the plan dates and the period. A plan below ${Math.round(SHORT * 100)}% is short of plan and one above ${Math.round(OVER * 100)}% is over plan. A deployment counts towards every plan it matches. Draft plans are left out${data.drafts > 0 ? ` (${data.drafts})` : ""}.${data.noSiteDays > 0 ? ` ${data.noSiteDays} ${plural(data.noSiteDays, "plan has", "plans have")} no site day recorded within its dates and ${plural(data.noSiteDays, "is", "are")} left out.` : ""}`,
    "",
  );

  return lines.join("\n");
}
