"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  BuildSightApiError,
  getPortfolioRecovery,
} from "@/lib/api";

import type {
  PortfolioRecovery,
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

export function PortfolioRecoveryView() {
  const [
    data,
    setData,
  ] =
    useState<PortfolioRecovery | null>(
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

      getPortfolioRecovery()
        .then(
          (
            response,
          ) => {
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
                  : "Unable to load portfolio recovery.",
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
            || "Loading portfolio recovery..."}
        </strong>
      </main>
    );
  }

  return (
    <main className="portfolio-recovery-page">
      <header className="portfolio-recovery-header">
        <div>
          <Link
            href="/portfolio"
            className="back-link"
          >
            ← Executive portfolio
          </Link>

          <div className="eyebrow">
            PORTFOLIO RECOVERY
          </div>

          <h1>
            Change & Recovery Exposure
          </h1>

          <p>
            Cross-project change exposure,
            schedule impact and recovery strategy
            effectiveness.
          </p>
        </div>

        <div className="portfolio-recovery-score">
          <span>
            AVERAGE RECOVERY
          </span>

          <strong>
            {data.averageRecoveryScore.toFixed(
              0,
            )}
            /100
          </strong>
        </div>
      </header>

      <section className="recovery-kpis">
        <Kpi
          label="CHANGE COST EXPOSURE"
          value={currency(
            data.totalChangeCostExposure,
          )}
          detail={`${data.projectsWithActiveSimulations} active projects`}
          dark
        />

        <Kpi
          label="SCHEDULE IMPACT"
          value={`${data.totalScheduleImpactDays}d`}
          detail={`${data.totalRecoverableDays}d recoverable`}
        />

        <Kpi
          label="RECOVERY COST"
          value={currency(
            data.totalRecoveryCost,
          )}
          detail={`${data.totalResidualDelayDays}d residual`}
        />

        <Kpi
          label="AT-RISK PROJECTS"
          value={String(
            data.atRiskProjects,
          )}
          detail={`${data.watchProjects} watch`}
        />
      </section>

      <section className="recovery-card">
        <div className="recovery-card-header">
          <div>
            <div className="eyebrow">
              PORTFOLIO CHANGE EXPOSURE
            </div>

            <h2>
              Recovery ranking
            </h2>
          </div>

          <strong>
            {data.projectCount} projects
          </strong>
        </div>

        <div className="schedule-table-wrapper">
          <table className="schedule-table">
            <thead>
              <tr>
                <th>PROJECT</th>
                <th>ACTIVE SIMULATION</th>
                <th>COST EXPOSURE</th>
                <th>IMPACT</th>
                <th>RECOVERY OPTION</th>
                <th>RECOVERY COST</th>
                <th>RECOVERABLE</th>
                <th>RESIDUAL</th>
                <th>SCORE</th>
                <th>RISK</th>
              </tr>
            </thead>

            <tbody>
              {data.projects.map(
                (
                  project,
                ) => (
                  <tr
                    key={
                      project.projectId
                    }
                  >
                    <td>
                      <Link
                        href={`/projects/${project.projectId}/recovery`}
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
                      {project.activeSimulationNumber
                        ?? "—"}
                    </td>

                    <td>
                      {currency(
                        project.changeCostExposure,
                      )}
                    </td>

                    <td>
                      {
                        project.scheduleImpactDays
                      }
                      d
                    </td>

                    <td>
                      {project.recommendedRecoveryOptionNumber
                        ?? "—"}
                    </td>

                    <td>
                      {currency(
                        project.recoveryCost,
                      )}
                    </td>

                    <td>
                      {
                        project.recoverableDays
                      }
                      d
                    </td>

                    <td>
                      {
                        project.residualDelayDays
                      }
                      d
                    </td>

                    <td>
                      <strong>
                        {project.recoveryScore.toFixed(
                          0,
                        )}
                      </strong>
                    </td>

                    <td>
                      {
                        project.recoveryRisk
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
          ? "recovery-kpi recovery-kpi-dark"
          : "recovery-kpi"
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
