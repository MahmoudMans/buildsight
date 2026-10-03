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
  createHandoverItem,
  createProjectNcr,
  createPunchItem,
  createQualityInspection,
  getProjectQuality,
  updateHandoverItem,
  updateProjectNcr,
  updatePunchItem,
  updateQualityInspection,
} from "@/lib/api";

import type {
  CreateHandoverItemInput,
  CreateNcrInput,
  CreatePunchItemInput,
  CreateQualityInspectionInput,
  HandoverCategory,
  HandoverItem,
  HandoverStatus,
  NcrCategory,
  NcrSeverity,
  NcrStatus,
  ProjectNcr,
  PunchItem,
  PunchPriority,
  PunchStatus,
  QualityControl,
  QualityDiscipline,
  QualityInspection,
  QualityInspectionResult,
  QualityInspectionStatus,
  QualityInspectionType,
  QualityRiskLevel,
} from "@/types/project";

type Panel =
  | "inspection"
  | "ncr"
  | "punch"
  | "handover"
  | null;

const riskLabels: Record<
  QualityRiskLevel,
  string
> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const inspectionTypeLabels: Record<
  QualityInspectionType,
  string
> = {
  INTERNAL: "Internal",
  CLIENT: "Client",
  CONSULTANT: "Consultant",
  REGULATORY: "Regulatory",
  TEST: "Test",
};

const disciplineLabels: Record<
  QualityDiscipline,
  string
> = {
  CIVIL: "Civil",
  STRUCTURAL: "Structural",
  ARCHITECTURAL: "Architectural",
  MEP: "MEP",
  HSE: "HSE",
  QUALITY: "Quality",
  GENERAL: "General",
};

const handoverLabels: Record<
  HandoverCategory,
  string
> = {
  OM_MANUAL: "O&M manual",
  AS_BUILT: "As-built",
  CERTIFICATE: "Certificate",
  WARRANTY: "Warranty",
  TEST_RECORD: "Test record",
  TRAINING: "Training",
  OTHER: "Other",
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

function futureValue(
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

function riskClass(
  risk: QualityRiskLevel,
): string {
  return `quality-risk quality-risk-${risk
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function inspectionStatusOptions(
  status: QualityInspectionStatus,
): QualityInspectionStatus[] {
  switch (status) {
    case "PLANNED":
      return [
        "PLANNED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ];

    case "IN_PROGRESS":
      return [
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ];

    case "COMPLETED":
      return [
        "COMPLETED",
      ];

    case "CANCELLED":
      return [
        "CANCELLED",
      ];
  }
}

function ncrStatusOptions(
  status: NcrStatus,
): NcrStatus[] {
  switch (status) {
    case "OPEN":
      return [
        "OPEN",
        "CORRECTIVE_ACTION_IN_PROGRESS",
        "VOID",
      ];

    case "CORRECTIVE_ACTION_IN_PROGRESS":
      return [
        "CORRECTIVE_ACTION_IN_PROGRESS",
        "OPEN",
        "READY_FOR_VERIFICATION",
        "VOID",
      ];

    case "READY_FOR_VERIFICATION":
      return [
        "READY_FOR_VERIFICATION",
        "CORRECTIVE_ACTION_IN_PROGRESS",
        "CLOSED",
      ];

    case "CLOSED":
      return ["CLOSED"];

    case "VOID":
      return ["VOID"];
  }
}

function punchStatusOptions(
  status: PunchStatus,
): PunchStatus[] {
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
        "READY_FOR_INSPECTION",
        "VOID",
      ];

    case "READY_FOR_INSPECTION":
      return [
        "READY_FOR_INSPECTION",
        "IN_PROGRESS",
        "CLOSED",
      ];

    case "CLOSED":
      return ["CLOSED"];

    case "VOID":
      return ["VOID"];
  }
}

function handoverStatusOptions(
  status: HandoverStatus,
): HandoverStatus[] {
  switch (status) {
    case "NOT_STARTED":
      return [
        "NOT_STARTED",
        "SUBMITTED",
        "NOT_REQUIRED",
      ];

    case "SUBMITTED":
      return [
        "SUBMITTED",
        "APPROVED",
        "REJECTED",
      ];

    case "REJECTED":
      return [
        "REJECTED",
        "SUBMITTED",
        "NOT_REQUIRED",
      ];

    case "APPROVED":
      return ["APPROVED"];

    case "NOT_REQUIRED":
      return ["NOT_REQUIRED"];
  }
}

const inspectionDefaults: CreateQualityInspectionInput = {
  reference: "",
  title: "",
  inspectionType: "INTERNAL",
  discipline: "QUALITY",
  plannedDate: todayValue(),
  inspectorName: "",
  notes: "",
};

const ncrDefaults: CreateNcrInput = {
  inspectionId: null,
  reference: "",
  title: "",
  description: "",
  category: "WORKMANSHIP",
  severity: "MAJOR",
  raisedDate: todayValue(),
  dueDate: futureValue(7),
  ownerName: "",
};

const punchDefaults: CreatePunchItemInput = {
  reference: "",
  title: "",
  description: "",
  location: "",
  trade: "",
  priority: "MEDIUM",
  raisedDate: todayValue(),
  dueDate: futureValue(7),
  ownerName: "",
};

const handoverDefaults: CreateHandoverItemInput = {
  code: "",
  title: "",
  category: "OM_MANUAL",
  ownerName: "",
  dueDate: futureValue(30),
  notes: "",
};

export function ProjectQualityControlView({
  projectId,
}: {
  projectId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<QualityControl | null>(
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
    panel,
    setPanel,
  ] =
    useState<Panel>(null);

  const [
    inspectionForm,
    setInspectionForm,
  ] =
    useState<CreateQualityInspectionInput>(
      inspectionDefaults,
    );

  const [
    ncrForm,
    setNcrForm,
  ] =
    useState<CreateNcrInput>(
      ncrDefaults,
    );

  const [
    punchForm,
    setPunchForm,
  ] =
    useState<CreatePunchItemInput>(
      punchDefaults,
    );

  const [
    handoverForm,
    setHandoverForm,
  ] =
    useState<CreateHandoverItemInput>(
      handoverDefaults,
    );

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectQuality(
        projectId,
      )
        .then(
          (
            response,
          ) => {
            if (cancelled) {
              return;
            }

            setData(response);
            setError("");
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
                "BuildSight could not load quality-control data.",
              );
            }
          },
        )
        .finally(
          () => {
            if (!cancelled) {
              setLoading(false);
            }
          },
        );

      return () => {
        cancelled = true;
      };
    },
    [projectId],
  );

  async function refresh() {
    setData(
      await getProjectQuality(
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
          "The local quality-control operation failed.",
        );
      }

      return false;

    } finally {
      setBusy(false);
    }
  }

  async function submitInspection(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createQualityInspection(
            projectId,
            inspectionForm,
          ),
      );

    if (ok) {
      setInspectionForm({
        ...inspectionDefaults,
        plannedDate:
          todayValue(),
      });

      setPanel(null);
    }
  }

  async function submitNcr(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createProjectNcr(
            projectId,
            ncrForm,
          ),
      );

    if (ok) {
      setNcrForm({
        ...ncrDefaults,
        raisedDate:
          todayValue(),
        dueDate:
          futureValue(7),
      });

      setPanel(null);
    }
  }

  async function submitPunch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createPunchItem(
            projectId,
            punchForm,
          ),
      );

    if (ok) {
      setPunchForm({
        ...punchDefaults,
        raisedDate:
          todayValue(),
        dueDate:
          futureValue(7),
      });

      setPanel(null);
    }
  }

  async function submitHandover(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createHandoverItem(
            projectId,
            handoverForm,
          ),
      );

    if (ok) {
      setHandoverForm({
        ...handoverDefaults,
        dueDate:
          futureValue(30),
      });

      setPanel(null);
    }
  }

  async function changeInspectionResult(
    inspection: QualityInspection,
    result: QualityInspectionResult,
  ) {
    await runAction(
      () =>
        updateQualityInspection(
          projectId,
          inspection.id,
          {
            version:
              inspection.version,
            title:
              inspection.title,
            inspectionType:
              inspection.inspectionType,
            discipline:
              inspection.discipline,
            plannedDate:
              inspection.plannedDate,
            actualDate:
              inspection.actualDate,
            inspectorName:
              inspection.inspectorName ??
              "",
            status:
              inspection.status,
            result,
            notes:
              inspection.notes ??
              "",
          },
        ),
    );
  }

  async function changeInspectionStatus(
    inspection: QualityInspection,
    status: QualityInspectionStatus,
  ) {
    if (
      status ===
      inspection.status
    ) {
      return;
    }

    await runAction(
      () =>
        updateQualityInspection(
          projectId,
          inspection.id,
          {
            version:
              inspection.version,
            title:
              inspection.title,
            inspectionType:
              inspection.inspectionType,
            discipline:
              inspection.discipline,
            plannedDate:
              inspection.plannedDate,
            actualDate:
              inspection.actualDate,
            inspectorName:
              inspection.inspectorName ??
              "",
            status,
            result:
              status ===
              "CANCELLED"
                ? "NOT_ASSESSED"
                : inspection.result,
            notes:
              inspection.notes ??
              "",
          },
        ),
    );
  }

  async function changeNcrStatus(
    ncr: ProjectNcr,
    status: NcrStatus,
  ) {
    if (
      status ===
      ncr.status
    ) {
      return;
    }

    let rootCause =
      ncr.rootCause ?? "";

    let correctiveAction =
      ncr.correctiveAction ?? "";

    let verificationNotes =
      ncr.verificationNotes ?? "";

    if (
      status ===
        "READY_FOR_VERIFICATION"
      ||
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

      if (!correctiveAction) {
        correctiveAction =
          window.prompt(
            "Corrective action",
            "",
          )?.trim() ??
          "";
      }

      if (
        !rootCause
        ||
        !correctiveAction
      ) {
        return;
      }
    }

    if (
      status ===
      "CLOSED"
    ) {
      if (!verificationNotes) {
        verificationNotes =
          window.prompt(
            "Verification notes",
            "",
          )?.trim() ??
          "";
      }

      if (!verificationNotes) {
        return;
      }
    }

    await runAction(
      () =>
        updateProjectNcr(
          projectId,
          ncr.id,
          {
            version:
              ncr.version,
            inspectionId:
              ncr.inspectionId,
            title:
              ncr.title,
            description:
              ncr.description,
            category:
              ncr.category,
            severity:
              ncr.severity,
            dueDate:
              ncr.dueDate,
            ownerName:
              ncr.ownerName ??
              "",
            rootCause,
            correctiveAction,
            verificationNotes,
            status,
          },
        ),
    );
  }

  async function changePunchStatus(
    item: PunchItem,
    status: PunchStatus,
  ) {
    if (
      status ===
      item.status
    ) {
      return;
    }

    await runAction(
      () =>
        updatePunchItem(
          projectId,
          item.id,
          {
            version:
              item.version,
            title:
              item.title,
            description:
              item.description ??
              "",
            location:
              item.location ??
              "",
            trade:
              item.trade ??
              "",
            priority:
              item.priority,
            dueDate:
              item.dueDate,
            ownerName:
              item.ownerName ??
              "",
            status,
          },
        ),
    );
  }

  async function changeHandoverStatus(
    item: HandoverItem,
    status: HandoverStatus,
  ) {
    if (
      status ===
      item.status
    ) {
      return;
    }

    await runAction(
      () =>
        updateHandoverItem(
          projectId,
          item.id,
          {
            version:
              item.version,
            title:
              item.title,
            category:
              item.category,
            ownerName:
              item.ownerName ??
              "",
            dueDate:
              item.dueDate,
            status,
            notes:
              item.notes ??
              "",
          },
        ),
    );
  }

  if (loading) {
    return (
      <ProjectWorkspaceLoading
        label={"Loading quality intelligence..."}
        mainClassName={"quality-main"}
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
            Quality control unavailable
          </h1>

          <p>
            {error ||
              "BuildSight could not load quality data."}
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
    inspections,
    ncrs,
    punchItems,
    handoverItems,
  } = data;

  return (
    <div className="quality-shell">
      <ProjectWorkspaceSidebar
        projectId={projectId}
        projectCode={project.code}
        className="quality-sidebar"
        localLinks={[
          { href: "#inspections", label: "Inspections" },
          { href: "#ncrs", label: "NCRs" },
          { href: "#punch", label: "Punch list" },
          { href: "#handover", label: "Handover" },
        ]}
      />

      <main className="quality-main">
        <header className="quality-topbar">
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
              QUALITY INTELLIGENCE
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Inspection outcomes,
              non-conformances, corrective
              actions, punch-list close-out
              and handover readiness.
            </p>
          </div>

          <div className="quality-header-score">
            <span>
              QUALITY HEALTH
            </span>

            <strong>
              {intelligence.qualityScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={
                riskClass(
                  intelligence.qualityRisk,
                )
              }
            >
              {
                riskLabels[
                  intelligence.qualityRisk
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

        <section className="quality-kpi-grid">
          <QualityKpi
            label="INSPECTION PASS RATE"
            value={`${intelligence.inspectionPassRatePercentage.toFixed(
              1,
            )}%`}
            detail={`${intelligence.completedInspections} completed`}
          />

          <QualityKpi
            label="OPEN NCRs"
            value={String(
              intelligence.openNcrs,
            )}
            detail={`${intelligence.overdueNcrs} overdue`}
          />

          <QualityKpi
            label="PUNCH ITEMS"
            value={String(
              intelligence.openPunchItems,
            )}
            detail={`${intelligence.overduePunchItems} overdue`}
          />

          <QualityKpi
            label="HANDOVER READINESS"
            value={`${intelligence.handoverReadinessPercentage.toFixed(
              1,
            )}%`}
            detail={`${intelligence.approvedHandoverItems}/${intelligence.requiredHandoverItems} approved`}
            emphasis
          />
        </section>

        <section className="quality-intelligence-panel">
          <div className="quality-score-panel">
            <span>
              QUALITY SCORE
            </span>

            <strong>
              {intelligence.qualityScore.toFixed(
                0,
              )}
            </strong>

            <small>
              /100
            </small>

            <i
              className={
                riskClass(
                  intelligence.qualityRisk,
                )
              }
            >
              {
                riskLabels[
                  intelligence.qualityRisk
                ]
              }
            </i>
          </div>

          <div className="quality-intelligence-grid">
            <Metric
              label="Failed inspections"
              value={String(
                intelligence.failedInspections,
              )}
            />

            <Metric
              label="Critical open NCRs"
              value={String(
                intelligence.criticalOpenNcrs,
              )}
            />

            <Metric
              label="Recurring defect groups"
              value={String(
                intelligence.recurringDefectCategories,
              )}
            />

            <Metric
              label="Overdue NCRs"
              value={String(
                intelligence.overdueNcrs,
              )}
            />

            <Metric
              label="Overdue punch items"
              value={String(
                intelligence.overduePunchItems,
              )}
            />

            <Metric
              label="Overdue handover"
              value={String(
                intelligence.overdueHandoverItems,
              )}
            />
          </div>

          <p>
            {intelligence.explanation}
          </p>
        </section>

        <section className="quality-actions">
          <button
            type="button"
            onClick={() =>
              setPanel(
                "inspection",
              )
            }
          >
            + Inspection
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "ncr",
              )
            }
          >
            + NCR
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "punch",
              )
            }
          >
            + Punch item
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel(
                "handover",
              )
            }
          >
            + Handover item
          </button>
        </section>

        {panel ===
          "inspection" && (
          <QualityPanel
            title="Create inspection"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="quality-form"
              onSubmit={
                submitInspection
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    inspectionForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setInspectionForm({
                      ...inspectionForm,
                      reference:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Type
                </span>

                <select
                  value={
                    inspectionForm.inspectionType
                  }
                  onChange={(
                    event,
                  ) =>
                    setInspectionForm({
                      ...inspectionForm,
                      inspectionType:
                        event.target.value as QualityInspectionType,
                    })
                  }
                >
                  {(
                    Object.keys(
                      inspectionTypeLabels,
                    ) as QualityInspectionType[]
                  ).map(
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
                        {
                          inspectionTypeLabels[
                            type
                          ]
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="field-wide">
                <span>
                  Title
                </span>

                <input
                  required
                  value={
                    inspectionForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setInspectionForm({
                      ...inspectionForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Discipline
                </span>

                <select
                  value={
                    inspectionForm.discipline
                  }
                  onChange={(
                    event,
                  ) =>
                    setInspectionForm({
                      ...inspectionForm,
                      discipline:
                        event.target.value as QualityDiscipline,
                    })
                  }
                >
                  {(
                    Object.keys(
                      disciplineLabels,
                    ) as QualityDiscipline[]
                  ).map(
                    (
                      discipline,
                    ) => (
                      <option
                        key={
                          discipline
                        }
                        value={
                          discipline
                        }
                      >
                        {
                          disciplineLabels[
                            discipline
                          ]
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Planned date
                </span>

                <input
                  required
                  type="date"
                  value={
                    inspectionForm.plannedDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setInspectionForm({
                      ...inspectionForm,
                      plannedDate:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Inspector
                </span>

                <input
                  value={
                    inspectionForm.inspectorName
                  }
                  onChange={(
                    event,
                  ) =>
                    setInspectionForm({
                      ...inspectionForm,
                      inspectorName:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Notes
                </span>

                <textarea
                  rows={4}
                  value={
                    inspectionForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setInspectionForm({
                      ...inspectionForm,
                      notes:
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
          </QualityPanel>
        )}

        {panel === "ncr" && (
          <QualityPanel
            title="Raise non-conformance"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="quality-form"
              onSubmit={
                submitNcr
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    ncrForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setNcrForm({
                      ...ncrForm,
                      reference:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Inspection
                </span>

                <select
                  value={
                    ncrForm.inspectionId ??
                    ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setNcrForm({
                      ...ncrForm,
                      inspectionId:
                        event.target.value ||
                        null,
                    })
                  }
                >
                  <option value="">
                    Not linked
                  </option>

                  {inspections.map(
                    (
                      inspection,
                    ) => (
                      <option
                        key={
                          inspection.id
                        }
                        value={
                          inspection.id
                        }
                      >
                        {
                          inspection.reference
                        }
                        {" — "}
                        {
                          inspection.title
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="field-wide">
                <span>
                  NCR title
                </span>

                <input
                  required
                  value={
                    ncrForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setNcrForm({
                      ...ncrForm,
                      title:
                        event.target.value,
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
                    ncrForm.category
                  }
                  onChange={(
                    event,
                  ) =>
                    setNcrForm({
                      ...ncrForm,
                      category:
                        event.target.value as NcrCategory,
                    })
                  }
                >
                  {[
                    "WORKMANSHIP",
                    "MATERIAL",
                    "DESIGN",
                    "INSTALLATION",
                    "DOCUMENTATION",
                    "TEST_FAILURE",
                    "OTHER",
                  ].map(
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

                <select
                  value={
                    ncrForm.severity
                  }
                  onChange={(
                    event,
                  ) =>
                    setNcrForm({
                      ...ncrForm,
                      severity:
                        event.target.value as NcrSeverity,
                    })
                  }
                >
                  <option value="MINOR">
                    Minor
                  </option>
                  <option value="MAJOR">
                    Major
                  </option>
                  <option value="CRITICAL">
                    Critical
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Raised date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    ncrForm.raisedDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setNcrForm({
                      ...ncrForm,
                      raisedDate:
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
                    ncrForm.dueDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setNcrForm({
                      ...ncrForm,
                      dueDate:
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
                    ncrForm.ownerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setNcrForm({
                      ...ncrForm,
                      ownerName:
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
                  rows={5}
                  value={
                    ncrForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setNcrForm({
                      ...ncrForm,
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
          </QualityPanel>
        )}

        {panel === "punch" && (
          <QualityPanel
            title="Create punch item"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="quality-form"
              onSubmit={
                submitPunch
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    punchForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setPunchForm({
                      ...punchForm,
                      reference:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Priority
                </span>

                <select
                  value={
                    punchForm.priority
                  }
                  onChange={(
                    event,
                  ) =>
                    setPunchForm({
                      ...punchForm,
                      priority:
                        event.target.value as PunchPriority,
                    })
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
              </label>

              <label className="field-wide">
                <span>
                  Title
                </span>

                <input
                  required
                  value={
                    punchForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setPunchForm({
                      ...punchForm,
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
                    punchForm.location
                  }
                  onChange={(
                    event,
                  ) =>
                    setPunchForm({
                      ...punchForm,
                      location:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Trade
                </span>

                <input
                  value={
                    punchForm.trade
                  }
                  onChange={(
                    event,
                  ) =>
                    setPunchForm({
                      ...punchForm,
                      trade:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Raised date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    punchForm.raisedDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setPunchForm({
                      ...punchForm,
                      raisedDate:
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
                    punchForm.dueDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setPunchForm({
                      ...punchForm,
                      dueDate:
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
                    punchForm.ownerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setPunchForm({
                      ...punchForm,
                      ownerName:
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
                  rows={4}
                  value={
                    punchForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setPunchForm({
                      ...punchForm,
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
          </QualityPanel>
        )}

        {panel ===
          "handover" && (
          <QualityPanel
            title="Create handover deliverable"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="quality-form"
              onSubmit={
                submitHandover
              }
            >
              <label>
                <span>
                  Code
                </span>

                <input
                  required
                  value={
                    handoverForm.code
                  }
                  onChange={(
                    event,
                  ) =>
                    setHandoverForm({
                      ...handoverForm,
                      code:
                        event.target.value,
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
                    handoverForm.category
                  }
                  onChange={(
                    event,
                  ) =>
                    setHandoverForm({
                      ...handoverForm,
                      category:
                        event.target.value as HandoverCategory,
                    })
                  }
                >
                  {(
                    Object.keys(
                      handoverLabels,
                    ) as HandoverCategory[]
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
                          handoverLabels[
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
                  Deliverable title
                </span>

                <input
                  required
                  value={
                    handoverForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setHandoverForm({
                      ...handoverForm,
                      title:
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
                    handoverForm.ownerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setHandoverForm({
                      ...handoverForm,
                      ownerName:
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
                    handoverForm.dueDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setHandoverForm({
                      ...handoverForm,
                      dueDate:
                        event.target.value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Notes
                </span>

                <textarea
                  rows={4}
                  value={
                    handoverForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setHandoverForm({
                      ...handoverForm,
                      notes:
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
          </QualityPanel>
        )}

        <section
          className="quality-card"
          id="inspections"
        >
          <CardHeader
            eyebrow="INSPECTION CONTROL"
            title="Quality inspections"
            value={`${inspections.length} inspections`}
          />

          <div className="quality-table-wrapper">
            <table className="quality-table">
              <thead>
                <tr>
                  <th>INSPECTION</th>
                  <th>TYPE</th>
                  <th>DISCIPLINE</th>
                  <th>PLANNED</th>
                  <th>ACTUAL</th>
                  <th>RESULT</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {inspections.map(
                  (
                    inspection,
                  ) => (
                    <tr
                      key={
                        inspection.id
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            inspection.reference
                          }
                          title={
                            inspection.title
                          }
                        />
                      </td>

                      <td>
                        {
                          inspectionTypeLabels[
                            inspection.inspectionType
                          ]
                        }
                      </td>

                      <td>
                        {
                          disciplineLabels[
                            inspection.discipline
                          ]
                        }
                      </td>

                      <td>
                        {formatDate(
                          inspection.plannedDate,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          inspection.actualDate,
                        )}
                      </td>

                      <td>
                        <select
                          disabled={
                            busy ||
                            inspection.status ===
                              "CANCELLED"
                          }
                          value={
                            inspection.result
                          }
                          className={`quality-select quality-result-${inspection.result.toLowerCase().replaceAll("_", "-")}`}
                          onChange={(
                            event,
                          ) =>
                            void changeInspectionResult(
                              inspection,
                              event.target.value as QualityInspectionResult,
                            )
                          }
                        >
                          <option value="NOT_ASSESSED">
                            Not assessed
                          </option>
                          <option value="PASS">
                            Pass
                          </option>
                          <option value="PASS_WITH_OBSERVATIONS">
                            Pass + observations
                          </option>
                          <option value="FAIL">
                            Fail
                          </option>
                        </select>
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            inspection.status
                          }
                          className="quality-select"
                          onChange={(
                            event,
                          ) =>
                            void changeInspectionStatus(
                              inspection,
                              event.target.value as QualityInspectionStatus,
                            )
                          }
                        >
                          {inspectionStatusOptions(
                            inspection.status,
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
          className="quality-card"
          id="ncrs"
        >
          <CardHeader
            eyebrow="NON-CONFORMANCE CONTROL"
            title="NCR register"
            value={`${intelligence.openNcrs} open`}
          />

          <div className="quality-table-wrapper">
            <table className="quality-table">
              <thead>
                <tr>
                  <th>NCR</th>
                  <th>INSPECTION</th>
                  <th>CATEGORY</th>
                  <th>SEVERITY</th>
                  <th>OWNER</th>
                  <th>DUE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {ncrs.map(
                  (
                    ncr,
                  ) => (
                    <tr
                      key={
                        ncr.id
                      }
                      className={
                        ncr.overdue
                          ? "quality-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            ncr.reference
                          }
                          title={
                            ncr.title
                          }
                        />
                      </td>

                      <td>
                        {ncr.inspectionReference ??
                          "—"}
                      </td>

                      <td>
                        {ncr.category.replaceAll(
                          "_",
                          " ",
                        )}
                      </td>

                      <td>
                        <span className={`quality-severity severity-${ncr.severity.toLowerCase()}`}>
                          {
                            ncr.severity
                          }
                        </span>
                      </td>

                      <td>
                        {ncr.ownerName ??
                          "—"}
                      </td>

                      <td
                        className={
                          ncr.overdue
                            ? "quality-overdue"
                            : ""
                        }
                      >
                        {formatDate(
                          ncr.dueDate,
                        )}
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            ncr.status
                          }
                          className="quality-select"
                          onChange={(
                            event,
                          ) =>
                            void changeNcrStatus(
                              ncr,
                              event.target.value as NcrStatus,
                            )
                          }
                        >
                          {ncrStatusOptions(
                            ncr.status,
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

                {ncrs.length === 0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="table-message">
                        No NCRs recorded.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="quality-card"
          id="punch"
        >
          <CardHeader
            eyebrow="CLOSE-OUT CONTROL"
            title="Punch / snag list"
            value={`${intelligence.openPunchItems} open`}
          />

          <div className="quality-table-wrapper">
            <table className="quality-table">
              <thead>
                <tr>
                  <th>ITEM</th>
                  <th>LOCATION</th>
                  <th>TRADE</th>
                  <th>PRIORITY</th>
                  <th>OWNER</th>
                  <th>DUE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {punchItems.map(
                  (
                    item,
                  ) => (
                    <tr
                      key={
                        item.id
                      }
                      className={
                        item.overdue
                          ? "quality-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            item.reference
                          }
                          title={
                            item.title
                          }
                        />
                      </td>

                      <td>
                        {item.location ??
                          "—"}
                      </td>

                      <td>
                        {item.trade ??
                          "—"}
                      </td>

                      <td>
                        <span className={`quality-severity punch-${item.priority.toLowerCase()}`}>
                          {
                            item.priority
                          }
                        </span>
                      </td>

                      <td>
                        {item.ownerName ??
                          "—"}
                      </td>

                      <td
                        className={
                          item.overdue
                            ? "quality-overdue"
                            : ""
                        }
                      >
                        {formatDate(
                          item.dueDate,
                        )}
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            item.status
                          }
                          className="quality-select"
                          onChange={(
                            event,
                          ) =>
                            void changePunchStatus(
                              item,
                              event.target.value as PunchStatus,
                            )
                          }
                        >
                          {punchStatusOptions(
                            item.status,
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

                {punchItems.length ===
                  0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="table-message">
                        No punch items recorded.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="quality-card"
          id="handover"
        >
          <CardHeader
            eyebrow="HANDOVER READINESS"
            title="Completion deliverables"
            value={`${intelligence.handoverReadinessPercentage.toFixed(
              0,
            )}% ready`}
          />

          <div className="quality-table-wrapper">
            <table className="quality-table">
              <thead>
                <tr>
                  <th>DELIVERABLE</th>
                  <th>CATEGORY</th>
                  <th>OWNER</th>
                  <th>DUE</th>
                  <th>RECEIVED</th>
                  <th>APPROVED</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {handoverItems.map(
                  (
                    item,
                  ) => (
                    <tr
                      key={
                        item.id
                      }
                      className={
                        item.overdue
                          ? "quality-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={
                            item.code
                          }
                          title={
                            item.title
                          }
                        />
                      </td>

                      <td>
                        {
                          handoverLabels[
                            item.category
                          ]
                        }
                      </td>

                      <td>
                        {item.ownerName ??
                          "—"}
                      </td>

                      <td
                        className={
                          item.overdue
                            ? "quality-overdue"
                            : ""
                        }
                      >
                        {formatDate(
                          item.dueDate,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          item.receivedDate,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          item.approvedDate,
                        )}
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            item.status
                          }
                          className="quality-select"
                          onChange={(
                            event,
                          ) =>
                            void changeHandoverStatus(
                              item,
                              event.target.value as HandoverStatus,
                            )
                          }
                        >
                          {handoverStatusOptions(
                            item.status,
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

                {handoverItems.length ===
                  0 && (
                  <tr>
                    <td colSpan={7}>
                      <div className="table-message">
                        No handover deliverables recorded.
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
            BuildSight · Quality Intelligence
          </div>

          <div>
            {inspections.length} inspections
            {" · "}
            {ncrs.length} NCRs
            {" · "}
            {punchItems.length} punch items
          </div>
        </footer>
      </main>
    </div>
  );
}

function QualityKpi({
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
          ? "quality-kpi quality-kpi-emphasis"
          : "quality-kpi"
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
    <div className="quality-intelligence-metric">
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
    <div className="quality-card-header">
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
    <div className="quality-name-cell">
      <strong>
        {code}
      </strong>

      <span>
        {title}
      </span>
    </div>
  );
}

function QualityPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <section className="quality-form-panel">
      <div className="quality-card-header">
        <div>
          <div className="eyebrow">
            QUALITY CONTROL INPUT
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
