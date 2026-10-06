"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  getPortfolioExecutive,
  getPortfolioForecast,
  getPortfolioGovernance,
  getPortfolioPeriodControl,
  getPortfolioRecovery,
} from "@/lib/api";
import type {
  PortfolioException,
  PortfolioExceptionDomain,
  PortfolioExceptionSeverity,
  PortfolioExecutive,
  PortfolioForecast,
  PortfolioForecastProject,
  PortfolioGovernance,
  PortfolioGovernanceProject,
  PortfolioPeriodControl,
  PortfolioPeriodControlProject,
  PortfolioProjectSnapshot,
  PortfolioRecovery,
  PortfolioRecoveryProject,
  ProjectHealthBand,
  SupplierConcentrationRisk,
} from "@/types/project";

import styles from "./PortfolioTowerView.module.css";

const LIST_LIMIT = 10;
const SUPPLIER_LIMIT = 8;
const GOOD_SCORE = 75;
const WATCH_SCORE = 55;
const RED_LENS_ALERT = 3;

type Tone = "good" | "watch" | "bad" | "none";
type SourceKey = "executive" | "forecast" | "governance" | "recovery" | "period";
type SortKey = "attention" | "health" | "name" | string;

interface Lens {
  key: string;
  label: string;
  short: string;
  source: SourceKey;
}

const LENSES: ReadonlyArray<Lens> = [
  { key: "health", label: "Health", short: "Health", source: "executive" },
  { key: "cost", label: "Cost", short: "Cost", source: "executive" },
  { key: "procurement", label: "Procurement", short: "Procure", source: "executive" },
  { key: "risk", label: "Risk", short: "Risk", source: "executive" },
  { key: "production", label: "Production", short: "Produce", source: "executive" },
  { key: "information", label: "Information", short: "Info", source: "executive" },
  { key: "safety", label: "Safety", short: "Safety", source: "executive" },
  { key: "commercial", label: "Commercial", short: "Comm.", source: "executive" },
  { key: "resource", label: "Resources", short: "Resource", source: "executive" },
  { key: "forecast", label: "Forecast", short: "Forecast", source: "forecast" },
  { key: "governance", label: "Governance", short: "Govern.", source: "governance" },
  { key: "recovery", label: "Recovery", short: "Recovery", source: "recovery" },
  { key: "period", label: "Period", short: "Period", source: "period" },
];

const SOURCE_LABEL: Record<SourceKey, string> = {
  executive: "portfolio health",
  forecast: "forecast",
  governance: "governance",
  recovery: "recovery",
  period: "period control",
};

const BAND_LABEL: Record<ProjectHealthBand, string> = {
  HEALTHY: "Healthy",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const BAND_CLASS: Record<ProjectHealthBand, string | undefined> = {
  HEALTHY: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const TONE_COLOR: Record<Tone, string> = {
  good: "#3f8a68",
  watch: "#d1a43a",
  bad: "#b5493e",
  none: "#c3c9c5",
};

const SEVERITY_CLASS: Record<PortfolioExceptionSeverity, string | undefined> = {
  CRITICAL: styles.sevCritical,
  HIGH: styles.sevHigh,
  MEDIUM: styles.sevMedium,
};

const SEVERITY_LABEL: Record<PortfolioExceptionSeverity, string> = {
  CRITICAL: "Critical",
  HIGH: "High",
  MEDIUM: "Medium",
};

const DOMAIN_LABEL: Record<PortfolioExceptionDomain, string> = {
  OVERALL: "Overall",
  SCHEDULE: "Schedule",
  COST: "Cost",
  PROCUREMENT: "Procurement",
  RISK: "Risk",
  PRODUCTION: "Production",
  INFORMATION: "Information",
  SAFETY: "Safety",
  COMMERCIAL: "Commercial",
  RESOURCE: "Resources",
};

const CONCENTRATION_COLOR: Record<SupplierConcentrationRisk, string> = {
  LOW: "#6fa88c",
  MODERATE: "#d1a43a",
  HIGH: "#b5493e",
};

const CONCENTRATION_LABEL: Record<SupplierConcentrationRisk, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
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

function trunc(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function toneOfScore(score: number): Tone {
  return score >= GOOD_SCORE ? "good" : score >= WATCH_SCORE ? "watch" : "bad";
}

function toneOfLevel(level: string): Tone {
  return level === "ON_TRACK" ? "good" : level === "WATCH" ? "watch" : level === "AT_RISK" ? "bad" : "none";
}

function toneOfBand(band: ProjectHealthBand): Tone {
  return band === "HEALTHY" ? "good" : band === "WATCH" ? "watch" : "bad";
}

interface Cell {
  score: number | null;
  tone: Tone;
}

interface Row {
  id: string;
  code: string;
  name: string;
  snapshot?: PortfolioProjectSnapshot;
  forecast?: PortfolioForecastProject;
  governance?: PortfolioGovernanceProject;
  recovery?: PortfolioRecoveryProject;
  period?: PortfolioPeriodControlProject;
  cells: Record<string, Cell>;
  red: number;
  amber: number;
}

const NO_CELL: Cell = { score: null, tone: "none" };

function buildCells(row: Omit<Row, "cells" | "red" | "amber">): Record<string, Cell> {
  const snap = row.snapshot;
  const exec = (value: number | undefined): Cell =>
    value === undefined ? NO_CELL : { score: value, tone: toneOfScore(value) };

  return {
    health: snap ? { score: snap.healthScore, tone: toneOfBand(snap.healthBand) } : NO_CELL,
    cost: exec(snap?.costScore),
    procurement: exec(snap?.procurementScore),
    risk: exec(snap?.riskScore),
    production: exec(snap?.productionScore),
    information: exec(snap?.informationScore),
    safety: exec(snap?.safetyScore),
    commercial: exec(snap?.commercialScore),
    resource: exec(snap?.resourceScore),
    forecast: row.forecast
      ? { score: row.forecast.predictiveScore, tone: toneOfLevel(row.forecast.predictiveRisk) }
      : NO_CELL,
    governance: row.governance
      ? { score: row.governance.governanceScore, tone: toneOfLevel(row.governance.governanceRisk) }
      : NO_CELL,
    recovery:
      row.recovery && row.recovery.simulationCount > 0
        ? { score: row.recovery.recoveryScore, tone: toneOfLevel(row.recovery.recoveryRisk) }
        : NO_CELL,
    period:
      row.period && row.period.activeBaselineVersionCode
        ? { score: row.period.periodControlScore, tone: toneOfLevel(row.period.periodControlRisk) }
        : NO_CELL,
  };
}

const Q_WIDTH = 560;
const Q_HEIGHT = 380;
const Q_LEFT = 56;
const Q_RIGHT = 20;
const Q_TOP = 16;
const Q_BOTTOM = 44;

interface QuadrantPoint {
  id: string;
  code: string;
  name: string;
  spi: number;
  cpi: number;
  tone: Tone;
}

function Quadrant({ points }: { points: QuadrantPoint[] }) {
  const clean = points.filter((point) => Number.isFinite(point.spi) && Number.isFinite(point.cpi));

  if (clean.length === 0) {
    return null;
  }

  const xs = clean.map((point) => point.spi);
  const ys = clean.map((point) => point.cpi);
  const xLo = Math.min(0.85, ...xs) - 0.03;
  const xHi = Math.max(1.1, ...xs) + 0.03;
  const yLo = Math.min(0.85, ...ys) - 0.03;
  const yHi = Math.max(1.1, ...ys) + 0.03;
  const sx = (value: number) => Q_LEFT + ((value - xLo) / (xHi - xLo)) * (Q_WIDTH - Q_LEFT - Q_RIGHT);
  const sy = (value: number) => Q_TOP + (1 - (value - yLo) / (yHi - yLo)) * (Q_HEIGHT - Q_TOP - Q_BOTTOM);
  const xTicks = Array.from({ length: 5 }, (_, index) => xLo + ((xHi - xLo) * index) / 4);
  const yTicks = Array.from({ length: 5 }, (_, index) => yLo + ((yHi - yLo) * index) / 4);

  return (
    <div className={styles.chartScroll}>
      <svg
        aria-label="Cost performance index against schedule performance index for each project"
        className={cx(styles.chart, styles.chartNarrow)}
        role="img"
        viewBox={`0 0 ${Q_WIDTH} ${Q_HEIGHT}`}
      >
        <rect
          fill="#fbf1ef"
          height={Q_HEIGHT - Q_BOTTOM - sy(1)}
          width={sx(1) - Q_LEFT}
          x={Q_LEFT}
          y={sy(1)}
        />
        <rect
          fill="#eef6f1"
          height={sy(1) - Q_TOP}
          width={Q_WIDTH - Q_RIGHT - sx(1)}
          x={sx(1)}
          y={Q_TOP}
        />

        {yTicks.map((tick, index) => (
          <g key={`y${index}`}>
            <line stroke="#e8ebe7" x1={Q_LEFT} x2={Q_WIDTH - Q_RIGHT} y1={sy(tick)} y2={sy(tick)} />
            <text fill="#66706b" fontSize={12.5} textAnchor="end" x={Q_LEFT - 8} y={sy(tick) + 4}>
              {num(tick, 2)}
            </text>
          </g>
        ))}

        {xTicks.map((tick, index) => (
          <text
            fill="#66706b"
            fontSize={12.5}
            key={`x${index}`}
            textAnchor="middle"
            x={sx(tick)}
            y={Q_HEIGHT - Q_BOTTOM + 20}
          >
            {num(tick, 2)}
          </text>
        ))}

        <line stroke="#19201e" strokeDasharray="6 4" strokeWidth={1.5} x1={sx(1)} x2={sx(1)} y1={Q_TOP} y2={Q_HEIGHT - Q_BOTTOM} />
        <line stroke="#19201e" strokeDasharray="6 4" strokeWidth={1.5} x1={Q_LEFT} x2={Q_WIDTH - Q_RIGHT} y1={sy(1)} y2={sy(1)} />

        <text fill="#66706b" fontSize={12.5} textAnchor="middle" x={(Q_LEFT + Q_WIDTH - Q_RIGHT) / 2} y={Q_HEIGHT - 6}>
          Schedule index (SPI) · right is ahead
        </text>
        <text
          fill="#66706b"
          fontSize={12.5}
          textAnchor="middle"
          transform={`rotate(-90 14 ${(Q_TOP + Q_HEIGHT - Q_BOTTOM) / 2})`}
          x={14}
          y={(Q_TOP + Q_HEIGHT - Q_BOTTOM) / 2}
        >
          Cost index (CPI)
        </text>

        <text fill="#2e7355" fontSize={12.5} fontWeight={700} textAnchor="end" x={Q_WIDTH - Q_RIGHT - 8} y={Q_TOP + 18}>
          Ahead and under budget
        </text>
        <text fill="#9a493f" fontSize={12.5} fontWeight={700} x={Q_LEFT + 8} y={Q_HEIGHT - Q_BOTTOM - 10}>
          Behind and over budget
        </text>

        {clean.map((point) => {
          const x = sx(point.spi);
          const y = sy(point.cpi);
          const flip = x > Q_WIDTH - 90;

          return (
            <g key={point.id}>
              <circle cx={x} cy={y} fill={TONE_COLOR[point.tone]} r={8} stroke="#ffffff" strokeWidth={2} />
              <text
                fill="#19201e"
                fontSize={12.5}
                fontWeight={700}
                paintOrder="stroke"
                stroke="#ffffff"
                strokeLinejoin="round"
                strokeWidth={4}
                textAnchor={flip ? "end" : "start"}
                x={flip ? x - 13 : x + 13}
                y={y + 4.5}
              >
                {point.code}
              </text>
              <title>{`${point.code} ${point.name}: CPI ${num(point.cpi, 2)}, SPI ${num(point.spi, 2)}`}</title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface Sources {
  executive: PortfolioExecutive | null;
  forecast: PortfolioForecast | null;
  governance: PortfolioGovernance | null;
  recovery: PortfolioRecovery | null;
  period: PortfolioPeriodControl | null;
}

export function PortfolioTowerView() {
  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<SourceKey[]>([]);
  const [sort, setSort] = useState<SortKey>("attention");
  const [showAllExceptions, setShowAllExceptions] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      getPortfolioExecutive(),
      getPortfolioForecast(),
      getPortfolioGovernance(),
      getPortfolioRecovery(),
      getPortfolioPeriodControl(),
    ]).then((results) => {
      if (cancelled) {
        return;
      }

      const [executive, forecast, governance, recovery, period] = results;
      const missing: SourceKey[] = [];

      const take = <T,>(result: PromiseSettledResult<T>, key: SourceKey): T | null => {
        if (result.status === "fulfilled") {
          return result.value;
        }

        missing.push(key);

        return null;
      };

      const next: Sources = {
        executive: take(executive, "executive"),
        forecast: take(forecast, "forecast"),
        governance: take(governance, "governance"),
        recovery: take(recovery, "recovery"),
        period: take(period, "period"),
      };

      setSources(next);
      setFailed(missing);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const model = useMemo(() => {
    if (!sources) {
      return null;
    }

    const map = new Map<string, Omit<Row, "cells" | "red" | "amber">>();
    const entry = (id: string, code: string, name: string) => {
      const found = map.get(id) ?? { id, code, name };

      map.set(id, found);

      return found;
    };

    for (const item of sources.executive?.projects ?? []) {
      entry(item.projectId, item.code, item.name).snapshot = item;
    }

    for (const item of sources.forecast?.projects ?? []) {
      entry(item.projectId, item.projectCode, item.projectName).forecast = item;
    }

    for (const item of sources.governance?.projects ?? []) {
      entry(item.projectId, item.projectCode, item.projectName).governance = item;
    }

    for (const item of sources.recovery?.projects ?? []) {
      entry(item.projectId, item.projectCode, item.projectName).recovery = item;
    }

    for (const item of sources.period?.projects ?? []) {
      entry(item.projectId, item.projectCode, item.projectName).period = item;
    }

    const loadedLenses = LENSES.filter((lens) => sources[lens.source] !== null);

    const rows: Row[] = [...map.values()].map((base) => {
      const cells = buildCells(base);
      let red = 0;
      let amber = 0;

      for (const lens of loadedLenses) {
        const cell = cells[lens.key] ?? NO_CELL;

        if (cell.tone === "bad") {
          red += 1;
        } else if (cell.tone === "watch") {
          amber += 1;
        }
      }

      return { ...base, cells, red, amber };
    });

    const scoreOf = (row: Row, key: string) => row.cells[key]?.score ?? Infinity;

    rows.sort((a, b) => {
      if (sort === "name") {
        return a.code.localeCompare(b.code);
      }

      if (sort === "health") {
        return scoreOf(a, "health") - scoreOf(b, "health") || a.code.localeCompare(b.code);
      }

      if (sort !== "attention") {
        return scoreOf(a, sort) - scoreOf(b, sort) || a.code.localeCompare(b.code);
      }

      return (
        b.red - a.red ||
        b.amber - a.amber ||
        scoreOf(a, "health") - scoreOf(b, "health") ||
        a.code.localeCompare(b.code)
      );
    });

    const averages = loadedLenses
      .map((lens) => {
        const scores = rows
          .map((row) => row.cells[lens.key]?.score)
          .filter((value): value is number => typeof value === "number");

        const mean = scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : NaN;

        return { lens, mean, count: scores.length };
      })
      .filter((item) => Number.isFinite(item.mean))
      .sort((a, b) => a.mean - b.mean);

    const quadrant: QuadrantPoint[] = (sources.forecast?.projects ?? []).map((item) => ({
      id: item.projectId,
      code: item.projectCode,
      name: item.projectName,
      spi: item.spi,
      cpi: item.cpi,
      tone: toneOfLevel(item.predictiveRisk),
    }));

    const money_rows = rows
      .filter((row) => row.forecast)
      .map((row) => {
        const fc = row.forecast as PortfolioForecastProject;

        return {
          row,
          bac: fc.bac,
          forecast: fc.expectedForecastCost,
          over: fc.expectedForecastCost - fc.bac,
          exposure: row.recovery?.changeCostExposure ?? 0,
          baseline: row.period && row.period.baselineCostTarget !== null ? row.period.costVarianceToBaseline : NaN,
          finish: fc.scheduleVarianceDays,
          cpi: fc.cpi,
          spi: fc.spi,
        };
      })
      .sort((a, b) => b.over - a.over);

    const exceptions: PortfolioException[] = [...(sources.executive?.exceptions ?? [])].sort(
      (a, b) => b.priorityScore - a.priorityScore,
    );

    const suppliers = [...(sources.executive?.supplierConcentration ?? [])].sort(
      (a, b) => b.portfolioAwardSharePercentage - a.portfolioAwardSharePercentage,
    );

    return {
      rows,
      loadedLenses,
      averages,
      quadrant,
      money_rows,
      exceptions,
      suppliers,
      withRed: rows.filter((row) => row.red > 0).length,
      withManyRed: rows.filter((row) => row.red >= RED_LENS_ALERT).length,
      criticalExceptions: exceptions.filter((item) => item.severity === "CRITICAL").length,
    };
  }, [sources, sort]);

  const exec = sources?.executive ?? null;
  const fc = sources?.forecast ?? null;
  const rc = sources?.recovery ?? null;
  const pc = sources?.period ?? null;
  const visibleExceptions = model ? (showAllExceptions ? model.exceptions : model.exceptions.slice(0, LIST_LIMIT)) : [];
  const portfolioOver = fc ? fc.portfolioExpectedForecastCost - fc.portfolioBac : 0;
  const totals = model
    ? model.money_rows.reduce(
        (sum, item) => ({
          bac: sum.bac + item.bac,
          forecast: sum.forecast + item.forecast,
          exposure: sum.exposure + item.exposure,
          baseline: sum.baseline + (Number.isFinite(item.baseline) ? item.baseline : 0),
        }),
        { bac: 0, forecast: 0, exposure: 0, baseline: 0 },
      )
    : null;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href="/portfolio">
              ← Portfolio
            </Link>

            <div className="eyebrow">CONTROL TOWER</div>

            <h1>Every project, every lens</h1>

            <p className={styles.subtitle}>
              Health, forecast, governance, recovery and period control side by side, so the
              projects that are weak in several places at once stand out.
            </p>
          </div>

          <Link className="secondary-link-button" href="/portfolio/report">
            Open portfolio report
          </Link>
        </header>

        {!sources && <div className={styles.loading}>Loading portfolio data…</div>}

        {sources && failed.length > 0 && (
          <div className="offline-banner">
            <div>
              <strong>
                {failed.length === 5
                  ? "Could not load portfolio data. Check that the backend is running."
                  : `Could not load ${failed.map((key) => SOURCE_LABEL[key]).join(", ")}.`}
              </strong>
              {failed.length < 5 && <span> The matching columns are left out.</span>}
            </div>
          </div>
        )}

        {sources && model && model.rows.length > 0 && (
          <>
            <section aria-label="Portfolio summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>PORTFOLIO HEALTH</div>
                <div className={styles.kpiValue}>
                  {exec ? Math.round(exec.summary.weightedPortfolioHealthScore) : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {exec ? (
                    <>
                      <span className={cx(styles.pill, BAND_CLASS[exec.summary.portfolioHealthBand])}>
                        {BAND_LABEL[exec.summary.portfolioHealthBand]}
                      </span>{" "}
                      {exec.summary.healthyProjects} healthy · {exec.summary.watchProjects} watch ·{" "}
                      {exec.summary.atRiskProjects} at risk
                    </>
                  ) : (
                    "health data unavailable"
                  )}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PROJECTS WITH RED LENSES</div>
                <div className={cx(styles.kpiValue, model.withRed > 0 && styles.neg)}>{model.withRed}</div>
                <div className={styles.kpiSub}>
                  of {model.rows.length} · {model.withManyRed} with {RED_LENS_ALERT} or more
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>EXCEPTIONS</div>
                <div className={styles.kpiValue}>{exec ? exec.summary.totalExceptions : "—"}</div>
                <div className={styles.kpiSub}>{model.criticalExceptions} critical</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST VS BUDGET</div>
                <div className={cx(styles.kpiValue, portfolioOver > 0 && styles.neg, portfolioOver < 0 && styles.pos)}>
                  {fc ? signedMoney(portfolioOver) : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {fc ? `CPI ${num(fc.weightedCpi, 2)} · SPI ${num(fc.weightedSpi, 2)}` : "forecast unavailable"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CHANGE EXPOSURE</div>
                <div className={cx(styles.kpiValue, rc && rc.totalChangeCostExposure > 0 && styles.neg)}>
                  {rc ? money(rc.totalChangeCostExposure) : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {rc
                    ? `${rc.projectsWithActiveSimulations} ${plural(rc.projectsWithActiveSimulations, "project", "projects")} · ${signed(rc.totalScheduleImpactDays)} d`
                    : "recovery unavailable"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DRIFT FROM BASELINE</div>
                <div
                  className={cx(
                    styles.kpiValue,
                    pc && pc.totalCostVarianceToBaseline > 0 && styles.neg,
                    pc && pc.totalCostVarianceToBaseline < 0 && styles.pos,
                  )}
                >
                  {pc ? signedMoney(pc.totalCostVarianceToBaseline) : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {pc
                    ? `${pc.projectsWithApprovedBaseline} with a baseline · ${signed(pc.totalFinishVarianceDays)} d total`
                    : "period control unavailable"}
                </div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">LENS MATRIX</div>
                  <h2>Where each project is weak</h2>
                </div>

                <div aria-label="Sort projects by" className={styles.segmented} role="group">
                  {(
                    [
                      ["attention", "Most red lenses"],
                      ["health", "Lowest health"],
                      ["name", "Code"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      aria-pressed={sort === key}
                      className={cx(styles.segment, sort === key && styles.segmentOn)}
                      key={key}
                      onClick={() => setSort(key)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </header>

              <p className={styles.swipe}>Swipe sideways to see every lens.</p>

              <div className={styles.matrixWrap}>
                <table className={styles.matrix}>
                  <thead>
                    <tr>
                      <th className={styles.projectHead}>PROJECT</th>
                      {model.loadedLenses.map((lens) => (
                        <th
                          aria-sort={sort === lens.key ? "ascending" : undefined}
                          className={styles.lensHead}
                          key={lens.key}
                        >
                          <button
                            className={cx(styles.lensButton, sort === lens.key && styles.lensButtonOn)}
                            onClick={() => setSort(lens.key)}
                            title={`Sort by ${lens.label.toLowerCase()}, weakest first`}
                            type="button"
                          >
                            {lens.short}
                          </button>
                        </th>
                      ))}
                      <th className={styles.lensHead}>RED</th>
                    </tr>
                  </thead>

                  <tbody>
                    {model.rows.map((row) => (
                      <tr key={row.id}>
                        <th className={styles.projectCell} scope="row">
                          <Link href={`/projects/${row.id}`}>
                            <strong>{row.code}</strong>
                            <span>{trunc(row.name, 28)}</span>
                          </Link>
                        </th>

                        {model.loadedLenses.map((lens) => {
                          const cell = row.cells[lens.key] ?? NO_CELL;

                          return (
                            <td className={styles.cellTd} key={lens.key}>
                              <span
                                className={cx(
                                  styles.cell,
                                  cell.tone === "good" && styles.cellGood,
                                  cell.tone === "watch" && styles.cellWatch,
                                  cell.tone === "bad" && styles.cellBad,
                                  cell.tone === "none" && styles.cellNone,
                                )}
                                title={`${row.code} · ${lens.label}: ${
                                  cell.score === null ? "no data" : `${num(cell.score)} (${cell.tone})`
                                }`}
                              >
                                {cell.score === null ? "—" : num(cell.score)}
                              </span>
                            </td>
                          );
                        })}

                        <td className={cx(styles.cellTd, styles.redCount, row.red >= RED_LENS_ALERT && styles.neg)}>
                          {row.red}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <ul aria-label="Matrix legend" className={styles.legend}>
                <li>
                  <i className={styles.swatch} style={{ background: TONE_COLOR.good }} />
                  Good
                </li>
                <li>
                  <i className={styles.swatch} style={{ background: TONE_COLOR.watch }} />
                  Watch
                </li>
                <li>
                  <i className={styles.swatch} style={{ background: TONE_COLOR.bad }} />
                  Weak
                </li>
                <li>
                  <i className={styles.swatch} style={{ background: TONE_COLOR.none }} />
                  No data
                </li>
              </ul>
              <p className={styles.hint}>
                Health, forecast, governance, recovery and period cells take their colour from the
                band the backend reports. The domain scores are coloured here: {GOOD_SCORE} and above is
                good, {WATCH_SCORE} to {GOOD_SCORE - 1} watch, below {WATCH_SCORE} weak. Recovery and
                period show no data until a simulation or a baseline exists. Click a column to sort
                by it, weakest first.
              </p>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">COST AND SCHEDULE</div>
                    <h2>Which projects are slipping on both</h2>
                  </div>

                  <span className={styles.muted}>
                    {model.quadrant.length} {plural(model.quadrant.length, "project", "projects")}
                  </span>
                </header>

                {model.quadrant.length === 0 ? (
                  <div className={styles.emptySmall}>
                    {fc ? "No forecast data yet." : "Forecast data could not be loaded."}
                  </div>
                ) : (
                <>
                    <Quadrant points={model.quadrant} />
                    <p className={styles.swipe}>Swipe sideways to see the full chart.</p>
                    <p className={styles.hint}>
                      Dashed lines mark 1.00. Dot colour is each project&apos;s predictive risk.
                    </p>
                </>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">PORTFOLIO AVERAGE</div>
                    <h2>The weakest lenses overall</h2>
                  </div>
                </header>

                {model.averages.length === 0 ? (
                  <div className={styles.emptySmall}>No scores to average yet.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.averages.map((item) => (
                      <li key={item.lens.key}>
                        <div className={styles.ageingTop}>
                          <span>{item.lens.label}</span>
                          <strong>
                            {num(item.mean)}
                            <small>
                              {item.count} {plural(item.count, "project", "projects")}
                            </small>
                          </strong>
                        </div>

                        <div
                          aria-label={`${item.lens.label} average score ${num(item.mean)} out of 100`}
                          className={styles.track}
                          role="img"
                        >
                          <div
                            className={styles.fill}
                            style={{
                              background: TONE_COLOR[toneOfScore(item.mean)],
                              width: `${Math.min(100, Math.max(2, item.mean))}%`,
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
                  <div className="eyebrow">MONEY</div>
                  <h2>Budget, forecast and exposure by project</h2>
                </div>

                <span className={styles.muted}>largest overrun first</span>
              </header>

              {model.money_rows.length === 0 ? (
                <div className={styles.emptySmall}>
                  {fc ? "No forecast data yet." : "Forecast data could not be loaded."}
                </div>
              ) : (
                <>
                  <p className={styles.swipe}>Swipe sideways to see every column.</p>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>PROJECT</th>
                          <th className={styles.num}>BUDGET</th>
                          <th className={styles.num}>FORECAST</th>
                          <th className={styles.num}>VS BUDGET</th>
                          <th className={styles.num}>CHANGE EXPOSURE</th>
                          <th className={styles.num}>VS BASELINE</th>
                          <th className={styles.num}>FINISH</th>
                          <th className={styles.num}>CPI</th>
                          <th className={styles.num}>SPI</th>
                        </tr>
                      </thead>

                      <tbody>
                        {model.money_rows.map((item) => (
                          <tr key={item.row.id}>
                            <td>
                              <Link className={styles.rowLink} href={`/projects/${item.row.id}`}>
                                <strong>{item.row.code}</strong>
                              </Link>
                              <span className={styles.cellSub}>{trunc(item.row.name, 30)}</span>
                            </td>
                            <td className={styles.num}>{money(item.bac)}</td>
                            <td className={styles.num}>{money(item.forecast)}</td>
                            <td className={cx(styles.num, item.over > 0 ? styles.neg : item.over < 0 ? styles.pos : undefined)}>
                              {signedMoney(item.over)}
                            </td>
                            <td className={styles.num}>{item.exposure > 0 ? money(item.exposure) : "—"}</td>
                            <td
                              className={cx(
                                styles.num,
                                Number.isFinite(item.baseline) && item.baseline > 0 && styles.neg,
                                Number.isFinite(item.baseline) && item.baseline < 0 && styles.pos,
                              )}
                            >
                              {Number.isFinite(item.baseline) ? signedMoney(item.baseline) : "—"}
                            </td>
                            <td className={cx(styles.num, item.finish > 0 && styles.neg)}>{signed(item.finish)} d</td>
                            <td className={styles.num}>{num(item.cpi, 2)}</td>
                            <td className={styles.num}>{num(item.spi, 2)}</td>
                          </tr>
                        ))}
                      </tbody>

                      {totals && (
                        <tfoot>
                          <tr>
                            <td>
                              <strong>Portfolio</strong>
                            </td>
                            <td className={styles.num}>{money(totals.bac)}</td>
                            <td className={styles.num}>{money(totals.forecast)}</td>
                            <td className={cx(styles.num, totals.forecast - totals.bac > 0 && styles.neg)}>
                              {signedMoney(totals.forecast - totals.bac)}
                            </td>
                            <td className={styles.num}>{totals.exposure > 0 ? money(totals.exposure) : "—"}</td>
                            <td className={cx(styles.num, totals.baseline > 0 && styles.neg)}>
                              {signedMoney(totals.baseline)}
                            </td>
                            <td className={styles.num}>—</td>
                            <td className={styles.num}>{fc ? num(fc.weightedCpi, 2) : "—"}</td>
                            <td className={styles.num}>{fc ? num(fc.weightedSpi, 2) : "—"}</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">EXCEPTIONS</div>
                  <h2>What needs attention first</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>{model.exceptions.length} open</span>

                  {model.exceptions.length > LIST_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllExceptions((value) => !value)}
                      type="button"
                    >
                      {showAllExceptions ? `Show first ${LIST_LIMIT}` : `Show all ${model.exceptions.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.exceptions.length === 0 ? (
                <div className={styles.emptySmall}>
                  {exec ? "No exceptions raised." : "Portfolio health data could not be loaded."}
                </div>
              ) : (
                <ul className={styles.items}>
                  {visibleExceptions.map((item) => (
                    <li key={item.id}>
                      <div className={styles.itemTop}>
                        <span className={cx(styles.sev, SEVERITY_CLASS[item.severity])}>
                          {SEVERITY_LABEL[item.severity]}
                        </span>
                        <span className={styles.itemTitle}>{item.title}</span>
                        <Link
                          className={styles.itemLink}
                          href={item.route.startsWith("/") ? item.route : `/projects/${item.projectId}`}
                        >
                          Open →
                        </Link>
                      </div>
                      <div className={styles.itemMeta}>
                        {item.projectCode} · {DOMAIN_LABEL[item.domain]} · {item.metricLabel}: {item.metricValue}
                      </div>
                      <div className={styles.itemMeta}>{item.detail}</div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">SUPPLIERS</div>
                  <h2>Who holds the awarded packages</h2>
                </div>

                <span className={styles.muted}>
                  {model.suppliers.length} {plural(model.suppliers.length, "supplier", "suppliers")}
                </span>
              </header>

              {model.suppliers.length === 0 ? (
                <div className={styles.emptySmall}>
                  {exec ? "No packages have been awarded yet." : "Portfolio health data could not be loaded."}
                </div>
              ) : (
                <>
                  <ul className={styles.ageing}>
                    {model.suppliers.slice(0, SUPPLIER_LIMIT).map((item) => (
                      <li key={item.supplierId}>
                        <div className={styles.ageingTop}>
                          <span title={item.supplierName}>{trunc(item.supplierName, 34)}</span>
                          <strong>
                            {num(item.portfolioAwardSharePercentage, 1)}%
                            <small>
                              {money(item.awardedValue)} · {item.awardedPackages}{" "}
                              {plural(item.awardedPackages, "package", "packages")} ·{" "}
                              {CONCENTRATION_LABEL[item.concentrationRisk]}
                            </small>
                          </strong>
                        </div>

                        <div
                          aria-label={`${item.supplierName} holds ${num(item.portfolioAwardSharePercentage, 1)}% of awarded value, concentration risk ${CONCENTRATION_LABEL[item.concentrationRisk].toLowerCase()}`}
                          className={styles.track}
                          role="img"
                        >
                          <div
                            className={styles.fill}
                            style={{
                              background: CONCENTRATION_COLOR[item.concentrationRisk],
                              width: `${Math.min(100, Math.max(2, item.portfolioAwardSharePercentage))}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>

                  <ul aria-label="Concentration legend" className={styles.legend}>
                    {(["LOW", "MODERATE", "HIGH"] as const).map((level) => (
                      <li key={level}>
                        <i className={styles.swatch} style={{ background: CONCENTRATION_COLOR[level] }} />
                        {CONCENTRATION_LABEL[level]} concentration
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          </>
        )}

        {sources && model && model.rows.length === 0 && failed.length < 5 && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No projects in the portfolio yet.</div>
          </section>
        )}
      </main>
    </div>
  );
}
