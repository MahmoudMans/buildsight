import { DAY_MS, formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { ProductionControl, ResourceControl } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 28, label: "4 weeks" },
  { days: 56, label: "8 weeks" },
  { days: 112, label: "16 weeks" },
];

export const DEFAULT_WINDOW = 56;
export const TOLERANCE = 0.15;
export const MIN_GAP = 40;
export const PAGE = 10;

export type Verdict = "matches" | "underReported" | "overReported" | "deployedOnly" | "reportedOnly";
export type Filter = "all" | "disagree";

export const VERDICT_LABEL: Record<Verdict, string> = {
  matches: "Roughly agree",
  underReported: "Crews on site, less reported",
  overReported: "More reported than deployed",
  deployedOnly: "Deployed, nothing reported",
  reportedOnly: "Reported, nobody deployed",
};

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All packages" },
  { key: "disagree", label: "Disagreeing only" },
];

export interface PackageRow {
  id: string;
  code: string;
  name: string;
  deployed: number;
  reported: number;
  gap: number;
  ratio: number | null;
  planned: number | null;
  verdict: Verdict;
  trades: string[];
}

export interface TradeRow {
  trade: string;
  deployed: number;
  unassigned: number;
  share: number | null;
}

export interface Week {
  from: number;
  deployed: number;
  assigned: number;
  reported: number;
}

export interface Reconciliation {
  packages: PackageRow[];
  trades: TradeRow[];
  weeks: Week[];
  from: number;
  to: number;
  windowDays: number;
  deployed: number;
  assigned: number;
  unassigned: number;
  unassignedShare: number | null;
  reported: number;
  coverage: number | null;
  disagree: number;
  under: number;
  over: number;
  unknownPackages: number;
  drafts: number;
  skipped: number;
}

export type ReconciliationResult = { ok: true; rec: Reconciliation } | { ok: false; reason: "empty" };

function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function mondayOf(day: number): number {
  const weekday = new Date(day * DAY_MS).getUTCDay();

  return day - ((weekday + 6) % 7);
}

export function verdictOf(deployed: number, reported: number): Verdict {
  const gap = deployed - reported;
  const big = Math.max(deployed, reported);

  if (deployed > 0 && reported === 0) {
    return deployed >= MIN_GAP ? "deployedOnly" : "matches";
  }

  if (reported > 0 && deployed === 0) {
    return reported >= MIN_GAP ? "reportedOnly" : "matches";
  }

  if (Math.abs(gap) < MIN_GAP || Math.abs(gap) / big <= TOLERANCE) {
    return "matches";
  }

  return gap > 0 ? "underReported" : "overReported";
}

export function buildReconciliation(resources: ResourceControl, production: ProductionControl, today: number, windowDays: number): ReconciliationResult {
  const from = today - windowDays + 1;
  const packages = new Map<string, { code: string; name: string; planned: number | null }>();

  for (const pack of production.workPackages ?? []) {
    packages.set(pack.id, { code: pack.code, name: pack.name, planned: finite(pack.plannedLaborHours) > 0 ? finite(pack.plannedLaborHours) : null });
  }

  const draftReports = new Set((production.siteReports ?? []).filter((report) => report.status === "DRAFT").map((report) => report.id));
  const rows = new Map<string, PackageRow & { tradeSet: Set<string> }>();
  const trades = new Map<string, TradeRow>();
  const weeks = new Map<number, Week>();
  let skipped = 0;
  let drafts = 0;
  let unknownPackages = 0;

  function row(id: string, fallbackCode: string, fallbackName: string) {
    const known = packages.get(id);
    const existing = rows.get(id);

    if (existing) {
      return existing;
    }

    const created = {
      id,
      code: known?.code ?? fallbackCode,
      name: known?.name ?? fallbackName,
      deployed: 0,
      reported: 0,
      gap: 0,
      ratio: null as number | null,
      planned: known?.planned ?? null,
      verdict: "matches" as Verdict,
      trades: [] as string[],
      tradeSet: new Set<string>(),
    };

    rows.set(id, created);

    return created;
  }

  function week(day: number): Week {
    const start = mondayOf(day);
    const existing = weeks.get(start);

    if (existing) {
      return existing;
    }

    const created = { from: start, deployed: 0, assigned: 0, reported: 0 };

    weeks.set(start, created);

    return created;
  }

  let deployed = 0;
  let assigned = 0;
  let anyHours = false;

  for (const item of resources.deployments ?? []) {
    const day = toDay(item.workDate);

    if (!Number.isFinite(day)) {
      skipped += 1;
      continue;
    }

    const hours = finite(item.totalLaborHours);

    anyHours = anyHours || hours > 0;

    if (hours <= 0 || day < from || day > today) {
      continue;
    }

    const trade = (item.trade ?? "").trim() || "Unassigned trade";
    const tradeRow = trades.get(trade.toLowerCase()) ?? { trade, deployed: 0, unassigned: 0, share: null };
    const known = item.workPackageId !== null && packages.has(item.workPackageId);

    if (item.workPackageId !== null && !known) {
      unknownPackages += 1;
    }

    deployed += hours;
    tradeRow.deployed += hours;
    week(day).deployed += hours;

    if (known && item.workPackageId !== null) {
      const target = row(item.workPackageId, "", "");

      assigned += hours;
      target.deployed += hours;
      target.tradeSet.add(tradeRow.trade);
      week(day).assigned += hours;
    } else {
      tradeRow.unassigned += hours;
    }

    trades.set(trade.toLowerCase(), tradeRow);
  }

  let reported = 0;

  for (const entry of production.productionEntries ?? []) {
    const day = toDay(entry.reportDate);

    if (!Number.isFinite(day)) {
      skipped += 1;
      continue;
    }

    const hours = finite(entry.laborHours);

    anyHours = anyHours || hours > 0;

    if (hours <= 0 || day < from || day > today) {
      continue;
    }

    if (draftReports.has(entry.siteReportId)) {
      drafts += 1;
      continue;
    }

    reported += hours;
    row(entry.workPackageId, entry.workPackageCode, entry.workPackageName).reported += hours;
    week(day).reported += hours;
  }

  if (!anyHours && skipped === 0) {
    return { ok: false, reason: "empty" };
  }

  const list: PackageRow[] = [];

  for (const value of rows.values()) {
    const { tradeSet, ...rest } = value;

    list.push({
      ...rest,
      gap: value.deployed - value.reported,
      ratio: value.deployed > 0 ? value.reported / value.deployed : null,
      verdict: verdictOf(value.deployed, value.reported),
      trades: [...tradeSet].sort((a, b) => a.localeCompare(b)),
    });
  }

  list.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap) || a.code.localeCompare(b.code, undefined, { numeric: true }));

  const tradeRows = [...trades.values()]
    .map((item) => ({ ...item, share: item.deployed > 0 ? item.unassigned / item.deployed : null }))
    .sort((a, b) => b.unassigned - a.unassigned || a.trade.localeCompare(b.trade));

  const firstWeek = mondayOf(from);
  const weekRows: Week[] = [];

  for (let start = firstWeek; start <= mondayOf(today); start += 7) {
    weekRows.push(weeks.get(start) ?? { from: start, deployed: 0, assigned: 0, reported: 0 });
  }

  const unassigned = deployed - assigned;
  const under = list.filter((item) => item.verdict === "underReported" || item.verdict === "deployedOnly").length;
  const over = list.filter((item) => item.verdict === "overReported" || item.verdict === "reportedOnly").length;

  return {
    ok: true,
    rec: {
      packages: list,
      trades: tradeRows,
      weeks: weekRows,
      from,
      to: today,
      windowDays,
      deployed,
      assigned,
      unassigned,
      unassignedShare: deployed > 0 ? unassigned / deployed : null,
      reported,
      coverage: deployed > 0 ? reported / deployed : null,
      disagree: under + over,
      under,
      over,
      unknownPackages,
      drafts,
      skipped,
    },
  };
}

export function filterPackages(list: PackageRow[], filter: Filter): PackageRow[] {
  return filter === "disagree" ? list.filter((item) => item.verdict !== "matches") : list;
}

export function hoursText(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function pct(value: number | null): string {
  if (value === null) return "—";
  const whole = Math.round(value * 100);
  return whole > 999 ? ">999%" : `${whole}%`;
}

export function gapText(item: PackageRow): string {
  if (item.verdict === "matches") {
    return `${hoursText(Math.abs(item.gap))} h apart`;
  }

  return item.gap > 0 ? `${hoursText(item.gap)} h deployed but not reported` : `${hoursText(-item.gap)} h reported beyond the crews deployed`;
}

export function reconciliationMarkdown(rec: Reconciliation, list: PackageRow[], projectName: string, today: number): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Labour reconciliation: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Labour hours from ${formatDay(rec.from)} to ${formatDay(rec.to)}.`, "");
  lines.push(`- ${hoursText(rec.deployed)} h deployed, ${hoursText(rec.reported)} h reported on site reports (${pct(rec.coverage)})`);
  lines.push(`- ${hoursText(rec.unassigned)} h (${pct(rec.unassignedShare)}) deployed without being booked to a work package`);
  lines.push(`- ${rec.disagree} ${plural(rec.disagree, "package disagrees", "packages disagree")}: ${rec.under} with crews deployed but less reported, ${rec.over} with more reported than deployed`, "");

  lines.push("| Package | Deployed h | Reported h | Gap h | Reading |");
  lines.push("| --- | ---: | ---: | ---: | --- |");

  for (const item of list) {
    lines.push(`| ${cell(item.code)} ${cell(trunc(item.name, 40))} | ${hoursText(item.deployed)} | ${hoursText(item.reported)} | ${item.gap > 0 ? "+" : item.gap < 0 ? "−" : ""}${hoursText(Math.abs(item.gap))} | ${VERDICT_LABEL[item.verdict]} |`);
  }

  lines.push(
    "",
    `Deployed hours are the labour hours in the daily workforce deployments; reported hours are the labour hours booked against work packages on submitted and approved site reports. Both are limited to the period above. A package roughly agrees when the two are within ${Math.round(TOLERANCE * 100)}% of each other or under ${MIN_GAP} hours apart. The two are entered separately, so some difference is normal; a large one means labour is being paid for without the matching output being recorded, or the other way round. Deployments with no work package, or one that is not on the register, count as not booked.`,
    "",
  );

  return lines.join("\n");
}
