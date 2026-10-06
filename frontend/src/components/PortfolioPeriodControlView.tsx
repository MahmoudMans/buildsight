"use client";

import Link from "next/link";
import { codeLabel } from "@/lib/labels";

import {
  useEffect,
  useState,
} from "react";

import {
  BuildSightApiError,
  getPortfolioPeriodControl,
} from "@/lib/api";

import type {
  PortfolioPeriodControl,
} from "@/types/project";

function currency(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    },
  ).format(
    value,
  );
}

export function PortfolioPeriodControlView() {
  const [
    data,
    setData,
  ] =
    useState<PortfolioPeriodControl | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  useEffect(
    () => {
      let cancelled =
        false;

      getPortfolioPeriodControl()
        .then(
          response => {
            if (!cancelled) {
              setData(
                response,
              );
            }
          },
        )
        .catch(
          (
            caught: unknown,
          ) => {
            if (!cancelled) {
              setError(
                caught instanceof
                  BuildSightApiError
                  ? caught.message
                  : "Unable to load portfolio period controls.",
              );
            }
          },
        );

      return () => {
        cancelled =
          true;
      };
    },
    [],
  );

  if (!data) {
    return (
      <main className="command-loading">
        <div className="loading-mark">
          B
        </div>

        <strong>
          {error
            || "Loading portfolio period controls..."}
        </strong>
      </main>
    );
  }

  return (
    <main className="portfolio-period-page">
      <header className="portfolio-period-header">
        <div>
          <Link
            href="/portfolio"
            className="back-link"
          >
            ← Executive portfolio
          </Link>

          <div className="eyebrow">
            PORTFOLIO PERIOD CONTROLS
          </div>

          <h1>
            Reporting Period Control
          </h1>

          <p>
            Cross-project baseline discipline,
            current EAC variance, schedule variance
            and period-control risk.
          </p>
        </div>

        <div className="portfolio-period-score">
          <span>
            AVERAGE CONTROL
          </span>

          <strong>
            {data.averagePeriodControlScore.toFixed(
              0,
            )}
            /100
          </strong>
        </div>
      </header>

      <section className="period-kpis">
        <Kpi
          label="APPROVED BASELINES"
          value={String(
            data.projectsWithApprovedBaseline,
          )}
          detail={`${data.projectCount} total projects`}
          dark
        />

        <Kpi
          label="OPEN PERIODS"
          value={String(
            data.projectsWithOpenPeriod,
          )}
          detail="Active reporting cycles"
        />

        <Kpi
          label="COST VARIANCE"
          value={currency(
            data.totalCostVarianceToBaseline,
          )}
          detail="Positive is favourable"
        />

        <Kpi
          label="AT-RISK PROJECTS"
          value={String(
            data.atRiskProjects,
          )}
          detail={`${data.watchProjects} watch`}
        />
      </section>

      <section className="period-card">
        <div className="period-card-header">
          <div>
            <div className="eyebrow">
              PORTFOLIO PERIOD POSITION
            </div>

            <h2>
              Control ranking
            </h2>
          </div>

          <strong>
            {data.totalFinishVarianceDays} total finish-variance days
          </strong>
        </div>

        <div className="schedule-table-wrapper">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>PROJECT</th>
                <th>BASELINE</th>
                <th>OPEN PERIOD</th>
                <th>LATEST CLOSE</th>
                <th>COST VARIANCE</th>
                <th>FINISH VAR</th>
                <th>PLAN</th>
                <th>EARNED</th>
                <th>CPI</th>
                <th>SPI</th>
                <th>SCORE</th>
                <th>RISK</th>
              </tr>
            </thead>

            <tbody>
              {data.projects.map(
                project => (
                  <tr
                    key={
                      project.projectId
                    }
                  >
                    <td>
                      <Link
                        href={`/projects/${project.projectId}/period-control`}
                        className="forecast-project-link"
                      >
                        <strong>
                          {
                            project.projectCode
                          }
                        </strong>

                        <span>
                          {
                            project.projectName
                          }
                        </span>
                      </Link>
                    </td>

                    <td>
                      {project.activeBaselineVersionCode
                        ?? "—"}
                    </td>

                    <td>
                      {project.openPeriodCode
                        ?? "—"}
                    </td>

                    <td>
                      {project.latestClosedPeriodCode
                        ?? "—"}
                    </td>

                    <td>
                      {currency(
                        project.costVarianceToBaseline,
                      )}
                    </td>

                    <td>
                      {
                        project.finishVarianceDays
                      }
                      d
                    </td>

                    <td>
                      {project.plannedProgressPercentage.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {project.earnedProgressPercentage.toFixed(
                        1,
                      )}
                      %
                    </td>

                    <td>
                      {Number(
                        project.costPerformanceIndex,
                      ).toFixed(
                        2,
                      )}
                    </td>

                    <td>
                      {Number(
                        project.schedulePerformanceIndex,
                      ).toFixed(
                        2,
                      )}
                    </td>

                    <td>
                      <strong>
                        {project.periodControlScore.toFixed(
                          0,
                        )}
                      </strong>
                    </td>

                    <td>
                      {
                        codeLabel(project.periodControlRisk)
                      }
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Kpi({
  label,
  value,
  detail,
  dark = false,
}: {
  label: string;
  value: string;
  detail: string;
  dark?: boolean;
}) {
  return (
    <article
      className={
        dark
          ? "period-kpi period-kpi-dark"
          : "period-kpi"
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {detail}
      </small>
    </article>
  );
}
