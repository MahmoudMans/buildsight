import { money, plural, trunc } from "@/lib/openItems";
import type { CostControl } from "@/types/project";

export const PAGE = 10;
export const TOLERANCE = 1;
export const GROWN = 0.1;

export type Filter = "all" | "changed" | "grown" | "over";

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All lines" },
  { key: "changed", label: "Changed" },
  { key: "grown", label: "Grown 10% or more" },
  { key: "over", label: "Forecast over" },
];

export interface Line {
  id: string;
  code: string;
  name: string;
  original: number;
  changes: number;
  revised: number;
  forecast: number;
  growth: number | null;
  added: boolean;
  removed: boolean;
  forecastGap: number;
  over: boolean;
  unbudgeted: boolean;
  off: number;
  mismatch: boolean;
}

export type StepKind = "total" | "up" | "down";

export interface Step {
  key: "original" | "increases" | "reductions" | "unexplained" | "revised" | "forecastGap" | "forecast";
  label: string;
  value: number;
  from: number;
  to: number;
  kind: StepKind;
}

export interface SummaryCheck {
  label: string;
  summary: number;
  lines: number;
}

export interface Movement {
  lines: Line[];
  original: number;
  changes: number;
  increases: number;
  reductions: number;
  revised: number;
  forecast: number;
  forecastGap: number;
  unexplained: number;
  changed: number;
  added: number;
  removed: number;
  over: number;
  overAmount: number;
  top3Share: number | null;
  approved: number | null;
  overApproved: number;
  checks: SummaryCheck[];
  mismatched: number;
  emptyLines: number;
  skipped: number;
  steps: Step[];
  scale: number;
}

export type MovementResult = { ok: true; data: Movement } | { ok: false; reason: "empty" };

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildMovement(data: CostControl): MovementResult {
  const raw = data.budgetLines ?? [];

  if (raw.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const lines: Line[] = [];
  let emptyLines = 0;
  let skipped = 0;

  for (const item of raw) {
    const original = finite(item.originalBudget);
    const changes = finite(item.approvedChanges);
    const revised = finite(item.revisedBudget);
    const forecast = finite(item.forecastCost);

    if (original === null || changes === null || revised === null || forecast === null) {
      skipped += 1;
      continue;
    }

    if ([original, changes, revised, forecast].every((value) => Math.abs(value) <= TOLERANCE)) {
      emptyLines += 1;
      continue;
    }

    const off = revised - (original + changes);
    const forecastGap = forecast - revised;

    lines.push({
      id: item.id,
      code: item.costCode,
      name: item.costCodeName,
      original,
      changes,
      revised,
      forecast,
      growth: original > TOLERANCE ? changes / original : null,
      added: original <= TOLERANCE && revised > TOLERANCE,
      removed: original > TOLERANCE && revised <= TOLERANCE,
      forecastGap,
      over: forecastGap > TOLERANCE,
      unbudgeted: revised <= TOLERANCE && forecast > TOLERANCE,
      off,
      mismatch: Math.abs(off) > TOLERANCE,
    });
  }

  if (lines.length === 0) {
    return { ok: false, reason: "empty" };
  }

  lines.sort((a, b) => Math.abs(b.changes) - Math.abs(a.changes) || a.code.localeCompare(b.code, undefined, { numeric: true }));

  const sum = (pick: (line: Line) => number) => lines.reduce((total, line) => total + pick(line), 0);
  const original = sum((line) => line.original);
  const changes = sum((line) => line.changes);
  const increases = sum((line) => (line.changes > TOLERANCE ? line.changes : 0));
  const reductions = sum((line) => (line.changes < -TOLERANCE ? -line.changes : 0));
  const revised = sum((line) => line.revised);
  const forecast = sum((line) => line.forecast);
  const forecastGap = forecast - revised;
  const unexplained = revised - original - changes;
  const topIncreases = lines
    .filter((line) => line.changes > TOLERANCE)
    .map((line) => line.changes)
    .sort((a, b) => b - a)
    .slice(0, 3);
  const intelligence = data.intelligence;
  const approved = finite(intelligence?.projectApprovedBudget);
  const checks: SummaryCheck[] = [];

  if (intelligence) {
    const pairs: Array<[string, number | null, number]> = [
      ["Original plan", finite(intelligence.originalCostPlan), original],
      ["Approved changes", finite(intelligence.approvedChanges), changes],
      ["Revised plan", finite(intelligence.revisedCostPlan), revised],
    ];

    for (const [label, summary, total] of pairs) {
      if (summary !== null && Math.abs(summary - total) > TOLERANCE) {
        checks.push({ label, summary, lines: total });
      }
    }
  }

  const steps: Step[] = [];
  let level = original;

  steps.push({ key: "original", label: "Original plan", value: original, from: 0, to: original, kind: "total" });
  steps.push({ key: "increases", label: "Increases", value: increases, from: level, to: level + increases, kind: "up" });
  level += increases;
  steps.push({ key: "reductions", label: "Reductions", value: -reductions, from: level - reductions, to: level, kind: "down" });
  level -= reductions;

  if (Math.abs(unexplained) > TOLERANCE) {
    steps.push({ key: "unexplained", label: "Not explained by changes", value: unexplained, from: Math.min(level, level + unexplained), to: Math.max(level, level + unexplained), kind: unexplained > 0 ? "up" : "down" });
  }

  steps.push({ key: "revised", label: "Revised plan", value: revised, from: 0, to: revised, kind: "total" });

  if (Math.abs(forecastGap) > TOLERANCE) {
    steps.push({ key: "forecastGap", label: forecastGap > 0 ? "Forecast over the plan" : "Forecast under the plan", value: forecastGap, from: Math.min(revised, forecast), to: Math.max(revised, forecast), kind: forecastGap > 0 ? "up" : "down" });
  }

  steps.push({ key: "forecast", label: "Forecast cost", value: forecast, from: 0, to: forecast, kind: "total" });

  return {
    ok: true,
    data: {
      lines,
      original,
      changes,
      increases,
      reductions,
      revised,
      forecast,
      forecastGap,
      unexplained,
      changed: lines.filter((line) => Math.abs(line.changes) > TOLERANCE).length,
      added: lines.filter((line) => line.added).length,
      removed: lines.filter((line) => line.removed).length,
      over: lines.filter((line) => line.over).length,
      overAmount: sum((line) => (line.over ? line.forecastGap : 0)),
      top3Share: increases > 0 ? topIncreases.reduce((total, value) => total + value, 0) / increases : null,
      approved,
      overApproved: approved !== null && revised - approved > TOLERANCE ? revised - approved : 0,
      checks,
      mismatched: lines.filter((line) => line.mismatch).length,
      emptyLines,
      skipped,
      steps,
      scale: Math.max(1, ...steps.map((step) => Math.max(step.from, step.to))),
    },
  };
}

export function filterLines(lines: Line[], filter: Filter): Line[] {
  if (filter === "changed") {
    return lines.filter((line) => Math.abs(line.changes) > TOLERANCE);
  }

  if (filter === "grown") {
    return lines.filter((line) => line.added || (line.growth !== null && line.growth >= GROWN));
  }

  if (filter === "over") {
    return lines.filter((line) => line.over).sort((a, b) => b.forecastGap - a.forecastGap || a.code.localeCompare(b.code, undefined, { numeric: true }));
  }

  return lines;
}

export function cash(value: number): string {
  return Math.abs(value) < 0.5 ? "€0" : money(value);
}

export function exact(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(value));
}

export function signedExact(value: number): string {
  if (Math.abs(value) < 0.5) {
    return "€0";
  }

  return `${value > 0 ? "+" : "−"}${exact(Math.abs(value))}`;
}

export function signedCash(value: number): string {
  if (Math.abs(value) < 0.5) {
    return "€0";
  }

  return `${value > 0 ? "+" : "−"}${money(Math.abs(value))}`;
}

export function signedPct(value: number | null): string {
  if (value === null) {
    return "—";
  }

  const rounded = Math.round(value * 1000) / 10;

  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(1)}%`;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function movementMarkdown(data: Movement, shown: Line[], projectName: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Budget movement: ${projectName}`, "");
  lines.push(`The cost plan started at ${cash(data.original)} and stands at ${cash(data.revised)} after approved changes of ${signedCash(data.changes)}${data.original > 0 ? ` (${signedPct(data.changes / data.original)})` : ""}. The forecast is ${cash(data.forecast)}, ${signedCash(data.forecastGap)} against the revised plan.`, "");
  lines.push(`- ${data.changed} of ${data.lines.length} budget ${plural(data.lines.length, "line", "lines")} changed: ${cash(data.increases)} added and ${cash(data.reductions)} taken out`);

  if (data.top3Share !== null) {
    lines.push(`- The three largest increases make up ${pct(data.top3Share)} of the money added`);
  }

  lines.push(`- ${data.over} ${plural(data.over, "line is", "lines are")} forecast over the revised plan, by ${cash(data.overAmount)} in all`);

  if (data.overApproved > 0 && data.approved !== null) {
    lines.push(`- The revised plan is ${cash(data.overApproved)} above the approved project budget of ${cash(data.approved)}`);
  }

  lines.push("");

  if (shown.length > 0) {
    lines.push(`${filterLabel ? `Budget lines (${filterLabel.toLowerCase()}):` : "Budget lines:"}`, "", "| Cost code | Original | Changes | Revised | Forecast | Forecast against plan |", "| --- | ---: | ---: | ---: | ---: | ---: |");

    for (const line of shown.slice(0, 25)) {
      lines.push(`| ${cell(line.code)} ${cell(trunc(line.name, 36))} | ${exact(line.original)} | ${signedExact(line.changes)} | ${exact(line.revised)} | ${exact(line.forecast)} | ${signedExact(line.forecastGap)} |`);
    }

    lines.push("");
  }

  lines.push(
    `The original plan is each line's original budget and the changes are the approved changes recorded against it, so a line's growth is its changes divided by its original budget. A line with no original budget that now has one is a new line. The forecast against plan is the forecast cost less the revised budget. A line whose revised budget is not its original plus its changes is flagged, and the difference is shown separately in the bridge. Lines with nothing in any column are left out.${data.mismatched > 0 ? ` ${data.mismatched} ${plural(data.mismatched, "line does", "lines do")} not add up.` : ""}`,
    "",
  );

  return lines.join("\n");
}
