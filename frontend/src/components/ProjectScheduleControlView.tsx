"use client";

import Link from "next/link";
import { ProjectWorkspaceSidebar } from "./ProjectWorkspaceSidebar";
import { ProjectWorkspaceLoading } from "./ProjectWorkspaceLoading";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import {
  approveScheduleBaseline,
  BuildSightApiError,
  captureScheduleBaseline,
  createScheduleActivity,
  createScheduleConstraint,
  createScheduleDependency,
  deleteScheduleDependency,
  getProjectSchedule,
  getScheduleLookahead,
  updateScheduleActivity,
  updateScheduleConstraint,
} from "@/lib/api";

import type {
  CreateScheduleActivityInput,
  CreateScheduleConstraintInput,
  CreateScheduleDependencyInput,
  ScheduleActivity,
  ScheduleActivityStatus,
  ScheduleBaseline,
  ScheduleConstraint,
  ScheduleConstraintStatus,
  ScheduleConstraintType,
  ScheduleControl,
  ScheduleDependencyType,
  ScheduleLookahead,
} from "@/types/project";

type Panel =
  | "activity"
  | "dependency"
  | "constraint"
  | "baseline"
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

const activityDefaults: CreateScheduleActivityInput = {
  activityCode: "",
  name: "",
  discipline: "",
  workPackageId: null,
  currentStart: today(),
  currentFinish: offsetDate(7),
  originalDurationDays: 8,
};

const dependencyDefaults: CreateScheduleDependencyInput = {
  predecessorActivityId: "",
  successorActivityId: "",
  dependencyType: "FS",
  lagDays: 0,
};

const constraintDefaults: CreateScheduleConstraintInput = {
  activityId: "",
  constraintType: "DESIGN_INFORMATION",
  title: "",
  ownerName: "",
  dueDate: offsetDate(7),
};

const constraintTypes: ScheduleConstraintType[] = [
  "DESIGN_INFORMATION",
  "MATERIAL",
  "ACCESS",
  "LABOR",
  "EQUIPMENT",
  "APPROVAL",
  "PERMIT",
  "PREDECESSOR",
  "OTHER",
];

const dependencyTypes: ScheduleDependencyType[] = [
  "FS",
  "SS",
  "FF",
  "SF",
];

function activityStatusOptions(
  status: ScheduleActivityStatus,
): ScheduleActivityStatus[] {
  switch (status) {
    case "NOT_STARTED":
      return [
        "NOT_STARTED",
        "IN_PROGRESS",
        "ON_HOLD",
        "COMPLETED",
      ];

    case "IN_PROGRESS":
      return [
        "IN_PROGRESS",
        "ON_HOLD",
        "COMPLETED",
      ];

    case "ON_HOLD":
      return [
        "ON_HOLD",
        "IN_PROGRESS",
        "COMPLETED",
      ];

    case "COMPLETED":
      return [
        "COMPLETED",
      ];
  }
}

export function ProjectScheduleControlView({
  projectId,
}: {
  projectId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<ScheduleControl | null>(
      null,
    );

  const [
    lookahead,
    setLookahead,
  ] =
    useState<ScheduleLookahead | null>(
      null,
    );

  const [
    lookaheadWeeks,
    setLookaheadWeeks,
  ] =
    useState<2 | 4 | 6>(
      2,
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
    activityForm,
    setActivityForm,
  ] =
    useState(
      activityDefaults,
    );

  const [
    dependencyForm,
    setDependencyForm,
  ] =
    useState(
      dependencyDefaults,
    );

  const [
    constraintForm,
    setConstraintForm,
  ] =
    useState(
      constraintDefaults,
    );

  const [
    baselineName,
    setBaselineName,
  ] =
    useState(
      "Progress Baseline",
    );

  useEffect(
    () => {
      let cancelled =
        false;

      Promise.all([
        getProjectSchedule(
          projectId,
        ),
        getScheduleLookahead(
          projectId,
          2,
        ),
      ])
        .then(
          ([
            schedule,
            initialLookahead,
          ]) => {
            if (cancelled) {
              return;
            }

            setData(
              schedule,
            );

            setLookahead(
              initialLookahead,
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
                "BuildSight could not load schedule intelligence.",
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

  async function refresh(
    weeks: 2 | 4 | 6 =
      lookaheadWeeks,
  ) {
    const [
      schedule,
      refreshedLookahead,
    ] =
      await Promise.all([
        getProjectSchedule(
          projectId,
        ),
        getScheduleLookahead(
          projectId,
          weeks,
        ),
      ]);

    setData(
      schedule,
    );

    setLookahead(
      refreshedLookahead,
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
          "The schedule-control operation failed.",
        );
      }

      return false;

    } finally {
      setBusy(false);
    }
  }

  async function changeLookahead(
    weeks: 2 | 4 | 6,
  ) {
    setLookaheadWeeks(
      weeks,
    );

    setBusy(true);

    try {
      setLookahead(
        await getScheduleLookahead(
          projectId,
          weeks,
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
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitActivity(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createScheduleActivity(
            projectId,
            activityForm,
          ),
      )
    ) {
      setActivityForm({
        ...activityDefaults,
        currentStart:
          today(),
        currentFinish:
          offsetDate(7),
      });

      setPanel(null);
    }
  }

  async function submitDependency(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !dependencyForm.predecessorActivityId
      ||
      !dependencyForm.successorActivityId
    ) {
      setError(
        "Select both predecessor and successor activities.",
      );
      return;
    }

    if (
      await runAction(
        () =>
          createScheduleDependency(
            projectId,
            dependencyForm,
          ),
      )
    ) {
      setDependencyForm(
        dependencyDefaults,
      );

      setPanel(null);
    }
  }

  async function submitConstraint(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !constraintForm.activityId
    ) {
      setError(
        "Select an activity for the schedule constraint.",
      );
      return;
    }

    if (
      await runAction(
        () =>
          createScheduleConstraint(
            projectId,
            constraintForm,
          ),
      )
    ) {
      setConstraintForm({
        ...constraintDefaults,
        dueDate:
          offsetDate(7),
      });

      setPanel(null);
    }
  }

  async function submitBaseline(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          captureScheduleBaseline(
            projectId,
            {
              name:
                baselineName,
              dataDate:
                today(),
            },
          ),
      )
    ) {
      setBaselineName(
        "Progress Baseline",
      );

      setPanel(null);
    }
  }

  async function changeActivityStatus(
    activity: ScheduleActivity,
    status: ScheduleActivityStatus,
  ) {
    if (
      status ===
      activity.status
    ) {
      return;
    }

    let progress =
      Number(
        activity.progressPercentage,
      );

    if (
      status ===
      "IN_PROGRESS"
      &&
      progress === 0
    ) {
      progress =
        1;
    }

    if (
      status ===
      "COMPLETED"
    ) {
      progress =
        100;
    }

    await runAction(
      () =>
        updateScheduleActivity(
          projectId,
          activity.id,
          {
            version:
              activity.version,
            name:
              activity.name,
            discipline:
              activity.discipline ??
              "",
            workPackageId:
              activity.workPackageId,
            currentStart:
              activity.currentStart,
            currentFinish:
              activity.currentFinish,
            originalDurationDays:
              activity.originalDurationDays,
            remainingDurationDays:
              status ===
              "COMPLETED"
                ? 0
                : activity.remainingDurationDays,
            actualStart:
              activity.actualStart,
            actualFinish:
              activity.actualFinish,
            progressPercentage:
              progress,
            status,
          },
        ),
    );
  }

  async function resolveConstraint(
    constraint: ScheduleConstraint,
    status: ScheduleConstraintStatus,
  ) {
    if (
      status ===
      constraint.status
    ) {
      return;
    }

    let notes =
      constraint.resolutionNotes ??
      "";

    if (
      status ===
      "RESOLVED"
      &&
      !notes
    ) {
      notes =
        window.prompt(
          "Resolution notes",
          "",
        )?.trim() ??
        "";

      if (!notes) {
        return;
      }
    }

    await runAction(
      () =>
        updateScheduleConstraint(
          projectId,
          constraint.id,
          {
            version:
              constraint.version,
            constraintType:
              constraint.constraintType,
            title:
              constraint.title,
            ownerName:
              constraint.ownerName ??
              "",
            dueDate:
              constraint.dueDate,
            status,
            resolutionNotes:
              notes,
          },
        ),
    );
  }

  async function approveBaseline(
    baseline: ScheduleBaseline,
  ) {
    await runAction(
      () =>
        approveScheduleBaseline(
          projectId,
          baseline.id,
        ),
    );
  }

  if (loading) {
    return (
      <ProjectWorkspaceLoading
        label={"Loading schedule intelligence..."}
        mainClassName={"schedule-main"}
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
            Schedule control unavailable
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
    baselines,
    activities,
    dependencies,
    constraints,
  } = data;

  return (
    <div className="schedule-shell">
      <ProjectWorkspaceSidebar
        projectId={projectId}
        projectCode={project.code}
        className="schedule-sidebar"
        localLinks={[
          { href: "#activities", label: "Activities" },
          { href: "#critical-path", label: "Critical path" },
          { href: "#lookahead", label: "Lookahead" },
          { href: "#constraints", label: "Constraints" },
          { href: "#baselines", label: "Baselines" },
        ]}
      />

      <main className="schedule-main">
        <header className="schedule-topbar">
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
              SCHEDULE INTELLIGENCE
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Baseline control,
              activity logic, CPM,
              total float, critical path,
              lookahead readiness and
              forecast completion.
            </p>
          </div>

          <div className="schedule-header-score">
            <span>
              SCHEDULE HEALTH
            </span>

            <strong>
              {intelligence.scheduleScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={`schedule-risk schedule-risk-${intelligence.scheduleRisk
                .toLowerCase()
                .replaceAll(
                  "_",
                  "-",
                )}`}
            >
              {intelligence.scheduleRisk.replaceAll(
                "_",
                " ",
              )}
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

        {!intelligence.networkValid && (
          <div className="schedule-network-error">
            <strong>
              Schedule network invalid
            </strong>

            <span>
              {intelligence.networkError}
            </span>
          </div>
        )}

        <section className="schedule-kpi-grid">
          <Kpi
            label="CPM FORECAST FINISH"
            value={formatDate(
              intelligence.cpmForecastFinishDate,
            )}
            detail={`${intelligence.projectFinishVarianceDays}d vs project plan`}
          />

          <Kpi
            label="CRITICAL ACTIVITIES"
            value={String(
              intelligence.criticalActivities,
            )}
            detail={`${intelligence.nearCriticalActivities} near-critical`}
          />

          <Kpi
            label="OPEN CONSTRAINTS"
            value={String(
              intelligence.openConstraints,
            )}
            detail={`${intelligence.overdueConstraints} overdue`}
          />

          <Kpi
            label="BASELINE VARIANCE"
            value={`${intelligence.baselineFinishVarianceDays}d`}
            detail={
              intelligence.approvedBaselineName ??
              "No approved baseline"
            }
            emphasis
          />
        </section>

        <section
          className="schedule-intelligence-panel"
          id="critical-path"
        >
          <div className="schedule-score-panel">
            <span>
              CPM SCORE
            </span>

            <strong>
              {intelligence.scheduleScore.toFixed(
                0,
              )}
            </strong>

            <small>
              /100
            </small>
          </div>

          <div className="schedule-intelligence-grid">
            <Metric
              label="Critical path length"
              value={`${intelligence.criticalPathLengthDays}d`}
            />

            <Metric
              label="Average total float"
              value={`${intelligence.averageTotalFloatDays.toFixed(
                1,
              )}d`}
            />

            <Metric
              label="Overdue activities"
              value={String(
                intelligence.overdueActivities,
              )}
            />

            <Metric
              label="Critical constraints"
              value={String(
                intelligence.constrainedCriticalActivities,
              )}
            />

            <Metric
              label="28-day lookahead"
              value={String(
                intelligence.lookahead28DayActivities,
              )}
            />

            <Metric
              label="42-day lookahead"
              value={String(
                intelligence.lookahead42DayActivities,
              )}
            />
          </div>

          <div className="schedule-critical-strip">
            <span>
              CRITICAL NETWORK
            </span>

            <div>
              {intelligence
                .criticalPathActivityCodes
                .length === 0 ? (
                <small>
                  No critical-path activities available.
                </small>
              ) : (
                intelligence
                  .criticalPathActivityCodes
                  .map(
                    (
                      code,
                      index,
                    ) => (
                      <span
                        className="schedule-critical-node"
                        key={code}
                      >
                        {index > 0 && (
                          <i>
                            →
                          </i>
                        )}

                        <strong>
                          {code}
                        </strong>
                      </span>
                    ),
                  )
              )}
            </div>
          </div>

          <p>
            {intelligence.explanation}
          </p>
        </section>

        <section className="schedule-actions">
          <button
            type="button"
            onClick={() =>
              setPanel(
                "activity",
              )
            }
          >
            + Activity
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "dependency",
              )
            }
          >
            + Dependency
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "constraint",
              )
            }
          >
            + Constraint
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "baseline",
              )
            }
          >
            + Capture baseline
          </button>
        </section>

        {panel ===
          "activity" && (
          <Panel
            title="Create schedule activity"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="schedule-form"
              onSubmit={
                submitActivity
              }
            >
              <Field label="Activity code">
                <input
                  required
                  value={
                    activityForm.activityCode
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityForm({
                      ...activityForm,
                      activityCode:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Discipline">
                <input
                  value={
                    activityForm.discipline
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityForm({
                      ...activityForm,
                      discipline:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Activity name"
                full
              >
                <input
                  required
                  value={
                    activityForm.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityForm({
                      ...activityForm,
                      name:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <DateField
                label="Current start"
                value={
                  activityForm.currentStart
                }
                onChange={(
                  value,
                ) =>
                  setActivityForm({
                    ...activityForm,
                    currentStart:
                      value,
                  })
                }
              />

              <DateField
                label="Current finish"
                value={
                  activityForm.currentFinish
                }
                onChange={(
                  value,
                ) =>
                  setActivityForm({
                    ...activityForm,
                    currentFinish:
                      value,
                  })
                }
              />

              <Field label="Duration days">
                <input
                  min={0}
                  type="number"
                  value={
                    activityForm.originalDurationDays
                  }
                  onChange={(
                    event,
                  ) =>
                    setActivityForm({
                      ...activityForm,
                      originalDurationDays:
                        Number(
                          event.target.value,
                        ),
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
          "dependency" && (
          <Panel
            title="Create activity dependency"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="schedule-form"
              onSubmit={
                submitDependency
              }
            >
              <Field label="Predecessor">
                <select
                  required
                  value={
                    dependencyForm.predecessorActivityId
                  }
                  onChange={(
                    event,
                  ) =>
                    setDependencyForm({
                      ...dependencyForm,
                      predecessorActivityId:
                        event.target.value,
                    })
                  }
                >
                  <option value="">
                    Select predecessor
                  </option>

                  {activities.map(
                    (
                      activity,
                    ) => (
                      <option
                        key={
                          activity.id
                        }
                        value={
                          activity.id
                        }
                      >
                        {activity.activityCode}
                        {" — "}
                        {activity.name}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Successor">
                <select
                  required
                  value={
                    dependencyForm.successorActivityId
                  }
                  onChange={(
                    event,
                  ) =>
                    setDependencyForm({
                      ...dependencyForm,
                      successorActivityId:
                        event.target.value,
                    })
                  }
                >
                  <option value="">
                    Select successor
                  </option>

                  {activities.map(
                    (
                      activity,
                    ) => (
                      <option
                        key={
                          activity.id
                        }
                        value={
                          activity.id
                        }
                      >
                        {activity.activityCode}
                        {" — "}
                        {activity.name}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Relationship">
                <select
                  value={
                    dependencyForm.dependencyType
                  }
                  onChange={(
                    event,
                  ) =>
                    setDependencyForm({
                      ...dependencyForm,
                      dependencyType:
                        event.target.value as ScheduleDependencyType,
                    })
                  }
                >
                  {dependencyTypes.map(
                    (
                      type,
                    ) => (
                      <option
                        key={
                          type
                        }
                        value={
                          type
                        }
                      >
                        {type}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Lag days">
                <input
                  type="number"
                  value={
                    dependencyForm.lagDays
                  }
                  onChange={(
                    event,
                  ) =>
                    setDependencyForm({
                      ...dependencyForm,
                      lagDays:
                        Number(
                          event.target.value,
                        ),
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
          "constraint" && (
          <Panel
            title="Create lookahead constraint"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="schedule-form"
              onSubmit={
                submitConstraint
              }
            >
              <Field label="Activity">
                <select
                  required
                  value={
                    constraintForm.activityId
                  }
                  onChange={(
                    event,
                  ) =>
                    setConstraintForm({
                      ...constraintForm,
                      activityId:
                        event.target.value,
                    })
                  }
                >
                  <option value="">
                    Select activity
                  </option>

                  {activities.map(
                    (
                      activity,
                    ) => (
                      <option
                        key={
                          activity.id
                        }
                        value={
                          activity.id
                        }
                      >
                        {activity.activityCode}
                        {" — "}
                        {activity.name}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Constraint type">
                <select
                  value={
                    constraintForm.constraintType
                  }
                  onChange={(
                    event,
                  ) =>
                    setConstraintForm({
                      ...constraintForm,
                      constraintType:
                        event.target.value as ScheduleConstraintType,
                    })
                  }
                >
                  {constraintTypes.map(
                    (
                      type,
                    ) => (
                      <option
                        key={
                          type
                        }
                        value={
                          type
                        }
                      >
                        {type.replaceAll(
                          "_",
                          " ",
                        )}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field
                label="Constraint"
                full
              >
                <input
                  required
                  value={
                    constraintForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setConstraintForm({
                      ...constraintForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Owner">
                <input
                  value={
                    constraintForm.ownerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setConstraintForm({
                      ...constraintForm,
                      ownerName:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <DateField
                label="Due date"
                value={
                  constraintForm.dueDate
                }
                onChange={(
                  value,
                ) =>
                  setConstraintForm({
                    ...constraintForm,
                    dueDate:
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

        {panel ===
          "baseline" && (
          <Panel
            title="Capture current schedule baseline"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="schedule-form"
              onSubmit={
                submitBaseline
              }
            >
              <Field
                label="Baseline name"
                full
              >
                <input
                  required
                  value={
                    baselineName
                  }
                  onChange={(
                    event,
                  ) =>
                    setBaselineName(
                      event.target.value,
                    )
                  }
                />
              </Field>

              <div className="schedule-baseline-note field-full">
                BuildSight will snapshot the
                current activity dates,
                durations and CPM critical
                flags. Approval will
                supersede the previous
                approved baseline.
              </div>

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
          className="schedule-card"
          id="activities"
        >
          <CardHeader
            eyebrow="CURRENT PROGRAMME"
            title="Schedule activities"
            value={`${activities.length} activities`}
          />

          <TableWrap>
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>ACTIVITY</th>
                  <th>DATES</th>
                  <th>PROGRESS</th>
                  <th>REMAINING</th>
                  <th>FLOAT</th>
                  <th>CPM</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {activities.map(
                  (
                    activity,
                  ) => (
                    <tr
                      key={
                        activity.id
                      }
                      className={
                        activity.critical
                          ? "schedule-critical-row"
                          : activity.nearCritical
                            ? "schedule-near-row"
                            : activity.overdue
                              ? "schedule-overdue-row"
                              : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            activity.activityCode
                          }
                          title={
                            activity.name
                          }
                        />
                      </td>

                      <td>
                        {formatDate(
                          activity.currentStart,
                        )}
                        {" → "}
                        {formatDate(
                          activity.currentFinish,
                        )}
                      </td>

                      <td>
                        {Number(
                          activity.progressPercentage,
                        ).toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {
                          activity.remainingDurationDays
                        }
                        d
                      </td>

                      <td
                        className={
                          activity.totalFloatDays <=
                          0
                            ? "schedule-negative"
                            : ""
                        }
                      >
                        {
                          activity.totalFloatDays
                        }
                        d
                      </td>

                      <td>
                        {activity.critical ? (
                          <span className="schedule-critical-pill">
                            CRITICAL
                          </span>
                        ) : activity.nearCritical ? (
                          <span className="schedule-near-pill">
                            NEAR
                          </span>
                        ) : (
                          <span className="schedule-normal-pill">
                            NORMAL
                          </span>
                        )}
                      </td>

                      <td>
                        <select
                          className="schedule-select"
                          disabled={busy}
                          value={
                            activity.status
                          }
                          onChange={(
                            event,
                          ) =>
                            void changeActivityStatus(
                              activity,
                              event.target.value as ScheduleActivityStatus,
                            )
                          }
                        >
                          {activityStatusOptions(
                            activity.status,
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

                {activities.length ===
                  0 && (
                  <EmptyRow
                    columns={7}
                    text="No schedule activities."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section
          className="schedule-card"
          id="lookahead"
        >
          <CardHeader
            eyebrow="SHORT-TERM PLANNING"
            title="Lookahead readiness"
            value={`${lookahead?.activityCount ?? 0} activities`}
          />

          <div className="schedule-lookahead-toolbar">
            {(
              [
                2,
                4,
                6,
              ] as const
            ).map(
              (
                weeks,
              ) => (
                <button
                  type="button"
                  key={
                    weeks
                  }
                  disabled={
                    busy
                  }
                  className={
                    lookaheadWeeks ===
                    weeks
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    void changeLookahead(
                      weeks,
                    )
                  }
                >
                  {weeks}-week
                </button>
              ),
            )}
          </div>

          <TableWrap>
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>ACTIVITY</th>
                  <th>START</th>
                  <th>FINISH</th>
                  <th>PROGRESS</th>
                  <th>FLOAT</th>
                  <th>CONSTRAINTS</th>
                  <th>CPM</th>
                </tr>
              </thead>

              <tbody>
                {lookahead?.activities.map(
                  (
                    activity,
                  ) => (
                    <tr
                      key={
                        activity.activityId
                      }
                      className={
                        activity.constrained
                          ? "schedule-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            activity.activityCode
                          }
                          title={
                            activity.name
                          }
                        />
                      </td>

                      <td>
                        {formatDate(
                          activity.currentStart,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          activity.currentFinish,
                        )}
                      </td>

                      <td>
                        {Number(
                          activity.progressPercentage,
                        ).toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {
                          activity.totalFloatDays
                        }
                        d
                      </td>

                      <td>
                        {
                          activity.openConstraints
                        }
                      </td>

                      <td>
                        {activity.critical
                          ? "Critical"
                          : activity.nearCritical
                            ? "Near-critical"
                            : "Normal"}
                      </td>
                    </tr>
                  ),
                )}

                {(lookahead?.activities.length ??
                  0) === 0 && (
                  <EmptyRow
                    columns={7}
                    text="No activities in this lookahead window."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section
          className="schedule-card"
          id="constraints"
        >
          <CardHeader
            eyebrow="READINESS CONTROL"
            title="Schedule constraints"
            value={`${intelligence.openConstraints} open`}
          />

          <TableWrap>
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>ACTIVITY</th>
                  <th>CONSTRAINT</th>
                  <th>TYPE</th>
                  <th>OWNER</th>
                  <th>DUE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {constraints.map(
                  (
                    constraint,
                  ) => (
                    <tr
                      key={
                        constraint.id
                      }
                      className={
                        constraint.overdue
                          ? "schedule-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        {
                          constraint.activityCode
                        }
                      </td>

                      <td>
                        {
                          constraint.title
                        }
                      </td>

                      <td>
                        {constraint.constraintType.replaceAll(
                          "_",
                          " ",
                        )}
                      </td>

                      <td>
                        {constraint.ownerName ??
                          "—"}
                      </td>

                      <td
                        className={
                          constraint.overdue
                            ? "schedule-negative"
                            : ""
                        }
                      >
                        {formatDate(
                          constraint.dueDate,
                        )}
                      </td>

                      <td>
                        <select
                          className="schedule-select"
                          disabled={
                            busy
                          }
                          value={
                            constraint.status
                          }
                          onChange={(
                            event,
                          ) =>
                            void resolveConstraint(
                              constraint,
                              event.target.value as ScheduleConstraintStatus,
                            )
                          }
                        >
                          <option value="OPEN">
                            OPEN
                          </option>

                          <option value="RESOLVED">
                            RESOLVED
                          </option>

                          <option value="WAIVED">
                            WAIVED
                          </option>
                        </select>
                      </td>
                    </tr>
                  ),
                )}

                {constraints.length ===
                  0 && (
                  <EmptyRow
                    columns={6}
                    text="No schedule constraints."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section className="schedule-card">
          <CardHeader
            eyebrow="ACTIVITY LOGIC"
            title="Dependencies"
            value={`${dependencies.length} relationships`}
          />

          <TableWrap>
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>PREDECESSOR</th>
                  <th>RELATIONSHIP</th>
                  <th>LAG</th>
                  <th>SUCCESSOR</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {dependencies.map(
                  (
                    dependency,
                  ) => (
                    <tr
                      key={
                        dependency.id
                      }
                    >
                      <td>
                        {
                          dependency.predecessorCode
                        }
                      </td>

                      <td>
                        {
                          dependency.dependencyType
                        }
                      </td>

                      <td>
                        {
                          dependency.lagDays
                        }
                        d
                      </td>

                      <td>
                        {
                          dependency.successorCode
                        }
                      </td>

                      <td>
                        <button
                          type="button"
                          className="schedule-delete-button"
                          disabled={
                            busy
                          }
                          onClick={() =>
                            void runAction(
                              () =>
                                deleteScheduleDependency(
                                  projectId,
                                  dependency.id,
                                ),
                            )
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ),
                )}

                {dependencies.length ===
                  0 && (
                  <EmptyRow
                    columns={5}
                    text="No activity dependencies."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section
          className="schedule-card"
          id="baselines"
        >
          <CardHeader
            eyebrow="BASELINE GOVERNANCE"
            title="Schedule baselines"
            value={`${baselines.length} snapshots`}
          />

          <TableWrap>
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>BASELINE</th>
                  <th>DATA DATE</th>
                  <th>ACTIVITIES</th>
                  <th>FINISH</th>
                  <th>STATUS</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {baselines.map(
                  (
                    baseline,
                  ) => (
                    <tr
                      key={
                        baseline.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            baseline.name
                          }
                        </strong>
                      </td>

                      <td>
                        {formatDate(
                          baseline.dataDate,
                        )}
                      </td>

                      <td>
                        {
                          baseline.activityCount
                        }
                      </td>

                      <td>
                        {formatDate(
                          baseline.baselineFinishDate,
                        )}
                      </td>

                      <td>
                        <span
                          className={`schedule-baseline-status schedule-baseline-${baseline.status.toLowerCase()}`}
                        >
                          {
                            baseline.status
                          }
                        </span>
                      </td>

                      <td>
                        {baseline.status ===
                        "DRAFT" ? (
                          <button
                            type="button"
                            className="schedule-approve-button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void approveBaseline(
                                baseline,
                              )
                            }
                          >
                            Approve
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ),
                )}

                {baselines.length ===
                  0 && (
                  <EmptyRow
                    columns={6}
                    text="No schedule baselines."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <footer className="command-footer">
          <div>
            BuildSight · Schedule Intelligence
          </div>

          <div>
            {activities.length} activities
            {" · "}
            {intelligence.criticalActivities} critical
            {" · "}
            {intelligence.openConstraints} constraints
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
          ? "schedule-kpi schedule-kpi-emphasis"
          : "schedule-kpi"
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
    <div className="schedule-intelligence-metric">
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
    <div className="schedule-card-header">
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
    <section className="schedule-form-panel">
      <div className="schedule-card-header">
        <div>
          <div className="eyebrow">
            PLANNING CONTROL INPUT
          </div>

          <h2>
            {title}
          </h2>
        </div>

        <button
          type="button"
          className="close-button"
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

function Field({
  label,
  children,
  full = false,
}: {
  label: string;
  children: ReactNode;
  full?: boolean;
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

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <Field label={label}>
      <input
        required
        type="date"
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

function TableWrap({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="schedule-table-wrapper">
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
    <div className="schedule-name-cell">
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
