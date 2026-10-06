"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProcurement } from "@/lib/api";
import type {
  ProcurementBid,
  ProcurementBidStatus,
  ProcurementControl,
  ProcurementPackage,
  ProcurementPackageStatus,
  ProcurementRiskLevel,
  SupplierQualificationStatus,
} from "@/types/project";

import styles from "./ProjectProcurementPipelineView.module.css";

const DAY_MS = 86_400_000;
const DEFAULT_ROWS = 14;
const FLOAT_WARNING_DAYS = 14;
const THIN_COMPETITION = 3;

const RISK_LABEL: Record<ProcurementRiskLevel, string> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<ProcurementRiskLevel, string | undefined> = {
  NO_DATA: styles.riskNone,
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const QUALIFICATION_LABEL: Record<SupplierQualificationStatus, string> = {
  PENDING: "Pending",
  QUALIFIED: "Qualified",
  CONDITIONAL: "Conditional",
  SUSPENDED: "Suspended",
  REJECTED: "Rejected",
};

const QUALIFICATION_CLASS: Record<SupplierQualificationStatus, string | undefined> = {
  PENDING: styles.riskNone,
  QUALIFIED: styles.riskGood,
  CONDITIONAL: styles.riskWatch,
  SUSPENDED: styles.riskBad,
  REJECTED: styles.riskBad,
};

const BID_STATUS_LABEL: Record<ProcurementBidStatus, string> = {
  RECEIVED: "Received",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
  SELECTED: "Selected",
};

const STAGES: ReadonlyArray<{
  key: ProcurementPackageStatus;
  label: string;
  hint: string;
}> = [
  { key: "PLANNING", label: "Planning", hint: "Not yet issued" },
  { key: "TENDERING", label: "Tendering", hint: "Out to bidders" },
  { key: "EVALUATION", label: "Evaluation", hint: "Bids being assessed" },
  { key: "AWARDED", label: "Awarded", hint: "Contract placed" },
  { key: "CLOSED", label: "Closed", hint: "Completed" },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function startOfToday(): number {
  const now = new Date();

  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS,
  );
}

function toDay(value: string | null): number {
  if (!value) {
    return NaN;
  }

  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(
    Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS,
  );
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

function formatCompactDay(day: number): string {
  if (!Number.isFinite(day)) {
    return "—";
  }

  const date = new Date(day * DAY_MS);

  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ""}`;
}

function formatTick(day: number): string {
  const date = new Date(day * DAY_MS);
  const month = MONTHS[date.getUTCMonth()] ?? "";

  return date.getUTCMonth() === 0 ? `${month} ${date.getUTCFullYear()}` : month;
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
    maximumFractionDigits: 2,
  }).format(value);
}

function moneyFull(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function signedPercent(value: number): string {
  if (Math.abs(value) < 0.05) {
    return "0.0%";
  }

  return `${value > 0 ? "+" : "−"}${num(Math.abs(value), 1)}%`;
}

function scoreScale(values: number[]): number {
  const top = Math.max(0, ...values.filter(Number.isFinite));

  return top <= 5 ? 5 : top <= 10 ? 10 : 100;
}

/* ------------------------------ Derived data ----------------------------- */

type Severity = "high" | "medium" | "low";

interface PackageInfo {
  pkg: ProcurementPackage;
  bids: ProcurementBid[];
  chosen: ProcurementBid | undefined;
  chosenIsAwarded: boolean;
  issueDay: number;
  bidDueDay: number;
  awardDueDay: number;
  awardDay: number;
  requiredDay: number;
  deliveryDays: number | null;
  deliveryDay: number;
  floatDays: number | null;
  awardSlip: number;
  finished: boolean;
}

interface Attention {
  id: string;
  packageId: string;
  severity: Severity;
  title: string;
  detail: string;
  weight: number;
}

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function buildInfo(pkg: ProcurementPackage, bids: ProcurementBid[]): PackageInfo {
  const open = bids.filter((bid) => bid.status !== "REJECTED");
  const awarded =
    bids.find((bid) => bid.status === "SELECTED") ??
    (pkg.awardedSupplierId
      ? bids.find((bid) => bid.supplierId === pkg.awardedSupplierId)
      : undefined);
  const best = [...open].sort((a, b) => b.combinedScore - a.combinedScore)[0];
  const chosen = awarded ?? best;

  const awardDay = toDay(pkg.awardDate ?? pkg.forecastAwardDate);
  const deliveryDays = chosen ? chosen.deliveryDays : null;
  const deliveryDay =
    deliveryDays !== null && Number.isFinite(awardDay)
      ? awardDay + deliveryDays
      : NaN;
  const requiredDay = toDay(pkg.requiredOnSiteDate);
  const floatDays =
    Number.isFinite(deliveryDay) && Number.isFinite(requiredDay)
      ? requiredDay - deliveryDay
      : null;

  return {
    pkg,
    bids,
    chosen,
    chosenIsAwarded: awarded !== undefined,
    issueDay: toDay(pkg.actualIssueDate ?? pkg.plannedIssueDate),
    bidDueDay: toDay(pkg.bidDueDate),
    awardDueDay: toDay(pkg.awardDueDate),
    awardDay,
    requiredDay,
    deliveryDays,
    deliveryDay,
    floatDays,
    awardSlip: pkg.awardDate
      ? NaN
      : toDay(pkg.forecastAwardDate) - toDay(pkg.awardDueDate),
    finished: pkg.status === "CLOSED" || pkg.status === "CANCELLED",
  };
}

function floatMatters(info: PackageInfo, today: number): boolean {
  if (info.finished || info.floatDays === null) {
    return false;
  }

  // Once awarded, a delivery date already in the past is assumed to be delivered.
  return info.pkg.status !== "AWARDED" || info.deliveryDay >= today;
}

function floatTone(days: number): string | undefined {
  return days < 0 ? styles.floatBad : days < FLOAT_WARNING_DAYS ? styles.floatWatch : styles.floatGood;
}

function nextDate(info: PackageInfo): string {
  const { pkg } = info;

  switch (pkg.status) {
    case "PLANNING":
      return `Issue ${formatCompactDay(toDay(pkg.plannedIssueDate))}`;
    case "TENDERING":
      return `Bids due ${formatCompactDay(info.bidDueDay)}`;
    case "EVALUATION":
      return `Award due ${formatCompactDay(info.awardDueDay)}`;
    case "AWARDED":
      return `On site ${formatCompactDay(info.requiredDay)}`;
    case "CLOSED":
      return `Awarded ${formatCompactDay(toDay(pkg.awardDate))}`;
    default:
      return "Cancelled";
  }
}

function buildAttention(
  infos: PackageInfo[],
  suppliers: Map<string, SupplierQualificationStatus>,
  today: number,
): Attention[] {
  const items: Attention[] = [];

  function add(
    info: PackageInfo,
    key: string,
    severity: Severity,
    title: string,
    detail: string,
    weight: number,
  ) {
    items.push({
      id: `${info.pkg.id}-${key}`,
      packageId: info.pkg.id,
      severity,
      title,
      detail,
      weight,
    });
  }

  for (const info of infos) {
    const { pkg } = info;

    if (info.finished) {
      continue;
    }

    if (floatMatters(info, today) && info.floatDays !== null) {
      if (info.floatDays < 0) {
        add(
          info,
          "float",
          "high",
          `${pkg.reference} will miss its site date`,
          `Estimated delivery ${formatDay(info.deliveryDay)} is ${-info.floatDays} day${
            info.floatDays === -1 ? "" : "s"
          } after the ${formatDay(info.requiredDay)} site date (award + ${info.deliveryDays} day lead time).`,
          1000 - info.floatDays,
        );
      } else if (info.floatDays < FLOAT_WARNING_DAYS) {
        add(
          info,
          "float",
          "medium",
          `${pkg.reference} has little float`,
          `Only ${info.floatDays} day${info.floatDays === 1 ? "" : "s"} between estimated delivery and the ${formatDay(info.requiredDay)} site date.`,
          500 - info.floatDays,
        );
      }
    }

    if (pkg.status === "PLANNING" && !pkg.actualIssueDate) {
      const late = today - toDay(pkg.plannedIssueDate);

      if (late > 0) {
        add(
          info,
          "issue",
          "medium",
          `${pkg.reference} not yet issued`,
          `Planned for ${formatDay(toDay(pkg.plannedIssueDate))}, ${late} day${late === 1 ? "" : "s"} ago.`,
          400 + late,
        );
      }
    }

    if (pkg.status === "TENDERING") {
      const overdue = today - info.bidDueDay;

      if (overdue > 0) {
        add(
          info,
          "bids",
          "medium",
          `${pkg.reference} bid deadline has passed`,
          `Bids were due ${overdue} day${overdue === 1 ? "" : "s"} ago but the package is still tendering.`,
          300 + overdue,
        );
      }
    }

    if (
      (pkg.status === "PLANNING" ||
        pkg.status === "TENDERING" ||
        pkg.status === "EVALUATION") &&
      Number.isFinite(info.awardSlip) &&
      info.awardSlip > 0
    ) {
      add(
        info,
        "slip",
        info.awardSlip > 14 ? "high" : "medium",
        `${pkg.reference} award is slipping`,
        `Forecast award ${formatDay(toDay(pkg.forecastAwardDate))} is ${info.awardSlip} day${
          info.awardSlip === 1 ? "" : "s"
        } after the ${formatDay(info.awardDueDay)} due date.`,
        200 + info.awardSlip,
      );
    }

    if (
      (pkg.status === "TENDERING" || pkg.status === "EVALUATION") &&
      pkg.bidCount < THIN_COMPETITION
    ) {
      add(
        info,
        "thin",
        "low",
        `${pkg.reference} has thin competition`,
        `${pkg.bidCount === 0 ? "No bids" : `Only ${pkg.bidCount} bid${pkg.bidCount === 1 ? "" : "s"}`} received; fewer than ${THIN_COMPETITION} makes price comparison weak.`,
        100 - pkg.bidCount,
      );
    }
  }

  for (const info of infos) {
    const { pkg } = info;

    if (pkg.status === "CANCELLED") {
      continue;
    }

    if (pkg.awardedSupplierId) {
      const status = suppliers.get(pkg.awardedSupplierId);

      if (status && status !== "QUALIFIED") {
        add(
          info,
          "qualification",
          status === "SUSPENDED" || status === "REJECTED" ? "high" : "medium",
          `${pkg.reference} awarded to a ${QUALIFICATION_LABEL[status].toLowerCase()} supplier`,
          `${pkg.awardedSupplierName ?? "The awarded supplier"} is ${QUALIFICATION_LABEL[status].toLowerCase()}.`,
          350,
        );
      }
    }

    if (pkg.awardedValue !== null && pkg.estimatedValue > 0) {
      const over = ((pkg.awardedValue - pkg.estimatedValue) / pkg.estimatedValue) * 100;

      if (over > 5) {
        add(
          info,
          "over",
          "medium",
          `${pkg.reference} awarded above estimate`,
          `Awarded ${moneyFull(pkg.awardedValue)} against an estimate of ${moneyFull(pkg.estimatedValue)} (${signedPercent(over)}).`,
          250 + over,
        );
      }
    }
  }

  return items.sort(
    (a, b) =>
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      b.weight - a.weight,
  );
}

export function ProjectProcurementPipelineView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ProcurementControl | null>(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAllRows, setShowAllRows] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const bidPanel = useRef<HTMLElement | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectProcurement(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError(
              "Could not load procurement data. Check that the backend is running.",
            );
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const packages = data?.packages ?? [];
    const bids = data?.bids ?? [];
    const bidsByPackage = new Map<string, ProcurementBid[]>();

    for (const bid of bids) {
      const list = bidsByPackage.get(bid.procurementPackageId) ?? [];
      list.push(bid);
      bidsByPackage.set(bid.procurementPackageId, list);
    }

    const infos = packages.map((pkg) =>
      buildInfo(pkg, bidsByPackage.get(pkg.id) ?? []),
    );

    const suppliers = new Map<string, SupplierQualificationStatus>(
      (data?.suppliers ?? []).map((item) => [item.id, item.qualificationStatus]),
    );

    const lanes = STAGES.map((stage) => {
      const members = infos
        .filter((info) => info.pkg.status === stage.key)
        .sort((a, b) => {
          const left = Number.isFinite(a.requiredDay) ? a.requiredDay : Infinity;
          const right = Number.isFinite(b.requiredDay) ? b.requiredDay : Infinity;

          return left - right;
        });

      return {
        ...stage,
        members,
        value: members.reduce((sum, info) => sum + info.pkg.estimatedValue, 0),
      };
    });

    const awardedPackages = packages.filter((pkg) => pkg.awardedValue !== null);
    const awardedValue = awardedPackages.reduce(
      (sum, pkg) => sum + (pkg.awardedValue ?? 0),
      0,
    );
    const awardedEstimate = awardedPackages.reduce(
      (sum, pkg) => sum + pkg.estimatedValue,
      0,
    );

    const scheduled = infos
      .filter(
        (info) =>
          info.pkg.status !== "CANCELLED" &&
          (showClosed || info.pkg.status !== "CLOSED"),
      )
      .sort((a, b) => {
        const left = Number.isFinite(a.requiredDay) ? a.requiredDay : Infinity;
        const right = Number.isFinite(b.requiredDay) ? b.requiredDay : Infinity;

        return left - right;
      });

    const points: number[] = [today];

    for (const info of scheduled) {
      points.push(
        info.issueDay,
        info.bidDueDay,
        info.awardDueDay,
        info.awardDay,
        info.requiredDay,
        info.deliveryDay,
      );
    }

    const finite = points.filter(Number.isFinite);
    const minDay = Math.min(...finite) - 7;
    const maxDay = Math.max(...finite) + 7;

    const ticks: number[] = [];
    const cursor = new Date(minDay * DAY_MS);
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);

    while (Math.floor(cursor.getTime() / DAY_MS) <= maxDay && ticks.length < 60) {
      ticks.push(Math.floor(cursor.getTime() / DAY_MS));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    const byId = new Map(infos.map((info) => [info.pkg.id, info]));

    const withBids = infos
      .filter((info) => info.bids.length > 0)
      .sort((a, b) => b.bids.length - a.bids.length);

    const scorecards = new Map<
      string,
      {
        id: string;
        name: string;
        count: number;
        overall: number;
        quality: number;
        delivery: number;
        safety: number;
        commercial: number;
      }
    >();

    for (const item of data?.evaluations ?? []) {
      const entry = scorecards.get(item.supplierId) ?? {
        id: item.supplierId,
        name: item.supplierName,
        count: 0,
        overall: 0,
        quality: 0,
        delivery: 0,
        safety: 0,
        commercial: 0,
      };

      entry.count += 1;
      entry.overall += item.overallScore;
      entry.quality += item.qualityScore;
      entry.delivery += item.deliveryScore;
      entry.safety += item.safetyScore;
      entry.commercial += item.commercialScore;
      scorecards.set(item.supplierId, entry);
    }

    const cards = [...scorecards.values()]
      .map((entry) => ({
        ...entry,
        overall: entry.overall / entry.count,
        quality: entry.quality / entry.count,
        delivery: entry.delivery / entry.count,
        safety: entry.safety / entry.count,
        commercial: entry.commercial / entry.count,
      }))
      .sort((a, b) => b.overall - a.overall);

    return {
      infos,
      byId,
      suppliers,
      lanes,
      cancelled: infos.filter((info) => info.pkg.status === "CANCELLED").length,
      awardedValue,
      awardedEstimate,
      scheduled,
      minDay,
      maxDay,
      ticks,
      withBids,
      cards,
      attention: buildAttention(infos, suppliers, today),
    };
  }, [data, today, showClosed]);

  const intel = data?.intelligence;

  const effectiveId =
    selectedId && model.byId.has(selectedId)
      ? selectedId
      : (model.withBids[0]?.pkg.id ?? model.infos[0]?.pkg.id ?? null);

  const selected = effectiveId ? model.byId.get(effectiveId) : undefined;

  function choose(id: string, scroll: boolean) {
    setSelectedId(id);

    if (scroll) {
      const reduce =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      window.setTimeout(() => {
        bidPanel.current?.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "start",
        });
      }, 0);
    }
  }

  const span = Math.max(1, model.maxDay - model.minDay);

  function pct(day: number): number {
    return Math.max(0, Math.min(100, ((day - model.minDay) / span) * 100));
  }

  function segment(from: number, to: number) {
    if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) {
      return null;
    }

    return {
      left: `${pct(from)}%`,
      width: `${Math.max(0.5, pct(to) - pct(from))}%`,
    };
  }

  const visibleRows = showAllRows
    ? model.scheduled
    : model.scheduled.slice(0, DEFAULT_ROWS);

  const awardedVariance =
    model.awardedEstimate > 0
      ? ((model.awardedValue - model.awardedEstimate) / model.awardedEstimate) * 100
      : null;

  const rankedBids = selected
    ? [...selected.bids].sort((a, b) => b.combinedScore - a.combinedScore)
    : [];
  const comparable = rankedBids.filter((bid) => bid.status !== "REJECTED");
  const lowest = [...comparable].sort((a, b) => a.bidAmount - b.bidAmount)[0];
  const topScore = comparable[0];
  const barMax = Math.max(
    1,
    ...rankedBids.map((bid) => bid.bidAmount),
    selected?.pkg.estimatedValue ?? 0,
  );
  const bidScale = scoreScale(
    rankedBids.flatMap((bid) => [bid.technicalScore, bid.commercialScore, bid.combinedScore]),
  );
  const cardScale = scoreScale(
    model.cards.flatMap((card) => [
      card.overall,
      card.quality,
      card.delivery,
      card.safety,
      card.commercial,
    ]),
  );

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">PROCUREMENT PIPELINE</div>

            <h1>{data ? data.project.name : "Procurement pipeline"}</h1>

            <p className={styles.subtitle}>
              Every package from planning to close-out, whether awards will land
              early enough for the site dates, and how the bids stack up. Edit
              packages, bids and awards in procurement control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/procurement`}>
            Open procurement control
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
          <div className={styles.loading}>Loading procurement…</div>
        )}

        {data && intel && (
          <>
            <section aria-label="Procurement summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>PROCUREMENT SCORE</div>
                <div className={styles.kpiValue}>
                  {Math.round(intel.procurementScore)}
                </div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.procurementRisk])}>
                    {RISK_LABEL[intel.procurementRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN PACKAGES</div>
                <div className={styles.kpiValue}>
                  {intel.openPackages}
                  <small> / {intel.totalPackages}</small>
                </div>
                <div className={styles.kpiSub}>
                  {intel.awardedPackages} awarded
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AWARD VS ESTIMATE</div>
                <div
                  className={cx(
                    styles.kpiValue,
                    awardedVariance !== null && awardedVariance > 0.05 && styles.neg,
                    awardedVariance !== null && awardedVariance < -0.05 && styles.pos,
                  )}
                >
                  {awardedVariance === null
                    ? "—"
                    : `${num(Math.abs(awardedVariance), 1)}% ${
                        awardedVariance > 0.05
                          ? "over"
                          : awardedVariance < -0.05
                            ? "under"
                            : "on estimate"
                      }`}
                </div>
                <div className={styles.kpiSub}>
                  {money(model.awardedValue)} awarded on{" "}
                  {money(model.awardedEstimate)} estimated
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COMPETITION</div>
                <div className={styles.kpiValue}>
                  {num(intel.competitionCoveragePercentage, 0)}%
                </div>
                <div className={styles.kpiSub}>
                  {intel.packagesWithCompetitiveCoverage} of {intel.totalPackages}{" "}
                  packages competitive
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DELAYED PACKAGES</div>
                <div
                  className={cx(styles.kpiValue, intel.delayedPackages > 0 && styles.neg)}
                >
                  {intel.delayedPackages}
                </div>
                <div className={styles.kpiSub}>
                  Longest award delay {intel.maximumAwardDelayDays} day
                  {intel.maximumAwardDelayDays === 1 ? "" : "s"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SUPPLIER SCORE</div>
                <div className={styles.kpiValue}>
                  {num(intel.averageSupplierPerformance, 1)}
                </div>
                <div className={styles.kpiSub}>
                  {intel.lowPerformanceEvaluations} low evaluation
                  {intel.lowPerformanceEvaluations === 1 ? "" : "s"}
                </div>
              </article>
            </section>

            {model.infos.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.empty}>
                  No procurement packages yet. Create packages in{" "}
                  <Link href={`${base}/procurement`}>procurement control</Link>{" "}
                  to see the pipeline.
                </div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">PIPELINE</div>
                      <h2>Packages by stage</h2>
                    </div>

                    <span className={styles.muted}>
                      {model.infos.length} package{model.infos.length === 1 ? "" : "s"}
                      {model.cancelled > 0 ? ` · ${model.cancelled} cancelled` : ""} ·
                      most urgent site date first
                    </span>
                  </header>

                  <div className={styles.lanes}>
                    {model.lanes.map((lane) => (
                      <section
                        aria-label={`${lane.label}: ${lane.members.length} packages`}
                        className={styles.lane}
                        key={lane.key}
                      >
                        <header className={styles.laneHead}>
                          <div>
                            <strong>{lane.label}</strong>
                            <small>{lane.hint}</small>
                          </div>
                          <div className={styles.laneCount}>
                            {lane.members.length}
                            <small>{money(lane.value)}</small>
                          </div>
                        </header>

                        <div className={styles.laneBody}>
                          {lane.members.length === 0 && (
                            <div className={styles.laneEmpty}>Nothing here</div>
                          )}

                          {lane.members.map((info) => {
                            const showFloat = floatMatters(info, today) && info.floatDays !== null;
                            const hasIssue = model.attention.some(
                              (item) => item.packageId === info.pkg.id && item.severity === "high",
                            );

                            return (
                              <button
                                aria-pressed={effectiveId === info.pkg.id}
                                className={cx(
                                  styles.card,
                                  effectiveId === info.pkg.id && styles.cardOn,
                                  hasIssue && styles.cardAlert,
                                )}
                                key={info.pkg.id}
                                onClick={() => choose(info.pkg.id, true)}
                                type="button"
                              >
                                <span className={styles.cardRef}>{info.pkg.reference}</span>
                                <span className={styles.cardTitle}>{info.pkg.title}</span>
                                <span className={styles.cardMeta}>
                                  <span>{money(info.pkg.estimatedValue)}</span>
                                  <span>{nextDate(info)}</span>
                                </span>
                                <span className={styles.cardFoot}>
                                  <span className={styles.chip}>
                                    {info.pkg.bidCount} bid{info.pkg.bidCount === 1 ? "" : "s"}
                                  </span>
                                  {showFloat && info.floatDays !== null && (
                                    <span className={cx(styles.chip, floatTone(info.floatDays))}>
                                      Float {info.floatDays}d
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    ))}
                  </div>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">SCHEDULE AND LEAD TIME</div>
                      <h2>Procurement timeline</h2>
                    </div>

                    <div className={styles.controls}>
                      <label className={styles.checkLabel}>
                        <input
                          checked={showClosed}
                          onChange={(event) => setShowClosed(event.target.checked)}
                          type="checkbox"
                        />
                        Include closed
                      </label>

                      {model.scheduled.length > DEFAULT_ROWS && (
                        <button
                          className={styles.linkButton}
                          onClick={() => setShowAllRows((value) => !value)}
                          type="button"
                        >
                          {showAllRows
                            ? `Show first ${DEFAULT_ROWS}`
                            : `Show all ${model.scheduled.length}`}
                        </button>
                      )}
                    </div>
                  </header>

                  {model.scheduled.length === 0 && (
                    <div className={styles.emptySmall}>
                      No active packages to schedule. Tick “Include closed” to see
                      finished ones.
                    </div>
                  )}

                  <div className={styles.gantt}>
                    <div className={styles.ganttAxis}>
                      <div className={styles.ganttLabelHead}>PACKAGE</div>
                      <div className={styles.ganttTrackHead}>
                        {model.ticks.map((tick) => (
                          <span
                            className={styles.tick}
                            key={tick}
                            style={{ left: `${pct(tick)}%` }}
                          >
                            {formatTick(tick)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {visibleRows.map((info) => {
                      const tender = segment(info.issueDay, info.bidDueDay);
                      const evaluation = segment(info.bidDueDay, info.awardDay);
                      const leadEnd = Number.isFinite(info.requiredDay)
                        ? Math.min(info.deliveryDay, info.requiredDay)
                        : info.deliveryDay;
                      const lead = segment(info.awardDay, leadEnd);
                      const leadLate =
                        Number.isFinite(info.requiredDay) && info.deliveryDay > info.requiredDay
                          ? segment(Math.max(info.awardDay, info.requiredDay), info.deliveryDay)
                          : null;
                      const late = info.floatDays !== null && info.floatDays < 0;
                      const summary = `${info.pkg.reference}, ${info.pkg.title}. Required on site ${formatDay(info.requiredDay)}${
                        info.floatDays !== null ? `, float ${info.floatDays} days` : ""
                      }.`;

                      return (
                        <div
                          className={cx(styles.ganttRow, effectiveId === info.pkg.id && styles.ganttRowOn)}
                          key={info.pkg.id}
                        >
                          <button
                            className={styles.ganttLabel}
                            onClick={() => choose(info.pkg.id, true)}
                            type="button"
                          >
                            <strong>{info.pkg.reference}</strong>
                            <small>{info.pkg.title}</small>
                          </button>

                          <div aria-label={summary} className={styles.ganttTrack} role="img">
                            {model.ticks.map((tick) => (
                              <span
                                className={styles.gridLine}
                                key={tick}
                                style={{ left: `${pct(tick)}%` }}
                              />
                            ))}

                            {tender && <span className={cx(styles.seg, styles.segTender)} style={tender} />}
                            {evaluation && (
                              <span className={cx(styles.seg, styles.segEval)} style={evaluation} />
                            )}
                            {lead && (
                              <span className={cx(styles.seg, styles.segLead)} style={lead} />
                            )}
                            {leadLate && (
                              <span className={cx(styles.seg, styles.segLeadLate)} style={leadLate} />
                            )}

                            {Number.isFinite(info.awardDueDay) && (
                              <span
                                className={styles.dueMark}
                                style={{ left: `${pct(info.awardDueDay)}%` }}
                                title={`Award due ${formatDay(info.awardDueDay)}`}
                              />
                            )}

                            {Number.isFinite(info.requiredDay) && (
                              <span
                                className={cx(styles.siteMark, late && styles.siteMarkLate)}
                                style={{ left: `${pct(info.requiredDay)}%` }}
                                title={`Required on site ${formatDay(info.requiredDay)}`}
                              />
                            )}

                            <span
                              aria-hidden="true"
                              className={styles.todayLine}
                              style={{ left: `${pct(today)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <ul aria-label="Timeline legend" className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.segTender)} /> Tender (issue → bids due)
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.segEval)} /> Evaluation (to award)
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.segLead)} /> Supplier lead time
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.segLeadLate)} /> Lead time past site date
                    </li>
                    <li>
                      <i className={styles.swatchSite} /> Required on site
                    </li>
                    <li>
                      <i className={styles.swatchDue} /> Award due
                    </li>
                    <li>
                      <i className={styles.swatchToday} /> Today
                    </li>
                  </ul>

                  <p className={styles.hint}>
                    Lead time uses the delivery days of the selected bid, or of
                    the best-scored live bid when nothing is selected yet,
                    counted from the award date (or the forecast award date).
                    Float is the site date minus estimated delivery.
                  </p>
                </section>

                <div className={styles.twoCol}>
                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">ATTENTION</div>
                        <h2>What needs a decision</h2>
                      </div>

                      <span className={styles.muted}>
                        {model.attention.length} item
                        {model.attention.length === 1 ? "" : "s"}
                      </span>
                    </header>

                    {model.attention.length === 0 ? (
                      <div className={styles.emptySmall}>
                        Nothing is late, thin or off-estimate. The pipeline looks healthy.
                      </div>
                    ) : (
                      <ul className={styles.attention}>
                        {model.attention.slice(0, 12).map((item) => (
                          <li key={item.id}>
                            <button
                              className={styles.attentionItem}
                              onClick={() => choose(item.packageId, true)}
                              type="button"
                            >
                              <span
                                aria-label={`${item.severity} priority`}
                                className={cx(
                                  styles.dot,
                                  item.severity === "high"
                                    ? styles.dotHigh
                                    : item.severity === "medium"
                                      ? styles.dotMedium
                                      : styles.dotLow,
                                )}
                              />
                              <span>
                                <strong>{item.title}</strong>
                                <small>{item.detail}</small>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    {model.attention.length > 12 && (
                      <p className={styles.hint}>
                        Showing the 12 most urgent of {model.attention.length}.
                      </p>
                    )}
                  </section>

                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">SUPPLIER SCORECARD</div>
                        <h2>Average evaluation</h2>
                      </div>

                      <span className={styles.muted}>
                        {data.evaluations.length} evaluation
                        {data.evaluations.length === 1 ? "" : "s"}
                      </span>
                    </header>

                    {model.cards.length === 0 ? (
                      <div className={styles.emptySmall}>
                        No supplier evaluations recorded yet.
                      </div>
                    ) : (
                      <ul className={styles.scorecards}>
                        {model.cards.slice(0, 8).map((card) => {
                          const ratio = Math.max(0, Math.min(1, card.overall / cardScale));

                          return (
                            <li key={card.id}>
                              <div className={styles.scoreTop}>
                                <strong>{card.name}</strong>
                                <span>
                                  {num(card.overall, 1)}
                                  <small>
                                    {card.count} eval{card.count === 1 ? "" : "s"}
                                  </small>
                                </span>
                              </div>

                              <div className={styles.track}>
                                <div
                                  className={cx(
                                    styles.fill,
                                    ratio >= 0.75
                                      ? styles.toneGood
                                      : ratio >= 0.6
                                        ? styles.toneWatch
                                        : styles.toneBad,
                                  )}
                                  style={{ width: `${ratio * 100}%` }}
                                />
                              </div>

                              <div className={styles.subScores}>
                                <span>Quality {num(card.quality, 1)}</span>
                                <span>Delivery {num(card.delivery, 1)}</span>
                                <span>Safety {num(card.safety, 1)}</span>
                                <span>Commercial {num(card.commercial, 1)}</span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                </div>

                <section className={styles.panel} ref={bidPanel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">BID COMPARISON</div>
                      <h2>
                        {selected
                          ? `${selected.pkg.reference} · ${selected.pkg.title}`
                          : "Select a package"}
                      </h2>
                    </div>

                    <label className={styles.picker}>
                      <span>Package</span>
                      <select
                        onChange={(event) => choose(event.target.value, false)}
                        value={effectiveId ?? ""}
                      >
                        {model.infos.map((info) => (
                          <option key={info.pkg.id} value={info.pkg.id}>
                            {info.pkg.reference} — {info.pkg.title} ({info.bids.length})
                          </option>
                        ))}
                      </select>
                    </label>
                  </header>

                  {selected && (
                    <>
                      <dl className={styles.facts}>
                        <div>
                          <dt>Estimate</dt>
                          <dd>{moneyFull(selected.pkg.estimatedValue)}</dd>
                        </div>
                        <div>
                          <dt>Awarded</dt>
                          <dd>
                            {selected.pkg.awardedValue === null
                              ? "—"
                              : moneyFull(selected.pkg.awardedValue)}
                          </dd>
                        </div>
                        <div>
                          <dt>Bids due</dt>
                          <dd>{formatDay(selected.bidDueDay)}</dd>
                        </div>
                        <div>
                          <dt>Award due / forecast</dt>
                          <dd>
                            {formatDay(selected.awardDueDay)} /{" "}
                            {formatDay(toDay(selected.pkg.forecastAwardDate))}
                          </dd>
                        </div>
                        <div>
                          <dt>Required on site</dt>
                          <dd>{formatDay(selected.requiredDay)}</dd>
                        </div>
                        <div>
                          <dt>Float</dt>
                          <dd
                            className={
                              selected.floatDays !== null && selected.floatDays < 0
                                ? styles.neg
                                : ""
                            }
                          >
                            {selected.floatDays === null
                              ? "No bid to estimate from"
                              : `${selected.floatDays} day${Math.abs(selected.floatDays) === 1 ? "" : "s"}`}
                          </dd>
                        </div>
                      </dl>

                      {rankedBids.length === 0 ? (
                        <div className={styles.emptySmall}>
                          No bids recorded for this package yet.
                        </div>
                      ) : (
                        <>
                          {lowest && topScore && lowest.id !== topScore.id && (
                            <div className={styles.callout}>
                              The cheapest live bid ({lowest.supplierName},{" "}
                              {moneyFull(lowest.bidAmount)}) is not the best-scored.{" "}
                              {topScore.supplierName} leads on combined score (
                              {num(topScore.combinedScore, 1)} vs{" "}
                              {num(lowest.combinedScore, 1)}) at{" "}
                              {moneyFull(topScore.bidAmount)}, which is{" "}
                              {num(
                                Math.abs(
                                  ((topScore.bidAmount - lowest.bidAmount) / lowest.bidAmount) * 100,
                                ),
                                1,
                              )}
                              % {topScore.bidAmount >= lowest.bidAmount ? "more" : "less"} than the
                              cheapest.
                            </div>
                          )}

                          <div className={styles.tableWrap}>
                            <table className={styles.table}>
                              <thead>
                                <tr>
                                  <th>#</th>
                                  <th>SUPPLIER</th>
                                  <th>BID</th>
                                  <th className={styles.amountHead}>AMOUNT VS ESTIMATE</th>
                                  <th className={styles.num}>VS LOWEST</th>
                                  <th className={styles.num}>TECHNICAL</th>
                                  <th className={styles.num}>COMMERCIAL</th>
                                  <th className={styles.scoreHead}>COMBINED</th>
                                  <th className={styles.num}>DELIVERY</th>
                                </tr>
                              </thead>

                              <tbody>
                                {rankedBids.map((bid, index) => {
                                  const rejected = bid.status === "REJECTED";
                                  const versusLowest =
                                    lowest && lowest.bidAmount > 0
                                      ? ((bid.bidAmount - lowest.bidAmount) / lowest.bidAmount) * 100
                                      : null;
                                  const versusEstimate =
                                    selected.pkg.estimatedValue > 0
                                      ? ((bid.bidAmount - selected.pkg.estimatedValue) /
                                          selected.pkg.estimatedValue) *
                                        100
                                      : null;

                                  return (
                                    <tr className={rejected ? styles.rowMuted : ""} key={bid.id}>
                                      <td>{index + 1}</td>
                                      <td>
                                        <strong>{bid.supplierName}</strong>
                                        <div className={styles.supplierMeta}>
                                          <span
                                            className={cx(
                                              styles.pill,
                                              styles.pillSmall,
                                              QUALIFICATION_CLASS[bid.supplierQualificationStatus],
                                            )}
                                          >
                                            {QUALIFICATION_LABEL[bid.supplierQualificationStatus]}
                                          </span>
                                          {lowest?.id === bid.id && (
                                            <em className={styles.badge}>LOWEST PRICE</em>
                                          )}
                                          {topScore?.id === bid.id && (
                                            <em className={cx(styles.badge, styles.badgeGood)}>TOP SCORE</em>
                                          )}
                                        </div>
                                      </td>
                                      <td>{BID_STATUS_LABEL[bid.status]}</td>
                                      <td className={styles.amountCell}>
                                        <div className={styles.amountTrack}>
                                          <div
                                            className={cx(styles.amountFill, rejected && styles.amountFillMuted)}
                                            style={{ width: `${(bid.bidAmount / barMax) * 100}%` }}
                                          />
                                          <span
                                            className={styles.estimateMark}
                                            style={{
                                              left: `${Math.min(100, (selected.pkg.estimatedValue / barMax) * 100)}%`,
                                            }}
                                            title={`Estimate ${moneyFull(selected.pkg.estimatedValue)}`}
                                          />
                                        </div>
                                        <div className={styles.amountText}>
                                          <strong>{moneyFull(bid.bidAmount)}</strong>
                                          {versusEstimate !== null && (
                                            <small
                                              className={
                                                versusEstimate > 0.05
                                                  ? styles.neg
                                                  : versusEstimate < -0.05
                                                    ? styles.pos
                                                    : ""
                                              }
                                            >
                                              {signedPercent(versusEstimate)}
                                            </small>
                                          )}
                                        </div>
                                      </td>
                                      <td className={styles.num}>
                                        {versusLowest === null || bid.id === lowest?.id
                                          ? "—"
                                          : signedPercent(versusLowest)}
                                      </td>
                                      <td className={styles.num}>{num(bid.technicalScore, 1)}</td>
                                      <td className={styles.num}>{num(bid.commercialScore, 1)}</td>
                                      <td className={styles.scoreCell}>
                                        <div className={styles.track}>
                                          <div
                                            className={cx(styles.fill, styles.toneGood)}
                                            style={{
                                              width: `${Math.max(0, Math.min(100, (bid.combinedScore / bidScale) * 100))}%`,
                                            }}
                                          />
                                        </div>
                                        <strong>{num(bid.combinedScore, 1)}</strong>
                                      </td>
                                      <td className={styles.num}>{bid.deliveryDays} d</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <p className={styles.hint}>
                            The dark tick on each amount bar is the package
                            estimate. Rejected bids are greyed out and excluded
                            from the lowest-price and top-score badges.
                          </p>
                        </>
                      )}
                    </>
                  )}
                </section>
              </>
            )}

            <p className={styles.note}>
              {intel.explanation} Float, slips and thin-competition flags are
              calculated here from the package dates and bids; thin means fewer
              than {THIN_COMPETITION} bids.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
