"use client";

import Link from "next/link";

import {
  type FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BuildSightApiError,
  awardProcurementPackage,
  createProcurementBid,
  createProcurementPackage,
  createSupplier,
  createSupplierPerformanceEvaluation,
  getProjectProcurement,
  updateProcurementPackage,
  updateSupplier,
} from "@/lib/api";

import type {
  AwardProcurementPackageInput,
  CreateProcurementBidInput,
  CreateProcurementPackageInput,
  CreateSupplierInput,
  CreateSupplierPerformanceEvaluationInput,
  ProcurementControl,
  ProcurementPackage,
  ProcurementPackageStatus,
  ProcurementRiskLevel,
  Supplier,
  SupplierQualificationStatus,
  SupplierType,
} from "@/types/project";

type OpenPanel =
  | "supplier"
  | "package"
  | "bid"
  | "award"
  | "performance"
  | null;

const qualificationLabels: Record<
  SupplierQualificationStatus,
  string
> = {
  PENDING: "Pending",
  QUALIFIED: "Qualified",
  CONDITIONAL: "Conditional",
  SUSPENDED: "Suspended",
  REJECTED: "Rejected",
};

const supplierTypeLabels: Record<
  SupplierType,
  string
> = {
  SUPPLIER: "Supplier",
  SUBCONTRACTOR: "Subcontractor",
  CONSULTANT: "Consultant",
};

const packageStatusLabels: Record<
  ProcurementPackageStatus,
  string
> = {
  PLANNING: "Planning",
  TENDERING: "Tendering",
  EVALUATION: "Evaluation",
  AWARDED: "Awarded",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

const procurementRiskLabels: Record<
  ProcurementRiskLevel,
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
  risk: ProcurementRiskLevel,
): string {
  return `procurement-risk procurement-risk-${risk
    .toLowerCase()
    .replace("_", "-")}`;
}

function qualificationClass(
  status: SupplierQualificationStatus,
): string {
  return `supplier-qualification supplier-${status.toLowerCase()}`;
}

function packageClass(
  status: ProcurementPackageStatus,
): string {
  return `procurement-package-status procurement-${status.toLowerCase()}`;
}

function permittedPackageStatuses(
  current: ProcurementPackageStatus,
): ProcurementPackageStatus[] {
  switch (current) {
    case "PLANNING":
      return [
        "PLANNING",
        "TENDERING",
        "CANCELLED",
      ];

    case "TENDERING":
      return [
        "TENDERING",
        "EVALUATION",
        "CANCELLED",
      ];

    case "EVALUATION":
      return [
        "EVALUATION",
        "TENDERING",
        "CANCELLED",
      ];

    case "AWARDED":
      return [
        "AWARDED",
        "CLOSED",
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

const supplierDefaults: CreateSupplierInput = {
  code: "",
  name: "",
  supplierType: "SUBCONTRACTOR",
  trade: "",
  country: "",
  contactPerson: "",
  email: "",
  qualificationStatus: "PENDING",
};

const packageDefaults: CreateProcurementPackageInput = {
  costCodeId: "",
  reference: "",
  title: "",
  description: "",
  estimatedValue: 0,
  plannedIssueDate: todayValue(),
  bidDueDate: todayValue(),
  awardDueDate: todayValue(),
  forecastAwardDate: null,
  requiredOnSiteDate: todayValue(),
};

const bidDefaults: CreateProcurementBidInput = {
  supplierId: "",
  bidAmount: 0,
  submittedDate: todayValue(),
  technicalScore: 70,
  commercialScore: 70,
  deliveryDays: 30,
  notes: "",
};

const performanceDefaults:
  CreateSupplierPerformanceEvaluationInput = {
    supplierId: "",
    procurementPackageId: null,
    evaluationDate: todayValue(),
    qualityScore: 80,
    deliveryScore: 80,
    safetyScore: 80,
    commercialScore: 80,
    comments: "",
  };

export function ProjectProcurementView({
  projectId,
}: {
  projectId: string;
}) {
  const [data, setData] =
    useState<ProcurementControl | null>(
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

  const [
    supplierForm,
    setSupplierForm,
  ] =
    useState<CreateSupplierInput>(
      supplierDefaults,
    );

  const [
    packageForm,
    setPackageForm,
  ] =
    useState<CreateProcurementPackageInput>(
      packageDefaults,
    );

  const [
    bidForm,
    setBidForm,
  ] =
    useState<CreateProcurementBidInput>(
      bidDefaults,
    );

  const [
    performanceForm,
    setPerformanceForm,
  ] =
    useState<CreateSupplierPerformanceEvaluationInput>(
      performanceDefaults,
    );

  const [
    selectedPackageId,
    setSelectedPackageId,
  ] =
    useState(
      "",
    );

  const [
    awardPackageId,
    setAwardPackageId,
  ] =
    useState(
      "",
    );

  const [
    awardForm,
    setAwardForm,
  ] =
    useState<AwardProcurementPackageInput>({
      version: 0,
      selectedBidId: "",
      awardedValue: 0,
      awardDate: todayValue(),
    });

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectProcurement(
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
      await getProjectProcurement(
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

  const tenderPackages =
    useMemo(
      () =>
        data?.packages.filter(
          (
            packageItem,
          ) =>
            packageItem.status
              ===
              "TENDERING"
            ||
            packageItem.status
              ===
              "EVALUATION",
        ) ?? [],
      [
        data,
      ],
    );

  const evaluationPackages =
    useMemo(
      () =>
        data?.packages.filter(
          (
            packageItem,
          ) =>
            packageItem.status
            ===
            "EVALUATION",
        ) ?? [],
      [
        data,
      ],
    );

  const awardedPackages =
    useMemo(
      () =>
        data?.packages.filter(
          (
            packageItem,
          ) =>
            packageItem.awardedSupplierId
            !==
            null,
        ) ?? [],
      [
        data,
      ],
    );

  const awardPackage =
    data?.packages.find(
      (
        packageItem,
      ) =>
        packageItem.id
        ===
        awardPackageId,
    );

  const awardBids =
    data?.bids.filter(
      (
        bid,
      ) =>
        bid.procurementPackageId
          ===
          awardPackageId
        &&
        bid.status
          !==
          "REJECTED",
    ) ?? [];

  function openCreatePackage() {
    setPackageForm({
      ...packageDefaults,
      costCodeId:
        data?.costCodes[
          0
        ]?.id ??
        "",
    });

    setOpenPanel(
      "package",
    );
  }

  function openCreateBid() {
    const packageId =
      tenderPackages[
        0
      ]?.id ??
      "";

    setSelectedPackageId(
      packageId,
    );

    setBidForm({
      ...bidDefaults,
      supplierId:
        data?.suppliers[
          0
        ]?.id ??
        "",
      submittedDate:
        todayValue(),
    });

    setOpenPanel(
      "bid",
    );
  }

  function openAward(
    packageItem: ProcurementPackage,
  ) {
    const packageBids =
      data?.bids.filter(
        (
          bid,
        ) =>
          bid.procurementPackageId
          ===
          packageItem.id
        &&
          bid.status
          !==
          "REJECTED",
      ) ?? [];

    const firstBid =
      packageBids[
        0
      ];

    setAwardPackageId(
      packageItem.id,
    );

    setAwardForm({
      version:
        packageItem.version,
      selectedBidId:
        firstBid?.id ??
        "",
      awardedValue:
        firstBid
          ? Number(
              firstBid.bidAmount,
            )
          : Number(
              packageItem.estimatedValue,
            ),
      awardDate:
        todayValue(),
    });

    setOpenPanel(
      "award",
    );
  }

  function openPerformance() {
    const packageItem =
      awardedPackages[
        0
      ];

    setPerformanceForm({
      ...performanceDefaults,
      procurementPackageId:
        packageItem?.id ??
        null,
      supplierId:
        packageItem?.awardedSupplierId ??
        "",
      evaluationDate:
        todayValue(),
    });

    setOpenPanel(
      "performance",
    );
  }

  async function submitSupplier(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createSupplier(
            supplierForm,
          ),
      );

    if (
      ok
    ) {
      setSupplierForm(
        supplierDefaults,
      );

      setOpenPanel(
        null,
      );
    }
  }

  async function submitPackage(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createProcurementPackage(
            projectId,
            packageForm,
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

  async function submitBid(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !selectedPackageId
    ) {
      return;
    }

    const ok =
      await runAction(
        () =>
          createProcurementBid(
            projectId,
            selectedPackageId,
            bidForm,
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

  async function submitAward(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !awardPackageId
    ) {
      return;
    }

    const ok =
      await runAction(
        () =>
          awardProcurementPackage(
            projectId,
            awardPackageId,
            awardForm,
          ),
      );

    if (
      ok
    ) {
      setOpenPanel(
        null,
      );

      setAwardPackageId(
        "",
      );
    }
  }

  async function submitPerformance(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const ok =
      await runAction(
        () =>
          createSupplierPerformanceEvaluation(
            projectId,
            performanceForm,
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

  async function changeSupplierQualification(
    supplier: Supplier,
    qualificationStatus: SupplierQualificationStatus,
  ) {
    if (
      supplier.qualificationStatus
      ===
      qualificationStatus
    ) {
      return;
    }

    await runAction(
      () =>
        updateSupplier(
          supplier.id,
          {
            version:
              supplier.version,
            name:
              supplier.name,
            supplierType:
              supplier.supplierType,
            trade:
              supplier.trade ??
              "",
            country:
              supplier.country ??
              "",
            contactPerson:
              supplier.contactPerson ??
              "",
            email:
              supplier.email ??
              "",
            qualificationStatus,
          },
        ),
    );
  }

  async function changePackageStatus(
    packageItem: ProcurementPackage,
    status: ProcurementPackageStatus,
  ) {
    if (
      packageItem.status
      ===
      status
    ) {
      return;
    }

    await runAction(
      () =>
        updateProcurementPackage(
          projectId,
          packageItem.id,
          {
            version:
              packageItem.version,
            title:
              packageItem.title,
            description:
              packageItem.description ??
              "",
            estimatedValue:
              Number(
                packageItem.estimatedValue,
              ),
            plannedIssueDate:
              packageItem.plannedIssueDate,
            bidDueDate:
              packageItem.bidDueDate,
            awardDueDate:
              packageItem.awardDueDate,
            forecastAwardDate:
              packageItem.forecastAwardDate,
            requiredOnSiteDate:
              packageItem.requiredOnSiteDate,
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
          Loading procurement intelligence...
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
            Procurement unavailable
          </h1>

          <p>
            {error ||
              "BuildSight could not load procurement data."}
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
    suppliers,
    packages,
    bids,
    evaluations,
    costCodes,
  } = data;

  return (
    <div className="procurement-shell">
      <aside className="procurement-sidebar">
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
          PROCUREMENT CONTROL
        </div>

        <nav className="command-navigation">
          <Link
            href={`/projects/${projectId}`}
            className="command-nav-item"
          >
            01
            <span>
              Command center
            </span>
          </Link>

          <Link
            href={`/projects/${projectId}/costs`}
            className="command-nav-item"
          >
            02
            <span>
              Cost control
            </span>
          </Link>

          <div className="command-nav-item active">
            03
            <span>
              Procurement
            </span>
          </div>

          <a
            href="#packages"
            className="command-nav-item"
          >
            04
            <span>
              Packages
            </span>
          </a>

          <a
            href="#bids"
            className="command-nav-item"
          >
            05
            <span>
              Bids
            </span>
          </a>

          <a
            href="#suppliers"
            className="command-nav-item"
          >
            06
            <span>
              Suppliers
            </span>
          </a>

          <a
            href="#performance"
            className="command-nav-item"
          >
            07
            <span>
              Performance
            </span>
          </a>
        </nav>

        <div className="command-sidebar-footer">
          <span>
            PROCUREMENT PROJECT
          </span>

          <strong>
            {project.code}
          </strong>

          <small>
            Tendering, awards, qualification
            and subcontractor performance.
          </small>
        </div>
      </aside>

      <main className="procurement-main">
        <header className="procurement-topbar">
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
              PROCUREMENT INTELLIGENCE
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Supplier qualification, tender
              competition, award governance,
              procurement lead times and
              supplier performance.
            </p>
          </div>

          <div className="procurement-score">
            <span>
              PROCUREMENT HEALTH
            </span>

            <strong>
              {intelligence.procurementScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={
                riskClass(
                  intelligence.procurementRisk,
                )
              }
            >
              {
                procurementRiskLabels[
                  intelligence.procurementRisk
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

        <section className="procurement-kpi-grid">
          <ProcurementKpi
            label="PROCUREMENT VALUE"
            value={compactMoney(
              Number(
                intelligence.totalEstimatedValue,
              ),
            )}
            detail={`${intelligence.totalPackages} packages`}
          />

          <ProcurementKpi
            label="AWARDED VALUE"
            value={compactMoney(
              Number(
                intelligence.totalAwardedValue,
              ),
            )}
            detail={`${intelligence.awardedPackages} awarded packages`}
          />

          <ProcurementKpi
            label="DELAYED AWARDS"
            value={String(
              intelligence.delayedPackages,
            )}
            detail={`Maximum delay ${intelligence.maximumAwardDelayDays} days`}
          />

          <ProcurementKpi
            label="TENDER COMPETITION"
            value={`${intelligence.competitionCoveragePercentage.toFixed(
              0,
            )}%`}
            detail="Packages with 2+ bids"
            emphasis
          />
        </section>

        <section className="procurement-intelligence-card">
          <div className="procurement-intelligence-score">
            <span>
              PROCUREMENT SCORE
            </span>

            <strong>
              {intelligence.procurementScore.toFixed(
                0,
              )}
            </strong>

            <small>
              /100
            </small>
          </div>

          <div className="procurement-intelligence-grid">
            <ProcurementMetric
              label="Open packages"
              value={String(
                intelligence.openPackages,
              )}
            />

            <ProcurementMetric
              label="Delayed packages"
              value={String(
                intelligence.delayedPackages,
              )}
            />

            <ProcurementMetric
              label="Conditional awards"
              value={String(
                intelligence.conditionalAwards,
              )}
            />

            <ProcurementMetric
              label="Supplier performance"
              value={`${intelligence.averageSupplierPerformance.toFixed(
                1,
              )}/100`}
            />

            <ProcurementMetric
              label="Low-performance evaluations"
              value={String(
                intelligence.lowPerformanceEvaluations,
              )}
            />

            <ProcurementMetric
              label="Competitive packages"
              value={String(
                intelligence.packagesWithCompetitiveCoverage,
              )}
            />
          </div>

          <p>
            {intelligence.explanation}
          </p>
        </section>

        <section className="procurement-actions">
          <button
            type="button"
            onClick={() =>
              setOpenPanel(
                "supplier",
              )
            }
          >
            + Supplier
          </button>

          <button
            type="button"
            disabled={
              costCodes.length
              ===
              0
            }
            onClick={
              openCreatePackage
            }
          >
            + Procurement package
          </button>

          <button
            type="button"
            disabled={
              tenderPackages.length
                ===
                0
              ||
              suppliers.length
                ===
                0
            }
            onClick={
              openCreateBid
            }
          >
            + Bid
          </button>

          <button
            type="button"
            disabled={
              awardedPackages.length
              ===
              0
            }
            onClick={
              openPerformance
            }
          >
            + Performance evaluation
          </button>
        </section>

        {openPanel ===
          "supplier" && (
          <Panel
            title="Register supplier or subcontractor"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="procurement-form"
              onSubmit={
                submitSupplier
              }
            >
              <label>
                <span>
                  Supplier code
                </span>

                <input
                  required
                  value={
                    supplierForm.code
                  }
                  onChange={(
                    event,
                  ) =>
                    setSupplierForm({
                      ...supplierForm,
                      code:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Company name
                </span>

                <input
                  required
                  value={
                    supplierForm.name
                  }
                  onChange={(
                    event,
                  ) =>
                    setSupplierForm({
                      ...supplierForm,
                      name:
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
                    supplierForm.supplierType
                  }
                  onChange={(
                    event,
                  ) =>
                    setSupplierForm({
                      ...supplierForm,
                      supplierType:
                        event.target
                          .value as SupplierType,
                    })
                  }
                >
                  {(
                    Object.keys(
                      supplierTypeLabels,
                    ) as SupplierType[]
                  ).map(
                    (
                      type,
                    ) => (
                      <option
                        value={
                          type
                        }
                        key={
                          type
                        }
                      >
                        {
                          supplierTypeLabels[
                            type
                          ]
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Qualification
                </span>

                <select
                  value={
                    supplierForm.qualificationStatus
                  }
                  onChange={(
                    event,
                  ) =>
                    setSupplierForm({
                      ...supplierForm,
                      qualificationStatus:
                        event.target
                          .value as SupplierQualificationStatus,
                    })
                  }
                >
                  {(
                    Object.keys(
                      qualificationLabels,
                    ) as SupplierQualificationStatus[]
                  ).map(
                    (
                      qualification,
                    ) => (
                      <option
                        key={
                          qualification
                        }
                        value={
                          qualification
                        }
                      >
                        {
                          qualificationLabels[
                            qualification
                          ]
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Trade
                </span>

                <input
                  value={
                    supplierForm.trade
                  }
                  onChange={(
                    event,
                  ) =>
                    setSupplierForm({
                      ...supplierForm,
                      trade:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Country
                </span>

                <input
                  value={
                    supplierForm.country
                  }
                  onChange={(
                    event,
                  ) =>
                    setSupplierForm({
                      ...supplierForm,
                      country:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Contact
                </span>

                <input
                  value={
                    supplierForm.contactPerson
                  }
                  onChange={(
                    event,
                  ) =>
                    setSupplierForm({
                      ...supplierForm,
                      contactPerson:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Email
                </span>

                <input
                  type="email"
                  value={
                    supplierForm.email
                  }
                  onChange={(
                    event,
                  ) =>
                    setSupplierForm({
                      ...supplierForm,
                      email:
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
          "package" && (
          <Panel
            title="Create procurement package"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="procurement-form"
              onSubmit={
                submitPackage
              }
            >
              <label>
                <span>
                  Cost code
                </span>

                <select
                  required
                  value={
                    packageForm.costCodeId
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      costCodeId:
                        event.target
                          .value,
                    })
                  }
                >
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

              <label>
                <span>
                  Package reference
                </span>

                <input
                  required
                  value={
                    packageForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      reference:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label className="field-wide">
                <span>
                  Package title
                </span>

                <input
                  required
                  value={
                    packageForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      title:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Estimated value
                </span>

                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    packageForm.estimatedValue
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      estimatedValue:
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
                  Planned issue
                </span>

                <input
                  required
                  type="date"
                  value={
                    packageForm.plannedIssueDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      plannedIssueDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Bid due
                </span>

                <input
                  required
                  type="date"
                  value={
                    packageForm.bidDueDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      bidDueDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Award due
                </span>

                <input
                  required
                  type="date"
                  value={
                    packageForm.awardDueDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      awardDueDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Forecast award
                </span>

                <input
                  type="date"
                  value={
                    packageForm.forecastAwardDate ??
                    ""
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      forecastAwardDate:
                        event.target
                            .value
                          ||
                          null,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Required on site
                </span>

                <input
                  required
                  type="date"
                  value={
                    packageForm.requiredOnSiteDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setPackageForm({
                      ...packageForm,
                      requiredOnSiteDate:
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
          "bid" && (
          <Panel
            title="Record tender bid"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="procurement-form"
              onSubmit={
                submitBid
              }
            >
              <label>
                <span>
                  Procurement package
                </span>

                <select
                  required
                  value={
                    selectedPackageId
                  }
                  onChange={(
                    event,
                  ) =>
                    setSelectedPackageId(
                      event.target
                        .value,
                    )
                  }
                >
                  {tenderPackages.map(
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
                          packageItem.reference
                        }
                        {" — "}
                        {
                          packageItem.title
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Supplier
                </span>

                <select
                  required
                  value={
                    bidForm.supplierId
                  }
                  onChange={(
                    event,
                  ) =>
                    setBidForm({
                      ...bidForm,
                      supplierId:
                        event.target
                          .value,
                    })
                  }
                >
                  {suppliers
                    .filter(
                      (
                        supplier,
                      ) =>
                        supplier.qualificationStatus
                          !==
                          "SUSPENDED"
                        &&
                        supplier.qualificationStatus
                          !==
                          "REJECTED",
                    )
                    .map(
                      (
                        supplier,
                      ) => (
                        <option
                          key={
                            supplier.id
                          }
                          value={
                            supplier.id
                          }
                        >
                          {
                            supplier.code
                          }
                          {" — "}
                          {
                            supplier.name
                          }
                        </option>
                      ),
                    )}
                </select>
              </label>

              <label>
                <span>
                  Bid amount
                </span>

                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    bidForm.bidAmount
                  }
                  onChange={(
                    event,
                  ) =>
                    setBidForm({
                      ...bidForm,
                      bidAmount:
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
                  Submitted date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    bidForm.submittedDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setBidForm({
                      ...bidForm,
                      submittedDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label>
                <span>
                  Technical score
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={
                    bidForm.technicalScore
                  }
                  onChange={(
                    event,
                  ) =>
                    setBidForm({
                      ...bidForm,
                      technicalScore:
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
                  Commercial score
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={
                    bidForm.commercialScore
                  }
                  onChange={(
                    event,
                  ) =>
                    setBidForm({
                      ...bidForm,
                      commercialScore:
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
                  Delivery days
                </span>

                <input
                  required
                  type="number"
                  min="0"
                  step="1"
                  value={
                    bidForm.deliveryDays
                  }
                  onChange={(
                    event,
                  ) =>
                    setBidForm({
                      ...bidForm,
                      deliveryDays:
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
                  Notes
                </span>

                <textarea
                  rows={3}
                  value={
                    bidForm.notes
                  }
                  onChange={(
                    event,
                  ) =>
                    setBidForm({
                      ...bidForm,
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

        {openPanel ===
          "award" &&
          awardPackage && (
          <Panel
            title={`Award ${awardPackage.reference}`}
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="procurement-form"
              onSubmit={
                submitAward
              }
            >
              <label className="field-wide">
                <span>
                  Selected bid
                </span>

                <select
                  required
                  value={
                    awardForm.selectedBidId
                  }
                  onChange={(
                    event,
                  ) => {
                    const bid =
                      awardBids.find(
                        (
                          candidate,
                        ) =>
                          candidate.id
                          ===
                          event.target
                            .value,
                      );

                    setAwardForm({
                      ...awardForm,
                      selectedBidId:
                        event.target
                          .value,
                      awardedValue:
                        bid
                          ? Number(
                              bid.bidAmount,
                            )
                          : awardForm.awardedValue,
                    });
                  }}
                >
                  <option value="">
                    Select bid
                  </option>

                  {awardBids.map(
                    (
                      bid,
                    ) => (
                      <option
                        key={
                          bid.id
                        }
                        value={
                          bid.id
                        }
                      >
                        {
                          bid.supplierName
                        }
                        {" — "}
                        {money(
                          Number(
                            bid.bidAmount,
                          ),
                        )}
                        {" — Score "}
                        {
                          bid.combinedScore
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <label>
                <span>
                  Awarded value
                </span>

                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    awardForm.awardedValue
                  }
                  onChange={(
                    event,
                  ) =>
                    setAwardForm({
                      ...awardForm,
                      awardedValue:
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
                  Award date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    awardForm.awardDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setAwardForm({
                      ...awardForm,
                      awardDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <div className="procurement-award-note field-full">
                Awarding this package automatically
                creates an APPROVED cost commitment
                for the selected supplier.
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
          "performance" && (
          <Panel
            title="Supplier performance evaluation"
            onClose={() =>
              setOpenPanel(
                null,
              )
            }
          >
            <form
              className="procurement-form"
              onSubmit={
                submitPerformance
              }
            >
              <label className="field-wide">
                <span>
                  Awarded package
                </span>

                <select
                  required
                  value={
                    performanceForm.procurementPackageId ??
                    ""
                  }
                  onChange={(
                    event,
                  ) => {
                    const packageItem =
                      awardedPackages.find(
                        (
                          candidate,
                        ) =>
                          candidate.id
                          ===
                          event.target
                            .value,
                      );

                    setPerformanceForm({
                      ...performanceForm,
                      procurementPackageId:
                        packageItem?.id ??
                        null,
                      supplierId:
                        packageItem?.awardedSupplierId ??
                        "",
                    });
                  }}
                >
                  {awardedPackages.map(
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
                          packageItem.reference
                        }
                        {" — "}
                        {
                          packageItem.awardedSupplierName
                        }
                      </option>
                    ),
                  )}
                </select>
              </label>

              <ScoreInput
                label="Quality"
                value={
                  performanceForm.qualityScore
                }
                onChange={(
                  value,
                ) =>
                  setPerformanceForm({
                    ...performanceForm,
                    qualityScore:
                      value,
                  })
                }
              />

              <ScoreInput
                label="Delivery"
                value={
                  performanceForm.deliveryScore
                }
                onChange={(
                  value,
                ) =>
                  setPerformanceForm({
                    ...performanceForm,
                    deliveryScore:
                      value,
                  })
                }
              />

              <ScoreInput
                label="Safety"
                value={
                  performanceForm.safetyScore
                }
                onChange={(
                  value,
                ) =>
                  setPerformanceForm({
                    ...performanceForm,
                    safetyScore:
                      value,
                  })
                }
              />

              <ScoreInput
                label="Commercial"
                value={
                  performanceForm.commercialScore
                }
                onChange={(
                  value,
                ) =>
                  setPerformanceForm({
                    ...performanceForm,
                    commercialScore:
                      value,
                  })
                }
              />

              <label>
                <span>
                  Evaluation date
                </span>

                <input
                  required
                  type="date"
                  max={
                    todayValue()
                  }
                  value={
                    performanceForm.evaluationDate
                  }
                  onChange={(
                    event,
                  ) =>
                    setPerformanceForm({
                      ...performanceForm,
                      evaluationDate:
                        event.target
                          .value,
                    })
                  }
                />
              </label>

              <label className="field-full">
                <span>
                  Comments
                </span>

                <textarea
                  rows={3}
                  value={
                    performanceForm.comments
                  }
                  onChange={(
                    event,
                  ) =>
                    setPerformanceForm({
                      ...performanceForm,
                      comments:
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
          className="procurement-card"
          id="packages"
        >
          <div className="procurement-card-header">
            <div>
              <div className="eyebrow">
                PROCUREMENT PLAN
              </div>

              <h2>
                Procurement packages
              </h2>
            </div>

            <strong>
              {
                packages.length
              }{" "}
              packages
            </strong>
          </div>

          <div className="procurement-table-wrapper">
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>
                    PACKAGE
                  </th>
                  <th>
                    COST CODE
                  </th>
                  <th>
                    VALUE
                  </th>
                  <th>
                    AWARD DUE
                  </th>
                  <th>
                    FORECAST
                  </th>
                  <th>
                    BIDS
                  </th>
                  <th>
                    STATUS
                  </th>
                  <th>
                    AWARD
                  </th>
                </tr>
              </thead>

              <tbody>
                {packages.map(
                  (
                    packageItem,
                  ) => (
                    <tr
                      key={
                        packageItem.id
                      }
                    >
                      <td>
                        <div className="procurement-package-cell">
                          <strong>
                            {
                              packageItem.reference
                            }
                          </strong>

                          <span>
                            {
                              packageItem.title
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {
                          packageItem.costCode
                        }
                      </td>

                      <td>
                        {money(
                          Number(
                            packageItem.estimatedValue,
                          ),
                        )}
                      </td>

                      <td>
                        {formatDate(
                          packageItem.awardDueDate,
                        )}
                      </td>

                      <td>
                        {formatDate(
                          packageItem.forecastAwardDate,
                        )}
                      </td>

                      <td>
                        {
                          packageItem.bidCount
                        }
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
                                .value as ProcurementPackageStatus,
                            )
                          }
                        >
                          {permittedPackageStatuses(
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

                      <td>
                        {packageItem.status
                          ===
                          "EVALUATION" ? (
                          <button
                            type="button"
                            className="table-action-button"
                            disabled={
                              busy
                              ||
                              packageItem.bidCount
                                ===
                                0
                            }
                            onClick={() =>
                              openAward(
                                packageItem,
                              )
                            }
                          >
                            Award
                          </button>
                        ) : packageItem.awardedSupplierName ? (
                          <div className="award-result">
                            <strong>
                              {
                                packageItem.awardedSupplierName
                              }
                            </strong>

                            <span>
                              {packageItem.commitmentReference}
                            </span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ),
                )}

                {packages.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        8
                      }
                    >
                      <div className="table-message">
                        No procurement packages yet.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="procurement-card"
          id="bids"
        >
          <div className="procurement-card-header">
            <div>
              <div className="eyebrow">
                TENDER COMPARISON
              </div>

              <h2>
                Supplier bids
              </h2>
            </div>

            <strong>
              {
                bids.length
              }{" "}
              submissions
            </strong>
          </div>

          <div className="procurement-table-wrapper">
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>
                    PACKAGE
                  </th>
                  <th>
                    SUPPLIER
                  </th>
                  <th>
                    QUALIFICATION
                  </th>
                  <th>
                    BID VALUE
                  </th>
                  <th>
                    TECH.
                  </th>
                  <th>
                    COMM.
                  </th>
                  <th>
                    COMBINED
                  </th>
                  <th>
                    DELIVERY
                  </th>
                  <th>
                    STATUS
                  </th>
                </tr>
              </thead>

              <tbody>
                {bids.map(
                  (
                    bid,
                  ) => (
                    <tr
                      key={
                        bid.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            bid.packageReference
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          bid.supplierName
                        }
                      </td>

                      <td>
                        <span
                          className={
                            qualificationClass(
                              bid.supplierQualificationStatus,
                            )
                          }
                        >
                          {
                            qualificationLabels[
                              bid.supplierQualificationStatus
                            ]
                          }
                        </span>
                      </td>

                      <td>
                        {money(
                          Number(
                            bid.bidAmount,
                          ),
                        )}
                      </td>

                      <td>
                        {
                          Number(
                            bid.technicalScore,
                          ).toFixed(
                            1,
                          )
                        }
                      </td>

                      <td>
                        {
                          Number(
                            bid.commercialScore,
                          ).toFixed(
                            1,
                          )
                        }
                      </td>

                      <td>
                        <strong>
                          {
                            bid.combinedScore
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          bid.deliveryDays
                        }{" "}
                        days
                      </td>

                      <td>
                        <span className={`bid-status bid-${bid.status.toLowerCase()}`}>
                          {
                            bid.status
                          }
                        </span>
                      </td>
                    </tr>
                  ),
                )}

                {bids.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={
                        9
                      }
                    >
                      <div className="table-message">
                        No tender bids recorded.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="procurement-card"
          id="suppliers"
        >
          <div className="procurement-card-header">
            <div>
              <div className="eyebrow">
                SUPPLIER MASTER
              </div>

              <h2>
                Suppliers & subcontractors
              </h2>
            </div>

            <strong>
              {
                suppliers.length
              }{" "}
              organizations
            </strong>
          </div>

          <div className="procurement-table-wrapper">
            <table className="procurement-table">
              <thead>
                <tr>
                  <th>
                    CODE
                  </th>
                  <th>
                    COMPANY
                  </th>
                  <th>
                    TYPE
                  </th>
                  <th>
                    TRADE
                  </th>
                  <th>
                    COUNTRY
                  </th>
                  <th>
                    QUALIFICATION
                  </th>
                </tr>
              </thead>

              <tbody>
                {suppliers.map(
                  (
                    supplier,
                  ) => (
                    <tr
                      key={
                        supplier.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            supplier.code
                          }
                        </strong>
                      </td>

                      <td>
                        {
                          supplier.name
                        }
                      </td>

                      <td>
                        {
                          supplierTypeLabels[
                            supplier.supplierType
                          ]
                        }
                      </td>

                      <td>
                        {supplier.trade ??
                          "—"}
                      </td>

                      <td>
                        {supplier.country ??
                          "—"}
                      </td>

                      <td>
                        <select
                          disabled={
                            busy
                          }
                          value={
                            supplier.qualificationStatus
                          }
                          className={
                            qualificationClass(
                              supplier.qualificationStatus,
                            )
                          }
                          onChange={(
                            event,
                          ) =>
                            void changeSupplierQualification(
                              supplier,
                              event.target
                                .value as SupplierQualificationStatus,
                            )
                          }
                        >
                          {(
                            Object.keys(
                              qualificationLabels,
                            ) as SupplierQualificationStatus[]
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
                                  qualificationLabels[
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
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="procurement-card"
          id="performance"
        >
          <div className="procurement-card-header">
            <div>
              <div className="eyebrow">
                DELIVERY PERFORMANCE
              </div>

              <h2>
                Supplier evaluations
              </h2>
            </div>

            <strong>
              {
                evaluations.length
              }{" "}
              evaluations
            </strong>
          </div>

          <div className="procurement-performance-grid">
            {evaluations.map(
              (
                evaluation,
              ) => (
                <article
                  key={
                    evaluation.id
                  }
                  className="supplier-performance-card"
                >
                  <div className="supplier-performance-top">
                    <div>
                      <strong>
                        {
                          evaluation.supplierName
                        }
                      </strong>

                      <span>
                        {evaluation.packageReference ??
                          "Project evaluation"}
                      </span>
                    </div>

                    <b>
                      {
                        evaluation.overallScore
                      }
                    </b>
                  </div>

                  <div className="supplier-score-grid">
                    <PerformanceScore
                      label="Quality"
                      value={
                        Number(
                          evaluation.qualityScore,
                        )
                      }
                    />

                    <PerformanceScore
                      label="Delivery"
                      value={
                        Number(
                          evaluation.deliveryScore,
                        )
                      }
                    />

                    <PerformanceScore
                      label="Safety"
                      value={
                        Number(
                          evaluation.safetyScore,
                        )
                      }
                    />

                    <PerformanceScore
                      label="Commercial"
                      value={
                        Number(
                          evaluation.commercialScore,
                        )
                      }
                    />
                  </div>

                  <p>
                    {evaluation.comments ??
                      "No comments recorded."}
                  </p>

                  <small>
                    {formatDate(
                      evaluation.evaluationDate,
                    )}
                  </small>
                </article>
              ),
            )}

            {evaluations.length ===
              0 && (
              <div className="empty-procurement-grid">
                No supplier evaluations recorded.
              </div>
            )}
          </div>
        </section>

        <footer className="command-footer">
          <div>
            BuildSight · Procurement Intelligence
          </div>

          <div>
            {suppliers.length} suppliers
            {" · "}
            {packages.length} packages
          </div>
        </footer>
      </main>
    </div>
  );
}

function ProcurementKpi({
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
          ? "procurement-kpi procurement-kpi-emphasis"
          : "procurement-kpi"
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

function ProcurementMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="procurement-metric">
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
    <section className="procurement-form-panel">
      <div className="procurement-card-header">
        <div>
          <div className="eyebrow">
            PROCUREMENT INPUT
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

function ScoreInput({
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
        {label} score
      </span>

      <input
        required
        type="number"
        min="0"
        max="100"
        step="0.01"
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
      />
    </label>
  );
}

function PerformanceScore({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div>
      <span>
        {label}
      </span>

      <strong>
        {value.toFixed(
          0,
        )}
      </strong>
    </div>
  );
}
