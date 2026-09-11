"use client";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  approveForecastScenario,
  archiveForecastScenario,
  BuildSightApiError,
  captureEvmSnapshot,
  createForecastScenario,
  getProjectForecast,
} from "@/lib/api";

import type {
  CreateForecastScenarioInput,
  ForecastControl,
  ForecastRiskLevel,
  ForecastScenario,
  ForecastScenarioType,
} from "@/types/project";

const scenarioDefaults: CreateForecastScenarioInput = {
  name: "",
  scenarioType: "CUSTOM",

  costAdjustmentPercentage: 0,
  scheduleAdjustmentDays: 0,

  productivityMultiplier: 1,
  procurementDelayDays: 0,

  commercialExposurePercentage: 0,
  riskContingencyPercentage: 3,

  resourceCapacityMultiplier: 1,

  notes: "",
};

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
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

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

function riskClass(
  value: ForecastRiskLevel,
): string {
  return value
    .toLowerCase()
    .replaceAll(
      "_",
      "-",
    );
}

export function ProjectForecastControlView({
  projectId,
}: {
  projectId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<ForecastControl | null>(
      null,
    );

  const [
    form,
    setForm,
  ] =
    useState<CreateForecastScenarioInput>(
      scenarioDefaults,
    );

  const [
    showForm,
    setShowForm,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectForecast(
        projectId,
      )
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
            if (
              !cancelled
            ) {
              setError(
                caught instanceof
                  BuildSightApiError
                  ? caught.message
                  : "Unable to load predictive project controls.",
              );
            }
          },
        )
        .finally(
          () => {
            if (!cancelled) {
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
    [projectId],
  );

  async function refresh() {
    setData(
      await getProjectForecast(
        projectId,
      ),
    );
  }

  async function action(
    callback: () => Promise<unknown>,
  ) {
    setBusy(
      true,
    );

    setError(
      "",
    );

    try {
      await callback();
      await refresh();

      return true;

    } catch (
      caught
    ) {
      setError(
        caught instanceof
          BuildSightApiError
          ? caught.message
          : "The forecast-control operation failed.",
      );

      return false;

    } finally {
      setBusy(
        false,
      );
    }
  }

  async function submitScenario(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await action(
        () =>
          createForecastScenario(
            projectId,
            form,
          ),
      )
    ) {
      setForm(
        scenarioDefaults,
      );

      setShowForm(
        false,
      );
    }
  }

  async function approve(
    scenario: ForecastScenario,
  ) {
    await action(
      () =>
        approveForecastScenario(
          projectId,
          scenario.id,
        ),
    );
  }

  async function archive(
    scenario: ForecastScenario,
  ) {
    await action(
      () =>
        archiveForecastScenario(
          projectId,
          scenario.id,
        ),
    );
  }

  if (loading) {
    return (
      <main className="command-loading">
        <div className="loading-mark">
          B
        </div>

        <strong>
          Loading predictive controls...
        </strong>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="command-error-page">
        <div className="command-error-card">
          <div className="brand-mark">
            B
          </div>

          <h1>
            Forecast intelligence unavailable
          </h1>

          <p>
            {error}
          </p>

          <Link
            href={`/projects/${projectId}`}
            className="secondary-link-button"
          >
            Back to project
          </Link>
        </div>
      </main>
    );
  }

  const {
    project,
    intelligence,
    scenarios,
    history,
  } = data;

  return (
    <div className="forecast-shell">
      <aside className="forecast-sidebar">
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
          PROJECT CONTROLS
        </div>

        <nav className="command-navigation">
          <Link
            href={`/projects/${projectId}`}
            className="command-nav-item"
          >
            01
            <span>
              Command center
            </span>
          </Link>

          <Link
            href={`/projects/${projectId}/schedule`}
            className="command-nav-item"
          >
            02
            <span>
              Schedule
            </span>
          </Link>

          <div className="command-nav-item active">
            03
            <span>
              Forecast
            </span>
          </div>

          <a
            href="#evm"
            className="command-nav-item"
          >
            04
            <span>
              Earned value
            </span>
          </a>

          <a
            href="#scenarios"
            className="command-nav-item"
          >
            05
            <span>
              Scenarios
            </span>
          </a>

          <a
            href="#history"
            className="command-nav-item"
          >
            06
            <span>
              History
            </span>
          </a>

          <Link
            href="/portfolio/forecast"
            className="command-nav-item"
          >
            07
            <span>
              Portfolio forecast
            </span>
          </Link>

          <Link
            href={`/projects/${projectId}/governance`}
            className="command-nav-item"
          >
            08
            <span>
              Governance
            </span>
          </Link>
        </nav>

        <div className="command-sidebar-footer">
          <span>
            PREDICTIVE CONTROL
          </span>

          <strong>
            {project.code}
          </strong>

          <small>
            EVM, scenario planning and
            forecast deterioration.
          </small>
        </div>
      </aside>

      <main className="forecast-main">
        <header className="forecast-header">
          <div>
            <Link
              href={`/projects/${projectId}`}
              className="back-link"
            >
              ← Project command center
            </Link>

            <div className="eyebrow">
              {project.code}
              {" · "}
              PREDICTIVE PROJECT CONTROLS
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Earned-value performance,
              cost-to-complete forecasting,
              CPM completion exposure and
              management scenarios.
            </p>
          </div>

          <div className="forecast-score">
            <span>
              PREDICTIVE SCORE
            </span>

            <strong>
              {intelligence.predictiveScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={`forecast-risk forecast-risk-${riskClass(
                intelligence.predictiveRisk,
              )}`}
            >
              {intelligence.predictiveRisk.replaceAll(
                "_",
                " ",
              )}
            </i>

            <small>
              Trend:{" "}
              {intelligence.trend.replaceAll(
                "_",
                " ",
              )}
            </small>
          </div>
        </header>

        <div className="forecast-health-note">
          <strong>
            Health architecture
          </strong>

          <span>
            Project Health remains v11.
            Predictive Score is a separate
            forward-looking overlay to avoid
            double-counting cost and schedule risk.
          </span>
        </div>

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

        <section className="forecast-kpis">
          <Kpi
            label="EXPECTED COST"
            value={currency(
              intelligence.expectedForecastCost,
            )}
            detail={`${currency(
              intelligence.costForecastLower,
            )} → ${currency(
              intelligence.costForecastUpper,
            )}`}
            dark
          />

          <Kpi
            label="EXPECTED FINISH"
            value={date(
              intelligence.expectedForecastFinishDate,
            )}
            detail={`${date(
              intelligence.earliestForecastFinishDate,
            )} → ${date(
              intelligence.latestForecastFinishDate,
            )}`}
          />

          <Kpi
            label="CPI"
            value={intelligence.cpi.toFixed(
              2,
            )}
            detail={
              intelligence.cpi >= 1
                ? "Cost efficient"
                : "Cost pressure"
            }
          />

          <Kpi
            label="SPI"
            value={intelligence.spi.toFixed(
              2,
            )}
            detail={
              intelligence.spi >= 1
                ? "Ahead / on plan"
                : "Behind planned value"
            }
          />
        </section>

        <section
          className="forecast-card"
          id="evm"
        >
          <Header
            eyebrow="EARNED VALUE MANAGEMENT"
            title="Current control position"
            value={date(
              intelligence.dataDate,
            )}
          />

          <div className="evm-grid">
            <Metric
              label="BAC"
              value={currency(
                intelligence.bac,
              )}
            />

            <Metric
              label="PV"
              value={currency(
                intelligence.plannedValue,
              )}
            />

            <Metric
              label="EV"
              value={currency(
                intelligence.earnedValue,
              )}
            />

            <Metric
              label="AC"
              value={currency(
                intelligence.actualCost,
              )}
            />

            <Metric
              label="CV"
              value={currency(
                intelligence.costVariance,
              )}
              negative={
                intelligence.costVariance <
                0
              }
            />

            <Metric
              label="SV"
              value={currency(
                intelligence.scheduleVariance,
              )}
              negative={
                intelligence.scheduleVariance <
                0
              }
            />

            <Metric
              label="EAC"
              value={currency(
                intelligence.estimateAtCompletion,
              )}
            />

            <Metric
              label="ETC"
              value={currency(
                intelligence.estimateToComplete,
              )}
            />

            <Metric
              label="VAC"
              value={currency(
                intelligence.varianceAtCompletion,
              )}
              negative={
                intelligence.varianceAtCompletion <
                0
              }
            />

            <Metric
              label="TCPI"
              value={intelligence.tcpi.toFixed(
                2,
              )}
            />

            <Metric
              label="Planned progress"
              value={`${intelligence.plannedProgressPercentage.toFixed(
                1,
              )}%`}
            />

            <Metric
              label="Earned progress"
              value={`${intelligence.earnedProgressPercentage.toFixed(
                1,
              )}%`}
            />
          </div>

          <p className="forecast-explanation">
            {intelligence.explanation}
          </p>
        </section>

        <section className="forecast-actions">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void action(
                () =>
                  captureEvmSnapshot(
                    projectId,
                  ),
              )
            }
          >
            Capture today&apos;s EVM snapshot
          </button>

          <button
            type="button"
            onClick={() =>
              setShowForm(
                !showForm,
              )
            }
          >
            + Forecast scenario
          </button>
        </section>

        {showForm && (
          <section className="forecast-card">
            <Header
              eyebrow="WHAT-IF ANALYSIS"
              title="Create forecast scenario"
              value="Deterministic scenario"
            />

            <form
              className="forecast-form"
              onSubmit={
                submitScenario
              }
            >
              <Field
                label="Scenario name"
                full
              >
                <input
                  required
                  value={
                    form.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,
                      name:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Type">
                <select
                  value={
                    form.scenarioType
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,
                      scenarioType:
                        event.target.value as ForecastScenarioType,
                    })
                  }
                >
                  <option value="BASE">
                    Base
                  </option>

                  <option value="OPTIMISTIC">
                    Optimistic
                  </option>

                  <option value="PESSIMISTIC">
                    Pessimistic
                  </option>

                  <option value="CUSTOM">
                    Custom
                  </option>
                </select>
              </Field>

              <NumberField
                label="Cost adjustment %"
                value={
                  form.costAdjustmentPercentage
                }
                onChange={(
                  value,
                ) =>
                  setForm({
                    ...form,
                    costAdjustmentPercentage:
                      value,
                  })
                }
              />

              <NumberField
                label="Schedule adjustment days"
                value={
                  form.scheduleAdjustmentDays
                }
                onChange={(
                  value,
                ) =>
                  setForm({
                    ...form,
                    scheduleAdjustmentDays:
                      value,
                  })
                }
              />

              <NumberField
                label="Productivity multiplier"
                value={
                  form.productivityMultiplier
                }
                step="0.01"
                onChange={(
                  value,
                ) =>
                  setForm({
                    ...form,
                    productivityMultiplier:
                      value,
                  })
                }
              />

              <NumberField
                label="Procurement delay days"
                value={
                  form.procurementDelayDays
                }
                onChange={(
                  value,
                ) =>
                  setForm({
                    ...form,
                    procurementDelayDays:
                      value,
                  })
                }
              />

              <NumberField
                label="Commercial exposure %"
                value={
                  form.commercialExposurePercentage
                }
                onChange={(
                  value,
                ) =>
                  setForm({
                    ...form,
                    commercialExposurePercentage:
                      value,
                  })
                }
              />

              <NumberField
                label="Risk contingency %"
                value={
                  form.riskContingencyPercentage
                }
                onChange={(
                  value,
                ) =>
                  setForm({
                    ...form,
                    riskContingencyPercentage:
                      value,
                  })
                }
              />

              <NumberField
                label="Resource capacity multiplier"
                value={
                  form.resourceCapacityMultiplier
                }
                step="0.01"
                onChange={(
                  value,
                ) =>
                  setForm({
                    ...form,
                    resourceCapacityMultiplier:
                      value,
                  })
                }
              />

              <Field
                label="Notes"
                full
              >
                <textarea
                  rows={3}
                  value={
                    form.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,
                      notes:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <div className="form-actions field-full">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setShowForm(
                      false,
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    busy
                  }
                >
                  Save scenario
                </button>
              </div>
            </form>
          </section>
        )}

        <section
          className="forecast-card"
          id="scenarios"
        >
          <Header
            eyebrow="SCENARIO PLANNING"
            title="Management forecast scenarios"
            value={`${scenarios.length} scenarios`}
          />

          <div className="scenario-grid">
            {scenarios.map(
              (
                scenario,
              ) => (
                <article
                  className={`scenario-card scenario-${scenario.status.toLowerCase()}`}
                  key={
                    scenario.id
                  }
                >
                  <div className="scenario-card-header">
                    <div>
                      <span>
                        {
                          scenario.scenarioType
                        }
                      </span>

                      <h3>
                        {
                          scenario.name
                        }
                      </h3>
                    </div>

                    <i>
                      {
                        scenario.status
                      }
                    </i>
                  </div>

                  <div className="scenario-values">
                    <Metric
                      label="Expected cost"
                      value={currency(
                        scenario.evaluation.expectedCost,
                      )}
                    />

                    <Metric
                      label="Cost impact"
                      value={currency(
                        scenario.evaluation.costImpactVsCurrent,
                      )}
                      negative={
                        scenario.evaluation.costImpactVsCurrent >
                        0
                      }
                    />

                    <Metric
                      label="Expected finish"
                      value={date(
                        scenario.evaluation.expectedFinishDate,
                      )}
                    />

                    <Metric
                      label="Finish impact"
                      value={`${scenario.evaluation.finishImpactDays}d`}
                      negative={
                        scenario.evaluation.finishImpactDays >
                        0
                      }
                    />
                  </div>

                  <div className="scenario-score">
                    <span>
                      Scenario score
                    </span>

                    <strong>
                      {scenario.evaluation.scenarioScore.toFixed(
                        0,
                      )}
                    </strong>

                    <i
                      className={`forecast-risk forecast-risk-${riskClass(
                        scenario.evaluation.scenarioRisk,
                      )}`}
                    >
                      {
                        scenario.evaluation.scenarioRisk
                      }
                    </i>
                  </div>

                  <div className="scenario-assumptions">
                    <span>
                      Cost{" "}
                      {scenario.costAdjustmentPercentage}
                      %
                    </span>

                    <span>
                      Schedule{" "}
                      {scenario.scheduleAdjustmentDays}
                      d
                    </span>

                    <span>
                      Productivity{" "}
                      {scenario.productivityMultiplier}
                      x
                    </span>

                    <span>
                      Procurement{" "}
                      {scenario.procurementDelayDays}
                      d
                    </span>

                    <span>
                      Resource{" "}
                      {scenario.resourceCapacityMultiplier}
                      x
                    </span>
                  </div>

                  <div className="scenario-actions">
                    {scenario.status ===
                      "DRAFT" && (
                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void approve(
                            scenario,
                          )
                        }
                      >
                        Approve
                      </button>
                    )}

                    {scenario.status !==
                      "ARCHIVED" && (
                      <button
                        type="button"
                        disabled={
                          busy
                        }
                        onClick={() =>
                          void archive(
                            scenario,
                          )
                        }
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </article>
              ),
            )}
          </div>
        </section>

        <section
          className="forecast-card"
          id="history"
        >
          <Header
            eyebrow="FORECAST HISTORY"
            title="EVM snapshots"
            value={`${history.length} snapshots`}
          />

          <div className="schedule-table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>PV</th>
                  <th>EV</th>
                  <th>AC</th>
                  <th>CPI</th>
                  <th>SPI</th>
                  <th>EAC</th>
                  <th>VAC</th>
                  <th>FINISH</th>
                  <th>SCORE</th>
                </tr>
              </thead>

              <tbody>
                {history.map(
                  (
                    snapshot,
                  ) => (
                    <tr
                      key={
                        snapshot.id
                      }
                    >
                      <td>
                        {date(
                          snapshot.dataDate,
                        )}
                      </td>

                      <td>
                        {currency(
                          snapshot.plannedValue,
                        )}
                      </td>

                      <td>
                        {currency(
                          snapshot.earnedValue,
                        )}
                      </td>

                      <td>
                        {currency(
                          snapshot.actualCost,
                        )}
                      </td>

                      <td>
                        {snapshot.cpi.toFixed(
                          2,
                        )}
                      </td>

                      <td>
                        {snapshot.spi.toFixed(
                          2,
                        )}
                      </td>

                      <td>
                        {currency(
                          snapshot.estimateAtCompletion,
                        )}
                      </td>

                      <td>
                        {currency(
                          snapshot.varianceAtCompletion,
                        )}
                      </td>

                      <td>
                        {date(
                          snapshot.forecastFinishDate,
                        )}
                      </td>

                      <td>
                        {Number(
                          snapshot.predictiveScore,
                        ).toFixed(
                          0,
                        )}
                      </td>
                    </tr>
                  ),
                )}

                {history.length ===
                  0 && (
                  <tr>
                    <td colSpan={10}>
                      <div className="table-message">
                        No historical EVM snapshot has been captured yet.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="command-footer">
          <div>
            BuildSight · Predictive Project Controls
          </div>

          <div>
            Health v11
            {" · "}
            Predictive overlay{" "}
            {intelligence.predictiveScore.toFixed(
              0,
            )}
            /100
          </div>
        </footer>
      </main>
    </div>
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

function Metric({
  label,
  value,
  negative = false,
}: {
  label: string;
  value: string;
  negative?: boolean;
}) {
  return (
    <div className="forecast-metric">
      <span>
        {label}
      </span>

      <strong
        className={
          negative
            ? "forecast-negative"
            : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}

function Header({
  eyebrow,
  title,
  value,
}: {
  eyebrow: string;
  title: string;
  value: string;
}) {
  return (
    <div className="forecast-card-header">
      <div>
        <div className="eyebrow">
          {eyebrow}
        </div>

        <h2>
          {title}
        </h2>
      </div>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function Field({
  label,
  full = false,
  children,
}: {
  label: string;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={
        full
          ? "field-full"
          : ""
      }
    >
      <span>
        {label}
      </span>

      {children}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
}: {
  label: string;
  value: number;
  onChange: (
    value: number,
  ) => void;
  step?: string;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        step={
          step
        }
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            Number(
              event.target.value,
            ),
          )
        }
      />
    </Field>
  );
}
