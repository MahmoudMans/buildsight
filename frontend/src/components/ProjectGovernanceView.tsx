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
  BuildSightApiError,
  captureExecutiveReportSnapshot,
  createGovernanceAction,
  createGovernanceDecision,
  createGovernanceMeeting,
  getProjectGovernance,
  updateGovernanceAction,
  updateGovernanceDecision,
  updateGovernanceMeeting,
} from "@/lib/api";

import type {
  CreateGovernanceActionInput,
  CreateGovernanceDecisionInput,
  CreateGovernanceMeetingInput,
  GovernanceAction,
  GovernanceActionPriority,
  GovernanceActionStatus,
  GovernanceControl,
  GovernanceDecision,
  GovernanceDecisionImpactArea,
  GovernanceDecisionStatus,
  GovernanceMeeting,
  GovernanceMeetingStatus,
  GovernanceMeetingType,
} from "@/types/project";

type Panel =
  | "meeting"
  | "decision"
  | "action"
  | null;

function today(): string {
  return new Date()
    .toISOString()
    .slice(
      0,
      10,
    );
}

function futureDate(
  days: number,
): string {
  const value =
    new Date();

  value.setDate(
    value.getDate()
    + days,
  );

  return value
    .toISOString()
    .slice(
      0,
      10,
    );
}

function datetimeLocal(): string {
  const value =
    new Date();

  value.setMinutes(
    value.getMinutes()
    - value.getTimezoneOffset(),
  );

  return value
    .toISOString()
    .slice(
      0,
      16,
    );
}

function iso(
  value: string,
): string {
  return new Date(
    value,
  ).toISOString();
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

function formatDateTime(
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
      hour: "2-digit",
      minute: "2-digit",
    },
  ).format(
    new Date(
      value,
    ),
  );
}

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

const meetingTypes: GovernanceMeetingType[] = [
  "PROGRESS",
  "COORDINATION",
  "DESIGN",
  "COMMERCIAL",
  "HSE",
  "QUALITY",
  "EXECUTIVE",
  "OTHER",
];

const decisionImpactAreas: GovernanceDecisionImpactArea[] = [
  "SCHEDULE",
  "COST",
  "QUALITY",
  "HSE",
  "COMMERCIAL",
  "TECHNICAL",
  "PROCUREMENT",
  "RESOURCE",
  "OTHER",
];

const actionPriorities: GovernanceActionPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

const meetingDefaults: CreateGovernanceMeetingInput = {
  meetingNumber: "",
  title: "",
  meetingType: "PROGRESS",
  scheduledAt: datetimeLocal(),
  chairName: "",
};

const decisionDefaults: CreateGovernanceDecisionInput = {
  meetingId: null,
  decisionNumber: "",
  title: "",
  description: "",
  decisionDate: today(),
  ownerName: "",
  dueDate: futureDate(
    7,
  ),
  impactArea: "TECHNICAL",
  rationale: "",
};

const actionDefaults: CreateGovernanceActionInput = {
  meetingId: null,
  decisionId: null,
  actionNumber: "",
  title: "",
  description: "",
  ownerName: "",
  priority: "MEDIUM",
  dueDate: futureDate(
    7,
  ),
};

export function ProjectGovernanceView({
  projectId,
}: {
  projectId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<GovernanceControl | null>(
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
    meetingForm,
    setMeetingForm,
  ] =
    useState(
      meetingDefaults,
    );

  const [
    decisionForm,
    setDecisionForm,
  ] =
    useState(
      decisionDefaults,
    );

  const [
    actionForm,
    setActionForm,
  ] =
    useState(
      actionDefaults,
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

      getProjectGovernance(
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
            if (!cancelled) {
              setError(
                caught instanceof
                  BuildSightApiError
                  ? caught.message
                  : "Unable to load project governance.",
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
      await getProjectGovernance(
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
          : "The governance operation failed.",
      );

      return false;

    } finally {
      setBusy(
        false,
      );
    }
  }

  async function submitMeeting(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const payload = {
      ...meetingForm,
      scheduledAt:
        iso(
          meetingForm.scheduledAt,
        ),
    };

    if (
      await action(
        () =>
          createGovernanceMeeting(
            projectId,
            payload,
          ),
      )
    ) {
      setMeetingForm({
        ...meetingDefaults,
        scheduledAt:
          datetimeLocal(),
      });

      setPanel(
        null,
      );
    }
  }

  async function submitDecision(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await action(
        () =>
          createGovernanceDecision(
            projectId,
            decisionForm,
          ),
      )
    ) {
      setDecisionForm({
        ...decisionDefaults,
        decisionDate:
          today(),
        dueDate:
          futureDate(
            7,
          ),
      });

      setPanel(
        null,
      );
    }
  }

  async function submitAction(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await action(
        () =>
          createGovernanceAction(
            projectId,
            actionForm,
          ),
      )
    ) {
      setActionForm({
        ...actionDefaults,
        dueDate:
          futureDate(
            7,
          ),
      });

      setPanel(
        null,
      );
    }
  }

  async function updateMeetingStatus(
    meeting: GovernanceMeeting,
    status: GovernanceMeetingStatus,
  ) {
    if (
      status
      === meeting.status
    ) {
      return;
    }

    let minutes =
      meeting.minutes
      ?? "";

    if (
      status
      === "HELD"
      && !minutes
    ) {
      minutes =
        window.prompt(
          "Meeting minutes (optional — blank minutes will be flagged by Governance Intelligence)",
          "",
        )
        ?? "";
    }

    await action(
      () =>
        updateGovernanceMeeting(
          projectId,
          meeting.id,
          {
            version:
              meeting.version,
            title:
              meeting.title,
            meetingType:
              meeting.meetingType,
            scheduledAt:
              meeting.scheduledAt,
            heldAt:
              status ===
              "HELD"
                ? new Date()
                    .toISOString()
                : null,
            status,
            chairName:
              meeting.chairName
              ?? "",
            minutes,
            nextMeetingAt:
              meeting.nextMeetingAt,
          },
        ),
    );
  }

  async function updateDecisionStatus(
    decision: GovernanceDecision,
    status: GovernanceDecisionStatus,
  ) {
    if (
      status
      === decision.status
    ) {
      return;
    }

    await action(
      () =>
        updateGovernanceDecision(
          projectId,
          decision.id,
          {
            version:
              decision.version,
            meetingId:
              decision.meetingId,
            title:
              decision.title,
            description:
              decision.description
              ?? "",
            decisionDate:
              decision.decisionDate,
            ownerName:
              decision.ownerName
              ?? "",
            dueDate:
              decision.dueDate,
            impactArea:
              decision.impactArea,
            rationale:
              decision.rationale
              ?? "",
            status,
          },
        ),
    );
  }

  async function updateActionStatus(
    governanceAction: GovernanceAction,
    status: GovernanceActionStatus,
  ) {
    if (
      status
      === governanceAction.status
    ) {
      return;
    }

    let blockerReason =
      governanceAction.blockerReason
      ?? "";

    if (
      status
      === "BLOCKED"
      && !blockerReason
    ) {
      blockerReason =
        window.prompt(
          "Why is this action blocked?",
          "",
        )?.trim()
        ?? "";

      if (!blockerReason) {
        return;
      }
    }

    await action(
      () =>
        updateGovernanceAction(
          projectId,
          governanceAction.id,
          {
            version:
              governanceAction.version,
            meetingId:
              governanceAction.meetingId,
            decisionId:
              governanceAction.decisionId,
            title:
              governanceAction.title,
            description:
              governanceAction.description
              ?? "",
            ownerName:
              governanceAction.ownerName
              ?? "",
            priority:
              governanceAction.priority,
            dueDate:
              governanceAction.dueDate,
            status,
            blockerReason,
          },
        ),
    );
  }

  if (loading) {
    return (
      <ProjectWorkspaceLoading
        label={"Loading governance intelligence..."}
        mainClassName={"governance-main"}
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
            Governance unavailable
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
    executiveReport,
    meetings,
    decisions,
    actions,
    reportHistory,
  } = data;

  return (
    <div className="governance-shell">
      <ProjectWorkspaceSidebar
        projectId={projectId}
        projectCode={project.code}
        className="governance-sidebar"
        localLinks={[
          { href: "#executive-report", label: "Executive report" },
          { href: "#actions", label: "Actions" },
          { href: "#decisions", label: "Decisions" },
          { href: "#meetings", label: "Meetings" },
        ]}
      />

      <main className="governance-main">
        <header className="governance-header">
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
              GOVERNANCE INTELLIGENCE
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Decisions, actions, meetings,
              management follow-through and
              executive reporting.
            </p>
          </div>

          <div className="governance-score">
            <span>
              GOVERNANCE SCORE
            </span>

            <strong>
              {intelligence.governanceScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={`governance-risk governance-risk-${intelligence.governanceRisk
                .toLowerCase()
                .replaceAll(
                  "_",
                  "-",
                )}`}
            >
              {intelligence.governanceRisk.replaceAll(
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

        <section className="governance-kpis">
          <Kpi
            label="OPEN ACTIONS"
            value={String(
              intelligence.openActions,
            )}
            detail={`${intelligence.overdueActions} overdue`}
            dark
          />

          <Kpi
            label="BLOCKED ACTIONS"
            value={String(
              intelligence.blockedActions,
            )}
            detail={`${intelligence.criticalOpenActions} critical open`}
          />

          <Kpi
            label="PENDING DECISIONS"
            value={String(
              intelligence.pendingDecisions,
            )}
            detail={`${intelligence.overdueDecisions} overdue`}
          />

          <Kpi
            label="MINUTES GAPS"
            value={String(
              intelligence.meetingsWithoutMinutes,
            )}
            detail={`${intelligence.heldMeetings} meetings held`}
          />
        </section>

        <section
          className="governance-executive-card"
          id="executive-report"
        >
          <div className="governance-card-header">
            <div>
              <div className="eyebrow">
                EXECUTIVE REPORT
              </div>

              <h2>
                Management position
              </h2>
            </div>

            <button
              type="button"
              disabled={
                busy
              }
              onClick={() =>
                void action(
                  () =>
                    captureExecutiveReportSnapshot(
                      projectId,
                    ),
                )
              }
            >
              Capture report snapshot
            </button>
          </div>

          <div className="executive-score-grid">
            <Metric
              label="Physical progress"
              value={`${executiveReport.physicalProgressPercentage.toFixed(
                1,
              )}%`}
            />

            <Metric
              label="Schedule"
              value={`${executiveReport.scheduleScore.toFixed(
                0,
              )}/100`}
            />

            <Metric
              label="Predictive"
              value={`${executiveReport.predictiveScore.toFixed(
                0,
              )}/100`}
            />

            <Metric
              label="Governance"
              value={`${executiveReport.governanceScore.toFixed(
                0,
              )}/100`}
            />

            <Metric
              label="CPI"
              value={executiveReport.cpi.toFixed(
                2,
              )}
            />

            <Metric
              label="SPI"
              value={executiveReport.spi.toFixed(
                2,
              )}
            />

            <Metric
              label="Forecast cost"
              value={currency(
                executiveReport.expectedForecastCost,
              )}
            />

            <Metric
              label="Forecast finish"
              value={formatDate(
                executiveReport.expectedForecastFinishDate,
              )}
            />
          </div>

          <p className="executive-summary">
            {executiveReport.executiveSummary}
          </p>

          <div className="attention-list">
            <div className="eyebrow">
              MANAGEMENT ATTENTION
            </div>

            {executiveReport
              .attentionItems
              .map(
                (
                  item,
                ) => (
                  <article
                    key={`${item.type}-${item.reference}`}
                    className={`attention-item attention-${item.severity.toLowerCase()}`}
                  >
                    <div>
                      <span>
                        {item.severity}
                        {" · "}
                        {item.type}
                      </span>

                      <strong>
                        {item.reference}
                        {" — "}
                        {item.title}
                      </strong>

                      <small>
                        {item.detail}
                      </small>
                    </div>

                    <div>
                      <span>
                        {item.owner ??
                          "Unassigned"}
                      </span>

                      <small>
                        {formatDate(
                          item.dueDate,
                        )}
                      </small>
                    </div>
                  </article>
                ),
              )}

            {executiveReport
              .attentionItems
              .length === 0 && (
              <div className="table-message">
                No management attention items.
              </div>
            )}
          </div>
        </section>

        <section className="governance-actions-toolbar">
          <button
            type="button"
            onClick={() =>
              setPanel(
                "meeting",
              )
            }
          >
            + Meeting
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "decision",
              )
            }
          >
            + Decision
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "action",
              )
            }
          >
            + Action
          </button>
        </section>

        {panel ===
          "meeting" && (
          <Panel
            title="Create meeting"
            onClose={() =>
              setPanel(
                null,
              )
            }
          >
            <form
              className="governance-form"
              onSubmit={
                submitMeeting
              }
            >
              <Field label="Meeting number">
                <input
                  required
                  value={
                    meetingForm.meetingNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    setMeetingForm({
                      ...meetingForm,
                      meetingNumber:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Type">
                <select
                  value={
                    meetingForm.meetingType
                  }
                  onChange={(
                    event,
                  ) =>
                    setMeetingForm({
                      ...meetingForm,
                      meetingType:
                        event.target.value as GovernanceMeetingType,
                    })
                  }
                >
                  {meetingTypes.map(
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

              <Field
                label="Title"
                full
              >
                <input
                  required
                  value={
                    meetingForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setMeetingForm({
                      ...meetingForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Scheduled">
                <input
                  required
                  type="datetime-local"
                  value={
                    meetingForm.scheduledAt
                  }
                  onChange={(
                    event,
                  ) =>
                    setMeetingForm({
                      ...meetingForm,
                      scheduledAt:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Chair">
                <input
                  value={
                    meetingForm.chairName
                  }
                  onChange={(
                    event,
                  ) =>
                    setMeetingForm({
                      ...meetingForm,
                      chairName:
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
                  setPanel(
                    null,
                  )
                }
              />
            </form>
          </Panel>
        )}

        {panel ===
          "decision" && (
          <Panel
            title="Record decision"
            onClose={() =>
              setPanel(
                null,
              )
            }
          >
            <form
              className="governance-form"
              onSubmit={
                submitDecision
              }
            >
              <Field label="Decision number">
                <input
                  required
                  value={
                    decisionForm.decisionNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    setDecisionForm({
                      ...decisionForm,
                      decisionNumber:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Meeting">
                <select
                  value={
                    decisionForm.meetingId
                    ?? ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setDecisionForm({
                      ...decisionForm,
                      meetingId:
                        event.target.value
                          || null,
                    })
                  }
                >
                  <option value="">
                    No meeting
                  </option>

                  {meetings.map(
                    (
                      meeting,
                    ) => (
                      <option
                        key={
                          meeting.id
                        }
                        value={
                          meeting.id
                        }
                      >
                        {meeting.meetingNumber}
                        {" — "}
                        {meeting.title}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field
                label="Decision"
                full
              >
                <input
                  required
                  value={
                    decisionForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setDecisionForm({
                      ...decisionForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Decision date">
                <input
                  type="date"
                  value={
                    decisionForm.decisionDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setDecisionForm({
                      ...decisionForm,
                      decisionDate:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Due date">
                <input
                  type="date"
                  value={
                    decisionForm.dueDate
                    ?? ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setDecisionForm({
                      ...decisionForm,
                      dueDate:
                        event.target.value
                          || null,
                    })
                  }
                />
              </Field>

              <Field label="Impact area">
                <select
                  value={
                    decisionForm.impactArea
                  }
                  onChange={(
                    event,
                  ) =>
                    setDecisionForm({
                      ...decisionForm,
                      impactArea:
                        event.target.value as GovernanceDecisionImpactArea,
                    })
                  }
                >
                  {decisionImpactAreas.map(
                    (
                      value,
                    ) => (
                      <option
                        key={
                          value
                        }
                        value={
                          value
                        }
                      >
                        {value}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Owner">
                <input
                  value={
                    decisionForm.ownerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setDecisionForm({
                      ...decisionForm,
                      ownerName:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Description"
                full
              >
                <textarea
                  rows={3}
                  value={
                    decisionForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setDecisionForm({
                      ...decisionForm,
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
                  setPanel(
                    null,
                  )
                }
              />
            </form>
          </Panel>
        )}

        {panel ===
          "action" && (
          <Panel
            title="Create management action"
            onClose={() =>
              setPanel(
                null,
              )
            }
          >
            <form
              className="governance-form"
              onSubmit={
                submitAction
              }
            >
              <Field label="Action number">
                <input
                  required
                  value={
                    actionForm.actionNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
                      actionNumber:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Priority">
                <select
                  value={
                    actionForm.priority
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
                      priority:
                        event.target.value as GovernanceActionPriority,
                    })
                  }
                >
                  {actionPriorities.map(
                    (
                      value,
                    ) => (
                      <option
                        key={
                          value
                        }
                        value={
                          value
                        }
                      >
                        {value}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field
                label="Action"
                full
              >
                <input
                  required
                  value={
                    actionForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Owner">
                <input
                  value={
                    actionForm.ownerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
                      ownerName:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Due date">
                <input
                  required
                  type="date"
                  value={
                    actionForm.dueDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
                      dueDate:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Meeting">
                <select
                  value={
                    actionForm.meetingId
                    ?? ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
                      meetingId:
                        event.target.value
                          || null,
                    })
                  }
                >
                  <option value="">
                    No meeting
                  </option>

                  {meetings.map(
                    (
                      meeting,
                    ) => (
                      <option
                        key={
                          meeting.id
                        }
                        value={
                          meeting.id
                        }
                      >
                        {meeting.meetingNumber}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field label="Decision">
                <select
                  value={
                    actionForm.decisionId
                    ?? ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
                      decisionId:
                        event.target.value
                          || null,
                    })
                  }
                >
                  <option value="">
                    No decision
                  </option>

                  {decisions.map(
                    (
                      decision,
                    ) => (
                      <option
                        key={
                          decision.id
                        }
                        value={
                          decision.id
                        }
                      >
                        {decision.decisionNumber}
                      </option>
                    ),
                  )}
                </select>
              </Field>

              <Field
                label="Description"
                full
              >
                <textarea
                  rows={3}
                  value={
                    actionForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
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
                  setPanel(
                    null,
                  )
                }
              />
            </form>
          </Panel>
        )}

        <section
          className="governance-card"
          id="actions"
        >
          <Header
            eyebrow="FOLLOW-THROUGH"
            title="Management actions"
            value={`${intelligence.openActions} open`}
          />

          <div className="schedule-table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>ACTION</th>
                  <th>OWNER</th>
                  <th>PRIORITY</th>
                  <th>DUE</th>
                  <th>STATUS</th>
                  <th>BLOCKER</th>
                </tr>
              </thead>

              <tbody>
                {actions.map(
                  (
                    governanceAction,
                  ) => (
                    <tr
                      key={
                        governanceAction.id
                      }
                      className={
                        governanceAction.overdue
                          ? "governance-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            governanceAction.actionNumber
                          }
                          title={
                            governanceAction.title
                          }
                        />
                      </td>

                      <td>
                        {governanceAction.ownerName
                          ?? "—"}
                      </td>

                      <td>
                        <span
                          className={`governance-priority governance-priority-${governanceAction.priority.toLowerCase()}`}
                        >
                          {
                            governanceAction.priority
                          }
                        </span>
                      </td>

                      <td>
                        {formatDate(
                          governanceAction.dueDate,
                        )}
                      </td>

                      <td>
                        <select
                          className="schedule-select"
                          value={
                            governanceAction.status
                          }
                          disabled={
                            busy
                          }
                          onChange={(
                            event,
                          ) =>
                            void updateActionStatus(
                              governanceAction,
                              event.target.value as GovernanceActionStatus,
                            )
                          }
                        >
                          {actionStatusOptions(
                            governanceAction.status,
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

                      <td>
                        {governanceAction.blockerReason
                          ?? "—"}
                      </td>
                    </tr>
                  ),
                )}

                {actions.length ===
                  0 && (
                  <Empty
                    columns={6}
                    text="No management actions."
                  />
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="governance-card"
          id="decisions"
        >
          <Header
            eyebrow="DECISION GOVERNANCE"
            title="Decision log"
            value={`${decisions.length} decisions`}
          />

          <div className="schedule-table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>DECISION</th>
                  <th>DATE</th>
                  <th>OWNER</th>
                  <th>IMPACT</th>
                  <th>DUE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {decisions.map(
                  (
                    decision,
                  ) => (
                    <tr
                      key={
                        decision.id
                      }
                      className={
                        decision.overdue
                          ? "governance-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            decision.decisionNumber
                          }
                          title={
                            decision.title
                          }
                        />
                      </td>

                      <td>
                        {formatDate(
                          decision.decisionDate,
                        )}
                      </td>

                      <td>
                        {decision.ownerName
                          ?? "—"}
                      </td>

                      <td>
                        {
                          decision.impactArea
                        }
                      </td>

                      <td>
                        {formatDate(
                          decision.dueDate,
                        )}
                      </td>

                      <td>
                        <select
                          className="schedule-select"
                          value={
                            decision.status
                          }
                          disabled={
                            busy
                          }
                          onChange={(
                            event,
                          ) =>
                            void updateDecisionStatus(
                              decision,
                              event.target.value as GovernanceDecisionStatus,
                            )
                          }
                        >
                          {decisionStatusOptions(
                            decision.status,
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
                                {status}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                    </tr>
                  ),
                )}

                {decisions.length ===
                  0 && (
                  <Empty
                    columns={6}
                    text="No project decisions."
                  />
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="governance-card"
          id="meetings"
        >
          <Header
            eyebrow="MEETING GOVERNANCE"
            title="Meeting register"
            value={`${meetings.length} meetings`}
          />

          <div className="schedule-table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>MEETING</th>
                  <th>TYPE</th>
                  <th>SCHEDULED</th>
                  <th>CHAIR</th>
                  <th>MINUTES</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {meetings.map(
                  (
                    meeting,
                  ) => (
                    <tr
                      key={
                        meeting.id
                      }
                      className={
                        meeting.missingMinutes
                          ? "governance-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            meeting.meetingNumber
                          }
                          title={
                            meeting.title
                          }
                        />
                      </td>

                      <td>
                        {
                          meeting.meetingType
                        }
                      </td>

                      <td>
                        {formatDateTime(
                          meeting.scheduledAt,
                        )}
                      </td>

                      <td>
                        {meeting.chairName
                          ?? "—"}
                      </td>

                      <td>
                        {meeting.missingMinutes
                          ? "MISSING"
                          : meeting.minutes
                            ? "Recorded"
                            : "—"}
                      </td>

                      <td>
                        <select
                          className="schedule-select"
                          value={
                            meeting.status
                          }
                          disabled={
                            busy
                          }
                          onChange={(
                            event,
                          ) =>
                            void updateMeetingStatus(
                              meeting,
                              event.target.value as GovernanceMeetingStatus,
                            )
                          }
                        >
                          <option value="PLANNED">
                            PLANNED
                          </option>

                          <option value="HELD">
                            HELD
                          </option>

                          <option value="CANCELLED">
                            CANCELLED
                          </option>
                        </select>
                      </td>
                    </tr>
                  ),
                )}

                {meetings.length ===
                  0 && (
                  <Empty
                    columns={6}
                    text="No governance meetings."
                  />
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="governance-card">
          <Header
            eyebrow="GOVERNANCE PERFORMANCE"
            title="Closure discipline"
            value={intelligence.governanceRisk.replaceAll(
              "_",
              " ",
            )}
          />

          <div className="executive-score-grid">
            <Metric
              label="Action closure"
              value={`${intelligence.actionClosureRate.toFixed(
                1,
              )}%`}
            />

            <Metric
              label="Decision closure"
              value={`${intelligence.decisionClosureRate.toFixed(
                1,
              )}%`}
            />

            <Metric
              label="14-day actions"
              value={String(
                intelligence.actionsDueNext14Days,
              )}
            />

            <Metric
              label="Implemented decisions"
              value={String(
                intelligence.implementedDecisions,
              )}
            />
          </div>

          <p className="executive-summary">
            {intelligence.explanation}
          </p>
        </section>

        <section className="governance-card">
          <Header
            eyebrow="EXECUTIVE REPORT HISTORY"
            title="Governance report snapshots"
            value={`${reportHistory.length} snapshots`}
          />

          <div className="schedule-table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>DATE</th>
                  <th>PROGRESS</th>
                  <th>SCHEDULE</th>
                  <th>PREDICTIVE</th>
                  <th>GOVERNANCE</th>
                  <th>CPI</th>
                  <th>SPI</th>
                  <th>OVERDUE ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {reportHistory.map(
                  (
                    snapshot,
                  ) => (
                    <tr
                      key={
                        snapshot.id
                      }
                    >
                      <td>
                        {formatDate(
                          snapshot.reportDate,
                        )}
                      </td>

                      <td>
                        {Number(
                          snapshot.physicalProgressPercentage,
                        ).toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {Number(
                          snapshot.scheduleScore,
                        ).toFixed(
                          0,
                        )}
                      </td>

                      <td>
                        {Number(
                          snapshot.predictiveScore,
                        ).toFixed(
                          0,
                        )}
                      </td>

                      <td>
                        {Number(
                          snapshot.governanceScore,
                        ).toFixed(
                          0,
                        )}
                      </td>

                      <td>
                        {Number(
                          snapshot.cpi,
                        ).toFixed(
                          2,
                        )}
                      </td>

                      <td>
                        {Number(
                          snapshot.spi,
                        ).toFixed(
                          2,
                        )}
                      </td>

                      <td>
                        {
                          snapshot.overdueActions
                        }
                      </td>
                    </tr>
                  ),
                )}

                {reportHistory.length ===
                  0 && (
                  <Empty
                    columns={8}
                    text="No executive report snapshots."
                  />
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function actionStatusOptions(
  current: GovernanceActionStatus,
): GovernanceActionStatus[] {
  switch (current) {
    case "OPEN":
      return [
        "OPEN",
        "IN_PROGRESS",
        "BLOCKED",
        "DONE",
        "VOID",
      ];

    case "IN_PROGRESS":
      return [
        "IN_PROGRESS",
        "BLOCKED",
        "DONE",
        "VOID",
      ];

    case "BLOCKED":
      return [
        "BLOCKED",
        "IN_PROGRESS",
        "DONE",
        "VOID",
      ];

    case "DONE":
      return [
        "DONE",
      ];

    case "VOID":
      return [
        "VOID",
      ];
  }
}

function decisionStatusOptions(
  current: GovernanceDecisionStatus,
): GovernanceDecisionStatus[] {
  switch (current) {
    case "PROPOSED":
      return [
        "PROPOSED",
        "APPROVED",
        "REJECTED",
        "SUPERSEDED",
      ];

    case "APPROVED":
      return [
        "APPROVED",
        "IMPLEMENTED",
        "SUPERSEDED",
      ];

    case "REJECTED":
      return [
        "REJECTED",
      ];

    case "IMPLEMENTED":
      return [
        "IMPLEMENTED",
      ];

    case "SUPERSEDED":
      return [
        "SUPERSEDED",
      ];
  }
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

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="governance-metric">
      <span>
        {label}
      </span>

      <strong>
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
    <div className="governance-card-header">
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
    <section className="governance-card">
      <div className="governance-card-header">
        <div>
          <div className="eyebrow">
            GOVERNANCE INPUT
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

function Empty({
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
