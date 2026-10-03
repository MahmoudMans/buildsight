"use client";

import Link from "next/link";
import { ProjectWorkspaceSidebar } from "./ProjectWorkspaceSidebar";
import { ProjectWorkspaceLoading } from "./ProjectWorkspaceLoading";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BuildSightApiError,
  createProductionEntry,
  createSiteReport,
  createWorkPackage,
  getProjectProduction,
  updateSiteReport,
  updateWorkPackage,
} from "@/lib/api";

import type {
  CreateProductionEntryInput,
  CreateSiteReportInput,
  CreateWorkPackageInput,
  ProductionControl,
  ProductionRiskLevel,
  SiteReport,
  SiteReportStatus,
  WeatherCondition,
  WorkPackage,
  WorkPackageStatus,
} from "@/types/project";

type OpenPanel =
  | "package"
  | "report"
  | "production"
  | null;

const productionRiskLabels: Record<
  ProductionRiskLevel,
  string
> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const weatherLabels: Record<
  WeatherCondition,
  string
> = {
  CLEAR: "Clear",
  CLOUDY: "Cloudy",
  RAIN: "Rain",
  WIND: "Wind",
  EXTREME_HEAT: "Extreme heat",
  EXTREME_COLD: "Extreme cold",
  OTHER: "Other",
};

const packageStatusLabels: Record<
  WorkPackageStatus,
  string
> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const reportStatusLabels: Record<
  SiteReportStatus,
  string
> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
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

function hours(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits: 1,
    },
  ).format(
    value,
  );
}

function quantity(
  value: number,
): string {
  return new Intl.NumberFormat(
    "en-GB",
    {
      maximumFractionDigits: 2,
    },
  ).format(
    value,
  );
}

function riskClass(
  risk: ProductionRiskLevel,
): string {
  return `production-risk production-risk-${risk
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function packageClass(
  status: WorkPackageStatus,
): string {
  return `production-package-status production-package-${status
    .toLowerCase()
    .replaceAll("_", "-")}`;
}

function reportClass(
  status: SiteReportStatus,
): string {
  return `site-report-status site-report-${status.toLowerCase()}`;
}

function packageStatusOptions(
  status: WorkPackageStatus,
): WorkPackageStatus[] {
  switch (status) {
    case "PLANNED":
      return [
        "PLANNED",
        "IN_PROGRESS",
        "BLOCKED",
        "CANCELLED",
      ];

    case "IN_PROGRESS":
      return [
        "IN_PROGRESS",
        "BLOCKED",
        "COMPLETED",
        "CANCELLED",
      ];

    case "BLOCKED":
      return [
        "BLOCKED",
        "IN_PROGRESS",
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

function reportStatusOptions(
  status: SiteReportStatus,
): SiteReportStatus[] {
  switch (status) {
    case "DRAFT":
      return [
        "DRAFT",
        "SUBMITTED",
      ];

    case "SUBMITTED":
      return [
        "SUBMITTED",
        "APPROVED",
      ];

    case "APPROVED":
      return [
        "APPROVED",
      ];
  }
}

const packageDefaults: CreateWorkPackageInput = {
  code: "",
  name: "",
  description: "",
  unit: "m2",
  plannedQuantity: 100,
  plannedLaborHours: 400,
  plannedStartDate: todayValue(),
  plannedEndDate: futureValue(
    30,
  ),
};

const reportDefaults: CreateSiteReportInput = {
  reference: "",
  reportDate: todayValue(),
  weatherCondition: "CLEAR",
  generalNotes: "",
};

const productionDefaults: CreateProductionEntryInput = {
  workPackageId: "",
  quantityCompleted: 0,
  laborHours: 0,
  equipmentHours: 0,
  crewSize: 0,
  notes: "",
};

export function ProjectProductionView({
  projectId,
}: {
  projectId: string;
}) {
  const [data, setData] =
    useState<ProductionControl | null>(
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

  const [packageForm, setPackageForm] =
    useState<CreateWorkPackageInput>(
      packageDefaults,
    );

  const [reportForm, setReportForm] =
    useState<CreateSiteReportInput>(
      reportDefaults,
    );

  const [productionForm, setProductionForm] =
    useState<CreateProductionEntryInput>(
      productionDefaults,
    );

  const [
    selectedReportId,
    setSelectedReportId,
  ] =
    useState(
      "",
    );

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectProduction(
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
      await getProjectProduction(
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

  const draftReports =
    useMemo(
      () =>
        data?.siteReports.filter(
          (
            report,
          ) =>
            report.status
              ===
              "DRAFT",
        ) ?? [],
      [
        data,
      ],
    );

  const productionPackages =
    useMemo(
      () =>
        data?.workPackages.filter(
          (
            packageItem,
          ) =>
            packageItem.status
              ===
              "IN_PROGRESS"
            ||
            packageItem.status
              ===
              "BLOCKED",
        ) ?? [],
      [
        data,
      ],
    );

  function openProductionEntry() {
    const reportId =
      draftReports[
        0
      ]?.id ??
      "";

    const workPackageId =
      productionPackages[
        0
      ]?.id ??
      "";

    setSelectedReportId(
      reportId,
    );

    setProductionForm({
      ...productionDefaults,
      workPackageId,
    });

    setOpenPanel(
      "production",
    );
  }

  async function submitPackage(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createWorkPackage(
            projectId,
            packageForm,
          ),
      );

    if (
      ok
    ) {
      setPackageForm({
        ...packageDefaults,
        plannedStartDate:
          todayValue(),
        plannedEndDate:
          futureValue(
            30,
          ),
      });

      setOpenPanel(
        null,
      );
    }
  }

  async function submitReport(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createSiteReport(
            projectId,
            reportForm,
          ),
      );

    if (
      ok
    ) {
      setReportForm({
        ...reportDefaults,
        reportDate:
          todayValue(),
      });

      setOpenPanel(
        null,
      );
    }
  }

  async function submitProduction(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !selectedReportId
    ) {
      return;
    }

    const ok =
      await runAction(
        () =>
          createProductionEntry(
            projectId,
            selectedReportId,
            productionForm,
          ),
      );

    if (
      ok
    ) {
      setOpenPanel(
        null,
      );
    }
  }

  async function changePackageStatus(
    packageItem: WorkPackage,
    status: WorkPackageStatus,
  ) {
    if (
      status ===
      packageItem.status
    ) {
      return;
    }

    let blockReason =
      packageItem.blockReason ??
      "";

    if (
      status ===
      "BLOCKED"
      &&
      !blockReason
    ) {
      blockReason =
        "Work front blocked pending resolution.";
    }

    await runAction(
      () =>
        updateWorkPackage(
          projectId,
          packageItem.id,
          {
            version:
              packageItem.version,
            name:
              packageItem.name,
            description:
              packageItem.description ??
              "",
            unit:
              packageItem.unit,
            plannedQuantity:
              Number(
                packageItem.plannedQuantity,
              ),
            plannedLaborHours:
              Number(
                packageItem.plannedLaborHours,
              ),
            plannedStartDate:
              packageItem.plannedStartDate,
            plannedEndDate:
              packageItem.plannedEndDate,
            status,
            blockReason,
          },
        ),
    );
  }

  async function changeReportStatus(
    report: SiteReport,
    status: SiteReportStatus,
  ) {
    if (
      status ===
      report.status
    ) {
      return;
    }

    await runAction(
      () =>
        updateSiteReport(
          projectId,
          report.id,
          {
            version:
              report.version,
            reportDate:
              report.reportDate,
            weatherCondition:
              report.weatherCondition,
            generalNotes:
              report.generalNotes ??
              "",
            status,
          },
        ),
    );
  }

  if (loading) {
    return (
      <ProjectWorkspaceLoading
        label={"Loading production intelligence..."}
        mainClassName={"production-main"}
        projectId={projectId}
      />
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
            Production unavailable
          </h1>

          <p>
            {error ||
              "BuildSight could not load site-production data."}
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
    workPackages,
    siteReports,
    productionEntries,
  } = data;

  return (
    <div className="production-shell">
      <ProjectWorkspaceSidebar
        projectId={projectId}
        projectCode={project.code}
        className="production-sidebar"
        localLinks={[
          { href: "#packages", label: "Work packages" },
          { href: "#reports", label: "Site reports" },
          { href: "#entries", label: "Daily production" },
        ]}
      />

      <main className="production-main">
        <header className="production-topbar">
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
              PRODUCTION INTELLIGENCE
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Work-package quantities,
              daily reports, labor,
              equipment utilization,
              productivity and blocked
              production fronts.
            </p>
          </div>

          <div className="production-header-score">
            <span>
              PRODUCTION HEALTH
            </span>

            <strong>
              {intelligence.productionScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={
                riskClass(
                  intelligence.productionRisk,
                )
              }
            >
              {
                productionRiskLabels[
                  intelligence.productionRisk
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

        <section className="production-kpi-grid">
          <ProductionKpi
            label="PACKAGE COMPLETION"
            value={`${intelligence.averagePackageCompletionPercentage.toFixed(
              1,
            )}%`}
            detail={`Expected ${intelligence.averageExpectedProgressPercentage.toFixed(
              1,
            )}%`}
          />

          <ProductionKpi
            label="PRODUCTION VARIANCE"
            value={`${intelligence.productionVariancePoints > 0 ? "+" : ""}${intelligence.productionVariancePoints.toFixed(
              1,
            )} pts`}
            detail="Actual vs time-phased expectation"
          />

          <ProductionKpi
            label="LABOR HOURS"
            value={hours(
              Number(
                intelligence.totalLaborHours,
              ),
            )}
            detail={`${hours(
              Number(
                intelligence.totalEquipmentHours,
              ),
            )} equipment hours`}
          />

          <ProductionKpi
            label="BLOCKED FRONTS"
            value={String(
              intelligence.blockedPackages,
            )}
            detail={`${intelligence.activePackages} active packages`}
            emphasis
          />
        </section>

        <section className="production-intelligence-panel">
          <div className="production-score-panel">
            <span>
              PRODUCTION SCORE
            </span>

            <strong>
              {intelligence.productionScore.toFixed(
                0,
              )}
            </strong>

            <small>
              /100
            </small>

            <i
              className={
                riskClass(
                  intelligence.productionRisk,
                )
              }
            >
              {
                productionRiskLabels[
                  intelligence.productionRisk
                ]
              }
            </i>
          </div>

          <div className="production-intelligence-grid">
            <ProductionMetric
              label="Productivity index"
              value={intelligence.overallProductivityIndex.toFixed(
                2,
              )}
            />

            <ProductionMetric
              label="Weekly production trend"
              value={`${intelligence.weeklyProductionTrendPercentage > 0 ? "+" : ""}${intelligence.weeklyProductionTrendPercentage.toFixed(
                1,
              )}%`}
            />

            <ProductionMetric
              label="Accepted reports"
              value={String(
                intelligence.acceptedSiteReports,
              )}
            />

            <ProductionMetric
              label="Approved reports"
              value={String(
                intelligence.approvedSiteReports,
              )}
            />

            <ProductionMetric
              label="Latest accepted report"
              value={formatDate(
                intelligence.latestAcceptedReportDate,
              )}
            />

            <ProductionMetric
              label="Reporting status"
              value={
                intelligence.reportingStale
                  ? "Stale"
                  : "Current"
              }
            />
          </div>

          <p>
            {intelligence.explanation}
          </p>
        </section>

        <section className="production-actions">
          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                "package",
              )
            }
          >
            + Work package
          </button>

          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                "report",
              )
            }
          >
            + Site report
          </button>

          <button
            type="button"
            disabled={
              draftReports.length ===
                0
              ||
              productionPackages.length ===
                0
            }
            onClick={
              openProductionEntry
            }
          >
            + Production entry
          </button>
        </section>

        {openPanel ===
          "package" && (
          <Panel
            title="Create work package"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="production-form"
              onSubmit={
                submitPackage
              }
            >
              <label>
                <span>
                  Package code
                </span>

                <input
                  required
                  value={
                    packageForm.code
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      code:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Unit
                </span>

                <input
                  required
                  value={
                    packageForm.unit
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      unit:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label className="field-wide">
                <span>
                  Package name
                </span>

                <input
                  required
                  value={
                    packageForm.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      name:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Planned quantity
                </span>

                <input
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  value={
                    packageForm.plannedQuantity
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      plannedQuantity:
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
                  Planned labor hours
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    packageForm.plannedLaborHours
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      plannedLaborHours:
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
                  Planned start
                </span>

                <input
                  required
                  type="date"
                  value={
                    packageForm.plannedStartDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      plannedStartDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Planned finish
                </span>

                <input
                  required
                  type="date"
                  value={
                    packageForm.plannedEndDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      plannedEndDate:
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
                    packageForm.description
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
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
          </Panel>
        )}

        {openPanel ===
          "report" && (
          <Panel
            title="Create daily site report"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="production-form"
              onSubmit={
                submitReport
              }
            >
              <label>
                <span>
                  Report reference
                </span>

                <input
                  required
                  value={
                    reportForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setReportForm({
                      ...reportForm,
                      reference:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Report date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    reportForm.reportDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setReportForm({
                      ...reportForm,
                      reportDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Weather
                </span>

                <select
                  value={
                    reportForm.weatherCondition
                  }
                  onChange={(
                    event,
                  ) =>
                    setReportForm({
                      ...reportForm,
                      weatherCondition:
                        event.target
                          .value as WeatherCondition,
                    })
                  }
                >
                  {(
                    Object.keys(
                      weatherLabels,
                    ) as WeatherCondition[]
                  ).map(
                    (
                      weather,
                    ) => (
                      <option
                        key={
                          weather
                        }
                        value={
                          weather
                        }
                      >
                        {
                          weatherLabels[
                            weather
                          ]
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label className="field-full">
                <span>
                  General site notes
                </span>

                <textarea
                  rows={5}
                  value={
                    reportForm.generalNotes
                  }
                  onChange={(
                    event,
                  ) =>
                    setReportForm({
                      ...reportForm,
                      generalNotes:
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
          "production" && (
          <Panel
            title="Record daily production"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="production-form"
              onSubmit={
                submitProduction
              }
            >
              <label>
                <span>
                  Draft site report
                </span>

                <select
                  required
                  value={
                    selectedReportId
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedReportId(
                      event.target
                        .value,
                    )
                  }
                >
                  {draftReports.map(
                    (
                      report,
                    ) => (
                      <option
                        key={
                          report.id
                        }
                        value={
                          report.id
                        }
                      >
                        {
                          report.reference
                        }
                        {" — "}
                        {formatDate(
                          report.reportDate,
                        )}
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Work package
                </span>

                <select
                  required
                  value={
                    productionForm.workPackageId
                  }
                  onChange={(
                    event,
                  ) =>
                    setProductionForm({
                      ...productionForm,
                      workPackageId:
                        event.target
                          .value,
                    })
                  }
                >
                  {productionPackages.map(
                    (
                      packageItem,
                    ) => (
                      <option
                        key={
                          packageItem.id
                        }
                        value={
                          packageItem.id
                        }
                      >
                        {
                          packageItem.code
                        }
                        {" — "}
                        {
                          packageItem.name
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Quantity completed
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.001"
                  value={
                    productionForm.quantityCompleted
                  }
                  onChange={(
                    event,
                  ) =>
                    setProductionForm({
                      ...productionForm,
                      quantityCompleted:
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
                  Labor hours
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    productionForm.laborHours
                  }
                  onChange={(
                    event,
                  ) =>
                    setProductionForm({
                      ...productionForm,
                      laborHours:
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
                  Equipment hours
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    productionForm.equipmentHours
                  }
                  onChange={(
                    event,
                  ) =>
                    setProductionForm({
                      ...productionForm,
                      equipmentHours:
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
                  Crew size
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={
                    productionForm.crewSize
                  }
                  onChange={(
                    event,
                  ) =>
                    setProductionForm({
                      ...productionForm,
                      crewSize:
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
                  Production notes
                </span>

                <textarea
                  rows={4}
                  value={
                    productionForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setProductionForm({
                      ...productionForm,
                      notes:
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

        <section
          className="production-card"
          id="packages"
        >
          <div className="production-card-header">
            <div>
              <div className="eyebrow">
                WORK PACKAGE CONTROL
              </div>

              <h2>
                Work packages
              </h2>
            </div>

            <strong>
              {
                workPackages.length
              }{" "}
              packages
            </strong>
          </div>

          <div className="production-table-wrapper">
            <table className="production-table">
              <thead>
                <tr>
                  <th>PACKAGE</th>
                  <th>PLAN</th>
                  <th>ACTUAL</th>
                  <th>COMPLETE</th>
                  <th>EXPECTED</th>
                  <th>VARIANCE</th>
                  <th>LABOR</th>
                  <th>PRODUCTIVITY</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {workPackages.map(
                  (
                    packageItem,
                  ) => (
                    <tr
                      key={
                        packageItem.id
                      }
                    >
                      <td>
                        <div className="production-package-cell">
                          <strong>
                            {
                              packageItem.code
                            }
                          </strong>

                          <span>
                            {
                              packageItem.name
                            }
                          </span>

                          {packageItem.blockReason && (
                            <small>
                              {
                                packageItem.blockReason
                              }
                            </small>
                          )}
                        </div>
                      </td>

                      <td>
                        {quantity(
                          Number(
                            packageItem.plannedQuantity,
                          ),
                        )}{" "}
                        {packageItem.unit}
                      </td>

                      <td>
                        <strong>
                          {quantity(
                            Number(
                              packageItem.actualQuantity,
                            ),
                          )}{" "}
                          {packageItem.unit}
                        </strong>
                      </td>

                      <td>
                        <div className="production-progress">
                          <strong>
                            {packageItem.completionPercentage.toFixed(
                              1,
                            )}
                            %
                          </strong>

                          <div>
                            <span
                              style={{
                                width: `${Math.min(
                                  100,
                                  packageItem.completionPercentage,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td>
                        {packageItem.expectedProgressPercentage.toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        <span
                          className={
                            Number(
                              packageItem.quantityVariance,
                            ) >= 0
                              ? "production-positive"
                              : "production-negative"
                          }
                        >
                          {Number(
                            packageItem.quantityVariance,
                          ) > 0
                            ? "+"
                            : ""}
                          {quantity(
                            Number(
                              packageItem.quantityVariance,
                            ),
                          )}
                        </span>
                      </td>

                      <td>
                        {hours(
                          Number(
                            packageItem.actualLaborHours,
                          ),
                        )}
                      </td>

                      <td>
                        <strong>
                          {packageItem.productivityIndex.toFixed(
                            2,
                          )}
                        </strong>
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            packageItem.status
                          }
                          className={
                            packageClass(
                              packageItem.status,
                            )
                          }
                          onChange={(
                            event,
                          ) =>
                            void changePackageStatus(
                              packageItem,
                              event.target
                                .value as WorkPackageStatus,
                            )
                          }
                        >
                          {packageStatusOptions(
                            packageItem.status,
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
                                  packageStatusLabels[
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

                {workPackages.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        9
                      }
                    >
                      <div className="table-message">
                        No work packages established yet.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="production-card"
          id="reports"
        >
          <div className="production-card-header">
            <div>
              <div className="eyebrow">
                DAILY SITE CONTROL
              </div>

              <h2>
                Site reports
              </h2>
            </div>

            <strong>
              {
                siteReports.length
              }{" "}
              reports
            </strong>
          </div>

          <div className="production-table-wrapper">
            <table className="production-table">
              <thead>
                <tr>
                  <th>REPORT</th>
                  <th>DATE</th>
                  <th>WEATHER</th>
                  <th>ENTRIES</th>
                  <th>LABOR HOURS</th>
                  <th>EQUIPMENT HOURS</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {siteReports.map(
                  (
                    report,
                  ) => (
                    <tr
                      key={
                        report.id
                      }
                    >
                      <td>
                        <div className="production-package-cell">
                          <strong>
                            {
                              report.reference
                            }
                          </strong>

                          <span>
                            {report.generalNotes ??
                              "Daily site report"}
                          </span>
                        </div>
                      </td>

                      <td>
                        {formatDate(
                          report.reportDate,
                        )}
                      </td>

                      <td>
                        {
                          weatherLabels[
                            report.weatherCondition
                          ]
                        }
                      </td>

                      <td>
                        {
                          report.entryCount
                        }
                      </td>

                      <td>
                        {hours(
                          Number(
                            report.totalLaborHours,
                          ),
                        )}
                      </td>

                      <td>
                        {hours(
                          Number(
                            report.totalEquipmentHours,
                          ),
                        )}
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            report.status
                          }
                          className={
                            reportClass(
                              report.status,
                            )
                          }
                          onChange={(
                            event,
                          ) =>
                            void changeReportStatus(
                              report,
                              event.target
                                .value as SiteReportStatus,
                            )
                          }
                        >
                          {reportStatusOptions(
                            report.status,
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
                                  reportStatusLabels[
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

                {siteReports.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        7
                      }
                    >
                      <div className="table-message">
                        No site reports recorded yet.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="production-card"
          id="entries"
        >
          <div className="production-card-header">
            <div>
              <div className="eyebrow">
                PRODUCTION LEDGER
              </div>

              <h2>
                Daily production entries
              </h2>
            </div>

            <strong>
              {
                productionEntries.length
              }{" "}
              entries
            </strong>
          </div>

          <div className="production-table-wrapper">
            <table className="production-table">
              <thead>
                <tr>
                  <th>REPORT</th>
                  <th>DATE</th>
                  <th>WORK PACKAGE</th>
                  <th>QUANTITY</th>
                  <th>LABOR</th>
                  <th>EQUIPMENT</th>
                  <th>CREW</th>
                  <th>PRODUCTIVITY</th>
                </tr>
              </thead>

              <tbody>
                {productionEntries.map(
                  (
                    entry,
                  ) => {
                    const productivity =
                      Number(
                        entry.laborHours,
                      ) > 0
                        ? Number(
                            entry.quantityCompleted,
                          )
                          /
                          Number(
                            entry.laborHours,
                          )
                        : 0;

                    return (
                      <tr
                        key={
                          entry.id
                        }
                      >
                        <td>
                          <strong>
                            {
                              entry.siteReportReference
                            }
                          </strong>
                        </td>

                        <td>
                          {formatDate(
                            entry.reportDate,
                          )}
                        </td>

                        <td>
                          <div className="production-package-cell">
                            <strong>
                              {
                                entry.workPackageCode
                              }
                            </strong>

                            <span>
                              {
                                entry.workPackageName
                              }
                            </span>
                          </div>
                        </td>

                        <td>
                          {quantity(
                            Number(
                              entry.quantityCompleted,
                            ),
                          )}{" "}
                          {entry.unit}
                        </td>

                        <td>
                          {hours(
                            Number(
                              entry.laborHours,
                            ),
                          )}
                        </td>

                        <td>
                          {hours(
                            Number(
                              entry.equipmentHours,
                            ),
                          )}
                        </td>

                        <td>
                          {
                            entry.crewSize
                          }
                        </td>

                        <td>
                          {productivity.toFixed(
                            3,
                          )}{" "}
                          {entry.unit}/hr
                        </td>
                      </tr>
                    );
                  },
                )}

                {productionEntries.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        8
                      }
                    >
                      <div className="table-message">
                        No production entries recorded yet.
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
            BuildSight · Production Intelligence
          </div>

          <div>
            {workPackages.length} work packages
            {" · "}
            {siteReports.length} site reports
          </div>
        </footer>
      </main>
    </div>
  );
}

function ProductionKpi({
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
          ? "production-kpi production-kpi-emphasis"
          : "production-kpi"
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

function ProductionMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="production-intelligence-metric">
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
    <section className="production-form-panel">
      <div className="production-card-header">
        <div>
          <div className="eyebrow">
            SITE CONTROL INPUT
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
