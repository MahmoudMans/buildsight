"use client";

import Link from "next/link";
import { ProjectWorkspaceSidebar } from "./ProjectWorkspaceSidebar";
import { ProjectWorkspaceLoading } from "./ProjectWorkspaceLoading";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  BuildSightApiError,
  createProjectDocument,
  createProjectRfi,
  createProjectTransmittal,
  getProjectDocuments,
  issueProjectTransmittal,
  projectDocumentDownloadUrl,
  searchProjectDocuments,
  updateProjectDocumentRevisionStatus,
  updateProjectRfi,
  uploadProjectDocumentRevision,
} from "@/lib/api";

import type {
  CreateDocumentInput,
  CreateRfiInput,
  CreateTransmittalInput,
  DocumentControl,
  DocumentDiscipline,
  DocumentRevision,
  DocumentRevisionStatus,
  DocumentSearchResult,
  DocumentType,
  InformationRiskLevel,
  ProjectRfi,
  RfiPriority,
} from "@/types/project";

type OpenPanel =
  | "document"
  | "revision"
  | "rfi"
  | "transmittal"
  | null;

const documentTypeLabels: Record<
  DocumentType,
  string
> = {
  DRAWING: "Drawing",
  SPECIFICATION: "Specification",
  REPORT: "Report",
  CONTRACT: "Contract",
  PROCEDURE: "Procedure",
  SCHEDULE: "Schedule",
  OTHER: "Other",
};

const disciplineLabels: Record<
  DocumentDiscipline,
  string
> = {
  ARCHITECTURAL: "Architectural",
  STRUCTURAL: "Structural",
  CIVIL: "Civil",
  MEP: "MEP",
  COMMERCIAL: "Commercial",
  PLANNING: "Planning",
  HSE: "HSE",
  QUALITY: "Quality",
  GENERAL: "General",
};

const informationRiskLabels: Record<
  InformationRiskLevel,
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

function formatBytes(
  value: number,
): string {
  if (value < 1024) {
    return `${value} B`;
  }

  if (value < 1024 * 1024) {
    return `${(
      value / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    value /
    1024 /
    1024
  ).toFixed(1)} MB`;
}

function riskClass(
  risk: InformationRiskLevel,
): string {
  return `information-risk information-risk-${risk
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function revisionClass(
  status: DocumentRevisionStatus,
): string {
  return `revision-status revision-${status
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function revisionOptions(
  status: DocumentRevisionStatus,
): DocumentRevisionStatus[] {
  switch (status) {
    case "DRAFT":
      return [
        "DRAFT",
        "FOR_REVIEW",
        "ISSUED",
        "APPROVED",
      ];

    case "FOR_REVIEW":
      return [
        "FOR_REVIEW",
        "DRAFT",
        "ISSUED",
        "APPROVED",
      ];

    case "ISSUED":
      return [
        "ISSUED",
        "APPROVED",
        "SUPERSEDED",
      ];

    case "APPROVED":
      return [
        "APPROVED",
        "SUPERSEDED",
      ];

    case "SUPERSEDED":
      return [
        "SUPERSEDED",
      ];
  }
}

const documentDefaults: CreateDocumentInput = {
  documentNumber: "",
  title: "",
  documentType: "DRAWING",
  discipline: "GENERAL",
  ownerName: "",
};

const rfiDefaults: CreateRfiInput = {
  reference: "",
  subject: "",
  question: "",
  raisedBy: "",
  assignedTo: "",
  raisedDate: todayValue(),
  dueDate: futureValue(7),
  priority: "MEDIUM",
};

const transmittalDefaults: CreateTransmittalInput = {
  reference: "",
  recipient: "",
  purpose: "",
  transmittalDate: todayValue(),
  notes: "",
  revisionIds: [],
};

export function ProjectDocumentControlView({
  projectId,
}: {
  projectId: string;
}) {
  const [data, setData] =
    useState<DocumentControl | null>(
      null,
    );

  const [loading, setLoading] =
    useState(true);

  const [busy, setBusy] =
    useState(false);

  const [error, setError] =
    useState("");

  const [openPanel, setOpenPanel] =
    useState<OpenPanel>(null);

  const [documentForm, setDocumentForm] =
    useState<CreateDocumentInput>(
      documentDefaults,
    );

  const [rfiForm, setRfiForm] =
    useState<CreateRfiInput>(
      rfiDefaults,
    );

  const [
    transmittalForm,
    setTransmittalForm,
  ] =
    useState<CreateTransmittalInput>(
      transmittalDefaults,
    );

  const [
    revisionDocumentId,
    setRevisionDocumentId,
  ] =
    useState("");

  const [
    revisionCode,
    setRevisionCode,
  ] =
    useState("P01");

  const [
    revisionStatus,
    setRevisionStatus,
  ] =
    useState<DocumentRevisionStatus>(
      "DRAFT",
    );

  const [
    revisionIssuedDate,
    setRevisionIssuedDate,
  ] =
    useState(
      todayValue(),
    );

  const [
    revisionFile,
    setRevisionFile,
  ] =
    useState<File | null>(
      null,
    );

  const [
    searchQuery,
    setSearchQuery,
  ] =
    useState("");

  const [
    searchResults,
    setSearchResults,
  ] =
    useState<DocumentSearchResult[]>(
      [],
    );

  const [
    searching,
    setSearching,
  ] =
    useState(false);

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectDocuments(
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
                "BuildSight could not reach the local backend.",
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
    [
      projectId,
    ],
  );

  async function refresh() {
    const response =
      await getProjectDocuments(
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
          "The local BuildSight operation failed.",
        );
      }

      return false;

    } finally {
      setBusy(
        false,
      );
    }
  }

  function openRevisionPanel() {
    setRevisionDocumentId(
      data?.documents[
        0
      ]?.id ??
      "",
    );

    setRevisionCode(
      "P01",
    );

    setRevisionStatus(
      "DRAFT",
    );

    setRevisionIssuedDate(
      todayValue(),
    );

    setRevisionFile(
      null,
    );

    setOpenPanel(
      "revision",
    );
  }

  async function submitDocument(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createProjectDocument(
            projectId,
            documentForm,
          ),
      );

    if (ok) {
      setDocumentForm(
        documentDefaults,
      );

      setOpenPanel(
        null,
      );
    }
  }

  async function submitRevision(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !revisionDocumentId
      ||
      !revisionFile
    ) {
      return;
    }

    const ok =
      await runAction(
        () =>
          uploadProjectDocumentRevision(
            projectId,
            revisionDocumentId,
            revisionCode,
            revisionStatus,
            revisionIssuedDate,
            revisionFile,
          ),
      );

    if (ok) {
      setOpenPanel(
        null,
      );

      setRevisionFile(
        null,
      );
    }
  }

  async function submitRfi(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createProjectRfi(
            projectId,
            rfiForm,
          ),
      );

    if (ok) {
      setRfiForm({
        ...rfiDefaults,
        raisedDate:
          todayValue(),
        dueDate:
          futureValue(7),
      });

      setOpenPanel(
        null,
      );
    }
  }

  async function submitTransmittal(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createProjectTransmittal(
            projectId,
            transmittalForm,
          ),
      );

    if (ok) {
      setTransmittalForm({
        ...transmittalDefaults,
        transmittalDate:
          todayValue(),
      });

      setOpenPanel(
        null,
      );
    }
  }

  async function changeRevisionStatus(
    revision: DocumentRevision,
    status: DocumentRevisionStatus,
  ) {
    if (
      revision.revisionStatus
      ===
      status
    ) {
      return;
    }

    await runAction(
      () =>
        updateProjectDocumentRevisionStatus(
          projectId,
          revision.documentId,
          revision.id,
          revision.version,
          status,
        ),
    );
  }

  async function answerRfi(
    rfi: ProjectRfi,
  ) {
    const response =
      window.prompt(
        `Response for ${rfi.reference}`,
        rfi.response ??
          "",
      );

    if (
      response === null
      ||
      !response.trim()
    ) {
      return;
    }

    await runAction(
      () =>
        updateProjectRfi(
          projectId,
          rfi.id,
          {
            version:
              rfi.version,
            subject:
              rfi.subject,
            question:
              rfi.question,
            response,
            assignedTo:
              rfi.assignedTo ??
              "",
            dueDate:
              rfi.dueDate,
            priority:
              rfi.priority,
            status:
              "ANSWERED",
          },
        ),
    );
  }

  async function closeRfi(
    rfi: ProjectRfi,
  ) {
    if (
      !rfi.response
    ) {
      setError(
        "Answer the RFI before closing it.",
      );

      return;
    }

    await runAction(
      () =>
        updateProjectRfi(
          projectId,
          rfi.id,
          {
            version:
              rfi.version,
            subject:
              rfi.subject,
            question:
              rfi.question,
            response:
              rfi.response ??
              "",
            assignedTo:
              rfi.assignedTo ??
              "",
            dueDate:
              rfi.dueDate,
            priority:
              rfi.priority,
            status:
              "CLOSED",
          },
        ),
    );
  }

  async function submitSearch(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !searchQuery.trim()
    ) {
      setSearchResults(
        [],
      );

      return;
    }

    setSearching(
      true,
    );

    setError(
      "",
    );

    try {
      setSearchResults(
        await searchProjectDocuments(
          projectId,
          searchQuery,
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
      } else {
        setError(
          "Local project search failed.",
        );
      }

    } finally {
      setSearching(
        false,
      );
    }
  }

  function toggleTransmittalRevision(
    revisionId: string,
  ) {
    const selected =
      transmittalForm.revisionIds;

    setTransmittalForm({
      ...transmittalForm,
      revisionIds:
        selected.includes(
          revisionId,
        )
          ? selected.filter(
              (
                id,
              ) =>
                id !==
                revisionId,
            )
          : [
              ...selected,
              revisionId,
            ],
    });
  }

  if (loading) {
    return (
      <ProjectWorkspaceLoading
        label={"Loading document intelligence..."}
        mainClassName={"document-main"}
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
            Document control unavailable
          </h1>

          <p>
            {error ||
              "BuildSight could not load project documents."}
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
    documents,
    revisions,
    rfis,
    transmittals,
  } = data;

  return (
    <div className="document-shell">
      <ProjectWorkspaceSidebar
        projectId={projectId}
        projectCode={project.code}
        className="document-sidebar"
        localLinks={[
          { href: "#documents", label: "Register" },
          { href: "#rfis", label: "RFIs" },
          { href: "#transmittals", label: "Transmittals" },
        ]}
      />

      <main className="document-main">
        <header className="document-topbar">
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
              INFORMATION MANAGEMENT
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Controlled drawings,
              specifications, revisions,
              RFIs, transmittals and
              private local search.
            </p>
          </div>

          <div className="document-header-score">
            <span>
              INFORMATION HEALTH
            </span>

            <strong>
              {intelligence.informationScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={
                riskClass(
                  intelligence.informationRisk,
                )
              }
            >
              {
                informationRiskLabels[
                  intelligence.informationRisk
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

        <section className="document-kpi-grid">
          <DocumentKpi
            label="CONTROLLED DOCUMENTS"
            value={String(
              intelligence.totalDocuments,
            )}
            detail={`${intelligence.totalRevisions} revisions`}
          />

          <DocumentKpi
            label="OPEN RFIs"
            value={String(
              intelligence.openRfis,
            )}
            detail={`${intelligence.overdueRfis} overdue`}
          />

          <DocumentKpi
            label="CRITICAL RFIs"
            value={String(
              intelligence.criticalOpenRfis,
            )}
            detail="Open critical information requests"
          />

          <DocumentKpi
            label="SEARCHABLE CONTENT"
            value={String(
              intelligence.extractedTextRevisions,
            )}
            detail="Revisions with locally extracted text"
            emphasis
          />
        </section>

        <section className="document-intelligence-panel">
          <div className="document-score-panel">
            <span>
              INFORMATION SCORE
            </span>

            <strong>
              {intelligence.informationScore.toFixed(
                0,
              )}
            </strong>

            <small>
              /100
            </small>

            <i
              className={
                riskClass(
                  intelligence.informationRisk,
                )
              }
            >
              {
                informationRiskLabels[
                  intelligence.informationRisk
                ]
              }
            </i>
          </div>

          <div className="document-intelligence-grid">
            <Metric
              label="Drawings"
              value={String(
                intelligence.drawingDocuments,
              )}
            />

            <Metric
              label="Overdue RFIs"
              value={String(
                intelligence.overdueRfis,
              )}
            />

            <Metric
              label="Draft transmittals"
              value={String(
                intelligence.draftTransmittals,
              )}
            />

            <Metric
              label="Stale drafts"
              value={String(
                intelligence.staleDraftTransmittals,
              )}
            />

            <Metric
              label="Issued transmittals"
              value={String(
                intelligence.issuedTransmittals,
              )}
            />

            <Metric
              label="Extracted revisions"
              value={`${intelligence.extractedTextRevisions}/${intelligence.totalRevisions}`}
            />
          </div>

          <p>
            {intelligence.explanation}
          </p>
        </section>

        <section className="document-search-panel">
          <div>
            <div className="eyebrow">
              PRIVATE LOCAL SEARCH
            </div>

            <h2>
              Search project information
            </h2>

            <p>
              PostgreSQL full-text search
              across locally extracted
              document content and RFIs.
            </p>
          </div>

          <form
            onSubmit={
              submitSearch
            }
            className="document-search-form"
          >
            <input
              value={
                searchQuery
              }
              placeholder="Search drawings, specifications, RFIs..."
              onChange={(
                event,
              ) =>
                setSearchQuery(
                  event.target
                    .value,
                )
              }
            />

            <button
              type="submit"
              className="primary-button"
              disabled={
                searching
              }
            >
              {searching
                ? "Searching..."
                : "Search"}
            </button>
          </form>

          {searchResults.length >
            0 && (
            <div className="document-search-results">
              {searchResults.map(
                (
                  result,
                ) => (
                  <article
                    key={`${result.resultType}-${result.entityId}`}
                  >
                    <div>
                      <span>
                        {
                          result.resultType
                        }
                      </span>

                      <strong>
                        {
                          result.reference
                        }
                      </strong>
                    </div>

                    <h3>
                      {
                        result.title
                      }
                    </h3>

                    <p>
                      {
                        result.snippet
                      }
                    </p>
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <section className="document-actions">
          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                "document",
              )
            }
          >
            + Document
          </button>

          <button
            type="button"
            disabled={
              documents.length ===
              0
            }
            onClick={
              openRevisionPanel
            }
          >
            + Revision file
          </button>

          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                "rfi",
              )
            }
          >
            + RFI
          </button>

          <button
            type="button"
            disabled={
              revisions.length ===
              0
            }
            onClick={() =>
              setOpenPanel(
                "transmittal",
              )
            }
          >
            + Transmittal
          </button>
        </section>

        {openPanel ===
          "document" && (
          <Panel
            title="Register controlled document"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="document-form"
              onSubmit={
                submitDocument
              }
            >
              <label>
                <span>
                  Document number
                </span>

                <input
                  required
                  value={
                    documentForm.documentNumber
                  }
                  onChange={(
                    event,
                  ) =>
                    setDocumentForm({
                      ...documentForm,
                      documentNumber:
                        event.target
                          .value,
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
                    documentForm.documentType
                  }
                  onChange={(
                    event,
                  ) =>
                    setDocumentForm({
                      ...documentForm,
                      documentType:
                        event.target
                          .value as DocumentType,
                    })
                  }
                >
                  {(
                    Object.keys(
                      documentTypeLabels,
                    ) as DocumentType[]
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
                          documentTypeLabels[
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
                    documentForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setDocumentForm({
                      ...documentForm,
                      title:
                        event.target
                          .value,
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
                    documentForm.discipline
                  }
                  onChange={(
                    event,
                  ) =>
                    setDocumentForm({
                      ...documentForm,
                      discipline:
                        event.target
                          .value as DocumentDiscipline,
                    })
                  }
                >
                  {(
                    Object.keys(
                      disciplineLabels,
                    ) as DocumentDiscipline[]
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
                  Information owner
                </span>

                <input
                  value={
                    documentForm.ownerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setDocumentForm({
                      ...documentForm,
                      ownerName:
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
          </Panel>
        )}

        {openPanel ===
          "revision" && (
          <Panel
            title="Upload controlled revision"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="document-form"
              onSubmit={
                submitRevision
              }
            >
              <label className="field-wide">
                <span>
                  Document
                </span>

                <select
                  required
                  value={
                    revisionDocumentId
                  }
                  onChange={(
                    event,
                  ) =>
                    setRevisionDocumentId(
                      event.target
                        .value,
                    )
                  }
                >
                  {documents.map(
                    (
                      document,
                    ) => (
                      <option
                        key={
                          document.id
                        }
                        value={
                          document.id
                        }
                      >
                        {
                          document.documentNumber
                        }
                        {" — "}
                        {
                          document.title
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Revision
                </span>

                <input
                  required
                  value={
                    revisionCode
                  }
                  onChange={(
                    event,
                  ) =>
                    setRevisionCode(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  Status
                </span>

                <select
                  value={
                    revisionStatus
                  }
                  onChange={(
                    event,
                  ) =>
                    setRevisionStatus(
                      event.target
                        .value as DocumentRevisionStatus,
                    )
                  }
                >
                  <option value="DRAFT">
                    Draft
                  </option>

                  <option value="FOR_REVIEW">
                    For review
                  </option>

                  <option value="ISSUED">
                    Issued
                  </option>

                  <option value="APPROVED">
                    Approved
                  </option>
                </select>
              </label>

              <label>
                <span>
                  Issue date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    revisionIssuedDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setRevisionIssuedDate(
                      event.target
                        .value,
                    )
                  }
                />
              </label>

              <label className="field-wide">
                <span>
                  Local file
                </span>

                <input
                  required
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md"
                  onChange={(
                    event,
                  ) =>
                    setRevisionFile(
                      event.target
                        .files?.[
                          0
                        ] ??
                        null,
                    )
                  }
                />
              </label>

              <div className="document-local-note field-full">
                File content is stored in
                local SeaweedFS. BuildSight
                calculates SHA-256 and uses
                Apache Tika locally to
                extract searchable text.
              </div>

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
          </Panel>
        )}

        {openPanel ===
          "rfi" && (
          <Panel
            title="Create request for information"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="document-form"
              onSubmit={
                submitRfi
              }
            >
              <label>
                <span>
                  RFI reference
                </span>

                <input
                  required
                  value={
                    rfiForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setRfiForm({
                      ...rfiForm,
                      reference:
                        event.target
                          .value,
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
                    rfiForm.priority
                  }
                  onChange={(
                    event,
                  ) =>
                    setRfiForm({
                      ...rfiForm,
                      priority:
                        event.target
                          .value as RfiPriority,
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
                  Subject
                </span>

                <input
                  required
                  value={
                    rfiForm.subject
                  }
                  onChange={(
                    event,
                  ) =>
                    setRfiForm({
                      ...rfiForm,
                      subject:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Raised by
                </span>

                <input
                  value={
                    rfiForm.raisedBy
                  }
                  onChange={(
                    event,
                  ) =>
                    setRfiForm({
                      ...rfiForm,
                      raisedBy:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Assigned to
                </span>

                <input
                  value={
                    rfiForm.assignedTo
                  }
                  onChange={(
                    event,
                  ) =>
                    setRfiForm({
                      ...rfiForm,
                      assignedTo:
                        event.target
                          .value,
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
                    rfiForm.raisedDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setRfiForm({
                      ...rfiForm,
                      raisedDate:
                        event.target
                          .value,
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
                    rfiForm.dueDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setRfiForm({
                      ...rfiForm,
                      dueDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Question
                </span>

                <textarea
                  required
                  rows={5}
                  value={
                    rfiForm.question
                  }
                  onChange={(
                    event,
                  ) =>
                    setRfiForm({
                      ...rfiForm,
                      question:
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
          </Panel>
        )}

        {openPanel ===
          "transmittal" && (
          <Panel
            title="Create document transmittal"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="document-form"
              onSubmit={
                submitTransmittal
              }
            >
              <label>
                <span>
                  Reference
                </span>

                <input
                  required
                  value={
                    transmittalForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setTransmittalForm({
                      ...transmittalForm,
                      reference:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    transmittalForm.transmittalDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setTransmittalForm({
                      ...transmittalForm,
                      transmittalDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Recipient
                </span>

                <input
                  required
                  value={
                    transmittalForm.recipient
                  }
                  onChange={(
                    event,
                  ) =>
                    setTransmittalForm({
                      ...transmittalForm,
                      recipient:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Purpose
                </span>

                <input
                  required
                  value={
                    transmittalForm.purpose
                  }
                  onChange={(
                    event,
                  ) =>
                    setTransmittalForm({
                      ...transmittalForm,
                      purpose:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Notes
                </span>

                <textarea
                  rows={3}
                  value={
                    transmittalForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setTransmittalForm({
                      ...transmittalForm,
                      notes:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <div className="transmittal-revision-picker field-full">
                <strong>
                  Select controlled revisions
                </strong>

                {revisions.map(
                  (
                    revision,
                  ) => (
                    <label
                      key={
                        revision.id
                      }
                    >
                      <input
                        type="checkbox"
                        checked={
                          transmittalForm.revisionIds.includes(
                            revision.id,
                          )
                        }
                        onChange={() =>
                          toggleTransmittalRevision(
                            revision.id,
                          )
                        }
                      />

                      <span>
                        {
                          revision.documentNumber
                        }
                        {" · Rev "}
                        {
                          revision.revisionCode
                        }
                        {" · "}
                        {
                          revision.revisionStatus
                        }
                      </span>
                    </label>
                  ),
                )}
              </div>

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
          </Panel>
        )}

        <section
          className="document-card"
          id="documents"
        >
          <div className="document-card-header">
            <div>
              <div className="eyebrow">
                DOCUMENT REGISTER
              </div>

              <h2>
                Controlled documents
              </h2>
            </div>

            <strong>
              {
                documents.length
              }{" "}
              documents
            </strong>
          </div>

          <div className="document-table-wrapper">
            <table className="document-table">
              <thead>
                <tr>
                  <th>NUMBER</th>
                  <th>TITLE</th>
                  <th>TYPE</th>
                  <th>DISCIPLINE</th>
                  <th>OWNER</th>
                  <th>REVISIONS</th>
                  <th>LATEST</th>
                </tr>
              </thead>

              <tbody>
                {documents.map(
                  (
                    document,
                  ) => (
                    <tr
                      key={
                        document.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            document.documentNumber
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          document.title
                        }
                      </td>

                      <td>
                        {
                          documentTypeLabels[
                            document.documentType
                          ]
                        }
                      </td>

                      <td>
                        {
                          disciplineLabels[
                            document.discipline
                          ]
                        }
                      </td>

                      <td>
                        {document.ownerName ??
                          "—"}
                      </td>

                      <td>
                        {
                          document.revisionCount
                        }
                      </td>

                      <td>
                        {document.latestRevisionCode
                          ? `${document.latestRevisionCode} · ${document.latestRevisionStatus}`
                          : "No revision"}
                      </td>
                    </tr>
                  ),
                )}

                {documents.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        7
                      }
                    >
                      <div className="table-message">
                        No controlled documents registered.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="document-card">
          <div className="document-card-header">
            <div>
              <div className="eyebrow">
                REVISION CONTROL
              </div>

              <h2>
                Document revisions
              </h2>
            </div>

            <strong>
              {
                revisions.length
              }{" "}
              revisions
            </strong>
          </div>

          <div className="document-table-wrapper">
            <table className="document-table revision-table">
              <thead>
                <tr>
                  <th>DOCUMENT</th>
                  <th>REVISION</th>
                  <th>ISSUED</th>
                  <th>FILE</th>
                  <th>SIZE</th>
                  <th>EXTRACTED</th>
                  <th>STATUS</th>
                  <th>FILE</th>
                </tr>
              </thead>

              <tbody>
                {revisions.map(
                  (
                    revision,
                  ) => (
                    <tr
                      key={
                        revision.id
                      }
                    >
                      <td>
                        <div className="document-name-cell">
                          <strong>
                            {
                              revision.documentNumber
                            }
                          </strong>

                          <span>
                            {
                              revision.documentTitle
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        <strong>
                          {
                            revision.revisionCode
                          }
                        </strong>
                      </td>

                      <td>
                        {formatDate(
                          revision.issuedDate,
                        )}
                      </td>

                      <td>
                        {
                          revision.fileName
                        }
                      </td>

                      <td>
                        {formatBytes(
                          revision.fileSize,
                        )}
                      </td>

                      <td>
                        {
                          revision.extractedCharacterCount
                        }{" "}
                        chars
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            revision.revisionStatus
                          }
                          className={
                            revisionClass(
                              revision.revisionStatus,
                            )
                          }
                          onChange={(
                            event,
                          ) =>
                            void changeRevisionStatus(
                              revision,
                              event.target
                                .value as DocumentRevisionStatus,
                            )
                          }
                        >
                          {revisionOptions(
                            revision.revisionStatus,
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
                        {revision.fileSize >
                        0 ? (
                          <a
                            className="document-download-button"
                            href={projectDocumentDownloadUrl(
                              projectId,
                              revision.documentId,
                              revision.id,
                            )}
                          >
                            Download
                          </a>
                        ) : (
                          <span className="demo-file-label">
                            Demo metadata
                          </span>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="document-card"
          id="rfis"
        >
          <div className="document-card-header">
            <div>
              <div className="eyebrow">
                REQUESTS FOR INFORMATION
              </div>

              <h2>
                RFI register
              </h2>
            </div>

            <strong>
              {
                intelligence.openRfis
              }{" "}
              open
            </strong>
          </div>

          <div className="document-table-wrapper">
            <table className="document-table">
              <thead>
                <tr>
                  <th>RFI</th>
                  <th>PRIORITY</th>
                  <th>ASSIGNED TO</th>
                  <th>RAISED</th>
                  <th>DUE</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {rfis.map(
                  (
                    rfi,
                  ) => (
                    <tr
                      key={
                        rfi.id
                      }
                      className={
                        rfi.overdue
                          ? "rfi-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <div className="document-name-cell">
                          <strong>
                            {
                              rfi.reference
                            }
                          </strong>

                          <span>
                            {
                              rfi.subject
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        <span className={`rfi-priority priority-${rfi.priority.toLowerCase()}`}>
                          {
                            rfi.priority
                          }
                        </span>
                      </td>

                      <td>
                        {rfi.assignedTo ??
                          "—"}
                      </td>

                      <td>
                        {formatDate(
                          rfi.raisedDate,
                        )}
                      </td>

                      <td>
                        <span
                          className={
                            rfi.overdue
                              ? "overdue-date"
                              : ""
                          }
                        >
                          {formatDate(
                            rfi.dueDate,
                          )}
                        </span>
                      </td>

                      <td>
                        <span className={`rfi-status rfi-${rfi.status.toLowerCase()}`}>
                          {
                            rfi.status
                          }
                        </span>
                      </td>

                      <td>
                        <div className="document-row-actions">
                          {rfi.status ===
                            "OPEN" && (
                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                void answerRfi(
                                  rfi,
                                )
                              }
                            >
                              Answer
                            </button>
                          )}

                          {rfi.status ===
                            "ANSWERED" && (
                            <button
                              type="button"
                              disabled={
                                busy
                              }
                              onClick={() =>
                                void closeRfi(
                                  rfi,
                                )
                              }
                            >
                              Close
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                )}

                {rfis.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        7
                      }
                    >
                      <div className="table-message">
                        No RFIs recorded.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="document-card"
          id="transmittals"
        >
          <div className="document-card-header">
            <div>
              <div className="eyebrow">
                CONTROLLED ISSUE
              </div>

              <h2>
                Transmittals
              </h2>
            </div>

            <strong>
              {
                transmittals.length
              }{" "}
              transmittals
            </strong>
          </div>

          <div className="document-table-wrapper">
            <table className="document-table">
              <thead>
                <tr>
                  <th>REFERENCE</th>
                  <th>RECIPIENT</th>
                  <th>PURPOSE</th>
                  <th>DOCUMENTS</th>
                  <th>DATE</th>
                  <th>ISSUED</th>
                  <th>STATUS</th>
                  <th>ACTION</th>
                </tr>
              </thead>

              <tbody>
                {transmittals.map(
                  (
                    transmittal,
                  ) => (
                    <tr
                      key={
                        transmittal.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            transmittal.reference
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          transmittal.recipient
                        }
                      </td>

                      <td>
                        {
                          transmittal.purpose
                        }
                      </td>

                      <td>
                        <div className="revision-reference-list">
                          {transmittal.revisionReferences.map(
                            (
                              reference,
                            ) => (
                              <span
                                key={
                                  reference
                                }
                              >
                                {
                                  reference
                                }
                              </span>
                            ),
                          )}
                        </div>
                      </td>

                      <td>
                        {formatDate(
                          transmittal.transmittalDate,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          transmittal.issuedDate,
                        )}
                      </td>

                      <td>
                        <span className={`transmittal-status transmittal-${transmittal.status.toLowerCase()}`}>
                          {
                            transmittal.status
                          }
                        </span>
                      </td>

                      <td>
                        {transmittal.status ===
                          "DRAFT" && (
                          <button
                            className="table-action-button"
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void runAction(
                                () =>
                                  issueProjectTransmittal(
                                    projectId,
                                    transmittal.id,
                                    transmittal.version,
                                  ),
                              )
                            }
                          >
                            Issue
                          </button>
                        )}
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
            BuildSight · Document Intelligence
          </div>

          <div>
            {documents.length} documents
            {" · "}
            {rfis.length} RFIs
            {" · "}
            {transmittals.length} transmittals
          </div>
        </footer>
      </main>
    </div>
  );
}

function DocumentKpi({
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
          ? "document-kpi document-kpi-emphasis"
          : "document-kpi"
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
    <div className="document-intelligence-metric">
      <span>
        {label}
      </span>

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
  children: React.ReactNode;
}) {
  return (
    <section className="document-form-panel">
      <div className="document-card-header">
        <div>
          <div className="eyebrow">
            INFORMATION CONTROL INPUT
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
