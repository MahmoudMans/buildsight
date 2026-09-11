"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  BuildSightApiError,
  getPortfolioForecast,
} from "@/lib/api";

import type {
  PortfolioForecast,
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

function date(
  value: string,
): string {
  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(
    new Date(
      `${value}T00:00:00`,
    ),
  );
}

export function PortfolioForecastView() {
  const [
    data,
    setData,
  ] =
    useState<PortfolioForecast | null>(
      null,
    );

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(
    () => {
      let cancelled =
        false;

      getPortfolioForecast()
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
                  : "Unable to load portfolio forecasting.",
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
          {error ||
            "Loading portfolio forecasting..."}
        </strong>
      </main>
    );
  }

  return (
    <main className="portfolio-forecast-page">
      <header className="portfolio-forecast-header">
        <div>
          <Link
            href="/portfolio"
            className="back-link"
          >
            ← Executive portfolio
          </Link>

          <div className="eyebrow">
            ENTERPRISE PROJECT CONTROLS
          </div>

          <h1>
            Portfolio Forecast
          </h1>

          <p>
            Forward-looking earned-value,
            cost and schedule exposure across
            all BuildSight projects.
          </p>
        </div>

        <div>
          <span>
            DATA DATE
          </span>

          <strong>
            {date(
              data.dataDate,
            )}
          </strong>
        </div>
      </header>

      <section className="portfolio-forecast-kpis">
        <PortfolioKpi
          label="EXPECTED PORTFOLIO COST"
          value={currency(
            data.portfolioExpectedForecastCost,
          )}
          detail={`${currency(
            data.portfolioVarianceAtCompletion,
          )} VAC`}
          dark
        />

        <PortfolioKpi
          label="WEIGHTED CPI"
          value={data.weightedCpi.toFixed(
            2,
          )}
          detail={`${currency(
            data.portfolioActualCost,
          )} actual cost`}
        />

        <PortfolioKpi
          label="WEIGHTED SPI"
          value={data.weightedSpi.toFixed(
            2,
          )}
          detail={`${currency(
            data.portfolioEarnedValue,
          )} earned value`}
        />

        <PortfolioKpi
          label="AT-RISK PROJECTS"
          value={String(
            data.atRiskProjects,
          )}
          detail={`${data.deterioratingProjects} deteriorating`}
        />
      </section>

      <section className="forecast-card">
        <div className="forecast-card-header">
          <div>
            <div className="eyebrow">
              PREDICTIVE EXPOSURE
            </div>

            <h2>
              Project forecast ranking
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
                <th>CPI</th>
                <th>SPI</th>
                <th>BAC</th>
                <th>FORECAST COST</th>
                <th>VAC</th>
                <th>FORECAST FINISH</th>
                <th>DELAY</th>
                <th>SCORE</th>
                <th>TREND</th>
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
                        href={`/projects/${project.projectId}/forecast`}
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
                      {project.cpi.toFixed(
                        2,
                      )}
                    </td>

                    <td>
                      {project.spi.toFixed(
                        2,
                      )}
                    </td>

                    <td>
                      {currency(
                        project.bac,
                      )}
                    </td>

                    <td>
                      {currency(
                        project.expectedForecastCost,
                      )}
                    </td>

                    <td>
                      {currency(
                        project.varianceAtCompletion,
                      )}
                    </td>

                    <td>
                      {date(
                        project.expectedForecastFinishDate,
                      )}
                    </td>

                    <td>
                      {
                        project.scheduleVarianceDays
                      }
                      d
                    </td>

                    <td>
                      <strong>
                        {project.predictiveScore.toFixed(
                          0,
                        )}
                      </strong>
                    </td>

                    <td>
                      {
                        project.trend
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
          ? "forecast-kpi forecast-kpi-dark"
          : "forecast-kpi"
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
