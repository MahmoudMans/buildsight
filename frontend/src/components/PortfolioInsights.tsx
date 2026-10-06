"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { getPortfolioExecutive } from "@/lib/api";
import type {
  PortfolioException,
  PortfolioExecutive,
  ProjectHealthBand,
} from "@/types/project";

import styles from "./PortfolioInsights.module.css";

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const BAND_COLOR: Record<ProjectHealthBand, string> = {
  HEALTHY: "#3f8a68",
  WATCH: "#d1a13a",
  AT_RISK: "#b5493e",
};

function compact(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string): string {
  const date = new Date(
    value.length === 10 ? `${value}T00:00:00` : value,
  );

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function exceptionHref(item: PortfolioException): string {
  return item.route?.startsWith("/")
    ? item.route
    : `/projects/${item.projectId}`;
}

function Donut({
  healthy,
  watch,
  atRisk,
  score,
}: {
  healthy: number;
  watch: number;
  atRisk: number;
  score: number;
}) {
  const total = healthy + watch + atRisk;

  const arcs = [
    { value: healthy, color: BAND_COLOR.HEALTHY },
    { value: watch, color: BAND_COLOR.WATCH },
    { value: atRisk, color: BAND_COLOR.AT_RISK },
  ].reduce<
    {
      color: string;
      length: number;
      offset: number;
    }[]
  >((accumulator, segment) => {
    const previous = accumulator[accumulator.length - 1];

    accumulator.push({
      color: segment.color,
      length: total > 0 ? (segment.value / total) * CIRCUMFERENCE : 0,
      offset: previous ? previous.offset + previous.length : 0,
    });

    return accumulator;
  }, []);

  return (
    <svg
      aria-label={`Portfolio health score ${Math.round(score)}`}
      className={styles.donut}
      role="img"
      viewBox="0 0 120 120"
    >
      <circle
        cx="60"
        cy="60"
        fill="none"
        r={RADIUS}
        stroke="#e8ebe7"
        strokeWidth="14"
      />

      {arcs.map((arc, position) =>
        arc.length > 0 ? (
          <circle
            cx="60"
            cy="60"
            fill="none"
            key={position}
            r={RADIUS}
            stroke={arc.color}
            strokeDasharray={`${arc.length} ${
              CIRCUMFERENCE - arc.length
            }`}
            strokeDashoffset={-arc.offset}
            strokeWidth="14"
            transform="rotate(-90 60 60)"
          />
        ) : null,
      )}

      <text
        className={styles.donutScore}
        textAnchor="middle"
        x="60"
        y="62"
      >
        {Math.round(score)}
      </text>

      <text
        className={styles.donutLabel}
        textAnchor="middle"
        x="60"
        y="76"
      >
        HEALTH
      </text>
    </svg>
  );
}

export function PortfolioInsights() {
  const [data, setData] = useState<PortfolioExecutive | null>(null);
  const [failed, setFailed] = useState(false);

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
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (failed) {
    return null;
  }

  if (!data) {
    return (
      <section
        aria-busy="true"
        aria-label="Loading portfolio insights"
        className={styles.skeleton}
      />
    );
  }

  const { summary } = data;

  const ranked = [...data.projects]
    .sort((a, b) => a.healthScore - b.healthScore)
    .slice(0, 5);

  const exceptions = [...data.exceptions]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 6);

  const forecast = Number(summary.totalForecastAtCompletion);
  const revised = Number(summary.totalRevisedCostPlan);

  const finance = [
    {
      label: "Approved budget",
      value: Number(summary.totalApprovedBudget),
      tone: styles.fillBase,
    },
    {
      label: "Revised cost plan",
      value: revised,
      tone: styles.fillBase,
    },
    {
      label: "Forecast at completion",
      value: forecast,
      tone: forecast > revised ? styles.fillBad : styles.fillGood,
    },
    {
      label: "Actual costs to date",
      value: Number(summary.totalActualCosts),
      tone: styles.fillBase,
    },
  ];

  const maxValue = Math.max(...finance.map((row) => row.value), 1);
  const variance = Number(summary.portfolioVarianceAtCompletion);

  const legend = [
    {
      label: "Healthy",
      value: summary.healthyProjects,
      color: BAND_COLOR.HEALTHY,
    },
    {
      label: "Watch",
      value: summary.watchProjects,
      color: BAND_COLOR.WATCH,
    },
    {
      label: "At risk",
      value: summary.atRiskProjects,
      color: BAND_COLOR.AT_RISK,
    },
  ];

  return (
    <section aria-label="Portfolio insights" className={styles.root}>
      <div className={styles.grid}>
        <article className={styles.card}>
          <header className={styles.head}>
            <div>
              <div className={styles.eyebrow}>HEALTH MIX</div>
              <h3 className={styles.title}>Portfolio health</h3>
            </div>

            <span className={styles.muted}>
              As of {formatDate(data.calculationDate)}
            </span>
          </header>

          <div className={styles.donutRow}>
            <Donut
              atRisk={summary.atRiskProjects}
              healthy={summary.healthyProjects}
              score={summary.weightedPortfolioHealthScore}
              watch={summary.watchProjects}
            />

            <ul className={styles.legend}>
              {legend.map((row) => (
                <li className={styles.legendRow} key={row.label}>
                  <span
                    className={styles.dot}
                    style={{ background: row.color }}
                  />
                  {row.label}
                  <strong>{row.value}</strong>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <article className={styles.card}>
          <header className={styles.head}>
            <div>
              <div className={styles.eyebrow}>PRIORITY</div>
              <h3 className={styles.title}>Lowest health scores</h3>
            </div>
          </header>

          {ranked.length === 0 ? (
            <p className={styles.empty}>No projects yet.</p>
          ) : (
            <ul className={styles.rankList}>
              {ranked.map((project) => (
                <li key={project.projectId}>
                  <Link
                    className={styles.rankLink}
                    href={`/projects/${project.projectId}`}
                  >
                    <div className={styles.rankTop}>
                      <span>{project.name}</span>
                      <strong>{Math.round(project.healthScore)}</strong>
                    </div>

                    <div className={styles.track}>
                      <div
                        className={styles.fill}
                        style={{
                          background: BAND_COLOR[project.healthBand],
                          width: `${Math.min(
                            100,
                            Math.max(0, project.healthScore),
                          )}%`,
                        }}
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={styles.card}>
          <header className={styles.head}>
            <div>
              <div className={styles.eyebrow}>COST POSITION</div>
              <h3 className={styles.title}>Budget vs forecast</h3>
            </div>
          </header>

          <ul className={styles.financeList}>
            {finance.map((row) => (
              <li key={row.label}>
                <div className={styles.rankTop}>
                  <span>{row.label}</span>
                  <strong>{compact(row.value)}</strong>
                </div>

                <div className={styles.track}>
                  <div
                    className={`${styles.fill} ${row.tone}`}
                    style={{ width: `${(row.value / maxValue) * 100}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>

          <p
            className={`${styles.variance} ${
              variance < 0 ? styles.negative : styles.positive
            }`}
          >
            Variance at completion: {compact(variance)}
          </p>
        </article>
      </div>

      <article className={styles.card}>
        <header className={styles.head}>
          <div>
            <div className={styles.eyebrow}>NEEDS ATTENTION</div>
            <h3 className={styles.title}>Top portfolio exceptions</h3>
          </div>

          <div className={styles.headActions}>
            <span className={styles.muted}>
              {summary.totalExceptions} total
            </span>

            <Link className={styles.reportLink} href="/portfolio/report">
              Executive report ↗
            </Link>
          </div>
        </header>

        {exceptions.length === 0 ? (
          <p className={styles.empty}>
            No exceptions flagged across the portfolio.
          </p>
        ) : (
          <ul className={styles.exceptionList}>
            {exceptions.map((item) => (
              <li key={item.id}>
                <Link
                  className={styles.exception}
                  href={exceptionHref(item)}
                >
                  <span
                    className={`${styles.pill} ${
                      styles[`sev${item.severity}`]
                    }`}
                  >
                    {item.severity}
                  </span>

                  <div className={styles.exceptionBody}>
                    <strong>{item.title}</strong>
                    <small>
                      {item.projectCode} · {item.projectName} —{" "}
                      {item.detail}
                    </small>
                  </div>

                  <div className={styles.metric}>
                    <span>{item.metricLabel}</span>
                    <strong>{item.metricValue}</strong>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
}
