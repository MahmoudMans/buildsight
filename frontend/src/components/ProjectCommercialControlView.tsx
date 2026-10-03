"use client";

import Link from "next/link";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import {
  BuildSightApiError,
  createCashflowPeriod,
  createCommercialChangeOrder,
  createCommercialClaim,
  createPaymentCertificate,
  getProjectCommercial,
  updateCashflowPeriod,
  updateCommercialChangeOrder,
  updateCommercialClaim,
  updatePaymentCertificate,
} from "@/lib/api";

import type {
  CashflowPeriod,
  CashflowPeriodStatus,
  CommercialChangeOrder,
  CommercialChangeOrderStatus,
  CommercialClaim,
  CommercialClaimStatus,
  CommercialClaimType,
  CommercialControl,
  CommercialRiskLevel,
  CreateCashflowPeriodInput,
  CreateCommercialChangeOrderInput,
  CreateCommercialClaimInput,
  CreatePaymentCertificateInput,
  PaymentCertificate,
  PaymentCertificateStatus,
} from "@/types/project";

type PanelType =
  | "change"
  | "claim"
  | "certificate"
  | "cashflow"
  | null;

function localDate(
  offsetDays = 0,
): string {
  const value =
    new Date();

  value.setDate(
    value.getDate()
      + offsetDays,
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

function monthStart(): string {
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
    "01",
  ].join("-");
}

function monthEnd(): string {
  const value =
    new Date(
      new Date().getFullYear(),
      new Date().getMonth() + 1,
      0,
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
    new Date(
      `${value}T00:00:00`,
    ),
  );
}

const riskLabels: Record<
  CommercialRiskLevel,
  string
> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const claimTypes: CommercialClaimType[] = [
  "EXTENSION_OF_TIME",
  "LOSS_AND_EXPENSE",
  "VARIATION",
  "DISRUPTION",
  "DELAY",
  "OTHER",
];

const changeDefaults: CreateCommercialChangeOrderInput = {
  reference: "",
  sourceChangeReference: "",
  title: "",
  description: "",
  submittedAmount: 0,
};

const claimDefaults: CreateCommercialClaimInput = {
  reference: "",
  claimType: "VARIATION",
  title: "",
  basis: "",
  claimedAmount: 0,
  claimedDays: 0,
};

const certificateDefaults: CreatePaymentCertificateInput = {
  reference: "",
  periodStart: monthStart(),
  periodEnd: monthEnd(),
  applicationDate: localDate(),
  certificationDueDate: localDate(14),
  applicationAmount: 0,
};

const cashflowDefaults: CreateCashflowPeriodInput = {
  periodStart: monthStart(),
  periodEnd: monthEnd(),
  plannedInflow: 0,
  forecastInflow: 0,
  actualInflow: 0,
  plannedOutflow: 0,
  forecastOutflow: 0,
  actualOutflow: 0,
};

function changeStatuses(
  current: CommercialChangeOrderStatus,
): CommercialChangeOrderStatus[] {
  switch (current) {
    case "DRAFT":
      return [
        "DRAFT",
        "SUBMITTED",
        "VOID",
      ];
    case "SUBMITTED":
      return [
        "SUBMITTED",
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED",
        "VOID",
      ];
    case "UNDER_REVIEW":
      return [
        "UNDER_REVIEW",
        "APPROVED",
        "REJECTED",
        "VOID",
      ];
    default:
      return [current];
  }
}

function claimStatuses(
  current: CommercialClaimStatus,
): CommercialClaimStatus[] {
  switch (current) {
    case "DRAFT":
      return [
        "DRAFT",
        "SUBMITTED",
        "VOID",
      ];
    case "SUBMITTED":
    case "UNDER_REVIEW":
      return [
        current,
        "UNDER_REVIEW",
        "PARTIALLY_APPROVED",
        "APPROVED",
        "REJECTED",
        "VOID",
      ];
    case "PARTIALLY_APPROVED":
    case "APPROVED":
      return [
        current,
        "SETTLED",
      ];
    default:
      return [current];
  }
}

function certificateStatuses(
  current: PaymentCertificateStatus,
): PaymentCertificateStatus[] {
  switch (current) {
    case "DRAFT":
      return [
        "DRAFT",
        "SUBMITTED",
        "VOID",
      ];
    case "SUBMITTED":
      return [
        "SUBMITTED",
        "CERTIFIED",
        "REJECTED",
        "VOID",
      ];
    case "CERTIFIED":
      return [
        "CERTIFIED",
        "PARTIALLY_PAID",
        "PAID",
      ];
    case "PARTIALLY_PAID":
      return [
        "PARTIALLY_PAID",
        "PAID",
      ];
    default:
      return [current];
  }
}

export function ProjectCommercialControlView({
  projectId,
}: {
  projectId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<CommercialControl | null>(
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
    changeForm,
    setChangeForm,
  ] =
    useState(changeDefaults);

  const [
    claimForm,
    setClaimForm,
  ] =
    useState(claimDefaults);

  const [
    certificateForm,
    setCertificateForm,
  ] =
    useState(
      certificateDefaults,
    );

  const [
    cashflowForm,
    setCashflowForm,
  ] =
    useState(
      cashflowDefaults,
    );

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectCommercial(
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
                "BuildSight could not load commercial intelligence.",
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
      await getProjectCommercial(
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
          "The commercial operation failed.",
        );
      }

      return false;

    } finally {
      setBusy(false);
    }
  }

  async function submitChange(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createCommercialChangeOrder(
            projectId,
            changeForm,
          ),
      )
    ) {
      setChangeForm(
        changeDefaults,
      );

      setPanel(null);
    }
  }

  async function submitClaim(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createCommercialClaim(
            projectId,
            claimForm,
          ),
      )
    ) {
      setClaimForm(
        claimDefaults,
      );

      setPanel(null);
    }
  }

  async function submitCertificate(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createPaymentCertificate(
            projectId,
            certificateForm,
          ),
      )
    ) {
      setCertificateForm({
        ...certificateDefaults,
        periodStart:
          monthStart(),
        periodEnd:
          monthEnd(),
        applicationDate:
          localDate(),
        certificationDueDate:
          localDate(14),
      });

      setPanel(null);
    }
  }

  async function submitCashflow(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await runAction(
        () =>
          createCashflowPeriod(
            projectId,
            cashflowForm,
          ),
      )
    ) {
      setCashflowForm({
        ...cashflowDefaults,
        periodStart:
          monthStart(),
        periodEnd:
          monthEnd(),
      });

      setPanel(null);
    }
  }

  async function changeChangeStatus(
    item: CommercialChangeOrder,
    status: CommercialChangeOrderStatus,
  ) {
    if (status === item.status) {
      return;
    }

    let approvedAmount =
      item.approvedAmount;

    if (
      status ===
      "APPROVED"
    ) {
      const value =
        window.prompt(
          "Approved change-order amount",
          String(
            item.assessedAmount ??
              item.submittedAmount,
          ),
        );

      if (value === null) {
        return;
      }

      approvedAmount =
        Number(value);

      if (
        Number.isNaN(
          approvedAmount,
        )
      ) {
        return;
      }
    }

    await runAction(
      () =>
        updateCommercialChangeOrder(
          projectId,
          item.id,
          {
            version:
              item.version,
            sourceChangeReference:
              item.sourceChangeReference,
            title:
              item.title,
            description:
              item.description,
            submittedAmount:
              item.submittedAmount,
            assessedAmount:
              item.assessedAmount,
            approvedAmount,
            submittedDate:
              item.submittedDate ??
              localDate(),
            decisionDueDate:
              item.decisionDueDate ??
              localDate(14),
            status,
          },
        ),
    );
  }

  async function changeClaimStatus(
    item: CommercialClaim,
    status: CommercialClaimStatus,
  ) {
    if (status === item.status) {
      return;
    }

    let awardedAmount =
      item.awardedAmount;

    let awardedDays =
      item.awardedDays;

    if (
      status ===
        "PARTIALLY_APPROVED"
      ||
      status ===
        "APPROVED"
      ||
      status ===
        "SETTLED"
    ) {
      const amount =
        window.prompt(
          "Awarded claim amount",
          String(
            item.assessedAmount ??
              item.claimedAmount,
          ),
        );

      if (amount === null) {
        return;
      }

      awardedAmount =
        Number(amount);

      if (
        Number.isNaN(
          awardedAmount,
        )
      ) {
        return;
      }

      const days =
        window.prompt(
          "Awarded extension days",
          String(
            item.awardedDays,
          ),
        );

      if (days === null) {
        return;
      }

      awardedDays =
        Number(days);

      if (
        Number.isNaN(
          awardedDays,
        )
      ) {
        return;
      }
    }

    await runAction(
      () =>
        updateCommercialClaim(
          projectId,
          item.id,
          {
            version:
              item.version,
            claimType:
              item.claimType,
            title:
              item.title,
            basis:
              item.basis,
            claimedAmount:
              item.claimedAmount,
            assessedAmount:
              item.assessedAmount,
            awardedAmount,
            claimedDays:
              item.claimedDays,
            awardedDays,
            submittedDate:
              item.submittedDate ??
              localDate(),
            responseDueDate:
              item.responseDueDate ??
              localDate(14),
            status,
          },
        ),
    );
  }

  async function changeCertificateStatus(
    item: PaymentCertificate,
    status: PaymentCertificateStatus,
  ) {
    if (status === item.status) {
      return;
    }

    let certified =
      item.certifiedAmount;

    let retention =
      item.retentionAmount ??
      0;

    let paymentDue =
      item.paymentDueDate;

    let amountPaid =
      item.amountPaid;

    if (
      status ===
        "CERTIFIED"
      ||
      status ===
        "PARTIALLY_PAID"
      ||
      status ===
        "PAID"
    ) {
      const certifiedInput =
        window.prompt(
          "Certified gross amount",
          String(
            certified ??
              item.applicationAmount,
          ),
        );

      if (certifiedInput === null) {
        return;
      }

      certified =
        Number(
          certifiedInput,
        );

      if (
        Number.isNaN(
          certified,
        )
      ) {
        return;
      }

      const retentionInput =
        window.prompt(
          "Retention amount",
          String(retention),
        );

      if (retentionInput === null) {
        return;
      }

      retention =
        Number(
          retentionInput,
        );

      paymentDue =
        paymentDue ??
        localDate(28);
    }

    const net =
      Math.max(
        0,
        (certified ?? 0)
          - retention,
      );

    if (
      status ===
      "PARTIALLY_PAID"
    ) {
      const paidInput =
        window.prompt(
          "Amount paid",
          String(
            amountPaid ||
              net / 2,
          ),
        );

      if (paidInput === null) {
        return;
      }

      amountPaid =
        Number(paidInput);
    }

    if (
      status ===
      "PAID"
    ) {
      amountPaid =
        net;
    }

    await runAction(
      () =>
        updatePaymentCertificate(
          projectId,
          item.id,
          {
            version:
              item.version,
            periodStart:
              item.periodStart,
            periodEnd:
              item.periodEnd,
            applicationDate:
              item.applicationDate,
            certificationDueDate:
              item.certificationDueDate,
            applicationAmount:
              item.applicationAmount,
            certifiedAmount:
              certified,
            retentionAmount:
              retention,
            certifiedDate:
              item.certifiedDate ??
              (
                status ===
                  "CERTIFIED"
                ||
                status ===
                  "PARTIALLY_PAID"
                ||
                status ===
                  "PAID"
                  ? localDate()
                  : null
              ),
            paymentDueDate:
              paymentDue,
            amountPaid,
            lastPaymentDate:
              status ===
                "PARTIALLY_PAID"
              ||
              status ===
                "PAID"
                ? localDate()
                : item.lastPaymentDate,
            status,
          },
        ),
    );
  }

  async function toggleCashflow(
    item: CashflowPeriod,
  ) {
    const status: CashflowPeriodStatus =
      item.status ===
        "OPEN"
        ? "CLOSED"
        : "OPEN";

    await runAction(
      () =>
        updateCashflowPeriod(
          projectId,
          item.id,
          {
            version:
              item.version,
            periodEnd:
              item.periodEnd,
            plannedInflow:
              item.plannedInflow,
            forecastInflow:
              item.forecastInflow,
            actualInflow:
              item.actualInflow,
            plannedOutflow:
              item.plannedOutflow,
            forecastOutflow:
              item.forecastOutflow,
            actualOutflow:
              item.actualOutflow,
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
          Loading commercial intelligence...
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
            Commercial control unavailable
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
    changeOrders,
    claims,
    paymentCertificates,
    cashflowPeriods,
  } = data;

  return (
    <div className="commercial-shell">
      <aside className="commercial-sidebar">
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
          COMMERCIAL CONTROL
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

          <Link
            href={`/projects/${projectId}/risk-control`}
            className="command-nav-item"
          >
            03
            <span>
              Change / risk
            </span>
          </Link>

          <div className="command-nav-item active">
            04
            <span>
              Commercial
            </span>
          </div>

          <a
            href="#changes"
            className="command-nav-item"
          >
            05
            <span>
              Change orders
            </span>
          </a>

          <a
            href="#claims"
            className="command-nav-item"
          >
            06
            <span>
              Claims
            </span>
          </a>

          <a
            href="#payments"
            className="command-nav-item"
          >
            07
            <span>
              Certificates
            </span>
          </a>

          <a
            href="#cashflow"
            className="command-nav-item"
          >
            08
            <span>
              Cash flow
            </span>
          </a>

          <Link
            href={`/projects/${projectId}/resources`}
            className="command-nav-item"
          >
            09
            <span>
              Resources
            </span>
          </Link>
        </nav>

        <div className="command-sidebar-footer">
          <span>
            PROJECT COMMERCIAL
          </span>

          <strong>
            {project.code}
          </strong>

          <small>
            Changes, claims,
            certification and cash.
          </small>
        </div>
      </aside>

      <main className="commercial-main">
        <header className="commercial-topbar">
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
              COMMERCIAL INTELLIGENCE
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Contract change,
              claims, payment certification,
              retention and project cash-flow control.
            </p>
          </div>

          <div className="commercial-header-score">
            <span>
              COMMERCIAL HEALTH
            </span>

            <strong>
              {intelligence.commercialScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={`commercial-risk commercial-risk-${intelligence.commercialRisk
                .toLowerCase()
                .replaceAll("_", "-")}`}
            >
              {
                riskLabels[
                  intelligence.commercialRisk
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

        <section className="commercial-kpi-grid">
          <Kpi
            label="APPROVED CHANGES"
            value={money(
              Number(
                intelligence.approvedChangeValue,
              ),
            )}
            detail={`${intelligence.pendingChangeOrders} pending`}
          />

          <Kpi
            label="CLAIMED VALUE"
            value={money(
              Number(
                intelligence.claimedValue,
              ),
            )}
            detail={`${intelligence.openClaims} open claims`}
          />

          <Kpi
            label="OUTSTANDING CERTIFIED"
            value={money(
              Number(
                intelligence.outstandingCertifiedAmount,
              ),
            )}
            detail={`${intelligence.overduePayments} overdue payments`}
          />

          <Kpi
            label="FORECAST CASH VARIANCE"
            value={money(
              Number(
                intelligence.forecastCashflowVariance,
              ),
            )}
            detail={`${intelligence.overdueCertifications} overdue certifications`}
            emphasis
          />
        </section>

        <section className="commercial-intelligence-panel">
          <div className="commercial-score-panel">
            <span>
              COMMERCIAL SCORE
            </span>

            <strong>
              {intelligence.commercialScore.toFixed(
                0,
              )}
            </strong>

            <small>
              /100
            </small>
          </div>

          <div className="commercial-intelligence-grid">
            <Metric
              label="Overdue change decisions"
              value={String(
                intelligence.overdueChangeDecisions,
              )}
            />

            <Metric
              label="Overdue claim responses"
              value={String(
                intelligence.overdueClaimResponses,
              )}
            />

            <Metric
              label="Overdue certifications"
              value={String(
                intelligence.overdueCertifications,
              )}
            />

            <Metric
              label="Retention held"
              value={money(
                Number(
                  intelligence.retentionHeld,
                ),
              )}
            />

            <Metric
              label="Amount paid"
              value={money(
                Number(
                  intelligence.amountPaid,
                ),
              )}
            />

            <Metric
              label="Forecast net cash"
              value={money(
                Number(
                  intelligence.forecastNetCashflow,
                ),
              )}
            />
          </div>

          <p>
            {intelligence.explanation}
          </p>
        </section>

        <section className="commercial-actions-bar">
          <button
            type="button"
            onClick={() =>
              setPanel("change")
            }
          >
            + Change order
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel("claim")
            }
          >
            + Claim
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel("certificate")
            }
          >
            + Payment application
          </button>

          <button
            type="button"
            onClick={() =>
              setPanel("cashflow")
            }
          >
            + Cash-flow period
          </button>
        </section>

        {panel === "change" && (
          <Panel
            title="Create commercial change order"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="commercial-form"
              onSubmit={
                submitChange
              }
            >
              <Field
                label="Reference"
              >
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
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Source change reference"
              >
                <input
                  value={
                    changeForm.sourceChangeReference
                  }
                  onChange={(
                    event,
                  ) =>
                    setChangeForm({
                      ...changeForm,
                      sourceChangeReference:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Title"
                wide
              >
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
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Submitted amount"
              >
                <input
                  min={0}
                  step="0.01"
                  type="number"
                  value={
                    changeForm.submittedAmount
                  }
                  onChange={(
                    event,
                  ) =>
                    setChangeForm({
                      ...changeForm,
                      submittedAmount:
                        Number(
                          event.target.value,
                        ),
                    })
                  }
                />
              </Field>

              <Field
                label="Description"
                full
              >
                <textarea
                  required
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
                        event.target.value,
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

        {panel === "claim" && (
          <Panel
            title="Register commercial claim"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="commercial-form"
              onSubmit={
                submitClaim
              }
            >
              <Field label="Reference">
                <input
                  required
                  value={
                    claimForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setClaimForm({
                      ...claimForm,
                      reference:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Claim type">
                <select
                  value={
                    claimForm.claimType
                  }
                  onChange={(
                    event,
                  ) =>
                    setClaimForm({
                      ...claimForm,
                      claimType:
                        event.target.value as CommercialClaimType,
                    })
                  }
                >
                  {claimTypes.map(
                    (
                      type,
                    ) => (
                      <option
                        key={type}
                        value={type}
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
                label="Title"
                wide
              >
                <input
                  required
                  value={
                    claimForm.title
                  }
                  onChange={(
                    event,
                  ) =>
                    setClaimForm({
                      ...claimForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Claimed amount">
                <input
                  min={0}
                  step="0.01"
                  type="number"
                  value={
                    claimForm.claimedAmount
                  }
                  onChange={(
                    event,
                  ) =>
                    setClaimForm({
                      ...claimForm,
                      claimedAmount:
                        Number(
                          event.target.value,
                        ),
                    })
                  }
                />
              </Field>

              <Field label="Claimed days">
                <input
                  min={0}
                  type="number"
                  value={
                    claimForm.claimedDays
                  }
                  onChange={(
                    event,
                  ) =>
                    setClaimForm({
                      ...claimForm,
                      claimedDays:
                        Number(
                          event.target.value,
                        ),
                    })
                  }
                />
              </Field>

              <Field
                label="Contractual basis"
                full
              >
                <textarea
                  required
                  rows={5}
                  value={
                    claimForm.basis
                  }
                  onChange={(
                    event,
                  ) =>
                    setClaimForm({
                      ...claimForm,
                      basis:
                        event.target.value,
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

        {panel === "certificate" && (
          <Panel
            title="Create payment application"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="commercial-form"
              onSubmit={
                submitCertificate
              }
            >
              <Field label="Reference">
                <input
                  required
                  value={
                    certificateForm.reference
                  }
                  onChange={(
                    event,
                  ) =>
                    setCertificateForm({
                      ...certificateForm,
                      reference:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Application amount">
                <input
                  min={0}
                  step="0.01"
                  type="number"
                  value={
                    certificateForm.applicationAmount
                  }
                  onChange={(
                    event,
                  ) =>
                    setCertificateForm({
                      ...certificateForm,
                      applicationAmount:
                        Number(
                          event.target.value,
                        ),
                    })
                  }
                />
              </Field>

              <DateField
                label="Period start"
                value={
                  certificateForm.periodStart
                }
                onChange={(
                  value,
                ) =>
                  setCertificateForm({
                    ...certificateForm,
                    periodStart:
                      value,
                  })
                }
              />

              <DateField
                label="Period end"
                value={
                  certificateForm.periodEnd
                }
                onChange={(
                  value,
                ) =>
                  setCertificateForm({
                    ...certificateForm,
                    periodEnd:
                      value,
                  })
                }
              />

              <DateField
                label="Application date"
                value={
                  certificateForm.applicationDate
                }
                onChange={(
                  value,
                ) =>
                  setCertificateForm({
                    ...certificateForm,
                    applicationDate:
                      value,
                  })
                }
              />

              <DateField
                label="Certification due"
                value={
                  certificateForm.certificationDueDate
                }
                onChange={(
                  value,
                ) =>
                  setCertificateForm({
                    ...certificateForm,
                    certificationDueDate:
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

        {panel === "cashflow" && (
          <Panel
            title="Create cash-flow period"
            onClose={() =>
              setPanel(null)
            }
          >
            <form
              className="commercial-form"
              onSubmit={
                submitCashflow
              }
            >
              <DateField
                label="Period start"
                value={
                  cashflowForm.periodStart
                }
                onChange={(
                  value,
                ) =>
                  setCashflowForm({
                    ...cashflowForm,
                    periodStart:
                      value,
                  })
                }
              />

              <DateField
                label="Period end"
                value={
                  cashflowForm.periodEnd
                }
                onChange={(
                  value,
                ) =>
                  setCashflowForm({
                    ...cashflowForm,
                    periodEnd:
                      value,
                  })
                }
              />

              {[
                [
                  "Planned inflow",
                  "plannedInflow",
                ],
                [
                  "Forecast inflow",
                  "forecastInflow",
                ],
                [
                  "Actual inflow",
                  "actualInflow",
                ],
                [
                  "Planned outflow",
                  "plannedOutflow",
                ],
                [
                  "Forecast outflow",
                  "forecastOutflow",
                ],
                [
                  "Actual outflow",
                  "actualOutflow",
                ],
              ].map(
                ([
                  label,
                  key,
                ]) => (
                  <Field
                    key={key}
                    label={label}
                  >
                    <input
                      min={0}
                      step="0.01"
                      type="number"
                      value={
                        cashflowForm[
                          key as keyof CreateCashflowPeriodInput
                        ] as number
                      }
                      onChange={(
                        event,
                      ) =>
                        setCashflowForm({
                          ...cashflowForm,
                          [key]:
                            Number(
                              event.target.value,
                            ),
                        })
                      }
                    />
                  </Field>
                ),
              )}

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
          className="commercial-card"
          id="changes"
        >
          <CardHeader
            eyebrow="CONTRACT CHANGE"
            title="Contract change orders"
            value={`${intelligence.pendingChangeOrders} pending`}
          />

          <TableWrap>
            <table className="commercial-table">
              <thead>
                <tr>
                  <th>CHANGE</th>
                  <th>SOURCE</th>
                  <th>SUBMITTED</th>
                  <th>ASSESSED</th>
                  <th>APPROVED</th>
                  <th>DECISION DUE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {changeOrders.map(
                  (
                    item,
                  ) => (
                    <tr
                      key={item.id}
                      className={
                        item.overdueDecision
                          ? "commercial-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={item.reference}
                          title={item.title}
                        />
                      </td>

                      <td>
                        {item.sourceChangeReference ??
                          "—"}
                      </td>

                      <td>
                        {money(
                          Number(
                            item.submittedAmount,
                          ),
                        )}
                      </td>

                      <td>
                        {item.assessedAmount ===
                        null
                          ? "—"
                          : money(
                              Number(
                                item.assessedAmount,
                              ),
                            )}
                      </td>

                      <td>
                        {item.approvedAmount ===
                        null
                          ? "—"
                          : money(
                              Number(
                                item.approvedAmount,
                              ),
                            )}
                      </td>

                      <td
                        className={
                          item.overdueDecision
                            ? "commercial-overdue"
                            : ""
                        }
                      >
                        {formatDate(
                          item.decisionDueDate,
                        )}
                      </td>

                      <td>
                        <select
                          className="commercial-select"
                          disabled={busy}
                          value={item.status}
                          onChange={(
                            event,
                          ) =>
                            void changeChangeStatus(
                              item,
                              event.target.value as CommercialChangeOrderStatus,
                            )
                          }
                        >
                          {changeStatuses(
                            item.status,
                          ).map(
                            (
                              status,
                            ) => (
                              <option
                                key={status}
                                value={status}
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

                {changeOrders.length ===
                  0 && (
                  <EmptyRow
                    columns={7}
                    text="No commercial change orders."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section
          className="commercial-card"
          id="claims"
        >
          <CardHeader
            eyebrow="CLAIMS MANAGEMENT"
            title="Commercial claims"
            value={`${intelligence.openClaims} open`}
          />

          <TableWrap>
            <table className="commercial-table">
              <thead>
                <tr>
                  <th>CLAIM</th>
                  <th>TYPE</th>
                  <th>CLAIMED</th>
                  <th>AWARDED</th>
                  <th>DAYS</th>
                  <th>RESPONSE DUE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {claims.map(
                  (
                    item,
                  ) => (
                    <tr
                      key={item.id}
                      className={
                        item.overdueResponse
                          ? "commercial-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={item.reference}
                          title={item.title}
                        />
                      </td>

                      <td>
                        {item.claimType.replaceAll(
                          "_",
                          " ",
                        )}
                      </td>

                      <td>
                        {money(
                          Number(
                            item.claimedAmount,
                          ),
                        )}
                      </td>

                      <td>
                        {item.awardedAmount ===
                        null
                          ? "—"
                          : money(
                              Number(
                                item.awardedAmount,
                              ),
                            )}
                      </td>

                      <td>
                        {item.awardedDays}
                        {" / "}
                        {item.claimedDays}
                      </td>

                      <td
                        className={
                          item.overdueResponse
                            ? "commercial-overdue"
                            : ""
                        }
                      >
                        {formatDate(
                          item.responseDueDate,
                        )}
                      </td>

                      <td>
                        <select
                          className="commercial-select"
                          disabled={busy}
                          value={item.status}
                          onChange={(
                            event,
                          ) =>
                            void changeClaimStatus(
                              item,
                              event.target.value as CommercialClaimStatus,
                            )
                          }
                        >
                          {claimStatuses(
                            item.status,
                          ).map(
                            (
                              status,
                            ) => (
                              <option
                                key={status}
                                value={status}
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

                {claims.length ===
                  0 && (
                  <EmptyRow
                    columns={7}
                    text="No commercial claims."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section
          className="commercial-card"
          id="payments"
        >
          <CardHeader
            eyebrow="CLIENT CASH"
            title="Payment certificates"
            value={`${intelligence.awaitingCertification} awaiting certification`}
          />

          <TableWrap>
            <table className="commercial-table commercial-payment-table">
              <thead>
                <tr>
                  <th>CERTIFICATE</th>
                  <th>APPLICATION</th>
                  <th>CERTIFIED</th>
                  <th>RETENTION</th>
                  <th>PAID</th>
                  <th>OUTSTANDING</th>
                  <th>PAYMENT DUE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {paymentCertificates.map(
                  (
                    item,
                  ) => (
                    <tr
                      key={item.id}
                      className={
                        item.overdueCertification ||
                        item.overduePayment
                          ? "commercial-overdue-row"
                          : ""
                      }
                    >
                      <td>
                        <NameCell
                          code={item.reference}
                          title={`${formatDate(
                            item.periodStart,
                          )} — ${formatDate(
                            item.periodEnd,
                          )}`}
                        />
                      </td>

                      <td>
                        {money(
                          Number(
                            item.applicationAmount,
                          ),
                        )}
                      </td>

                      <td>
                        {item.certifiedAmount ===
                        null
                          ? "—"
                          : money(
                              Number(
                                item.certifiedAmount,
                              ),
                            )}
                      </td>

                      <td>
                        {money(
                          Number(
                            item.retentionAmount ??
                              0,
                          ),
                        )}
                      </td>

                      <td>
                        {money(
                          Number(
                            item.amountPaid,
                          ),
                        )}
                      </td>

                      <td>
                        <strong
                          className={
                            Number(
                              item.outstandingAmount,
                            ) > 0
                              ? "commercial-negative"
                              : ""
                          }
                        >
                          {money(
                            Number(
                              item.outstandingAmount,
                            ),
                          )}
                        </strong>
                      </td>

                      <td
                        className={
                          item.overduePayment
                            ? "commercial-overdue"
                            : ""
                        }
                      >
                        {formatDate(
                          item.paymentDueDate,
                        )}
                      </td>

                      <td>
                        <select
                          className="commercial-select"
                          disabled={busy}
                          value={item.status}
                          onChange={(
                            event,
                          ) =>
                            void changeCertificateStatus(
                              item,
                              event.target.value as PaymentCertificateStatus,
                            )
                          }
                        >
                          {certificateStatuses(
                            item.status,
                          ).map(
                            (
                              status,
                            ) => (
                              <option
                                key={status}
                                value={status}
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

                {paymentCertificates.length ===
                  0 && (
                  <EmptyRow
                    columns={8}
                    text="No payment applications."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <section
          className="commercial-card"
          id="cashflow"
        >
          <CardHeader
            eyebrow="CASH-FLOW CONTROL"
            title="Period cash flow"
            value={`${cashflowPeriods.length} periods`}
          />

          <TableWrap>
            <table className="commercial-table">
              <thead>
                <tr>
                  <th>PERIOD</th>
                  <th>PLAN NET</th>
                  <th>FORECAST NET</th>
                  <th>ACTUAL NET</th>
                  <th>FORECAST VARIANCE</th>
                  <th>STATUS</th>
                </tr>
              </thead>

              <tbody>
                {cashflowPeriods.map(
                  (
                    item,
                  ) => (
                    <tr key={item.id}>
                      <td>
                        <NameCell
                          code={formatDate(
                            item.periodStart,
                          )}
                          title={formatDate(
                            item.periodEnd,
                          )}
                        />
                      </td>

                      <td>
                        {money(
                          Number(
                            item.plannedNetCashflow,
                          ),
                        )}
                      </td>

                      <td>
                        {money(
                          Number(
                            item.forecastNetCashflow,
                          ),
                        )}
                      </td>

                      <td>
                        {money(
                          Number(
                            item.actualNetCashflow,
                          ),
                        )}
                      </td>

                      <td
                        className={
                          Number(
                            item.forecastVariance,
                          ) < 0
                            ? "commercial-negative"
                            : "commercial-positive"
                        }
                      >
                        {money(
                          Number(
                            item.forecastVariance,
                          ),
                        )}
                      </td>

                      <td>
                        <button
                          type="button"
                          className="commercial-status-button"
                          disabled={busy}
                          onClick={() =>
                            void toggleCashflow(
                              item,
                            )
                          }
                        >
                          {item.status}
                        </button>
                      </td>
                    </tr>
                  ),
                )}

                {cashflowPeriods.length ===
                  0 && (
                  <EmptyRow
                    columns={6}
                    text="No cash-flow periods."
                  />
                )}
              </tbody>
            </table>
          </TableWrap>
        </section>

        <footer className="command-footer">
          <div>
            BuildSight · Commercial Intelligence
          </div>

          <div>
            {changeOrders.length} changes
            {" · "}
            {claims.length} claims
            {" · "}
            {paymentCertificates.length} certificates
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
          ? "commercial-kpi commercial-kpi-emphasis"
          : "commercial-kpi"
      }
    >
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
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
    <div className="commercial-intelligence-metric">
      <span>{label}</span>
      <strong>{value}</strong>
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
    <div className="commercial-card-header">
      <div>
        <div className="eyebrow">
          {eyebrow}
        </div>

        <h2>{title}</h2>
      </div>

      <strong>{value}</strong>
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
    <div className="commercial-name-cell">
      <strong>{code}</strong>
      <span>{title}</span>
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
    <section className="commercial-form-panel">
      <div className="commercial-card-header">
        <div>
          <div className="eyebrow">
            COMMERCIAL CONTROL INPUT
          </div>

          <h2>{title}</h2>
        </div>

        <button
          type="button"
          className="close-button"
          onClick={onClose}
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
  wide = false,
  full = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
  full?: boolean;
}) {
  return (
    <label
      className={
        full
          ? "field-full"
          : wide
            ? "field-wide"
            : ""
      }
    >
      <span>{label}</span>
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
        value={value}
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
        onClick={onCancel}
      >
        Cancel
      </button>

      <button
        type="submit"
        className="primary-button"
        disabled={busy}
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
    <div className="commercial-table-wrapper">
      {children}
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
