"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  BuildSightApiError,
  generatePortfolioAiBrief,
  getPortfolioAiStatus,
  getPortfolioExecutive,
  getPortfolioProjectComparison,
} from "@/lib/api";

import type {
  PortfolioAiBrief,
  PortfolioAiStatus,
  PortfolioExecutive,
  PortfolioExceptionSeverity,
  PortfolioProjectComparison,
} from "@/types/project";

function money(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "EUR",
      notation:
        Math.abs(value) >=
        1_000_000
          ? "compact"
          : "standard",
      maximumFractionDigits: 1,
    },
  ).format(
    value,
  );
}

function fullMoney(
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

function formatDate(
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

function severityClass(
  severity: PortfolioExceptionSeverity,
): string {
  return `portfolio-exception-severity severity-${severity.toLowerCase()}`;
}

function healthClass(
  health: string,
): string {
  return `portfolio-health-band health-${health
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

export function PortfolioExecutiveView() {
  const [
    executive,
    setExecutive,
  ] =
    useState<PortfolioExecutive | null>(
      null,
    );

  const [
    aiStatus,
    setAiStatus,
  ] =
    useState<PortfolioAiStatus | null>(
      null,
    );

  const [
    aiBrief,
    setAiBrief,
  ] =
    useState<PortfolioAiBrief | null>(
      null,
    );

  const [
    comparison,
    setComparison,
  ] =
    useState<PortfolioProjectComparison | null>(
      null,
    );

  const [
    comparisonProjectId,
    setComparisonProjectId,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
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

      Promise.all([
        getPortfolioExecutive(),
        getPortfolioAiStatus(),
      ])
        .then(
          ([
            executiveResponse,
            aiResponse,
          ]) => {
            if (
              cancelled
            ) {
              return;
            }

            setExecutive(
              executiveResponse,
            );

            setAiStatus(
              aiResponse,
            );

            setComparisonProjectId(
              executiveResponse.projects[
                0
              ]?.projectId ??
                "",
            );

            setError(
              "",
            );
          },
        )
        .catch(
          (
            caught: unknown,
          ) => {
            if (
              cancelled
            ) {
              return;
            }

            if (
              caught instanceof
              BuildSightApiError
            ) {
              setError(
                caught.message,
              );
            } else {
              setError(
                "BuildSight could not load portfolio intelligence.",
              );
            }
          },
        )
        .finally(
          () => {
            if (
              !cancelled
            ) {
              setLoading(
                false,
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

  async function refreshExecutive() {
    const response =
      await getPortfolioExecutive();

    setExecutive(
      response,
    );
  }

  async function loadComparison(
    projectId: string,
  ) {
    setComparisonProjectId(
      projectId,
    );

    if (
      !projectId
    ) {
      setComparison(
        null,
      );

      return;
    }

    setBusy(
      true,
    );

    setError(
      "",
    );

    try {
      setComparison(
        await getPortfolioProjectComparison(
          projectId,
        ),
      );

    } catch (
      caught
    ) {
      if (
        caught instanceof
        BuildSightApiError
      ) {
        setError(
          caught.message,
        );
      } else {
        setError(
          "Project comparison could not be loaded.",
        );
      }

    } finally {
      setBusy(
        false,
      );
    }
  }

  async function generateBrief() {
    setBusy(
      true,
    );

    setError(
      "",
    );

    try {
      setAiBrief(
        await generatePortfolioAiBrief(),
      );

      await refreshExecutive();

    } catch (
      caught
    ) {
      if (
        caught instanceof
        BuildSightApiError
      ) {
        setError(
          caught.message,
        );
      } else {
        setError(
          "The local executive AI briefing could not be generated.",
        );
      }

    } finally {
      setBusy(
        false,
      );
    }
  }

  if (
    loading
  ) {
    return (
      <main className="command-loading">
        <div className="loading-mark">
          B
        </div>

        <strong>
          Loading executive portfolio...
        </strong>
      </main>
    );
  }

  if (
    !executive
  ) {
    return (
      <main className="command-error-page">
        <div className="command-error-card">
          <div className="brand-mark">
            B
          </div>

          <h1>
            Portfolio intelligence unavailable
          </h1>

          <p>
            {error ||
              "BuildSight could not calculate portfolio intelligence."}
          </p>

          <Link
            href="/"
            className="secondary-link-button"
          >
            Back to projects
          </Link>
        </div>
      </main>
    );
  }

  const {
    summary,
    benchmarks,
    projects,
    exceptions,
    supplierConcentration,
  } = executive;

  return (
    <div className="portfolio-shell">
      <aside className="portfolio-sidebar">
        <Link
          href="/"
          className="command-brand"
        >
          <div className="brand-mark">
            B
          </div>

          <div>
            <strong>
              BuildSight
            </strong>

            <span>
              Construction Intelligence
            </span>
          </div>
        </Link>

        <div className="command-nav-label">
          EXECUTIVE PORTFOLIO
        </div>

        <nav className="command-navigation">
          <div className="command-nav-item active">
            01
            <span>
              Portfolio overview
            </span>
          </div>

          <a
            href="#exceptions"
            className="command-nav-item"
          >
            02
            <span>
              Exceptions
            </span>
          </a>

          <a
            href="#projects"
            className="command-nav-item"
          >
            03
            <span>
              Project ranking
            </span>
          </a>

          <a
            href="#benchmarks"
            className="command-nav-item"
          >
            04
            <span>
              Benchmarks
            </span>
          </a>

          <a
            href="#suppliers"
            className="command-nav-item"
          >
            05
            <span>
              Supplier exposure
            </span>
          </a>

          <a
            href="#ai-brief"
            className="command-nav-item"
          >
            AI
            <span>
              Executive brief
            </span>
          </a>
        </nav>

        <div className="command-sidebar-footer">
          <span>
            PORTFOLIO HEALTH
          </span>

          <strong>
            {summary.weightedPortfolioHealthScore.toFixed(
              0,
            )}
            /100
          </strong>

          <small>
            Budget-weighted executive
            portfolio health.
          </small>
        </div>
      </aside>

      <main className="portfolio-main">
        <header className="portfolio-topbar">
          <div>
            <Link
              href="/"
              className="back-link"
            >
              ← Project portfolio
            </Link>

            <div className="eyebrow">
              EXECUTIVE INTELLIGENCE
            </div>

            <h1>
              Portfolio Command Center
            </h1>

            <p>
              Cross-project performance,
              exceptions, capital exposure,
              supplier concentration and
              executive decision signals.
            </p>
          </div>

          <div className="portfolio-date">
            <span>
              PORTFOLIO DATE
            </span>

            <strong>
              {formatDate(
                executive.calculationDate,
              )}
            </strong>

            <i
              className={
                healthClass(
                  summary.portfolioHealthBand,
                )
              }
            >
              {
                summary.portfolioHealthBand
              }
            </i>
          </div>
        </header>

        {error && (
          <div className="command-alert">
            <strong>
              Operation not completed
            </strong>

            <span>
              {error}
            </span>
          </div>
        )}

        <section className="portfolio-kpi-grid">
          <PortfolioKpi
            label="PROJECTS"
            value={String(
              summary.totalProjects,
            )}
            detail={`${summary.activeProjects} active · ${summary.onHoldProjects} on hold`}
          />

          <PortfolioKpi
            label="REVISED COST PLAN"
            value={money(
              Number(
                summary.totalRevisedCostPlan,
              ),
            )}
            detail={`${money(
              Number(
                summary.totalActualCosts,
              ),
            )} actual`}
          />

          <PortfolioKpi
            label="FORECAST AT COMPLETION"
            value={money(
              Number(
                summary.totalForecastAtCompletion,
              ),
            )}
            detail={`VAC ${money(
              Number(
                summary.portfolioVarianceAtCompletion,
              ),
            )}`}
          />

          <PortfolioKpi
            label="EXECUTIVE EXCEPTIONS"
            value={String(
              summary.totalExceptions,
            )}
            detail={`${summary.atRiskProjects} at-risk projects`}
            emphasis
          />
        </section>

        <section className="portfolio-health-strip">
          <div className="portfolio-health-score">
            <span>
              WEIGHTED PORTFOLIO HEALTH
            </span>

            <strong>
              {summary.weightedPortfolioHealthScore.toFixed(
                1,
              )}
            </strong>

            <small>
              /100
            </small>
          </div>

          <div className="portfolio-health-breakdown">
            <HealthCount
              label="Healthy"
              value={
                summary.healthyProjects
              }
            />

            <HealthCount
              label="Watch"
              value={
                summary.watchProjects
              }
            />

            <HealthCount
              label="At risk"
              value={
                summary.atRiskProjects
              }
            />

            <HealthCount
              label="Delayed procurement"
              value={
                summary.delayedProcurementPackages
              }
            />

            <HealthCount
              label="High risks"
              value={
                summary.highExposureRisks
              }
            />

            <HealthCount
              label="Blocked fronts"
              value={
                summary.blockedWorkPackages
              }
            />

            <HealthCount
              label="Overdue RFIs"
              value={
                summary.overdueRfis
              }
            />

            <HealthCount
              label="Safety incidents"
              value={
                summary.openSafetyIncidents
              }
            />

            <HealthCount
              label="Overdue HSE actions"
              value={
                summary.overdueSafetyActions
              }
            />

            <HealthCount
              label="Expired permits"
              value={
                summary.expiredWorkPermits
              }
            />

            <HealthCount
              label="Overdue payments"
              value={
                summary.overduePayments
              }
            />

            <HealthCount
              label="Overdue certifications"
              value={
                summary.overdueCertifications
              }
            />

            <HealthCount
              label="Open claims"
              value={
                summary.openClaims
              }
            />

            <HealthCount
              label="Worker demand gap"
              value={
                summary.workerDemandGap
              }
            />

            <HealthCount
              label="Equipment demand gap"
              value={
                summary.equipmentDemandGap
              }
            />

            <HealthCount
              label="Idle equipment"
              value={
                summary.idleEquipment
              }
            />
          </div>
        </section>

        <section
          className="portfolio-panel"
          id="exceptions"
        >
          <div className="portfolio-panel-heading">
            <div>
              <div className="eyebrow">
                EXECUTIVE EXCEPTION FEED
              </div>

              <h2>
                What needs attention
              </h2>

              <p>
                Cross-domain exceptions are
                ranked by severity and
                project exposure.
              </p>
            </div>

            <strong>
              {
                exceptions.length
              }{" "}
              signals
            </strong>
          </div>

          <div className="portfolio-exception-list">
            {exceptions
              .slice(
                0,
                15,
              )
              .map(
                (
                  exception,
                ) => (
                  <Link
                    href={
                      exception.route
                    }
                    className="portfolio-exception"
                    key={
                      exception.id
                    }
                  >
                    <span
                      className={
                        severityClass(
                          exception.severity,
                        )
                      }
                    >
                      {
                        exception.severity
                      }
                    </span>

                    <div className="portfolio-exception-project">
                      <strong>
                        {
                          exception.projectCode
                        }
                      </strong>

                      <span>
                        {
                          exception.projectName
                        }
                      </span>
                    </div>

                    <div className="portfolio-exception-content">
                      <span>
                        {
                          exception.domain
                        }
                      </span>

                      <strong>
                        {
                          exception.title
                        }
                      </strong>

                      <small>
                        {
                          exception.detail
                        }
                      </small>
                    </div>

                    <div className="portfolio-exception-metric">
                      <span>
                        {
                          exception.metricLabel
                        }
                      </span>

                      <strong>
                        {
                          exception.metricValue
                        }
                      </strong>
                    </div>
                  </Link>
                ),
              )}

            {exceptions.length ===
              0 && (
              <div className="portfolio-empty">
                No material portfolio
                exceptions are currently
                detected.
              </div>
            )}
          </div>
        </section>

        <section
          className="portfolio-panel"
          id="projects"
        >
          <div className="portfolio-panel-heading">
            <div>
              <div className="eyebrow">
                PROJECT RANKING
              </div>

              <h2>
                Cross-project performance
              </h2>
            </div>

            <strong>
              {
                projects.length
              }{" "}
              projects
            </strong>
          </div>

          <div className="portfolio-table-wrapper">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>PROJECT</th>
                  <th>HEALTH</th>
                  <th>ATTENTION</th>
                  <th>REVISED PLAN</th>
                  <th>EAC</th>
                  <th>VAC</th>
                  <th>PROC DELAYS</th>
                  <th>HIGH RISKS</th>
                  <th>BLOCKED</th>
                  <th>OVERDUE RFIs</th>
                  <th>PRODUCTIVITY</th>
                </tr>
              </thead>

              <tbody>
                {projects.map(
                  (
                    project,
                  ) => (
                    <tr
                      key={
                        project.projectId
                      }
                    >
                      <td>
                        <strong>
                          #
                          {
                            project.healthRank
                          }
                        </strong>
                      </td>

                      <td>
                        <Link
                          href={`/projects/${project.projectId}`}
                          className="portfolio-project-link"
                        >
                          <strong>
                            {
                              project.code
                            }
                          </strong>

                          <span>
                            {
                              project.name
                            }
                          </span>
                        </Link>
                      </td>

                      <td>
                        <span
                          className={
                            healthClass(
                              project.healthBand,
                            )
                          }
                        >
                          {
                            project.healthScore
                          }
                          /100
                        </span>
                      </td>

                      <td>
                        <strong className={
                          project.attentionScore >=
                          70
                            ? "portfolio-attention-hot"
                            : ""
                        }>
                          {
                            project.attentionScore
                          }
                        </strong>
                      </td>

                      <td>
                        {money(
                          Number(
                            project.revisedCostPlan,
                          ),
                        )}
                      </td>

                      <td>
                        {money(
                          Number(
                            project.forecastAtCompletion,
                          ),
                        )}
                      </td>

                      <td
                        className={
                          Number(
                            project.varianceAtCompletion,
                          ) < 0
                            ? "portfolio-negative"
                            : "portfolio-positive"
                        }
                      >
                        {money(
                          Number(
                            project.varianceAtCompletion,
                          ),
                        )}
                      </td>

                      <td>
                        {
                          project.delayedProcurementPackages
                        }
                      </td>

                      <td>
                        {
                          project.highExposureRisks
                        }
                      </td>

                      <td>
                        {
                          project.blockedWorkPackages
                        }
                      </td>

                      <td>
                        {
                          project.overdueRfis
                        }
                      </td>

                      <td>
                        {project.productivityIndex.toFixed(
                          2,
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="portfolio-panel"
          id="benchmarks"
        >
          <div className="portfolio-panel-heading">
            <div>
              <div className="eyebrow">
                PORTFOLIO BENCHMARK
              </div>

              <h2>
                Average control performance
              </h2>
            </div>

            <span className="portfolio-best-worst">
              Best{" "}
              <strong>
                {
                  benchmarks.bestHealthProjectCode ??
                  "—"
                }
              </strong>
              {" · "}
              Lowest{" "}
              <strong>
                {
                  benchmarks.worstHealthProjectCode ??
                  "—"
                }
              </strong>
            </span>
          </div>

          <div className="portfolio-benchmark-grid">
            <Benchmark
              label="Overall health"
              value={
                benchmarks.averageHealthScore
              }
            />

            <Benchmark
              label="Cost"
              value={
                benchmarks.averageCostScore
              }
            />

            <Benchmark
              label="Procurement"
              value={
                benchmarks.averageProcurementScore
              }
            />

            <Benchmark
              label="Risk control"
              value={
                benchmarks.averageRiskScore
              }
            />

            <Benchmark
              label="Production"
              value={
                benchmarks.averageProductionScore
              }
            />

            <Benchmark
              label="Information"
              value={
                benchmarks.averageInformationScore
              }
            />

            <Benchmark
              label="Commercial"
              value={
                benchmarks.averageCommercialScore
              }
            />

            <Benchmark
              label="Resources"
              value={
                benchmarks.averageResourceScore
              }
            />
          </div>

          <div className="portfolio-productivity-benchmark">
            <span>
              Portfolio average productivity
              index
            </span>

            <strong>
              {benchmarks.averageProductivityIndex.toFixed(
                2,
              )}
              x
            </strong>
          </div>
        </section>

        <section className="portfolio-panel">
          <div className="portfolio-panel-heading">
            <div>
              <div className="eyebrow">
                PROJECT COMPARISON
              </div>

              <h2>
                Benchmark a project
              </h2>
            </div>

            <select
              value={
                comparisonProjectId
              }
              disabled={
                busy
              }
              onChange={(
                event,
              ) =>
                void loadComparison(
                  event.target.value,
                )
              }
              className="portfolio-project-select"
            >
              <option value="">
                Select project
              </option>

              {projects.map(
                (
                  project,
                ) => (
                  <option
                    key={
                      project.projectId
                    }
                    value={
                      project.projectId
                    }
                  >
                    {
                      project.code
                    }
                    {" — "}
                    {
                      project.name
                    }
                  </option>
                ),
              )}
            </select>
          </div>

          {comparison && (
            <div className="portfolio-comparison">
              <div className="portfolio-comparison-rank">
                <span>
                  HEALTH RANK
                </span>

                <strong>
                  #
                  {
                    comparison.healthRank
                  }
                </strong>

                <small>
                  {comparison.healthPercentile.toFixed(
                    0,
                  )}
                  th percentile
                </small>
              </div>

              <div className="portfolio-comparison-grid">
                {comparison.metrics.map(
                  (
                    metric,
                  ) => (
                    <article
                      key={
                        metric.metric
                      }
                    >
                      <span>
                        {
                          metric.metric
                        }
                      </span>

                      <strong>
                        {
                          metric.projectValue
                        }
                        {
                          metric.unit
                        }
                      </strong>

                      <small>
                        Portfolio{" "}
                        {
                          metric.portfolioAverage
                        }
                        {
                          metric.unit
                        }
                      </small>

                      <i
                        className={
                          metric.favorable
                            ? "comparison-positive"
                            : "comparison-negative"
                        }
                      >
                        {metric.delta >
                        0
                          ? "+"
                          : ""}
                        {
                          metric.delta
                        }
                        {" vs avg"}
                      </i>
                    </article>
                  ),
                )}
              </div>
            </div>
          )}
        </section>

        <section
          className="portfolio-panel"
          id="suppliers"
        >
          <div className="portfolio-panel-heading">
            <div>
              <div className="eyebrow">
                SUPPLIER CONCENTRATION
              </div>

              <h2>
                Awarded portfolio exposure
              </h2>

              <p>
                Concentration is calculated
                from awarded procurement
                value across all projects.
              </p>
            </div>
          </div>

          <div className="portfolio-table-wrapper">
            <table className="portfolio-table supplier-table">
              <thead>
                <tr>
                  <th>SUPPLIER</th>
                  <th>TYPE</th>
                  <th>AWARDS</th>
                  <th>AWARDED VALUE</th>
                  <th>PORTFOLIO SHARE</th>
                  <th>CONCENTRATION</th>
                </tr>
              </thead>

              <tbody>
                {supplierConcentration.map(
                  (
                    supplier,
                  ) => (
                    <tr
                      key={
                        supplier.supplierId
                      }
                    >
                      <td>
                        <div className="portfolio-project-link">
                          <strong>
                            {
                              supplier.supplierCode
                            }
                          </strong>

                          <span>
                            {
                              supplier.supplierName
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {
                          supplier.supplierType
                        }
                      </td>

                      <td>
                        {
                          supplier.awardedPackages
                        }
                      </td>

                      <td>
                        {fullMoney(
                          Number(
                            supplier.awardedValue,
                          ),
                        )}
                      </td>

                      <td>
                        <div className="supplier-share">
                          <strong>
                            {supplier.portfolioAwardSharePercentage.toFixed(
                              1,
                            )}
                            %
                          </strong>

                          <div>
                            <span
                              style={{
                                width: `${Math.min(
                                  100,
                                  supplier.portfolioAwardSharePercentage,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className={`supplier-risk supplier-risk-${supplier.concentrationRisk.toLowerCase()}`}>
                          {
                            supplier.concentrationRisk
                          }
                        </span>
                      </td>
                    </tr>
                  ),
                )}

                {supplierConcentration.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        6
                      }
                    >
                      <div className="table-message">
                        No awarded supplier
                        exposure exists yet.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="portfolio-ai-panel"
          id="ai-brief"
        >
          <div className="portfolio-ai-heading">
            <div>
              <div className="eyebrow">
                LOCAL EXECUTIVE AI
              </div>

              <h2>
                Portfolio briefing
              </h2>

              <p>
                BuildSight can synthesize
                the portfolio using the
                same local Ollama grounding
                policy used by the project
                copilot.
              </p>
            </div>

            <div className="portfolio-ai-controls">
              <span
                className={
                  aiStatus?.ready
                    ? "portfolio-ai-ready ready"
                    : "portfolio-ai-ready"
                }
              >
                {aiStatus?.ready
                  ? "LOCAL AI READY"
                  : "AI SETUP REQUIRED"}
              </span>

              <button
                type="button"
                disabled={
                  busy
                  ||
                  !aiStatus?.ready
                }
                onClick={() =>
                  void generateBrief()
                }
              >
                {busy
                  ? "Analyzing..."
                  : "Generate executive brief"}
              </button>
            </div>
          </div>

          {!aiStatus?.ready && (
            <div className="portfolio-ai-message">
              {aiStatus?.message}
              {" "}
              Run{" "}
              <code>
                ./scripts/ai-models-pull.sh
              </code>
              {" "}
              if the local models have not
              been installed.
            </div>
          )}

          {aiBrief && (
            <div className="portfolio-ai-answer">
              <div className="portfolio-ai-answer-meta">
                <span>
                  {
                    aiBrief.chatModel
                  }
                </span>

                <strong
                  className={
                    aiBrief.grounded
                      ? "grounded"
                      : ""
                  }
                >
                  {aiBrief.grounded
                    ? "CITATION VERIFIED"
                    : "DRAFT DISCARDED"}
                </strong>
              </div>

              <div className="portfolio-ai-answer-text">
                {
                  aiBrief.answer
                }
              </div>

              <div className="portfolio-ai-sources">
                {aiBrief.sources.map(
                  (
                    source,
                  ) => (
                    <article
                      key={
                        source.citation
                      }
                    >
                      <strong>
                        {
                          source.citation
                        }
                      </strong>

                      <span>
                        {
                          source.projectCode
                        }
                      </span>

                      <small>
                        {
                          source.projectName
                        }
                      </small>
                    </article>
                  ),
                )}
              </div>
            </div>
          )}
        </section>

        <footer className="command-footer">
          <div>
            BuildSight · Executive Portfolio
          </div>

          <div>
            {summary.totalProjects} projects
            {" · "}
            {summary.totalExceptions} exceptions
            {" · "}
            {money(
              Number(
                summary.totalRevisedCostPlan,
              ),
            )} controlled value
          </div>
        </footer>
      </main>
    </div>
  );
}

function PortfolioKpi({
  label,
  value,
  detail,
  emphasis = false,
}: {
  label: string;
  value: string;
  detail: string;
  emphasis?: boolean;
}) {
  return (
    <article
      className={
        emphasis
          ? "portfolio-kpi portfolio-kpi-emphasis"
          : "portfolio-kpi"
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

function HealthCount({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function Benchmark({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <article className="portfolio-benchmark">
      <div>
        <span>
          {label}
        </span>

        <strong>
          {value.toFixed(
            1,
          )}
        </strong>
      </div>

      <div className="portfolio-benchmark-track">
        <span
          style={{
            width: `${Math.min(
              100,
              Math.max(
                0,
                value,
              ),
            )}%`,
          }}
        />
      </div>
    </article>
  );
}
