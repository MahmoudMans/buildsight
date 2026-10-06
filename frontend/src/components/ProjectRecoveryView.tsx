"use client";

import Link from "next/link";
import { codeLabel, netCost } from "@/lib/labels";
import { ProjectWorkspaceSidebar } from "./ProjectWorkspaceSidebar";
import { ProjectWorkspaceLoading } from "./ProjectWorkspaceLoading";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  approveChangeSimulation,
  archiveChangeSimulation,
  BuildSightApiError,
  createChangeSimulation,
  createRecoveryOption,
  getProjectRecovery,
  selectRecoveryOption,
} from "@/lib/api";

import type {
  ChangeImpactControl,
  CreateChangeSimulationInput,
  CreateRecoveryOptionInput,
  RecoveryRiskLevel,
  RecoveryStrategyType,
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
  value: RecoveryRiskLevel,
): string {
  return value
    .toLowerCase()
    .replaceAll(
      "_",
      "-",
    );
}

const simulationDefaults: CreateChangeSimulationInput = {
  simulationNumber: "",
  title: "",
  sourceChangeReference: "",
  description: "",

  directCostImpact: 0,
  delayDays: 0,
  productivityChangePercentage: 0,
  procurementDelayDays: 0,
  resourceCapacityChangePercentage: 0,
  riskContingencyPercentage: 5,

  notes: "",
};

const recoveryDefaults: CreateRecoveryOptionInput = {
  optionNumber: "",
  name: "",

  strategyType: "COMBINED",

  scheduleRecoveryDays: 0,
  incrementalCost: 0,

  productivityImprovementPercentage: 0,
  procurementRecoveryDays: 0,
  resourceCapacityImprovementPercentage: 0,
  residualRiskPercentage: 20,

  notes: "",
};

const strategyTypes: RecoveryStrategyType[] = [
  "ACCELERATION",
  "RESEQUENCING",
  "OVERTIME",
  "ADDITIONAL_RESOURCES",
  "ALTERNATE_SUPPLIER",
  "SCOPE_OPTIMIZATION",
  "COMBINED",
];

export function ProjectRecoveryView({
  projectId,
}: {
  projectId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<ChangeImpactControl | null>(
      null,
    );

  const [
    selectedSimulationId,
    setSelectedSimulationId,
  ] =
    useState<string | null>(
      null,
    );

  const [
    showSimulationForm,
    setShowSimulationForm,
  ] =
    useState(
      false,
    );

  const [
    showRecoveryForm,
    setShowRecoveryForm,
  ] =
    useState(
      false,
    );

  const [
    simulationForm,
    setSimulationForm,
  ] =
    useState(
      simulationDefaults,
    );

  const [
    recoveryForm,
    setRecoveryForm,
  ] =
    useState(
      recoveryDefaults,
    );

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
    useState(
      "",
    );

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectRecovery(
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

              setSelectedSimulationId(
                response.simulations[0]?.id
                ?? null,
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
                  : "Unable to load recovery planning.",
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
    const response =
      await getProjectRecovery(
        projectId,
      );

    setData(
      response,
    );

    if (
      selectedSimulationId
      && response.simulations.some(
        (
          simulation,
        ) =>
          simulation.id ===
          selectedSimulationId,
      )
    ) {
      return;
    }

    setSelectedSimulationId(
      response.simulations[0]?.id
      ?? null,
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
          : "Recovery-planning operation failed.",
      );

      return false;

    } finally {
      setBusy(
        false,
      );
    }
  }

  const selectedSimulation =
    useMemo(
      () =>
        data?.simulations.find(
          (
            simulation,
          ) =>
            simulation.id ===
            selectedSimulationId,
        )
        ?? data?.simulations[0]
        ?? null,
      [
        data,
        selectedSimulationId,
      ],
    );

  async function submitSimulation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await action(
        () =>
          createChangeSimulation(
            projectId,
            simulationForm,
          ),
      )
    ) {
      setSimulationForm(
        simulationDefaults,
      );

      setShowSimulationForm(
        false,
      );
    }
  }

  async function submitRecovery(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!selectedSimulation) {
      return;
    }

    if (
      await action(
        () =>
          createRecoveryOption(
            projectId,
            selectedSimulation.id,
            recoveryForm,
          ),
      )
    ) {
      setRecoveryForm(
        recoveryDefaults,
      );

      setShowRecoveryForm(
        false,
      );
    }
  }

  if (loading) {
    return (
      <ProjectWorkspaceLoading
        label={"Loading change-impact intelligence..."}
        mainClassName={"recovery-main"}
        projectId={projectId}
      />
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
            Recovery planning unavailable
          </h1>

          <p>
            {error}
          </p>
        </div>
      </main>
    );
  }

  const {
    project,
    intelligence,
    selectedPlanHistory,
  } = data;

  return (
    <div className="recovery-shell">
      <ProjectWorkspaceSidebar
        projectId={projectId}
        projectCode={project.code}
        className="recovery-sidebar"
        localLinks={[
          { href: "#impact", label: "Impact" },
          { href: "#options", label: "Options" },
          { href: "#history", label: "Selected plans" },
        ]}
      />

      <main className="recovery-main">
        <header className="recovery-header">
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
              CHANGE IMPACT & RECOVERY
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Simulate construction changes against
              the live predictive forecast and compare
              recovery strategies before committing
              management action.
            </p>
          </div>

          <div className="recovery-score">
            <span>
              RECOVERY SCORE
            </span>

            <strong>
              {intelligence.recoveryScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={`recovery-risk recovery-risk-${riskClass(
                intelligence.recoveryRisk,
              )}`}
            >
              {intelligence.recoveryRisk.replaceAll(
                "_",
                " ",
              )}
            </i>
          </div>
        </header>

        <div className="recovery-architecture-note">
          <strong>
            Analytical layer
          </strong>

          <span>
            Change simulations do not replace
            BuildSight&apos;s existing commercial
            or change-control records. They model
            potential cost/schedule consequences
            and recovery trade-offs.
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

        <section className="recovery-kpis">
          <Kpi
            label="CHANGE COST EXPOSURE"
            value={currency(
              intelligence.changeCostExposure,
            )}
            detail={`Forecast ${currency(
              intelligence.impactedForecastCost,
            )}`}
            dark
          />

          <Kpi
            label="SCHEDULE IMPACT"
            value={`${intelligence.scheduleImpactDays}d`}
            detail={date(
              intelligence.impactedForecastFinishDate,
            )}
          />

          <Kpi
            label="RECOVERABLE"
            value={`${intelligence.recoverableDays}d`}
            detail={`${intelligence.residualDelayDays}d residual`}
          />

          <Kpi
            label="NET RECOVERY COST"
            value={netCost(intelligence.recoveryCost, currency)}
            detail={
              intelligence.recommendedRecoveryOptionNumber
              ?? "No recovery option"
            }
          />
        </section>

        <section className="recovery-actions-toolbar">
          <button
            type="button"
            onClick={() =>
              setShowSimulationForm(
                !showSimulationForm,
              )
            }
          >
            + Change simulation
          </button>

          <button
            type="button"
            disabled={
              !selectedSimulation
            }
            onClick={() =>
              setShowRecoveryForm(
                !showRecoveryForm,
              )
            }
          >
            + Recovery option
          </button>
        </section>

        {showSimulationForm && (
          <section className="recovery-card">
            <Header
              eyebrow="CHANGE IMPACT"
              title="New analytical simulation"
              value="Draft"
            />

            <form
              className="recovery-form"
              onSubmit={
                submitSimulation
              }
            >
              <Field label="Simulation number">
                <input
                  required
                  value={
                    simulationForm.simulationNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    setSimulationForm({
                      ...simulationForm,
                      simulationNumber:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Source change reference">
                <input
                  required
                  value={
                    simulationForm.sourceChangeReference
                  }
                  onChange={(
                    event,
                  ) =>
                    setSimulationForm({
                      ...simulationForm,
                      sourceChangeReference:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Title"
                full
              >
                <input
                  required
                  value={
                    simulationForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setSimulationForm({
                      ...simulationForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <NumberField
                label="Direct cost impact"
                value={
                  simulationForm.directCostImpact
                }
                onChange={(
                  value,
                ) =>
                  setSimulationForm({
                    ...simulationForm,
                    directCostImpact:
                      value,
                  })
                }
              />

              <NumberField
                label="Direct delay days"
                value={
                  simulationForm.delayDays
                }
                onChange={(
                  value,
                ) =>
                  setSimulationForm({
                    ...simulationForm,
                    delayDays:
                      value,
                  })
                }
              />

              <NumberField
                label="Productivity change %"
                value={
                  simulationForm.productivityChangePercentage
                }
                step="0.1"
                onChange={(
                  value,
                ) =>
                  setSimulationForm({
                    ...simulationForm,
                    productivityChangePercentage:
                      value,
                  })
                }
              />

              <NumberField
                label="Procurement delay days"
                value={
                  simulationForm.procurementDelayDays
                }
                onChange={(
                  value,
                ) =>
                  setSimulationForm({
                    ...simulationForm,
                    procurementDelayDays:
                      value,
                  })
                }
              />

              <NumberField
                label="Resource capacity change %"
                value={
                  simulationForm.resourceCapacityChangePercentage
                }
                step="0.1"
                onChange={(
                  value,
                ) =>
                  setSimulationForm({
                    ...simulationForm,
                    resourceCapacityChangePercentage:
                      value,
                  })
                }
              />

              <NumberField
                label="Risk contingency %"
                value={
                  simulationForm.riskContingencyPercentage
                }
                step="0.1"
                onChange={(
                  value,
                ) =>
                  setSimulationForm({
                    ...simulationForm,
                    riskContingencyPercentage:
                      value,
                  })
                }
              />

              <Field
                label="Description"
                full
              >
                <textarea
                  rows={3}
                  value={
                    simulationForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setSimulationForm({
                      ...simulationForm,
                      description:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setShowSimulationForm(
                    false,
                  )
                }
              />
            </form>
          </section>
        )}

        {showRecoveryForm &&
          selectedSimulation && (
          <section className="recovery-card">
            <Header
              eyebrow="RECOVERY STRATEGY"
              title={`New option · ${selectedSimulation.simulationNumber}`}
              value="Draft"
            />

            <form
              className="recovery-form"
              onSubmit={
                submitRecovery
              }
            >
              <Field label="Option number">
                <input
                  required
                  value={
                    recoveryForm.optionNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    setRecoveryForm({
                      ...recoveryForm,
                      optionNumber:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Strategy">
                <select
                  value={
                    recoveryForm.strategyType
                  }
                  onChange={(
                    event,
                  ) =>
                    setRecoveryForm({
                      ...recoveryForm,
                      strategyType:
                        event.target.value as RecoveryStrategyType,
                    })
                  }
                >
                  {strategyTypes.map(
                    (
                      strategy,
                    ) => (
                      <option
                        key={
                          strategy
                        }
                        value={
                          strategy
                        }
                      >
                        {strategy.replaceAll(
                          "_",
                          " ",
                        )}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field
                label="Name"
                full
              >
                <input
                  required
                  value={
                    recoveryForm.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setRecoveryForm({
                      ...recoveryForm,
                      name:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <NumberField
                label="Direct recovery days"
                value={
                  recoveryForm.scheduleRecoveryDays
                }
                onChange={(
                  value,
                ) =>
                  setRecoveryForm({
                    ...recoveryForm,
                    scheduleRecoveryDays:
                      value,
                  })
                }
              />

              <NumberField
                label="Incremental recovery cost"
                value={
                  recoveryForm.incrementalCost
                }
                onChange={(
                  value,
                ) =>
                  setRecoveryForm({
                    ...recoveryForm,
                    incrementalCost:
                      value,
                  })
                }
              />

              <NumberField
                label="Productivity improvement %"
                value={
                  recoveryForm.productivityImprovementPercentage
                }
                step="0.1"
                onChange={(
                  value,
                ) =>
                  setRecoveryForm({
                    ...recoveryForm,
                    productivityImprovementPercentage:
                      value,
                  })
                }
              />

              <NumberField
                label="Procurement recovery days"
                value={
                  recoveryForm.procurementRecoveryDays
                }
                onChange={(
                  value,
                ) =>
                  setRecoveryForm({
                    ...recoveryForm,
                    procurementRecoveryDays:
                      value,
                  })
                }
              />

              <NumberField
                label="Resource improvement %"
                value={
                  recoveryForm.resourceCapacityImprovementPercentage
                }
                step="0.1"
                onChange={(
                  value,
                ) =>
                  setRecoveryForm({
                    ...recoveryForm,
                    resourceCapacityImprovementPercentage:
                      value,
                  })
                }
              />

              <NumberField
                label="Residual risk %"
                value={
                  recoveryForm.residualRiskPercentage
                }
                step="0.1"
                onChange={(
                  value,
                ) =>
                  setRecoveryForm({
                    ...recoveryForm,
                    residualRiskPercentage:
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
                    recoveryForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setRecoveryForm({
                      ...recoveryForm,
                      notes:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setShowRecoveryForm(
                    false,
                  )
                }
              />
            </form>
          </section>
        )}

        <section
          className="recovery-card"
          id="impact"
        >
          <Header
            eyebrow="CHANGE SIMULATIONS"
            title="Impact register"
            value={`${data.simulations.length} simulations`}
          />

          <div className="recovery-simulation-tabs">
            {data.simulations.map(
              (
                simulation,
              ) => (
                <button
                  type="button"
                  key={
                    simulation.id
                  }
                  className={
                    selectedSimulation?.id ===
                    simulation.id
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setSelectedSimulationId(
                      simulation.id,
                    )
                  }
                >
                  <span>
                    {
                      simulation.simulationNumber
                    }
                  </span>

                  <strong>
                    {
                      simulation.title
                    }
                  </strong>

                  <small>
                    {
                      simulation.status
                    }
                  </small>
                </button>
              ),
            )}

            {data.simulations.length ===
              0 && (
              <div className="table-message">
                No change-impact simulations yet.
              </div>
            )}
          </div>
        </section>

        {selectedSimulation && (
          <>
            <section className="recovery-card">
              <Header
                eyebrow="IMPACT POSITION"
                title={
                  selectedSimulation.title
                }
                value={
                  selectedSimulation.sourceChangeReference
                }
              />

              <div className="recovery-impact-grid">
                <Metric
                  label="Baseline cost"
                  value={currency(
                    selectedSimulation.impact.baselineForecastCost,
                  )}
                />

                <Metric
                  label="Impacted cost"
                  value={currency(
                    selectedSimulation.impact.impactedForecastCost,
                  )}
                  danger
                />

                <Metric
                  label="Cost exposure"
                  value={currency(
                    selectedSimulation.impact.totalChangeCostExposure,
                  )}
                  danger={
                    selectedSimulation.impact.totalChangeCostExposure >
                    0
                  }
                />

                <Metric
                  label="Schedule impact"
                  value={`${selectedSimulation.impact.scheduleImpactDays}d`}
                  danger={
                    selectedSimulation.impact.scheduleImpactDays >
                    0
                  }
                />

                <Metric
                  label="Baseline finish"
                  value={date(
                    selectedSimulation.impact.baselineForecastFinishDate,
                  )}
                />

                <Metric
                  label="Impacted finish"
                  value={date(
                    selectedSimulation.impact.impactedForecastFinishDate,
                  )}
                  danger
                />

                <Metric
                  label="Impact score"
                  value={`${selectedSimulation.impact.impactScore.toFixed(
                    0,
                  )}/100`}
                />

                <Metric
                  label="Impact risk"
                  value={
                    codeLabel(selectedSimulation.impact.impactRisk)
                  }
                />
              </div>

              <div className="impact-cost-breakdown">
                <Breakdown
                  label="Direct change"
                  value={
                    selectedSimulation.impact.directCostImpact
                  }
                />

                <Breakdown
                  label="Productivity"
                  value={
                    selectedSimulation.impact.productivityCostImpact
                  }
                />

                <Breakdown
                  label="Resources"
                  value={
                    selectedSimulation.impact.resourceCostImpact
                  }
                />

                <Breakdown
                  label="Time-related"
                  value={
                    selectedSimulation.impact.extensionCostImpact
                  }
                />

                <Breakdown
                  label="Contingency"
                  value={
                    selectedSimulation.impact.contingencyCostImpact
                  }
                />
              </div>

              <div className="recovery-inline-actions">
                {selectedSimulation.status ===
                  "DRAFT" && (
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void action(
                        () =>
                          approveChangeSimulation(
                            projectId,
                            selectedSimulation.id,
                          ),
                      )
                    }
                  >
                    Approve simulation
                  </button>
                )}

                {selectedSimulation.status !==
                  "ARCHIVED" && (
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void action(
                        () =>
                          archiveChangeSimulation(
                            projectId,
                            selectedSimulation.id,
                          ),
                      )
                    }
                  >
                    Archive
                  </button>
                )}
              </div>
            </section>

            <section
              className="recovery-card"
              id="options"
            >
              <Header
                eyebrow="RECOVERY COMPARISON"
                title="Recovery options"
                value={`${selectedSimulation.options.length} options`}
              />

              <div className="schedule-table-wrapper">
                <table className="schedule-table">
                  <thead>
                    <tr>
                      <th>OPTION</th>
                      <th>STRATEGY</th>
                      <th>RECOVER</th>
                      <th>RESIDUAL</th>
                      <th title="Cost of the recovery option minus the time-related savings from the days recovered. A negative figure is a net saving.">NET RECOVERY COST</th>
                      <th>COST / DAY</th>
                      <th>FINISH</th>
                      <th>SCORE</th>
                      <th>STATUS</th>
                      <th></th>
                    </tr>
                  </thead>

                  <tbody>
                    {selectedSimulation.options.map(
                      (
                        option,
                      ) => (
                        <tr
                          key={
                            option.id
                          }
                          className={
                            option.recommended
                              ? "recovery-recommended-row"
                              : ""
                          }
                        >
                          <td>
                            <div className="schedule-name-cell">
                              <strong>
                                {
                                  option.optionNumber
                                }
                                {option.recommended
                                  ? " ★"
                                  : ""}
                              </strong>

                              <span>
                                {
                                  option.name
                                }
                              </span>
                            </div>
                          </td>

                          <td>
                            {option.strategyType.replaceAll(
                              "_",
                              " ",
                            )}
                          </td>

                          <td>
                            {option.evaluation.recoverableDays}
                            d
                          </td>

                          <td>
                            {option.evaluation.residualDelayDays}
                            d
                          </td>

                          <td>
                            {netCost(option.evaluation.recoveryCostVsImpacted, currency)}
                          </td>

                          <td>
                            {netCost(option.evaluation.costPerDayRecovered, currency)}
                          </td>

                          <td>
                            {date(
                              option.evaluation.recoveredForecastFinishDate,
                            )}
                          </td>

                          <td>
                            <strong>
                              {option.evaluation.recoveryScore.toFixed(
                                0,
                              )}
                            </strong>
                          </td>

                          <td>
                            {
                              option.status
                            }
                          </td>

                          <td>
                            {selectedSimulation.status ===
                              "APPROVED"
                              && option.status ===
                                "DRAFT" && (
                              <button
                                type="button"
                                className="recovery-select-button"
                                disabled={
                                  busy
                                }
                                onClick={() =>
                                  void action(
                                    () =>
                                      selectRecoveryOption(
                                        projectId,
                                        selectedSimulation.id,
                                        option.id,
                                      ),
                                  )
                                }
                              >
                                Select
                              </button>
                            )}
                          </td>
                        </tr>
                      ),
                    )}

                    {selectedSimulation.options.length ===
                      0 && (
                      <tr>
                        <td colSpan={10}>
                          <div className="table-message">
                            No recovery options have been modeled.
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}

        <section
          className="recovery-card"
          id="history"
        >
          <Header
            eyebrow="SELECTED RECOVERY PLANS"
            title="Immutable plan history"
            value={`${selectedPlanHistory.length} plans`}
          />

          <div className="schedule-table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>SELECTED</th>
                  <th>IMPACT COST</th>
                  <th>RECOVERED COST</th>
                  <th>IMPACT DELAY</th>
                  <th>RECOVERED</th>
                  <th>RESIDUAL</th>
                  <th>RECOVERED FINISH</th>
                  <th>SCORE</th>
                </tr>
              </thead>

              <tbody>
                {selectedPlanHistory.map(
                  (
                    snapshot,
                  ) => (
                    <tr
                      key={
                        snapshot.id
                      }
                    >
                      <td>
                        {new Intl.DateTimeFormat(
                          "en-GB",
                          {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          },
                        ).format(
                          new Date(
                            snapshot.selectedAt,
                          ),
                        )}
                      </td>

                      <td>
                        {currency(
                          snapshot.impactedForecastCost,
                        )}
                      </td>

                      <td>
                        {currency(
                          snapshot.recoveredForecastCost,
                        )}
                      </td>

                      <td>
                        {snapshot.impactDelayDays}
                        d
                      </td>

                      <td>
                        {snapshot.recoveredDays}
                        d
                      </td>

                      <td>
                        {snapshot.residualDelayDays}
                        d
                      </td>

                      <td>
                        {date(
                          snapshot.recoveredForecastFinishDate,
                        )}
                      </td>

                      <td>
                        {Number(
                          snapshot.recoveryScore,
                        ).toFixed(
                          0,
                        )}
                      </td>
                    </tr>
                  ),
                )}

                {selectedPlanHistory.length ===
                  0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="table-message">
                        No recovery plan has been formally selected.
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
            BuildSight · Change Impact & Recovery Planning
          </div>

          <div>
            Project Health v11
            {" · "}
            Recovery overlay{" "}
            {intelligence.recoveryScore.toFixed(
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

function Metric({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div className="recovery-metric">
      <span>
        {label}
      </span>

      <strong
        className={
          danger
            ? "recovery-danger"
            : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}

function Breakdown({
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
        {currency(
          value,
        )}
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
    <div className="recovery-card-header">
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
  children: ReactNode;
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

function FormActions({
  busy,
  onCancel,
}: {
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="form-actions field-full">
      <button
        type="button"
        className="secondary-button"
        onClick={
          onCancel
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
        {busy
          ? "Saving..."
          : "Save"}
      </button>
    </div>
  );
}
