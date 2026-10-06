import { DAY_MS, formatDay, money, plural, toDay } from "@/lib/openItems";
import type { CommercialControl } from "@/types/project";

export type Mode = "running" | "monthly";

export const MODES: ReadonlyArray<{ key: Mode; label: string }> = [
  { key: "running", label: "Running total" },
  { key: "monthly", label: "Period by period" },
];

export const SHORTFALL_LIMIT = 4;

export interface Period {
  id: string;
  start: number;
  end: number;
  label: string;
  closed: boolean;
  elapsed: boolean;
  current: boolean;
  recorded: boolean;
  basis: "actual" | "forecast";
  planIn: number;
  planOut: number;
  planNet: number;
  inflow: number;
  outflow: number;
  net: number;
  cumPlan: number;
  cum: number;
  vsPlan: number;
  cumVsPlan: number;
}

export interface Run {
  from: number;
  to: number;
  lowest: number;
  lowestAt: number;
}

export interface Receivables {
  appliedCount: number;
  appliedAmount: number;
  appliedLate: number;
  unpaidCount: number;
  unpaidAmount: number;
  unpaidLateAmount: number;
  unpaidLateCount: number;
  retention: number;
}

export interface CashPosition {
  periods: Period[];
  lastActual: number | null;
  toDate: { plan: number; actual: number; gap: number } | null;
  end: { plan: number; latest: number; gap: number };
  low: { value: number; index: number } | null;
  runs: Run[];
  shortfalls: Array<{ index: number; gap: number }>;
  receivables: Receivables;
  unrecorded: number;
  skipped: number;
  todayIndex: number | null;
}

export type CashResult = { ok: true; cash: CashPosition } | { ok: false; reason: "empty" | "invalid" };

function amount(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function periodLabel(start: number, end: number): string {
  const date = new Date(end * DAY_MS);
  const month = MONTHS[date.getUTCMonth()] ?? "";
  const span = end - start;

  return span >= 25 && span <= 35 ? `${month} ${String(date.getUTCFullYear()).slice(2)}` : `${date.getUTCDate()} ${month}`;
}

export function cash(value: number): string {
  return money(Math.abs(value) < 0.5 ? 0 : value).replace("-", "\u2212");
}

export function signedMoney(value: number): string {
  if (Math.abs(value) < 0.5) {
    return cash(0);
  }

  return value > 0 ? `+${cash(value)}` : cash(value);
}

export function buildCashPosition(data: CommercialControl, today: number): CashResult {
  const raw = data.cashflowPeriods ?? [];

  if (raw.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const usable = raw
    .map((item) => ({ item, start: toDay(item.periodStart), end: toDay(item.periodEnd) }))
    .filter((entry) => Number.isFinite(entry.start) && Number.isFinite(entry.end))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const skipped = raw.length - usable.length;

  if (usable.length === 0) {
    return { ok: false, reason: "invalid" };
  }

  const periods: Period[] = [];
  let cumPlan = 0;
  let cum = 0;
  let unrecorded = 0;

  for (const { item, start, end } of usable) {
    const closed = item.status === "CLOSED";
    const elapsed = closed || end < today;
    const recorded = amount(item.actualInflow) !== 0 || amount(item.actualOutflow) !== 0;
    const basis: Period["basis"] = elapsed && recorded ? "actual" : "forecast";
    const inflow = basis === "actual" ? amount(item.actualInflow) : amount(item.forecastInflow);
    const outflow = basis === "actual" ? amount(item.actualOutflow) : amount(item.forecastOutflow);
    const planIn = amount(item.plannedInflow);
    const planOut = amount(item.plannedOutflow);
    const planNet = planIn - planOut;
    const net = inflow - outflow;

    if (elapsed && !recorded) {
      unrecorded += 1;
    }

    cumPlan += planNet;
    cum += net;

    periods.push({
      id: item.id,
      start,
      end,
      label: periodLabel(start, end),
      closed,
      elapsed,
      current: !elapsed && start <= today && today <= end,
      recorded,
      basis,
      planIn,
      planOut,
      planNet,
      inflow,
      outflow,
      net,
      cumPlan,
      cum,
      vsPlan: net - planNet,
      cumVsPlan: cum - cumPlan,
    });
  }

  let lastActual: number | null = null;

  periods.forEach((period, index) => {
    if (period.basis === "actual") {
      lastActual = index;
    }
  });

  const at = lastActual === null ? null : (periods[lastActual] as Period);
  const final = periods[periods.length - 1] as Period;
  const lowest = periods.reduce((best, period, index) => (period.cum < best.value ? { value: period.cum, index } : best), { value: Infinity, index: 0 });
  const runs: Run[] = [];
  let open: Run | null = null;

  periods.forEach((period, index) => {
    if (period.cum < 0) {
      if (open) {
        open.to = index;

        if (period.cum < open.lowest) {
          open.lowest = period.cum;
          open.lowestAt = index;
        }
      } else {
        open = { from: index, to: index, lowest: period.cum, lowestAt: index };
      }
    } else if (open) {
      runs.push(open);
      open = null;
    }
  });

  if (open) {
    runs.push(open);
  }

  const certificates = (data.paymentCertificates ?? []).filter((item) => item.status === "SUBMITTED" || item.status === "CERTIFIED" || item.status === "PARTIALLY_PAID" || item.status === "PAID");
  const applied = certificates.filter((item) => item.status === "SUBMITTED" && !item.certifiedDate);
  const unpaid = certificates.filter((item) => (item.status === "CERTIFIED" || item.status === "PARTIALLY_PAID") && amount(item.outstandingAmount) > 0);
  const unpaidLate = unpaid.filter((item) => Number.isFinite(toDay(item.paymentDueDate)) && toDay(item.paymentDueDate) < today);

  const todayIndex = periods.findIndex((period) => period.start <= today && today <= period.end);

  return {
    ok: true,
    cash: {
      periods,
      lastActual,
      toDate: at ? { plan: at.cumPlan, actual: at.cum, gap: at.cum - at.cumPlan } : null,
      end: { plan: final.cumPlan, latest: final.cum, gap: final.cum - final.cumPlan },
      low: lowest.value < 0 ? lowest : null,
      runs,
      shortfalls: periods
        .map((period, index) => ({ index, gap: period.vsPlan }))
        .filter((entry) => entry.gap < -0.5)
        .sort((a, b) => a.gap - b.gap)
        .slice(0, SHORTFALL_LIMIT),
      receivables: {
        appliedCount: applied.length,
        appliedAmount: applied.reduce((sum, item) => sum + amount(item.applicationAmount), 0),
        appliedLate: applied.filter((item) => Number.isFinite(toDay(item.certificationDueDate)) && toDay(item.certificationDueDate) < today).length,
        unpaidCount: unpaid.length,
        unpaidAmount: unpaid.reduce((sum, item) => sum + amount(item.outstandingAmount), 0),
        unpaidLateAmount: unpaidLate.reduce((sum, item) => sum + amount(item.outstandingAmount), 0),
        unpaidLateCount: unpaidLate.length,
        retention: certificates.reduce((sum, item) => sum + amount(item.retentionAmount), 0),
      },
      unrecorded,
      skipped,
      todayIndex: todayIndex < 0 ? null : todayIndex,
    },
  };
}

export function runText(cash_: CashPosition, run: Run): string {
  const first = cash_.periods[run.from] as Period;
  const last = cash_.periods[run.to] as Period;
  const worst = cash_.periods[run.lowestAt] as Period;
  const length = run.to - run.from + 1;
  const span = run.from === run.to ? first.label : `${first.label} to ${last.label}`;

  return `The running total is below zero for ${length} ${plural(length, "period", "periods")} (${span}), at its lowest ${cash(run.lowest)} at the end of ${worst.label}`;
}

export function cashMarkdown(flow: CashPosition, projectName: string, today: number): string {
  const lines: string[] = [];
  const last = flow.lastActual === null ? null : (flow.periods[flow.lastActual] as Period);

  lines.push(`# Cash position: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Net cash is inflow minus outflow, added up from the first period listed. Periods that have ended with actuals recorded use the actuals; all other periods use the forecast.`, "");

  if (flow.toDate && last) {
    lines.push(`- To date (end of ${last.label}): ${cash(flow.toDate.actual)} against ${cash(flow.toDate.plan)} planned, ${signedMoney(flow.toDate.gap)}`);
  } else {
    lines.push("- To date: no period has actual figures yet");
  }

  lines.push(`- End of the last period: ${cash(flow.end.latest)} against ${cash(flow.end.plan)} planned, ${signedMoney(flow.end.gap)}`);

  if (flow.low) {
    lines.push(`- Lowest point: ${cash(flow.low.value)} at the end of ${(flow.periods[flow.low.index] as Period).label}`);
  } else {
    lines.push("- Lowest point: cash never goes below zero on this view");
  }

  const r = flow.receivables;

  lines.push(
    `- Certified but unpaid: ${cash(r.unpaidAmount)} across ${r.unpaidCount} ${plural(r.unpaidCount, "certificate", "certificates")}, ${cash(r.unpaidLateAmount)} past its payment date`,
    `- Applied for, not yet certified: ${cash(r.appliedAmount)} across ${r.appliedCount} ${plural(r.appliedCount, "application", "applications")}`,
    `- Retention held: ${cash(r.retention)}`,
    "",
  );

  lines.push("| Period | Basis | Inflow | Outflow | Net | Planned net | Against plan | Running total |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const period of flow.periods) {
    lines.push(`| ${period.label} | ${period.basis === "actual" ? "Actual" : "Forecast"} | ${cash(period.inflow)} | ${cash(period.outflow)} | ${cash(period.net)} | ${cash(period.planNet)} | ${signedMoney(period.vsPlan)} | ${cash(period.cum)} |`);
  }

  lines.push("");

  for (const run of flow.runs) {
    lines.push(`- ${runText(flow, run)}`);
  }

  if (flow.runs.length > 0) {
    lines.push("");
  }

  if (flow.unrecorded > 0) {
    lines.push(`${flow.unrecorded} ${plural(flow.unrecorded, "period has", "periods have")} ended without actual figures, so the forecast is used for ${plural(flow.unrecorded, "it", "them")}.`, "");
  }

  lines.push("The running total starts at zero at the first period and ignores any opening balance, so it shows how much cash the project takes in or needs, not the bank balance.", "");

  return lines.join("\n");
}
