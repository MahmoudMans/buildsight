"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { type ChartSeries, LineChart } from "@/components/LineChart";
import { getProjectPeriodControl } from "@/lib/api";
import type {
  ControlBaselineStatus,
  PeriodControl,
  PeriodControlRiskLevel,
  PeriodEndSnapshot,
} from "@/types/project";

import styles from "./ProjectPeriodBoardView.module.css";

const DAY_MS = 86_400_000;
const LIST_LIMIT = 10;
const TREND_LIMIT = 12;
const STALE_FORECAST_DAYS = 7;

const RISK_LABEL: Record<PeriodControlRiskLevel, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<PeriodControlRiskLevel, string | undefined> = {
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const BASELINE_LABEL: Record<ControlBaselineStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  SUPERSEDED: "Superseded",
};

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

function formatStamp(value: string | null): string {
  return formatDay(toDay(value));
}

function num(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function signed(value: number, digits = 0): string {
  if (Math.round(value * 10 ** digits) === 0) {
    return num(0, digits);
  }

  const text = num(Math.abs(value), digits);

  return value > 0 ? `+${text}` : `−${text}`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function signedMoney(value: number): string {
  if (Math.abs(value) < 1) {
    return money(0);
  }

  const text = money(Math.abs(value));

  return value > 0 ? `+${text}` : `−${text}`;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function ratioClass(value: number): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return value < 0.9 ? styles.neg : value < 1 ? styles.warnText : styles.pos;
}

interface Metric {
  key: string;
  label: string;
  better: "lower" | "higher" | "none";
  read: (snapshot: PeriodEndSnapshot) => number;
  format: (value: number) => string;
  formatChange: (value: number) => string;
}

const METRICS: ReadonlyArray<Metric> = [
  {
    key: "cost",
    label: "Expected forecast cost",
    better: "lower",
    read: (s) => s.expectedForecastCost,
    format: money,
    formatChange: signedMoney,
  },
  {
    key: "finish",
    label: "Expected forecast finish",
    better: "lower",
    read: (s) => toDay(s.expectedForecastFinishDate),
    format: formatDay,
    formatChange: (value) => `${signed(value)} d`,
  },
  {
    key: "planned",
    label: "Planned progress",
    better: "none",
    read: (s) => s.plannedProgressPercentage,
    format: (value) => `${num(value, 1)}%`,
    formatChange: (value) => `${signed(value, 1)} pts`,
  },
  {
    key: "earned",
    label: "Earned progress",
    better: "higher",
    read: (s) => s.earnedProgressPercentage,
    format: (value) => `${num(value, 1)}%`,
    formatChange: (value) => `${signed(value, 1)} pts`,
  },
  {
    key: "cpi",
    label: "Cost index (CPI)",
    better: "higher",
    read: (s) => s.costPerformanceIndex,
    format: (value) => num(value, 2),
    formatChange: (value) => signed(value, 2),
  },
  {
    key: "spi",
    label: "Schedule index (SPI)",
    better: "higher",
    read: (s) => s.schedulePerformanceIndex,
    format: (value) => num(value, 2),
    formatChange: (value) => signed(value, 2),
  },
  {
    key: "costVar",
    label: "Cost against baseline",
    better: "lower",
    read: (s) => s.costVarianceToBaseline,
    format: signedMoney,
    formatChange: signedMoney,
  },
  {
    key: "finishVar",
    label: "Finish against baseline",
    better: "lower",
    read: (s) => s.finishVarianceDays,
    format: (value) => `${signed(value)} d`,
    formatChange: (value) => `${signed(value)} d`,
  },
  {
    key: "predictive",
    label: "Predictive score",
    better: "higher",
    read: (s) => s.predictiveScore,
    format: (value) => num(value),
    formatChange: (value) => signed(value),
  },
  {
    key: "governance",
    label: "Governance score",
    better: "higher",
    read: (s) => s.governanceScore,
    format: (value) => num(value),
    formatChange: (value) => signed(value),
  },
  {
    key: "recovery",
    label: "Recovery score",
    better: "higher",
    read: (s) => s.recoveryScore,
    format: (value) => num(value),
    formatChange: (value) => signed(value),
  },
  {
    key: "period",
    label: "Period control score",
    better: "higher",
    read: (s) => s.periodControlScore,
    format: (value) => num(value),
    formatChange: (value) => signed(value),
  },
  {
    key: "open",
    label: "Open actions",
    better: "lower",
    read: (s) => s.openActions,
    format: (value) => num(value),
    formatChange: (value) => signed(value),
  },
  {
    key: "overdue",
    label: "Overdue actions",
    better: "lower",
    read: (s) => s.overdueActions,
    format: (value) => num(value),
    formatChange: (value) => signed(value),
  },
  {
    key: "blocked",
    label: "Blocked actions",
    better: "lower",
    read: (s) => s.blockedActions,
    format: (value) => num(value),
    formatChange: (value) => signed(value),
  },
  {
    key: "exposure",
    label: "Change cost exposure",
    better: "lower",
    read: (s) => s.changeCostExposure,
    format: money,
    formatChange: signedMoney,
  },
  {
    key: "residual",
    label: "Delay left after recovery",
    better: "lower",
    read: (s) => s.recoveryResidualDelayDays,
    format: (value) => `${num(value)} d`,
    formatChange: (value) => `${signed(value)} d`,
  },
];

interface VarianceRow {
  label: string;
  value: number;
}

const V_WIDTH = 440;
const V_HEIGHT = 250;
const V_TOP = 28;
const V_BOTTOM = 40;

function VarianceChart({
  ariaLabel,
  format,
  rows,
}: {
  ariaLabel: string;
  format: (value: number) => string;
  rows: VarianceRow[];
}) {
  const values = rows.map((row) => row.value).filter(Number.isFinite);

  if (rows.length === 0 || values.length === 0) {
    return null;
  }

  const max = Math.max(1e-9, ...values.map((value) => Math.abs(value)));
  const plotH = V_HEIGHT - V_TOP - V_BOTTOM;
  const mid = V_TOP + plotH / 2;
  const half = plotH / 2 - 16;
  const pitch = (V_WIDTH - 16) / rows.length;
  const barW = Math.min(34, pitch * 0.62);
  const stride = rows.length > 8 ? 2 : 1;
  const strongest = values.reduce((best, value) => (Math.abs(value) > Math.abs(best) ? value : best), 0);

  return (
    <div className={styles.chartScroll}>
      <svg aria-label={ariaLabel} className={styles.chartSmall} role="img" viewBox={`0 0 ${V_WIDTH} ${V_HEIGHT}`}>
        <line stroke="#9aa49f" x1={8} x2={V_WIDTH - 8} y1={mid} y2={mid} />

        {rows.map((row, index) => {
          const x = 8 + index * pitch + (pitch - barW) / 2;
          const height = Number.isFinite(row.value) ? (Math.abs(row.value) / max) * half : 0;
          const up = row.value >= 0;
          const y = up ? mid - height : mid;
          const showValue =
            rows.length <= 7 || index === rows.length - 1 || (row.value === strongest && Math.abs(row.value) > 0);

          return (
            <g key={`${row.label}-${index}`}>
              <rect
                fill={row.value > 0 ? "#c9645a" : row.value < 0 ? "#3f8a68" : "#9aa49f"}
                height={Math.max(height, 2)}
                rx={3}
                width={barW}
                x={x}
                y={up ? y : mid}
              />

              {showValue && Number.isFinite(row.value) && (
                <text
                  fill="#19201e"
                  fontSize={12}
                  fontWeight={700}
                  textAnchor="middle"
                  x={x + barW / 2}
                  y={up ? y - 6 : mid + height + 15}
                >
                  {format(row.value)}
                </text>
              )}

              {index % stride === 0 && (
                <text fill="#55605b" fontSize={11.5} textAnchor="middle" x={x + barW / 2} y={V_HEIGHT - 14}>
                  {row.label}
                </text>
              )}

              <title>{`${row.label}: ${format(row.value)}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ProjectPeriodBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<PeriodControl | null>(null);
  const [error, setError] = useState("");
  const [showAllPeriods, setShowAllPeriods] = useState(false);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectPeriodControl(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load period data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const intel = data?.intelligence;
    const ordered = [...(data?.snapshots ?? [])].sort(
      (a, b) => toDay(a.periodEndDate) - toDay(b.periodEndDate) || a.periodCode.localeCompare(b.periodCode),
    );
    const trend = ordered.slice(-TREND_LIMIT);
    const latest = ordered[ordered.length - 1];
    const previous = ordered[ordered.length - 2];

    const baselineCost = intel?.baselineCostTarget ?? NaN;
    const baselineFinish = toDay(intel?.baselineFinishTarget ?? null);
    const costGap = intel && Number.isFinite(baselineCost) ? intel.currentExpectedForecastCost - baselineCost : NaN;
    const finishGap = intel ? toDay(intel.currentExpectedForecastFinishDate) - baselineFinish : NaN;

    const index = (field: "costPerformanceIndex" | "schedulePerformanceIndex", name: string, color: string, dashed: boolean): ChartSeries => ({
      name,
      color,
      dashed,
      points: trend
        .map((item) => ({ x: toDay(item.periodEndDate), y: item[field] }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
    });

    const scoreSeries = (
      field: "predictiveScore" | "governanceScore" | "recoveryScore" | "periodControlScore",
      name: string,
      color: string,
      dashed: boolean,
    ): ChartSeries => ({
      name,
      color,
      dashed,
      points: trend
        .map((item) => ({ x: toDay(item.periodEndDate), y: item[field] }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
    });

    const baselines = [...(data?.baselines ?? [])].sort(
      (a, b) => toDay(a.sourceDataDate) - toDay(b.sourceDataDate) || a.versionCode.localeCompare(b.versionCode),
    );

    const baselineRows = baselines.map((item, position) => {
      const before = baselines[position - 1];

      return {
        item,
        costShift: before ? item.costTarget - before.costTarget : NaN,
        finishShift: before ? toDay(item.finishTarget) - toDay(before.finishTarget) : NaN,
      };
    });

    const periods = [...(data?.periods ?? [])].sort((a, b) => toDay(b.endDate) - toDay(a.endDate));

    return {
      ordered,
      trend,
      latest,
      previous,
      baselineCost,
      baselineFinish,
      costGap,
      finishGap,
      indexSeries: [
        index("costPerformanceIndex", "CPI (cost)", "#2f6f55", false),
        index("schedulePerformanceIndex", "SPI (schedule)", "#d9823a", true),
      ],
      scoreSeries: [
        scoreSeries("predictiveScore", "Predictive", "#2f6f55", false),
        scoreSeries("governanceScore", "Governance", "#3a6ea5", false),
        scoreSeries("recoveryScore", "Recovery", "#d9823a", true),
        scoreSeries("periodControlScore", "Period control", "#19201e", true),
      ],
      costRows: trend.map((item) => ({ label: item.periodCode, value: item.costVarianceToBaseline })),
      finishRows: trend.map((item) => ({ label: item.periodCode, value: item.finishVarianceDays })),
      baselineRows,
      periods,
    };
  }, [data]);

  const intel = data?.intelligence;
  const ready = data?.openPeriodReadiness ?? null;
  const readyEnd = ready ? toDay(ready.periodEndDate) : NaN;
  const daysToEnd = Number.isFinite(readyEnd) ? readyEnd - today : NaN;
  const forecastAge = ready ? today - toDay(ready.forecastDataDate) : NaN;
  const visiblePeriods = showAllPeriods ? model.periods : model.periods.slice(0, LIST_LIMIT);

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">PERIOD BOARD</div>

            <h1>{data ? data.project.name : "Period board"}</h1>

            <p className={styles.subtitle}>
              Whether the open period can be closed, how each closed period compares with the one
              before, and how far the project has drifted from its baseline.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/period-control`}>
            Open period control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading period data…</div>}

        {data && intel && (
          <>
            <section aria-label="Period summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>PERIOD CONTROL SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.periodControlScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.periodControlRisk])}>
                    {RISK_LABEL[intel.periodControlRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COST AGAINST BASELINE</div>
                <div className={cx(styles.kpiValue, model.costGap > 0 && styles.neg, model.costGap < 0 && styles.pos)}>
                  {Number.isFinite(model.costGap) ? signedMoney(model.costGap) : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {Number.isFinite(model.baselineCost)
                    ? `forecast ${money(intel.currentExpectedForecastCost)} vs ${money(model.baselineCost)}`
                    : "no active baseline"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FINISH AGAINST BASELINE</div>
                <div
                  className={cx(
                    styles.kpiValue,
                    model.finishGap > 0 && styles.neg,
                    model.finishGap < 0 && styles.pos,
                  )}
                >
                  {Number.isFinite(model.finishGap) ? `${signed(model.finishGap)} d` : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {Number.isFinite(model.baselineFinish)
                    ? `target ${formatDay(model.baselineFinish)}`
                    : "no active baseline"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COST INDEX (CPI)</div>
                <div className={cx(styles.kpiValue, ratioClass(intel.costPerformanceIndex))}>
                  {num(intel.costPerformanceIndex, 2)}
                </div>
                <div className={styles.kpiSub}>earned {num(intel.earnedProgressPercentage, 1)}% of the work</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SCHEDULE INDEX (SPI)</div>
                <div className={cx(styles.kpiValue, ratioClass(intel.schedulePerformanceIndex))}>
                  {num(intel.schedulePerformanceIndex, 2)}
                </div>
                <div className={styles.kpiSub}>planned {num(intel.plannedProgressPercentage, 1)}%</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PERIODS</div>
                <div className={styles.kpiValue}>{intel.closedPeriodCount}</div>
                <div className={styles.kpiSub}>
                  closed ·{" "}
                  {intel.openPeriodCode
                    ? `${intel.openPeriodCode} open until ${formatStamp(intel.openPeriodEndDate)}`
                    : "none open"}
                </div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">OPEN PERIOD</div>
                  <h2>
                    {ready
                      ? `${ready.periodCode} ${
                          Number.isFinite(daysToEnd)
                            ? daysToEnd > 0
                              ? `ends in ${daysToEnd} ${plural(daysToEnd, "day", "days")}`
                              : daysToEnd === 0
                                ? "ends today"
                                : `ended ${-daysToEnd} ${plural(-daysToEnd, "day", "days")} ago`
                            : ""
                      }`
                      : "No open period"}
                  </h2>
                </div>

                {ready && (
                  <span className={cx(styles.verdict, ready.canClose ? styles.verdictOk : styles.verdictNo)}>
                    {ready.canClose ? "Ready to close" : "Cannot close yet"}
                  </span>
                )}
              </header>

              {!ready ? (
                <div className={styles.emptySmall}>
                  There is no open progress period. Create the next one in period control.
                </div>
              ) : (
                <>
                  {forecastAge > STALE_FORECAST_DAYS && (
                    <p className={styles.warn}>
                      The forecast behind this period is {forecastAge} days old. Refresh it before
                      closing so the snapshot reflects today&apos;s position.
                    </p>
                  )}

                  <div className={styles.twoColInner}>
                    <div>
                      <h3 className={styles.subHead}>
                        Blockers <span className={styles.count}>{ready.blockers.length}</span>
                      </h3>

                      {ready.blockers.length === 0 ? (
                        <p className={styles.okLine}>Nothing is blocking the close.</p>
                      ) : (
                        <ul className={cx(styles.checks, styles.checksBad)}>
                          {ready.blockers.map((text, index) => (
                            <li key={index}>{text}</li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div>
                      <h3 className={styles.subHead}>
                        Warnings <span className={styles.count}>{ready.warnings.length}</span>
                      </h3>

                      {ready.warnings.length === 0 ? (
                        <p className={styles.okLine}>No warnings.</p>
                      ) : (
                        <ul className={cx(styles.checks, styles.checksWarn)}>
                          {ready.warnings.map((text, index) => (
                            <li key={index}>{text}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>

                  <dl className={cx(styles.facts, styles.factsRow)}>
                    <div>
                      <dt>Period end</dt>
                      <dd>{formatStamp(ready.periodEndDate)}</dd>
                    </div>
                    <div>
                      <dt>Forecast data date</dt>
                      <dd>{formatStamp(ready.forecastDataDate)}</dd>
                    </div>
                    <div>
                      <dt>Today</dt>
                      <dd>{formatDay(today)}</dd>
                    </div>
                  </dl>
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">LAST TWO PERIODS</div>
                  <h2>
                    {model.latest
                      ? model.previous
                        ? `${model.previous.periodCode} to ${model.latest.periodCode}`
                        : `${model.latest.periodCode} (first closed period)`
                      : "Period comparison"}
                  </h2>
                </div>

                <span className={styles.muted}>
                  {model.ordered.length} {plural(model.ordered.length, "snapshot", "snapshots")}
                </span>
              </header>

              {!model.latest ? (
                <div className={styles.emptySmall}>
                  No period has been closed yet. Closing one captures the first snapshot.
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={cx(styles.table, styles.compare)}>
                    <thead>
                      <tr>
                        <th>MEASURE</th>
                        <th className={styles.num}>{model.previous ? model.previous.periodCode : "BEFORE"}</th>
                        <th className={styles.num}>{model.latest.periodCode}</th>
                        <th className={styles.num}>CHANGE</th>
                      </tr>
                    </thead>

                    <tbody>
                      {METRICS.map((metric) => {
                        const now = metric.read(model.latest as PeriodEndSnapshot);
                        const before = model.previous ? metric.read(model.previous) : NaN;
                        const change = now - before;
                        const flat = !Number.isFinite(change) || Math.abs(change) < 1e-9;
                        const good =
                          metric.better === "none" || flat
                            ? null
                            : metric.better === "higher"
                              ? change > 0
                              : change < 0;

                        return (
                          <tr key={metric.key}>
                            <td>{metric.label}</td>
                            <td className={styles.num}>{Number.isFinite(before) ? metric.format(before) : "—"}</td>
                            <td className={styles.num}>
                              <strong>{Number.isFinite(now) ? metric.format(now) : "—"}</strong>
                            </td>
                            <td
                              className={cx(
                                styles.num,
                                good === true && styles.pos,
                                good === false && styles.neg,
                              )}
                            >
                              {Number.isFinite(change) && !flat ? metric.formatChange(change) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">COST DRIFT</div>
                    <h2>Cost against baseline by period</h2>
                  </div>
                </header>

                {model.costRows.length === 0 ? (
                  <div className={styles.emptySmall}>Needs at least one closed period.</div>
                ) : (
                  <>
                    <VarianceChart
                      ariaLabel="Forecast cost against baseline target at the end of each period"
                      format={signedMoney}
                      rows={model.costRows}
                    />
                    <p className={styles.swipe}>Swipe sideways to see the full chart.</p>
                    <p className={styles.hint}>Red is above the baseline cost target, green below.</p>
                  </>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">FINISH DRIFT</div>
                    <h2>Finish against baseline by period</h2>
                  </div>
                </header>

                {model.finishRows.length === 0 ? (
                  <div className={styles.emptySmall}>Needs at least one closed period.</div>
                ) : (
                  <>
                    <VarianceChart
                      ariaLabel="Forecast finish against baseline target at the end of each period, in days"
                      format={(value) => `${signed(value)} d`}
                      rows={model.finishRows}
                    />
                    <p className={styles.swipe}>Swipe sideways to see the full chart.</p>
                    <p className={styles.hint}>Red is later than the baseline finish, green earlier.</p>
                  </>
                )}
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PERFORMANCE</div>
                  <h2>Cost and schedule index at each period end</h2>
                </div>

                <span className={styles.muted}>
                  {model.trend.length > 0
                    ? `last ${model.trend.length} ${plural(model.trend.length, "period", "periods")}`
                    : ""}
                </span>
              </header>

              {model.trend.length < 2 ? (
                <div className={styles.emptySmall}>Needs at least two closed periods to draw a trend.</div>
              ) : (
                <LineChart
                  ariaLabel="Cost performance index and schedule performance index at each period end"
                  formatX={formatDay}
                  formatY={(value) => num(value, 2)}
                  height={260}
                  refs={[{ y: 1, label: "1.00 = on plan", color: "#8a948f" }]}
                  series={model.indexSeries}
                />
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">SCORES</div>
                  <h2>How the control scores moved</h2>
                </div>
              </header>

              {model.trend.length < 2 ? (
                <div className={styles.emptySmall}>Needs at least two closed periods to draw a trend.</div>
              ) : (
                <LineChart
                  ariaLabel="Predictive, governance, recovery and period control scores at each period end"
                  formatX={formatDay}
                  formatY={(value) => num(value)}
                  height={260}
                  series={model.scoreSeries}
                  yMax={100}
                  yMin={0}
                />
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BASELINES</div>
                  <h2>How the targets were reset</h2>
                </div>

                <span className={styles.muted}>
                  {model.baselineRows.length} {plural(model.baselineRows.length, "version", "versions")}
                </span>
              </header>

              {model.baselineRows.length === 0 ? (
                <div className={styles.emptySmall}>No baseline has been captured yet.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>VERSION</th>
                        <th>STATUS</th>
                        <th className={styles.num}>COST TARGET</th>
                        <th className={styles.num}>FINISH TARGET</th>
                        <th className={styles.num}>SCORE THEN</th>
                        <th>REASON</th>
                      </tr>
                    </thead>

                    <tbody>
                      {model.baselineRows.map(({ item, costShift, finishShift }) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.versionCode}</strong>
                            <span className={styles.cellSub}>{item.title}</span>
                          </td>
                          <td>{BASELINE_LABEL[item.status]}</td>
                          <td className={styles.num}>
                            {money(item.costTarget)}
                            {Number.isFinite(costShift) && Math.abs(costShift) >= 1 && (
                              <span className={cx(styles.cellSub, costShift > 0 ? styles.neg : styles.pos)}>
                                {signedMoney(costShift)} vs previous
                              </span>
                            )}
                          </td>
                          <td className={styles.num}>
                            {formatStamp(item.finishTarget)}
                            {Number.isFinite(finishShift) && finishShift !== 0 && (
                              <span className={cx(styles.cellSub, finishShift > 0 ? styles.neg : styles.pos)}>
                                {signed(finishShift)} d vs previous
                              </span>
                            )}
                          </td>
                          <td className={styles.num}>{Math.round(item.capturedPredictiveScore)}</td>
                          <td className={styles.wrap}>
                            {item.reason ?? "—"}
                            {item.changeReference && (
                              <span className={styles.cellSub}>Change {item.changeReference}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PERIODS</div>
                  <h2>Latest first</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>
                    {model.periods.length} {plural(model.periods.length, "period", "periods")}
                  </span>

                  {model.periods.length > LIST_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllPeriods((value) => !value)}
                      type="button"
                    >
                      {showAllPeriods ? `Show first ${LIST_LIMIT}` : `Show all ${model.periods.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.periods.length === 0 ? (
                <div className={styles.emptySmall}>No progress periods yet.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>PERIOD</th>
                        <th>FROM</th>
                        <th>TO</th>
                        <th>BASELINE</th>
                        <th>STATUS</th>
                        <th>CLOSED</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visiblePeriods.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.periodCode}</strong>
                            <span className={styles.cellSub}>{item.title}</span>
                          </td>
                          <td>{formatStamp(item.startDate)}</td>
                          <td>{formatStamp(item.endDate)}</td>
                          <td>{item.baselineVersionCode}</td>
                          <td>
                            <span className={cx(styles.status, item.status === "OPEN" && styles.statusOpen)}>
                              {item.status === "OPEN" ? "Open" : "Closed"}
                            </span>
                          </td>
                          <td>{item.closedAt ? formatStamp(item.closedAt) : "—"}</td>
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

