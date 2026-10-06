"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectCommercial, getProjectRiskControl } from "@/lib/api";
import type {
  ChangeEventStatus,
  CommercialChangeOrder,
  CommercialChangeOrderStatus,
  CommercialClaim,
  CommercialClaimStatus,
  CommercialClaimType,
  CommercialControl,
  DelayCause,
  ProjectChangeEvent,
  RiskControl,
} from "@/types/project";

import styles from "./ProjectEntitlementBoardView.module.css";

const DAY_MS = 86_400_000;
const LIST_LIMIT = 10;
const MIN_DECIDED_FOR_YIELD = 3;

type TraceFilter = "action" | "pending" | "all";
type TraceState = "none" | "draft" | "client" | "approved" | "rejected";

const CHANGE_LABEL: Record<ChangeEventStatus, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  IMPLEMENTED: "Implemented",
  REJECTED: "Rejected",
};

const ORDER_LABEL: Record<CommercialChangeOrderStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  VOID: "Void",
};

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

const CLAIM_TYPE_LABEL: Record<CommercialClaimType, string> = {
  EXTENSION_OF_TIME: "Extension of time",
  LOSS_AND_EXPENSE: "Loss and expense",
  VARIATION: "Variation",
  DISRUPTION: "Disruption",
  DELAY: "Delay",
  OTHER: "Other",
};

const CAUSE_LABEL: Record<DelayCause, string> = {
  CLIENT: "Client",
  DESIGN: "Design",
  PROCUREMENT: "Procurement",
  SUBCONTRACTOR: "Subcontractor",
  WEATHER: "Weather",
  SITE_CONDITION: "Site conditions",
  REGULATORY: "Regulatory",
  OTHER: "Other",
};

const TRACE_LABEL: Record<TraceState, string> = {
  none: "No change order",
  draft: "Change order in draft",
  client: "With the client",
  approved: "Approved",
  rejected: "Rejected",
};

const TRACE_CLASS: Record<TraceState, string | undefined> = {
  none: styles.traceNone,
  draft: styles.traceDraft,
  client: styles.traceClient,
  approved: styles.traceApproved,
  rejected: styles.traceRejected,
};

const CLIENT_STATES: ReadonlyArray<CommercialChangeOrderStatus> = ["SUBMITTED", "UNDER_REVIEW"];
const SENT_STATES: ReadonlyArray<CommercialChangeOrderStatus> = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"];
const CLAIM_SENT: ReadonlyArray<CommercialClaimStatus> = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "PARTIALLY_APPROVED",
  "APPROVED",
  "REJECTED",
  "SETTLED",
];
const CLAIM_PENDING: ReadonlyArray<CommercialClaimStatus> = ["SUBMITTED", "UNDER_REVIEW"];

const STAGE_COLOR = {
  identified: "#c3c9c5",
  priced: "#9cc9b2",
  sent: "#6fa88c",
  approved: "#2f6f55",
} as const;

const DAYS_COLOR = {
  excusable: "#dcb85e",
  claimed: "#6fa88c",
  awarded: "#2f6f55",
} as const;

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function startOfToday(): number {
  const now = new Date();

  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

function toDay(value: string | null | undefined): number {
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

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function trunc(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

interface TraceRow {
  change: ProjectChangeEvent;
  orders: CommercialChangeOrder[];
  state: TraceState;
  submitted: number;
  approved: number;
  waiting: number;
  leak: boolean;
}

function stateOf(orders: ReadonlyArray<CommercialChangeOrder>): TraceState {
  if (orders.length === 0) {
    return "none";
  }

  if (orders.some((order) => order.status === "APPROVED")) {
    return "approved";
  }

  if (orders.some((order) => CLIENT_STATES.includes(order.status))) {
    return "client";
  }

  if (orders.every((order) => order.status === "REJECTED")) {
    return "rejected";
  }

  return "draft";
}

export function ProjectEntitlementBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [risk, setRisk] = useState<RiskControl | null>(null);
  const [commercial, setCommercial] = useState<CommercialControl | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [filter, setFilter] = useState<TraceFilter | null>(null);
  const [showAll, setShowAll] = useState(false);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    Promise.allSettled([getProjectRiskControl(projectId), getProjectCommercial(projectId)]).then(([riskResult, commercialResult]) => {
      if (cancelled) {
        return;
      }

      setRisk(riskResult.status === "fulfilled" ? riskResult.value : null);
      setCommercial(commercialResult.status === "fulfilled" ? commercialResult.value : null);
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const changes = risk?.changes ?? [];
    const delays = risk?.delays ?? [];
    const orders = (commercial?.changeOrders ?? []).filter((order) => order.status !== "VOID");
    const claims = (commercial?.claims ?? []).filter((claim) => claim.status !== "VOID");

    const ordersByChange = new Map<string, CommercialChangeOrder[]>();

    for (const order of orders) {
      if (order.sourceChangeReference) {
        const list = ordersByChange.get(order.sourceChangeReference) ?? [];

        list.push(order);
        ordersByChange.set(order.sourceChangeReference, list);
      }
    }

    const live = changes.filter((item) => item.status !== "REJECTED");
    const identified = live.reduce((sum, item) => sum + item.costImpact, 0);

    const trace: TraceRow[] = live.map((change) => {
      const linked = ordersByChange.get(change.reference) ?? [];
      const state = stateOf(linked);

      return {
        change,
        orders: linked,
        state,
        submitted: linked.reduce((sum, order) => sum + order.submittedAmount, 0),
        approved: linked.reduce((sum, order) => sum + (order.status === "APPROVED" ? (order.approvedAmount ?? 0) : 0), 0),
        waiting: Math.max(0, today - toDay(change.requestedDate)),
        leak: state === "none" && (change.status === "APPROVED" || change.status === "IMPLEMENTED"),
      };
    });

    const unpriced = trace.filter((row) => row.state === "none");
    const unpricedValue = unpriced.reduce((sum, row) => sum + row.change.costImpact, 0);
    const leaks = unpriced.filter((row) => row.leak);
    const leakValue = leaks.reduce((sum, row) => sum + row.change.costImpact, 0);

    const knownRefs = new Set(changes.map((item) => item.reference));
    const standalone = orders.filter((order) => !order.sourceChangeReference || !knownRefs.has(order.sourceChangeReference));

    const pricedValue = orders.reduce((sum, order) => sum + order.submittedAmount, 0);
    const sent = orders.filter((order) => SENT_STATES.includes(order.status));
    const sentValue = sent.reduce((sum, order) => sum + order.submittedAmount, 0);
    const approvedOrders = orders.filter((order) => order.status === "APPROVED");
    const approvedValue = approvedOrders.reduce((sum, order) => sum + (order.approvedAmount ?? 0), 0);

    const pendingOrders = orders.filter((order) => CLIENT_STATES.includes(order.status));
    const pendingValue = pendingOrders.reduce((sum, order) => sum + order.submittedAmount, 0);

    const decided = orders.filter((order) => order.status === "APPROVED" || order.status === "REJECTED");
    const decidedValue = decided.reduce((sum, order) => sum + order.submittedAmount, 0);
    const yieldRate = decided.length >= MIN_DECIDED_FOR_YIELD && decidedValue > 0 ? approvedValue / decidedValue : null;

    const claimsSent = claims.filter((claim) => CLAIM_SENT.includes(claim.status));
    const claimsPending = claims.filter((claim) => CLAIM_PENDING.includes(claim.status));
    const claimsPendingValue = claimsPending.reduce((sum, claim) => sum + claim.claimedAmount, 0);
    const claimedValue = claimsSent.reduce((sum, claim) => sum + claim.claimedAmount, 0);
    const awardedValue = claimsSent.reduce((sum, claim) => sum + (claim.awardedAmount ?? 0), 0);
    const claimedDays = claimsSent.reduce((sum, claim) => sum + claim.claimedDays, 0);
    const awardedDays = claimsSent.reduce((sum, claim) => sum + claim.awardedDays, 0);
    const draftClaims = claims.filter((claim) => claim.status === "DRAFT");

    const funnel = [
      { key: "identified", label: "Identified in change events", value: identified, note: `${live.length} ${plural(live.length, "event", "events")}` },
      { key: "priced", label: "Priced as change orders", value: pricedValue, note: `${orders.length} ${plural(orders.length, "order", "orders")}` },
      { key: "sent", label: "Submitted to the client", value: sentValue, note: `${sent.length} ${plural(sent.length, "order", "orders")}` },
      { key: "approved", label: "Approved", value: approvedValue, note: `${approvedOrders.length} ${plural(approvedOrders.length, "order", "orders")}` },
    ] as const;

    const excusableDays = delays.filter((delay) => delay.excusable).reduce((sum, delay) => sum + delay.forecastDelayDays, 0);
    const compensableDays = delays
      .filter((delay) => delay.excusable && delay.compensable)
      .reduce((sum, delay) => sum + delay.forecastDelayDays, 0);
    const culpableDays = delays.filter((delay) => !delay.excusable).reduce((sum, delay) => sum + delay.forecastDelayDays, 0);
    const runningDays = delays
      .filter((delay) => delay.excusable && delay.status !== "RESOLVED")
      .reduce((sum, delay) => sum + delay.forecastDelayDays, 0);

    const causeMap = new Map<DelayCause, { cause: DelayCause; events: number; excusable: number; compensable: number; culpable: number }>();

    for (const delay of delays) {
      const found = causeMap.get(delay.cause) ?? { cause: delay.cause, events: 0, excusable: 0, compensable: 0, culpable: 0 };

      found.events += 1;

      if (delay.excusable && delay.compensable) {
        found.compensable += delay.forecastDelayDays;
      } else if (delay.excusable) {
        found.excusable += delay.forecastDelayDays;
      } else {
        found.culpable += delay.forecastDelayDays;
      }

      causeMap.set(delay.cause, found);
    }

    const causes = [...causeMap.values()].sort(
      (a, b) => b.compensable + b.excusable + b.culpable - (a.compensable + a.excusable + a.culpable),
    );

    const traceCounts = {
      action: trace.filter((row) => row.state === "none").length,
      pending: trace.filter((row) => row.state === "client").length,
      all: trace.length,
    };

    return {
      changes,
      delays,
      orders,
      claims,
      identified,
      trace,
      traceCounts,
      unpriced,
      unpricedValue,
      leaks,
      leakValue,
      standalone,
      standaloneValue: standalone.reduce((sum, order) => sum + order.submittedAmount, 0),
      funnel,
      funnelMax: Math.max(1, ...funnel.map((item) => Math.abs(item.value))),
      pendingOrders,
      pendingValue,
      claimsPending,
      claimsPendingValue,
      approvedValue,
      approvedOrders,
      decidedCount: decided.length,
      yieldRate,
      expectedFromPending: yieldRate === null ? null : pendingValue * yieldRate,
      claimedValue,
      awardedValue,
      claimedDays,
      awardedDays,
      draftClaims,
      excusableDays,
      compensableDays,
      culpableDays,
      runningDays,
      daysGap: excusableDays - claimedDays,
      daysMax: Math.max(1, excusableDays, claimedDays, awardedDays),
      causes,
    };
  }, [risk, commercial, today]);

  const activeFilter: TraceFilter = filter ?? (model.traceCounts.action > 0 ? "action" : "all");

  const traceRows = useMemo(() => {
    const rows = model.trace.filter((row) =>
      activeFilter === "all" ? true : activeFilter === "action" ? row.state === "none" : row.state === "client",
    );

    return rows.sort(
      (a, b) =>
        Number(b.leak) - Number(a.leak) ||
        Math.abs(b.change.costImpact) - Math.abs(a.change.costImpact) ||
        a.change.reference.localeCompare(b.change.reference),
    );
  }, [model.trace, activeFilter]);

  const shownRows = showAll ? traceRows : traceRows.slice(0, LIST_LIMIT);
  const failedBoth = loaded && !risk && !commercial;
  const hasData = model.changes.length + model.delays.length + model.orders.length + model.claims.length > 0;
  const partial = loaded && !failedBoth && (!risk || !commercial);
  const totalAmount = model.approvedValue + model.awardedValue;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">ENTITLEMENT BOARD</div>

            <h1>What the project is owed</h1>

            <p className={styles.subtitle}>
              Change events and delay events traced through to change orders and claims, so work that has been identified but not
              priced, or time that has been lost but not claimed, is easy to see.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/commercial`}>
            Open commercial control
          </Link>
        </header>

        {!loaded && <div className={styles.loading}>Loading change and claim data…</div>}

        {failedBoth && (
          <div className="offline-banner">
            <div>
              <strong>Could not load change and claim data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {partial && (
          <div className="offline-banner">
            <div>
              <strong>Could not load {risk ? "commercial" : "risk"} data.</strong>
              <span>
                {" "}
                {risk
                  ? "Change orders and claims are missing, so every change event looks unpriced."
                  : "Change events and delays are missing, so change orders cannot be traced back."}
              </span>
            </div>
          </div>
        )}

        {loaded && !failedBoth && !hasData && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>
              No change events, delays, change orders or claims are recorded yet. Record them in risk control and commercial control,
              and they will be traced here.
            </div>
          </section>
        )}

        {loaded && !failedBoth && hasData && (
          <>
            <section aria-label="Entitlement summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>NOT YET PRICED</div>
                <div className={styles.kpiValue}>{money(model.unpricedValue)}</div>
                <div className={styles.kpiSub}>
                  {model.unpriced.length} {plural(model.unpriced.length, "change event has", "change events have")} no change order
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>APPROVED, NOT PRICED</div>
                <div className={cx(styles.kpiValue, model.leakValue > 0 && styles.neg)}>{money(model.leakValue)}</div>
                <div className={styles.kpiSub}>
                  {model.leaks.length} approved or implemented {plural(model.leaks.length, "change", "changes")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WITH THE CLIENT</div>
                <div className={styles.kpiValue}>{money(model.pendingValue + model.claimsPendingValue)}</div>
                <div className={styles.kpiSub}>
                  {model.pendingOrders.length} {plural(model.pendingOrders.length, "change order", "change orders")} ·{" "}
                  {model.claimsPending.length} {plural(model.claimsPending.length, "claim", "claims")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>APPROVED OR AWARDED</div>
                <div className={cx(styles.kpiValue, totalAmount > 0 && styles.pos)}>{money(totalAmount)}</div>
                <div className={styles.kpiSub}>
                  {money(model.approvedValue)} change orders · {money(model.awardedValue)} claims
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TIME CLAIMED</div>
                <div className={styles.kpiValue}>{num(model.claimedDays)} d</div>
                <div className={styles.kpiSub}>of {num(model.excusableDays)} excusable delay days</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TIME AWARDED</div>
                <div className={cx(styles.kpiValue, model.awardedDays > 0 && styles.pos)}>{num(model.awardedDays)} d</div>
                <div className={styles.kpiSub}>
                  {model.claimedDays > 0 ? `${num(percent(model.awardedDays, model.claimedDays))}% of claimed` : "nothing claimed yet"}
                </div>
              </article>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">MONEY</div>
                    <h2>From change to approved money</h2>
                  </div>
                </header>

                <ul className={styles.ageing}>
                  {model.funnel.map((stage) => (
                    <li key={stage.key}>
                      <div className={styles.ageingTop}>
                        <span>{stage.label}</span>
                        <strong>
                          {money(stage.value)}
                          <small>{stage.note}</small>
                        </strong>
                      </div>

                      <div
                        aria-label={`${stage.label}: ${money(stage.value)}`}
                        className={styles.track}
                        role="img"
                      >
                        <div
                          className={styles.fill}
                          style={{
                            background: STAGE_COLOR[stage.key],
                            width: `${Math.max(1.5, percent(Math.abs(stage.value), model.funnelMax))}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>

                {model.leakValue > 0 && (
                  <p className={styles.callout}>
                    {money(model.leakValue)} of approved or implemented change has no change order, so it has not been priced to the
                    client.
                  </p>
                )}

                {model.yieldRate !== null && model.expectedFromPending !== null && (
                  <p className={styles.callout}>
                    So far {num(model.yieldRate * 100)}% of the value of decided change orders was approved ({model.decidedCount} decided).
                    If that holds, the {money(model.pendingValue)} still with the client would settle at about{" "}
                    {money(model.expectedFromPending)}.
                  </p>
                )}

                {model.yieldRate === null && model.pendingOrders.length > 0 && (
                  <p className={styles.hint}>
                    Fewer than {MIN_DECIDED_FOR_YIELD} change orders have been decided, so no approval rate is estimated yet.
                  </p>
                )}

                {model.standalone.length > 0 && (
                  <p className={styles.hint}>
                    {model.standalone.length} {plural(model.standalone.length, "change order", "change orders")} worth{" "}
                    {money(model.standaloneValue)} {plural(model.standalone.length, "is", "are")} not linked to a change event. They are
                    counted from the second bar onwards.
                  </p>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">TIME</div>
                    <h2>From delay to awarded days</h2>
                  </div>

                  <span className={styles.muted}>{model.delays.length} delay events</span>
                </header>

                <ul className={styles.ageing}>
                  {(
                    [
                      ["excusable", "Excusable delay recorded", model.excusableDays, `${num(model.compensableDays)} d also compensable`],
                      ["claimed", "Claimed", model.claimedDays, `${model.claims.length - model.draftClaims.length} submitted`],
                      ["awarded", "Awarded", model.awardedDays, `${money(model.awardedValue)} awarded`],
                    ] as const
                  ).map(([key, label, value, note]) => (
                    <li key={key}>
                      <div className={styles.ageingTop}>
                        <span>{label}</span>
                        <strong>
                          {num(value)} d<small>{note}</small>
                        </strong>
                      </div>

                      <div aria-label={`${label}: ${num(value)} days`} className={styles.track} role="img">
                        <div
                          className={styles.fill}
                          style={{ background: DAYS_COLOR[key], width: `${Math.max(1.5, percent(value, model.daysMax))}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>

                {model.daysGap > 0 && (
                  <p className={styles.callout}>
                    {num(model.daysGap)} excusable delay {plural(model.daysGap, "day has", "days have")} not been claimed
                    {model.runningDays > 0 ? `, and ${num(model.runningDays)} of the delay days are still running` : ""}. Delays can
                    overlap, so treat this as an upper limit.
                  </p>
                )}

                {model.daysGap <= 0 && model.excusableDays > 0 && (
                  <p className={styles.callout}>Claimed time covers the excusable delay recorded so far.</p>
                )}

                {model.culpableDays > 0 && (
                  <p className={styles.hint}>
                    {num(model.culpableDays)} delay {plural(model.culpableDays, "day is", "days are")} not excusable, so no time can be
                    claimed for {plural(model.culpableDays, "it", "them")}.
                  </p>
                )}

                {model.draftClaims.length > 0 && (
                  <p className={styles.hint}>
                    {model.draftClaims.length} draft {plural(model.draftClaims.length, "claim is", "claims are")} not counted until{" "}
                    {plural(model.draftClaims.length, "it is", "they are")} submitted.
                  </p>
                )}

                <h3 className={styles.subhead}>Delay days by cause</h3>

                {model.causes.length === 0 ? (
                  <div className={styles.emptySmall}>No delay events recorded.</div>
                ) : (
                  <>
                    <p className={styles.swipe}>Swipe sideways to see every column.</p>

                    <div className={styles.tableWrap}>
                      <table className={cx(styles.table, styles.compact)}>
                        <thead>
                          <tr>
                            <th>CAUSE</th>
                            <th className={styles.num}>EVENTS</th>
                            <th className={styles.num}>COMPENSABLE</th>
                            <th className={styles.num}>EXCUSABLE</th>
                            <th className={styles.num}>NOT EXCUSABLE</th>
                          </tr>
                        </thead>

                        <tbody>
                          {model.causes.map((row) => (
                            <tr key={row.cause}>
                              <td>{CAUSE_LABEL[row.cause]}</td>
                              <td className={styles.num}>{row.events}</td>
                              <td className={styles.num}>{row.compensable > 0 ? `${num(row.compensable)} d` : "—"}</td>
                              <td className={styles.num}>{row.excusable > 0 ? `${num(row.excusable)} d` : "—"}</td>
                              <td className={styles.num}>{row.culpable > 0 ? `${num(row.culpable)} d` : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">TRACE</div>
                  <h2>Change events and where each one stands</h2>
                </div>

                <div className={styles.controls}>
                  <div aria-label="Filter change events" className={styles.segmented} role="group">
                    {(
                      [
                        ["action", `No change order ${model.traceCounts.action}`],
                        ["pending", `With the client ${model.traceCounts.pending}`],
                        ["all", `All ${model.traceCounts.all}`],
                      ] as const
                    ).map(([key, label]) => (
                      <button
                        aria-pressed={activeFilter === key}
                        className={cx(styles.segment, activeFilter === key && styles.segmentOn)}
                        key={key}
                        onClick={() => {
                          setFilter(key);
                          setShowAll(false);
                        }}
                        type="button"
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {traceRows.length > LIST_LIMIT && (
                    <button className={styles.linkButton} onClick={() => setShowAll((value) => !value)} type="button">
                      {showAll ? `Show first ${LIST_LIMIT}` : `Show all ${traceRows.length}`}
                    </button>
                  )}
                </div>
              </header>

              {traceRows.length === 0 ? (
                <div className={styles.emptySmall}>
                  {model.trace.length === 0
                    ? "No change events recorded."
                    : activeFilter === "action"
                      ? "Every change event has a change order."
                      : "Nothing is waiting with the client."}
                </div>
              ) : (
                <>
                  <p className={styles.swipe}>Swipe sideways to see every column.</p>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>CHANGE EVENT</th>
                          <th>EVENT STATUS</th>
                          <th className={styles.num}>COST IMPACT</th>
                          <th className={styles.num}>WAITING</th>
                          <th>CHANGE ORDER</th>
                          <th className={styles.num}>SUBMITTED</th>
                          <th className={styles.num}>APPROVED</th>
                        </tr>
                      </thead>

                      <tbody>
                        {shownRows.map((row) => (
                          <tr key={row.change.id}>
                            <td className={styles.wrap}>
                              <strong>{row.change.reference}</strong>
                              <span className={styles.cellSub}>{trunc(row.change.title, 60)}</span>
                            </td>
                            <td>{CHANGE_LABEL[row.change.status]}</td>
                            <td className={styles.num}>{money(row.change.costImpact)}</td>
                            <td className={cx(styles.num, row.leak && styles.neg)}>
                              {row.waiting} d
                            </td>
                            <td>
                              <span className={cx(styles.trace, TRACE_CLASS[row.state])}>{TRACE_LABEL[row.state]}</span>
                              {row.orders.length > 0 && (
                                <span className={styles.cellSub}>
                                  {row.orders
                                    .slice(0, 2)
                                    .map((order) => `${order.reference} ${ORDER_LABEL[order.status].toLowerCase()}`)
                                    .join(" · ")}
                                  {row.orders.length > 2 ? ` · +${row.orders.length - 2} more` : ""}
                                </span>
                              )}
                              {row.leak && <span className={cx(styles.cellSub, styles.neg)}>Approved but never priced</span>}
                            </td>
                            <td className={styles.num}>{row.orders.length > 0 ? money(row.submitted) : "—"}</td>
                            <td className={styles.num}>{row.orders.length > 0 ? money(row.approved) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">CLAIMS</div>
                  <h2>Claims and what they have recovered</h2>
                </div>

                <span className={styles.muted}>
                  {money(model.claimedValue)} claimed · {money(model.awardedValue)} awarded
                </span>
              </header>

              {model.claims.length === 0 ? (
                <div className={styles.emptySmall}>No claims recorded.</div>
              ) : (
                <>
                  <p className={styles.swipe}>Swipe sideways to see every column.</p>

                  <div className={styles.tableWrap}>
                    <table className={cx(styles.table, styles.compact)}>
                      <thead>
                        <tr>
                          <th>CLAIM</th>
                          <th>STATUS</th>
                          <th className={styles.num}>DAYS</th>
                          <th className={styles.num}>CLAIMED</th>
                          <th className={styles.num}>AWARDED</th>
                        </tr>
                      </thead>

                      <tbody>
                        {[...model.claims]
                          .sort((a, b) => b.claimedAmount - a.claimedAmount)
                          .slice(0, LIST_LIMIT)
                          .map((claim: CommercialClaim) => (
                            <tr key={claim.id}>
                              <td className={styles.wrap}>
                                <strong>{claim.reference}</strong>
                                <span className={styles.cellSub}>
                                  {CLAIM_TYPE_LABEL[claim.claimType]} · {trunc(claim.title, 40)}
                                </span>
                              </td>
                              <td>
                                {CLAIM_STATUS_LABEL[claim.status]}
                                {claim.overdueResponse && <i className={styles.late}>RESPONSE LATE</i>}
                                {claim.responseDueDate && CLAIM_PENDING.includes(claim.status) && (
                                  <span className={styles.cellSub}>reply due {formatDay(toDay(claim.responseDueDate))}</span>
                                )}
                              </td>
                              <td className={styles.num}>
                                {claim.awardedDays} / {claim.claimedDays}
                              </td>
                              <td className={styles.num}>{money(claim.claimedAmount)}</td>
                              <td className={styles.num}>{claim.awardedAmount === null ? "—" : money(claim.awardedAmount)}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>

                  {model.claims.length > LIST_LIMIT && (
                    <p className={styles.hint}>
                      Showing the {LIST_LIMIT} largest of {model.claims.length} claims. The rest are in commercial control.
                    </p>
                  )}
                </>
              )}
            </section>

            <p className={styles.note}>
              A change event counts as priced when a change order names it as its source. Identified value leaves out rejected change
              events. Excusable delay days are the forecast days on delay events marked excusable, and compensable ones are also marked
              compensable. Days claimed and awarded come from claims that are not draft or void. The approval rate is the approved value
              of decided change orders divided by what was submitted, and is only a rough guide.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
