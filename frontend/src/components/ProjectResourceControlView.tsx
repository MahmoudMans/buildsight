"use client";

import Link from "next/link";
import { ProjectWorkspaceSidebar } from "./ProjectWorkspaceSidebar";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import {
  BuildSightApiError,
  createEquipmentUsage,
  createProjectEquipment,
  createResourceForecast,
  createWorkforceDeployment,
  createWorkforcePlan,
  getProjectResources,
  updateProjectEquipment,
  updateResourceForecast,
  updateWorkforcePlan,
} from "@/lib/api";

import type {
  CreateEquipmentInput,
  CreateEquipmentUsageInput,
  CreateResourceForecastInput,
  CreateWorkforceDeploymentInput,
  CreateWorkforcePlanInput,
  EquipmentOwnership,
  EquipmentStatus,
  ProjectEquipment,
  ResourceControl,
  ResourceDemandType,
  ResourceForecast,
  ResourceRiskLevel,
  WorkforcePlan,
  WorkforcePlanStatus,
} from "@/types/project";

type Panel =
  | "plan"
  | "deployment"
  | "equipment"
  | "usage"
  | "forecast"
  | null;

function today(): string {
  const value =
    new Date();

  return [
    value.getFullYear(),
    String(
      value.getMonth() + 1,
    ).padStart(
      2,
      "0",
    ),
    String(
      value.getDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
}

function offsetDate(
  days: number,
): string {
  const value =
    new Date();

  value.setDate(
    value.getDate() + days,
  );

  return [
    value.getFullYear(),
    String(
      value.getMonth() + 1,
    ).padStart(
      2,
      "0",
    ),
    String(
      value.getDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
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

function money(
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

const riskLabels: Record<
  ResourceRiskLevel,
  string
> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const planDefaults: CreateWorkforcePlanInput = {
  periodStart: today(),
  periodEnd: offsetDate(7),
  trade: "",
  workPackageId: null,
  plannedWorkers: 0,
  plannedRegularHours: 0,
  plannedProductiveHours: 0,
  plannedProductivityRate: null,
};

const deploymentDefaults: CreateWorkforceDeploymentInput = {
  workDate: today(),
  trade: "",
  workPackageId: null,
  workers: 0,
  regularHours: 0,
  overtimeHours: 0,
  productiveHours: 0,
  quantityCompleted: 0,
  plannedProductivityRate: null,
  notes: "",
};

const equipmentDefaults: CreateEquipmentInput = {
  code: "",
  description: "",
  category: "",
  ownership: "RENTED",
  dailyCost: 0,
};

const usageDefaults: CreateEquipmentUsageInput = {
  equipmentId: "",
  workPackageId: null,
  workDate: today(),
  availableHours: 10,
  operatingHours: 0,
  idleHours: 0,
  downtimeHours: 0,
  notes: "",
};

const forecastDefaults: CreateResourceForecastInput = {
  periodStart: offsetDate(1),
  periodEnd: offsetDate(14),
  resourceType: "LABOR",
  resourceKey: "",
  requiredQuantity: 0,
  availableQuantity: 0,
  notes: "",
};

function planStatuses(
  status: WorkforcePlanStatus,
): WorkforcePlanStatus[] {
  switch (status) {
    case "DRAFT":
      return [
        "DRAFT",
        "APPROVED",
      ];

    case "APPROVED":
      return [
        "APPROVED",
        "CLOSED",
      ];

    case "CLOSED":
      return [
        "CLOSED",
      ];
  }
}

function equipmentStatuses(
  status: EquipmentStatus,
): EquipmentStatus[] {
  switch (status) {
    case "AVAILABLE":
      return [
        "AVAILABLE",
        "DEPLOYED",
        "IDLE",
        "MAINTENANCE",
        "OFF_HIRE",
      ];

    case "DEPLOYED":
      return [
        "DEPLOYED",
        "AVAILABLE",
        "IDLE",
        "MAINTENANCE",
        "OFF_HIRE",
      ];

    case "IDLE":
      return [
        "IDLE",
        "AVAILABLE",
        "DEPLOYED",
        "MAINTENANCE",
        "OFF_HIRE",
      ];

    case "MAINTENANCE":
      return [
        "MAINTENANCE",
        "AVAILABLE",
        "OFF_HIRE",
      ];

    case "OFF_HIRE":
      return [
        "OFF_HIRE",
      ];
  }
}

export function ProjectResourceControlView({
  projectId,
}: {
  projectId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<ResourceControl | null>(
      null,
    );

  const [
    panel,
    setPanel,
  ] =
    useState<Panel>(
      null,
    );

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

  const [
    planForm,
    setPlanForm,
  ] =
    useState(planDefaults);

  const [
    deploymentForm,
    setDeploymentForm,
  ] =
    useState(
      deploymentDefaults,
    );

  const [
    equipmentForm,
    setEquipmentForm,
  ] =
    useState(
      equipmentDefaults,
    );

  const [
    usageForm,
    setUsageForm,
  ] =
    useState(
      usageDefaults,
    );

  const [
    forecastForm,
    setForecastForm,
  ] =
    useState(
      forecastDefaults,
    );

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectResources(
        projectId,
      )
        .then(
          (
            response,
          ) => {
            if (cancelled) {
              return;
            }

            setData(
              response,
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
            if (cancelled) {
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
                "BuildSight could not load resource intelligence.",
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
      await getProjectResources(
        projectId,
      ),
    );
  }

  async function runAction(
    action: () => Promise<unknown>,
  ) {
    setBusy(true);
    setError("");

    try {
      await action();
      await refresh();

      return true;

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
          "The resource-control operation failed.",
        );
      }

      return false;

    } finally {
      setBusy(false);
    }
  }

  async function submitPlan(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createWorkforcePlan(
            projectId,
            planForm,
          ),
      )
    ) {
      setPlanForm({
        ...planDefaults,
        periodStart:
          today(),
        periodEnd:
          offsetDate(7),
      });

      setPanel(null);
    }
  }

  async function submitDeployment(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createWorkforceDeployment(
            projectId,
            deploymentForm,
          ),
      )
    ) {
      setDeploymentForm({
        ...deploymentDefaults,
        workDate:
          today(),
      });

      setPanel(null);
    }
  }

  async function submitEquipment(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createProjectEquipment(
            projectId,
            equipmentForm,
          ),
      )
    ) {
      setEquipmentForm(
        equipmentDefaults,
      );

      setPanel(null);
    }
  }

  async function submitUsage(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !usageForm.equipmentId
    ) {
      setError(
        "Select equipment before recording usage.",
      );
      return;
    }

    if (
      await runAction(
        () =>
          createEquipmentUsage(
            projectId,
            usageForm,
          ),
      )
    ) {
      setUsageForm({
        ...usageDefaults,
        workDate:
          today(),
      });

      setPanel(null);
    }
  }

  async function submitForecast(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createResourceForecast(
            projectId,
            forecastForm,
          ),
      )
    ) {
      setForecastForm({
        ...forecastDefaults,
        periodStart:
          offsetDate(1),
        periodEnd:
          offsetDate(14),
      });

      setPanel(null);
    }
  }

  async function changePlanStatus(
    plan: WorkforcePlan,
    status: WorkforcePlanStatus,
  ) {
    if (
      plan.status ===
      status
    ) {
      return;
    }

    await runAction(
      () =>
        updateWorkforcePlan(
          projectId,
          plan.id,
          {
            version:
              plan.version,
            periodStart:
              plan.periodStart,
            periodEnd:
              plan.periodEnd,
            trade:
              plan.trade,
            workPackageId:
              plan.workPackageId,
            plannedWorkers:
              plan.plannedWorkers,
            plannedRegularHours:
              plan.plannedRegularHours,
            plannedProductiveHours:
              plan.plannedProductiveHours,
            plannedProductivityRate:
              plan.plannedProductivityRate,
            status,
          },
        ),
    );
  }

  async function changeEquipmentStatus(
    equipment: ProjectEquipment,
    status: EquipmentStatus,
  ) {
    if (
      equipment.status ===
      status
    ) {
      return;
    }

    await runAction(
      () =>
        updateProjectEquipment(
          projectId,
          equipment.id,
          {
            version:
              equipment.version,
            description:
              equipment.description,
            category:
              equipment.category,
            ownership:
              equipment.ownership,
            status,
            dailyCost:
              equipment.dailyCost,
          },
        ),
    );
  }

  async function toggleForecast(
    forecast: ResourceForecast,
  ) {
    await runAction(
      () =>
        updateResourceForecast(
          projectId,
          forecast.id,
          {
            version:
              forecast.version,
            periodStart:
              forecast.periodStart,
            periodEnd:
              forecast.periodEnd,
            resourceType:
              forecast.resourceType,
            resourceKey:
              forecast.resourceKey,
            requiredQuantity:
              forecast.requiredQuantity,
            availableQuantity:
              forecast.availableQuantity,
            notes:
              forecast.notes ??
              "",
            status:
              forecast.status ===
              "OPEN"
                ? "CLOSED"
                : "OPEN",
          },
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
          Loading resource intelligence...
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
            Resource control unavailable
          </h1>

          <p>
            {error}
          </p>

          <Link
            href="/"
            className="secondary-link-button"
          >
            Back to portfolio
          </Link>
        </div>
      </main>
    );
  }

  const {
    project,
    intelligence,
    workforcePlans,
    deployments,
    equipment,
    equipmentUsage,
    forecasts,
  } = data;

  return (
    <div className="resource-shell">
      <ProjectWorkspaceSidebar
        projectId={projectId}
        projectCode={project.code}
        className="resource-sidebar"
        localLinks={[
          { href: "#workforce-plan", label: "Workforce plan" },
          { href: "#deployment", label: "Deployment" },
          { href: "#equipment", label: "Equipment" },
          { href: "#forecast", label: "Forecast" },
        ]}
      />

      <main className="resource-main">
        <header className="resource-topbar">
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
              RESOURCE INTELLIGENCE
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Workforce utilization,
              overtime, productivity,
              equipment efficiency and
              future resource capacity.
            </p>
          </div>

          <div className="resource-header-score">
            <span>
              RESOURCE HEALTH
            </span>

            <strong>
              {intelligence.resourceScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={`resource-risk resource-risk-${intelligence.resourceRisk
                .toLowerCase()
                .replaceAll(
                  "_",
                  "-",
                )}`}
            >
              {
                riskLabels[
                  intelligence.resourceRisk
                ]
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

        <section className="resource-kpi-grid">
          <Kpi
            label="LABOR UTILIZATION"
            value={`${intelligence.laborUtilizationPercentage.toFixed(
              1,
            )}%`}
            detail={`${intelligence.productiveLaborHours} productive hours`}
          />

          <Kpi
            label="OVERTIME"
            value={`${intelligence.overtimePercentage.toFixed(
              1,
            )}%`}
            detail={`${intelligence.overtimeHours} overtime hours`}
          />

          <Kpi
            label="EQUIPMENT UTILIZATION"
            value={`${intelligence.equipmentUtilizationPercentage.toFixed(
              1,
            )}%`}
            detail={`${intelligence.idleEquipment} idle assets`}
          />

          <Kpi
            label="FORWARD RESOURCE GAP"
            value={`${(
              intelligence.workerDemandGap
              +
              intelligence.equipmentDemandGap
            ).toFixed(
              1,
            )}`}
            detail={`${intelligence.openResourceForecasts} open forecasts`}
            emphasis
          />
        </section>

        <section className="resource-intelligence-panel">
          <div className="resource-score-panel">
            <span>
              RESOURCE SCORE
            </span>

            <strong>
              {intelligence.resourceScore.toFixed(
                0,
              )}
            </strong>

            <small>
              /100
            </small>
          </div>

          <div className="resource-intelligence-grid">
            <Metric
              label="Average productivity index"
              value={`${intelligence.averageProductivityIndex.toFixed(
                2,
              )}x`}
            />

            <Metric
              label="Low-productivity packages"
              value={String(
                intelligence.lowProductivityWorkPackages,
              )}
            />

            <Metric
              label="Worker demand gap"
              value={String(
                intelligence.workerDemandGap,
              )}
            />

            <Metric
              label="Equipment demand gap"
              value={String(
                intelligence.equipmentDemandGap,
              )}
            />

            <Metric
              label="Equipment downtime"
              value={`${intelligence.equipmentDowntimeHours}h`}
            />

            <Metric
              label="Actual labor hours"
              value={`${intelligence.actualLaborHours}h`}
            />
          </div>

          <p>
            {intelligence.explanation}
          </p>
        </section>

        <section className="resource-actions-bar">
          <button
            type="button"
            onClick={() =>
              setPanel("plan")
            }
          >
            + Workforce plan
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "deployment",
              )
            }
          >
            + Daily deployment
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "equipment",
              )
            }
          >
            + Equipment
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel("usage")
            }
          >
            + Equipment usage
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "forecast",
              )
            }
          >
            + Resource forecast
          </button>
        </section>

        {panel === "plan" && (
          <Panel
            title="Create workforce plan"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="resource-form"
              onSubmit={
                submitPlan
              }
            >
              <DateField
                label="Period start"
                value={
                  planForm.periodStart
                }
                onChange={(
                  value,
                ) =>
                  setPlanForm({
                    ...planForm,
                    periodStart:
                      value,
                  })
                }
              />

              <DateField
                label="Period end"
                value={
                  planForm.periodEnd
                }
                onChange={(
                  value,
                ) =>
                  setPlanForm({
                    ...planForm,
                    periodEnd:
                      value,
                  })
                }
              />

              <Field label="Trade">
                <input
                  required
                  value={
                    planForm.trade
                  }
                  onChange={(
                    event,
                  ) =>
                    setPlanForm({
                      ...planForm,
                      trade:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <NumberField
                label="Planned workers"
                value={
                  planForm.plannedWorkers
                }
                onChange={(
                  value,
                ) =>
                  setPlanForm({
                    ...planForm,
                    plannedWorkers:
                      value,
                  })
                }
              />

              <NumberField
                label="Regular labor hours"
                value={
                  planForm.plannedRegularHours
                }
                onChange={(
                  value,
                ) =>
                  setPlanForm({
                    ...planForm,
                    plannedRegularHours:
                      value,
                  })
                }
              />

              <NumberField
                label="Productive labor hours"
                value={
                  planForm.plannedProductiveHours
                }
                onChange={(
                  value,
                ) =>
                  setPlanForm({
                    ...planForm,
                    plannedProductiveHours:
                      value,
                  })
                }
              />

              <NumberField
                label="Planned productivity rate"
                value={
                  planForm.plannedProductivityRate ??
                  0
                }
                step="0.001"
                onChange={(
                  value,
                ) =>
                  setPlanForm({
                    ...planForm,
                    plannedProductivityRate:
                      value > 0
                        ? value
                        : null,
                  })
                }
              />

              <FormActions
                busy={busy}
                onCancel={() =>
                  setPanel(null)
                }
              />
            </form>
          </Panel>
        )}

        {panel ===
          "deployment" && (
          <Panel
            title="Record daily workforce deployment"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="resource-form"
              onSubmit={
                submitDeployment
              }
            >
              <DateField
                label="Work date"
                value={
                  deploymentForm.workDate
                }
                max={today()}
                onChange={(
                  value,
                ) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    workDate:
                      value,
                  })
                }
              />

              <Field label="Trade">
                <input
                  required
                  value={
                    deploymentForm.trade
                  }
                  onChange={(
                    event,
                  ) =>
                    setDeploymentForm({
                      ...deploymentForm,
                      trade:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <NumberField
                label="Workers"
                value={
                  deploymentForm.workers
                }
                onChange={(
                  value,
                ) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    workers:
                      value,
                  })
                }
              />

              <NumberField
                label="Regular hours"
                value={
                  deploymentForm.regularHours
                }
                onChange={(
                  value,
                ) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    regularHours:
                      value,
                  })
                }
              />

              <NumberField
                label="Overtime hours"
                value={
                  deploymentForm.overtimeHours
                }
                onChange={(
                  value,
                ) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    overtimeHours:
                      value,
                  })
                }
              />

              <NumberField
                label="Productive hours"
                value={
                  deploymentForm.productiveHours
                }
                onChange={(
                  value,
                ) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    productiveHours:
                      value,
                  })
                }
              />

              <NumberField
                label="Quantity completed"
                value={
                  deploymentForm.quantityCompleted
                }
                step="0.01"
                onChange={(
                  value,
                ) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    quantityCompleted:
                      value,
                  })
                }
              />

              <NumberField
                label="Planned productivity rate"
                value={
                  deploymentForm.plannedProductivityRate ??
                  0
                }
                step="0.001"
                onChange={(
                  value,
                ) =>
                  setDeploymentForm({
                    ...deploymentForm,
                    plannedProductivityRate:
                      value > 0
                        ? value
                        : null,
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
                    deploymentForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setDeploymentForm({
                      ...deploymentForm,
                      notes:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <FormActions
                busy={busy}
                onCancel={() =>
                  setPanel(null)
                }
              />
            </form>
          </Panel>
        )}

        {panel ===
          "equipment" && (
          <Panel
            title="Register equipment"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="resource-form"
              onSubmit={
                submitEquipment
              }
            >
              <Field label="Code">
                <input
                  required
                  value={
                    equipmentForm.code
                  }
                  onChange={(
                    event,
                  ) =>
                    setEquipmentForm({
                      ...equipmentForm,
                      code:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Ownership">
                <select
                  value={
                    equipmentForm.ownership
                  }
                  onChange={(
                    event,
                  ) =>
                    setEquipmentForm({
                      ...equipmentForm,
                      ownership:
                        event.target.value as EquipmentOwnership,
                    })
                  }
                >
                  <option value="OWNED">
                    Owned
                  </option>

                  <option value="RENTED">
                    Rented
                  </option>

                  <option value="SUBCONTRACTOR">
                    Subcontractor
                  </option>
                </select>
              </Field>

              <Field
                label="Description"
                wide
              >
                <input
                  required
                  value={
                    equipmentForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setEquipmentForm({
                      ...equipmentForm,
                      description:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Category">
                <input
                  required
                  value={
                    equipmentForm.category
                  }
                  onChange={(
                    event,
                  ) =>
                    setEquipmentForm({
                      ...equipmentForm,
                      category:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <NumberField
                label="Daily cost"
                value={
                  equipmentForm.dailyCost
                }
                step="0.01"
                onChange={(
                  value,
                ) =>
                  setEquipmentForm({
                    ...equipmentForm,
                    dailyCost:
                      value,
                  })
                }
              />

              <FormActions
                busy={busy}
                onCancel={() =>
                  setPanel(null)
                }
              />
            </form>
          </Panel>
        )}

        {panel === "usage" && (
          <Panel
            title="Record equipment usage"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="resource-form"
              onSubmit={
                submitUsage
              }
            >
              <Field label="Equipment">
                <select
                  required
                  value={
                    usageForm.equipmentId
                  }
                  onChange={(
                    event,
                  ) =>
                    setUsageForm({
                      ...usageForm,
                      equipmentId:
                        event.target.value,
                    })
                  }
                >
                  <option value="">
                    Select equipment
                  </option>

                  {equipment.map(
                    (
                      item,
                    ) => (
                      <option
                        key={item.id}
                        value={item.id}
                      >
                        {item.code}
                        {" — "}
                        {item.description}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <DateField
                label="Work date"
                value={
                  usageForm.workDate
                }
                max={today()}
                onChange={(
                  value,
                ) =>
                  setUsageForm({
                    ...usageForm,
                    workDate:
                      value,
                  })
                }
              />

              <NumberField
                label="Available hours"
                value={
                  usageForm.availableHours
                }
                onChange={(
                  value,
                ) =>
                  setUsageForm({
                    ...usageForm,
                    availableHours:
                      value,
                  })
                }
              />

              <NumberField
                label="Operating hours"
                value={
                  usageForm.operatingHours
                }
                onChange={(
                  value,
                ) =>
                  setUsageForm({
                    ...usageForm,
                    operatingHours:
                      value,
                  })
                }
              />

              <NumberField
                label="Idle hours"
                value={
                  usageForm.idleHours
                }
                onChange={(
                  value,
                ) =>
                  setUsageForm({
                    ...usageForm,
                    idleHours:
                      value,
                  })
                }
              />

              <NumberField
                label="Downtime hours"
                value={
                  usageForm.downtimeHours
                }
                onChange={(
                  value,
                ) =>
                  setUsageForm({
                    ...usageForm,
                    downtimeHours:
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
                    usageForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setUsageForm({
                      ...usageForm,
                      notes:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <FormActions
                busy={busy}
                onCancel={() =>
                  setPanel(null)
                }
              />
            </form>
          </Panel>
        )}

        {panel ===
          "forecast" && (
          <Panel
            title="Create resource-demand forecast"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="resource-form"
              onSubmit={
                submitForecast
              }
            >
              <DateField
                label="Period start"
                value={
                  forecastForm.periodStart
                }
                onChange={(
                  value,
                ) =>
                  setForecastForm({
                    ...forecastForm,
                    periodStart:
                      value,
                  })
                }
              />

              <DateField
                label="Period end"
                value={
                  forecastForm.periodEnd
                }
                onChange={(
                  value,
                ) =>
                  setForecastForm({
                    ...forecastForm,
                    periodEnd:
                      value,
                  })
                }
              />

              <Field label="Resource type">
                <select
                  value={
                    forecastForm.resourceType
                  }
                  onChange={(
                    event,
                  ) =>
                    setForecastForm({
                      ...forecastForm,
                      resourceType:
                        event.target.value as ResourceDemandType,
                    })
                  }
                >
                  <option value="LABOR">
                    Labor
                  </option>

                  <option value="EQUIPMENT">
                    Equipment
                  </option>
                </select>
              </Field>

              <Field label="Resource">
                <input
                  required
                  placeholder="e.g. Electricians"
                  value={
                    forecastForm.resourceKey
                  }
                  onChange={(
                    event,
                  ) =>
                    setForecastForm({
                      ...forecastForm,
                      resourceKey:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <NumberField
                label="Required quantity"
                value={
                  forecastForm.requiredQuantity
                }
                onChange={(
                  value,
                ) =>
                  setForecastForm({
                    ...forecastForm,
                    requiredQuantity:
                      value,
                  })
                }
              />

              <NumberField
                label="Available quantity"
                value={
                  forecastForm.availableQuantity
                }
                onChange={(
                  value,
                ) =>
                  setForecastForm({
                    ...forecastForm,
                    availableQuantity:
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
                    forecastForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setForecastForm({
                      ...forecastForm,
                      notes:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <FormActions
                busy={busy}
                onCancel={() =>
                  setPanel(null)
                }
              />
            </form>
          </Panel>
        )}

        <section
          className="resource-card"
          id="workforce-plan"
        >
          <CardHeader
            eyebrow="WORKFORCE PLANNING"
            title="Labor plans"
            value={`${workforcePlans.length} plans`}
          />

          <TableWrap>
            <table className="resource-table">
              <thead>
                <tr>
                  <th>TRADE</th>
                  <th>PERIOD</th>
                  <th>WORKERS</th>
                  <th>REGULAR HOURS</th>
                  <th>PRODUCTIVE HOURS</th>
                  <th>PRODUCTIVITY PLAN</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {workforcePlans.map(
                  (
                    plan,
                  ) => (
                    <tr key={plan.id}>
                      <td>
                        <NameCell
                          code={plan.trade}
                          title={
                            plan.workPackageId
                              ? "Work-package linked"
                              : "Project-level plan"
                          }
                        />
                      </td>

                      <td>
                        {formatDate(
                          plan.periodStart,
                        )}
                        {" — "}
                        {formatDate(
                          plan.periodEnd,
                        )}
                      </td>

                      <td>
                        {
                          plan.plannedWorkers
                        }
                      </td>

                      <td>
                        {
                          plan.plannedRegularHours
                        }
                      </td>

                      <td>
                        {
                          plan.plannedProductiveHours
                        }
                      </td>

                      <td>
                        {plan.plannedProductivityRate ??
                          "—"}
                      </td>

                      <td>
                        <select
                          className="resource-select"
                          disabled={busy}
                          value={plan.status}
                          onChange={(
                            event,
                          ) =>
                            void changePlanStatus(
                              plan,
                              event.target.value as WorkforcePlanStatus,
                            )
                          }
                        >
                          {planStatuses(
                            plan.status,
                          ).map(
                            (
                              status,
                            ) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {status}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                    </tr>
                  ),
                )}

                {workforcePlans.length ===
                  0 && (
                  <EmptyRow
                    columns={7}
                    text="No workforce plans."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section
          className="resource-card"
          id="deployment"
        >
          <CardHeader
            eyebrow="LABOR PERFORMANCE"
            title="Daily workforce deployment"
            value={`${deployments.length} records`}
          />

          <TableWrap>
            <table className="resource-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>TRADE</th>
                  <th>WORKERS</th>
                  <th>LABOR HOURS</th>
                  <th>OVERTIME</th>
                  <th>PRODUCTIVE</th>
                  <th>QUANTITY</th>
                  <th>PRODUCTIVITY INDEX</th>
                </tr>
              </thead>

              <tbody>
                {deployments.map(
                  (
                    item,
                  ) => (
                    <tr key={item.id}>
                      <td>
                        {formatDate(
                          item.workDate,
                        )}
                      </td>

                      <td>
                        {
                          item.trade
                        }
                      </td>

                      <td>
                        {
                          item.workers
                        }
                      </td>

                      <td>
                        {
                          item.totalLaborHours
                        }
                      </td>

                      <td>
                        {
                          item.overtimeHours
                        }
                      </td>

                      <td>
                        {
                          item.productiveHours
                        }
                      </td>

                      <td>
                        {
                          item.quantityCompleted
                        }
                      </td>

                      <td
                        className={
                          Number(
                            item.productivityIndex,
                          ) > 0
                          &&
                          Number(
                            item.productivityIndex,
                          ) < 0.85
                            ? "resource-negative"
                            : ""
                        }
                      >
                        {Number(
                          item.productivityIndex,
                        ) > 0
                          ? `${Number(
                              item.productivityIndex,
                            ).toFixed(
                              2,
                            )}x`
                          : "—"}
                      </td>
                    </tr>
                  ),
                )}

                {deployments.length ===
                  0 && (
                  <EmptyRow
                    columns={8}
                    text="No workforce deployment records."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section
          className="resource-card"
          id="equipment"
        >
          <CardHeader
            eyebrow="PLANT & EQUIPMENT"
            title="Equipment register"
            value={`${equipment.length} assets`}
          />

          <TableWrap>
            <table className="resource-table">
              <thead>
                <tr>
                  <th>EQUIPMENT</th>
                  <th>CATEGORY</th>
                  <th>OWNERSHIP</th>
                  <th>DAILY COST</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {equipment.map(
                  (
                    item,
                  ) => (
                    <tr
                      key={item.id}
                      className={
                        item.status ===
                        "IDLE"
                          ? "resource-warning-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={item.code}
                          title={
                            item.description
                          }
                        />
                      </td>

                      <td>
                        {
                          item.category
                        }
                      </td>

                      <td>
                        {
                          item.ownership
                        }
                      </td>

                      <td>
                        {money(
                          Number(
                            item.dailyCost,
                          ),
                        )}
                      </td>

                      <td>
                        <select
                          className="resource-select"
                          disabled={busy}
                          value={item.status}
                          onChange={(
                            event,
                          ) =>
                            void changeEquipmentStatus(
                              item,
                              event.target.value as EquipmentStatus,
                            )
                          }
                        >
                          {equipmentStatuses(
                            item.status,
                          ).map(
                            (
                              status,
                            ) => (
                              <option
                                key={status}
                                value={status}
                              >
                                {status.replaceAll(
                                  "_",
                                  " ",
                                )}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                    </tr>
                  ),
                )}

                {equipment.length ===
                  0 && (
                  <EmptyRow
                    columns={5}
                    text="No equipment registered."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>

          <div className="resource-subtable-title">
            Recent equipment utilization
          </div>

          <TableWrap>
            <table className="resource-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>EQUIPMENT</th>
                  <th>AVAILABLE</th>
                  <th>OPERATING</th>
                  <th>IDLE</th>
                  <th>DOWNTIME</th>
                  <th>UTILIZATION</th>
                </tr>
              </thead>

              <tbody>
                {equipmentUsage.map(
                  (
                    usage,
                  ) => (
                    <tr key={usage.id}>
                      <td>
                        {formatDate(
                          usage.workDate,
                        )}
                      </td>

                      <td>
                        {
                          usage.equipmentCode
                        }
                      </td>

                      <td>
                        {
                          usage.availableHours
                        }
                      </td>

                      <td>
                        {
                          usage.operatingHours
                        }
                      </td>

                      <td>
                        {
                          usage.idleHours
                        }
                      </td>

                      <td>
                        {
                          usage.downtimeHours
                        }
                      </td>

                      <td
                        className={
                          usage.utilizationPercentage <
                          55
                            ? "resource-negative"
                            : ""
                        }
                      >
                        {usage.utilizationPercentage.toFixed(
                          1,
                        )}
                        %
                      </td>
                    </tr>
                  ),
                )}

                {equipmentUsage.length ===
                  0 && (
                  <EmptyRow
                    columns={7}
                    text="No equipment usage recorded."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section
          className="resource-card"
          id="forecast"
        >
          <CardHeader
            eyebrow="FORWARD CAPACITY"
            title="Forward resource capacity"
            value={`${intelligence.openResourceForecasts} open`}
          />

          <TableWrap>
            <table className="resource-table">
              <thead>
                <tr>
                  <th>RESOURCE</th>
                  <th>TYPE</th>
                  <th>PERIOD</th>
                  <th>REQUIRED</th>
                  <th>AVAILABLE</th>
                  <th>SHORTAGE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {forecasts.map(
                  (
                    forecast,
                  ) => (
                    <tr
                      key={forecast.id}
                      className={
                        Number(
                          forecast.shortage,
                        ) > 0
                          ? "resource-warning-row"
                          : ""
                      }
                    >
                      <td>
                        <strong>
                          {
                            forecast.resourceKey
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          forecast.resourceType
                        }
                      </td>

                      <td>
                        {formatDate(
                          forecast.periodStart,
                        )}
                        {" — "}
                        {formatDate(
                          forecast.periodEnd,
                        )}
                      </td>

                      <td>
                        {
                          forecast.requiredQuantity
                        }
                      </td>

                      <td>
                        {
                          forecast.availableQuantity
                        }
                      </td>

                      <td
                        className={
                          Number(
                            forecast.shortage,
                          ) > 0
                            ? "resource-negative"
                            : "resource-positive"
                        }
                      >
                        {
                          forecast.shortage
                        }
                      </td>

                      <td>
                        <button
                          type="button"
                          className="resource-status-button"
                          disabled={busy}
                          onClick={() =>
                            void toggleForecast(
                              forecast,
                            )
                          }
                        >
                          {
                            forecast.status
                          }
                        </button>
                      </td>
                    </tr>
                  ),
                )}

                {forecasts.length ===
                  0 && (
                  <EmptyRow
                    columns={7}
                    text="No resource forecasts."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <footer className="command-footer">
          <div>
            BuildSight · Resource Intelligence
          </div>

          <div>
            {deployments.length} deployments
            {" · "}
            {equipment.length} assets
            {" · "}
            {forecasts.length} forecasts
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
          ? "resource-kpi resource-kpi-emphasis"
          : "resource-kpi"
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
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="resource-intelligence-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function CardHeader({
  eyebrow,
  title,
  value,
}: {
  eyebrow: string;
  title: string;
  value: string;
}) {
  return (
    <div className="resource-card-header">
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

function Panel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section className="resource-form-panel">
      <div className="resource-card-header">
        <div>
          <div className="eyebrow">
            RESOURCE CONTROL INPUT
          </div>

          <h2>
            {title}
          </h2>
        </div>

        <button
          type="button"
          className="close-button"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  children,
  wide = false,
  full = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  full?: boolean;
}) {
  return (
    <label
      className={
        full
          ? "field-full"
          : wide
            ? "field-wide"
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
        min={0}
        step={step}
        type="number"
        value={value}
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

function DateField({
  label,
  value,
  onChange,
  max,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  max?: string;
}) {
  return (
    <Field label={label}>
      <input
        required
        type="date"
        max={max}
        value={value}
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
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
        onClick={onCancel}
      >
        Cancel
      </button>

      <button
        type="submit"
        className="primary-button"
        disabled={busy}
      >
        {busy
          ? "Saving..."
          : "Save"}
      </button>
    </div>
  );
}

function TableWrap({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="resource-table-wrapper">
      {children}
    </div>
  );
}

function NameCell({
  code,
  title,
}: {
  code: string;
  title: string;
}) {
  return (
    <div className="resource-name-cell">
      <strong>
        {code}
      </strong>

      <span>
        {title}
      </span>
    </div>
  );
}

function EmptyRow({
  columns,
  text,
}: {
  columns: number;
  text: string;
}) {
  return (
    <tr>
      <td colSpan={columns}>
        <div className="table-message">
          {text}
        </div>
      </td>
    </tr>
  );
}
