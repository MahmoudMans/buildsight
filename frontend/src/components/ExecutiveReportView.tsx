"use client";

import { useEffect, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getPortfolioExecutive } from "@/lib/api";
import type {
  PortfolioExceptionSeverity,
  PortfolioExecutive,
  ProjectHealthBand,
  ProjectStatus,
  SupplierConcentrationRisk,
} from "@/types/project";

import styles from "./ExecutiveReportView.module.css";

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

const SEVERITY_CLASS: Record<PortfolioExceptionSeverity, string> = {
  CRITICAL: styles.sevCritical,
  HIGH: styles.sevHigh,
  MEDIUM: styles.sevMedium,
};

const CONCENTRATION_CLASS: Record<SupplierConcentrationRisk, string> = {
  LOW: styles.bandHealthy,
  MODERATE: styles.bandWatch,
  HIGH: styles.bandRisk,
};

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

function longDate(value: string | Date): string {
  const date =
    typeof value === "string"
      ? new Date(value.length === 10 ? `${value}T00:00:00` : value)
      : value;

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? "" : "s"}`;
}

function signed(value: number, suffix: string): string {
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

function buildNarrative(data: PortfolioExecutive): string[] {
  const s = data.summary;
  const forecast = Number(s.totalForecastAtCompletion);
  const revised = Number(s.totalRevisedCostPlan);
  const gap = forecast - revised;

  const critical = data.exceptions.filter(
    (item) => item.severity === "CRITICAL",
  ).length;

  const costPosition =
    gap > 0
      ? `an overrun of ${money(gap)}`
      : gap < 0
        ? `${money(Math.abs(gap))} inside plan`
        : "exactly on plan";

  const watchPoints: Array<[number, string]> = [
    [s.criticalOpenIssues, "critical open issue"],
    [s.highExposureRisks, "high-exposure risk"],
    [s.delayedProcurementPackages, "delayed procurement package"],
    [s.blockedWorkPackages, "blocked work package"],
    [s.overdueRfis, "overdue RFI"],
    [s.criticalSafetyIncidents, "critical safety incident"],
    [s.overdueSafetyActions, "overdue safety action"],
    [s.expiredWorkPermits, "expired work permit"],
    [s.overdueChangeDecisions, "overdue change decision"],
    [s.overdueClaimResponses, "overdue claim response"],
    [s.overduePayments, "overdue payment"],
  ];

  const items = watchPoints
    .filter(([count]) => count > 0)
    .map(([count, label]) => plural(count, label));

  return [
    `The portfolio holds ${plural(s.totalProjects, "project")} (${
      s.activeProjects
    } active, ${s.planningProjects} in planning, ${s.onHoldProjects} on hold, ${
      s.completedProjects
    } completed) with a weighted health score of ${Math.round(
      s.weightedPortfolioHealthScore,
    )} out of 100, rated ${BAND_LABEL[
      s.portfolioHealthBand
    ].toLowerCase()}. ${s.healthyProjects} projects are healthy, ${
      s.watchProjects
    } are on watch and ${s.atRiskProjects} are at risk.`,

    `Forecast cost at completion is ${money(
      forecast,
    )} against a revised cost plan of ${money(revised)}, ${costPosition}. Actual costs to date total ${money(
      Number(s.totalActualCosts),
    )}, with ${money(
      Number(s.totalOutstandingCommitments),
    )} of outstanding commitments.`,

    `${plural(s.totalExceptions, "exception")} ${
      s.totalExceptions === 1 ? "is" : "are"
    } flagged across the portfolio, ${critical} of them critical.${
      items.length > 0
        ? ` Delivery watch-points: ${items.join(", ")}.`
        : " No delivery watch-points are currently flagged."
    }`,
  ];
}

function downloadScorecard(data: PortfolioExecutive) {
  const header = [
    "Code",
    "Project",
    "Client",
    "Status",
    "Health score",
    "Health band",
    "Schedule variance (days)",
    "Revised cost plan (EUR)",
    "Forecast at completion (EUR)",
    "Attention score",
  ];

  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`;

  const rows = [...data.projects]
    .sort((a, b) => a.healthScore - b.healthScore)
    .map((project) => [
      project.code,
      project.name,
      project.clientName,
      STATUS_LABEL[project.status],
      Math.round(project.healthScore),
      BAND_LABEL[project.healthBand],
      project.scheduleVarianceDays,
      Number(project.revisedCostPlan),
      Number(project.forecastAtCompletion),
      Math.round(project.attentionScore),
    ]);

  const csv = [header, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `buildsight-scorecard-${data.calculationDate.slice(
    0,
    10,
  )}.csv`;
  link.click();

  URL.revokeObjectURL(url);
}

export function ExecutiveReportView() {
  const [data, setData] = useState<PortfolioExecutive | null>(null);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    getPortfolioExecutive()
      .then((response) => {
        if (!cancelled) {
          setData(response);
          setGeneratedAt(new Date());
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

  const summary = data?.summary;
  const benchmarks = data?.benchmarks;

  const scorecard = data
    ? [...data.projects].sort((a, b) => a.healthScore - b.healthScore)
    : [];

  const exceptions = data
    ? [...data.exceptions]
        .sort((a, b) => b.priorityScore - a.priorityScore)
        .slice(0, 10)
    : [];

  const suppliers = data
    ? [...data.supplierConcentration]
        .sort(
          (a, b) =>
            b.portfolioAwardSharePercentage - a.portfolioAwardSharePercentage,
        )
        .slice(0, 5)
    : [];

  const benchmarkRows: ReadonlyArray<readonly [string, number]> = benchmarks
    ? [
        ["Health", benchmarks.averageHealthScore],
        ["Cost", benchmarks.averageCostScore],
        ["Procurement", benchmarks.averageProcurementScore],
        ["Risk", benchmarks.averageRiskScore],
        ["Production", benchmarks.averageProductionScore],
        ["Information", benchmarks.averageInformationScore],
        ["Commercial", benchmarks.averageCommercialScore],
        ["Resource", benchmarks.averageResourceScore],
      ]
    : [];

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <div className={styles.actions}>
          <div>
            <div className="eyebrow">EXECUTIVE REPORTING</div>
            <h1>Portfolio executive report</h1>
          </div>

          {data && (
            <div className={styles.buttons}>
              <button
                className="secondary-button"
                onClick={() => downloadScorecard(data)}
                type="button"
              >
                Download scorecard CSV
              </button>

              <button
                className="primary-button"
                onClick={() => window.print()}
                type="button"
              >
                Print / Save as PDF
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && (
          <div className={styles.loading}>Preparing report…</div>
        )}

        {data && summary && (
          <article className={styles.sheet}>
            <header className={styles.reportHead}>
              <div className={styles.brand}>
                <div className={styles.mark}>B</div>

                <div>
                  <strong>BuildSight</strong>
                  <span>Construction Intelligence</span>
                </div>
              </div>

              <div className={styles.meta}>
                <strong>Portfolio executive report</strong>
                <span>Data as of {longDate(data.calculationDate)}</span>
                {generatedAt && (
                  <span>Generated {longDate(generatedAt)}</span>
                )}
              </div>
            </header>

            <section className={styles.kpis}>
              <div className={`${styles.kpi} ${styles.kpiDark}`}>
                <span>PORTFOLIO HEALTH</span>
                <strong>
                  {Math.round(summary.weightedPortfolioHealthScore)}
                </strong>
                <small>{BAND_LABEL[summary.portfolioHealthBand]}</small>
              </div>

              <div className={styles.kpi}>
                <span>PROJECTS</span>
                <strong>{summary.totalProjects}</strong>
                <small>{summary.atRiskProjects} at risk</small>
              </div>

              <div className={styles.kpi}>
                <span>FORECAST AT COMPLETION</span>
                <strong>
                  {money(Number(summary.totalForecastAtCompletion))}
                </strong>
                <small>
                  Plan {money(Number(summary.totalRevisedCostPlan))}
                </small>
              </div>

              <div className={styles.kpi}>
                <span>OPEN EXCEPTIONS</span>
                <strong>{summary.totalExceptions}</strong>
                <small>Across the portfolio</small>
              </div>
            </section>

            <section className={styles.section}>
              <h2>Executive summary</h2>

              {buildNarrative(data).map((paragraph) => (
                <p className={styles.paragraph} key={paragraph}>
                  {paragraph}
                </p>
              ))}
            </section>

            <section className={styles.section}>
              <h2>Project scorecard</h2>
              <p className={styles.caption}>
                Sorted by health score, lowest first.
              </p>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>PROJECT</th>
                      <th>STATUS</th>
                      <th>HEALTH</th>
                      <th>SCHEDULE VAR.</th>
                      <th>FORECAST VS PLAN</th>
                      <th>ATTENTION</th>
                    </tr>
                  </thead>

                  <tbody>
                    {scorecard.map((project) => {
                      const gap =
                        Number(project.forecastAtCompletion) -
                        Number(project.revisedCostPlan);

                      return (
                        <tr key={project.projectId}>
                          <td>
                            <strong>{project.name}</strong>
                            <small>{project.code}</small>
                          </td>
                          <td>{STATUS_LABEL[project.status]}</td>
                          <td>
                            <span
                              className={`${styles.pill} ${
                                BAND_CLASS[project.healthBand]
                              }`}
                            >
                              {Math.round(project.healthScore)} ·{" "}
                              {BAND_LABEL[project.healthBand]}
                            </span>
                          </td>
                          <td>
                            {signed(project.scheduleVarianceDays, " d")}
                          </td>
                          <td
                            className={
                              gap > 0
                                ? styles.negative
                                : gap < 0
                                  ? styles.positive
                                  : ""
                            }
                          >
                            {gap === 0
                              ? "On plan"
                              : `${gap > 0 ? "+" : "−"}${moneyFull(
                                  Math.abs(gap),
                                )}`}
                          </td>
                          <td>{Math.round(project.attentionScore)}</td>
                        </tr>
                      );
                    })}

                    {scorecard.length === 0 && (
                      <tr>
                        <td className={styles.emptyCell} colSpan={6}>
                          No projects in the portfolio.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className={styles.section}>
              <h2>Priority exceptions</h2>
              <p className={styles.caption}>
                Top {exceptions.length} by priority score.
              </p>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>SEVERITY</th>
                      <th>PROJECT</th>
                      <th>EXCEPTION</th>
                      <th>METRIC</th>
                    </tr>
                  </thead>

                  <tbody>
                    {exceptions.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <span
                            className={`${styles.pill} ${
                              SEVERITY_CLASS[item.severity]
                            }`}
                          >
                            {item.severity}
                          </span>
                        </td>
                        <td>
                          <strong>{item.projectCode}</strong>
                          <small>{item.projectName}</small>
                        </td>
                        <td>
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                        </td>
                        <td>
                          <strong>{item.metricValue}</strong>
                          <small>{item.metricLabel}</small>
                        </td>
                      </tr>
                    ))}

                    {exceptions.length === 0 && (
                      <tr>
                        <td className={styles.emptyCell} colSpan={4}>
                          No exceptions flagged.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {suppliers.length > 0 && (
              <section className={styles.section}>
                <h2>Supplier concentration</h2>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>SUPPLIER</th>
                        <th>PACKAGES</th>
                        <th>AWARDED VALUE</th>
                        <th>SHARE</th>
                        <th>CONCENTRATION</th>
                      </tr>
                    </thead>

                    <tbody>
                      {suppliers.map((supplier) => (
                        <tr key={supplier.supplierId}>
                          <td>
                            <strong>{supplier.supplierName}</strong>
                            <small>{supplier.supplierCode}</small>
                          </td>
                          <td>{supplier.awardedPackages}</td>
                          <td>{moneyFull(Number(supplier.awardedValue))}</td>
                          <td>
                            {supplier.portfolioAwardSharePercentage.toFixed(1)}
                            %
                          </td>
                          <td>
                            <span
                              className={`${styles.pill} ${
                                CONCENTRATION_CLASS[supplier.concentrationRisk]
                              }`}
                            >
                              {supplier.concentrationRisk}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {benchmarks && (
              <section className={styles.section}>
                <h2>Portfolio benchmarks</h2>
                <p className={styles.caption}>
                  Average score per control area (0–100).
                  {benchmarks.bestHealthProjectCode &&
                    ` Strongest project: ${benchmarks.bestHealthProjectCode}.`}
                  {benchmarks.worstHealthProjectCode &&
                    ` Weakest project: ${benchmarks.worstHealthProjectCode}.`}
                </p>

                <div className={styles.bars}>
                  {benchmarkRows.map(([label, value]) => (
                    <div className={styles.barRow} key={label}>
                      <span>{label}</span>

                      <div className={styles.track}>
                        <div
                          className={styles.fill}
                          style={{
                            width: `${Math.min(100, Math.max(0, value))}%`,
                          }}
                        />
                      </div>

                      <strong>{Math.round(value)}</strong>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <footer className={styles.footer}>
              Generated by BuildSight · figures reflect the portfolio state on{" "}
              {longDate(data.calculationDate)}.
            </footer>
          </article>
        )}
      </main>
    </div>
  );
}
