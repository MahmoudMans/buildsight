"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { LineChart } from "@/components/LineChart";
import { getProjectCommercial } from "@/lib/api";
import type {
  CashflowPeriod,
  CommercialControl,
  CommercialRiskLevel,
  PaymentCertificate,
} from "@/types/project";

import styles from "./ProjectCashflowView.module.css";

const DAY_MS = 86_400_000;

const RISK_LABEL: Record<CommercialRiskLevel, string> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<CommercialRiskLevel, string> = {
  NO_DATA: styles.riskNone,
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

type BucketKey = "none" | "current" | "d30" | "d60" | "d90";

const BUCKETS: ReadonlyArray<{ key: BucketKey; label: string; tone: string }> = [
  { key: "current", label: "Not yet due", tone: styles.toneGood },
  { key: "d30", label: "1–30 days late", tone: styles.toneWatch },
  { key: "d60", label: "31–60 days late", tone: styles.toneHigh },
  { key: "d90", label: "Over 60 days late", tone: styles.toneBad },
  { key: "none", label: "No due date", tone: styles.toneNone },
];

interface CumulativeRow {
  period: CashflowPeriod;
  day: number;
  planned: number;
  forecast: number;
  actual: number | null;
}

function startOfToday(): number {
  const now = new Date();

  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS,
  );
}

function toDay(value: string): number {
  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(
    Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS,
  );
}

function formatDay(day: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(day * DAY_MS));
}

function formatShortDay(day: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(day * DAY_MS));
}

function formatIso(value: string | null): string {
  if (!value) {
    return "—";
  }

  const day = toDay(value);

  return Number.isFinite(day) ? formatDay(day) : "—";
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

function signedMoney(value: number): string {
  if (Math.abs(value) < 0.5) {
    return "—";
  }

  return `${value > 0 ? "+" : "−"}${moneyFull(Math.abs(value))}`;
}

function tone(value: number): string {
  return value < -0.5 ? styles.neg : value > 0.5 ? styles.pos : "";
}

function humanize(value: string): string {
  const text = value.replace(/_/g, " ").toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function bucketFor(cert: PaymentCertificate, today: number): BucketKey {
  if (!cert.paymentDueDate) {
    return "none";
  }

  const late = today - toDay(cert.paymentDueDate);

  if (!Number.isFinite(late)) {
    return "none";
  }

  if (late <= 0) {
    return "current";
  }

  if (late <= 30) {
    return "d30";
  }

  return late <= 60 ? "d60" : "d90";
}

export function ProjectCashflowView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<CommercialControl | null>(null);
  const [error, setError] = useState("");

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
            setError(
              "Could not load commercial data. Check that the backend is running.",
            );
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const periods = useMemo(
    () =>
      [...(data?.cashflowPeriods ?? [])].sort((a, b) =>
        a.periodStart.localeCompare(b.periodStart),
      ),
    [data],
  );

  const rows = useMemo<CumulativeRow[]>(() => {
    let planned = 0;
    let forecast = 0;
    let actual = 0;

    return periods.map((period) => {
      planned += Number(period.plannedNetCashflow);
      forecast += Number(period.forecastNetCashflow);

      const started =
        period.status === "CLOSED" || toDay(period.periodStart) <= today;

      if (started) {
        actual += Number(period.actualNetCashflow);
      }

      return {
        period,
        day: toDay(period.periodEnd),
        planned,
        forecast,
        actual: started ? actual : null,
      };
    });
  }, [periods, today]);

  const series = useMemo(
    () => [
      {
        name: "Planned",
        color: "#7a847f",
        dashed: true,
        points: rows.map((row) => ({ x: row.day, y: row.planned })),
      },
      {
        name: "Forecast",
        color: "#386b8d",
        points: rows.map((row) => ({ x: row.day, y: row.forecast })),
      },
      {
        name: "Actual",
        color: "#344b42",
        points: rows.flatMap((row) =>
          row.actual === null ? [] : [{ x: row.day, y: row.actual }],
        ),
      },
    ],
    [rows],
  );

  const last = rows[rows.length - 1];
  const peakNeed = Math.min(0, ...rows.map((row) => row.forecast));
  const endGap = last ? last.forecast - last.planned : 0;

  const ageing = useMemo(() => {
    const totals: Record<BucketKey, { amount: number; count: number }> = {
      none: { amount: 0, count: 0 },
      current: { amount: 0, count: 0 },
      d30: { amount: 0, count: 0 },
      d60: { amount: 0, count: 0 },
      d90: { amount: 0, count: 0 },
    };

    for (const cert of data?.paymentCertificates ?? []) {
      const outstanding = Number(cert.outstandingAmount);

      if (
        outstanding > 0 &&
        (cert.status === "CERTIFIED" || cert.status === "PARTIALLY_PAID")
      ) {
        const bucket = totals[bucketFor(cert, today)];

        bucket.amount += outstanding;
        bucket.count += 1;
      }
    }

    return totals;
  }, [data, today]);

  const ageingMax = Math.max(
    1,
    ...BUCKETS.map((bucket) => ageing[bucket.key].amount),
  );

  const ageingTotal = BUCKETS.reduce(
    (total, bucket) => total + ageing[bucket.key].amount,
    0,
  );

  const certificates = useMemo(
    () =>
      [...(data?.paymentCertificates ?? [])].sort((a, b) =>
        b.periodEnd.localeCompare(a.periodEnd),
      ),
    [data],
  );

  const intel = data?.intelligence;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">CASHFLOW</div>

            <h1>{data ? data.project.name : "Cashflow"}</h1>

            <p className={styles.subtitle}>
              Cumulative net cashflow (inflow minus outflow) for the plan, the
              latest forecast and what has actually happened, plus the state of
              payment certificates. Edit periods and certificates in commercial
              control.
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

        {!data && !error && (
          <div className={styles.loading}>Loading cashflow…</div>
        )}

        {data && intel && (
          <>
            <section aria-label="Cashflow summary" className={styles.kpis}>
              <article className={`${styles.kpi} ${styles.kpiDark}`}>
                <div className={styles.kpiLabel}>COMMERCIAL SCORE</div>
                <div className={styles.kpiValue}>
                  {Math.round(intel.commercialScore)}
                </div>
                <div className={styles.kpiSub}>
                  <span
                    className={`${styles.pill} ${
                      RISK_CLASS[intel.commercialRisk]
                    }`}
                  >
                    {RISK_LABEL[intel.commercialRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PEAK FUNDING NEED</div>
                <div
                  className={`${styles.kpiValue} ${
                    peakNeed < 0 ? styles.neg : ""
                  }`}
                >
                  {peakNeed < 0 ? money(Math.abs(peakNeed)) : "None"}
                </div>
                <div className={styles.kpiSub}>
                  Lowest point of the forecast curve
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST VS PLAN</div>
                <div className={`${styles.kpiValue} ${tone(endGap)}`}>
                  {signedMoney(endGap) === "—" ? "On plan" : signedMoney(endGap)}
                </div>
                <div className={styles.kpiSub}>
                  Cumulative net at the last period
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CERTIFIED VALUE</div>
                <div className={styles.kpiValue}>
                  {money(Number(intel.certifiedValue))}
                </div>
                <div className={styles.kpiSub}>
                  Retention held {money(Number(intel.retentionHeld))}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PAID TO DATE</div>
                <div className={styles.kpiValue}>
                  {money(Number(intel.amountPaid))}
                </div>
                <div className={styles.kpiSub}>Received from the client</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OUTSTANDING</div>
                <div className={styles.kpiValue}>
                  {money(Number(intel.outstandingCertifiedAmount))}
                </div>
                <div
                  className={`${styles.kpiSub} ${
                    intel.overduePayments > 0 ? styles.neg : ""
                  }`}
                >
                  {intel.overduePayments} overdue payment
                  {intel.overduePayments === 1 ? "" : "s"}
                </div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">CUMULATIVE NET CASHFLOW</div>
                  <h2>Planned vs forecast vs actual</h2>
                </div>

                <span className={styles.muted}>
                  {periods.length} period{periods.length === 1 ? "" : "s"}
                </span>
              </header>

              {rows.length === 0 ? (
                <div className={styles.empty}>
                  No cashflow periods yet. Add periods in{" "}
                  <Link href={`${base}/commercial`}>commercial control</Link>{" "}
                  to see the curve.
                </div>
              ) : (
                <LineChart
                  ariaLabel="Cumulative net cashflow: planned, forecast and actual by period end"
                  formatX={formatDay}
                  formatY={money}
                  height={320}
                  refs={[{ y: 0, label: "Zero line", color: "#8a948f" }]}
                  series={series}
                />
              )}

              {rows.length > 0 && (
                <p className={styles.hint}>
                  Actual is plotted only for periods that have started, so it
                  stops at today instead of showing zeros for the future.
                </p>
              )}
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">PAYMENT AGEING</div>
                    <h2>Outstanding certified amounts</h2>
                  </div>

                  <span className={styles.muted}>
                    Total {money(ageingTotal)}
                  </span>
                </header>

                {ageingTotal === 0 ? (
                  <div className={styles.emptySmall}>
                    Nothing is outstanding on certified payment certificates.
                  </div>
                ) : (
                  <ul className={styles.ageing}>
                    {BUCKETS.map((bucket) => {
                      const entry = ageing[bucket.key];

                      return (
                        <li key={bucket.key}>
                          <div className={styles.ageingTop}>
                            <span>{bucket.label}</span>

                            <strong>
                              {money(entry.amount)}
                              <small>
                                {entry.count} certificate
                                {entry.count === 1 ? "" : "s"}
                              </small>
                            </strong>
                          </div>

                          <div className={styles.track}>
                            <div
                              className={`${styles.fill} ${bucket.tone}`}
                              style={{
                                width: `${(entry.amount / ageingMax) * 100}%`,
                              }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">COMMERCIAL POSITION</div>
                    <h2>Where the money stands</h2>
                  </div>
                </header>

                <dl className={styles.facts}>
                  <div>
                    <dt>Planned net (all periods)</dt>
                    <dd>{last ? moneyFull(last.planned) : "—"}</dd>
                  </div>

                  <div>
                    <dt>Forecast net (all periods)</dt>
                    <dd>{last ? moneyFull(last.forecast) : "—"}</dd>
                  </div>

                  <div>
                    <dt>Actual net to date</dt>
                    <dd>{moneyFull(Number(intel.actualNetCashflow))}</dd>
                  </div>

                  <div>
                    <dt>Awaiting certification</dt>
                    <dd>{intel.awaitingCertification}</dd>
                  </div>

                  <div>
                    <dt>Overdue certifications</dt>
                    <dd className={intel.overdueCertifications > 0 ? styles.neg : ""}>
                      {intel.overdueCertifications}
                    </dd>
                  </div>

                  <div>
                    <dt>Pending change orders</dt>
                    <dd>{intel.pendingChangeOrders}</dd>
                  </div>
                </dl>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PERIODS</div>
                  <h2>Cashflow by period</h2>
                </div>
              </header>

              {rows.length === 0 ? (
                <div className={styles.emptySmall}>No periods recorded.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>PERIOD</th>
                        <th className={styles.num}>PLANNED IN</th>
                        <th className={styles.num}>PLANNED OUT</th>
                        <th className={styles.num}>PLANNED NET</th>
                        <th className={styles.num}>FORECAST NET</th>
                        <th className={styles.num}>ACTUAL NET</th>
                        <th className={styles.num}>FORECAST VS PLAN</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((row) => {
                        const { period } = row;
                        const planned = Number(period.plannedNetCashflow);
                        const forecast = Number(period.forecastNetCashflow);
                        const gap = forecast - planned;

                        return (
                          <tr key={period.id}>
                            <td>
                              {formatShortDay(toDay(period.periodStart))} →{" "}
                              {formatDay(row.day)}
                            </td>
                            <td className={styles.num}>
                              {moneyFull(Number(period.plannedInflow))}
                            </td>
                            <td className={styles.num}>
                              {moneyFull(Number(period.plannedOutflow))}
                            </td>
                            <td className={`${styles.num} ${tone(planned)}`}>
                              {moneyFull(planned)}
                            </td>
                            <td className={`${styles.num} ${tone(forecast)}`}>
                              {moneyFull(forecast)}
                            </td>
                            <td className={styles.num}>
                              {row.actual === null
                                ? "—"
                                : moneyFull(Number(period.actualNetCashflow))}
                            </td>
                            <td className={`${styles.num} ${tone(gap)}`}>
                              {signedMoney(gap)}
                            </td>
                            <td>{humanize(period.status)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">CERTIFICATES</div>
                  <h2>Payment certificates</h2>
                </div>

                <span className={styles.muted}>
                  {certificates.length} total
                </span>
              </header>

              {certificates.length === 0 ? (
                <div className={styles.emptySmall}>
                  No payment certificates recorded.
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>REFERENCE</th>
                        <th>PERIOD END</th>
                        <th className={styles.num}>APPLIED</th>
                        <th className={styles.num}>CERTIFIED</th>
                        <th className={styles.num}>RETENTION</th>
                        <th className={styles.num}>PAID</th>
                        <th className={styles.num}>OUTSTANDING</th>
                        <th>PAYMENT DUE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {certificates.map((cert) => (
                        <tr key={cert.id}>
                          <td>
                            <strong>{cert.reference}</strong>
                          </td>
                          <td>{formatIso(cert.periodEnd)}</td>
                          <td className={styles.num}>
                            {moneyFull(Number(cert.applicationAmount))}
                          </td>
                          <td className={styles.num}>
                            {cert.certifiedAmount === null
                              ? "—"
                              : moneyFull(Number(cert.certifiedAmount))}
                          </td>
                          <td className={styles.num}>
                            {cert.retentionAmount === null
                              ? "—"
                              : moneyFull(Number(cert.retentionAmount))}
                          </td>
                          <td className={styles.num}>
                            {moneyFull(Number(cert.amountPaid))}
                          </td>
                          <td className={styles.num}>
                            {moneyFull(Number(cert.outstandingAmount))}
                          </td>
                          <td>{formatIso(cert.paymentDueDate)}</td>
                          <td>
                            {humanize(cert.status)}

                            {cert.overduePayment && (
                              <em className={styles.late}>PAYMENT LATE</em>
                            )}

                            {cert.overdueCertification && (
                              <em className={styles.late}>NOT CERTIFIED</em>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className={styles.note}>
              Forecast vs plan is forecast net minus planned net, so a negative
              value means less cash than planned. {intel.explanation}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
