"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectCommercial } from "@/lib/api";
import type {
  CommercialChangeOrderStatus,
  CommercialClaimStatus,
  CommercialClaimType,
  CommercialControl,
  CommercialRiskLevel,
  PaymentCertificate,
} from "@/types/project";

import styles from "./ProjectCommercialBoardView.module.css";

const DAY_MS = 86_400_000;
const CERT_WINDOW = 10;
const LIST_LIMIT = 10;

const RISK_LABEL: Record<CommercialRiskLevel, string> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<CommercialRiskLevel, string | undefined> = {
  NO_DATA: styles.riskNone,
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const CO_ORDER: ReadonlyArray<CommercialChangeOrderStatus> = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
];

const CO_LABEL: Record<CommercialChangeOrderStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  VOID: "Void",
};

const CLAIM_TYPES: ReadonlyArray<CommercialClaimType> = [
  "EXTENSION_OF_TIME",
  "LOSS_AND_EXPENSE",
  "VARIATION",
  "DISRUPTION",
  "DELAY",
  "OTHER",
];

const CLAIM_LABEL: Record<CommercialClaimType, string> = {
  EXTENSION_OF_TIME: "Extension of time",
  LOSS_AND_EXPENSE: "Loss and expense",
  VARIATION: "Variation",
  DISRUPTION: "Disruption",
  DELAY: "Delay",
  OTHER: "Other",
};

const CLAIM_DECIDED: ReadonlyArray<CommercialClaimStatus> = [
  "APPROVED",
  "PARTIALLY_APPROVED",
  "REJECTED",
  "SETTLED",
];

const CLAIM_STATUS_LABEL: Record<CommercialClaimStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  PARTIALLY_APPROVED: "Partly approved",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SETTLED: "Settled",
  VOID: "Void",
};

const CERT_STATUS_LABEL: Record<PaymentCertificate["status"], string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  CERTIFIED: "Certified",
  PARTIALLY_PAID: "Partly paid",
  PAID: "Paid",
  REJECTED: "Rejected",
  VOID: "Void",
};

type AgeKey = "notDue" | "d30" | "d60" | "d90" | "d90p" | "noDue";

const AGE_BUCKETS: ReadonlyArray<{ key: AgeKey; label: string; color: string }> = [
  { key: "notDue", label: "Not yet due", color: "#a9c1b8" },
  { key: "d30", label: "1–30 days late", color: "#dcb85e" },
  { key: "d60", label: "31–60 days late", color: "#d9823a" },
  { key: "d90", label: "61–90 days late", color: "#c4623f" },
  { key: "d90p", label: "Over 90 days late", color: "#b5493e" },
  { key: "noDue", label: "No due date", color: "#c3c9c5" },
];

const SERIES_COLOR = { applied: "#c3c9c5", certified: "#7ab397", paid: "#2f6f55" } as const;

type ChaseKind = "Change order" | "Claim" | "Certification" | "Payment";

interface ChaseRow {
  id: string;
  kind: ChaseKind;
  reference: string;
  title: string;
  amount: number;
  dueDay: number;
  lateDays: number;
  status: string;
}

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function startOfToday(): number {
  const now = new Date();

  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

function toDay(value: string | null): number {
  if (!value) {
    return NaN;
  }

  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS);
}

function formatDay(day: number): string {
  if (!Number.isFinite(day)) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(day * DAY_MS));
}

function monthYear(day: number): string {
  if (!Number.isFinite(day)) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(day * DAY_MS));
}

function num(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function moneyFull(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function axisStep(max: number): number {
  const rough = Math.max(max, 1) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const fraction = rough / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;

  return Math.max(1, nice * magnitude);
}

function ageKey(daysLate: number, hasDue: boolean): AgeKey {
  if (!hasDue) {
    return "noDue";
  }

  if (daysLate <= 0) {
    return "notDue";
  }

  if (daysLate <= 30) {
    return "d30";
  }

  if (daysLate <= 60) {
    return "d60";
  }

  return daysLate <= 90 ? "d90" : "d90p";
}

export function ProjectCommercialBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<CommercialControl | null>(null);
  const [error, setError] = useState("");
  const [showAllChase, setShowAllChase] = useState(false);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectCommercial(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load commercial data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const changeOrders = (data?.changeOrders ?? []).filter((item) => item.status !== "VOID");
    const claims = (data?.claims ?? []).filter((item) => item.status !== "VOID");
    const certs = (data?.paymentCertificates ?? []).filter(
      (item) => item.status !== "VOID" && item.status !== "DRAFT",
    );

    const receivables = AGE_BUCKETS.map((bucket) => ({ ...bucket, amount: 0, count: 0 }));
    let outstandingTotal = 0;
    let overdueTotal = 0;

    for (const cert of certs) {
      if (cert.outstandingAmount <= 0 || cert.status === "REJECTED" || cert.status === "PAID") {
        continue;
      }

      const dueDay = toDay(cert.paymentDueDate);
      const key = ageKey(today - dueDay, Number.isFinite(dueDay));
      const bucket = receivables.find((item) => item.key === key);

      if (bucket) {
        bucket.amount += cert.outstandingAmount;
        bucket.count += 1;
      }

      outstandingTotal += cert.outstandingAmount;

      if (key !== "notDue" && key !== "noDue") {
        overdueTotal += cert.outstandingAmount;
      }
    }

    const receivableMax = Math.max(0, ...receivables.map((item) => item.amount));

    const certWindow = [...certs]
      .sort((a, b) => toDay(a.periodEnd) - toDay(b.periodEnd))
      .slice(-CERT_WINDOW);

    const certMax = Math.max(
      0,
      ...certWindow.flatMap((cert) => [
        cert.applicationAmount,
        cert.certifiedAmount ?? 0,
        cert.amountPaid,
      ]),
    );

    const unpaid = certs
      .filter(
        (cert) => cert.outstandingAmount > 0 && cert.status !== "REJECTED" && cert.status !== "PAID",
      )
      .map((cert) => {
        const dueDay = toDay(cert.paymentDueDate);

        return { cert, dueDay, lateDays: Number.isFinite(dueDay) ? Math.max(0, today - dueDay) : 0 };
      })
      .sort((a, b) => b.lateDays - a.lateDays || b.cert.outstandingAmount - a.cert.outstandingAmount);

    const coRows = CO_ORDER.map((status) => {
      const items = changeOrders.filter((item) => item.status === status);

      return {
        status,
        count: items.length,
        submitted: items.reduce((sum, item) => sum + item.submittedAmount, 0),
        approved: items.reduce((sum, item) => sum + (item.approvedAmount ?? 0), 0),
      };
    });

    const coMax = Math.max(0, ...coRows.map((row) => row.submitted));
    const decidedCos = changeOrders.filter((item) => item.status === "APPROVED" || item.status === "REJECTED");
    const decidedSubmitted = decidedCos.reduce((sum, item) => sum + item.submittedAmount, 0);
    const decidedApproved = decidedCos.reduce((sum, item) => sum + (item.approvedAmount ?? 0), 0);

    const claimRows = CLAIM_TYPES.map((type) => {
      const items = claims.filter((item) => item.claimType === type);

      return {
        type,
        count: items.length,
        claimed: items.reduce((sum, item) => sum + item.claimedAmount, 0),
        awarded: items.reduce((sum, item) => sum + (item.awardedAmount ?? 0), 0),
        claimedDays: items.reduce((sum, item) => sum + item.claimedDays, 0),
        awardedDays: items.reduce((sum, item) => sum + item.awardedDays, 0),
      };
    }).filter((row) => row.count > 0);

    const claimMax = Math.max(0, ...claimRows.map((row) => row.claimed));
    const decidedClaims = claims.filter((item) => CLAIM_DECIDED.includes(item.status));
    const decidedClaimed = decidedClaims.reduce((sum, item) => sum + item.claimedAmount, 0);
    const decidedAwarded = decidedClaims.reduce((sum, item) => sum + (item.awardedAmount ?? 0), 0);

    const chase: ChaseRow[] = [];

    for (const item of changeOrders) {
      if (item.overdueDecision) {
        const dueDay = toDay(item.decisionDueDate);

        chase.push({
          id: `co-${item.id}`,
          kind: "Change order",
          reference: item.reference,
          title: item.title,
          amount: item.submittedAmount,
          dueDay,
          lateDays: Number.isFinite(dueDay) ? Math.max(1, today - dueDay) : 1,
          status: CO_LABEL[item.status],
        });
      }
    }

    for (const item of claims) {
      if (item.overdueResponse) {
        const dueDay = toDay(item.responseDueDate);

        chase.push({
          id: `cl-${item.id}`,
          kind: "Claim",
          reference: item.reference,
          title: item.title,
          amount: item.claimedAmount,
          dueDay,
          lateDays: Number.isFinite(dueDay) ? Math.max(1, today - dueDay) : 1,
          status: CLAIM_STATUS_LABEL[item.status],
        });
      }
    }

    for (const item of certs) {
      if (item.overdueCertification) {
        const dueDay = toDay(item.certificationDueDate);

        chase.push({
          id: `ce-${item.id}`,
          kind: "Certification",
          reference: item.reference,
          title: `Application for ${monthYear(toDay(item.periodEnd))}`,
          amount: item.applicationAmount,
          dueDay,
          lateDays: Number.isFinite(dueDay) ? Math.max(1, today - dueDay) : 1,
          status: CERT_STATUS_LABEL[item.status],
        });
      }

      if (item.overduePayment) {
        const dueDay = toDay(item.paymentDueDate);

        chase.push({
          id: `pa-${item.id}`,
          kind: "Payment",
          reference: item.reference,
          title: `Payment for ${monthYear(toDay(item.periodEnd))}`,
          amount: item.outstandingAmount,
          dueDay,
          lateDays: Number.isFinite(dueDay) ? Math.max(1, today - dueDay) : 1,
          status: CERT_STATUS_LABEL[item.status],
        });
      }
    }

    chase.sort((a, b) => b.lateDays - a.lateDays || b.amount - a.amount);

    return {
      certCount: certs.length,
      receivables,
      receivableMax,
      outstandingTotal,
      overdueTotal,
      certWindow,
      certMax,
      unpaid,
      coRows,
      coMax,
      decidedCount: decidedCos.length,
      decidedSubmitted,
      decidedApproved,
      claimRows,
      claimMax,
      decidedClaimed,
      decidedAwarded,
      chase,
    };
  }, [data, today]);

  const intel = data?.intelligence;
  const visibleChase = showAllChase ? model.chase : model.chase.slice(0, LIST_LIMIT);

  const chartStep = axisStep(model.certMax);
  const chartTop = chartStep * 4;
  const area = { left: 52, right: 12, top: 14, bottom: 30, width: 800, height: 260 };
  const plotW = area.width - area.left - area.right;
  const plotH = area.height - area.top - area.bottom;
  const slot = plotW / Math.max(1, model.certWindow.length);
  const barW = Math.min(16, (slot * 0.8) / 3);

  const coYield = model.decidedSubmitted > 0 ? percent(model.decidedApproved, model.decidedSubmitted) : null;
  const claimYield = model.decidedClaimed > 0 ? percent(model.decidedAwarded, model.decidedClaimed) : null;
  const chaseCount = intel
    ? intel.overdueChangeDecisions +
      intel.overdueClaimResponses +
      intel.overdueCertifications +
      intel.overduePayments
    : 0;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">COMMERCIAL BOARD</div>

            <h1>{data ? data.project.name : "Commercial board"}</h1>

            <p className={styles.subtitle}>
              What the client owes, how change orders and claims are converting, and which items
              are overdue and need chasing. Record the underlying items in commercial control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/commercial`}>
            Open commercial control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading commercial data…</div>}

        {data && intel && (
          <>
            <section aria-label="Commercial summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>COMMERCIAL SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.commercialScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.commercialRisk])}>
                    {RISK_LABEL[intel.commercialRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OUTSTANDING</div>
                <div className={cx(styles.kpiValue, model.overdueTotal > 0 && styles.neg)}>
                  {money(model.outstandingTotal)}
                </div>
                <div className={styles.kpiSub}>
                  {money(model.overdueTotal)} past due · {intel.overduePayments} late payment
                  {intel.overduePayments === 1 ? "" : "s"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>RETENTION HELD</div>
                <div className={styles.kpiValue}>{money(intel.retentionHeld)}</div>
                <div className={styles.kpiSub}>
                  {money(intel.certifiedValue)} certified · {money(intel.amountPaid)} paid
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CHANGE ORDER YIELD</div>
                <div className={styles.kpiValue}>{coYield === null ? "—" : `${num(coYield)}%`}</div>
                <div className={styles.kpiSub}>
                  {model.decidedCount} decided · {intel.pendingChangeOrders} pending
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CLAIM YIELD</div>
                <div className={styles.kpiValue}>
                  {claimYield === null ? "—" : `${num(claimYield)}%`}
                </div>
                <div className={styles.kpiSub}>
                  {intel.awardedDays} of {intel.claimedDays} days awarded
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NEEDS CHASING</div>
                <div className={cx(styles.kpiValue, chaseCount > 0 && styles.neg)}>{chaseCount}</div>
                <div className={styles.kpiSub}>overdue decisions, responses and payments</div>
              </article>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">RECEIVABLES</div>
                    <h2>Outstanding by age</h2>
                  </div>

                  <span className={styles.muted}>{moneyFull(model.outstandingTotal)}</span>
                </header>

                {model.outstandingTotal <= 0 ? (
                  <div className={styles.emptySmall}>
                    {model.certCount === 0
                      ? "No payment certificates submitted yet."
                      : "Nothing outstanding. All certificates are settled."}
                  </div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.receivables
                      .filter((bucket) => bucket.count > 0 || bucket.key !== "noDue")
                      .map((bucket) => (
                        <li key={bucket.key}>
                          <div className={styles.ageingTop}>
                            <span>{bucket.label}</span>
                            <strong>
                              {money(bucket.amount)}
                              <small>
                                {bucket.count} certificate{bucket.count === 1 ? "" : "s"}
                              </small>
                            </strong>
                          </div>

                          <div
                            aria-label={`${moneyFull(bucket.amount)} ${bucket.label.toLowerCase()}`}
                            className={styles.track}
                            role="img"
                          >
                            <div
                              className={styles.fill}
                              style={{
                                background: bucket.color,
                                width: `${percent(bucket.amount, model.receivableMax)}%`,
                              }}
                            />
                          </div>
                        </li>
                      ))}
                  </ul>
                )}

                <p className={styles.hint}>
                  Age is counted from the payment due date on each certificate. Rejected, void and
                  fully paid certificates are left out.
                </p>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">CHANGE ORDERS</div>
                    <h2>Where each order stands</h2>
                  </div>

                  <span className={styles.muted}>
                    {money(intel.submittedChangeValue)} submitted
                  </span>
                </header>

                {model.coRows.every((row) => row.count === 0) ? (
                  <div className={styles.emptySmall}>No change orders recorded yet.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.coRows.map((row) => (
                      <li key={row.status}>
                        <div className={styles.ageingTop}>
                          <span>{CO_LABEL[row.status]}</span>
                          <strong>
                            {row.count}
                            <small>
                              {money(row.submitted)}
                              {row.approved > 0 && ` submitted · ${money(row.approved)} approved`}
                            </small>
                          </strong>
                        </div>

                        <div
                          aria-label={`${row.count} ${CO_LABEL[row.status].toLowerCase()}, ${moneyFull(row.submitted)} submitted`}
                          className={styles.track}
                          role="img"
                        >
                          <div
                            className={styles.pairOuter}
                            style={{ width: `${percent(row.submitted, model.coMax)}%` }}
                          >
                            {row.approved > 0 && (
                              <div
                                className={styles.pairInner}
                                style={{ width: `${percent(row.approved, row.submitted)}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <p className={styles.hint}>
                  Yield is the approved value as a share of the submitted value, counting only
                  change orders that have been decided.
                </p>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PAYMENT CERTIFICATES</div>
                  <h2>Applied, certified and paid</h2>
                </div>

                <span className={styles.muted}>last {model.certWindow.length} periods</span>
              </header>

              {model.certWindow.length === 0 ? (
                <div className={styles.emptySmall}>No submitted payment certificates yet.</div>
              ) : (
                <div className={styles.chartScroll}>
                  <svg
                    aria-label={`Applied, certified and paid amounts for the last ${model.certWindow.length} certificate periods`}
                    className={styles.chart}
                    role="img"
                    viewBox={`0 0 ${area.width} ${area.height}`}
                  >
                    {[0, 1, 2, 3, 4].map((step) => {
                      const value = chartStep * step;
                      const y = area.top + plotH - (value / chartTop) * plotH;

                      return (
                        <g key={step}>
                          <line
                            stroke="#e8ebe7"
                            x1={area.left}
                            x2={area.width - area.right}
                            y1={y}
                            y2={y}
                          />
                          <text fill="#7a847f" fontSize="11" textAnchor="end" x={area.left - 6} y={y + 3}>
                            {money(value)}
                          </text>
                        </g>
                      );
                    })}

                    {model.certWindow.map((cert, index) => {
                      const groupX = area.left + slot * index + (slot - barW * 3 - 4) / 2;
                      const bars = [
                        { key: "applied", label: "Applied", value: cert.applicationAmount, color: SERIES_COLOR.applied },
                        { key: "certified", label: "Certified", value: cert.certifiedAmount ?? 0, color: SERIES_COLOR.certified },
                        { key: "paid", label: "Paid", value: cert.amountPaid, color: SERIES_COLOR.paid },
                      ];

                      return (
                        <g key={cert.id}>
                          {bars.map((bar, barIndex) => {
                            const h = (bar.value / chartTop) * plotH;

                            return (
                              <rect
                                fill={bar.color}
                                height={Math.max(h, 0)}
                                key={bar.key}
                                rx="2"
                                width={barW}
                                x={groupX + barIndex * (barW + 2)}
                                y={area.top + plotH - h}
                              >
                                <title>{`${cert.reference} ${bar.label.toLowerCase()}: ${moneyFull(bar.value)}`}</title>
                              </rect>
                            );
                          })}

                          <text
                            fill="#66706b"
                            fontSize="11.5"
                            textAnchor="middle"
                            x={groupX + (barW * 3 + 4) / 2}
                            y={area.height - 10}
                          >
                            {monthYear(toDay(cert.periodEnd))}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              <ul aria-label="Chart legend" className={styles.legend}>
                <li>
                  <i className={styles.swatch} style={{ background: SERIES_COLOR.applied }} />
                  Applied
                </li>
                <li>
                  <i className={styles.swatch} style={{ background: SERIES_COLOR.certified }} />
                  Certified
                </li>
                <li>
                  <i className={styles.swatch} style={{ background: SERIES_COLOR.paid }} />
                  Paid
                </li>
              </ul>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">CLAIMS</div>
                    <h2>Claimed versus awarded</h2>
                  </div>

                  <span className={styles.muted}>
                    {money(intel.awardedClaimValue)} of {money(intel.claimedValue)}
                  </span>
                </header>

                {model.claimRows.length === 0 ? (
                  <div className={styles.emptySmall}>No claims recorded yet.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.claimRows.map((row) => (
                      <li key={row.type}>
                        <div className={styles.ageingTop}>
                          <span>{CLAIM_LABEL[row.type]}</span>
                          <strong>
                            {money(row.awarded)} / {money(row.claimed)}
                            <small>
                              {row.count} claim{row.count === 1 ? "" : "s"}
                              {row.claimedDays > 0 && ` · ${row.awardedDays}/${row.claimedDays} days`}
                            </small>
                          </strong>
                        </div>

                        <div
                          aria-label={`${CLAIM_LABEL[row.type]}: ${moneyFull(row.awarded)} awarded of ${moneyFull(row.claimed)} claimed`}
                          className={styles.track}
                          role="img"
                        >
                          <div
                            className={styles.pairOuter}
                            style={{ width: `${percent(row.claimed, model.claimMax)}%` }}
                          >
                            {row.awarded > 0 && (
                              <div
                                className={styles.pairInner}
                                style={{ width: `${percent(row.awarded, row.claimed)}%` }}
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <p className={styles.hint}>
                  The light bar is the amount claimed; the dark part is the amount awarded so far.
                </p>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">UNPAID CERTIFICATES</div>
                    <h2>Largest and latest first</h2>
                  </div>

                  <span className={styles.muted}>{model.unpaid.length} open</span>
                </header>

                {model.unpaid.length === 0 ? (
                  <div className={styles.emptySmall}>No unpaid certificates.</div>
                ) : (
                  <ul className={styles.items}>
                    {model.unpaid.slice(0, 6).map((row) => (
                      <li className={row.lateDays > 0 ? styles.itemAlert : ""} key={row.cert.id}>
                        <div className={styles.itemTop}>
                          <strong>{row.cert.reference}</strong>
                          <span>{CERT_STATUS_LABEL[row.cert.status]}</span>
                        </div>
                        <div className={styles.itemTitle}>
                          {monthYear(toDay(row.cert.periodEnd))} · {moneyFull(row.cert.outstandingAmount)} outstanding
                        </div>
                        <div className={styles.itemMeta}>
                          <span>
                            Due {formatDay(row.dueDay)} · paid {moneyFull(row.cert.amountPaid)} of{" "}
                            {moneyFull(row.cert.netCertifiedAmount)}
                          </span>
                          <span className={row.lateDays > 0 ? styles.neg : ""}>
                            {row.lateDays > 0 ? `${row.lateDays} day${row.lateDays === 1 ? "" : "s"} late` : "Not yet due"}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">NEEDS CHASING</div>
                  <h2>Overdue decisions, responses and payments</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>{model.chase.length} overdue</span>

                  {model.chase.length > LIST_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllChase((value) => !value)}
                      type="button"
                    >
                      {showAllChase ? `Show first ${LIST_LIMIT}` : `Show all ${model.chase.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.chase.length === 0 ? (
                <div className={styles.emptySmall}>Nothing overdue. Every decision and payment is on time.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>TYPE</th>
                        <th>REFERENCE</th>
                        <th>ITEM</th>
                        <th className={styles.num}>AMOUNT</th>
                        <th>WAS DUE</th>
                        <th className={styles.num}>LATE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleChase.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <span className={styles.kind}>{row.kind}</span>
                          </td>
                          <td>
                            <strong>{row.reference}</strong>
                          </td>
                          <td className={styles.wrap}>{row.title}</td>
                          <td className={styles.num}>{moneyFull(row.amount)}</td>
                          <td>{formatDay(row.dueDay)}</td>
                          <td className={cx(styles.num, styles.neg)}>{row.lateDays} d</td>
                          <td>{row.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className={styles.note}>{intel.explanation}</p>
          </>
        )}
      </main>
    </div>
  );
}
