"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectCostControl } from "@/lib/api";
import type {
  CommitmentStatus,
  CostCodeCategory,
  CostControl,
  CostRiskLevel,
} from "@/types/project";

import styles from "./ProjectSpendBoardView.module.css";

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_WINDOW = 12;
const RATE_MONTHS = 3;
const VENDOR_LIMIT = 8;
const LIST_LIMIT = 10;
const NO_COMMITMENT_LIMIT = 8;
const MONEY_EPSILON = 1;

const RISK_LABEL: Record<CostRiskLevel, string> = {
  NO_BASELINE: "No baseline",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<CostRiskLevel, string | undefined> = {
  NO_BASELINE: styles.riskNone,
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const CATEGORY_LABEL: Record<CostCodeCategory, string> = {
  PRELIMINARIES: "Preliminaries",
  STRUCTURE: "Structure",
  ARCHITECTURAL: "Architectural",
  MEP: "MEP",
  EXTERNAL_WORKS: "External works",
  PROFESSIONAL_FEES: "Professional fees",
  CONTINGENCY: "Contingency",
  OTHER: "Other",
};

const STATUS_LABEL: Record<CommitmentStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const STATUS_ORDER: CommitmentStatus[] = ["APPROVED", "CLOSED", "DRAFT", "CANCELLED"];

const STATUS_COLOR: Record<CommitmentStatus, string> = {
  APPROVED: "#2f6f55",
  CLOSED: "#8fb9a4",
  DRAFT: "#dcb85e",
  CANCELLED: "#c3c9c5",
};

const SEGMENT_COLOR = {
  actual: "#2f6f55",
  outstanding: "#8fb9a4",
  free: "#dfe4df",
  over: "#b5493e",
} as const;

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function startOfToday(): number {
  const now = new Date();

  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

function toDay(value: string | null): number {
  if (!value) {
    return NaN;
  }

  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS);
}

function formatDay(day: number): string {
  if (!Number.isFinite(day)) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(day * DAY_MS));
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function num(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function moneyFull(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function trunc(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function axisStep(max: number): number {
  const rough = Math.max(max, 1) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const fraction = rough / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;

  return Math.max(1, nice * magnitude);
}

interface MonthBar {
  key: string;
  label: string;
  total: number;
  partial: boolean;
}

const M_WIDTH = 800;
const M_HEIGHT = 280;
const M_LEFT = 70;
const M_RIGHT = 16;
const M_TOP = 18;
const M_BOTTOM = 36;

function MonthChart({ average, bars }: { average: number; bars: MonthBar[] }) {
  const max = Math.max(0, average, ...bars.map((bar) => bar.total));

  if (bars.length === 0 || max <= 0) {
    return null;
  }

  const step = axisStep(max);
  const top = step * 4;
  const plotH = M_HEIGHT - M_TOP - M_BOTTOM;
  const pitch = (M_WIDTH - M_LEFT - M_RIGHT) / bars.length;
  const barW = Math.min(44, pitch * 0.64);
  const sy = (value: number) => M_TOP + (1 - value / top) * plotH;
  const ticks = [0, 1, 2, 3, 4].map((index) => index * step);

  return (
    <div className={styles.chartScroll}>
      <svg
        aria-label="Actual cost booked in each of the last twelve months, with the average of the last three full months"
        className={styles.chart}
        role="img"
        viewBox={`0 0 ${M_WIDTH} ${M_HEIGHT}`}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line stroke="#e8ebe7" x1={M_LEFT} x2={M_WIDTH - M_RIGHT} y1={sy(tick)} y2={sy(tick)} />
            <text fill="#66706b" fontSize={12.5} textAnchor="end" x={M_LEFT - 8} y={sy(tick) + 4}>
              {money(tick)}
            </text>
          </g>
        ))}

        {bars.map((bar, index) => {
          const x = M_LEFT + index * pitch + (pitch - barW) / 2;
          const y = sy(bar.total);

          return (
            <g key={bar.key}>
              <rect
                fill={bar.partial ? "#a9cdbb" : "#2f6f55"}
                height={Math.max(sy(0) - y, bar.total > 0 ? 2 : 0)}
                rx={3}
                width={barW}
                x={x}
                y={y}
              />

              <text fill="#55605b" fontSize={12} textAnchor="middle" x={x + barW / 2} y={M_HEIGHT - 14}>
                {bar.label}
              </text>

              <title>{`${bar.label}: ${moneyFull(bar.total)}${bar.partial ? " so far" : ""}`}</title>
            </g>
          );
        })}

        {average > 0 && (
          <g>
            <line
              stroke="#b5493e"
              strokeDasharray="6 4"
              strokeWidth={2}
              x1={M_LEFT}
              x2={M_WIDTH - M_RIGHT}
              y1={sy(average)}
              y2={sy(average)}
            />
            <text
              fill="#9a493f"
              fontSize={12.5}
              fontWeight={700}
              paintOrder="stroke"
              stroke="#ffffff"
              strokeLinejoin="round"
              strokeWidth={4}
              textAnchor="start"
              x={M_LEFT + 6}
              y={sy(average) - 7}
            >
              {`3-month average ${money(average)}`}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

export function ProjectSpendBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<CostControl | null>(null);
  const [error, setError] = useState("");
  const [showAllVendors, setShowAllVendors] = useState(false);
  const [showAllUnbilled, setShowAllUnbilled] = useState(false);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectCostControl(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load cost data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const intel = data?.intelligence;
    const costs = data?.actualCosts ?? [];
    const commitments = data?.commitments ?? [];
    const lines = data?.budgetLines ?? [];
    const codes = data?.costCodes ?? [];

    const now = new Date(today * DAY_MS);
    const currentKey = monthKey(now.getUTCFullYear(), now.getUTCMonth());

    const byMonth = new Map<string, number>();

    for (const cost of costs) {
      const key = cost.costDate.slice(0, 7);
      byMonth.set(key, (byMonth.get(key) ?? 0) + cost.amount);
    }

    const bars: MonthBar[] = [];

    for (let offset = MONTH_WINDOW - 1; offset >= 0; offset -= 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
      const key = monthKey(date.getUTCFullYear(), date.getUTCMonth());
      const month = MONTHS[date.getUTCMonth()] ?? "";

      bars.push({
        key,
        label: date.getUTCMonth() === 0 || offset === MONTH_WINDOW - 1 ? `${month} ${String(date.getUTCFullYear()).slice(2)}` : month,
        total: byMonth.get(key) ?? 0,
        partial: key === currentKey,
      });
    }

    const full = bars.filter((bar) => !bar.partial);
    const recent = full.slice(-RATE_MONTHS);
    const average = recent.length > 0 ? recent.reduce((sum, bar) => sum + bar.total, 0) / recent.length : 0;
    const windowTotal = bars.reduce((sum, bar) => sum + bar.total, 0);

    const plan = intel?.revisedCostPlan ?? 0;
    const actual = intel?.actualCosts ?? 0;
    const outstanding = intel?.outstandingCommitments ?? 0;
    const remaining = plan - actual;
    const monthsLeft = average > 0 && remaining > 0 ? remaining / average : NaN;

    const scale = Math.max(plan, actual + outstanding, 1);
    const funnel = {
      actual,
      outstanding,
      actualSeg: Math.min(actual, plan),
      outSeg: Math.min(outstanding, Math.max(0, plan - actual)),
      free: Math.max(0, plan - actual - outstanding),
      over: Math.max(0, actual + outstanding - plan),
      scale,
    };

    // categories
    const codeCategory = new Map(codes.map((code) => [code.id, code.category]));
    const categoryOf = (codeId: string): CostCodeCategory => codeCategory.get(codeId) ?? "OTHER";

    interface Aggregate {
      category: CostCodeCategory;
      budget: number;
      forecast: number;
      committed: number;
      actual: number;
    }

    const categories = new Map<CostCodeCategory, Aggregate>();
    const bucket = (category: CostCodeCategory): Aggregate => {
      let found = categories.get(category);

      if (!found) {
        found = { category, budget: 0, forecast: 0, committed: 0, actual: 0 };
        categories.set(category, found);
      }

      return found;
    };

    for (const line of lines) {
      const entry = bucket(categoryOf(line.costCodeId));
      entry.budget += line.revisedBudget;
      entry.forecast += line.forecastCost;
    }

    for (const commitment of commitments) {
      if (commitment.status === "APPROVED" || commitment.status === "CLOSED") {
        bucket(categoryOf(commitment.costCodeId)).committed += commitment.committedAmount;
      }
    }

    for (const cost of costs) {
      bucket(categoryOf(cost.costCodeId)).actual += cost.amount;
    }

    const categoryRows = [...categories.values()]
      .filter((row) => row.budget > 0 || row.actual > 0 || row.committed > 0)
      .sort((a, b) => b.budget - a.budget || b.actual - a.actual);

    const categoryMax = Math.max(
      1,
      ...categoryRows.flatMap((row) => [row.budget, row.forecast, row.committed, row.actual]),
    );

    // commitments and what has been billed against them
    const billed = new Map<string, number>();

    for (const cost of costs) {
      if (cost.commitmentId) {
        billed.set(cost.commitmentId, (billed.get(cost.commitmentId) ?? 0) + cost.amount);
      }
    }

    const live = commitments.filter((item) => item.status === "APPROVED" || item.status === "CLOSED");

    const commitmentRows = live.map((item) => {
      const invoiced = billed.get(item.id) ?? 0;

      return {
        item,
        invoiced,
        unbilled: Math.max(0, item.committedAmount - invoiced),
        over: Math.max(0, invoiced - item.committedAmount),
      };
    });

    const vendorMap = new Map<string, { vendor: string; committed: number; invoiced: number; count: number }>();

    for (const row of commitmentRows) {
      const key = row.item.vendorName.trim() || "Unnamed vendor";
      const found = vendorMap.get(key) ?? { vendor: key, committed: 0, invoiced: 0, count: 0 };

      found.committed += row.item.committedAmount;
      found.invoiced += row.invoiced;
      found.count += 1;
      vendorMap.set(key, found);
    }

    const vendors = [...vendorMap.values()].sort((a, b) => b.committed - a.committed);
    const committedTotal = vendors.reduce((sum, row) => sum + row.committed, 0);
    const topThree = vendors.slice(0, 3).reduce((sum, row) => sum + row.committed, 0);

    const statusRows = STATUS_ORDER.map((status) => {
      const items = commitments.filter((item) => item.status === status);

      return {
        status,
        count: items.length,
        amount: items.reduce((sum, item) => sum + item.committedAmount, 0),
      };
    });
    const statusTotal = statusRows.reduce((sum, row) => sum + row.amount, 0);

    const overBilled = commitmentRows
      .filter((row) => row.over > MONEY_EPSILON)
      .sort((a, b) => b.over - a.over);

    const unbilled = commitmentRows
      .filter((row) => row.unbilled > MONEY_EPSILON)
      .sort((a, b) => b.unbilled - a.unbilled);

    const unbilledTotal = unbilled.reduce((sum, row) => sum + row.unbilled, 0);

    const uncommitted = costs
      .filter((cost) => !cost.commitmentId)
      .sort((a, b) => b.amount - a.amount);
    const uncommittedTotal = uncommitted.reduce((sum, cost) => sum + cost.amount, 0);

    const lastCost = costs.reduce((latest, cost) => Math.max(latest, toDay(cost.costDate)), NaN);

    return {
      bars,
      average,
      windowTotal,
      plan,
      actual,
      remaining,
      monthsLeft,
      funnel,
      categoryRows,
      categoryMax,
      vendors,
      committedTotal,
      topThree,
      statusRows,
      statusTotal,
      draftAmount: statusRows.find((row) => row.status === "DRAFT")?.amount ?? 0,
      overBilled,
      unbilled,
      unbilledTotal,
      uncommitted,
      uncommittedTotal,
      hasCosts: costs.length > 0,
      lastCost,
    };
  }, [data, today]);

  const intel = data?.intelligence;
  const visibleVendors = showAllVendors ? model.vendors : model.vendors.slice(0, VENDOR_LIMIT);
  const visibleUnbilled = showAllUnbilled ? model.unbilled : model.unbilled.slice(0, LIST_LIMIT);
  const funnelTotal = model.funnel.scale;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">SPEND BOARD</div>

            <h1>{data ? data.project.name : "Spend board"}</h1>

            <p className={styles.subtitle}>
              How fast money is going out, who it is committed to, and where spend or commitments
              are running ahead of the budget. Record costs and commitments in cost control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/costs`}>
            Open cost control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading cost data…</div>}

        {data && intel && (
          <>
            <section aria-label="Spend summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>COST SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.costScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.costRisk])}>{RISK_LABEL[intel.costRisk]}</span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SPENT SO FAR</div>
                <div className={styles.kpiValue}>{money(intel.actualCosts)}</div>
                <div className={styles.kpiSub}>
                  {num(intel.budgetUtilizationPercentage, 1)}% of the {money(intel.revisedCostPlan)} plan
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COMMITTED</div>
                <div className={styles.kpiValue}>{money(intel.totalApprovedCommitments)}</div>
                <div className={styles.kpiSub}>{num(intel.committedExposurePercentage, 1)}% of the plan</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NOT YET BILLED</div>
                <div className={styles.kpiValue}>{money(intel.outstandingCommitments)}</div>
                <div className={styles.kpiSub}>committed but not invoiced</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST AT COMPLETION</div>
                <div className={styles.kpiValue}>{money(intel.forecastAtCompletion)}</div>
                <div className={cx(styles.kpiSub, intel.overrunAmount > 0 && styles.neg)}>
                  {intel.overrunAmount > 0
                    ? `${money(intel.overrunAmount)} over the plan (${num(intel.forecastVariancePercentage, 1)}%)`
                    : "within the plan"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MONTHLY RATE</div>
                <div className={styles.kpiValue}>{model.average > 0 ? money(model.average) : "—"}</div>
                <div className={styles.kpiSub}>average of the last {RATE_MONTHS} full months</div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">MONTHLY SPEND</div>
                  <h2>Actual cost booked each month</h2>
                </div>

                <span className={styles.muted}>last {MONTH_WINDOW} months · {money(model.windowTotal)}</span>
              </header>

              {!model.hasCosts || model.windowTotal <= 0 ? (
                <div className={styles.emptySmall}>
                  {model.hasCosts
                    ? `No cost was booked in the last ${MONTH_WINDOW} months.`
                    : "No actual costs have been recorded yet."}
                </div>
              ) : (
                <>
                  <MonthChart average={model.average} bars={model.bars} />
                  <p className={styles.swipe}>Swipe sideways to see all twelve months.</p>

                  <p className={styles.callout}>
                    {model.remaining <= 0
                      ? `Actual cost has already reached the revised plan of ${money(model.plan)}.`
                      : model.average <= 0
                        ? `Nothing was booked in the last ${RATE_MONTHS} full months, so no spending rate can be projected. ${money(model.remaining)} of the plan is still unspent.`
                        : `At ${money(model.average)} a month, the remaining ${money(model.remaining)} of the plan lasts about ${num(model.monthsLeft, 1)} months.`}
                    {intel.forecastAtCompletion > intel.actualCosts && model.average > 0 && (
                      <>
                        {" "}
                        The forecast still needs {money(intel.forecastAtCompletion - intel.actualCosts)}
                        {`, about ${num((intel.forecastAtCompletion - intel.actualCosts) / model.average, 1)} months at that rate.`}
                      </>
                    )}
                  </p>

                  <ul aria-label="Monthly chart legend" className={styles.legend}>
                    <li>
                      <i className={styles.swatch} style={{ background: "#2f6f55" }} />
                      Full month
                    </li>
                    <li>
                      <i className={styles.swatch} style={{ background: "#a9cdbb" }} />
                      Current month so far
                    </li>
                    <li>
                      <i className={cx(styles.refSwatch)} />
                      Average of the last {RATE_MONTHS} full months
                    </li>
                  </ul>
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PLAN</div>
                  <h2>Where the revised plan stands</h2>
                </div>

                <span className={styles.muted}>revised plan {money(model.plan)}</span>
              </header>

              {model.plan <= 0 && model.actual <= 0 ? (
                <div className={styles.emptySmall}>No budget lines or costs have been recorded yet.</div>
              ) : (
                <>
                  <div
                    aria-label={`Of the revised plan, ${money(model.funnel.actual)} is spent, ${money(model.funnel.outstanding)} is committed but not billed, and ${money(model.funnel.free)} is neither`}
                    className={styles.funnel}
                    role="img"
                  >
                    {model.funnel.actualSeg > 0 && (
                      <i
                        style={{ background: SEGMENT_COLOR.actual, width: `${percent(model.funnel.actualSeg, funnelTotal)}%` }}
                        title={`Spent ${money(model.funnel.actual)}`}
                      />
                    )}
                    {model.funnel.outSeg > 0 && (
                      <i
                        style={{ background: SEGMENT_COLOR.outstanding, width: `${percent(model.funnel.outSeg, funnelTotal)}%` }}
                        title={`Committed, not billed ${money(model.funnel.outstanding)}`}
                      />
                    )}
                    {model.funnel.free > 0 && (
                      <i
                        style={{ background: SEGMENT_COLOR.free, width: `${percent(model.funnel.free, funnelTotal)}%` }}
                        title={`Free ${money(model.funnel.free)}`}
                      />
                    )}
                    {model.funnel.over > 0 && (
                      <i
                        style={{ background: SEGMENT_COLOR.over, width: `${percent(model.funnel.over, funnelTotal)}%` }}
                        title={`Over the plan ${money(model.funnel.over)}`}
                      />
                    )}
                  </div>

                  <ul aria-label="Plan legend" className={cx(styles.legend, styles.legendBig)}>
                    <li>
                      <i className={styles.swatch} style={{ background: SEGMENT_COLOR.actual }} />
                      <span>
                        Spent <strong>{money(model.funnel.actual)}</strong>{" "}
                        <em>{num(percent(model.funnel.actual, model.plan), 1)}%</em>
                      </span>
                    </li>
                    <li>
                      <i className={styles.swatch} style={{ background: SEGMENT_COLOR.outstanding }} />
                      <span>
                        Committed, not billed <strong>{money(model.funnel.outstanding)}</strong>{" "}
                        <em>{num(percent(model.funnel.outstanding, model.plan), 1)}%</em>
                      </span>
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchOutline)} style={{ background: SEGMENT_COLOR.free }} />
                      <span>
                        Not yet committed <strong>{money(model.funnel.free)}</strong>{" "}
                        <em>{num(percent(model.funnel.free, model.plan), 1)}%</em>
                      </span>
                    </li>
                    {model.funnel.over > 0 && (
                      <li>
                        <i className={styles.swatch} style={{ background: SEGMENT_COLOR.over }} />
                        <span>
                          Over the plan <strong className={styles.neg}>{money(model.funnel.over)}</strong>
                        </span>
                      </li>
                    )}
                  </ul>

                  <p className={styles.hint}>
                    Unallocated budget (approved project budget not yet placed on a cost code):{" "}
                    {money(intel.unallocatedBudget)}.
                  </p>
                </>
              )}
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY CATEGORY</div>
                    <h2>Budget, commitments and spend</h2>
                  </div>

                  <span className={styles.muted}>{model.categoryRows.length} categories</span>
                </header>

                {model.categoryRows.length === 0 ? (
                  <div className={styles.emptySmall}>No budget lines yet.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.categoryRows.map((row) => {
                      const over = row.forecast - row.budget;

                      return (
                        <li key={row.category}>
                          <div className={styles.ageingTop}>
                            <span>{CATEGORY_LABEL[row.category]}</span>
                            <strong>
                              {money(row.actual)}
                              <small>
                                of {money(row.budget)} · {num(percent(row.actual, row.budget))}%
                              </small>
                            </strong>
                          </div>

                          <div
                            aria-label={`${CATEGORY_LABEL[row.category]}: budget ${money(row.budget)}, committed ${money(row.committed)}, spent ${money(row.actual)}, forecast ${money(row.forecast)}`}
                            className={styles.catTrack}
                            role="img"
                          >
                            <i
                              className={styles.catBudget}
                              style={{ width: `${percent(row.budget, model.categoryMax)}%` }}
                            />
                            {over > MONEY_EPSILON && (
                              <i
                                className={styles.catOver}
                                style={{
                                  left: `${percent(row.budget, model.categoryMax)}%`,
                                  width: `${percent(over, model.categoryMax)}%`,
                                }}
                              />
                            )}
                            <i
                              className={styles.catActual}
                              style={{ width: `${percent(row.actual, model.categoryMax)}%` }}
                            />
                            {row.committed > 0 && (
                              <i
                                className={styles.catTick}
                                style={{ left: `${Math.min(99.4, percent(row.committed, model.categoryMax))}%` }}
                              />
                            )}
                          </div>

                          {over > MONEY_EPSILON && (
                            <div className={cx(styles.rowNote, styles.neg)}>
                              Forecast {money(row.forecast)} is {money(over)} over budget
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}

                {model.categoryRows.length > 0 && (
                  <ul aria-label="Category legend" className={styles.legend}>
                    <li>
                      <i className={styles.swatch} style={{ background: "#b9d6c8" }} />
                      Budget
                    </li>
                    <li>
                      <i className={styles.swatch} style={{ background: "#2f6f55" }} />
                      Spent
                    </li>
                    <li>
                      <i className={styles.tickSwatch} />
                      Committed
                    </li>
                    <li>
                      <i className={styles.swatch} style={{ background: "#e9a198" }} />
                      Forecast above budget
                    </li>
                  </ul>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">VENDORS</div>
                    <h2>Who the money is committed to</h2>
                  </div>

                  <div className={styles.controls}>
                    <span className={styles.muted}>
                      {model.vendors.length} {plural(model.vendors.length, "vendor", "vendors")}
                    </span>

                    {model.vendors.length > VENDOR_LIMIT && (
                      <button
                        className={styles.linkButton}
                        onClick={() => setShowAllVendors((value) => !value)}
                        type="button"
                      >
                        {showAllVendors ? `Show first ${VENDOR_LIMIT}` : `Show all ${model.vendors.length}`}
                      </button>
                    )}
                  </div>
                </header>

                {model.vendors.length === 0 ? (
                  <div className={styles.emptySmall}>No approved commitments yet.</div>
                ) : (
                  <>
                    <p className={styles.callout}>
                      The top three vendors hold {num(percent(model.topThree, model.committedTotal))}% of
                      the {money(model.committedTotal)} committed.
                    </p>

                    <ul className={styles.ageing}>
                      {visibleVendors.map((row) => (
                        <li key={row.vendor}>
                          <div className={styles.ageingTop}>
                            <span title={row.vendor}>{trunc(row.vendor, 30)}</span>
                            <strong>
                              {money(row.committed)}
                              <small>
                                {num(percent(row.invoiced, row.committed))}% billed · {row.count}{" "}
                                {plural(row.count, "order", "orders")}
                              </small>
                            </strong>
                          </div>

                          <div
                            aria-label={`${row.vendor}: ${money(row.committed)} committed, ${money(row.invoiced)} billed`}
                            className={styles.track}
                            role="img"
                          >
                            <div
                              className={styles.pairOuter}
                              style={{ width: `${percent(row.committed, model.vendors[0]?.committed ?? 1)}%` }}
                            >
                              <div
                                className={cx(styles.pairInner, row.invoiced > row.committed && styles.pairOver)}
                                style={{ width: `${Math.min(100, percent(row.invoiced, row.committed))}%` }}
                              />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <ul aria-label="Vendor legend" className={styles.legend}>
                      <li>
                        <i className={styles.swatch} style={{ background: "#b9d6c8" }} />
                        Committed
                      </li>
                      <li>
                        <i className={styles.swatch} style={{ background: "#2f6f55" }} />
                        Billed against it
                      </li>
                    </ul>
                  </>
                )}
              </section>
            </div>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">COMMITMENT STATUS</div>
                    <h2>How much is approved</h2>
                  </div>

                  <span className={styles.muted}>{money(model.statusTotal)} in total</span>
                </header>

                {model.statusTotal <= 0 ? (
                  <div className={styles.emptySmall}>No commitments recorded yet.</div>
                ) : (
                  <>
                    <div aria-label="Commitments by status, by value" className={styles.funnel} role="img">
                      {model.statusRows
                        .filter((row) => row.amount > 0)
                        .map((row) => (
                          <i
                            key={row.status}
                            style={{
                              background: STATUS_COLOR[row.status],
                              width: `${percent(row.amount, model.statusTotal)}%`,
                            }}
                            title={`${STATUS_LABEL[row.status]} ${money(row.amount)}`}
                          />
                        ))}
                    </div>

                    <ul className={styles.statusList}>
                      {model.statusRows.map((row) => (
                        <li key={row.status}>
                          <i className={styles.swatch} style={{ background: STATUS_COLOR[row.status] }} />
                          <span>{STATUS_LABEL[row.status]}</span>
                          <em>
                            {row.count} {plural(row.count, "commitment", "commitments")}
                          </em>
                          <strong>{money(row.amount)}</strong>
                        </li>
                      ))}
                    </ul>

                    {model.draftAmount > 0 && (
                      <p className={styles.warn}>
                        {money(model.draftAmount)} is still in draft. It is not counted as committed
                        until it is approved.
                      </p>
                    )}
                  </>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">CONTROL</div>
                    <h2>Billed above the commitment</h2>
                  </div>

                  <span className={styles.muted}>{model.overBilled.length} found</span>
                </header>

                {model.overBilled.length === 0 ? (
                  <div className={styles.emptySmall}>No commitment has been billed above its value.</div>
                ) : (
                  <div className={styles.tableWrap}>
                      <table className={cx(styles.table, styles.compact)}>
                        <thead>
                          <tr>
                            <th>COMMITMENT</th>
                            <th className={styles.num}>VALUE</th>
                            <th className={styles.num}>BILLED</th>
                            <th className={styles.num}>OVER BY</th>
                          </tr>
                        </thead>

                        <tbody>
                          {model.overBilled.slice(0, LIST_LIMIT).map((row) => (
                            <tr key={row.item.id}>
                              <td>
                                <strong>{row.item.reference}</strong>
                                <span className={styles.cellSub}>{row.item.vendorName}</span>
                              </td>
                              <td className={styles.num}>{moneyFull(row.item.committedAmount)}</td>
                              <td className={styles.num}>{moneyFull(row.invoiced)}</td>
                              <td className={cx(styles.num, styles.neg)}>{moneyFull(row.over)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">CONTROL</div>
                    <h2>Spend with no commitment behind it</h2>
                  </div>

                <span className={styles.muted}>
                  {model.uncommitted.length} {plural(model.uncommitted.length, "cost", "costs")} ·{" "}
                  {money(model.uncommittedTotal)} · {num(percent(model.uncommittedTotal, model.actual))}% of spend
                </span>
              </header>

              {model.uncommitted.length === 0 ? (
                <div className={styles.emptySmall}>
                  {model.hasCosts
                    ? "Every recorded cost is linked to a commitment."
                    : "No costs have been recorded yet."}
                </div>
              ) : (
                <>
                  {model.uncommitted.length > NO_COMMITMENT_LIMIT && (
                    <p className={styles.lead}>
                      Showing the {NO_COMMITMENT_LIMIT} largest of {model.uncommitted.length}.
                    </p>
                  )}

                  <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>COST</th>
                        <th>SUPPLIER</th>
                        <th>COST CODE</th>
                        <th>DATE</th>
                        <th className={styles.num}>AMOUNT</th>
                      </tr>
                    </thead>

                    <tbody>
                      {model.uncommitted.slice(0, NO_COMMITMENT_LIMIT).map((cost) => (
                        <tr key={cost.id}>
                          <td>
                            <strong>{cost.reference}</strong>
                          </td>
                          <td>{cost.supplierName}</td>
                          <td className={styles.wrap}>
                            {cost.costCode} {cost.costCodeName}
                          </td>
                          <td>{formatDay(toDay(cost.costDate))}</td>
                          <td className={styles.num}>{moneyFull(cost.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">STILL TO BILL</div>
                  <h2>Largest unbilled commitments</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>
                    {model.unbilled.length} open · {money(model.unbilledTotal)}
                  </span>

                  {model.unbilled.length > LIST_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllUnbilled((value) => !value)}
                      type="button"
                    >
                      {showAllUnbilled ? `Show first ${LIST_LIMIT}` : `Show all ${model.unbilled.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.unbilled.length === 0 ? (
                <div className={styles.emptySmall}>
                  {model.vendors.length === 0
                    ? "No approved commitments yet."
                    : "Every approved commitment has been billed in full."}
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>COMMITMENT</th>
                        <th>VENDOR</th>
                        <th>COST CODE</th>
                        <th>DATE</th>
                        <th className={styles.num}>VALUE</th>
                        <th className={styles.num}>BILLED</th>
                        <th className={styles.num}>UNBILLED</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleUnbilled.map((row) => (
                        <tr key={row.item.id}>
                          <td>
                            <strong>{row.item.reference}</strong>
                            <span className={styles.cellSub}>{STATUS_LABEL[row.item.status]}</span>
                          </td>
                          <td>{row.item.vendorName}</td>
                          <td className={styles.wrap}>
                            {row.item.costCode} {row.item.costCodeName}
                          </td>
                          <td>{formatDay(toDay(row.item.commitmentDate))}</td>
                          <td className={styles.num}>{moneyFull(row.item.committedAmount)}</td>
                          <td className={styles.num}>
                            {num(percent(row.invoiced, row.item.committedAmount))}%
                          </td>
                          <td className={styles.num}>
                            <strong>{moneyFull(row.unbilled)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className={styles.note}>{intel.explanation}</p>
          </>
        )}
      </main>
    </div>
  );
}
