"use client";

import Link from "next/link";
import { ProjectWorkspaceSidebar } from "./ProjectWorkspaceSidebar";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  BuildSightApiError,
  createProjectChangeEvent,
  createProjectDelayEvent,
  createProjectIssue,
  createProjectRisk,
  getProjectRiskControl,
  updateProjectChangeEvent,
  updateProjectDelayEvent,
  updateProjectIssue,
  updateProjectRisk,
} from "@/lib/api";

import type {
  ChangeEventStatus,
  CreateChangeEventInput,
  CreateDelayEventInput,
  CreateIssueInput,
  CreateRiskInput,
  DelayCause,
  DelayStatus,
  IssueSeverity,
  IssueStatus,
  ProjectChangeEvent,
  ProjectDelayEvent,
  ProjectIssue,
  ProjectRisk,
  RiskCategory,
  RiskControl,
  RiskExposureBand,
  RiskIntelligenceLevel,
  RiskStatus,
} from "@/types/project";

type OpenPanel =
  | "risk"
  | "issue"
  | "change"
  | "delay"
  | null;

const categoryLabels: Record<
  RiskCategory,
  string
> = {
  COST: "Cost",
  SCHEDULE: "Schedule",
  TECHNICAL: "Technical",
  COMMERCIAL: "Commercial",
  PROCUREMENT: "Procurement",
  SAFETY: "Safety",
  QUALITY: "Quality",
  OTHER: "Other",
};

const severityLabels: Record<
  IssueSeverity,
  string
> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const delayCauseLabels: Record<
  DelayCause,
  string
> = {
  CLIENT: "Client",
  DESIGN: "Design",
  PROCUREMENT: "Procurement",
  SUBCONTRACTOR: "Subcontractor",
  WEATHER: "Weather",
  SITE_CONDITION: "Site condition",
  REGULATORY: "Regulatory",
  OTHER: "Other",
};

const intelligenceLabels: Record<
  RiskIntelligenceLevel,
  string
> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
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

function futureDate(
  days: number,
): string {
  const date =
    new Date();

  date.setDate(
    date.getDate() + days,
  );

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

function intelligenceClass(
  level: RiskIntelligenceLevel,
): string {
  return `risk-intelligence-level risk-level-${level
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function exposureClass(
  exposure: RiskExposureBand,
): string {
  return `risk-exposure risk-exposure-${exposure.toLowerCase()}`;
}

function severityClass(
  severity: IssueSeverity,
): string {
  return `issue-severity issue-severity-${severity.toLowerCase()}`;
}

function riskStatusOptions(
  status: RiskStatus,
): RiskStatus[] {
  switch (status) {
    case "OPEN":
      return [
        "OPEN",
        "MITIGATING",
        "ACCEPTED",
        "CLOSED",
      ];

    case "MITIGATING":
      return [
        "MITIGATING",
        "OPEN",
        "ACCEPTED",
        "CLOSED",
      ];

    case "ACCEPTED":
      return [
        "ACCEPTED",
        "CLOSED",
      ];

    case "CLOSED":
      return [
        "CLOSED",
      ];
  }
}

function issueStatusOptions(
  status: IssueStatus,
): IssueStatus[] {
  switch (status) {
    case "OPEN":
      return [
        "OPEN",
        "IN_PROGRESS",
        "RESOLVED",
        "CLOSED",
      ];

    case "IN_PROGRESS":
      return [
        "IN_PROGRESS",
        "OPEN",
        "RESOLVED",
        "CLOSED",
      ];

    case "RESOLVED":
      return [
        "RESOLVED",
        "IN_PROGRESS",
        "CLOSED",
      ];

    case "CLOSED":
      return [
        "CLOSED",
      ];
  }
}

function changeStatusOptions(
  status: ChangeEventStatus,
): ChangeEventStatus[] {
  switch (status) {
    case "DRAFT":
      return [
        "DRAFT",
        "UNDER_REVIEW",
        "REJECTED",
      ];

    case "UNDER_REVIEW":
      return [
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED",
      ];

    case "APPROVED":
      return [
        "APPROVED",
        "IMPLEMENTED",
      ];

    case "REJECTED":
      return [
        "REJECTED",
      ];

    case "IMPLEMENTED":
      return [
        "IMPLEMENTED",
      ];
  }
}

function delayStatusOptions(
  status: DelayStatus,
): DelayStatus[] {
  switch (status) {
    case "OPEN":
      return [
        "OPEN",
        "MITIGATING",
        "RESOLVED",
      ];

    case "MITIGATING":
      return [
        "MITIGATING",
        "OPEN",
        "RESOLVED",
      ];

    case "RESOLVED":
      return [
        "RESOLVED",
      ];
  }
}

const riskDefaults: CreateRiskInput = {
  reference: "",
  title: "",
  description: "",
  category: "SCHEDULE",
  ownerName: "",
  probability: 3,
  impact: 3,
  residualProbability: 2,
  residualImpact: 3,
  mitigationPlan: "",
  mitigationDueDate:
    futureDate(
      14,
    ),
};

const issueDefaults: CreateIssueInput = {
  sourceRiskId: null,
  reference: "",
  title: "",
  description: "",
  severity: "MEDIUM",
  ownerName: "",
  targetResolutionDate:
    futureDate(
      7,
    ),
};

const changeDefaults: CreateChangeEventInput = {
  reference: "",
  title: "",
  description: "",
  originator: "",
  requestedDate:
    todayValue(),
  costImpact: 0,
  scheduleImpactDays: 0,
};

const delayDefaults: CreateDelayEventInput = {
  reference: "",
  title: "",
  description: "",
  cause: "DESIGN",
  ownerName: "",
  startDate:
    todayValue(),
  forecastDelayDays: 0,
  excusable: false,
  compensable: false,
};

export function ProjectRiskControlView({
  projectId,
}: {
  projectId: string;
}) {
  const [data, setData] =
    useState<RiskControl | null>(
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

  const [openPanel, setOpenPanel] =
    useState<OpenPanel>(
      null,
    );

  const [riskForm, setRiskForm] =
    useState<CreateRiskInput>(
      riskDefaults,
    );

  const [issueForm, setIssueForm] =
    useState<CreateIssueInput>(
      issueDefaults,
    );

  const [changeForm, setChangeForm] =
    useState<CreateChangeEventInput>(
      changeDefaults,
    );

  const [delayForm, setDelayForm] =
    useState<CreateDelayEventInput>(
      delayDefaults,
    );

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectRiskControl(
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
      await getProjectRiskControl(
        projectId,
      );

    setData(
      response,
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
          "The local backend operation failed.",
        );
      }

      return false;

    } finally {
      setBusy(
        false,
      );
    }
  }

  async function submitRisk(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createProjectRisk(
            projectId,
            riskForm,
          ),
      );

    if (
      ok
    ) {
      setRiskForm({
        ...riskDefaults,
        mitigationDueDate:
          futureDate(
            14,
          ),
      });

      setOpenPanel(
        null,
      );
    }
  }

  async function submitIssue(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createProjectIssue(
            projectId,
            issueForm,
          ),
      );

    if (
      ok
    ) {
      setIssueForm({
        ...issueDefaults,
        targetResolutionDate:
          futureDate(
            7,
          ),
      });

      setOpenPanel(
        null,
      );
    }
  }

  async function submitChange(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createProjectChangeEvent(
            projectId,
            changeForm,
          ),
      );

    if (
      ok
    ) {
      setChangeForm({
        ...changeDefaults,
        requestedDate:
          todayValue(),
      });

      setOpenPanel(
        null,
      );
    }
  }

  async function submitDelay(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createProjectDelayEvent(
            projectId,
            delayForm,
          ),
      );

    if (
      ok
    ) {
      setDelayForm({
        ...delayDefaults,
        startDate:
          todayValue(),
      });

      setOpenPanel(
        null,
      );
    }
  }

  async function changeRiskStatus(
    risk: ProjectRisk,
    status: RiskStatus,
  ) {
    if (
      status ===
      risk.status
    ) {
      return;
    }

    await runAction(
      () =>
        updateProjectRisk(
          projectId,
          risk.id,
          {
            version:
              risk.version,
            title:
              risk.title,
            description:
              risk.description ??
              "",
            category:
              risk.category,
            ownerName:
              risk.ownerName ??
              "",
            probability:
              risk.probability,
            impact:
              risk.impact,
            residualProbability:
              risk.residualProbability,
            residualImpact:
              risk.residualImpact,
            mitigationPlan:
              risk.mitigationPlan ??
              "",
            mitigationDueDate:
              risk.mitigationDueDate,
            status,
          },
        ),
    );
  }

  async function changeIssueStatus(
    issue: ProjectIssue,
    status: IssueStatus,
  ) {
    if (
      status ===
      issue.status
    ) {
      return;
    }

    await runAction(
      () =>
        updateProjectIssue(
          projectId,
          issue.id,
          {
            version:
              issue.version,
            sourceRiskId:
              issue.sourceRiskId,
            title:
              issue.title,
            description:
              issue.description ??
              "",
            severity:
              issue.severity,
            ownerName:
              issue.ownerName ??
              "",
            targetResolutionDate:
              issue.targetResolutionDate,
            status,
          },
        ),
    );
  }

  async function changeChangeStatus(
    change: ProjectChangeEvent,
    status: ChangeEventStatus,
  ) {
    if (
      status ===
      change.status
    ) {
      return;
    }

    await runAction(
      () =>
        updateProjectChangeEvent(
          projectId,
          change.id,
          {
            version:
              change.version,
            title:
              change.title,
            description:
              change.description ??
              "",
            originator:
              change.originator ??
              "",
            requestedDate:
              change.requestedDate,
            decisionDate:
              change.decisionDate,
            costImpact:
              Number(
                change.costImpact,
              ),
            scheduleImpactDays:
              change.scheduleImpactDays,
            status,
          },
        ),
    );
  }

  async function changeDelayStatus(
    delay: ProjectDelayEvent,
    status: DelayStatus,
  ) {
    if (
      status ===
      delay.status
    ) {
      return;
    }

    await runAction(
      () =>
        updateProjectDelayEvent(
          projectId,
          delay.id,
          {
            version:
              delay.version,
            title:
              delay.title,
            description:
              delay.description ??
              "",
            cause:
              delay.cause,
            ownerName:
              delay.ownerName ??
              "",
            startDate:
              delay.startDate,
            endDate:
              delay.endDate,
            forecastDelayDays:
              delay.forecastDelayDays,
            excusable:
              delay.excusable,
            compensable:
              delay.compensable,
            status,
          },
        ),
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
          Loading risk intelligence...
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
            Risk control unavailable
          </h1>

          <p>
            {error ||
              "BuildSight could not load project risk data."}
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
    risks,
    issues,
    changes,
    delays,
  } = data;

  return (
    <div className="risk-shell">
      <ProjectWorkspaceSidebar
        projectId={projectId}
        projectCode={project.code}
        className="risk-sidebar"
        localLinks={[
          { href: "#risks", label: "Risks" },
          { href: "#issues", label: "Issues" },
          { href: "#changes", label: "Changes" },
          { href: "#delays", label: "Delays" },
        ]}
      />

      <main className="risk-main">
        <header className="risk-topbar">
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
              RISK INTELLIGENCE
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Residual risk exposure,
              unresolved issues, controlled
              change, delay management and
              mitigation governance.
            </p>
          </div>

          <div className="risk-header-score">
            <span>
              RISK CONTROL HEALTH
            </span>

            <strong>
              {intelligence.riskScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={
                intelligenceClass(
                  intelligence.riskLevel,
                )
              }
            >
              {
                intelligenceLabels[
                  intelligence.riskLevel
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

        <section className="risk-kpi-grid">
          <RiskKpi
            label="HIGH EXPOSURE RISKS"
            value={String(
              intelligence.highExposureRisks,
            )}
            detail={`${intelligence.openRisks} open risks`}
          />

          <RiskKpi
            label="CRITICAL ISSUES"
            value={String(
              intelligence.criticalOpenIssues,
            )}
            detail={`${intelligence.overdueIssues} overdue issues`}
          />

          <RiskKpi
            label="PENDING CHANGES"
            value={String(
              intelligence.pendingChanges,
            )}
            detail={`${intelligence.approvedChanges} approved`}
          />

          <RiskKpi
            label="ACTIVE DELAYS"
            value={String(
              intelligence.activeDelays,
            )}
            detail={`${intelligence.forecastDelayDays} forecast delay days`}
            emphasis
          />
        </section>

        <section className="risk-intelligence-panel">
          <div className="risk-score-panel">
            <span>
              CONTROL SCORE
            </span>

            <strong>
              {intelligence.riskScore.toFixed(
                0,
              )}
            </strong>

            <small>
              /100
            </small>

            <i
              className={
                intelligenceClass(
                  intelligence.riskLevel,
                )
              }
            >
              {
                intelligenceLabels[
                  intelligence.riskLevel
                ]
              }
            </i>
          </div>

          <div className="risk-intelligence-grid">
            <RiskMetric
              label="Max residual exposure"
              value={`${intelligence.maximumResidualExposure}/25`}
            />

            <RiskMetric
              label="Average residual exposure"
              value={intelligence.averageResidualExposure.toFixed(
                1,
              )}
            />

            <RiskMetric
              label="Overdue mitigations"
              value={String(
                intelligence.overdueMitigations,
              )}
            />

            <RiskMetric
              label="Approved change cost"
              value={money(
                Number(
                  intelligence.approvedChangeCostImpact,
                ),
              )}
            />

            <RiskMetric
              label="Approved schedule change"
              value={`${intelligence.approvedChangeScheduleImpactDays} days`}
            />

            <RiskMetric
              label="Forecast delay exposure"
              value={`${intelligence.forecastDelayDays} days`}
            />
          </div>

          <p>
            {intelligence.explanation}
          </p>
        </section>

        <section className="risk-actions">
          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                "risk",
              )
            }
          >
            + Risk
          </button>

          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                "issue",
              )
            }
          >
            + Issue
          </button>

          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                "change",
              )
            }
          >
            + Change
          </button>

          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                "delay",
              )
            }
          >
            + Delay
          </button>
        </section>

        {openPanel ===
          "risk" && (
          <RiskPanel
            title="Register project risk"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="risk-form"
              onSubmit={
                submitRisk
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    riskForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setRiskForm({
                      ...riskForm,
                      reference:
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
                    riskForm.category
                  }
                  onChange={(
                    event,
                  ) =>
                    setRiskForm({
                      ...riskForm,
                      category:
                        event.target
                          .value as RiskCategory,
                    })
                  }
                >
                  {(
                    Object.keys(
                      categoryLabels,
                    ) as RiskCategory[]
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

              <label className="field-wide">
                <span>
                  Risk title
                </span>

                <input
                  required
                  value={
                    riskForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setRiskForm({
                      ...riskForm,
                      title:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Owner
                </span>

                <input
                  value={
                    riskForm.ownerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setRiskForm({
                      ...riskForm,
                      ownerName:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Mitigation due
                </span>

                <input
                  required
                  type="date"
                  value={
                    riskForm.mitigationDueDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setRiskForm({
                      ...riskForm,
                      mitigationDueDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <RiskScoreInput
                label="Inherent probability"
                value={
                  riskForm.probability
                }
                onChange={(
                  value,
                ) =>
                  setRiskForm({
                    ...riskForm,
                    probability:
                      value,
                  })
                }
              />

              <RiskScoreInput
                label="Inherent impact"
                value={
                  riskForm.impact
                }
                onChange={(
                  value,
                ) =>
                  setRiskForm({
                    ...riskForm,
                    impact:
                      value,
                  })
                }
              />

              <RiskScoreInput
                label="Residual probability"
                value={
                  riskForm.residualProbability
                }
                onChange={(
                  value,
                ) =>
                  setRiskForm({
                    ...riskForm,
                    residualProbability:
                      value,
                  })
                }
              />

              <RiskScoreInput
                label="Residual impact"
                value={
                  riskForm.residualImpact
                }
                onChange={(
                  value,
                ) =>
                  setRiskForm({
                    ...riskForm,
                    residualImpact:
                      value,
                  })
                }
              />

              <label className="field-full">
                <span>
                  Description
                </span>

                <textarea
                  rows={3}
                  value={
                    riskForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setRiskForm({
                      ...riskForm,
                      description:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Mitigation plan
                </span>

                <textarea
                  rows={3}
                  value={
                    riskForm.mitigationPlan
                  }
                  onChange={(
                    event,
                  ) =>
                    setRiskForm({
                      ...riskForm,
                      mitigationPlan:
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
                  setOpenPanel(
                    null,
                  )
                }
              />
            </form>
          </RiskPanel>
        )}

        {openPanel ===
          "issue" && (
          <RiskPanel
            title="Register project issue"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="risk-form"
              onSubmit={
                submitIssue
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    issueForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setIssueForm({
                      ...issueForm,
                      reference:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Severity
                </span>

                <select
                  value={
                    issueForm.severity
                  }
                  onChange={(
                    event,
                  ) =>
                    setIssueForm({
                      ...issueForm,
                      severity:
                        event.target
                          .value as IssueSeverity,
                    })
                  }
                >
                  {(
                    Object.keys(
                      severityLabels,
                    ) as IssueSeverity[]
                  ).map(
                    (
                      severity,
                    ) => (
                      <option
                        key={
                          severity
                        }
                        value={
                          severity
                        }
                      >
                        {
                          severityLabels[
                            severity
                          ]
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="field-wide">
                <span>
                  Issue title
                </span>

                <input
                  required
                  value={
                    issueForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setIssueForm({
                      ...issueForm,
                      title:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Related risk
                </span>

                <select
                  value={
                    issueForm.sourceRiskId ??
                    ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setIssueForm({
                      ...issueForm,
                      sourceRiskId:
                        event.target
                            .value ||
                        null,
                    })
                  }
                >
                  <option value="">
                    No linked risk
                  </option>

                  {risks.map(
                    (
                      risk,
                    ) => (
                      <option
                        key={
                          risk.id
                        }
                        value={
                          risk.id
                        }
                      >
                        {
                          risk.reference
                        }
                        {" — "}
                        {
                          risk.title
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Owner
                </span>

                <input
                  value={
                    issueForm.ownerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setIssueForm({
                      ...issueForm,
                      ownerName:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Target resolution
                </span>

                <input
                  required
                  type="date"
                  value={
                    issueForm.targetResolutionDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setIssueForm({
                      ...issueForm,
                      targetResolutionDate:
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
                  rows={4}
                  value={
                    issueForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setIssueForm({
                      ...issueForm,
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
                  setOpenPanel(
                    null,
                  )
                }
              />
            </form>
          </RiskPanel>
        )}

        {openPanel ===
          "change" && (
          <RiskPanel
            title="Register change event"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="risk-form"
              onSubmit={
                submitChange
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    changeForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setChangeForm({
                      ...changeForm,
                      reference:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Originator
                </span>

                <input
                  value={
                    changeForm.originator
                  }
                  onChange={(
                    event,
                  ) =>
                    setChangeForm({
                      ...changeForm,
                      originator:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label className="field-wide">
                <span>
                  Change title
                </span>

                <input
                  required
                  value={
                    changeForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setChangeForm({
                      ...changeForm,
                      title:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Requested date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    changeForm.requestedDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setChangeForm({
                      ...changeForm,
                      requestedDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Cost impact
                </span>

                <input
                  required
                  type="number"
                  step="0.01"
                  value={
                    changeForm.costImpact
                  }
                  onChange={(
                    event,
                  ) =>
                    setChangeForm({
                      ...changeForm,
                      costImpact:
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
                  Schedule impact days
                </span>

                <input
                  required
                  type="number"
                  step="1"
                  value={
                    changeForm.scheduleImpactDays
                  }
                  onChange={(
                    event,
                  ) =>
                    setChangeForm({
                      ...changeForm,
                      scheduleImpactDays:
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
                  rows={4}
                  value={
                    changeForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setChangeForm({
                      ...changeForm,
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
                  setOpenPanel(
                    null,
                  )
                }
              />
            </form>
          </RiskPanel>
        )}

        {openPanel ===
          "delay" && (
          <RiskPanel
            title="Register delay event"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="risk-form"
              onSubmit={
                submitDelay
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    delayForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setDelayForm({
                      ...delayForm,
                      reference:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Cause
                </span>

                <select
                  value={
                    delayForm.cause
                  }
                  onChange={(
                    event,
                  ) =>
                    setDelayForm({
                      ...delayForm,
                      cause:
                        event.target
                          .value as DelayCause,
                    })
                  }
                >
                  {(
                    Object.keys(
                      delayCauseLabels,
                    ) as DelayCause[]
                  ).map(
                    (
                      cause,
                    ) => (
                      <option
                        key={
                          cause
                        }
                        value={
                          cause
                        }
                      >
                        {
                          delayCauseLabels[
                            cause
                          ]
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="field-wide">
                <span>
                  Delay title
                </span>

                <input
                  required
                  value={
                    delayForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setDelayForm({
                      ...delayForm,
                      title:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Owner
                </span>

                <input
                  value={
                    delayForm.ownerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setDelayForm({
                      ...delayForm,
                      ownerName:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Start date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    delayForm.startDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setDelayForm({
                      ...delayForm,
                      startDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Forecast delay days
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={
                    delayForm.forecastDelayDays
                  }
                  onChange={(
                    event,
                  ) =>
                    setDelayForm({
                      ...delayForm,
                      forecastDelayDays:
                        Number(
                          event.target
                            .value,
                        ),
                    })
                  }
                />
              </label>

              <label className="risk-checkbox-label">
                <input
                  type="checkbox"
                  checked={
                    delayForm.excusable
                  }
                  onChange={(
                    event,
                  ) =>
                    setDelayForm({
                      ...delayForm,
                      excusable:
                        event.target
                          .checked,
                    })
                  }
                />

                <span>
                  Excusable delay
                </span>
              </label>

              <label className="risk-checkbox-label">
                <input
                  type="checkbox"
                  checked={
                    delayForm.compensable
                  }
                  onChange={(
                    event,
                  ) =>
                    setDelayForm({
                      ...delayForm,
                      compensable:
                        event.target
                          .checked,
                    })
                  }
                />

                <span>
                  Compensable delay
                </span>
              </label>

              <label className="field-full">
                <span>
                  Description
                </span>

                <textarea
                  rows={4}
                  value={
                    delayForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setDelayForm({
                      ...delayForm,
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
                  setOpenPanel(
                    null,
                  )
                }
              />
            </form>
          </RiskPanel>
        )}

        <section
          className="risk-card"
          id="risks"
        >
          <div className="risk-card-header">
            <div>
              <div className="eyebrow">
                RISK REGISTER
              </div>

              <h2>
                Project risks
              </h2>
            </div>

            <strong>
              {
                risks.length
              }{" "}
              risks
            </strong>
          </div>

          <div className="risk-table-wrapper">
            <table className="risk-table">
              <thead>
                <tr>
                  <th>RISK</th>
                  <th>CATEGORY</th>
                  <th>INHERENT</th>
                  <th>RESIDUAL</th>
                  <th>EXPOSURE</th>
                  <th>OWNER</th>
                  <th>MITIGATION DUE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {risks.map(
                  (
                    risk,
                  ) => (
                    <tr
                      key={
                        risk.id
                      }
                    >
                      <td>
                        <div className="risk-name-cell">
                          <strong>
                            {
                              risk.reference
                            }
                          </strong>

                          <span>
                            {
                              risk.title
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {
                          categoryLabels[
                            risk.category
                          ]
                        }
                      </td>

                      <td>
                        <strong>
                          {
                            risk.inherentScore
                          }
                          /25
                        </strong>
                      </td>

                      <td>
                        <strong>
                          {
                            risk.residualScore
                          }
                          /25
                        </strong>
                      </td>

                      <td>
                        <span
                          className={
                            exposureClass(
                              risk.exposureBand,
                            )
                          }
                        >
                          {
                            risk.exposureBand
                          }
                        </span>
                      </td>

                      <td>
                        {risk.ownerName ??
                          "—"}
                      </td>

                      <td>
                        {formatDate(
                          risk.mitigationDueDate,
                        )}
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            risk.status
                          }
                          className={`risk-status risk-status-${risk.status.toLowerCase()}`}
                          onChange={(
                            event,
                          ) =>
                            void changeRiskStatus(
                              risk,
                              event.target
                                .value as RiskStatus,
                            )
                          }
                        >
                          {riskStatusOptions(
                            risk.status,
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

                {risks.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        8
                      }
                    >
                      <div className="table-message">
                        No project risks recorded.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="risk-card"
          id="issues"
        >
          <div className="risk-card-header">
            <div>
              <div className="eyebrow">
                ISSUE MANAGEMENT
              </div>

              <h2>
                Active project issues
              </h2>
            </div>

            <strong>
              {
                intelligence.openIssues
              }{" "}
              open
            </strong>
          </div>

          <div className="risk-table-wrapper">
            <table className="risk-table">
              <thead>
                <tr>
                  <th>ISSUE</th>
                  <th>SEVERITY</th>
                  <th>RELATED RISK</th>
                  <th>OWNER</th>
                  <th>TARGET</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {issues.map(
                  (
                    issue,
                  ) => (
                    <tr
                      key={
                        issue.id
                      }
                    >
                      <td>
                        <div className="risk-name-cell">
                          <strong>
                            {
                              issue.reference
                            }
                          </strong>

                          <span>
                            {
                              issue.title
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={
                            severityClass(
                              issue.severity,
                            )
                          }
                        >
                          {
                            severityLabels[
                              issue.severity
                            ]
                          }
                        </span>
                      </td>

                      <td>
                        {issue.sourceRiskReference ??
                          "—"}
                      </td>

                      <td>
                        {issue.ownerName ??
                          "—"}
                      </td>

                      <td>
                        {formatDate(
                          issue.targetResolutionDate,
                        )}
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            issue.status
                          }
                          className={`risk-status issue-status-${issue.status.toLowerCase().replaceAll("_", "-")}`}
                          onChange={(
                            event,
                          ) =>
                            void changeIssueStatus(
                              issue,
                              event.target
                                .value as IssueStatus,
                            )
                          }
                        >
                          {issueStatusOptions(
                            issue.status,
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

                {issues.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        6
                      }
                    >
                      <div className="table-message">
                        No project issues recorded.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="risk-card"
          id="changes"
        >
          <div className="risk-card-header">
            <div>
              <div className="eyebrow">
                CHANGE CONTROL
              </div>

              <h2>
                Change-control events
              </h2>
            </div>

            <strong>
              {
                changes.length
              }{" "}
              events
            </strong>
          </div>

          <div className="risk-table-wrapper">
            <table className="risk-table">
              <thead>
                <tr>
                  <th>CHANGE</th>
                  <th>ORIGINATOR</th>
                  <th>REQUESTED</th>
                  <th>COST IMPACT</th>
                  <th>SCHEDULE IMPACT</th>
                  <th>DECISION</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {changes.map(
                  (
                    change,
                  ) => (
                    <tr
                      key={
                        change.id
                      }
                    >
                      <td>
                        <div className="risk-name-cell">
                          <strong>
                            {
                              change.reference
                            }
                          </strong>

                          <span>
                            {
                              change.title
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {change.originator ??
                          "—"}
                      </td>

                      <td>
                        {formatDate(
                          change.requestedDate,
                        )}
                      </td>

                      <td>
                        <strong>
                          {money(
                            Number(
                              change.costImpact,
                            ),
                          )}
                        </strong>
                      </td>

                      <td>
                        {
                          change.scheduleImpactDays
                        }{" "}
                        days
                      </td>

                      <td>
                        {formatDate(
                          change.decisionDate,
                        )}
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            change.status
                          }
                          className={`risk-status change-status-${change.status.toLowerCase().replaceAll("_", "-")}`}
                          onChange={(
                            event,
                          ) =>
                            void changeChangeStatus(
                              change,
                              event.target
                                .value as ChangeEventStatus,
                            )
                          }
                        >
                          {changeStatusOptions(
                            change.status,
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

                {changes.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        7
                      }
                    >
                      <div className="table-message">
                        No project changes recorded.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="risk-card"
          id="delays"
        >
          <div className="risk-card-header">
            <div>
              <div className="eyebrow">
                DELAY CONTROL
              </div>

              <h2>
                Delay events
              </h2>
            </div>

            <strong>
              {
                intelligence.forecastDelayDays
              }{" "}
              forecast days
            </strong>
          </div>

          <div className="risk-table-wrapper">
            <table className="risk-table">
              <thead>
                <tr>
                  <th>DELAY</th>
                  <th>CAUSE</th>
                  <th>START</th>
                  <th>END</th>
                  <th>DAYS</th>
                  <th>ENTITLEMENT</th>
                  <th>OWNER</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {delays.map(
                  (
                    delay,
                  ) => (
                    <tr
                      key={
                        delay.id
                      }
                    >
                      <td>
                        <div className="risk-name-cell">
                          <strong>
                            {
                              delay.reference
                            }
                          </strong>

                          <span>
                            {
                              delay.title
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {
                          delayCauseLabels[
                            delay.cause
                          ]
                        }
                      </td>

                      <td>
                        {formatDate(
                          delay.startDate,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          delay.endDate,
                        )}
                      </td>

                      <td>
                        <strong>
                          {
                            delay.forecastDelayDays
                          }
                        </strong>
                      </td>

                      <td>
                        <div className="delay-entitlement">
                          {delay.excusable && (
                            <span>
                              Excusable
                            </span>
                          )}

                          {delay.compensable && (
                            <span>
                              Compensable
                            </span>
                          )}

                          {!delay.excusable &&
                            !delay.compensable && (
                              <span>
                                None
                              </span>
                            )}
                        </div>
                      </td>

                      <td>
                        {delay.ownerName ??
                          "—"}
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            delay.status
                          }
                          className={`risk-status delay-status-${delay.status.toLowerCase()}`}
                          onChange={(
                            event,
                          ) =>
                            void changeDelayStatus(
                              delay,
                              event.target
                                .value as DelayStatus,
                            )
                          }
                        >
                          {delayStatusOptions(
                            delay.status,
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

                {delays.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        8
                      }
                    >
                      <div className="table-message">
                        No delay events recorded.
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
            BuildSight · Risk Intelligence
          </div>

          <div>
            {risks.length} risks
            {" · "}
            {issues.length} issues
            {" · "}
            {changes.length} changes
            {" · "}
            {delays.length} delays
          </div>
        </footer>
      </main>
    </div>
  );
}

function RiskKpi({
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
          ? "risk-kpi risk-kpi-emphasis"
          : "risk-kpi"
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

function RiskMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="risk-intelligence-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function RiskPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="risk-form-panel">
      <div className="risk-card-header">
        <div>
          <div className="eyebrow">
            CONTROL INPUT
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

function RiskScoreInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label>
      <span>
        {label}
      </span>

      <select
        value={
          value
        }
        onChange={(
          event,
        ) =>
          onChange(
            Number(
              event.target
                .value,
            ),
          )
        }
      >
        <option value={1}>
          1 — Very low
        </option>

        <option value={2}>
          2 — Low
        </option>

        <option value={3}>
          3 — Medium
        </option>

        <option value={4}>
          4 — High
        </option>

        <option value={5}>
          5 — Very high
        </option>
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
