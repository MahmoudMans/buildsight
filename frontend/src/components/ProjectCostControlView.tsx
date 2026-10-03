"use client";

import Link from "next/link";
import costRefinement from "./ProjectCostControlRefinement.module.css";
import { ProjectWorkspaceSidebar } from "./ProjectWorkspaceSidebar";
import { FinancialControlTabs } from "./FinancialControlTabs";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BuildSightApiError,
  createProjectActualCost,
  createProjectBudgetLine,
  createProjectCommitment,
  createProjectCostCode,
  getProjectCostControl,
  updateProjectBudgetLine,
  updateProjectCommitment,
} from "@/lib/api";

import type {
  BudgetLine,
  Commitment,
  CommitmentStatus,
  CostCodeCategory,
  CostControl,
  CostRiskLevel,
  CreateActualCostInput,
  CreateBudgetLineInput,
  CreateCommitmentInput,
  CreateCostCodeInput,
} from "@/types/project";

type CostForm =
  | "cost-code"
  | "budget"
  | "commitment"
  | "actual"
  | null;

const categoryLabels: Record<
  CostCodeCategory,
  string
> = {
  PRELIMINARIES:
    "Preliminaries",
  STRUCTURE:
    "Structure",
  ARCHITECTURAL:
    "Architectural",
  MEP:
    "MEP",
  EXTERNAL_WORKS:
    "External works",
  PROFESSIONAL_FEES:
    "Professional fees",
  CONTINGENCY:
    "Contingency",
  OTHER:
    "Other",
};

const commitmentLabels: Record<
  CommitmentStatus,
  string
> = {
  DRAFT:
    "Draft",
  APPROVED:
    "Approved",
  CLOSED:
    "Closed",
  CANCELLED:
    "Cancelled",
};

const riskLabels: Record<
  CostRiskLevel,
  string
> = {
  NO_BASELINE:
    "No baseline",
  ON_TRACK:
    "On track",
  WATCH:
    "Watch",
  AT_RISK:
    "At risk",
};

function todayValue(): string {
  const date =
    new Date();

  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      "0",
    );

  const day =
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    );

  return `${year}-${month}-${day}`;
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

function compactMoney(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "EUR",
      notation: "compact",
      maximumFractionDigits: 2,
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

function riskClass(
  risk: CostRiskLevel,
): string {
  return `cost-risk cost-risk-${risk
    .toLowerCase()
    .replace(
      "_",
      "-",
    )}`;
}

function commitmentClass(
  status: CommitmentStatus,
): string {
  return `commitment-status commitment-${status.toLowerCase()}`;
}

function allowedCommitmentStatuses(
  current: CommitmentStatus,
): CommitmentStatus[] {
  switch (current) {
    case "DRAFT":
      return [
        "DRAFT",
        "APPROVED",
        "CANCELLED",
      ];

    case "APPROVED":
      return [
        "APPROVED",
        "CLOSED",
        "CANCELLED",
      ];

    case "CLOSED":
      return [
        "CLOSED",
      ];

    case "CANCELLED":
      return [
        "CANCELLED",
      ];
  }
}

const defaultCostCode: CreateCostCodeInput = {
  code: "",
  name: "",
  category:
    "PRELIMINARIES",
  description: "",
  sortOrder: 10,
};

const defaultBudget: CreateBudgetLineInput = {
  costCodeId: "",
  description: "",
  originalBudget: 0,
  approvedChanges: 0,
  forecastCost: null,
};

const defaultCommitment: CreateCommitmentInput = {
  costCodeId: "",
  reference: "",
  vendorName: "",
  description: "",
  committedAmount: 0,
  status:
    "DRAFT",
  commitmentDate:
    todayValue(),
};

const defaultActual: CreateActualCostInput = {
  costCodeId: "",
  commitmentId: null,
  reference: "",
  supplierName: "",
  description: "",
  amount: 0,
  costDate:
    todayValue(),
};

export function ProjectCostControlView({
  projectId,
}: {
  projectId: string;
}) {
  const [data, setData] =
    useState<CostControl | null>(
      null,
    );

  const [loading, setLoading] =
    useState(
      true,
    );

  const [busy, setBusy] =
    useState(
      false,
    );

  const [error, setError] =
    useState(
      "",
    );

  const [openForm, setOpenForm] =
    useState<CostForm>(
      null,
    );

  const [
    costCodeForm,
    setCostCodeForm,
  ] =
    useState<CreateCostCodeInput>(
      defaultCostCode,
    );

  const [
    budgetForm,
    setBudgetForm,
  ] =
    useState<CreateBudgetLineInput>(
      defaultBudget,
    );

  const [
    commitmentForm,
    setCommitmentForm,
  ] =
    useState<CreateCommitmentInput>(
      defaultCommitment,
    );

  const [
    actualForm,
    setActualForm,
  ] =
    useState<CreateActualCostInput>(
      defaultActual,
    );

  const [
    forecastDrafts,
    setForecastDrafts,
  ] =
    useState<
      Record<string, string>
    >(
      {},
    );

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectCostControl(
        projectId,
      )
        .then(
          (
            response,
          ) => {
            if (
              cancelled
            ) {
              return;
            }

            setData(
              response,
            );

            setForecastDrafts(
              Object.fromEntries(
                response.budgetLines.map(
                  (
                    line,
                  ) => [
                    line.id,
                    String(
                      line.forecastCost,
                    ),
                  ],
                ),
              ),
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
                "BuildSight could not reach the local backend.",
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
    [
      projectId,
    ],
  );

  async function refresh() {
    const response =
      await getProjectCostControl(
        projectId,
      );

    setData(
      response,
    );

    setForecastDrafts(
      Object.fromEntries(
        response.budgetLines.map(
          (
            line,
          ) => [
            line.id,
            String(
              line.forecastCost,
            ),
          ],
        ),
      ),
    );
  }

  async function runAction(
    action: () => Promise<unknown>,
  ) {
    setBusy(
      true,
    );

    setError(
      "",
    );

    try {
      await action();

      await refresh();
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
          "The local backend request failed.",
        );
      }

      throw caught;
    } finally {
      setBusy(
        false,
      );
    }
  }

  const approvedCommitments =
    useMemo(
      () =>
        data?.commitments.filter(
          (
            commitment,
          ) =>
            commitment.status
              ===
              "APPROVED",
        ) ?? [],
      [
        data,
      ],
    );

  async function submitCostCode(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      await runAction(
        () =>
          createProjectCostCode(
            projectId,
            costCodeForm,
          ),
      );

      setCostCodeForm(
        defaultCostCode,
      );

      setOpenForm(
        null,
      );
    } catch {
      // Error is already surfaced.
    }
  }

  async function submitBudget(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      await runAction(
        () =>
          createProjectBudgetLine(
            projectId,
            budgetForm,
          ),
      );

      setBudgetForm(
        defaultBudget,
      );

      setOpenForm(
        null,
      );
    } catch {
      // Error is already surfaced.
    }
  }

  async function submitCommitment(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      await runAction(
        () =>
          createProjectCommitment(
            projectId,
            commitmentForm,
          ),
      );

      setCommitmentForm({
        ...defaultCommitment,
        commitmentDate:
          todayValue(),
      });

      setOpenForm(
        null,
      );
    } catch {
      // Error is already surfaced.
    }
  }

  async function submitActual(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      await runAction(
        () =>
          createProjectActualCost(
            projectId,
            actualForm,
          ),
      );

      setActualForm({
        ...defaultActual,
        costDate:
          todayValue(),
      });

      setOpenForm(
        null,
      );
    } catch {
      // Error is already surfaced.
    }
  }

  async function saveForecast(
    line: BudgetLine,
  ) {
    const forecast =
      Number(
        forecastDrafts[
          line.id
        ] ??
          line.forecastCost,
      );

    try {
      await runAction(
        () =>
          updateProjectBudgetLine(
            projectId,
            line.id,
            {
              version:
                line.version,
              description:
                line.description ??
                "",
              originalBudget:
                Number(
                  line.originalBudget,
                ),
              approvedChanges:
                Number(
                  line.approvedChanges,
                ),
              forecastCost:
                forecast,
            },
          ),
      );
    } catch {
      // Error is already surfaced.
    }
  }

  async function changeCommitmentStatus(
    commitment: Commitment,
    status: CommitmentStatus,
  ) {
    if (
      commitment.status
      ===
      status
    ) {
      return;
    }

    try {
      await runAction(
        () =>
          updateProjectCommitment(
            projectId,
            commitment.id,
            {
              version:
                commitment.version,
              vendorName:
                commitment.vendorName,
              description:
                commitment.description ??
                "",
              committedAmount:
                Number(
                  commitment.committedAmount,
                ),
              status,
              commitmentDate:
                commitment.commitmentDate,
            },
          ),
      );
    } catch {
      // Error is already surfaced.
    }
  }

  function openBudgetForm() {
    setBudgetForm({
      ...defaultBudget,
      costCodeId:
        data?.costCodes[
          0
        ]?.id ??
        "",
    });

    setOpenForm(
      "budget",
    );
  }

  function openCommitmentForm() {
    setCommitmentForm({
      ...defaultCommitment,
      costCodeId:
        data?.costCodes[
          0
        ]?.id ??
        "",
      commitmentDate:
        todayValue(),
    });

    setOpenForm(
      "commitment",
    );
  }

  function openActualForm() {
    setActualForm({
      ...defaultActual,
      costCodeId:
        data?.costCodes[
          0
        ]?.id ??
        "",
      costDate:
        todayValue(),
    });

    setOpenForm(
      "actual",
    );
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
          Loading cost intelligence...
        </strong>
      </main>
    );
  }

  if (
    !data
  ) {
    return (
      <main className="command-error-page">
        <div className="command-error-card">
          <div className="brand-mark">
            B
          </div>

          <h1>
            Cost control unavailable
          </h1>

          <p>
            {error ||
              "BuildSight could not load project cost data."}
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
    costCodes,
    budgetLines,
    commitments,
    actualCosts,
  } = data;

  return (
    <div className="cost-shell">
      <ProjectWorkspaceSidebar
        projectId={projectId}
        projectCode={project.code}
        className="cost-sidebar"
        localLinks={[
          { href: "#budget", label: "Budget plan" },
          { href: "#commitments", label: "Commitments" },
          { href: "#actuals", label: "Actual costs" },
        ]}
      />

      <main className={`cost-main ${costRefinement.root}`}>
        <header className="cost-topbar">
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
              COST CONTROL
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Budget planning, commitments,
              actual expenditure and
              forecast-at-completion.
            </p>
            <div className={costRefinement.reportingContext}>
              <span>
                REPORTING CONTEXT
              </span>

              <strong>
                Live cost position
              </strong>

              <Link
                href={`/projects/${projectId}/period-control`}
              >
                Open reporting periods
              </Link>
            </div>
          </div>

          <div className="cost-header-risk">
            <span>
              COST HEALTH
            </span>

            <strong>
              {intelligence.costScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={
                riskClass(
                  intelligence.costRisk,
                )
              }
            >
              {
                riskLabels[
                  intelligence.costRisk
                ]
              }
            </i>
          </div>
        </header>

        <FinancialControlTabs
          projectId={projectId}
        />

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

        <section className="cost-kpi-grid">
          <CostKpi
            label="REVISED COST PLAN"
            value={compactMoney(
              Number(
                intelligence.revisedCostPlan,
              ),
            )}
            detail={`Approved changes ${money(
              Number(
                intelligence.approvedChanges,
              ),
            )}`}
          />

          <CostKpi
            label="ACTUAL COST"
            value={compactMoney(
              Number(
                intelligence.actualCosts,
              ),
            )}
            detail={`${intelligence.budgetUtilizationPercentage.toFixed(
              1,
            )}% of revised plan`}
          />

          <CostKpi
            label="OUTSTANDING COMMITMENTS"
            value={compactMoney(
              Number(
                intelligence.outstandingCommitments,
              ),
            )}
            detail={`Approved ${money(
              Number(
                intelligence.totalApprovedCommitments,
              ),
            )}`}
          />

          <CostKpi
            label="FORECAST AT COMPLETION"
            value={compactMoney(
              Number(
                intelligence.forecastAtCompletion,
              ),
            )}
            detail={`Forecast variance ${money(
              Number(
                intelligence.varianceAtCompletion,
              ),
            )}`}
            emphasis
          />
        </section>

        <section className="cost-intelligence-panel">
          <div className={costRefinement.intelligenceIntro}>
            <span>
              COST INTELLIGENCE
            </span>

            <strong>
              Cost exposure explained
            </strong>

            <p>
              Use the control metrics beside this panel to read
              allocation, commitment coverage, forecast exposure
              and variance at completion.
            </p>
          </div>

          <div className="cost-intelligence-metrics">
            <CostMetric
              label="Project approved budget"
              value={money(
                Number(
                  intelligence.projectApprovedBudget,
                ),
              )}
            />

            <CostMetric
              label="Unallocated budget"
              value={money(
                Number(
                  intelligence.unallocatedBudget,
                ),
              )}
            />

            <CostMetric
              label="Committed exposure"
              value={`${intelligence.committedExposurePercentage.toFixed(
                1,
              )}%`}
            />

            <CostMetric
              label="Forecast variance"
              value={`${intelligence.forecastVariancePercentage > 0 ? "+" : ""}${intelligence.forecastVariancePercentage.toFixed(
                1,
              )}%`}
            />

            <CostMetric
              label="Forecast overrun"
              value={money(
                Number(
                  intelligence.overrunAmount,
                ),
              )}
            />

            <CostMetric
              label="VAC"
              value={money(
                Number(
                  intelligence.varianceAtCompletion,
                ),
              )}
            />
          </div>

          <p>
            {intelligence.explanation}
          </p>
        </section>



        {openForm ===
          "cost-code" && (
          <CostFormPanel
            title="Create cost code"
            onClose={() =>
              setOpenForm(
                null,
              )
            }
          >
            <form
              className="cost-form-grid"
              onSubmit={
                submitCostCode
              }
            >
              <label>
                <span>
                  Code
                </span>

                <input
                  required
                  value={
                    costCodeForm.code
                  }
                  onChange={(
                    event,
                  ) =>
                    setCostCodeForm({
                      ...costCodeForm,
                      code:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Name
                </span>

                <input
                  required
                  value={
                    costCodeForm.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setCostCodeForm({
                      ...costCodeForm,
                      name:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Category
                </span>

                <select
                  value={
                    costCodeForm.category
                  }
                  onChange={(
                    event,
                  ) =>
                    setCostCodeForm({
                      ...costCodeForm,
                      category:
                        event.target
                          .value as CostCodeCategory,
                    })
                  }
                >
                  {(
                    Object.keys(
                      categoryLabels,
                    ) as CostCodeCategory[]
                  ).map(
                    (
                      category,
                    ) => (
                      <option
                        key={
                          category
                        }
                        value={
                          category
                        }
                      >
                        {
                          categoryLabels[
                            category
                          ]
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Sort order
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  value={
                    costCodeForm.sortOrder
                  }
                  onChange={(
                    event,
                  ) =>
                    setCostCodeForm({
                      ...costCodeForm,
                      sortOrder:
                        Number(
                          event.target
                            .value,
                        ),
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Description
                </span>

                <textarea
                  rows={3}
                  value={
                    costCodeForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setCostCodeForm({
                      ...costCodeForm,
                      description:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setOpenForm(
                    null,
                  )
                }
              />
            </form>
          </CostFormPanel>
        )}

        {openForm ===
          "budget" && (
          <CostFormPanel
            title="Create budget line"
            onClose={() =>
              setOpenForm(
                null,
              )
            }
          >
            <form
              className="cost-form-grid"
              onSubmit={
                submitBudget
              }
            >
              <CostCodeSelect
                costCodes={
                  costCodes
                }
                value={
                  budgetForm.costCodeId
                }
                onChange={(
                  value,
                ) =>
                  setBudgetForm({
                    ...budgetForm,
                    costCodeId:
                      value,
                  })
                }
              />

              <label>
                <span>
                  Original budget
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    budgetForm.originalBudget
                  }
                  onChange={(
                    event,
                  ) =>
                    setBudgetForm({
                      ...budgetForm,
                      originalBudget:
                        Number(
                          event.target
                            .value,
                        ),
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Approved changes
                </span>

                <input
                  required
                  type="number"
                  step="0.01"
                  value={
                    budgetForm.approvedChanges
                  }
                  onChange={(
                    event,
                  ) =>
                    setBudgetForm({
                      ...budgetForm,
                      approvedChanges:
                        Number(
                          event.target
                            .value,
                        ),
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Forecast cost
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Defaults to revised budget"
                  value={
                    budgetForm.forecastCost ??
                    ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setBudgetForm({
                      ...budgetForm,
                      forecastCost:
                        event.target
                            .value
                          ? Number(
                              event.target
                                .value,
                            )
                          : null,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Description
                </span>

                <textarea
                  rows={3}
                  value={
                    budgetForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setBudgetForm({
                      ...budgetForm,
                      description:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setOpenForm(
                    null,
                  )
                }
              />
            </form>
          </CostFormPanel>
        )}

        {openForm ===
          "commitment" && (
          <CostFormPanel
            title="Create commitment"
            onClose={() =>
              setOpenForm(
                null,
              )
            }
          >
            <form
              className="cost-form-grid"
              onSubmit={
                submitCommitment
              }
            >
              <CostCodeSelect
                costCodes={
                  costCodes
                }
                value={
                  commitmentForm.costCodeId
                }
                onChange={(
                  value,
                ) =>
                  setCommitmentForm({
                    ...commitmentForm,
                    costCodeId:
                      value,
                  })
                }
              />

              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  placeholder="PO-2026-001"
                  value={
                    commitmentForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setCommitmentForm({
                      ...commitmentForm,
                      reference:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Vendor
                </span>

                <input
                  required
                  value={
                    commitmentForm.vendorName
                  }
                  onChange={(
                    event,
                  ) =>
                    setCommitmentForm({
                      ...commitmentForm,
                      vendorName:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Amount
                </span>

                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    commitmentForm.committedAmount
                  }
                  onChange={(
                    event,
                  ) =>
                    setCommitmentForm({
                      ...commitmentForm,
                      committedAmount:
                        Number(
                          event.target
                            .value,
                        ),
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Initial status
                </span>

                <select
                  value={
                    commitmentForm.status
                  }
                  onChange={(
                    event,
                  ) =>
                    setCommitmentForm({
                      ...commitmentForm,
                      status:
                        event.target
                          .value as CommitmentStatus,
                    })
                  }
                >
                  <option value="DRAFT">
                    Draft
                  </option>

                  <option value="APPROVED">
                    Approved
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Commitment date
                </span>

                <input
                  required
                  type="date"
                  value={
                    commitmentForm.commitmentDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setCommitmentForm({
                      ...commitmentForm,
                      commitmentDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Description
                </span>

                <textarea
                  rows={3}
                  value={
                    commitmentForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setCommitmentForm({
                      ...commitmentForm,
                      description:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setOpenForm(
                    null,
                  )
                }
              />
            </form>
          </CostFormPanel>
        )}

        {openForm ===
          "actual" && (
          <CostFormPanel
            title="Record actual cost"
            onClose={() =>
              setOpenForm(
                null,
              )
            }
          >
            <form
              className="cost-form-grid"
              onSubmit={
                submitActual
              }
            >
              <CostCodeSelect
                costCodes={
                  costCodes
                }
                value={
                  actualForm.costCodeId
                }
                onChange={(
                  value,
                ) =>
                  setActualForm({
                    ...actualForm,
                    costCodeId:
                      value,
                    commitmentId:
                      null,
                  })
                }
              />

              <label>
                <span>
                  Linked commitment
                </span>

                <select
                  value={
                    actualForm.commitmentId ??
                    ""
                  }
                  onChange={(
                    event,
                  ) => {
                    const value =
                      event.target
                        .value;

                    const commitment =
                      approvedCommitments.find(
                        (
                          candidate,
                        ) =>
                          candidate.id
                          ===
                          value,
                      );

                    setActualForm({
                      ...actualForm,
                      commitmentId:
                        value ||
                        null,
                      costCodeId:
                        commitment
                          ? commitment.costCodeId
                          : actualForm.costCodeId,
                    });
                  }}
                >
                  <option value="">
                    No commitment
                  </option>

                  {approvedCommitments.map(
                    (
                      commitment,
                    ) => (
                      <option
                        key={
                          commitment.id
                        }
                        value={
                          commitment.id
                        }
                      >
                        {
                          commitment.reference
                        }
                        {" — "}
                        {
                          commitment.vendorName
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Invoice / cost reference
                </span>

                <input
                  required
                  value={
                    actualForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setActualForm({
                      ...actualForm,
                      reference:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Supplier
                </span>

                <input
                  required
                  value={
                    actualForm.supplierName
                  }
                  onChange={(
                    event,
                  ) =>
                    setActualForm({
                      ...actualForm,
                      supplierName:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Amount
                </span>

                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    actualForm.amount
                  }
                  onChange={(
                    event,
                  ) =>
                    setActualForm({
                      ...actualForm,
                      amount:
                        Number(
                          event.target
                            .value,
                        ),
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Cost date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    actualForm.costDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setActualForm({
                      ...actualForm,
                      costDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Description
                </span>

                <textarea
                  rows={3}
                  value={
                    actualForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setActualForm({
                      ...actualForm,
                      description:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setOpenForm(
                    null,
                  )
                }
              />
            </form>
          </CostFormPanel>
        )}

        <section
          className="cost-card"
          id="budget"
        >
          <div className="cost-card-header">
            <div>
              <div className="eyebrow">
                COST PLAN
              </div>

              <h2>
                Budget lines
              </h2>
            </div>

            <span>
              {
                budgetLines.length
              }{" "}
              lines
            </span>

            <div className={costRefinement.sectionActions}>
              <button
                          type="button"
                          onClick={() =>
                            setOpenForm(
                              "cost-code",
                            )
                          }
                        >
                          + Cost code
                        </button>
              <button
                          type="button"
                          disabled={
                            costCodes.length
                            ===
                            0
                          }
                          onClick={
                            openBudgetForm
                          }
                        >
                          + Budget line
                        </button>
            </div>
          </div>

          <div className="cost-table-wrapper">
            <table className="cost-table">
              <thead>
                <tr>
                  <th>
                    COST CODE
                  </th>
                  <th>
                    ORIGINAL
                  </th>
                  <th>
                    CHANGES
                  </th>
                  <th>
                    REVISED
                  </th>
                  <th>
                    FORECAST
                  </th>
                  <th>
                    VARIANCE
                  </th>
                  <th>
                    ACTION
                  </th>
                </tr>
              </thead>

              <tbody>
                {budgetLines.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={
                        7
                      }
                    >
                      <div className="table-message">
                        No budget lines yet.
                      </div>
                    </td>
                  </tr>
                ) : (
                  budgetLines.map(
                    (
                      line,
                    ) => (
                      <tr
                        key={
                          line.id
                        }
                      >
                        <td>
                          <div className="cost-code-cell">
                            <strong>
                              {
                                line.costCode
                              }
                            </strong>

                            <span>
                              {
                                line.costCodeName
                              }
                            </span>
                          </div>
                        </td>

                        <td>
                          {money(
                            Number(
                              line.originalBudget,
                            ),
                          )}
                        </td>

                        <td>
                          {money(
                            Number(
                              line.approvedChanges,
                            ),
                          )}
                        </td>

                        <td>
                          <strong>
                            {money(
                              Number(
                                line.revisedBudget,
                              ),
                            )}
                          </strong>
                        </td>

                        <td>
                          <input
                            className="forecast-inline-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              forecastDrafts[
                                line.id
                              ] ??
                              String(
                                line.forecastCost,
                              )
                            }
                            onChange={(
                              event,
                            ) =>
                              setForecastDrafts({
                                ...forecastDrafts,
                                [line.id]:
                                  event.target
                                    .value,
                              })
                            }
                          />
                        </td>

                        <td>
                          <span
                            className={
                              Number(
                                line.forecastVariance,
                              ) <
                              0
                                ? "negative-variance"
                                : "positive-variance"
                            }
                          >
                            {money(
                              Number(
                                line.forecastVariance,
                              ),
                            )}
                          </span>
                        </td>

                        <td>
                          <button
                            className="table-action-button"
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void saveForecast(
                                line,
                              )
                            }
                          >
                            Save forecast
                          </button>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="cost-card"
          id="commitments"
        >
          <div className="cost-card-header">
            <div>
              <div className="eyebrow">
                COMMITMENT EXPOSURE
              </div>

              <h2>
                Commitments
              </h2>
            </div>

            <strong>
              {money(
                Number(
                  intelligence.totalApprovedCommitments,
                ),
              )}
            </strong>

            <div className={costRefinement.sectionActions}>
              <button
                          type="button"
                          disabled={
                            costCodes.length
                            ===
                            0
                          }
                          onClick={
                            openCommitmentForm
                          }
                        >
                          + Commitment
                        </button>
            </div>
          </div>

          <div className="cost-table-wrapper">
            <table className="cost-table commitment-table">
              <thead>
                <tr>
                  <th>
                    REFERENCE
                  </th>
                  <th>
                    VENDOR
                  </th>
                  <th>
                    COST CODE
                  </th>
                  <th>
                    AMOUNT
                  </th>
                  <th>
                    DATE
                  </th>
                  <th>
                    STATUS
                  </th>
                </tr>
              </thead>

              <tbody>
                {commitments.map(
                  (
                    commitment,
                  ) => (
                    <tr
                      key={
                        commitment.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            commitment.reference
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          commitment.vendorName
                        }
                      </td>

                      <td>
                        {
                          commitment.costCode
                        }
                      </td>

                      <td>
                        {money(
                          Number(
                            commitment.committedAmount,
                          ),
                        )}
                      </td>

                      <td>
                        {formatDate(
                          commitment.commitmentDate,
                        )}
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          className={
                            commitmentClass(
                              commitment.status,
                            )
                          }
                          value={
                            commitment.status
                          }
                          onChange={(
                            event,
                          ) =>
                            void changeCommitmentStatus(
                              commitment,
                              event.target
                                .value as CommitmentStatus,
                            )
                          }
                        >
                          {allowedCommitmentStatuses(
                            commitment.status,
                          ).map(
                            (
                              status,
                            ) => (
                              <option
                                key={
                                  status
                                }
                                value={
                                  status
                                }
                              >
                                {
                                  commitmentLabels[
                                    status
                                  ]
                                }
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                    </tr>
                  ),
                )}

                {commitments.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        6
                      }
                    >
                      <div className="table-message">
                        No commitments recorded.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="cost-card"
          id="actuals"
        >
          <div className="cost-card-header">
            <div>
              <div className="eyebrow">
                COST LEDGER
              </div>

              <h2>
                Actual costs
              </h2>
            </div>

            <strong>
              {money(
                Number(
                  intelligence.actualCosts,
                ),
              )}
            </strong>

            <div className={costRefinement.sectionActions}>
              <button
                          type="button"
                          disabled={
                            costCodes.length
                            ===
                            0
                          }
                          onClick={
                            openActualForm
                          }
                        >
                          + Actual cost
                        </button>
            </div>
          </div>

          <div className="cost-table-wrapper">
            <table className="cost-table">
              <thead>
                <tr>
                  <th>
                    REFERENCE
                  </th>
                  <th>
                    SUPPLIER
                  </th>
                  <th>
                    COST CODE
                  </th>
                  <th>
                    COMMITMENT
                  </th>
                  <th>
                    DATE
                  </th>
                  <th>
                    AMOUNT
                  </th>
                </tr>
              </thead>

              <tbody>
                {actualCosts.map(
                  (
                    actual,
                  ) => (
                    <tr
                      key={
                        actual.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            actual.reference
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          actual.supplierName
                        }
                      </td>

                      <td>
                        {
                          actual.costCode
                        }
                      </td>

                      <td>
                        {actual.commitmentReference ??
                          "Uncommitted"}
                      </td>

                      <td>
                        {formatDate(
                          actual.costDate,
                        )}
                      </td>

                      <td>
                        <strong>
                          {money(
                            Number(
                              actual.amount,
                            ),
                          )}
                        </strong>
                      </td>
                    </tr>
                  ),
                )}

                {actualCosts.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        6
                      }
                    >
                      <div className="table-message">
                        No actual costs recorded.
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
            BuildSight · Cost Control
          </div>

          <div>
            {costCodes.length} cost codes
            {" · "}
            {budgetLines.length} budget lines
          </div>
        </footer>
      </main>
    </div>
  );
}

function CostKpi({
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
          ? "cost-kpi cost-kpi-emphasis"
          : "cost-kpi"
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

function CostMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="cost-intelligence-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function CostFormPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="cost-form-panel">
      <div className="cost-card-header">
        <div>
          <div className="eyebrow">
            COST CONTROL INPUT
          </div>

          <h2>
            {title}
          </h2>
        </div>

        <button
          className="close-button"
          type="button"
          onClick={
            onClose
          }
        >
          Close
        </button>
      </div>

      {children}
    </section>
  );
}

function CostCodeSelect({
  costCodes,
  value,
  onChange,
}: {
  costCodes: CostControl["costCodes"];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>
        Cost code
      </span>

      <select
        required
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target.value,
          )
        }
      >
        <option value="">
          Select cost code
        </option>

        {costCodes.map(
          (
            code,
          ) => (
            <option
              key={
                code.id
              }
              value={
                code.id
              }
            >
              {code.code}
              {" — "}
              {code.name}
            </option>
          ),
        )}
      </select>
    </label>
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
        className="secondary-button"
        type="button"
        onClick={
          onCancel
        }
      >
        Cancel
      </button>

      <button
        className="primary-button"
        type="submit"
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
