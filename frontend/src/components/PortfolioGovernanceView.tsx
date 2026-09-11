"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  BuildSightApiError,
  getPortfolioGovernance,
} from "@/lib/api";

import type {
  PortfolioGovernance,
} from "@/types/project";

export function PortfolioGovernanceView() {
  const [
    data,
    setData,
  ] =
    useState<PortfolioGovernance | null>(
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

      getPortfolioGovernance()
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
                  : "Unable to load portfolio governance.",
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
            || "Loading portfolio governance..."}
        </strong>
      </main>
    );
  }

  return (
    <main className="portfolio-governance-page">
      <header className="portfolio-governance-header">
        <div>
          <Link
            href="/portfolio"
            className="back-link"
          >
            ← Executive portfolio
          </Link>

          <div className="eyebrow">
            ENTERPRISE GOVERNANCE
          </div>

          <h1>
            Portfolio Governance
          </h1>

          <p>
            Decision discipline,
            action follow-through and meeting
            governance across the portfolio.
          </p>
        </div>

        <div className="portfolio-governance-score">
          <span>
            AVERAGE GOVERNANCE
          </span>

          <strong>
            {data.averageGovernanceScore.toFixed(
              0,
            )}
            /100
          </strong>
        </div>
      </header>

      <section className="governance-kpis">
        <PortfolioKpi
          label="OPEN ACTIONS"
          value={String(
            data.openActions,
          )}
          detail={`${data.overdueActions} overdue`}
          dark
        />

        <PortfolioKpi
          label="BLOCKED"
          value={String(
            data.blockedActions,
          )}
          detail={`${data.criticalOpenActions} critical open`}
        />

        <PortfolioKpi
          label="PENDING DECISIONS"
          value={String(
            data.pendingDecisions,
          )}
          detail={`${data.overdueDecisions} overdue`}
        />

        <PortfolioKpi
          label="AT-RISK PROJECTS"
          value={String(
            data.atRiskProjects,
          )}
          detail={`${data.meetingsWithoutMinutes} missing minutes`}
        />
      </section>

      <section className="governance-card">
        <div className="governance-card-header">
          <div>
            <div className="eyebrow">
              GOVERNANCE EXPOSURE
            </div>

            <h2>
              Project governance ranking
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
                <th>SCORE</th>
                <th>RISK</th>
                <th>OPEN ACTIONS</th>
                <th>OVERDUE</th>
                <th>CRITICAL</th>
                <th>BLOCKED</th>
                <th>PENDING DECISIONS</th>
                <th>MINUTES GAPS</th>
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
                        href={`/projects/${project.projectId}/governance`}
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
                      <strong>
                        {project.governanceScore.toFixed(
                          0,
                        )}
                      </strong>
                    </td>

                    <td>
                      {
                        project.governanceRisk
                      }
                    </td>

                    <td>
                      {
                        project.openActions
                      }
                    </td>

                    <td>
                      {
                        project.overdueActions
                      }
                    </td>

                    <td>
                      {
                        project.criticalOpenActions
                      }
                    </td>

                    <td>
                      {
                        project.blockedActions
                      }
                    </td>

                    <td>
                      {
                        project.pendingDecisions
                      }
                    </td>

                    <td>
                      {
                        project.meetingsWithoutMinutes
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

function PortfolioKpi({
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
          ? "governance-kpi governance-kpi-dark"
          : "governance-kpi"
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
