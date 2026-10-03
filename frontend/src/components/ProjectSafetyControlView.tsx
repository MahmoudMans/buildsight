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
  createSafetyAction,
  createSafetyIncident,
  createSafetyObservation,
  createWorkPermit,
  getProjectSafety,
  updateSafetyAction,
  updateSafetyIncident,
  updateSafetyObservation,
  updateWorkPermit,
} from "@/lib/api";

import type {
  CreateSafetyActionInput,
  CreateSafetyIncidentInput,
  CreateSafetyObservationInput,
  CreateWorkPermitInput,
  HazardCategory,
  SafetyAction,
  SafetyActionStatus,
  SafetyControl,
  SafetyIncident,
  SafetyIncidentStatus,
  SafetyIncidentType,
  SafetyObservation,
  SafetyObservationStatus,
  SafetyObservationType,
  SafetyRiskLevel,
  SafetySeverity,
  WorkPermit,
  WorkPermitStatus,
  WorkPermitType,
} from "@/types/project";

type PanelType =
  | "incident"
  | "observation"
  | "action"
  | "permit"
  | null;

function todayValue(): string {
  const date =
    new Date();

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      "0",
    ),
    String(
      date.getDate(),
    ).padStart(
      2,
      "0",
    ),
  ].join("-");
}

function futureValue(
  days: number,
): string {
  const date =
    new Date();

  date.setDate(
    date.getDate() + days,
  );

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      "0",
    ),
    String(
      date.getDate(),
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

const riskLabels: Record<
  SafetyRiskLevel,
  string
> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const incidentTypes: SafetyIncidentType[] = [
  "NEAR_MISS",
  "FIRST_AID",
  "MEDICAL_TREATMENT",
  "LOST_TIME_INJURY",
  "PROPERTY_DAMAGE",
  "ENVIRONMENTAL",
  "OTHER",
];

const hazardCategories: HazardCategory[] = [
  "PPE",
  "HOUSEKEEPING",
  "WORK_AT_HEIGHT",
  "ELECTRICAL",
  "LIFTING",
  "EXCAVATION",
  "ACCESS_EGRESS",
  "TOOLS_EQUIPMENT",
  "FIRE",
  "ENVIRONMENTAL",
  "TRAFFIC",
  "OTHER",
];

const permitTypes: WorkPermitType[] = [
  "HOT_WORK",
  "WORK_AT_HEIGHT",
  "CONFINED_SPACE",
  "EXCAVATION",
  "ELECTRICAL_ISOLATION",
  "LIFTING",
  "GENERAL",
];

const incidentDefaults: CreateSafetyIncidentInput = {
  reference: "",
  incidentType: "NEAR_MISS",
  severity: "MEDIUM",
  title: "",
  description: "",
  location: "",
  occurredDate: todayValue(),
  reportedDate: todayValue(),
  peopleAffected: 0,
  lostTimeDays: 0,
  immediateAction: "",
};

const observationDefaults: CreateSafetyObservationInput = {
  reference: "",
  observationType: "UNSAFE_CONDITION",
  hazardCategory: "HOUSEKEEPING",
  severity: "MEDIUM",
  title: "",
  description: "",
  location: "",
  observedDate: todayValue(),
  observerName: "",
  ownerName: "",
  dueDate: futureValue(7),
};

const actionDefaults: CreateSafetyActionInput = {
  incidentId: null,
  observationId: null,
  reference: "",
  title: "",
  actionDescription: "",
  ownerName: "",
  dueDate: futureValue(7),
};

const permitDefaults: CreateWorkPermitInput = {
  reference: "",
  permitType: "GENERAL",
  title: "",
  location: "",
  issuerName: "",
  receiverName: "",
  validFrom: todayValue(),
  validUntil: futureValue(1),
  controls: "",
};

function incidentOptions(
  status: SafetyIncidentStatus,
): SafetyIncidentStatus[] {
  switch (status) {
    case "REPORTED":
      return [
        "REPORTED",
        "UNDER_INVESTIGATION",
        "ACTION_IN_PROGRESS",
        "VOID",
      ];

    case "UNDER_INVESTIGATION":
      return [
        "UNDER_INVESTIGATION",
        "ACTION_IN_PROGRESS",
        "CLOSED",
        "VOID",
      ];

    case "ACTION_IN_PROGRESS":
      return [
        "ACTION_IN_PROGRESS",
        "UNDER_INVESTIGATION",
        "CLOSED",
        "VOID",
      ];

    case "CLOSED":
      return ["CLOSED"];

    case "VOID":
      return ["VOID"];
  }
}

function observationOptions(
  status: SafetyObservationStatus,
): SafetyObservationStatus[] {
  switch (status) {
    case "OPEN":
      return [
        "OPEN",
        "ACTION_IN_PROGRESS",
        "CLOSED",
        "VOID",
      ];

    case "ACTION_IN_PROGRESS":
      return [
        "ACTION_IN_PROGRESS",
        "OPEN",
        "CLOSED",
        "VOID",
      ];

    case "CLOSED":
      return ["CLOSED"];

    case "VOID":
      return ["VOID"];
  }
}

function actionOptions(
  status: SafetyActionStatus,
): SafetyActionStatus[] {
  switch (status) {
    case "OPEN":
      return [
        "OPEN",
        "IN_PROGRESS",
        "VOID",
      ];

    case "IN_PROGRESS":
      return [
        "IN_PROGRESS",
        "OPEN",
        "READY_FOR_VERIFICATION",
        "VOID",
      ];

    case "READY_FOR_VERIFICATION":
      return [
        "READY_FOR_VERIFICATION",
        "IN_PROGRESS",
        "CLOSED",
      ];

    case "CLOSED":
      return ["CLOSED"];

    case "VOID":
      return ["VOID"];
  }
}

function permitOptions(
  status: WorkPermitStatus,
): WorkPermitStatus[] {
  switch (status) {
    case "DRAFT":
      return [
        "DRAFT",
        "ACTIVE",
        "CANCELLED",
      ];

    case "ACTIVE":
      return [
        "ACTIVE",
        "SUSPENDED",
        "CLOSED",
        "CANCELLED",
      ];

    case "SUSPENDED":
      return [
        "SUSPENDED",
        "ACTIVE",
        "CLOSED",
        "CANCELLED",
      ];

    case "CLOSED":
      return ["CLOSED"];

    case "CANCELLED":
      return ["CANCELLED"];
  }
}

export function ProjectSafetyControlView({
  projectId,
}: {
  projectId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<SafetyControl | null>(
      null,
    );

  const [
    panel,
    setPanel,
  ] =
    useState<PanelType>(
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
    incidentForm,
    setIncidentForm,
  ] =
    useState(
      incidentDefaults,
    );

  const [
    observationForm,
    setObservationForm,
  ] =
    useState(
      observationDefaults,
    );

  const [
    actionForm,
    setActionForm,
  ] =
    useState(
      actionDefaults,
    );

  const [
    permitForm,
    setPermitForm,
  ] =
    useState(
      permitDefaults,
    );

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectSafety(
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
                "BuildSight could not load HSE intelligence.",
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
      await getProjectSafety(
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
          "The local HSE operation failed.",
        );
      }

      return false;

    } finally {
      setBusy(false);
    }
  }

  async function submitIncident(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createSafetyIncident(
            projectId,
            incidentForm,
          ),
      )
    ) {
      setIncidentForm({
        ...incidentDefaults,
        occurredDate:
          todayValue(),
        reportedDate:
          todayValue(),
      });

      setPanel(null);
    }
  }

  async function submitObservation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createSafetyObservation(
            projectId,
            observationForm,
          ),
      )
    ) {
      setObservationForm({
        ...observationDefaults,
        observedDate:
          todayValue(),
        dueDate:
          futureValue(7),
      });

      setPanel(null);
    }
  }

  async function submitAction(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createSafetyAction(
            projectId,
            actionForm,
          ),
      )
    ) {
      setActionForm({
        ...actionDefaults,
        dueDate:
          futureValue(7),
      });

      setPanel(null);
    }
  }

  async function submitPermit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createWorkPermit(
            projectId,
            permitForm,
          ),
      )
    ) {
      setPermitForm({
        ...permitDefaults,
        validFrom:
          todayValue(),
        validUntil:
          futureValue(1),
      });

      setPanel(null);
    }
  }

  async function changeIncidentStatus(
    incident: SafetyIncident,
    status: SafetyIncidentStatus,
  ) {
    if (
      incident.status ===
      status
    ) {
      return;
    }

    let rootCause =
      incident.rootCause ??
      "";

    let investigationNotes =
      incident.investigationNotes ??
      "";

    if (
      status ===
      "CLOSED"
    ) {
      if (!rootCause) {
        rootCause =
          window.prompt(
            "Root cause",
            "",
          )?.trim() ??
          "";
      }

      if (!investigationNotes) {
        investigationNotes =
          window.prompt(
            "Investigation / closure notes",
            "",
          )?.trim() ??
          "";
      }

      if (
        !rootCause
        ||
        !investigationNotes
      ) {
        return;
      }
    }

    await runAction(
      () =>
        updateSafetyIncident(
          projectId,
          incident.id,
          {
            version:
              incident.version,
            incidentType:
              incident.incidentType,
            severity:
              incident.severity,
            title:
              incident.title,
            description:
              incident.description,
            location:
              incident.location ??
              "",
            peopleAffected:
              incident.peopleAffected,
            lostTimeDays:
              incident.lostTimeDays,
            immediateAction:
              incident.immediateAction ??
              "",
            rootCause,
            investigationNotes,
            status,
          },
        ),
    );
  }

  async function changeObservationStatus(
    observation: SafetyObservation,
    status: SafetyObservationStatus,
  ) {
    if (
      observation.status ===
      status
    ) {
      return;
    }

    await runAction(
      () =>
        updateSafetyObservation(
          projectId,
          observation.id,
          {
            version:
              observation.version,
            observationType:
              observation.observationType,
            hazardCategory:
              observation.hazardCategory,
            severity:
              observation.severity,
            title:
              observation.title,
            description:
              observation.description,
            location:
              observation.location ??
              "",
            ownerName:
              observation.ownerName ??
              "",
            dueDate:
              observation.dueDate,
            status,
          },
        ),
    );
  }

  async function changeActionStatus(
    action: SafetyAction,
    status: SafetyActionStatus,
  ) {
    if (
      action.status ===
      status
    ) {
      return;
    }

    let verification =
      action.verificationNotes ??
      "";

    if (
      status ===
        "CLOSED"
      &&
      !verification
    ) {
      verification =
        window.prompt(
          "Verification notes",
          "",
        )?.trim() ??
        "";

      if (!verification) {
        return;
      }
    }

    await runAction(
      () =>
        updateSafetyAction(
          projectId,
          action.id,
          {
            version:
              action.version,
            title:
              action.title,
            actionDescription:
              action.actionDescription,
            ownerName:
              action.ownerName ??
              "",
            dueDate:
              action.dueDate,
            status,
            verificationNotes:
              verification,
          },
        ),
    );
  }

  async function changePermitStatus(
    permit: WorkPermit,
    status: WorkPermitStatus,
  ) {
    if (
      permit.status ===
      status
    ) {
      return;
    }

    await runAction(
      () =>
        updateWorkPermit(
          projectId,
          permit.id,
          {
            version:
              permit.version,
            permitType:
              permit.permitType,
            title:
              permit.title,
            location:
              permit.location ??
              "",
            issuerName:
              permit.issuerName ??
              "",
            receiverName:
              permit.receiverName ??
              "",
            validFrom:
              permit.validFrom,
            validUntil:
              permit.validUntil,
            controls:
              permit.controls ??
              "",
            status,
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
          Loading HSE intelligence...
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
            HSE control unavailable
          </h1>

          <p>
            {error ||
              "BuildSight could not load safety data."}
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
    incidents,
    observations,
    actions,
    permits,
  } = data;

  return (
    <div className="safety-shell">
      <ProjectWorkspaceSidebar
        projectId={projectId}
        projectCode={project.code}
        className="safety-sidebar"
        localLinks={[
          { href: "#incidents", label: "Incidents" },
          { href: "#observations", label: "Observations" },
          { href: "#actions", label: "HSE actions" },
          { href: "#permits", label: "Work permits" },
        ]}
      />

      <main className="safety-main">
        <header className="safety-topbar">
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
              HSE INTELLIGENCE
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Incidents, observations,
              corrective actions,
              permits-to-work and safety
              control effectiveness.
            </p>
          </div>

          <div className="safety-header-score">
            <span>
              HSE HEALTH
            </span>

            <strong>
              {intelligence.safetyScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={`safety-risk safety-risk-${intelligence.safetyRisk
                .toLowerCase()
                .replaceAll(
                  "_",
                  "-",
                )}`}
            >
              {
                riskLabels[
                  intelligence.safetyRisk
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

        <section className="safety-kpi-grid">
          <Kpi
            label="OPEN INCIDENTS"
            value={String(
              intelligence.openIncidents,
            )}
            detail={`${intelligence.criticalOpenIncidents} critical`}
          />

          <Kpi
            label="HSE ACTIONS"
            value={String(
              intelligence.openActions,
            )}
            detail={`${intelligence.overdueActions} overdue`}
          />

          <Kpi
            label="ACTIVE PERMITS"
            value={String(
              intelligence.activePermits,
            )}
            detail={`${intelligence.expiredPermits} expired`}
          />

          <Kpi
            label="SAFETY SCORE"
            value={`${intelligence.safetyScore.toFixed(
              0,
            )}/100`}
            detail={`${intelligence.recurringHazardCategories} repeat hazard themes`}
            emphasis
          />
        </section>

        <section className="safety-intelligence-panel">
          <div className="safety-score-panel">
            <span>
              HSE SCORE
            </span>

            <strong>
              {intelligence.safetyScore.toFixed(
                0,
              )}
            </strong>

            <small>
              /100
            </small>
          </div>

          <div className="safety-intelligence-grid">
            <Metric
              label="Recordable incidents"
              value={String(
                intelligence.recordableIncidents,
              )}
            />

            <Metric
              label="Lost-time incidents"
              value={String(
                intelligence.lostTimeIncidents,
              )}
            />

            <Metric
              label="Unsafe observations"
              value={String(
                intelligence.unsafeObservations,
              )}
            />

            <Metric
              label="Positive observations"
              value={String(
                intelligence.positiveObservations,
              )}
            />

            <Metric
              label="Repeat hazard themes"
              value={String(
                intelligence.recurringHazardCategories,
              )}
            />

            <Metric
              label="Days since recordable"
              value={
                intelligence.daysSinceLastRecordableIncident ===
                null
                  ? "No recordable"
                  : String(
                      intelligence.daysSinceLastRecordableIncident,
                    )
              }
            />
          </div>

          <p>
            {intelligence.explanation}
          </p>
        </section>

        <section className="safety-actions-bar">
          <button
            type="button"
            onClick={() =>
              setPanel(
                "incident",
              )
            }
          >
            + Incident
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "observation",
              )
            }
          >
            + Observation
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "action",
              )
            }
          >
            + HSE action
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "permit",
              )
            }
          >
            + Work permit
          </button>
        </section>

        {panel ===
          "incident" && (
          <Panel
            title="Report safety incident"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="safety-form"
              onSubmit={
                submitIncident
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    incidentForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setIncidentForm({
                      ...incidentForm,
                      reference:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Incident type
                </span>

                <select
                  value={
                    incidentForm.incidentType
                  }
                  onChange={(
                    event,
                  ) =>
                    setIncidentForm({
                      ...incidentForm,
                      incidentType:
                        event.target.value as SafetyIncidentType,
                    })
                  }
                >
                  {incidentTypes.map(
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
              </label>

              <label>
                <span>
                  Severity
                </span>

                <SeveritySelect
                  value={
                    incidentForm.severity
                  }
                  onChange={(
                    severity,
                  ) =>
                    setIncidentForm({
                      ...incidentForm,
                      severity,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Location
                </span>

                <input
                  value={
                    incidentForm.location
                  }
                  onChange={(
                    event,
                  ) =>
                    setIncidentForm({
                      ...incidentForm,
                      location:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Title
                </span>

                <input
                  required
                  value={
                    incidentForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setIncidentForm({
                      ...incidentForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Occurred
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    incidentForm.occurredDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setIncidentForm({
                      ...incidentForm,
                      occurredDate:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Reported
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    incidentForm.reportedDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setIncidentForm({
                      ...incidentForm,
                      reportedDate:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  People affected
                </span>

                <input
                  min={0}
                  type="number"
                  value={
                    incidentForm.peopleAffected
                  }
                  onChange={(
                    event,
                  ) =>
                    setIncidentForm({
                      ...incidentForm,
                      peopleAffected:
                        Number(
                          event.target.value,
                        ),
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Lost-time days
                </span>

                <input
                  min={0}
                  type="number"
                  value={
                    incidentForm.lostTimeDays
                  }
                  onChange={(
                    event,
                  ) =>
                    setIncidentForm({
                      ...incidentForm,
                      lostTimeDays:
                        Number(
                          event.target.value,
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
                  required
                  rows={4}
                  value={
                    incidentForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setIncidentForm({
                      ...incidentForm,
                      description:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Immediate action
                </span>

                <textarea
                  rows={3}
                  value={
                    incidentForm.immediateAction
                  }
                  onChange={(
                    event,
                  ) =>
                    setIncidentForm({
                      ...incidentForm,
                      immediateAction:
                        event.target.value,
                    })
                  }
                />
              </label>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setPanel(null)
                }
              />
            </form>
          </Panel>
        )}

        {panel ===
          "observation" && (
          <Panel
            title="Record safety observation"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="safety-form"
              onSubmit={
                submitObservation
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    observationForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setObservationForm({
                      ...observationForm,
                      reference:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Observation type
                </span>

                <select
                  value={
                    observationForm.observationType
                  }
                  onChange={(
                    event,
                  ) => {
                    const type =
                      event.target.value as SafetyObservationType;

                    const positive =
                      type ===
                        "SAFE_ACT"
                      ||
                      type ===
                        "GOOD_PRACTICE";

                    setObservationForm({
                      ...observationForm,
                      observationType:
                        type,
                      dueDate:
                        positive
                          ? null
                          : observationForm.dueDate ??
                            futureValue(
                              7,
                            ),
                    });
                  }}
                >
                  <option value="SAFE_ACT">
                    Safe act
                  </option>

                  <option value="UNSAFE_ACT">
                    Unsafe act
                  </option>

                  <option value="UNSAFE_CONDITION">
                    Unsafe condition
                  </option>

                  <option value="GOOD_PRACTICE">
                    Good practice
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Hazard category
                </span>

                <select
                  value={
                    observationForm.hazardCategory
                  }
                  onChange={(
                    event,
                  ) =>
                    setObservationForm({
                      ...observationForm,
                      hazardCategory:
                        event.target.value as HazardCategory,
                    })
                  }
                >
                  {hazardCategories.map(
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
                        {category.replaceAll(
                          "_",
                          " ",
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Severity
                </span>

                <SeveritySelect
                  value={
                    observationForm.severity
                  }
                  onChange={(
                    severity,
                  ) =>
                    setObservationForm({
                      ...observationForm,
                      severity,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Title
                </span>

                <input
                  required
                  value={
                    observationForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setObservationForm({
                      ...observationForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Observed date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    observationForm.observedDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setObservationForm({
                      ...observationForm,
                      observedDate:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Target date
                </span>

                <input
                  type="date"
                  disabled={
                    observationForm.observationType ===
                      "SAFE_ACT"
                    ||
                    observationForm.observationType ===
                      "GOOD_PRACTICE"
                  }
                  value={
                    observationForm.dueDate ??
                    ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setObservationForm({
                      ...observationForm,
                      dueDate:
                        event.target.value ||
                        null,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Observer
                </span>

                <input
                  value={
                    observationForm.observerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setObservationForm({
                      ...observationForm,
                      observerName:
                        event.target.value,
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
                    observationForm.ownerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setObservationForm({
                      ...observationForm,
                      ownerName:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Location
                </span>

                <input
                  value={
                    observationForm.location
                  }
                  onChange={(
                    event,
                  ) =>
                    setObservationForm({
                      ...observationForm,
                      location:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Description
                </span>

                <textarea
                  required
                  rows={4}
                  value={
                    observationForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setObservationForm({
                      ...observationForm,
                      description:
                        event.target.value,
                    })
                  }
                />
              </label>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setPanel(null)
                }
              />
            </form>
          </Panel>
        )}

        {panel ===
          "action" && (
          <Panel
            title="Create HSE corrective action"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="safety-form"
              onSubmit={
                submitAction
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    actionForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
                      reference:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Incident source
                </span>

                <select
                  value={
                    actionForm.incidentId ??
                    ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
                      incidentId:
                        event.target.value ||
                        null,
                      observationId:
                        event.target.value
                          ? null
                          : actionForm.observationId,
                    })
                  }
                >
                  <option value="">
                    None
                  </option>

                  {incidents.map(
                    (
                      incident,
                    ) => (
                      <option
                        key={
                          incident.id
                        }
                        value={
                          incident.id
                        }
                      >
                        {
                          incident.reference
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Observation source
                </span>

                <select
                  value={
                    actionForm.observationId ??
                    ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
                      observationId:
                        event.target.value ||
                        null,
                      incidentId:
                        event.target.value
                          ? null
                          : actionForm.incidentId,
                    })
                  }
                >
                  <option value="">
                    None
                  </option>

                  {observations.map(
                    (
                      observation,
                    ) => (
                      <option
                        key={
                          observation.id
                        }
                        value={
                          observation.id
                        }
                      >
                        {
                          observation.reference
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
              </label>

              <label className="field-full">
                <span>
                  Title
                </span>

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
              </label>

              <label>
                <span>
                  Due date
                </span>

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
              </label>

              <label className="field-full">
                <span>
                  Corrective action
                </span>

                <textarea
                  required
                  rows={4}
                  value={
                    actionForm.actionDescription
                  }
                  onChange={(
                    event,
                  ) =>
                    setActionForm({
                      ...actionForm,
                      actionDescription:
                        event.target.value,
                    })
                  }
                />
              </label>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setPanel(null)
                }
              />
            </form>
          </Panel>
        )}

        {panel ===
          "permit" && (
          <Panel
            title="Create permit-to-work"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="safety-form"
              onSubmit={
                submitPermit
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    permitForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setPermitForm({
                      ...permitForm,
                      reference:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Permit type
                </span>

                <select
                  value={
                    permitForm.permitType
                  }
                  onChange={(
                    event,
                  ) =>
                    setPermitForm({
                      ...permitForm,
                      permitType:
                        event.target.value as WorkPermitType,
                    })
                  }
                >
                  {permitTypes.map(
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
              </label>

              <label className="field-full">
                <span>
                  Title
                </span>

                <input
                  required
                  value={
                    permitForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setPermitForm({
                      ...permitForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Location
                </span>

                <input
                  value={
                    permitForm.location
                  }
                  onChange={(
                    event,
                  ) =>
                    setPermitForm({
                      ...permitForm,
                      location:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Issuer
                </span>

                <input
                  value={
                    permitForm.issuerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setPermitForm({
                      ...permitForm,
                      issuerName:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Receiver
                </span>

                <input
                  value={
                    permitForm.receiverName
                  }
                  onChange={(
                    event,
                  ) =>
                    setPermitForm({
                      ...permitForm,
                      receiverName:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Valid from
                </span>

                <input
                  required
                  type="date"
                  value={
                    permitForm.validFrom
                  }
                  onChange={(
                    event,
                  ) =>
                    setPermitForm({
                      ...permitForm,
                      validFrom:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Valid until
                </span>

                <input
                  required
                  type="date"
                  value={
                    permitForm.validUntil
                  }
                  onChange={(
                    event,
                  ) =>
                    setPermitForm({
                      ...permitForm,
                      validUntil:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Permit controls
                </span>

                <textarea
                  rows={4}
                  value={
                    permitForm.controls
                  }
                  onChange={(
                    event,
                  ) =>
                    setPermitForm({
                      ...permitForm,
                      controls:
                        event.target.value,
                    })
                  }
                />
              </label>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setPanel(null)
                }
              />
            </form>
          </Panel>
        )}

        <section
          className="safety-card"
          id="incidents"
        >
          <CardHeader
            eyebrow="LAGGING INDICATORS"
            title="Incident register"
            value={`${incidents.length} incidents`}
          />

          <div className="safety-table-wrapper">
            <table className="safety-table">
              <thead>
                <tr>
                  <th>INCIDENT</th>
                  <th>TYPE</th>
                  <th>SEVERITY</th>
                  <th>OCCURRED</th>
                  <th>PEOPLE</th>
                  <th>LOST DAYS</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {incidents.map(
                  (
                    incident,
                  ) => (
                    <tr
                      key={
                        incident.id
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            incident.reference
                          }
                          title={
                            incident.title
                          }
                        />
                      </td>

                      <td>
                        {incident.incidentType.replaceAll(
                          "_",
                          " ",
                        )}
                      </td>

                      <td>
                        <Severity
                          value={
                            incident.severity
                          }
                        />
                      </td>

                      <td>
                        {formatDate(
                          incident.occurredDate,
                        )}
                      </td>

                      <td>
                        {
                          incident.peopleAffected
                        }
                      </td>

                      <td>
                        {
                          incident.lostTimeDays
                        }
                      </td>

                      <td>
                        <select
                          className="safety-select"
                          disabled={
                            busy
                          }
                          value={
                            incident.status
                          }
                          onChange={(
                            event,
                          ) =>
                            void changeIncidentStatus(
                              incident,
                              event.target.value as SafetyIncidentStatus,
                            )
                          }
                        >
                          {incidentOptions(
                            incident.status,
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
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="safety-card"
          id="observations"
        >
          <CardHeader
            eyebrow="LEADING INDICATORS"
            title="Safety observations"
            value={`${observations.length} observations`}
          />

          <div className="safety-table-wrapper">
            <table className="safety-table">
              <thead>
                <tr>
                  <th>OBSERVATION</th>
                  <th>TYPE</th>
                  <th>HAZARD</th>
                  <th>SEVERITY</th>
                  <th>OWNER</th>
                  <th>DUE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {observations.map(
                  (
                    observation,
                  ) => (
                    <tr
                      key={
                        observation.id
                      }
                      className={
                        observation.overdue
                          ? "safety-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            observation.reference
                          }
                          title={
                            observation.title
                          }
                        />
                      </td>

                      <td>
                        {observation.observationType.replaceAll(
                          "_",
                          " ",
                        )}
                      </td>

                      <td>
                        {observation.hazardCategory.replaceAll(
                          "_",
                          " ",
                        )}
                      </td>

                      <td>
                        <Severity
                          value={
                            observation.severity
                          }
                        />
                      </td>

                      <td>
                        {observation.ownerName ??
                          "—"}
                      </td>

                      <td
                        className={
                          observation.overdue
                            ? "safety-overdue"
                            : ""
                        }
                      >
                        {formatDate(
                          observation.dueDate,
                        )}
                      </td>

                      <td>
                        <select
                          className="safety-select"
                          disabled={
                            busy
                          }
                          value={
                            observation.status
                          }
                          onChange={(
                            event,
                          ) =>
                            void changeObservationStatus(
                              observation,
                              event.target.value as SafetyObservationStatus,
                            )
                          }
                        >
                          {observationOptions(
                            observation.status,
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
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="safety-card"
          id="actions"
        >
          <CardHeader
            eyebrow="CORRECTIVE CONTROL"
            title="HSE action register"
            value={`${intelligence.openActions} open`}
          />

          <div className="safety-table-wrapper">
            <table className="safety-table">
              <thead>
                <tr>
                  <th>ACTION</th>
                  <th>SOURCE</th>
                  <th>OWNER</th>
                  <th>DUE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {actions.map(
                  (
                    action,
                  ) => (
                    <tr
                      key={
                        action.id
                      }
                      className={
                        action.overdue
                          ? "safety-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            action.reference
                          }
                          title={
                            action.title
                          }
                        />
                      </td>

                      <td>
                        {action.incidentReference ??
                          action.observationReference ??
                          "General HSE"}
                      </td>

                      <td>
                        {action.ownerName ??
                          "—"}
                      </td>

                      <td
                        className={
                          action.overdue
                            ? "safety-overdue"
                            : ""
                        }
                      >
                        {formatDate(
                          action.dueDate,
                        )}
                      </td>

                      <td>
                        <select
                          className="safety-select"
                          disabled={
                            busy
                          }
                          value={
                            action.status
                          }
                          onChange={(
                            event,
                          ) =>
                            void changeActionStatus(
                              action,
                              event.target.value as SafetyActionStatus,
                            )
                          }
                        >
                          {actionOptions(
                            action.status,
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

                {actions.length ===
                  0 && (
                  <tr>
                    <td colSpan={5}>
                      <div className="table-message">
                        No HSE actions recorded.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="safety-card"
          id="permits"
        >
          <CardHeader
            eyebrow="PERMIT-TO-WORK CONTROL"
            title="Work permits"
            value={`${intelligence.activePermits} active`}
          />

          <div className="safety-table-wrapper">
            <table className="safety-table">
              <thead>
                <tr>
                  <th>PERMIT</th>
                  <th>TYPE</th>
                  <th>LOCATION</th>
                  <th>VALID FROM</th>
                  <th>VALID UNTIL</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {permits.map(
                  (
                    permit,
                  ) => (
                    <tr
                      key={
                        permit.id
                      }
                      className={
                        permit.expired
                          ? "safety-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            permit.reference
                          }
                          title={
                            permit.title
                          }
                        />
                      </td>

                      <td>
                        {permit.permitType.replaceAll(
                          "_",
                          " ",
                        )}
                      </td>

                      <td>
                        {permit.location ??
                          "—"}
                      </td>

                      <td>
                        {formatDate(
                          permit.validFrom,
                        )}
                      </td>

                      <td
                        className={
                          permit.expired
                            ? "safety-overdue"
                            : ""
                        }
                      >
                        {formatDate(
                          permit.validUntil,
                        )}
                      </td>

                      <td>
                        <select
                          className="safety-select"
                          disabled={
                            busy
                          }
                          value={
                            permit.status
                          }
                          onChange={(
                            event,
                          ) =>
                            void changePermitStatus(
                              permit,
                              event.target.value as WorkPermitStatus,
                            )
                          }
                        >
                          {permitOptions(
                            permit.status,
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
              </tbody>
            </table>
          </div>
        </section>

        <footer className="command-footer">
          <div>
            BuildSight · HSE Intelligence
          </div>

          <div>
            {incidents.length} incidents
            {" · "}
            {observations.length} observations
            {" · "}
            {actions.length} actions
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
          ? "safety-kpi safety-kpi-emphasis"
          : "safety-kpi"
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
    <div className="safety-intelligence-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function Severity({
  value,
}: {
  value: SafetySeverity;
}) {
  return (
    <span
      className={`safety-severity safety-severity-${value.toLowerCase()}`}
    >
      {value}
    </span>
  );
}

function SeveritySelect({
  value,
  onChange,
}: {
  value: SafetySeverity;
  onChange: (
    value: SafetySeverity,
  ) => void;
}) {
  return (
    <select
      value={
        value
      }
      onChange={(
        event,
      ) =>
        onChange(
          event.target.value as SafetySeverity,
        )
      }
    >
      <option value="LOW">
        Low
      </option>
      <option value="MEDIUM">
        Medium
      </option>
      <option value="HIGH">
        High
      </option>
      <option value="CRITICAL">
        Critical
      </option>
    </select>
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
    <div className="safety-card-header">
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

function NameCell({
  code,
  title,
}: {
  code: string;
  title: string;
}) {
  return (
    <div className="safety-name-cell">
      <strong>
        {code}
      </strong>

      <span>
        {title}
      </span>
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
    <section className="safety-form-panel">
      <div className="safety-card-header">
        <div>
          <div className="eyebrow">
            HSE CONTROL INPUT
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
