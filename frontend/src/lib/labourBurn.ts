import { plural, trunc } from "@/lib/openItems";
import type { ProductionControl } from "@/types/project";

export const OVER = 1.1;
export const EARLY = 10;
export const PAGE = 10;

export type Scope = "open" | "all";

export const SCOPES: ReadonlyArray<{ key: Scope; label: string }> = [
  { key: "open", label: "Open packages" },
  { key: "all", label: "All packages" },
];

export type Mode = "final" | "forecast" | "early" | "exhausted";
export type Band = "over" | "watch" | "ok" | "unknown";

export const BAND_LABEL: Record<Band, string> = {
  over: "Heading well over",
  watch: "Slightly over",
  ok: "Within the hours",
  unknown: "Too early to say",
};

export interface Row {
  id: string;
  code: string;
  name: string;
  status: string;
  blocked: boolean;
  completed: boolean;
  planned: number;
  used: number;
  progress: number;
  earned: number;
  efficiency: number | null;
  usedShare: number;
  burnGap: number;
  forecast: number | null;
  overrun: number | null;
  mode: Mode;
  band: Band;
}

export interface Totals {
  packages: number;
  planned: number;
  used: number;
  earned: number;
  efficiency: number | null;
  projected: number;
  overrun: number;
  over: number;
  watch: number;
  exhausted: number;
  unknown: number;
}

export interface Burn {
  rows: Row[];
  open: Totals;
  all: Totals;
  noBudget: number;
  notStarted: number;
  cancelled: number;
}

export type BurnResult = { ok: true; burn: Burn } | { ok: false; reason: "empty" };

function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function totals(rows: Row[]): Totals {
  const planned = rows.reduce((sum, row) => sum + row.planned, 0);
  const used = rows.reduce((sum, row) => sum + row.used, 0);
  const earned = rows.reduce((sum, row) => sum + row.earned, 0);
  const projected = rows.reduce((sum, row) => sum + (row.forecast ?? Math.max(row.planned, row.used)), 0);

  return {
    packages: rows.length,
    planned,
    used,
    earned,
    efficiency: used > 0 ? earned / used : null,
    projected,
    overrun: projected - planned,
    over: rows.filter((row) => row.band === "over").length,
    watch: rows.filter((row) => row.band === "watch").length,
    exhausted: rows.filter((row) => row.mode === "exhausted").length,
    unknown: rows.filter((row) => row.band === "unknown").length,
  };
}

export function buildBurn(data: ProductionControl): BurnResult {
  const packages = data.workPackages ?? [];

  if (packages.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const rows: Row[] = [];
  let noBudget = 0;
  let notStarted = 0;
  let cancelled = 0;

  for (const pack of packages) {
    if (pack.status === "CANCELLED") {
      cancelled += 1;
      continue;
    }

    const planned = finite(pack.plannedLaborHours);
    const used = Math.max(0, finite(pack.actualLaborHours));
    const progress = Math.min(100, Math.max(0, finite(pack.completionPercentage)));

    if (planned <= 0) {
      noBudget += 1;
      continue;
    }

    if (pack.status === "PLANNED" && used === 0 && progress === 0) {
      notStarted += 1;
      continue;
    }

    const completed = pack.status === "COMPLETED" || progress >= 100;
    const earned = (planned * progress) / 100;
    const exhausted = !completed && used >= planned;
    let forecast: number | null = null;
    let mode: Mode = "early";

    if (completed) {
      forecast = used;
      mode = "final";
    } else if (progress >= EARLY && used > 0) {
      forecast = used / (progress / 100);
      mode = exhausted ? "exhausted" : "forecast";
    } else if (exhausted) {
      mode = "exhausted";
    }

    const band: Band = forecast === null ? (exhausted ? "over" : "unknown") : forecast > planned * OVER ? "over" : forecast > planned ? "watch" : "ok";

    rows.push({
      id: pack.id,
      code: pack.code,
      name: pack.name,
      status: pack.status,
      blocked: pack.status === "BLOCKED",
      completed,
      planned,
      used,
      progress,
      earned,
      efficiency: used > 0 ? earned / used : null,
      usedShare: used / planned,
      burnGap: (used / planned) * 100 - progress,
      forecast,
      overrun: forecast === null ? null : forecast - planned,
      mode,
      band,
    });
  }

  rows.sort((a, b) => {
    if (a.overrun !== null && b.overrun !== null) {
      return b.overrun - a.overrun || a.code.localeCompare(b.code, undefined, { numeric: true });
    }

    if (a.overrun !== null) {
      return -1;
    }

    if (b.overrun !== null) {
      return 1;
    }

    return b.usedShare - a.usedShare || a.code.localeCompare(b.code, undefined, { numeric: true });
  });

  return {
    ok: true,
    burn: {
      rows,
      open: totals(rows.filter((row) => !row.completed)),
      all: totals(rows),
      noBudget,
      notStarted,
      cancelled,
    },
  };
}

export function inScope(rows: Row[], scope: Scope): Row[] {
  return scope === "open" ? rows.filter((row) => !row.completed) : rows;
}

export type Filter = "all" | "over" | "ok" | "unknown";

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "over", label: "Over the hours" },
  { key: "ok", label: "Within the hours" },
  { key: "unknown", label: "Too early" },
];

export function filterRows(rows: Row[], filter: Filter): Row[] {
  if (filter === "all") {
    return rows;
  }

  if (filter === "over") {
    return rows.filter((row) => row.band === "over" || row.band === "watch");
  }

  return rows.filter((row) => row.band === filter);
}

export function hoursText(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function signedHours(value: number): string {
  const rounded = Math.round(value);

  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${hoursText(Math.abs(rounded))} h`;
}

export function ratio(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function forecastText(row: Row): string {
  if (row.mode === "final") {
    return `Finished on ${hoursText(row.used)} h`;
  }

  if (row.forecast === null) {
    return row.mode === "exhausted" ? "Hours used up, no forecast yet" : row.used === 0 ? "No hours logged yet" : `Under ${EARLY}% complete, too early to forecast`;
  }

  return `Forecast ${hoursText(row.forecast)} h`;
}

export function overrunText(row: Row): string {
  if (row.overrun === null) {
    return row.mode === "exhausted" ? `${signedHours(row.used - row.planned)} already` : "";
  }

  return `${signedHours(row.overrun)} against the plan`;
}

export function burnMarkdown(rows: Row[], totalsFor: Totals, projectName: string, scope: Scope, extra: { noBudget: number; notStarted: number; filter?: string }): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Labour budget burn: ${projectName}`, "");
  lines.push(`${scope === "open" ? "Open work packages" : "All work packages"} with a labour budget and some progress or hours logged.${extra.filter ? ` Listed below: ${extra.filter.toLowerCase()}.` : ""}`, "");
  lines.push(`- ${hoursText(totalsFor.used)} h used against ${hoursText(totalsFor.planned)} h planned, ${hoursText(totalsFor.earned)} h earned (efficiency ${ratio(totalsFor.efficiency)})`);
  lines.push(`- Projected ${hoursText(totalsFor.projected)} h at completion, ${signedHours(totalsFor.overrun)} against the plan`);
  lines.push(`- ${totalsFor.over} ${plural(totalsFor.over, "package", "packages")} heading more than ${Math.round((OVER - 1) * 100)}% over, ${totalsFor.watch} slightly over, ${totalsFor.unknown} too early to say`, "");

  lines.push("| Package | Status | Progress | Planned h | Used h | Forecast h | Against plan |", "| --- | --- | ---: | ---: | ---: | ---: | ---: |");

  for (const row of rows) {
    lines.push(`| ${cell(row.code)} ${cell(trunc(row.name, 40))} | ${row.completed ? "Complete" : row.blocked ? "Blocked" : "In progress"} | ${Math.round(row.progress)}% | ${hoursText(row.planned)} | ${hoursText(row.used)} | ${row.forecast === null ? "—" : hoursText(row.forecast)} | ${row.overrun === null ? "—" : signedHours(row.overrun)} |`);
  }

  lines.push(
    "",
    `Used hours are the labour hours booked to the package. Earned hours are the planned hours multiplied by the percentage complete, and efficiency is earned divided by used, so below 1.00 means more hours are being spent than the progress is worth. The forecast divides the hours used by the share complete, which assumes the rest of the work goes at the same rate; it is only given once a package is ${EARLY}% complete. A forecast more than ${Math.round((OVER - 1) * 100)}% above the plan is shown as heading well over. A package that has already used its planned hours is shown as over even before it can be forecast. For the total, a package too early to forecast is assumed to finish on its plan. ${extra.noBudget > 0 ? `${extra.noBudget} ${plural(extra.noBudget, "package has", "packages have")} no planned hours and ${plural(extra.noBudget, "is", "are")} left out. ` : ""}${extra.notStarted > 0 ? `${extra.notStarted} ${plural(extra.notStarted, "package has", "packages have")} not started and ${plural(extra.notStarted, "is", "are")} left out.` : ""}`.trim(),
    "",
  );

  return lines.join("\n");
}
