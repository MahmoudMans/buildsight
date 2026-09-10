"use client";

import Link from "next/link";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BuildSightApiError,
  changeProjectStatus,
  createProjectMilestone,
  getProjectCommandCenter,
  recordProjectProgress,
  updateProject,
  updateProjectMilestone,
} from "@/lib/api";

import type {
  CreateMilestoneInput,
  Milestone,
  MilestoneStatus,
  Project,
  ProjectCommandCenter,
  ProjectHealthBand,
  ProjectStatus,
  ScheduleRiskLevel,
  UpdateProjectInput,
} from "@/types/project";

const statusLabels: Record<
  ProjectStatus,
  string
> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const milestoneStatusLabels: Record<
  MilestoneStatus,
  string
> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
};

const healthLabels: Record<
  ProjectHealthBand,
  string
> = {
  HEALTHY: "Healthy",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const scheduleRiskLabels: Record<
  ScheduleRiskLevel,
  string
> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const allowedTransitions: Record<
  ProjectStatus,
  ProjectStatus[]
> = {
  PLANNING: [
    "ACTIVE",
    "ON_HOLD",
    "CANCELLED",
  ],
  ACTIVE: [
    "ON_HOLD",
    "COMPLETED",
    "CANCELLED",
  ],
  ON_HOLD: [
    "ACTIVE",
    "CANCELLED",
  ],
  COMPLETED: [],
  CANCELLED: [],
};

function localDateInputValue(): string {
  const date = new Date();

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function money(value: number): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    },
  ).format(value);
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
  ).format(value);
}

function formatDate(
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
    new Date(`${value}T00:00:00`),
  );
}

function statusClass(
  status: ProjectStatus,
): string {
  return `status-badge status-${status
    .toLowerCase()
    .replace("_", "-")}`;
}

function milestoneStatusClass(
  status: MilestoneStatus,
): string {
  return `milestone-status milestone-${status
    .toLowerCase()
    .replace("_", "-")}`;
}

function healthClass(
  band: ProjectHealthBand,
): string {
  return `health-band health-${band
    .toLowerCase()
    .replace("_", "-")}`;
}

function scheduleRiskClass(
  risk: ScheduleRiskLevel,
): string {
  return `schedule-risk risk-${risk
    .toLowerCase()
    .replace("_", "-")}`;
}

function varianceLabel(
  days: number,
): string {
  if (days > 0) {
    return `+${days} days`;
  }

  if (days < 0) {
    return `${days} days`;
  }

  return "0 days";
}

function percentageWidth(
  value: number,
): string {
  return `${Math.max(
    0,
    Math.min(
      100,
      value,
    ),
  )}%`;
}

function editInputFromProject(
  project: Project,
): UpdateProjectInput {
  return {
    version: project.version,
    name: project.name,
    description:
      project.description ?? "",
    clientName: project.clientName,
    location: project.location,
    contractValue:
      Number(project.contractValue),
    approvedBudget:
      Number(project.approvedBudget),
    plannedStartDate:
      project.plannedStartDate,
    plannedEndDate:
      project.plannedEndDate,
    forecastEndDate:
      project.forecastEndDate,
  };
}

const emptyMilestone: CreateMilestoneInput = {
  name: "",
  description: "",
  plannedDate: "",
  forecastDate: null,
  weightPercentage: 10,
  sortOrder: 10,
};

export function ProjectCommandCenterView({
  projectId,
}: {
  projectId: string;
}) {
  const [data, setData] =
    useState<ProjectCommandCenter | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [requestError, setRequestError] =
    useState("");

  const [actionBusy, setActionBusy] =
    useState(false);

  const [editOpen, setEditOpen] =
    useState(false);

  const [milestoneOpen, setMilestoneOpen] =
    useState(false);

  const [editForm, setEditForm] =
    useState<UpdateProjectInput | null>(
      null,
    );

  const [
    editFieldErrors,
    setEditFieldErrors,
  ] = useState<Record<string, string>>(
    {},
  );

  const [
    milestoneForm,
    setMilestoneForm,
  ] =
    useState<CreateMilestoneInput>(
      emptyMilestone,
    );

  const [progressValue, setProgressValue] =
    useState("");

  const [progressNote, setProgressNote] =
    useState("");

  const [progressDate, setProgressDate] =
    useState(localDateInputValue());

  const refresh = useCallback(
    async () => {
      try {
        const response =
          await getProjectCommandCenter(
            projectId,
          );

        setData(response);
        setRequestError("");

        setEditForm(
          editInputFromProject(
            response.project,
          ),
        );
      } catch (error) {
        if (
          error instanceof
          BuildSightApiError
        ) {
          setRequestError(
            error.message,
          );
        } else {
          setRequestError(
            "BuildSight could not reach the local backend.",
          );
        }
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    let cancelled = false;

    getProjectCommandCenter(projectId)
      .then((response) => {
        if (cancelled) {
          return;
        }

        setData(response);
        setRequestError("");
        setEditForm(
          editInputFromProject(
            response.project,
          ),
        );
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        if (
          error instanceof
          BuildSightApiError
        ) {
          setRequestError(
            error.message,
          );
        } else {
          setRequestError(
            "BuildSight could not reach the local backend.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const remainingBudget = useMemo(
    () => {
      if (!data) {
        return 0;
      }

      return (
        Number(
          data.project.contractValue,
        ) -
        Number(
          data.project.approvedBudget,
        )
      );
    },
    [data],
  );

  async function runAction(
    action: () => Promise<unknown>,
  ) {
    setActionBusy(true);
    setRequestError("");

    try {
      await action();
      await refresh();
    } catch (error) {
      if (
        error instanceof
        BuildSightApiError
      ) {
        setRequestError(
          error.message,
        );
      } else {
        setRequestError(
          "The local backend request failed.",
        );
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function handleStatusChange(
    status: ProjectStatus,
  ) {
    if (!data) {
      return;
    }

    await runAction(() =>
      changeProjectStatus(
        projectId,
        {
          version:
            data.project.version,
          status,
        },
      ),
    );
  }

  async function handleProgress(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!data) {
      return;
    }

    const progress =
      Number(progressValue);

    await runAction(() =>
      recordProjectProgress(
        projectId,
        {
          version:
            data.project.version,
          progressPercentage: progress,
          updateDate: progressDate,
          note: progressNote,
        },
      ),
    );

    setProgressValue("");
    setProgressNote("");
  }

  async function handleEdit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!editForm) {
      return;
    }

    setActionBusy(true);
    setRequestError("");
    setEditFieldErrors({});

    try {
      await updateProject(
        projectId,
        editForm,
      );

      await refresh();
      setEditOpen(false);
    } catch (error) {
      if (
        error instanceof
        BuildSightApiError
      ) {
        setRequestError(
          error.message,
        );

        setEditFieldErrors(
          error.fieldErrors,
        );
      } else {
        setRequestError(
          "The local backend request failed.",
        );
      }
    } finally {
      setActionBusy(false);
    }
  }

  async function handleMilestoneCreate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    await runAction(() =>
      createProjectMilestone(
        projectId,
        {
          ...milestoneForm,
          forecastDate:
            milestoneForm
              .forecastDate ||
            milestoneForm
              .plannedDate,
        },
      ),
    );

    setMilestoneForm(
      emptyMilestone,
    );

    setMilestoneOpen(false);
  }

  async function handleMilestoneStatus(
    milestone: Milestone,
    status: MilestoneStatus,
  ) {
    await runAction(() =>
      updateProjectMilestone(
        projectId,
        milestone.id,
        {
          version:
            milestone.version,
          name:
            milestone.name,
          description:
            milestone.description ??
            "",
          plannedDate:
            milestone.plannedDate,
          forecastDate:
            milestone.forecastDate,
          actualDate:
            milestone.actualDate,
          status,
          weightPercentage:
            Number(
              milestone
                .weightPercentage,
            ),
          sortOrder:
            milestone.sortOrder,
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
          Loading project intelligence...
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
            Project unavailable
          </h1>

          <p>
            {requestError ||
              "BuildSight could not load this project."}
          </p>

          <div className="command-error-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() =>
                void refresh()
              }
            >
              Retry
            </button>

            <Link
              href="/"
              className="secondary-link-button"
            >
              Back to portfolio
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const {
    project,
    health,
    milestones,
    progressUpdates,
  } = data;

  return (
    <div className="command-shell">
      <aside className="command-sidebar">
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
          PROJECT COMMAND CENTER
        </div>

        <nav className="command-navigation">
          <a
            href="#overview"
            className="command-nav-item active"
          >
            01
            <span>Overview</span>
          </a>

          <a
            href="#health"
            className="command-nav-item"
          >
            02
            <span>Project health</span>
          </a>

          <a
            href="#milestones"
            className="command-nav-item"
          >
            03
            <span>Milestones</span>
          </a>

          <a
            href="#progress"
            className="command-nav-item"
          >
            04
            <span>Progress</span>
          </a>

          <Link
            href={`/projects/${projectId}/costs`}
            className="command-nav-item"
          >
            05
            <span>Cost control</span>
          </Link>

          <Link
            href={`/projects/${projectId}/procurement`}
            className="command-nav-item"
          >
            06
            <span>Procurement</span>
          </Link>

          <Link
            href={`/projects/${projectId}/risk-control`}
            className="command-nav-item"
          >
            07
            <span>Risk control</span>
          </Link>

          <Link
            href={`/projects/${projectId}/production`}
            className="command-nav-item"
          >
            08
            <span>Production</span>
          </Link>

          <Link
            href={`/projects/${projectId}/documents`}
            className="command-nav-item"
          >
            09
            <span>Documents</span>
          </Link>

          <Link
            href={`/projects/${projectId}/quality`}
            className="command-nav-item"
          >
            10
            <span>Quality & handover</span>
          </Link>

          <Link
            href={`/projects/${projectId}/safety`}
            className="command-nav-item"
          >
            11
            <span>Safety / HSE</span>
          </Link>

          <Link
            href={`/projects/${projectId}/commercial`}
            className="command-nav-item"
          >
            12
            <span>Commercial</span>
          </Link>

          <Link
            href={`/projects/${projectId}/copilot`}
            className="command-nav-item"
          >
            13
            <span>AI Copilot</span>
          </Link>

          <Link
            href="/portfolio"
            className="command-nav-item"
          >
            PX
            <span>Executive portfolio</span>
          </Link>
        </nav>

        <div className="command-sidebar-footer">
          <span>
            LOCAL PROJECT
          </span>

          <strong>
            {project.code}
          </strong>

          <small>
            All project intelligence
            remains on your machine.
          </small>
        </div>
      </aside>

      <main className="command-main">
        <header className="command-topbar">
          <div>
            <Link
              href="/"
              className="back-link"
            >
              ← Portfolio
            </Link>

            <div className="command-heading-row">
              <div>
                <div className="eyebrow">
                  {project.code}
                  {" · "}
                  {project.location}
                </div>

                <h1>
                  {project.name}
                </h1>

                <p className="command-client">
                  {project.clientName}
                </p>
              </div>

              <span
                className={
                  statusClass(
                    project.status,
                  )
                }
              >
                {
                  statusLabels[
                    project.status
                  ]
                }
              </span>
            </div>
          </div>

          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setEditForm(
                editInputFromProject(
                  project,
                ),
              );

              setEditFieldErrors(
                {},
              );

              setEditOpen(
                (current) =>
                  !current,
              );
            }}
          >
            Edit project
          </button>
        </header>

        {requestError && (
          <div className="command-alert">
            <strong>
              Operation not completed
            </strong>

            <span>
              {requestError}
            </span>
          </div>
        )}

        {editOpen &&
          editForm && (
            <section className="command-edit-panel">
              <div className="section-heading">
                <div>
                  <div className="eyebrow">
                    PROJECT CONTROL
                  </div>

                  <h2>
                    Edit project
                    baseline
                  </h2>
                </div>

                <button
                  type="button"
                  className="close-button"
                  onClick={() =>
                    setEditOpen(
                      false,
                    )
                  }
                >
                  Close
                </button>
              </div>

              <form
                className="command-form"
                onSubmit={
                  handleEdit
                }
              >
                <label className="field-wide">
                  <span>
                    Project name
                  </span>

                  <input
                    required
                    value={
                      editForm.name
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditForm(
                        {
                          ...editForm,
                          name:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                  />

                  {editFieldErrors.name && (
                    <small>
                      {
                        editFieldErrors.name
                      }
                    </small>
                  )}
                </label>

                <label>
                  <span>
                    Client
                  </span>

                  <input
                    required
                    value={
                      editForm.clientName
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditForm(
                        {
                          ...editForm,
                          clientName:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Location
                  </span>

                  <input
                    required
                    value={
                      editForm.location
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditForm(
                        {
                          ...editForm,
                          location:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Contract value
                  </span>

                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={
                      editForm.contractValue
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditForm(
                        {
                          ...editForm,
                          contractValue:
                            Number(
                              event
                                .target
                                .value,
                            ),
                        },
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Approved budget
                  </span>

                  <input
                    required
                    min="0"
                    step="0.01"
                    type="number"
                    value={
                      editForm.approvedBudget
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditForm(
                        {
                          ...editForm,
                          approvedBudget:
                            Number(
                              event
                                .target
                                .value,
                            ),
                        },
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Planned start
                  </span>

                  <input
                    required
                    type="date"
                    value={
                      editForm.plannedStartDate
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditForm(
                        {
                          ...editForm,
                          plannedStartDate:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Baseline completion
                  </span>

                  <input
                    required
                    type="date"
                    value={
                      editForm.plannedEndDate
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditForm(
                        {
                          ...editForm,
                          plannedEndDate:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                  />
                </label>

                <label>
                  <span>
                    Forecast completion
                  </span>

                  <input
                    required
                    type="date"
                    value={
                      editForm.forecastEndDate
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditForm(
                        {
                          ...editForm,
                          forecastEndDate:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                  />
                </label>

                <label className="field-full">
                  <span>
                    Description
                  </span>

                  <textarea
                    rows={4}
                    value={
                      editForm.description
                    }
                    onChange={(
                      event,
                    ) =>
                      setEditForm(
                        {
                          ...editForm,
                          description:
                            event
                              .target
                              .value,
                        },
                      )
                    }
                  />
                </label>

                <div className="form-actions field-full">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setEditOpen(
                        false,
                      )
                    }
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      actionBusy
                    }
                    className="primary-button"
                  >
                    {actionBusy
                      ? "Saving..."
                      : "Save project"}
                  </button>
                </div>
              </form>
            </section>
          )}

        <section
          className="command-kpi-grid"
          id="overview"
        >
          <article className="command-kpi health-kpi">
            <div className="command-kpi-label">
              PROJECT HEALTH
            </div>

            <div className="health-score-row">
              <div className="health-score-number">
                {health.score}
              </div>

              <div>
                <div className="health-score-max">
                  / 100
                </div>

                <span
                  className={
                    healthClass(
                      health.healthBand,
                    )
                  }
                >
                  {
                    healthLabels[
                      health.healthBand
                    ]
                  }
                </span>
              </div>
            </div>

            <p>
              Explainable delivery-health
              score.
            </p>
          </article>

          <article className="command-kpi">
            <div className="command-kpi-label">
              PHYSICAL PROGRESS
            </div>

            <div className="command-kpi-value">
              {Number(
                project.physicalProgressPercentage,
              ).toFixed(1)}
              %
            </div>

            <div className="command-kpi-sub">
              Expected{" "}
              {health.expectedProgressPercentage.toFixed(
                1,
              )}
              %
            </div>

            <div className="command-mini-progress">
              <div
                style={{
                  width:
                    percentageWidth(
                      Number(
                        project.physicalProgressPercentage,
                      ),
                    ),
                }}
              />
            </div>
          </article>

          <article className="command-kpi">
            <div className="command-kpi-label">
              SCHEDULE VARIANCE
            </div>

            <div className="command-kpi-value">
              {varianceLabel(
                health.scheduleVarianceDays,
              )}
            </div>

            <span
              className={
                scheduleRiskClass(
                  health.scheduleRisk,
                )
              }
            >
              {
                scheduleRiskLabels[
                  health.scheduleRisk
                ]
              }
            </span>

            <div className="command-kpi-sub">
              Forecast vs baseline
            </div>
          </article>

          <article className="command-kpi">
            <div className="command-kpi-label">
              APPROVED BUDGET
            </div>

            <div className="command-kpi-value">
              {compactMoney(
                Number(
                  project.approvedBudget,
                ),
              )}
            </div>

            <div className="command-kpi-sub">
              Contract{" "}
              {compactMoney(
                Number(
                  project.contractValue,
                ),
              )}
            </div>

            <div className="budget-difference">
              {remainingBudget >=
              0
                ? "Contract headroom "
                : "Budget above contract "}
              {money(
                Math.abs(
                  remainingBudget,
                ),
              )}
            </div>
          </article>
        </section>

        <section className="command-two-column">
          <article className="command-card">
            <div className="command-card-header">
              <div>
                <div className="eyebrow">
                  PROJECT TIMELINE
                </div>

                <h2>
                  Schedule control
                </h2>
              </div>
            </div>

            <div className="schedule-list">
              <div>
                <span>
                  Planned start
                </span>

                <strong>
                  {formatDate(
                    project.plannedStartDate,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Actual start
                </span>

                <strong>
                  {formatDate(
                    project.actualStartDate,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Baseline completion
                </span>

                <strong>
                  {formatDate(
                    project.plannedEndDate,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Current forecast
                </span>

                <strong>
                  {formatDate(
                    project.forecastEndDate,
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Actual completion
                </span>

                <strong>
                  {formatDate(
                    project.actualEndDate,
                  )}
                </strong>
              </div>
            </div>
          </article>

          <article className="command-card">
            <div className="command-card-header">
              <div>
                <div className="eyebrow">
                  PROJECT GOVERNANCE
                </div>

                <h2>
                  Status workflow
                </h2>
              </div>

              <span
                className={
                  statusClass(
                    project.status,
                  )
                }
              >
                {
                  statusLabels[
                    project.status
                  ]
                }
              </span>
            </div>

            <p className="card-description">
              BuildSight permits only
              governed lifecycle transitions,
              preventing invalid project-state
              changes.
            </p>

            <div className="status-action-grid">
              {allowedTransitions[
                project.status
              ].length === 0 ? (
                <div className="workflow-terminal">
                  This project is in a
                  terminal lifecycle state.
                </div>
              ) : (
                allowedTransitions[
                  project.status
                ].map(
                  (
                    target,
                  ) => (
                    <button
                      key={
                        target
                      }
                      type="button"
                      disabled={
                        actionBusy
                      }
                      onClick={() =>
                        void handleStatusChange(
                          target,
                        )
                      }
                    >
                      Move to{" "}
                      {
                        statusLabels[
                          target
                        ]
                      }
                    </button>
                  ),
                )
              )}
            </div>
          </article>
        </section>

        <section
          className="command-card health-card"
          id="health"
        >
          <div className="command-card-header">
            <div>
              <div className="eyebrow">
                BUILDSIGHT INTELLIGENCE
              </div>

              <h2>
                Project Health Score v9
              </h2>
            </div>

            <div className="health-calculation-date">
              Calculated{" "}
              {formatDate(
                health.calculationDate,
              )}
            </div>
          </div>

          <div className="health-layout">
            <div className="health-ring">
              <div>
                <strong>
                  {health.score}
                </strong>

                <span>
                  /100
                </span>
              </div>
            </div>

            <div className="health-components">
              <HealthComponent
                label="Schedule performance"
                weight="14%"
                value={
                  health.scheduleScore
                }
              />

              <HealthComponent
                label="Physical progress"
                weight="5%"
                value={
                  health.progressScore
                }
              />

              <HealthComponent
                label="Milestone execution"
                weight="5%"
                value={
                  health.milestoneScore
                }
              />

              <HealthComponent
                label="Cost performance"
                weight="14%"
                value={
                  health.costScore
                }
              />

              <HealthComponent
                label="Procurement performance"
                weight="10%"
                value={
                  health.procurementScore
                }
              />

              <HealthComponent
                label="Risk control"
                weight="7%"
                value={
                  health.riskScore
                }
              />

              <HealthComponent
                label="Site production"
                weight="11%"
                value={
                  health.productionScore
                }
              />

              <HealthComponent
                label="Information control"
                weight="7%"
                value={
                  health.informationScore
                }
              />

              <HealthComponent
                label="Quality & handover"
                weight="7%"
                value={
                  health.qualityScore
                }
              />

              <HealthComponent
                label="Safety / HSE"
                weight="10%"
                value={
                  health.safetyScore
                }
              />

              <HealthComponent
                label="Commercial & cash flow"
                weight="10%"
                value={
                  health.commercialScore
                }
              />
            </div>

            <div className="health-signals">
              <div>
                <span>
                  Progress variance
                </span>

                <strong>
                  {health.progressVariancePoints >
                  0
                    ? "+"
                    : ""}
                  {health.progressVariancePoints.toFixed(
                    1,
                  )}{" "}
                  pts
                </strong>
              </div>

              <div>
                <span>
                  Overdue milestones
                </span>

                <strong>
                  {
                    health.overdueMilestones
                  }
                </strong>
              </div>

              <div>
                <span>
                  Blocked milestones
                </span>

                <strong>
                  {
                    health.blockedMilestones
                  }
                </strong>
              </div>
            </div>
          </div>

          <p className="health-explanation">
            {health.explanation}
          </p>
        </section>

        <section
          className="command-card"
          id="milestones"
        >
          <div className="command-card-header">
            <div>
              <div className="eyebrow">
                DELIVERY CONTROL
              </div>

              <h2>
                Project milestones
              </h2>
            </div>

            <button
              type="button"
              className="primary-button"
              onClick={() =>
                setMilestoneOpen(
                  (current) =>
                    !current,
                )
              }
            >
              + Add milestone
            </button>
          </div>

          {milestoneOpen && (
            <form
              className="milestone-form"
              onSubmit={
                handleMilestoneCreate
              }
            >
              <label className="field-wide">
                <span>
                  Milestone name
                </span>

                <input
                  required
                  value={
                    milestoneForm.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setMilestoneForm(
                      {
                        ...milestoneForm,
                        name:
                          event
                            .target
                            .value,
                      },
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Planned date
                </span>

                <input
                  required
                  type="date"
                  value={
                    milestoneForm.plannedDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setMilestoneForm(
                      {
                        ...milestoneForm,
                        plannedDate:
                          event
                            .target
                            .value,
                      },
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Forecast date
                </span>

                <input
                  type="date"
                  value={
                    milestoneForm.forecastDate ??
                    ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setMilestoneForm(
                      {
                        ...milestoneForm,
                        forecastDate:
                          event
                            .target
                            .value ||
                          null,
                      },
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Weight %
                </span>

                <input
                  required
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  value={
                    milestoneForm.weightPercentage
                  }
                  onChange={(
                    event,
                  ) =>
                    setMilestoneForm(
                      {
                        ...milestoneForm,
                        weightPercentage:
                          Number(
                            event
                              .target
                              .value,
                          ),
                      },
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Display order
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={
                    milestoneForm.sortOrder
                  }
                  onChange={(
                    event,
                  ) =>
                    setMilestoneForm(
                      {
                        ...milestoneForm,
                        sortOrder:
                          Number(
                            event
                              .target
                              .value,
                          ),
                      },
                    )
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
                    milestoneForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setMilestoneForm(
                      {
                        ...milestoneForm,
                        description:
                          event
                            .target
                            .value,
                      },
                    )
                  }
                />
              </label>

              <div className="form-actions field-full">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setMilestoneOpen(
                      false,
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    actionBusy
                  }
                  className="primary-button"
                >
                  Create milestone
                </button>
              </div>
            </form>
          )}

          <div className="milestone-table-wrapper">
            <table className="milestone-table">
              <thead>
                <tr>
                  <th>
                    MILESTONE
                  </th>
                  <th>
                    STATUS
                  </th>
                  <th>
                    PLANNED
                  </th>
                  <th>
                    FORECAST
                  </th>
                  <th>
                    ACTUAL
                  </th>
                  <th>
                    WEIGHT
                  </th>
                </tr>
              </thead>

              <tbody>
                {milestones.length ===
                0 ? (
                  <tr>
                    <td
                      colSpan={
                        6
                      }
                    >
                      <div className="table-message">
                        No milestones
                        defined yet.
                      </div>
                    </td>
                  </tr>
                ) : (
                  milestones.map(
                    (
                      milestone,
                    ) => (
                      <tr
                        key={
                          milestone.id
                        }
                      >
                        <td>
                          <div className="milestone-name">
                            <strong>
                              {
                                milestone.name
                              }
                            </strong>

                            <span>
                              {milestone.description ||
                                "No description"}
                            </span>
                          </div>
                        </td>

                        <td>
                          <select
                            disabled={
                              actionBusy
                            }
                            className={
                              milestoneStatusClass(
                                milestone.status,
                              )
                            }
                            value={
                              milestone.status
                            }
                            onChange={(
                              event,
                            ) =>
                              void handleMilestoneStatus(
                                milestone,
                                event
                                  .target
                                  .value as MilestoneStatus,
                              )
                            }
                          >
                            {(
                              Object.keys(
                                milestoneStatusLabels,
                              ) as MilestoneStatus[]
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
                                    milestoneStatusLabels[
                                      status
                                    ]
                                  }
                                </option>
                              ),
                            )}
                          </select>
                        </td>

                        <td>
                          {formatDate(
                            milestone.plannedDate,
                          )}
                        </td>

                        <td>
                          {formatDate(
                            milestone.forecastDate,
                          )}
                        </td>

                        <td>
                          {formatDate(
                            milestone.actualDate,
                          )}
                        </td>

                        <td>
                          {Number(
                            milestone.weightPercentage,
                          ).toFixed(
                            1,
                          )}
                          %
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
          className="command-two-column progress-layout"
          id="progress"
        >
          <article className="command-card">
            <div className="command-card-header">
              <div>
                <div className="eyebrow">
                  SITE REPORTING
                </div>

                <h2>
                  Record progress
                </h2>
              </div>
            </div>

            <p className="card-description">
              Physical progress cannot
              decrease. Each update is
              stored as an auditable
              historical record.
            </p>

            <form
              className="progress-form"
              onSubmit={
                handleProgress
              }
            >
              <label>
                <span>
                  Progress percentage
                </span>

                <div className="percentage-input">
                  <input
                    required
                    type="number"
                    min={Number(
                      project.physicalProgressPercentage,
                    )}
                    max="100"
                    step="0.01"
                    placeholder={Number(
                      project.physicalProgressPercentage,
                    ).toFixed(
                      1,
                    )}
                    value={
                      progressValue
                    }
                    onChange={(
                      event,
                    ) =>
                      setProgressValue(
                        event
                          .target
                          .value,
                      )
                    }
                  />

                  <span>
                    %
                  </span>
                </div>
              </label>

              <label>
                <span>
                  Update date
                </span>

                <input
                  required
                  type="date"
                  value={
                    progressDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setProgressDate(
                      event
                        .target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Site note
                </span>

                <textarea
                  rows={5}
                  value={
                    progressNote
                  }
                  placeholder="Describe the work completed, constraints or relevant context..."
                  onChange={(
                    event,
                  ) =>
                    setProgressNote(
                      event
                        .target
                        .value,
                    )
                  }
                />
              </label>

              <button
                type="submit"
                disabled={
                  actionBusy ||
                  project.status ===
                    "COMPLETED" ||
                  project.status ===
                    "CANCELLED"
                }
                className="primary-button"
              >
                Record progress
              </button>
            </form>
          </article>

          <article className="command-card">
            <div className="command-card-header">
              <div>
                <div className="eyebrow">
                  PROGRESS HISTORY
                </div>

                <h2>
                  Recent updates
                </h2>
              </div>

              <span className="history-count">
                {
                  progressUpdates.length
                }
              </span>
            </div>

            <div className="progress-history">
              {progressUpdates.length ===
              0 ? (
                <div className="empty-history">
                  No progress updates yet.
                </div>
              ) : (
                progressUpdates.map(
                  (
                    update,
                    index,
                  ) => (
                    <div
                      className="progress-history-row"
                      key={
                        update.id
                      }
                    >
                      <div className="history-marker">
                        <span />

                        {index <
                          progressUpdates.length -
                            1 && (
                          <i />
                        )}
                      </div>

                      <div className="history-content">
                        <div className="history-heading">
                          <strong>
                            {Number(
                              update.progressPercentage,
                            ).toFixed(
                              1,
                            )}
                            %
                          </strong>

                          <span>
                            {formatDate(
                              update.updateDate,
                            )}
                          </span>
                        </div>

                        <p>
                          {update.note ||
                            "Progress update recorded."}
                        </p>
                      </div>
                    </div>
                  ),
                )
              )}
            </div>
          </article>
        </section>

        <footer className="command-footer">
          <div>
            BuildSight · Local-first
            construction intelligence
          </div>

          <div>
            Project version{" "}
            {project.version}
          </div>
        </footer>
      </main>
    </div>
  );
}

function HealthComponent({
  label,
  weight,
  value,
}: {
  label: string;
  weight: string;
  value: number;
}) {
  return (
    <div className="health-component">
      <div className="health-component-header">
        <div>
          <strong>
            {label}
          </strong>

          <span>
            Weight {weight}
          </span>
        </div>

        <b>
          {value.toFixed(1)}
        </b>
      </div>

      <div className="health-component-track">
        <div
          style={{
            width:
              percentageWidth(
                value,
              ),
          }}
        />
      </div>
    </div>
  );
}
