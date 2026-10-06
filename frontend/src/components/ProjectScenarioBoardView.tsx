"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { type ChartSeries, LineChart } from "@/components/LineChart";
import { getProjectForecast } from "@/lib/api";
import type {
  ForecastControl,
  ForecastRiskLevel,
  ForecastScenario,
  ForecastScenarioType,
  ForecastTrend,
} from "@/types/project";

import styles from "./ProjectScenarioBoardView.module.css";

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const SVG_W = 800;
const LABEL_X = 0;
const PLOT_L = 214;
const PLOT_R = 752;
const ROW_H = 44;
const TOP = 28;

const RISK_LABEL: Record<ForecastRiskLevel, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<ForecastRiskLevel, string | undefined> = {
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const RISK_COLOR: Record<ForecastRiskLevel, string> = {
  ON_TRACK: "#3f8a68",
  WATCH: "#d1a43a",
  AT_RISK: "#b5493e",
};

const TREND_LABEL: Record<ForecastTrend, string> = {
  IMPROVING: "Improving",
  STABLE: "Stable",
  DETERIORATING: "Deteriorating",
  NO_HISTORY: "No history yet",
};

const TYPE_LABEL: Record<ForecastScenarioType, string> = {
  BASE: "Base",
  OPTIMISTIC: "Optimistic",
  PESSIMISTIC: "Pessimistic",
  CUSTOM: "Custom",
};

const TYPE_ORDER: Record<ForecastScenarioType, number> = {
  BASE: 0,
  OPTIMISTIC: 1,
  PESSIMISTIC: 2,
  CUSTOM: 3,
};

const STATUS_LABEL: Record<ForecastScenario["status"], string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  ARCHIVED: "Archived",
};

type Kind = "pct" | "days" | "mult";

interface Assumption {
  key:
    | "costAdjustmentPercentage"
    | "scheduleAdjustmentDays"
    | "productivityMultiplier"
    | "procurementDelayDays"
    | "commercialExposurePercentage"
    | "riskContingencyPercentage"
    | "resourceCapacityMultiplier";
  label: string;
  kind: Kind;
  neutral: number;
  badWhen: "above" | "below";
}

const ASSUMPTIONS: ReadonlyArray<Assumption> = [
  { key: "costAdjustmentPercentage", label: "COST", kind: "pct", neutral: 0, badWhen: "above" },
  { key: "scheduleAdjustmentDays", label: "SCHEDULE", kind: "days", neutral: 0, badWhen: "above" },
  { key: "productivityMultiplier", label: "PRODUCTIVITY", kind: "mult", neutral: 1, badWhen: "below" },
  { key: "procurementDelayDays", label: "PROCUREMENT DELAY", kind: "days", neutral: 0, badWhen: "above" },
  { key: "commercialExposurePercentage", label: "COMMERCIAL", kind: "pct", neutral: 0, badWhen: "above" },
  { key: "riskContingencyPercentage", label: "CONTINGENCY", kind: "pct", neutral: 0, badWhen: "above" },
  { key: "resourceCapacityMultiplier", label: "CAPACITY", kind: "mult", neutral: 1, badWhen: "below" },
];

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
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

function tickDay(day: number): string {
  const date = new Date(day * DAY_MS);

  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ""} ${String(date.getUTCFullYear()).slice(2)}`;
}

function num(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function signed(value: number, digits = 0): string {
  const text = num(Math.abs(value), digits);

  if (Math.round(value * 10 ** digits) === 0) {
    return num(0, digits);
  }

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
  const text = money(Math.abs(value));

  if (Math.abs(value) < 1) {
    return money(0);
  }

  return value > 0 ? `+${text}` : `−${text}`;
}

function ratioClass(value: number): string | undefined {
  if (!Number.isFinite(value)) {
    return undefined;
  }

  return value < 0.9 ? styles.neg : value < 1 ? styles.warnText : styles.pos;
}

function trunc(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function formatAssumption(kind: Kind, value: number): string {
  if (kind === "mult") {
    return `${num(value, 2)}×`;
  }

  if (kind === "days") {
    return `${signed(value)} d`;
  }

  return `${signed(value, 1)}%`;
}

interface RangeRow {
  key: string;
  label: string;
  sub: string;
  lower: number;
  expected: number;
  upper: number;
  risk: ForecastRiskLevel | null;
}

interface RangeRef {
  value: number;
  color: string;
  dash: string;
  label: string;
}

interface RangeChartProps {
  ariaLabel: string;
  formatTick: (value: number) => string;
  formatValue: (value: number) => string;
  refs: RangeRef[];
  rows: RangeRow[];
}

function RangeChart({ ariaLabel, formatTick, formatValue, refs, rows }: RangeChartProps) {
  const values = [
    ...rows.flatMap((row) => [row.lower, row.expected, row.upper]),
    ...refs.map((ref) => ref.value),
  ].filter(Number.isFinite);

  if (rows.length === 0 || values.length === 0) {
    return null;
  }

  let lo = Math.min(...values);
  let hi = Math.max(...values);
  const pad = (hi - lo) * 0.06 || Math.max(Math.abs(hi) * 0.02, 1);

  lo -= pad;
  hi += pad;

  const sx = (value: number) => PLOT_L + ((value - lo) / (hi - lo)) * (PLOT_R - PLOT_L);
  const ticks = Array.from({ length: 5 }, (_, index) => lo + ((hi - lo) * index) / 4);
  const height = TOP + rows.length * ROW_H + 10;

  return (
    <>
      <div className={styles.chartScroll}>
        <svg
          aria-label={ariaLabel}
          className={styles.chart}
          role="img"
          viewBox={`0 0 ${SVG_W} ${height}`}
        >
          {ticks.map((tick, index) => (
            <g key={index}>
              <line stroke="#e8ebe7" x1={sx(tick)} x2={sx(tick)} y1={TOP - 6} y2={height - 8} />
              <text fill="#66706b" fontSize={12.5} textAnchor="middle" x={sx(tick)} y={14}>
                {formatTick(tick)}
              </text>
            </g>
          ))}

          {rows.map((row, index) => {
            const top = TOP + index * ROW_H;
            const centre = top + ROW_H / 2;
            const color = row.risk ? RISK_COLOR[row.risk] : "#19201e";
            const left = sx(row.lower);
            const right = sx(row.upper);
            const marker = sx(row.expected);
            const labelOnRight = right + 84 < SVG_W;

            return (
              <g key={row.key}>
                {index % 2 === 0 && <rect fill="#f6f7f5" height={ROW_H} width={SVG_W} x={0} y={top} />}

                <text fill="#19201e" fontSize={14} fontWeight={700} x={LABEL_X + 4} y={centre - 3}>
                  {trunc(row.label, 26)}
                </text>
                <text fill="#66706b" fontSize={12.5} x={LABEL_X + 4} y={centre + 13}>
                  {row.sub}
                </text>

                <rect
                  fill={color}
                  height={16}
                  opacity={0.3}
                  rx={8}
                  width={Math.max(right - left, 8)}
                  x={left}
                  y={centre - 8}
                />
                <circle cx={marker} cy={centre} fill={color} r={7} stroke="#ffffff" strokeWidth={2} />

                <text
                  fill="#19201e"
                  fontSize={13}
                  fontWeight={700}
                  paintOrder="stroke"
                  stroke="#ffffff"
                  strokeLinejoin="round"
                  strokeWidth={4}
                  textAnchor={labelOnRight ? "start" : "end"}
                  x={labelOnRight ? Math.max(right, marker) + 12 : Math.min(left, marker) - 12}
                  y={centre + 4.5}
                >
                  {formatValue(row.expected)}
                </text>

                <title>
                  {`${row.label}: ${formatValue(row.lower)} to ${formatValue(row.upper)}, expected ${formatValue(row.expected)}`}
                </title>
              </g>
            );
          })}

          {refs.map((ref) =>
            Number.isFinite(ref.value) ? (
              <line
                key={ref.label}
                stroke={ref.color}
                strokeDasharray={ref.dash}
                strokeWidth={2}
                x1={sx(ref.value)}
                x2={sx(ref.value)}
                y1={TOP - 6}
                y2={height - 8}
              />
            ) : null,
          )}
        </svg>
      </div>
      <p className={styles.swipe}>Swipe sideways to see the full chart.</p>
    </>
  );
}

export function ProjectScenarioBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ForecastControl | null>(null);
  const [error, setError] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectForecast(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load forecast data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const intel = data?.intelligence;
    const scenarios = data?.scenarios ?? [];
    const archivedCount = scenarios.filter((item) => item.status === "ARCHIVED").length;

    const shown = scenarios
      .filter((item) => showArchived || item.status !== "ARCHIVED")
      .sort(
        (a, b) =>
          TYPE_ORDER[a.scenarioType] - TYPE_ORDER[b.scenarioType] || a.name.localeCompare(b.name),
      );

    const currentExpected = intel?.expectedForecastCost ?? NaN;
    const currentFinish = toDay(intel?.expectedForecastFinishDate ?? null);

    const costRows: RangeRow[] = [];
    const finishRows: RangeRow[] = [];

    if (intel) {
      costRows.push({
        key: "current",
        label: "Current forecast",
        sub: "From progress so far",
        lower: intel.costForecastLower,
        expected: intel.expectedForecastCost,
        upper: intel.costForecastUpper,
        risk: null,
      });

      finishRows.push({
        key: "current",
        label: "Current forecast",
        sub: "From progress so far",
        lower: toDay(intel.earliestForecastFinishDate),
        expected: currentFinish,
        upper: toDay(intel.latestForecastFinishDate),
        risk: null,
      });
    }

    const detail = shown.map((scenario) => {
      const evaluation = scenario.evaluation;
      const expectedFinish = toDay(evaluation.expectedFinishDate);

      return {
        scenario,
        costDelta: evaluation.expectedCost - currentExpected,
        finishDelta: expectedFinish - currentFinish,
        expectedFinish,
      };
    });

    for (const item of shown) {
      const sub = `${TYPE_LABEL[item.scenarioType]} · ${STATUS_LABEL[item.status]}`;

      costRows.push({
        key: item.id,
        label: item.name,
        sub,
        lower: item.evaluation.lowerCost,
        expected: item.evaluation.expectedCost,
        upper: item.evaluation.upperCost,
        risk: item.evaluation.scenarioRisk,
      });

      finishRows.push({
        key: item.id,
        label: item.name,
        sub,
        lower: toDay(item.evaluation.earliestFinishDate),
        expected: toDay(item.evaluation.expectedFinishDate),
        upper: toDay(item.evaluation.latestFinishDate),
        risk: item.evaluation.scenarioRisk,
      });
    }

    const byCost = [...detail].sort(
      (a, b) => a.scenario.evaluation.expectedCost - b.scenario.evaluation.expectedCost,
    );
    const byFinish = [...detail]
      .filter((item) => Number.isFinite(item.expectedFinish))
      .sort((a, b) => a.expectedFinish - b.expectedFinish);

    const ranked = [...shown].sort(
      (a, b) => a.evaluation.scenarioScore - b.evaluation.scenarioScore || a.name.localeCompare(b.name),
    );

    const history = data?.history ?? [];
    const cpi: ChartSeries = {
      name: "CPI (cost)",
      color: "#2f6f55",
      points: history
        .map((item) => ({ x: toDay(item.dataDate), y: item.cpi }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
    };
    const spi: ChartSeries = {
      name: "SPI (schedule)",
      color: "#d9823a",
      dashed: true,
      points: history
        .map((item) => ({ x: toDay(item.dataDate), y: item.spi }))
        .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y)),
    };

    return {
      archivedCount,
      shown,
      detail,
      costRows,
      finishRows,
      lowestCost: byCost[0],
      highestCost: byCost[byCost.length - 1],
      earliest: byFinish[0],
      latest: byFinish[byFinish.length - 1],
      ranked,
      historySeries: [cpi, spi],
      historyCount: cpi.points.length,
      plannedEnd: toDay(data?.project.plannedEndDate ?? null),
      currentExpected,
      currentFinish,
    };
  }, [data, showArchived]);

  const intel = data?.intelligence;
  const vac = intel ? intel.bac - intel.estimateAtCompletion : 0;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">SCENARIO BOARD</div>

            <h1>{data ? data.project.name : "Scenario board"}</h1>

            <p className={styles.subtitle}>
              Where the project is heading today and how far each what-if moves cost and finish
              date. Create and approve scenarios in forecast control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/forecast`}>
            Open forecast control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading forecast data…</div>}

        {data && intel && (
          <>
            <section aria-label="Forecast summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>PREDICTIVE SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.predictiveScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.predictiveRisk])}>
                    {RISK_LABEL[intel.predictiveRisk]}
                  </span>{" "}
                  {TREND_LABEL[intel.trend]}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COST INDEX (CPI)</div>
                <div className={cx(styles.kpiValue, ratioClass(intel.cpi))}>{num(intel.cpi, 2)}</div>
                <div className={styles.kpiSub}>
                  earned {money(intel.earnedValue)} · spent {money(intel.actualCost)}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SCHEDULE INDEX (SPI)</div>
                <div className={cx(styles.kpiValue, ratioClass(intel.spi))}>{num(intel.spi, 2)}</div>
                <div className={styles.kpiSub}>
                  earned {money(intel.earnedValue)} · planned {money(intel.plannedValue)}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ESTIMATE AT COMPLETION</div>
                <div className={styles.kpiValue}>{money(intel.estimateAtCompletion)}</div>
                <div className={cx(styles.kpiSub, vac < 0 && styles.neg)}>
                  {Math.abs(vac) < 1
                    ? `on the budget of ${money(intel.bac)}`
                    : `${money(Math.abs(vac))} ${vac < 0 ? "over" : "under"} the budget of ${money(intel.bac)}`}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TO-COMPLETE INDEX (TCPI)</div>
                <div className={cx(styles.kpiValue, intel.tcpi > 1.1 && styles.neg)}>
                  {num(intel.tcpi, 2)}
                </div>
                <div className={styles.kpiSub}>
                  {intel.tcpi > 1
                    ? "remaining work must beat the rate so far"
                    : "remaining work can run at the rate so far"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>EXPECTED FINISH</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>
                  {formatDay(model.currentFinish)}
                </div>
                <div className={cx(styles.kpiSub, intel.scheduleVarianceDays > 0 && styles.neg)}>
                  {signed(intel.scheduleVarianceDays)} d vs planned end
                </div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">COST RANGE</div>
                  <h2>Final cost by scenario</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>
                    {model.shown.length} {model.shown.length === 1 ? "scenario" : "scenarios"}
                  </span>

                  {model.archivedCount > 0 && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowArchived((value) => !value)}
                      type="button"
                    >
                      {showArchived ? "Hide archived" : `Include ${model.archivedCount} archived`}
                    </button>
                  )}
                </div>
              </header>

              <RangeChart
                ariaLabel="Forecast final cost range for the current forecast and each scenario, with the expected cost marked"
                formatTick={money}
                formatValue={money}
                refs={[
                  { value: intel.bac, color: "#19201e", dash: "6 4", label: "BAC" },
                  { value: model.currentExpected, color: "#7aa100", dash: "2 4", label: "Current" },
                ]}
                rows={model.costRows}
              />

              <ul aria-label="Cost chart legend" className={styles.legend}>
                <li>
                  <i className={styles.dot} />
                  Expected cost
                </li>
                <li>
                  <i className={styles.rangeSwatch} />
                  Lower to upper estimate
                </li>
                <li>
                  <i className={cx(styles.refSwatch, styles.refBudget)} />
                  Budget at completion ({money(intel.bac)})
                </li>
                <li>
                  <i className={cx(styles.refSwatch, styles.refCurrent)} />
                  Current expected
                </li>
              </ul>

              {model.shown.length === 0 && (
                <p className={styles.hint}>
                  No scenarios yet. Add some in forecast control to compare outcomes against the
                  current forecast.
                </p>
              )}

              <p className={styles.hint}>
                Marker colour shows each scenario&apos;s risk: green on track, amber watch, red at
                risk.
              </p>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">FINISH RANGE</div>
                  <h2>Completion date by scenario</h2>
                </div>

                <span className={styles.muted}>
                  planned end {formatDay(model.plannedEnd)}
                </span>
              </header>

              <RangeChart
                ariaLabel="Forecast completion date range for the current forecast and each scenario, with the expected date marked"
                formatTick={tickDay}
                formatValue={tickDay}
                refs={[
                  { value: model.plannedEnd, color: "#19201e", dash: "6 4", label: "Planned" },
                  { value: model.currentFinish, color: "#7aa100", dash: "2 4", label: "Current" },
                ]}
                rows={model.finishRows}
              />

              <ul aria-label="Finish chart legend" className={styles.legend}>
                <li>
                  <i className={styles.dot} />
                  Expected finish
                </li>
                <li>
                  <i className={styles.rangeSwatch} />
                  Earliest to latest
                </li>
                <li>
                  <i className={cx(styles.refSwatch, styles.refBudget)} />
                  Planned end
                </li>
                <li>
                  <i className={cx(styles.refSwatch, styles.refCurrent)} />
                  Current expected
                </li>
              </ul>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">SPREAD</div>
                    <h2>How far apart the outcomes are</h2>
                  </div>
                </header>

                {model.detail.length === 0 || !model.lowestCost || !model.highestCost ? (
                  <div className={styles.emptySmall}>Add scenarios to compare their outcomes.</div>
                ) : (
                  <dl className={styles.facts}>
                    <div>
                      <dt>Lowest expected cost</dt>
                      <dd>
                        {money(model.lowestCost.scenario.evaluation.expectedCost)}
                        <small className={styles.factSub}>{trunc(model.lowestCost.scenario.name, 30)}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Highest expected cost</dt>
                      <dd>
                        {money(model.highestCost.scenario.evaluation.expectedCost)}
                        <small className={styles.factSub}>{trunc(model.highestCost.scenario.name, 30)}</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Gap between them</dt>
                      <dd>
                        {money(
                          model.highestCost.scenario.evaluation.expectedCost -
                            model.lowestCost.scenario.evaluation.expectedCost,
                        )}
                      </dd>
                    </div>
                    {model.earliest && model.latest && (
                      <>
                        <div>
                          <dt>Earliest expected finish</dt>
                          <dd>
                            {formatDay(model.earliest.expectedFinish)}
                            <small className={styles.factSub}>{trunc(model.earliest.scenario.name, 30)}</small>
                          </dd>
                        </div>
                    <div>
                          <dt>Latest expected finish</dt>
                          <dd>
                            {formatDay(model.latest.expectedFinish)}
                            <small className={styles.factSub}>{trunc(model.latest.scenario.name, 30)}</small>
                          </dd>
                        </div>
                        <div>
                          <dt>Gap between them</dt>
                          <dd>{num(model.latest.expectedFinish - model.earliest.expectedFinish)} d</dd>
                        </div>
                      </>
                    )}
                  </dl>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">SCENARIO SCORE</div>
                    <h2>Weakest outcome first</h2>
                  </div>

                  <span className={styles.muted}>higher is better</span>
                </header>

                {model.ranked.length === 0 ? (
                  <div className={styles.emptySmall}>No scenarios to rank.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.ranked.map((scenario) => (
                      <li key={scenario.id}>
                        <div className={styles.ageingTop}>
                          <span>{trunc(scenario.name, 30)}</span>
                          <strong>
                            {Math.round(scenario.evaluation.scenarioScore)}
                            <small>{RISK_LABEL[scenario.evaluation.scenarioRisk]}</small>
                          </strong>
                        </div>

                        <div
                          aria-label={`${scenario.name} score ${Math.round(scenario.evaluation.scenarioScore)} out of 100`}
                          className={styles.track}
                          role="img"
                        >
                          <div
                            className={styles.fill}
                            style={{
                              background: RISK_COLOR[scenario.evaluation.scenarioRisk],
                              width: `${Math.min(100, Math.max(2, scenario.evaluation.scenarioScore))}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">COMPARISON</div>
                  <h2>Scenarios against the current forecast</h2>
                </div>

                <span className={styles.muted}>
                  current expected {money(model.currentExpected)} · {formatDay(model.currentFinish)}
                </span>
              </header>

              {model.detail.length === 0 ? (
                <div className={styles.emptySmall}>No scenarios yet.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>SCENARIO</th>
                        <th className={styles.num}>EXPECTED COST</th>
                        <th className={styles.num}>RANGE</th>
                        <th className={styles.num}>EXPECTED FINISH</th>
                        <th className={styles.num}>SCORE</th>
                        <th>RISK</th>
                      </tr>
                    </thead>

                    <tbody>
                      {model.detail.map(({ scenario, costDelta, finishDelta, expectedFinish }) => (
                        <tr key={scenario.id}>
                          <td>
                            <strong>{scenario.name}</strong>
                            <span className={styles.cellSub}>
                              {TYPE_LABEL[scenario.scenarioType]} · {STATUS_LABEL[scenario.status]}
                            </span>
                          </td>
                          <td className={styles.num}>
                            {money(scenario.evaluation.expectedCost)}
                            <span
                              className={cx(
                                styles.cellSub,
                                costDelta > 0 ? styles.neg : costDelta < 0 ? styles.pos : undefined,
                              )}
                            >
                              {signedMoney(costDelta)} vs current
                            </span>
                          </td>
                          <td className={styles.num}>
                            {money(scenario.evaluation.lowerCost)} to {money(scenario.evaluation.upperCost)}
                          </td>
                          <td className={styles.num}>
                            {formatDay(expectedFinish)}
                            <span
                              className={cx(
                                styles.cellSub,
                                finishDelta > 0 ? styles.neg : finishDelta < 0 ? styles.pos : undefined,
                              )}
                            >
                              {Number.isFinite(finishDelta) ? `${signed(finishDelta)} d vs current` : "—"}
                            </span>
                          </td>
                          <td className={styles.num}>{Math.round(scenario.evaluation.scenarioScore)}</td>
                          <td>
                            <span className={cx(styles.pill, RISK_CLASS[scenario.evaluation.scenarioRisk])}>
                              {RISK_LABEL[scenario.evaluation.scenarioRisk]}
                            </span>
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
                  <div className="eyebrow">ASSUMPTIONS</div>
                  <h2>What each scenario changes</h2>
                </div>

                <span className={styles.muted}>
                  {model.shown.length} {model.shown.length === 1 ? "scenario" : "scenarios"}
                </span>
              </header>

              {model.shown.length === 0 ? (
                <div className={styles.emptySmall}>No scenarios yet.</div>
              ) : (
                <>
                  <p className={styles.lead}>
                    Red cells push cost or the finish date up, green cells pull them down, and grey
                    cells leave the current forecast unchanged.
                  </p>

                  <div className={styles.tableWrap}>
                    <table className={cx(styles.table, styles.matrix)}>
                      <thead>
                        <tr>
                          <th>SCENARIO</th>
                          {ASSUMPTIONS.map((item) => (
                            <th className={styles.num} key={item.key}>
                              {item.label}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {model.shown.map((scenario) => (
                          <tr key={scenario.id}>
                            <td>
                              <strong>{scenario.name}</strong>
                            </td>
                            {ASSUMPTIONS.map((item) => {
                              const value = scenario[item.key];
                              const off = value !== item.neutral;
                              const bad = item.badWhen === "above" ? value > item.neutral : value < item.neutral;

                              return (
                                <td
                                  className={cx(
                                    styles.num,
                                    off && (bad ? styles.cellBad : styles.cellGood),
                                    !off && styles.cellNeutral,
                                  )}
                                  key={item.key}
                                >
                                  {formatAssumption(item.kind, value)}
                                </td>
                              );
                            })}
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
                  <div className="eyebrow">HISTORY</div>
                  <h2>Cost and schedule index over time</h2>
                </div>

                <span className={styles.muted}>{model.historyCount} {model.historyCount === 1 ? "snapshot" : "snapshots"}</span>
              </header>

              {model.historyCount < 2 ? (
                <div className={styles.emptySmall}>
                  Needs at least two earned-value snapshots to draw a trend.
                </div>
              ) : (
                <LineChart
                  ariaLabel="Cost performance index and schedule performance index over time"
                  formatX={formatDay}
                  formatY={(value) => num(value, 2)}
                  height={280}
                  refs={[{ y: 1, label: "1.00 = on plan", color: "#8a948f" }]}
                  series={model.historySeries}
                />
              )}

              <p className={styles.hint}>
                CPI and SPI below 1.00 mean the project is over budget or behind plan. The cards
                at the top turn amber below 1.00 and red below 0.90.
              </p>
            </section>

            <p className={styles.note}>{intel.explanation}</p>
          </>
        )}
      </main>
    </div>
  );
}
