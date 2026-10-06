"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectDocuments } from "@/lib/api";
import type {
  DocumentControl,
  DocumentDiscipline,
  InformationRiskLevel,
  ProjectRfi,
  RfiPriority,
} from "@/types/project";

import styles from "./ProjectRfiBoardView.module.css";

const DAY_MS = 86_400_000;
const MONTH_WINDOW = 12;
const STALE_DRAFT_DAYS = 7;
const LIST_LIMIT = 10;
const OWNER_LIMIT = 8;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const RISK_LABEL: Record<InformationRiskLevel, string> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<InformationRiskLevel, string | undefined> = {
  NO_DATA: styles.riskNone,
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const PRIORITIES: ReadonlyArray<RfiPriority> = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const PRIORITY_LABEL: Record<RfiPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const PRIORITY_COLOR: Record<RfiPriority, string> = {
  LOW: "#a9c1b8",
  MEDIUM: "#dcb85e",
  HIGH: "#d9823a",
  CRITICAL: "#b5493e",
};

const PRIORITY_CLASS: Record<RfiPriority, string | undefined> = {
  LOW: styles.sevLow,
  MEDIUM: styles.sevMedium,
  HIGH: styles.sevHigh,
  CRITICAL: styles.sevCritical,
};

const PRIORITY_RANK: Record<RfiPriority, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

const AGE_BUCKETS: ReadonlyArray<{ label: string; max: number }> = [
  { label: "0–3 days", max: 3 },
  { label: "4–7 days", max: 7 },
  { label: "8–14 days", max: 14 },
  { label: "15–30 days", max: 30 },
  { label: "Over 30 days", max: Number.POSITIVE_INFINITY },
];

const RESPONSE_BUCKETS: ReadonlyArray<{ label: string; max: number }> = [
  { label: "Same or next day", max: 1 },
  { label: "2–5 days", max: 5 },
  { label: "6–10 days", max: 10 },
  { label: "11–20 days", max: 20 },
  { label: "Over 20 days", max: Number.POSITIVE_INFINITY },
];

const DISCIPLINES: ReadonlyArray<DocumentDiscipline> = [
  "ARCHITECTURAL",
  "STRUCTURAL",
  "CIVIL",
  "MEP",
  "COMMERCIAL",
  "PLANNING",
  "HSE",
  "QUALITY",
  "GENERAL",
];

const DISCIPLINE_LABEL: Record<DocumentDiscipline, string> = {
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

type RevisionKey = "APPROVED" | "ISSUED" | "FOR_REVIEW" | "DRAFT" | "SUPERSEDED" | "NONE";

const REVISION_KEYS: ReadonlyArray<{ key: RevisionKey; label: string; color: string }> = [
  { key: "APPROVED", label: "Approved", color: "#2f6f55" },
  { key: "ISSUED", label: "Issued", color: "#7ab397" },
  { key: "FOR_REVIEW", label: "For review", color: "#dcb85e" },
  { key: "DRAFT", label: "Draft", color: "#c3c9c5" },
  { key: "SUPERSEDED", label: "Superseded", color: "#9aa39f" },
  { key: "NONE", label: "No revision", color: "#e3e7e3" },
];

const FLOW_COLOR = { raised: "#c3c9c5", answered: "#2f6f55" } as const;

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

function num(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function monthKey(day: number): number {
  const date = new Date(day * DAY_MS);

  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function axisStep(max: number): number {
  const rough = Math.max(max, 1) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const fraction = rough / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;

  return Math.max(1, nice * magnitude);
}

function bucketIndex(value: number, buckets: ReadonlyArray<{ max: number }>): number {
  const index = buckets.findIndex((bucket) => value <= bucket.max);

  return index === -1 ? buckets.length - 1 : index;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

interface OpenRfi {
  rfi: ProjectRfi;
  age: number;
  dueDay: number;
  lateDays: number;
}

interface OwnerRow {
  name: string;
  total: number;
  overdue: number;
  oldest: number;
  byPriority: Record<RfiPriority, number>;
}

export function ProjectRfiBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<DocumentControl | null>(null);
  const [error, setError] = useState("");
  const [showAllRfis, setShowAllRfis] = useState(false);
  const [showAllOwners, setShowAllOwners] = useState(false);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectDocuments(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load document data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const rfis = (data?.rfis ?? []).filter((item) => item.status !== "VOID");
    const documents = data?.documents ?? [];
    const transmittals = data?.transmittals ?? [];

    const open: OpenRfi[] = rfis
      .filter((item) => item.status === "OPEN")
      .map((rfi) => {
        const raised = toDay(rfi.raisedDate);
        const dueDay = toDay(rfi.dueDate);
        const lateDays = Number.isFinite(dueDay) ? Math.max(0, today - dueDay) : 0;

        return {
          rfi,
          age: Number.isFinite(raised) ? Math.max(0, today - raised) : 0,
          dueDay,
          lateDays: rfi.overdue ? Math.max(1, lateDays) : lateDays,
        };
      })
      .sort(
        (a, b) =>
          b.lateDays - a.lateDays ||
          PRIORITY_RANK[b.rfi.priority] - PRIORITY_RANK[a.rfi.priority] ||
          b.age - a.age,
      );

    const ageing = AGE_BUCKETS.map((bucket) => ({
      label: bucket.label,
      total: 0,
      byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<RfiPriority, number>,
    }));

    for (const row of open) {
      const bucket = ageing[bucketIndex(row.age, AGE_BUCKETS)];

      if (bucket) {
        bucket.total += 1;
        bucket.byPriority[row.rfi.priority] += 1;
      }
    }

    const answered = rfis.filter(
      (item) => (item.status === "ANSWERED" || item.status === "CLOSED") && item.respondedDate,
    );
    const responseBuckets = RESPONSE_BUCKETS.map((bucket) => ({ label: bucket.label, count: 0 }));
    let responseSum = 0;
    let onTime = 0;

    for (const item of answered) {
      const raised = toDay(item.raisedDate);
      const responded = toDay(item.respondedDate);
      const due = toDay(item.dueDate);

      if (!Number.isFinite(raised) || !Number.isFinite(responded)) {
        continue;
      }

      const days = Math.max(0, responded - raised);
      const bucket = responseBuckets[bucketIndex(days, RESPONSE_BUCKETS)];

      if (bucket) {
        bucket.count += 1;
      }

      responseSum += days;

      if (Number.isFinite(due) && responded <= due) {
        onTime += 1;
      }
    }

    const nowKey = monthKey(today);
    const flow: Array<{ key: number; raised: number; answered: number }> = [];

    for (let offset = MONTH_WINDOW - 1; offset >= 0; offset -= 1) {
      flow.push({ key: nowKey - offset, raised: 0, answered: 0 });
    }

    for (const item of rfis) {
      const raisedDay = toDay(item.raisedDate);
      const respondedDay = toDay(item.respondedDate);
      const raisedBucket = Number.isFinite(raisedDay)
        ? flow.find((entry) => entry.key === monthKey(raisedDay))
        : undefined;
      const answeredBucket = Number.isFinite(respondedDay)
        ? flow.find((entry) => entry.key === monthKey(respondedDay))
        : undefined;

      if (raisedBucket) {
        raisedBucket.raised += 1;
      }

      if (answeredBucket) {
        answeredBucket.answered += 1;
      }
    }

    const owners = new Map<string, OwnerRow>();

    for (const row of open) {
      const name = row.rfi.assignedTo?.trim() || "Unassigned";
      const entry = owners.get(name) ?? {
        name,
        total: 0,
        overdue: 0,
        oldest: 0,
        byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      };

      entry.total += 1;
      entry.byPriority[row.rfi.priority] += 1;
      entry.oldest = Math.max(entry.oldest, row.age);

      if (row.lateDays > 0) {
        entry.overdue += 1;
      }

      owners.set(name, entry);
    }

    const ownerRows = [...owners.values()].sort(
      (a, b) => b.overdue - a.overdue || b.total - a.total || b.oldest - a.oldest,
    );

    const register = DISCIPLINES.map((discipline) => {
      const counts: Record<RevisionKey, number> = {
        APPROVED: 0,
        ISSUED: 0,
        FOR_REVIEW: 0,
        DRAFT: 0,
        SUPERSEDED: 0,
        NONE: 0,
      };
      let total = 0;

      for (const document of documents) {
        if (document.discipline !== discipline) {
          continue;
        }

        total += 1;

        const status = document.latestRevisionStatus as RevisionKey | null;
        const known = REVISION_KEYS.some((entry) => entry.key === status);

        counts[known && status ? status : "NONE"] += 1;
      }

      return { discipline, total, counts };
    }).filter((row) => row.total > 0);

    const sortedTransmittals = [...transmittals].sort((a, b) =>
      b.transmittalDate.localeCompare(a.transmittalDate),
    );
    const staleDrafts = transmittals.filter(
      (item) =>
        item.status === "DRAFT" && today - toDay(item.transmittalDate) > STALE_DRAFT_DAYS,
    ).length;

    return {
      open,
      ageing,
      ageMax: Math.max(0, ...ageing.map((item) => item.total)),
      answeredCount: answered.length,
      responseBuckets,
      responseMax: Math.max(0, ...responseBuckets.map((item) => item.count)),
      avgResponse: answered.length > 0 ? responseSum / answered.length : null,
      onTimeShare: answered.length > 0 ? percent(onTime, answered.length) : null,
      flow,
      flowMax: Math.max(0, ...flow.flatMap((entry) => [entry.raised, entry.answered])),
      ownerRows,
      register,
      transmittals: sortedTransmittals,
      staleDrafts,
      oldestOpen: open.reduce((max, row) => Math.max(max, row.age), 0),
    };
  }, [data, today]);

  const intel = data?.intelligence;
  const visibleRfis = showAllRfis ? model.open : model.open.slice(0, LIST_LIMIT);
  const visibleOwners = showAllOwners ? model.ownerRows : model.ownerRows.slice(0, OWNER_LIMIT);
  const ownerMax = Math.max(1, ...model.ownerRows.map((row) => row.total));

  const flowStep = axisStep(model.flowMax);
  const flowTop = flowStep * 4;
  const area = { left: 36, right: 12, top: 14, bottom: 30, width: 800, height: 250 };
  const plotW = area.width - area.left - area.right;
  const plotH = area.height - area.top - area.bottom;
  const slot = plotW / MONTH_WINDOW;
  const barW = Math.min(22, slot * 0.34);

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">RFI AND DOCUMENT BOARD</div>

            <h1>{data ? data.project.name : "RFI and document board"}</h1>

            <p className={styles.subtitle}>
              Who owes an answer, how fast questions are being closed, and how far the drawing
              register has progressed. Record RFIs, documents and transmittals in document control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/documents`}>
            Open document control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading document data…</div>}

        {data && intel && (
          <>
            <section aria-label="Information summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>INFORMATION SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.informationScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.informationRisk])}>
                    {RISK_LABEL[intel.informationRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN RFIS</div>
                <div className={cx(styles.kpiValue, intel.overdueRfis > 0 && styles.neg)}>
                  {intel.openRfis}
                </div>
                <div className={styles.kpiSub}>
                  {intel.criticalOpenRfis} critical · {intel.overdueRfis} overdue
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AVERAGE RESPONSE</div>
                <div className={styles.kpiValue}>
                  {model.avgResponse === null ? "—" : `${num(model.avgResponse, 1)} d`}
                </div>
                <div className={styles.kpiSub}>
                  {model.onTimeShare === null
                    ? "No answered RFIs yet"
                    : `${num(model.onTimeShare)}% answered on time · ${model.answeredCount} answered`}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OLDEST OPEN RFI</div>
                <div className={styles.kpiValue}>
                  {model.open.length > 0 ? `${model.oldestOpen} d` : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {model.open.length > 0 ? "since it was raised" : "No open RFIs"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DOCUMENTS</div>
                <div className={styles.kpiValue}>{num(intel.totalDocuments)}</div>
                <div className={styles.kpiSub}>
                  {num(intel.totalRevisions)} revisions · {intel.drawingDocuments} drawings
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DRAFT TRANSMITTALS</div>
                <div className={cx(styles.kpiValue, model.staleDrafts > 0 && styles.neg)}>
                  {intel.draftTransmittals}
                </div>
                <div className={styles.kpiSub}>
                  {model.staleDrafts} older than {STALE_DRAFT_DAYS} days · {intel.issuedTransmittals}{" "}
                  issued
                </div>
              </article>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">RFI AGEING</div>
                    <h2>How long open RFIs have waited</h2>
                  </div>

                  <span className={styles.muted}>{model.open.length} open</span>
                </header>

                {model.open.length === 0 ? (
                  <div className={styles.emptySmall}>No open RFIs.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.ageing.map((bucket) => (
                      <li key={bucket.label}>
                        <div className={styles.ageingTop}>
                          <span>{bucket.label}</span>
                          <strong>{bucket.total}</strong>
                        </div>

                        <div
                          aria-label={`${plural(bucket.total, "open RFI")} aged ${bucket.label}`}
                          className={styles.stackTrack}
                          role="img"
                        >
                          <div
                            className={styles.stack}
                            style={{ width: `${percent(bucket.total, model.ageMax)}%` }}
                          >
                            {PRIORITIES.map((priority) =>
                              bucket.byPriority[priority] > 0 ? (
                                <i
                                  key={priority}
                                  style={{
                                    background: PRIORITY_COLOR[priority],
                                    flexGrow: bucket.byPriority[priority],
                                  }}
                                  title={`${bucket.byPriority[priority]} ${PRIORITY_LABEL[
                                    priority
                                  ].toLowerCase()} priority`}
                                />
                              ) : null,
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <ul aria-label="Priority legend" className={styles.legend}>
                  {PRIORITIES.map((priority) => (
                    <li key={priority}>
                      <i className={styles.swatch} style={{ background: PRIORITY_COLOR[priority] }} />
                      {PRIORITY_LABEL[priority]}
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">RESPONSE TIME</div>
                    <h2>How quickly RFIs get answered</h2>
                  </div>

                  <span className={styles.muted}>{model.answeredCount} answered</span>
                </header>

                {model.answeredCount === 0 ? (
                  <div className={styles.emptySmall}>No answered RFIs yet.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.responseBuckets.map((bucket) => (
                      <li key={bucket.label}>
                        <div className={styles.ageingTop}>
                          <span>{bucket.label}</span>
                          <strong>
                            {bucket.count}
                            <small>{num(percent(bucket.count, model.answeredCount))}%</small>
                          </strong>
                        </div>

                        <div
                          aria-label={`${plural(bucket.count, "RFI")} answered in ${bucket.label.toLowerCase()}`}
                          className={styles.track}
                          role="img"
                        >
                          <div
                            className={cx(styles.fill, styles.toneGood)}
                            style={{ width: `${percent(bucket.count, model.responseMax)}%` }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <p className={styles.hint}>
                  Counted from the date raised to the date answered. On time means answered on or
                  before the due date.
                </p>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">RFI FLOW</div>
                  <h2>Raised and answered per month</h2>
                </div>

                <span className={styles.muted}>last {MONTH_WINDOW} months</span>
              </header>

              {model.flowMax === 0 ? (
                <div className={styles.emptySmall}>No RFI activity in the last {MONTH_WINDOW} months.</div>
              ) : (
                <div className={styles.chartScroll}>
                  <svg
                    aria-label={`RFIs raised and answered per month for the last ${MONTH_WINDOW} months`}
                    className={styles.chart}
                    role="img"
                    viewBox={`0 0 ${area.width} ${area.height}`}
                  >
                    {[0, 1, 2, 3, 4].map((step) => {
                      const value = flowStep * step;
                      const y = area.top + plotH - (value / flowTop) * plotH;

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
                            {num(value)}
                          </text>
                        </g>
                      );
                    })}

                    {model.flow.map((entry, index) => {
                      const groupX = area.left + slot * index + (slot - barW * 2 - 3) / 2;
                      const bars = [
                        { key: "raised", label: "raised", value: entry.raised, color: FLOW_COLOR.raised },
                        { key: "answered", label: "answered", value: entry.answered, color: FLOW_COLOR.answered },
                      ];

                      return (
                        <g key={entry.key}>
                          {bars.map((bar, barIndex) => {
                            const h = (bar.value / flowTop) * plotH;

                            return (
                              <g key={bar.key}>
                                <rect
                                  fill={bar.color}
                                  height={Math.max(h, 0)}
                                  rx="2"
                                  width={barW}
                                  x={groupX + barIndex * (barW + 3)}
                                  y={area.top + plotH - h}
                                >
                                  <title>{`${MONTHS[entry.key % 12] ?? ""}: ${bar.value} ${bar.label}`}</title>
                                </rect>

                                {bar.value > 0 && (
                                  <text
                                    fill="#3c4642"
                                    fontSize="10.5"
                                    fontWeight="700"
                                    textAnchor="middle"
                                    x={groupX + barIndex * (barW + 3) + barW / 2}
                                    y={area.top + plotH - h - 4}
                                  >
                                    {bar.value}
                                  </text>
                                )}
                              </g>
                            );
                          })}

                          <text
                            fill="#66706b"
                            fontSize="11.5"
                            textAnchor="middle"
                            x={groupX + (barW * 2 + 3) / 2}
                            y={area.height - 10}
                          >
                            {MONTHS[entry.key % 12] ?? ""}
                            {entry.key % 12 === 0 ? ` ${Math.floor(entry.key / 12)}` : ""}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              <ul aria-label="Chart legend" className={styles.legend}>
                <li>
                  <i className={styles.swatch} style={{ background: FLOW_COLOR.raised }} />
                  Raised
                </li>
                <li>
                  <i className={styles.swatch} style={{ background: FLOW_COLOR.answered }} />
                  Answered
                </li>
              </ul>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">WHO OWES AN ANSWER</div>
                    <h2>Open RFIs by assignee</h2>
                  </div>

                  <div className={styles.controls}>
                    <span className={styles.muted}>{model.ownerRows.length} people</span>

                    {model.ownerRows.length > OWNER_LIMIT && (
                      <button
                        className={styles.linkButton}
                        onClick={() => setShowAllOwners((value) => !value)}
                        type="button"
                      >
                        {showAllOwners ? `Show first ${OWNER_LIMIT}` : `Show all ${model.ownerRows.length}`}
                      </button>
                    )}
                  </div>
                </header>

                {model.ownerRows.length === 0 ? (
                  <div className={styles.emptySmall}>No open RFIs to assign.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {visibleOwners.map((row) => (
                      <li key={row.name}>
                        <div className={styles.ageingTop}>
                          <span>
                            {row.name}
                            {row.overdue > 0 && <em className={styles.late}>{row.overdue} OVERDUE</em>}
                          </span>
                          <strong>
                            {row.total}
                            <small>oldest {row.oldest} d</small>
                          </strong>
                        </div>

                        <div
                          aria-label={`${plural(row.total, "open RFI")} assigned to ${row.name}`}
                          className={styles.stackTrack}
                          role="img"
                        >
                          <div
                            className={styles.stack}
                            style={{ width: `${percent(row.total, ownerMax)}%` }}
                          >
                            {PRIORITIES.map((priority) =>
                              row.byPriority[priority] > 0 ? (
                                <i
                                  key={priority}
                                  style={{
                                    background: PRIORITY_COLOR[priority],
                                    flexGrow: row.byPriority[priority],
                                  }}
                                  title={`${row.byPriority[priority]} ${PRIORITY_LABEL[
                                    priority
                                  ].toLowerCase()} priority`}
                                />
                              ) : null,
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">DOCUMENT REGISTER</div>
                    <h2>Latest revision status by discipline</h2>
                  </div>

                  <span className={styles.muted}>{num(intel.totalDocuments)} documents</span>
                </header>

                {model.register.length === 0 ? (
                  <div className={styles.emptySmall}>No documents registered yet.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.register.map((row) => (
                      <li key={row.discipline}>
                        <div className={styles.ageingTop}>
                          <span>{DISCIPLINE_LABEL[row.discipline]}</span>
                          <strong>
                            {row.total}
                            <small>
                              {row.counts.APPROVED + row.counts.ISSUED} approved or issued
                            </small>
                          </strong>
                        </div>

                        <div
                          aria-label={`${DISCIPLINE_LABEL[row.discipline]}: ${row.total} documents`}
                          className={styles.stackFull}
                          role="img"
                        >
                          {REVISION_KEYS.map((entry) =>
                            row.counts[entry.key] > 0 ? (
                              <i
                                key={entry.key}
                                style={{ background: entry.color, flexGrow: row.counts[entry.key] }}
                                title={`${row.counts[entry.key]} ${entry.label.toLowerCase()}`}
                              />
                            ) : null,
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <ul aria-label="Revision legend" className={styles.legend}>
                  {REVISION_KEYS.map((entry) => (
                    <li key={entry.key}>
                      <i
                        className={cx(styles.swatch, entry.key === "NONE" && styles.swatchOutline)}
                        style={{ background: entry.color }}
                      />
                      {entry.label}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">NEEDS AN ANSWER</div>
                  <h2>Open RFIs, most overdue first</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>
                    {model.open.length} open · {model.open.filter((row) => row.lateDays > 0).length}{" "}
                    overdue
                  </span>

                  {model.open.length > LIST_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllRfis((value) => !value)}
                      type="button"
                    >
                      {showAllRfis ? `Show first ${LIST_LIMIT}` : `Show all ${model.open.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.open.length === 0 ? (
                <div className={styles.emptySmall}>No open RFIs. Every question has an answer.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>REFERENCE</th>
                        <th>SUBJECT</th>
                        <th>PRIORITY</th>
                        <th>ASSIGNED TO</th>
                        <th>DUE</th>
                        <th className={styles.num}>AGE</th>
                        <th className={styles.num}>LATE</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleRfis.map((row) => (
                        <tr key={row.rfi.id}>
                          <td>
                            <strong>{row.rfi.reference}</strong>
                          </td>
                          <td className={styles.wrap}>{row.rfi.subject}</td>
                          <td>
                            <span className={cx(styles.sev, PRIORITY_CLASS[row.rfi.priority])}>
                              {PRIORITY_LABEL[row.rfi.priority]}
                            </span>
                          </td>
                          <td>{row.rfi.assignedTo ?? "Unassigned"}</td>
                          <td>{formatDay(row.dueDay)}</td>
                          <td className={styles.num}>{row.age} d</td>
                          <td className={cx(styles.num, row.lateDays > 0 && styles.neg)}>
                            {row.lateDays > 0 ? `${row.lateDays} d` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">TRANSMITTALS</div>
                  <h2>Latest transmittals</h2>
                </div>

                <span className={styles.muted}>{model.transmittals.length} in total</span>
              </header>

              {model.transmittals.length === 0 ? (
                <div className={styles.emptySmall}>No transmittals recorded yet.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>REFERENCE</th>
                        <th>RECIPIENT</th>
                        <th>PURPOSE</th>
                        <th>DATE</th>
                        <th className={styles.num}>REVISIONS</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {model.transmittals.slice(0, 8).map((item) => {
                        const stale =
                          item.status === "DRAFT" &&
                          today - toDay(item.transmittalDate) > STALE_DRAFT_DAYS;

                        return (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.reference}</strong>
                            </td>
                            <td>{item.recipient}</td>
                            <td className={styles.wrap}>{item.purpose}</td>
                            <td>{formatDay(toDay(item.transmittalDate))}</td>
                            <td className={styles.num}>{item.revisionReferences.length}</td>
                            <td>
                              {item.status === "ISSUED" ? "Issued" : "Draft"}
                              {stale && <em className={styles.late}>STALE</em>}
                            </td>
                          </tr>
                        );
                      })}
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
