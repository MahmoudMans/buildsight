"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getPortfolioExecutive } from "@/lib/api";
import type {
  PortfolioExecutive,
  PortfolioProjectSnapshot,
  ProjectHealthBand,
  ProjectStatus,
} from "@/types/project";

import styles from "./PortfolioCompareView.module.css";

const COLORS = ["#344b42", "#b5493e", "#386b8d", "#d1a13a"] as const;
const MAX_SELECTED = 4;

const STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const BAND_LABEL: Record<ProjectHealthBand, string> = {
  HEALTHY: "Healthy",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const BAND_CLASS: Record<ProjectHealthBand, string> = {
  HEALTHY: styles.bandHealthy,
  WATCH: styles.bandWatch,
  AT_RISK: styles.bandRisk,
};

interface Axis {
  label: string;
  get: (project: PortfolioProjectSnapshot) => number;
}

const AXES: Axis[] = [
  { label: "Health", get: (p) => Number(p.healthScore) },
  { label: "Cost", get: (p) => Number(p.costScore) },
  { label: "Procurement", get: (p) => Number(p.procurementScore) },
  { label: "Risk", get: (p) => Number(p.riskScore) },
  { label: "Production", get: (p) => Number(p.productionScore) },
  { label: "Information", get: (p) => Number(p.informationScore) },
  { label: "Safety", get: (p) => Number(p.safetyScore) },
  { label: "Commercial", get: (p) => Number(p.commercialScore) },
  { label: "Resource", get: (p) => Number(p.resourceScore) },
];

interface MetricRow {
  label: string;
  get: (project: PortfolioProjectSnapshot) => number;
  format: (value: number) => string;
  better: "high" | "low" | null;
}

function compactMoney(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

const asScore = (value: number) => String(Math.round(value));
const asCount = (value: number) => String(Math.round(value * 10) / 10);

const SCORE_ROWS: MetricRow[] = AXES.map((axis) => ({
  label: `${axis.label} score`,
  get: axis.get,
  format: asScore,
  better: "high" as const,
}));

const DELIVERY_ROWS: MetricRow[] = [
  {
    label: "Schedule variance",
    get: (p) => Number(p.scheduleVarianceDays),
    format: (value) => `${value > 0 ? "+" : ""}${Math.round(value)} d`,
    better: null,
  },
  {
    label: "Forecast vs cost plan",
    get: (p) => Number(p.forecastAtCompletion) - Number(p.revisedCostPlan),
    format: (value) =>
      value === 0
        ? "On plan"
        : `${value > 0 ? "+" : "−"}${compactMoney(Math.abs(value))}`,
    better: "low",
  },
  {
    label: "Productivity index",
    get: (p) => Number(p.productivityIndex),
    format: (value) => value.toFixed(2),
    better: "high",
  },
  {
    label: "High-exposure risks",
    get: (p) => Number(p.highExposureRisks),
    format: asCount,
    better: "low",
  },
  {
    label: "Critical open issues",
    get: (p) => Number(p.criticalOpenIssues),
    format: asCount,
    better: "low",
  },
  {
    label: "Blocked work packages",
    get: (p) => Number(p.blockedWorkPackages),
    format: asCount,
    better: "low",
  },
  {
    label: "Overdue RFIs",
    get: (p) => Number(p.overdueRfis),
    format: asCount,
    better: "low",
  },
  {
    label: "Overdue payments",
    get: (p) => Number(p.overduePayments),
    format: asCount,
    better: "low",
  },
];

function bestIndexes(
  values: number[],
  better: "high" | "low" | null,
): Set<number> {
  const result = new Set<number>();

  if (!better || values.length < 2) {
    return result;
  }

  const target =
    better === "high" ? Math.max(...values) : Math.min(...values);

  if (values.every((value) => value === target)) {
    return result;
  }

  values.forEach((value, index) => {
    if (value === target) {
      result.add(index);
    }
  });

  return result;
}

function mean(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function Radar({
  average,
  colors,
  projects,
}: {
  average: number[];
  colors: string[];
  projects: PortfolioProjectSnapshot[];
}) {
  const cx = 230;
  const cy = 198;
  const radius = 132;
  const count = AXES.length;

  const angle = (index: number) =>
    -Math.PI / 2 + (index * 2 * Math.PI) / count;

  const point = (index: number, value: number): [number, number] => {
    const r = (Math.max(0, Math.min(100, value)) / 100) * radius;

    return [cx + r * Math.cos(angle(index)), cy + r * Math.sin(angle(index))];
  };

  const polygon = (values: number[]) =>
    values
      .map((value, index) => {
        const [x, y] = point(index, value);

        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");

  return (
    <svg
      aria-label="Radar chart comparing control scores of the selected projects"
      className={styles.radar}
      role="img"
      viewBox="0 0 460 400"
    >
      {[25, 50, 75, 100].map((level) => (
        <polygon
          className={styles.ring}
          key={level}
          points={polygon(AXES.map(() => level))}
        />
      ))}

      {AXES.map((axis, index) => {
        const [x, y] = point(index, 100);
        const cos = Math.cos(angle(index));
        const sin = Math.sin(angle(index));

        return (
          <g key={axis.label}>
            <line className={styles.spoke} x1={cx} x2={x} y1={cy} y2={y} />

            <text
              className={styles.axisLabel}
              textAnchor={cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle"}
              x={cx + (radius + 14) * cos}
              y={cy + (radius + 14) * sin + 4}
            >
              {axis.label}
            </text>
          </g>
        );
      })}

      <text className={styles.ringLabel} x={cx + 4} y={cy - radius * 0.5 + 3}>
        50
      </text>

      <text className={styles.ringLabel} x={cx + 4} y={cy - radius + 3}>
        100
      </text>

      <polygon
        className={styles.average}
        points={polygon(average)}
      />

      {projects.map((project, index) => {
        const values = AXES.map((axis) => axis.get(project));
        const color = colors[index] ?? "#344b42";

        return (
          <g key={project.projectId}>
            <polygon
              fill={color}
              fillOpacity="0.12"
              points={polygon(values)}
              stroke={color}
              strokeLinejoin="round"
              strokeWidth="2.2"
            />

            {values.map((value, axisIndex) => {
              const [x, y] = point(axisIndex, value);

              return (
                <circle
                  cx={x}
                  cy={y}
                  fill="#ffffff"
                  key={axisIndex}
                  r="3"
                  stroke={color}
                  strokeWidth="1.8"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

export function PortfolioCompareView() {
  const [data, setData] = useState<PortfolioExecutive | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    getPortfolioExecutive()
      .then((response) => {
        if (!cancelled) {
          setData(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "Could not load the portfolio. Check that the backend is running.",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const allProjects = useMemo(
    () =>
      [...(data?.projects ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [data],
  );

  const activeIds = useMemo(
    () => selected ?? allProjects.slice(0, 3).map((p) => p.projectId),
    [selected, allProjects],
  );

  const chosen = useMemo(
    () =>
      activeIds
        .map((id) => allProjects.find((p) => p.projectId === id))
        .filter((p): p is PortfolioProjectSnapshot => p !== undefined),
    [activeIds, allProjects],
  );

  const average = useMemo(
    () =>
      AXES.map((axis) => mean(allProjects.map((project) => axis.get(project)))),
    [allProjects],
  );

  function toggle(id: string) {
    const current = activeIds;

    if (current.includes(id)) {
      setSelected(current.filter((value) => value !== id));
    } else if (current.length < MAX_SELECTED) {
      setSelected([...current, id]);
    }
  }

  const colors = COLORS.map((color) => color as string);

  function renderRows(rows: MetricRow[], group: string) {
    return (
      <>
        <tr className={styles.groupRow}>
          <td colSpan={chosen.length + 2}>{group}</td>
        </tr>

        {rows.map((row) => {
          const values = chosen.map((project) => row.get(project));
          const best = bestIndexes(values, row.better);
          const portfolioAverage = mean(allProjects.map((p) => row.get(p)));

          return (
            <tr key={row.label}>
              <td>{row.label}</td>

              {values.map((value, index) => (
                <td
                  className={best.has(index) ? styles.best : ""}
                  key={chosen[index]?.projectId ?? index}
                >
                  {row.format(value)}
                </td>
              ))}

              <td className={styles.avgCell}>
                {allProjects.length > 0 ? row.format(portfolioAverage) : "—"}
              </td>
            </tr>
          );
        })}
      </>
    );
  }

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <div className="eyebrow">PORTFOLIO ANALYSIS</div>
            <h1>Compare projects</h1>

            <p className={styles.subtitle}>
              Select up to {MAX_SELECTED} projects to compare control scores
              and delivery indicators side by side, against the portfolio
              average.
            </p>
          </div>

          <Link className="secondary-link-button" href="/portfolio/report">
            Executive report
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && (
          <div className={styles.loading}>Loading portfolio…</div>
        )}

        {data && allProjects.length === 0 && (
          <div className={styles.loading}>
            No projects yet. Create projects to compare them.
          </div>
        )}

        {data && allProjects.length > 0 && (
          <>
            <section className={styles.panel}>
              <div className={styles.panelHead}>
                <div className="eyebrow">SELECT PROJECTS</div>

                <span className={styles.muted}>
                  {chosen.length} of {MAX_SELECTED} selected
                </span>
              </div>

              <div className={styles.chips}>
                {allProjects.map((project) => {
                  const position = activeIds.indexOf(project.projectId);
                  const isOn = position >= 0;
                  const blocked = !isOn && activeIds.length >= MAX_SELECTED;

                  return (
                    <label
                      className={`${styles.chip} ${
                        isOn ? styles.chipOn : ""
                      } ${blocked ? styles.chipOff : ""}`}
                      key={project.projectId}
                    >
                      <input
                        checked={isOn}
                        disabled={blocked}
                        onChange={() => toggle(project.projectId)}
                        type="checkbox"
                      />

                      {isOn && (
                        <i
                          className={styles.dot}
                          style={{ background: colors[position] }}
                        />
                      )}

                      <span>{project.name}</span>
                      <small>{project.code}</small>
                    </label>
                  );
                })}
              </div>
            </section>

            {chosen.length === 0 ? (
              <div className={styles.loading}>
                Select at least one project to see the comparison.
              </div>
            ) : (
              <>
                <section className={styles.overview}>
                  <div className={`${styles.panel} ${styles.radarPanel}`}>
                    <div className={styles.panelHead}>
                      <div className="eyebrow">CONTROL SCORES</div>

                      <span className={styles.legendAvg}>
                        <i /> Portfolio average
                      </span>
                    </div>

                    <Radar
                      average={average}
                      colors={colors}
                      projects={chosen}
                    />
                  </div>

                  <div className={styles.cards}>
                    {chosen.map((project, index) => (
                      <article
                        className={styles.card}
                        key={project.projectId}
                        style={{ borderTopColor: colors[index] }}
                      >
                        <div className={styles.cardTop}>
                          <div>
                            <strong>{project.name}</strong>
                            <small>
                              {project.code} · {STATUS_LABEL[project.status]}
                            </small>
                          </div>

                          <div className={styles.cardScore}>
                            {Math.round(project.healthScore)}
                          </div>
                        </div>

                        <div className={styles.cardBottom}>
                          <span
                            className={`${styles.pill} ${
                              BAND_CLASS[project.healthBand]
                            }`}
                          >
                            {BAND_LABEL[project.healthBand]}
                          </span>

                          <Link
                            className={styles.open}
                            href={`/projects/${project.projectId}`}
                          >
                            Open ↗
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHead}>
                    <div className="eyebrow">SIDE BY SIDE</div>

                    <span className={styles.muted}>
                      Best value highlighted per row
                    </span>
                  </div>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>METRIC</th>

                          {chosen.map((project, index) => (
                            <th key={project.projectId}>
                              <i
                                className={styles.dot}
                                style={{ background: colors[index] }}
                              />
                              {project.code}
                            </th>
                          ))}

                          <th>PORTFOLIO AVG</th>
                        </tr>
                      </thead>

                      <tbody>
                        {renderRows(SCORE_ROWS, "Control scores (0–100)")}
                        {renderRows(DELIVERY_ROWS, "Delivery indicators")}
                      </tbody>
                    </table>
                  </div>
                </section>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
