import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { ProductionControl, WorkPackage } from "@/types/project";

export const PAGE = 10;
export const TOL_ABS = 0.05;
export const TOL_REL = 0.01;
export const MAX_SHIFT = 14;
export const RATE_FACTOR = 3;
export const MIN_RATE_ENTRIES = 5;

export type Measure = "quantity" | "labour" | "equipment";
export type MeasureVerdict = "agrees" | "draftOnly" | "above" | "below";
export type PackageVerdict = "agrees" | "draftOnly" | "disagrees";
export type PackageFilter = "all" | "attention";
export type EntryFlag = "negative" | "unknownPackage" | "noHours" | "noCrew" | "longShift" | "outlier" | "duplicate" | "unit" | "dates" | "outsideDates" | "inactive";

export const MEASURES: Measure[] = ["quantity", "labour", "equipment"];

export const MEASURE_LABEL: Record<Measure, string> = {
  quantity: "Quantity",
  labour: "Labour hours",
  equipment: "Equipment hours",
};

export const MEASURE_VERDICT_LABEL: Record<MeasureVerdict, string> = {
  agrees: "Agrees",
  draftOnly: "Agrees only with drafts",
  above: "Total above entries",
  below: "Entries above total",
};

export const PACKAGE_FILTERS: ReadonlyArray<{ key: PackageFilter; label: string }> = [
  { key: "all", label: "All packages" },
  { key: "attention", label: "Needs a look" },
];

export const ENTRY_FLAGS: EntryFlag[] = ["negative", "unknownPackage", "noHours", "noCrew", "longShift", "outlier", "duplicate", "unit", "dates", "outsideDates", "inactive"];

export const ENTRY_FLAG_LABEL: Record<EntryFlag, string> = {
  negative: "Negative figure",
  unknownPackage: "Unknown package",
  noHours: "Output, no hours",
  noCrew: "Hours, no crew",
  longShift: `Over ${MAX_SHIFT} h per worker`,
  outlier: "Unusual output rate",
  duplicate: "Repeat entry that day",
  unit: "Unit differs",
  dates: "Date differs from report",
  outsideDates: "Outside package dates",
  inactive: "Package not active",
};

export interface MeasureRow {
  measure: Measure;
  stated: number;
  fromEntries: number;
  fromAll: number;
  gap: number;
  verdict: MeasureVerdict;
}

export interface PackageRow {
  id: string;
  code: string;
  name: string;
  unit: string;
  status: WorkPackage["status"];
  entries: number;
  draftEntries: number;
  measures: MeasureRow[];
  verdict: PackageVerdict;
  bad: Measure[];
  worst: number;
}

export interface EntryRow {
  key: string;
  reference: string;
  day: number;
  packageCode: string | null;
  packageName: string | null;
  unit: string;
  quantity: number;
  labour: number;
  equipment: number;
  crew: number;
  flags: EntryFlag[];
  draft: boolean;
}

export interface Checks {
  packages: PackageRow[];
  flagged: EntryRow[];
  flagCounts: Partial<Record<EntryFlag, number>>;
  entryCount: number;
  reportCount: number;
  skipped: number;
  draftEntries: number;
  noReport: number;
  agree: number;
  draftOnly: number;
  disagree: number;
  unused: number;
  cancelled: number;
}

export type ChecksResult = { ok: true; data: Checks } | { ok: false; reason: "noPackages" | "noEntries" };

function num(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function before(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function close(a: number, b: number): boolean {
  return Math.abs(a - b) <= Math.max(TOL_ABS, TOL_REL * Math.max(Math.abs(a), Math.abs(b)));
}

function measureOf(measure: Measure, stated: number, accepted: number, all: number): MeasureRow {
  const verdict: MeasureVerdict = close(stated, accepted) ? "agrees" : all !== accepted && close(stated, all) ? "draftOnly" : stated > accepted ? "above" : "below";

  return { measure, stated, fromEntries: accepted, fromAll: all, gap: stated - accepted, verdict };
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function fmt(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const [whole = "0", fraction] = Math.abs(rounded).toString().split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const text = fraction ? `${grouped}.${fraction}` : grouped;

  return rounded < 0 ? `−${text}` : text;
}

export function signed(value: number): string {
  const text = fmt(value);

  return value > 0 && text !== "0" ? `+${text}` : text;
}

export function buildChecks(data: ProductionControl): ChecksResult {
  const allPackages = data.workPackages ?? [];
  const live = allPackages.filter((item) => item.status !== "CANCELLED");

  if (live.length === 0) {
    return { ok: false, reason: "noPackages" };
  }

  const entries = data.productionEntries ?? [];

  if (entries.length === 0) {
    return { ok: false, reason: "noEntries" };
  }

  const reports = new Map((data.siteReports ?? []).map((report) => [report.id, report]));
  const byId = new Map(allPackages.map((item) => [item.id, item]));
  const sums = new Map<string, { accepted: Record<Measure, number>; all: Record<Measure, number>; count: number; drafts: number }>();

  for (const entry of entries) {
    if (!byId.has(entry.workPackageId)) {
      continue;
    }

    const draft = reports.get(entry.siteReportId)?.status === "DRAFT";
    const sum = sums.get(entry.workPackageId) ?? { accepted: { quantity: 0, labour: 0, equipment: 0 }, all: { quantity: 0, labour: 0, equipment: 0 }, count: 0, drafts: 0 };
    const values: Record<Measure, number> = { quantity: num(entry.quantityCompleted), labour: num(entry.laborHours), equipment: num(entry.equipmentHours) };

    for (const measure of MEASURES) {
      sum.all[measure] += values[measure];

      if (!draft) {
        sum.accepted[measure] += values[measure];
      }
    }

    sum.count += draft ? 0 : 1;
    sum.drafts += draft ? 1 : 0;
    sums.set(entry.workPackageId, sum);
  }

  const packages: PackageRow[] = [];
  let unused = 0;

  for (const item of live) {
    const sum = sums.get(item.id);
    const stated: Record<Measure, number> = { quantity: num(item.actualQuantity), labour: num(item.actualLaborHours), equipment: num(item.actualEquipmentHours) };
    const used = MEASURES.some((measure) => stated[measure] > 0) || (sum !== undefined && sum.count + sum.drafts > 0);

    if (!used) {
      unused += 1;
      continue;
    }

    const measures = MEASURES.map((measure) => measureOf(measure, stated[measure], sum ? sum.accepted[measure] : 0, sum ? sum.all[measure] : 0));
    const bad = measures.filter((row) => row.verdict === "above" || row.verdict === "below");
    const worst = bad.reduce((top, row) => Math.max(top, Math.abs(row.gap) / Math.max(Math.abs(row.stated), Math.abs(row.fromEntries), 1e-9)), 0);

    packages.push({
      id: item.id,
      code: item.code,
      name: item.name,
      unit: item.unit,
      status: item.status,
      entries: sum ? sum.count : 0,
      draftEntries: sum ? sum.drafts : 0,
      measures,
      verdict: bad.length > 0 ? "disagrees" : measures.some((row) => row.verdict === "draftOnly") ? "draftOnly" : "agrees",
      bad: bad.map((row) => row.measure),
      worst,
    });
  }

  const rank: Record<PackageVerdict, number> = { disagrees: 0, draftOnly: 1, agrees: 2 };

  packages.sort((a, b) => rank[a.verdict] - rank[b.verdict] || b.worst - a.worst || before(a.code, b.code));

  const rows: Array<EntryRow & { pkgId: string }> = [];
  let skipped = 0;
  let noReport = 0;

  for (const entry of entries) {
    const day = toDay(entry.reportDate);

    if (!Number.isFinite(day)) {
      skipped += 1;
      continue;
    }

    const pkg = byId.get(entry.workPackageId);
    const report = reports.get(entry.siteReportId);
    const quantity = num(entry.quantityCompleted);
    const labour = num(entry.laborHours);
    const equipment = num(entry.equipmentHours);
    const crew = num(entry.crewSize);
    const flags = new Set<EntryFlag>();

    if (!report) {
      noReport += 1;
    }

    if (quantity < 0 || labour < 0 || equipment < 0) {
      flags.add("negative");
    }

    if (!pkg) {
      flags.add("unknownPackage");
    }

    if (quantity > 0 && labour <= 0 && equipment <= 0) {
      flags.add("noHours");
    }

    if (labour > 0 && crew <= 0) {
      flags.add("noCrew");
    }

    if (crew > 0 && labour / crew > MAX_SHIFT) {
      flags.add("longShift");
    }

    if (pkg) {
      const own = (entry.unit ?? "").trim().toLowerCase();
      const expected = (pkg.unit ?? "").trim().toLowerCase();

      if (own && expected && own !== expected) {
        flags.add("unit");
      }

      const start = toDay(pkg.actualStartDate);
      const end = toDay(pkg.actualEndDate);

      if ((Number.isFinite(start) && day < start) || (pkg.status === "COMPLETED" && Number.isFinite(end) && day > end)) {
        flags.add("outsideDates");
      }

      if ((pkg.status === "PLANNED" || pkg.status === "CANCELLED") && (quantity > 0 || labour > 0 || equipment > 0)) {
        flags.add("inactive");
      }
    }

    if (report) {
      const reportDay = toDay(report.reportDate);

      if (Number.isFinite(reportDay) && reportDay !== day) {
        flags.add("dates");
      }
    }

    rows.push({
      pkgId: entry.workPackageId,
      key: entry.id,
      reference: entry.siteReportReference,
      day,
      packageCode: pkg ? pkg.code : null,
      packageName: pkg ? pkg.name : null,
      unit: pkg ? pkg.unit : entry.unit,
      quantity,
      labour,
      equipment,
      crew,
      flags: [...flags],
      draft: report?.status === "DRAFT",
    });
  }

  const perDay = new Map<string, EntryRow[]>();
  const perPackage = new Map<string, EntryRow[]>();

  for (const row of rows) {
    const dayKey = `${row.pkgId}|${row.day}`;

    perDay.set(dayKey, [...(perDay.get(dayKey) ?? []), row]);

    if (row.quantity > 0 && row.labour > 0) {
      perPackage.set(row.pkgId, [...(perPackage.get(row.pkgId) ?? []), row]);
    }
  }

  const add = (row: EntryRow, flag: EntryFlag) => {
    if (!row.flags.includes(flag)) {
      row.flags.push(flag);
    }
  };

  for (const group of perDay.values()) {
    if (group.length > 1) {
      group.forEach((row) => add(row, "duplicate"));
    }
  }

  for (const group of perPackage.values()) {
    if (group.length < MIN_RATE_ENTRIES) {
      continue;
    }

    const mid = median(group.map((row) => row.quantity / row.labour));

    for (const row of group) {
      const rate = row.quantity / row.labour;

      if (rate > RATE_FACTOR * mid || rate < mid / RATE_FACTOR) {
        add(row, "outlier");
      }
    }
  }

  const order = new Map(ENTRY_FLAGS.map((flag, index) => [flag, index]));
  const checked: EntryRow[] = rows.map(({ pkgId: _pkgId, ...row }) => ({ ...row, flags: [...row.flags].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)) }));

  checked.sort((a, b) => b.flags.length - a.flags.length || b.day - a.day || before(a.reference, b.reference) || before(a.key, b.key));

  const flagged = checked.filter((row) => row.flags.length > 0);
  const flagCounts: Partial<Record<EntryFlag, number>> = {};

  for (const row of flagged) {
    for (const flag of row.flags) {
      flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
    }
  }

  return {
    ok: true,
    data: {
      packages,
      flagged,
      flagCounts,
      entryCount: checked.length,
      reportCount: reports.size,
      skipped,
      draftEntries: checked.filter((row) => row.draft).length,
      noReport,
      agree: packages.filter((row) => row.verdict === "agrees").length,
      draftOnly: packages.filter((row) => row.verdict === "draftOnly").length,
      disagree: packages.filter((row) => row.verdict === "disagrees").length,
      unused,
      cancelled: allPackages.length - live.length,
    },
  };
}

export function filterPackages(rows: PackageRow[], filter: PackageFilter): PackageRow[] {
  return filter === "attention" ? rows.filter((row) => row.verdict !== "agrees") : rows;
}

export function filterEntries(rows: EntryRow[], flag: EntryFlag | "all"): EntryRow[] {
  return flag === "all" ? rows : rows.filter((row) => row.flags.includes(flag));
}

export function checksMarkdown(data: Checks, shown: EntryRow[], projectName: string, flagLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const checked = data.packages.length;

  lines.push(`# Production reconciliation: ${projectName}`, "");
  lines.push(`${checked} ${plural(checked, "work package", "work packages")} checked against ${data.entryCount} daily ${plural(data.entryCount, "entry", "entries")} from ${data.reportCount} site ${plural(data.reportCount, "report", "reports")}.`, "");
  lines.push(`- Agree on quantity, labour hours and equipment hours: ${data.agree}`);
  lines.push(`- Agree only when draft reports are counted: ${data.draftOnly}`);
  lines.push(`- Do not agree: ${data.disagree}`);
  lines.push(`- Entries with at least one flag: ${data.flagged.length} of ${data.entryCount}`, "");

  const attention = data.packages.filter((row) => row.verdict !== "agrees");

  if (attention.length > 0) {
    lines.push("| Package | Measure | Package total | From entries | Gap | Result |", "| --- | --- | ---: | ---: | ---: | --- |");

    for (const row of attention) {
      for (const measure of row.measures.filter((item) => item.verdict !== "agrees")) {
        lines.push(`| ${cell(`${row.code} ${row.name}`)} | ${MEASURE_LABEL[measure.measure]} | ${fmt(measure.stated)} | ${fmt(measure.fromEntries)} | ${signed(measure.gap)} | ${MEASURE_VERDICT_LABEL[measure.verdict]} |`);
      }
    }

    lines.push("");
  }

  if (shown.length > 0) {
    lines.push(flagLabel ? `Entries (${flagLabel.toLowerCase()}):` : "Flagged entries:", "", "| Report | Date | Package | Quantity | Labour hours | Flags |", "| --- | --- | --- | ---: | ---: | --- |");

    for (const row of shown.slice(0, 25)) {
      lines.push(`| ${cell(row.reference)} | ${formatDay(row.day)} | ${cell(row.packageCode ? trunc(`${row.packageCode} ${row.packageName ?? ""}`, 36) : "Unknown package")} | ${fmt(row.quantity)} | ${fmt(row.labour)} | ${row.flags.map((flag) => ENTRY_FLAG_LABEL[flag]).join(", ")} |`);
    }

    lines.push("");
  }

  lines.push(`Package totals are compared with the entries from submitted and approved site reports; a total that only matches when draft reports are counted is shown separately. Totals within ${Math.round(TOL_REL * 100)}% (or ${TOL_ABS}) count as agreeing. Entry flags show records worth a second look, not proven errors.`, "");

  return lines.join("\n");
}
