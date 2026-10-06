"use client";

import Link from "next/link";
import { netCost } from "@/lib/labels";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectRecovery } from "@/lib/api";
import type {
  ChangeImpactControl,
  ChangeSimulation,
  ChangeSimulationStatus,
  RecoveryOption,
  RecoveryOptionStatus,
  RecoveryRiskLevel,
  RecoveryStrategyType,
} from "@/types/project";

import styles from "./ProjectRecoveryBoardView.module.css";

const DAY_MS = 86_400_000;
const LIST_LIMIT = 10;

const RISK_LABEL: Record<RecoveryRiskLevel, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<RecoveryRiskLevel, string | undefined> = {
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const RISK_COLOR: Record<RecoveryRiskLevel, string> = {
  ON_TRACK: "#3f8a68",
  WATCH: "#d1a43a",
  AT_RISK: "#b5493e",
};

const STRATEGY_LABEL: Record<RecoveryStrategyType, string> = {
  ACCELERATION: "Acceleration",
  RESEQUENCING: "Resequencing",
  OVERTIME: "Overtime",
  ADDITIONAL_RESOURCES: "Extra resources",
  ALTERNATE_SUPPLIER: "Alternate supplier",
  SCOPE_OPTIMIZATION: "Scope optimisation",
  COMBINED: "Combined",
};

const OPTION_STATUS_LABEL: Record<RecoveryOptionStatus, string> = {
  DRAFT: "Draft",
  SELECTED: "Selected",
  REJECTED: "Rejected",
};

const SIM_STATUS_LABEL: Record<ChangeSimulationStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  ARCHIVED: "Archived",
};

const COLOR = {
  total: "#6f827a",
  impacted: "#b5493e",
  recovered: "#2f6f55",
  up: "#d98a7f",
  down: "#7fb89d",
  recovery: "#dcb85e",
} as const;

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

function formatStamp(value: string | null): string {
  const day = toDay(value);

  return Number.isFinite(day) ? formatDay(day) : "—";
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

function trunc(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

interface WaterfallStep {
  key: string;
  label: string[];
  kind: "total" | "delta";
  value: number;
  from: number;
  to: number;
  color: string;
}

const W_WIDTH = 800;
const W_HEIGHT = 340;
const W_LEFT = 70;
const W_RIGHT = 12;
const W_TOP = 30;
const W_BOTTOM = 58;

function Waterfall({ steps }: { steps: WaterfallStep[] }) {
  const levels = steps.flatMap((step) => [step.from, step.to]).filter(Number.isFinite);

  if (steps.length === 0 || levels.length === 0) {
    return null;
  }

  let lo = Math.min(...levels);
  let hi = Math.max(...levels);
  const span = hi - lo || Math.max(Math.abs(hi) * 0.02, 1);

  lo -= span * 0.9;
  hi += span * 0.25;

  const plotH = W_HEIGHT - W_TOP - W_BOTTOM;
  const plotW = W_WIDTH - W_LEFT - W_RIGHT;
  const colW = plotW / steps.length;
  const barW = Math.min(52, colW * 0.62);
  const sy = (value: number) => W_TOP + (1 - (value - lo) / (hi - lo)) * plotH;
  const ticks = Array.from({ length: 4 }, (_, index) => lo + ((hi - lo) * index) / 3);

  return (
    <div className={styles.chartScroll}>
      <svg
        aria-label="Cost waterfall from the baseline forecast through the change impact to the recovered forecast"
        className={styles.chart}
        role="img"
        viewBox={`0 0 ${W_WIDTH} ${W_HEIGHT}`}
      >
        {ticks.map((tick, index) => (
          <g key={index}>
            <line stroke="#e8ebe7" x1={W_LEFT} x2={W_WIDTH - W_RIGHT} y1={sy(tick)} y2={sy(tick)} />
            <text fill="#66706b" fontSize={12.5} textAnchor="end" x={W_LEFT - 8} y={sy(tick) + 4}>
              {money(tick)}
            </text>
          </g>
        ))}

        {steps.map((step, index) => {
          const x = W_LEFT + index * colW + (colW - barW) / 2;
          const top = sy(Math.max(step.from, step.to));
          const bottom = sy(Math.min(step.from, step.to));
          const height = Math.max(bottom - top, 2);
          const next = steps[index + 1];

          return (
            <g key={step.key}>
              <rect fill={step.color} height={height} rx={3} width={barW} x={x} y={top} />

              <text
                fill="#19201e"
                fontSize={13}
                fontWeight={700}
                textAnchor="middle"
                x={x + barW / 2}
                y={top - 7}
              >
                {step.kind === "total" ? money(step.value) : signedMoney(step.value)}
              </text>

              {step.label.map((line, lineIndex) => (
                <text
                  fill="#55605b"
                  fontSize={12.5}
                  key={line}
                  textAnchor="middle"
                  x={x + barW / 2}
                  y={W_HEIGHT - W_BOTTOM + 20 + lineIndex * 15}
                >
                  {line}
                </text>
              ))}

              {next && (
                <line
                  stroke="#9aa49f"
                  strokeDasharray="3 3"
                  x1={x + barW}
                  x2={x + colW}
                  y1={sy(step.to)}
                  y2={sy(step.to)}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

interface FinishPoint {
  key: string;
  label: string;
  day: number;
  color: string;
}

const F_WIDTH = 800;
const F_LEFT = 170;
const F_RIGHT = 130;
const F_ROW = 46;
const F_TOP = 26;

function FinishChart({ points }: { points: FinishPoint[] }) {
  const days = points.map((point) => point.day).filter(Number.isFinite);

  if (points.length === 0 || days.length === 0) {
    return null;
  }

  let lo = Math.min(...days);
  let hi = Math.max(...days);
  const pad = Math.max((hi - lo) * 0.18, 6);

  lo -= pad;
  hi += pad;

  const sx = (day: number) => F_LEFT + ((day - lo) / (hi - lo)) * (F_WIDTH - F_LEFT - F_RIGHT);
  const height = F_TOP + points.length * F_ROW + 8;
  const ticks = Array.from({ length: 4 }, (_, index) => lo + ((hi - lo) * index) / 3);

  return (
    <div className={styles.chartScroll}>
      <svg
        aria-label="Forecast finish dates: baseline, after the change and after recovery"
        className={styles.chartSmall}
        role="img"
        viewBox={`0 0 ${F_WIDTH} ${height}`}
      >
        {ticks.map((tick, index) => (
          <g key={index}>
            <line stroke="#e8ebe7" x1={sx(tick)} x2={sx(tick)} y1={F_TOP - 6} y2={height - 6} />
            <text fill="#66706b" fontSize={12.5} textAnchor="middle" x={sx(tick)} y={14}>
              {formatDay(tick).slice(0, 6)}
            </text>
          </g>
        ))}

        {points.map((point, index) => {
          const centre = F_TOP + index * F_ROW + F_ROW / 2;
          const prev = points[index - 1];

          return (
            <g key={point.key}>
              <text fill="#19201e" fontSize={14} fontWeight={700} x={4} y={centre + 5}>
                {point.label}
              </text>

              {prev && Number.isFinite(prev.day) && Number.isFinite(point.day) && (
                <line
                  stroke={point.color}
                  strokeLinecap="round"
                  strokeWidth={6}
                  x1={sx(prev.day)}
                  x2={sx(point.day)}
                  y1={centre}
                  y2={centre}
                  opacity={0.45}
                />
              )}

              {Number.isFinite(point.day) && (
                <>
                  <circle cx={sx(point.day)} cy={centre} fill={point.color} r={7} stroke="#ffffff" strokeWidth={2} />
                  <text
                    fill="#19201e"
                    fontSize={13}
                    fontWeight={700}
                    paintOrder="stroke"
                    stroke="#ffffff"
                    strokeLinejoin="round"
                    strokeWidth={4}
                    x={sx(point.day) + 13}
                    y={centre + 4.5}
                  >
                    {formatDay(point.day)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const S_WIDTH = 800;
const S_HEIGHT = 330;
const S_LEFT = 76;
const S_RIGHT = 24;
const S_TOP = 16;
const S_BOTTOM = 46;

interface ScatterPoint {
  option: RecoveryOption;
  x: number;
  y: number;
}

function Scatter({
  activeId,
  delay,
  onPick,
  points,
}: {
  activeId: string | null;
  delay: number;
  onPick: (id: string) => void;
  points: ScatterPoint[];
}) {
  const clean = points.filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));

  if (clean.length === 0) {
    return null;
  }

  const xMax = Math.max(1, delay, ...clean.map((point) => point.x)) * 1.12;
  const yValues = clean.map((point) => point.y);
  let yLo = Math.min(0, ...yValues);
  let yHi = Math.max(0, ...yValues);
  const ySpan = yHi - yLo || Math.max(Math.abs(yHi), 1);

  yLo -= yLo < 0 ? ySpan * 0.12 : 0;
  yHi += ySpan * 0.16;

  const sx = (value: number) => S_LEFT + (value / xMax) * (S_WIDTH - S_LEFT - S_RIGHT);
  const sy = (value: number) => S_TOP + (1 - (value - yLo) / (yHi - yLo)) * (S_HEIGHT - S_TOP - S_BOTTOM);
  const yTicks = Array.from({ length: 5 }, (_, index) => yLo + ((yHi - yLo) * index) / 4);
  const xTicks = Array.from({ length: 5 }, (_, index) => (xMax * index) / 4);

  return (
    <div className={styles.chartScroll}>
      <svg
        aria-label="Cost against schedule days recovered for each recovery option"
        className={styles.chart}
        role="img"
        viewBox={`0 0 ${S_WIDTH} ${S_HEIGHT}`}
      >
        {yTicks.map((tick, index) => (
          <g key={index}>
            <line stroke="#e8ebe7" x1={S_LEFT} x2={S_WIDTH - S_RIGHT} y1={sy(tick)} y2={sy(tick)} />
            <text fill="#66706b" fontSize={12.5} textAnchor="end" x={S_LEFT - 8} y={sy(tick) + 4}>
              {money(tick)}
            </text>
          </g>
        ))}

        {xTicks.map((tick, index) => (
          <text
            fill="#66706b"
            fontSize={12.5}
            key={index}
            textAnchor="middle"
            x={sx(tick)}
            y={S_HEIGHT - S_BOTTOM + 20}
          >
            {num(tick)} d
          </text>
        ))}

        <text fill="#66706b" fontSize={12.5} textAnchor="middle" x={(S_LEFT + S_WIDTH - S_RIGHT) / 2} y={S_HEIGHT - 6}>
          Schedule days recovered
        </text>

        {delay > 0 && (
          <g>
            <line
              stroke="#19201e"
              strokeDasharray="6 4"
              strokeWidth={2}
              x1={sx(delay)}
              x2={sx(delay)}
              y1={S_TOP}
              y2={S_HEIGHT - S_BOTTOM}
            />
            <text fill="#19201e" fontSize={12.5} fontWeight={700} textAnchor="end" x={sx(delay) - 6} y={S_TOP + 12}>
              Full recovery
            </text>
          </g>
        )}

        {clean.map((point) => {
          const active = point.option.id === activeId;
          const color = RISK_COLOR[point.option.evaluation.recoveryRisk];
          const cx0 = sx(point.x);
          const cy0 = sy(point.y);
          const flip = cx0 > S_WIDTH - 130;

          return (
            <g
              className={styles.point}
              key={point.option.id}
              onClick={() => onPick(point.option.id)}
            >
              {active && <circle cx={cx0} cy={cy0} fill="none" r={13} stroke="#19201e" strokeWidth={2} />}
              <circle cx={cx0} cy={cy0} fill={color} r={8} stroke="#ffffff" strokeWidth={2} />
              <text
                fill="#19201e"
                fontSize={13}
                fontWeight={700}
                paintOrder="stroke"
                stroke="#ffffff"
                strokeLinejoin="round"
                strokeWidth={4}
                textAnchor={flip ? "end" : "start"}
                x={flip ? cx0 - 15 : cx0 + 15}
                y={cy0 + 4.5}
              >
                {point.option.recommended ? "★ " : ""}
                {point.option.optionNumber}
              </text>
              <title>
                {`${point.option.optionNumber} ${point.option.name}: ${num(point.x)} days recovered for ${money(point.y)}`}
              </title>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function ProjectRecoveryBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ChangeImpactControl | null>(null);
  const [error, setError] = useState("");
  const [simId, setSimId] = useState<string | null>(null);
  const [optionId, setOptionId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showAllSims, setShowAllSims] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectRecovery(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load recovery data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const all = data?.simulations ?? [];
    const archivedCount = all.filter((item) => item.status === "ARCHIVED").length;
    const visible = all
      .filter((item) => showArchived || item.status !== "ARCHIVED")
      .sort((a, b) => a.simulationNumber.localeCompare(b.simulationNumber));

    const activeNumber = data?.intelligence.activeSimulationNumber ?? null;
    const sim: ChangeSimulation | undefined =
      visible.find((item) => item.id === simId) ??
      visible.find((item) => item.simulationNumber === activeNumber) ??
      visible[0];

    const options = [...(sim?.options ?? [])].sort((a, b) => a.optionNumber.localeCompare(b.optionNumber));
    const option: RecoveryOption | undefined =
      options.find((item) => item.id === optionId) ??
      options.find((item) => item.status === "SELECTED") ??
      options.find((item) => item.recommended) ??
      options[0];

    const steps: WaterfallStep[] = [];

    if (sim) {
      const impact = sim.impact;
      let level = impact.baselineForecastCost;

      steps.push({
        key: "base",
        label: ["Baseline", "forecast"],
        kind: "total",
        value: level,
        from: level,
        to: level,
        color: COLOR.total,
      });

      const parts: Array<[string, string[], number]> = [
        ["direct", ["Direct", "cost"], impact.directCostImpact],
        ["productivity", ["Productivity"], impact.productivityCostImpact],
        ["resources", ["Resources"], impact.resourceCostImpact],
        ["extension", ["Extension"], impact.extensionCostImpact],
        ["contingency", ["Contingency"], impact.contingencyCostImpact],
      ];

      for (const [key, label, value] of parts) {
        steps.push({
          key,
          label,
          kind: "delta",
          value,
          from: level,
          to: level + value,
          color: value >= 0 ? COLOR.up : COLOR.down,
        });
        level += value;
      }

      steps.push({
        key: "impacted",
        label: ["Impacted", "forecast"],
        kind: "total",
        value: impact.impactedForecastCost,
        from: impact.impactedForecastCost,
        to: impact.impactedForecastCost,
        color: COLOR.impacted,
      });

      if (option) {
        const cost = option.evaluation.recoveryCostVsImpacted;

        steps.push({
          key: "recovery",
          label: ["Recovery", "cost"],
          kind: "delta",
          value: cost,
          from: impact.impactedForecastCost,
          to: impact.impactedForecastCost + cost,
          color: cost > 0 ? COLOR.recovery : COLOR.down,
        });
        steps.push({
          key: "recovered",
          label: ["Recovered", "forecast"],
          kind: "total",
          value: option.evaluation.recoveredForecastCost,
          from: option.evaluation.recoveredForecastCost,
          to: option.evaluation.recoveredForecastCost,
          color: COLOR.recovered,
        });
      }
    }

    const finish: FinishPoint[] = [];

    if (sim) {
      finish.push({
        key: "f-base",
        label: "Baseline forecast",
        day: toDay(sim.impact.baselineForecastFinishDate),
        color: COLOR.total,
      });
      finish.push({
        key: "f-impact",
        label: "After the change",
        day: toDay(sim.impact.impactedForecastFinishDate),
        color: COLOR.impacted,
      });

      if (option) {
        finish.push({
          key: "f-rec",
          label: "After recovery",
          day: toDay(option.evaluation.recoveredForecastFinishDate),
          color: COLOR.recovered,
        });
      }
    }

    const scatter: ScatterPoint[] = options.map((item) => ({
      option: item,
      x: item.evaluation.recoverableDays,
      y: item.evaluation.recoveryCostVsImpacted,
    }));

    return {
      archivedCount,
      visible,
      sim,
      options,
      option,
      steps,
      finish,
      scatter,
      history: [...(data?.selectedPlanHistory ?? [])].sort((a, b) => b.selectedAt.localeCompare(a.selectedAt)),
    };
  }, [data, optionId, showArchived, simId]);

  const intel = data?.intelligence;
  const sim = model.sim;
  const option = model.option;
  const visibleSims = showAllSims ? model.visible : model.visible.slice(0, LIST_LIMIT);

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">RECOVERY BOARD</div>

            <h1>{data ? data.project.name : "Recovery board"}</h1>

            <p className={styles.subtitle}>
              What a change does to cost and finish date, and what each recovery option buys back.
              Create simulations and options in recovery control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/recovery`}>
            Open recovery control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading recovery data…</div>}

        {data && intel && (
          <>
            <section aria-label="Recovery summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>RECOVERY SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.recoveryScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.recoveryRisk])}>
                    {RISK_LABEL[intel.recoveryRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CHANGE COST EXPOSURE</div>
                <div className={cx(styles.kpiValue, intel.changeCostExposure > 0 && styles.neg)}>
                  {money(intel.changeCostExposure)}
                </div>
                <div className={styles.kpiSub}>
                  {intel.activeSimulationNumber
                    ? `${intel.activeSimulationNumber} · ${trunc(intel.activeSimulationTitle ?? "", 28)}`
                    : "no active simulation"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SCHEDULE IMPACT</div>
                <div className={cx(styles.kpiValue, intel.scheduleImpactDays > 0 && styles.neg)}>
                  {signed(intel.scheduleImpactDays)} d
                </div>
                <div className={styles.kpiSub}>
                  {intel.scheduleImpactDays === 0
                    ? "finish date unchanged"
                    : `finish moves to ${formatStamp(intel.impactedForecastFinishDate)}`}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>RECOVERABLE</div>
                <div className={cx(styles.kpiValue, styles.pos)}>{num(intel.recoverableDays)} d</div>
                <div className={styles.kpiSub}>
                  {intel.recommendedRecoveryOptionNumber
                    ? `recommended ${intel.recommendedRecoveryOptionNumber}`
                    : "no recommended option"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>RESIDUAL DELAY</div>
                <div className={cx(styles.kpiValue, intel.residualDelayDays > 0 && styles.neg)}>
                  {num(intel.residualDelayDays)} d
                </div>
                <div className={styles.kpiSub}>still late after recovery</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NET RECOVERY COST</div>
                <div className={styles.kpiValue}>{netCost(intel.recoveryCost, money)}</div>
                <div className={styles.kpiSub}>
                  {intel.recoverableDays > 0
                    ? `${netCost(intel.costPerDayRecovered, money)} per day recovered`
                    : "nothing recovered yet"}
                </div>
              </article>
            </section>

            {!sim ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>
                  No change simulations yet. Add one in recovery control to see its impact and the
                  recovery options here.
                </div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">SIMULATION</div>
                      <h2>
                        {sim.simulationNumber} · {sim.title}
                      </h2>
                    </div>

                    <div className={styles.controls}>
                      <span className={cx(styles.status, styles[`status${sim.status}`])}>
                        {SIM_STATUS_LABEL[sim.status]}
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

                  {model.visible.length > 1 && (
                    <div aria-label="Simulation" className={styles.segmented} role="group">
                      {model.visible.map((item) => (
                        <button
                          aria-pressed={item.id === sim.id}
                          className={cx(styles.segment, item.id === sim.id && styles.segmentOn)}
                          key={item.id}
                          onClick={() => {
                            setSimId(item.id);
                            setOptionId(null);
                          }}
                          type="button"
                        >
                          {item.simulationNumber}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className={styles.lead}>
                    {sim.description ?? "No description recorded."}{" "}
                    {sim.sourceChangeReference && (
                      <span className={styles.muted}>Source change: {sim.sourceChangeReference}.</span>
                    )}
                  </p>

                  <ul aria-label="Change assumptions" className={styles.chips}>
                    <li>
                      <span>Direct cost</span>
                      <strong>{money(sim.directCostImpact)}</strong>
                    </li>
                    <li>
                      <span>Delay</span>
                      <strong>{num(sim.delayDays)} d</strong>
                    </li>
                    <li>
                      <span>Productivity</span>
                      <strong>{signed(sim.productivityChangePercentage, 1)}%</strong>
                    </li>
                    <li>
                      <span>Procurement delay</span>
                      <strong>{num(sim.procurementDelayDays)} d</strong>
                    </li>
                    <li>
                      <span>Resource capacity</span>
                      <strong>{signed(sim.resourceCapacityChangePercentage, 1)}%</strong>
                    </li>
                    <li>
                      <span>Risk contingency</span>
                      <strong>{num(sim.riskContingencyPercentage, 1)}%</strong>
                    </li>
                  </ul>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">COST</div>
                      <h2>From baseline to recovered forecast</h2>
                    </div>

                    <span className={styles.muted}>
                      impact score {Math.round(sim.impact.impactScore)} ·{" "}
                      <span className={cx(styles.pill, RISK_CLASS[sim.impact.impactRisk])}>
                        {RISK_LABEL[sim.impact.impactRisk]}
                      </span>
                    </span>
                  </header>

                  {model.options.length > 1 && (
                    <div aria-label="Recovery option" className={styles.segmented} role="group">
                      {model.options.map((item) => (
                        <button
                          aria-pressed={option?.id === item.id}
                          className={cx(styles.segment, option?.id === item.id && styles.segmentOn)}
                          key={item.id}
                          onClick={() => setOptionId(item.id)}
                          type="button"
                        >
                          {item.recommended ? "★ " : ""}
                          {item.optionNumber}
                        </button>
                      ))}
                    </div>
                  )}

                  <Waterfall steps={model.steps} />
                  <p className={styles.swipe}>Swipe sideways to see the full chart.</p>

                  <ul aria-label="Waterfall legend" className={styles.legend}>
                    <li>
                      <i className={styles.swatch} style={{ background: COLOR.up }} />
                      Adds cost
                    </li>
                    <li>
                      <i className={styles.swatch} style={{ background: COLOR.down }} />
                      Saves cost
                    </li>
                    <li>
                      <i className={styles.swatch} style={{ background: COLOR.recovery }} />
                      Recovery cost
                    </li>
                  </ul>

                  <p className={styles.hint}>
                    The vertical axis does not start at zero, so the steps are easier to see.
                    {option ? ` Recovery shown for ${option.optionNumber} ${option.name}.` : " No recovery option yet."}
                  </p>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">FINISH</div>
                      <h2>What happens to the date</h2>
                    </div>

                    <span className={styles.muted}>
                      {signed(sim.impact.scheduleImpactDays)} d from the change
                      {option ? ` · ${signed(-option.evaluation.recoverableDays)} d recovered` : ""}
                    </span>
                  </header>

                  <FinishChart points={model.finish} />
                  <p className={styles.swipe}>Swipe sideways to see the full chart.</p>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">OPTIONS</div>
                      <h2>What each option buys</h2>
                    </div>

                    <span className={styles.muted}>
                      {model.options.length} {plural(model.options.length, "option", "options")}
                    </span>
                  </header>

                  {model.options.length === 0 ? (
                    <div className={styles.emptySmall}>
                      No recovery options for this simulation yet.
                    </div>
                  ) : (
                    <>
                      <Scatter
                        activeId={option?.id ?? null}
                        delay={Math.max(0, sim.impact.scheduleImpactDays)}
                        onPick={setOptionId}
                        points={model.scatter}
                      />
                      <p className={styles.swipe}>Swipe sideways to see the full chart.</p>
                      <p className={styles.hint}>
                        Further right recovers more days; lower costs less. The dashed line is the
                        delay the change caused. ★ marks the recommended option and colour shows its
                        risk. Click a point or a row to show it in the waterfall.
                      </p>

                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>OPTION</th>
                              <th className={styles.num}>RECOVERS</th>
                              <th className={styles.num}>STILL LATE</th>
                              <th className={styles.num}>COST</th>
                              <th className={styles.num}>PER DAY</th>
                              <th className={styles.num}>SCORE</th>
                              <th>RISK</th>
                            </tr>
                          </thead>

                          <tbody>
                            {model.options.map((item) => (
                              <tr className={item.id === option?.id ? styles.rowOn : undefined} key={item.id}>
                                <td>
                                  <button
                                    className={styles.rowButton}
                                    onClick={() => setOptionId(item.id)}
                                    type="button"
                                  >
                                    {item.optionNumber} · {item.name}
                                  </button>
                                  <span className={styles.cellSub}>
                                    {STRATEGY_LABEL[item.strategyType]} · {OPTION_STATUS_LABEL[item.status]}
                                    {item.recommended ? " · ★ Recommended" : ""}
                                  </span>
                                </td>
                                <td className={styles.num}>{num(item.evaluation.recoverableDays)} d</td>
                                <td className={cx(styles.num, item.evaluation.residualDelayDays > 0 && styles.neg)}>
                                  {num(item.evaluation.residualDelayDays)} d
                                </td>
                                <td className={styles.num}>{signedMoney(item.evaluation.recoveryCostVsImpacted)}</td>
                                <td className={styles.num}>
                                  {item.evaluation.recoverableDays > 0
                                    ? money(item.evaluation.costPerDayRecovered)
                                    : "—"}
                                </td>
                                <td className={styles.num}>{Math.round(item.evaluation.recoveryScore)}</td>
                                <td>
                                  <span className={cx(styles.pill, RISK_CLASS[item.evaluation.recoveryRisk])}>
                                    {RISK_LABEL[item.evaluation.recoveryRisk]}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </section>
              </>
            )}

            {model.visible.length > 1 && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">ALL SIMULATIONS</div>
                    <h2>Changes compared</h2>
                  </div>

                  <div className={styles.controls}>
                    <span className={styles.muted}>{model.visible.length} simulations</span>

                    {model.visible.length > LIST_LIMIT && (
                      <button
                        className={styles.linkButton}
                        onClick={() => setShowAllSims((value) => !value)}
                        type="button"
                      >
                        {showAllSims ? `Show first ${LIST_LIMIT}` : `Show all ${model.visible.length}`}
                      </button>
                    )}
                  </div>
                </header>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>SIMULATION</th>
                        <th>STATUS</th>
                        <th className={styles.num}>COST EXPOSURE</th>
                        <th className={styles.num}>DELAY</th>
                        <th className={styles.num}>OPTIONS</th>
                        <th className={styles.num}>IMPACT</th>
                        <th>RISK</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleSims.map((item) => (
                        <tr className={item.id === sim?.id ? styles.rowOn : undefined} key={item.id}>
                          <td>
                            <button
                              className={styles.rowButton}
                              onClick={() => {
                                setSimId(item.id);
                                setOptionId(null);
                              }}
                              type="button"
                            >
                              {item.simulationNumber} · {item.title}
                            </button>
                            <span className={styles.cellSub}>{item.sourceChangeReference}</span>
                          </td>
                          <td>{SIM_STATUS_LABEL[item.status]}</td>
                          <td className={cx(styles.num, item.impact.totalChangeCostExposure > 0 && styles.neg)}>
                            {money(item.impact.totalChangeCostExposure)}
                          </td>
                          <td className={cx(styles.num, item.impact.scheduleImpactDays > 0 && styles.neg)}>
                            {signed(item.impact.scheduleImpactDays)} d
                          </td>
                          <td className={styles.num}>{item.options.length}</td>
                          <td className={styles.num}>{Math.round(item.impact.impactScore)}</td>
                          <td>
                            <span className={cx(styles.pill, RISK_CLASS[item.impact.impactRisk])}>
                              {RISK_LABEL[item.impact.impactRisk]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PLAN HISTORY</div>
                  <h2>Recovery plans that were selected</h2>
                </div>

                <span className={styles.muted}>
                  {model.history.length} {plural(model.history.length, "plan", "plans")}
                </span>
              </header>

              {model.history.length === 0 ? (
                <div className={styles.emptySmall}>No recovery option has been selected yet.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>SELECTED</th>
                        <th className={styles.num}>CHANGE EXPOSURE</th>
                        <th className={styles.num} title="Cost of the recovery option minus the time-related savings from the days recovered. A negative figure is a net saving.">NET RECOVERY COST</th>
                        <th className={styles.num}>RECOVERED</th>
                        <th className={styles.num}>STILL LATE</th>
                        <th>RECOVERED FINISH</th>
                        <th className={styles.num}>SCORE</th>
                        <th>RISK</th>
                      </tr>
                    </thead>

                    <tbody>
                      {model.history.map((item) => (
                        <tr key={item.id}>
                          <td>{formatStamp(item.selectedAt)}</td>
                          <td className={styles.num}>{money(item.changeCostExposure)}</td>
                          <td className={styles.num}>{netCost(item.recoveryCost, money)}</td>
                          <td className={styles.num}>
                            {num(item.recoveredDays)} of {num(item.impactDelayDays)} d
                          </td>
                          <td className={cx(styles.num, item.residualDelayDays > 0 && styles.neg)}>
                            {num(item.residualDelayDays)} d
                          </td>
                          <td>{formatStamp(item.recoveredForecastFinishDate)}</td>
                          <td className={styles.num}>{Math.round(item.recoveryScore)}</td>
                          <td>
                            <span className={cx(styles.pill, RISK_CLASS[item.recoveryRisk])}>
                              {RISK_LABEL[item.recoveryRisk]}
                            </span>
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
