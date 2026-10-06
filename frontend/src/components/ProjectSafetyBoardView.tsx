"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSafety } from "@/lib/api";
import type {
  HazardCategory,
  SafetyAction,
  SafetyControl,
  SafetyIncident,
  SafetyIncidentType,
  SafetyRiskLevel,
  SafetySeverity,
  WorkPermit,
  WorkPermitType,
} from "@/types/project";

import styles from "./ProjectSafetyBoardView.module.css";

const DAY_MS = 86_400_000;
const MONTH_WINDOW = 12;
const RECENT_DAYS = 90;
const RECURRING_THRESHOLD = 3;
const LIST_LIMIT = 10;

const RISK_LABEL: Record<SafetyRiskLevel, string> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<SafetyRiskLevel, string | undefined> = {
  NO_DATA: styles.riskNone,
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const SEVERITIES: ReadonlyArray<SafetySeverity> = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const SEVERITY_LABEL: Record<SafetySeverity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const SEVERITY_COLOR: Record<SafetySeverity, string> = {
  LOW: "#a9c1b8",
  MEDIUM: "#dcb85e",
  HIGH: "#d9823a",
  CRITICAL: "#b5493e",
};

const SEVERITY_CLASS: Record<SafetySeverity, string | undefined> = {
  LOW: styles.sevLow,
  MEDIUM: styles.sevMedium,
  HIGH: styles.sevHigh,
  CRITICAL: styles.sevCritical,
};

const TYPE_ORDER: ReadonlyArray<SafetyIncidentType> = [
  "NEAR_MISS",
  "FIRST_AID",
  "MEDICAL_TREATMENT",
  "LOST_TIME_INJURY",
  "PROPERTY_DAMAGE",
  "ENVIRONMENTAL",
  "OTHER",
];

const TYPE_LABEL: Record<SafetyIncidentType, string> = {
  NEAR_MISS: "Near miss",
  FIRST_AID: "First aid",
  MEDICAL_TREATMENT: "Medical treatment",
  LOST_TIME_INJURY: "Lost-time injury",
  PROPERTY_DAMAGE: "Property damage",
  ENVIRONMENTAL: "Environmental",
  OTHER: "Other",
};

const TYPE_COLOR: Record<SafetyIncidentType, string> = {
  NEAR_MISS: "#a9c1b8",
  FIRST_AID: "#6fa88c",
  MEDICAL_TREATMENT: "#dcb85e",
  LOST_TIME_INJURY: "#b5493e",
  PROPERTY_DAMAGE: "#7e8fb0",
  ENVIRONMENTAL: "#8c7ab0",
  OTHER: "#9aa39f",
};

const HAZARD_LABEL: Record<HazardCategory, string> = {
  PPE: "PPE",
  HOUSEKEEPING: "Housekeeping",
  WORK_AT_HEIGHT: "Work at height",
  ELECTRICAL: "Electrical",
  LIFTING: "Lifting",
  EXCAVATION: "Excavation",
  ACCESS_EGRESS: "Access and egress",
  TOOLS_EQUIPMENT: "Tools and equipment",
  FIRE: "Fire",
  ENVIRONMENTAL: "Environmental",
  TRAFFIC: "Traffic",
  OTHER: "Other",
};

const PERMIT_LABEL: Record<WorkPermitType, string> = {
  HOT_WORK: "Hot work",
  WORK_AT_HEIGHT: "Work at height",
  CONFINED_SPACE: "Confined space",
  EXCAVATION: "Excavation",
  ELECTRICAL_ISOLATION: "Electrical isolation",
  LIFTING: "Lifting",
  GENERAL: "General",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type TrendMode = "severity" | "type";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function humanize(value: string): string {
  const text = value.replace(/_/g, " ").toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
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

function formatIso(value: string | null): string {
  return formatDay(toDay(value));
}

function num(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function monthKey(day: number): number {
  const date = new Date(day * DAY_MS);

  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function monthLabel(key: number): string {
  return `${MONTHS[key % 12] ?? ""}`;
}

function axisStep(max: number): number {
  const rough = Math.max(max, 1) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const fraction = rough / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;

  return Math.max(1, nice * magnitude);
}

interface Bucket {
  key: number;
  total: number;
  bySeverity: Record<SafetySeverity, number>;
  byType: Record<SafetyIncidentType, number>;
}

function emptyBucket(key: number): Bucket {
  return {
    key,
    total: 0,
    bySeverity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
    byType: {
      NEAR_MISS: 0,
      FIRST_AID: 0,
      MEDICAL_TREATMENT: 0,
      LOST_TIME_INJURY: 0,
      PROPERTY_DAMAGE: 0,
      ENVIRONMENTAL: 0,
      OTHER: 0,
    },
  };
}

interface PermitRow {
  permit: WorkPermit;
  untilDay: number;
  daysLeft: number;
  rank: number;
  note: string;
}

interface ActionRow {
  action: SafetyAction;
  dueDay: number;
  lateDays: number;
}

function permitRow(permit: WorkPermit, today: number): PermitRow {
  const untilDay = toDay(permit.validUntil);
  const daysLeft = untilDay - today;
  const expired = permit.expired || daysLeft < 0;

  if (permit.status === "ACTIVE" && expired) {
    return { permit, untilDay, daysLeft, rank: 0, note: "Expired but still active" };
  }

  if (permit.status === "ACTIVE" && daysLeft <= 3) {
    return {
      permit,
      untilDay,
      daysLeft,
      rank: 1,
      note: daysLeft === 0 ? "Expires today" : `Expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`,
    };
  }

  if (permit.status === "SUSPENDED") {
    return { permit, untilDay, daysLeft, rank: 2, note: "Suspended" };
  }

  if (permit.status === "DRAFT") {
    return { permit, untilDay, daysLeft, rank: 3, note: "Draft, not yet issued" };
  }

  return { permit, untilDay, daysLeft, rank: 4, note: `${Math.max(daysLeft, 0)} days left` };
}

export function ProjectSafetyBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<SafetyControl | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<TrendMode>("severity");
  const [showAllActions, setShowAllActions] = useState(false);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectSafety(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load safety data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const incidents: SafetyIncident[] = (data?.incidents ?? []).filter(
      (item) => item.status !== "VOID",
    );
    const observations = (data?.observations ?? []).filter((item) => item.status !== "VOID");

    const nowKey = monthKey(today);
    const buckets: Bucket[] = [];

    for (let offset = MONTH_WINDOW - 1; offset >= 0; offset -= 1) {
      buckets.push(emptyBucket(nowKey - offset));
    }

    let outsideWindow = 0;

    for (const incident of incidents) {
      const day = toDay(incident.occurredDate);
      const bucket = Number.isFinite(day)
        ? buckets.find((item) => item.key === monthKey(day))
        : undefined;

      if (!bucket) {
        outsideWindow += 1;
        continue;
      }

      bucket.total += 1;
      bucket.bySeverity[incident.severity] += 1;
      bucket.byType[incident.incidentType] += 1;
    }

    const hazards = new Map<
      HazardCategory,
      { unsafe: number; positive: number; open: number; recent: number }
    >();

    for (const item of observations) {
      const entry = hazards.get(item.hazardCategory) ?? {
        unsafe: 0,
        positive: 0,
        open: 0,
        recent: 0,
      };
      const unsafe =
        item.observationType === "UNSAFE_ACT" || item.observationType === "UNSAFE_CONDITION";

      if (unsafe) {
        entry.unsafe += 1;

        if (today - toDay(item.observedDate) <= RECENT_DAYS) {
          entry.recent += 1;
        }
      } else {
        entry.positive += 1;
      }

      if (item.status !== "CLOSED") {
        entry.open += 1;
      }

      hazards.set(item.hazardCategory, entry);
    }

    const hazardRows = [...hazards.entries()]
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.unsafe - a.unsafe || b.positive - a.positive);

    const recurringCount = hazardRows.filter((row) => row.recent >= RECURRING_THRESHOLD).length;

    const permits = (data?.permits ?? [])
      .filter((item) => item.status !== "CLOSED" && item.status !== "CANCELLED")
      .map((item) => permitRow(item, today))
      .sort((a, b) => a.rank - b.rank || a.daysLeft - b.daysLeft);

    const actions: ActionRow[] = (data?.actions ?? [])
      .filter((item) => item.status !== "CLOSED" && item.status !== "VOID")
      .map((action) => {
        const dueDay = toDay(action.dueDate);
        const lateDays = Number.isFinite(dueDay) ? Math.max(0, today - dueDay) : 0;

        return { action, dueDay, lateDays: action.overdue ? Math.max(1, lateDays) : lateDays };
      })
      .sort((a, b) => b.lateDays - a.lateDays || a.dueDay - b.dueDay);

    const recent = [...incidents]
      .sort((a, b) => b.occurredDate.localeCompare(a.occurredDate))
      .slice(0, 8);

    return {
      buckets,
      outsideWindow,
      maxTotal: Math.max(0, ...buckets.map((item) => item.total)),
      windowTotal: buckets.reduce((sum, item) => sum + item.total, 0),
      hazardRows,
      recurringCount,
      permits,
      actions,
      recent,
      lostDays: incidents.reduce((sum, item) => sum + item.lostTimeDays, 0),
    };
  }, [data, today]);

  const intel = data?.intelligence;
  const visibleActions = showAllActions ? model.actions : model.actions.slice(0, LIST_LIMIT);
  const positiveTotal = intel ? intel.positiveObservations : 0;
  const unsafeTotal = intel ? intel.unsafeObservations : 0;
  const positiveShare =
    positiveTotal + unsafeTotal > 0
      ? (positiveTotal / (positiveTotal + unsafeTotal)) * 100
      : null;

  const chartStep = axisStep(model.maxTotal);
  const chartTop = chartStep * 4;
  const barArea = { left: 36, right: 12, top: 14, bottom: 30, width: 800, height: 250 };
  const plotW = barArea.width - barArea.left - barArea.right;
  const plotH = barArea.height - barArea.top - barArea.bottom;
  const slot = plotW / MONTH_WINDOW;
  const barW = Math.min(46, slot * 0.62);

  const legend =
    mode === "severity"
      ? SEVERITIES.map((key) => ({ key, label: SEVERITY_LABEL[key], color: SEVERITY_COLOR[key] }))
      : TYPE_ORDER.map((key) => ({ key, label: TYPE_LABEL[key], color: TYPE_COLOR[key] }));

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">SAFETY BOARD</div>

            <h1>{data ? data.project.name : "Safety board"}</h1>

            <p className={styles.subtitle}>
              Incident trend, recurring hazards, permit health and overdue
              actions in one place. Record incidents, observations and permits
              in safety control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/safety`}>
            Open safety control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading safety data…</div>}

        {data && intel && (
          <>
            <section aria-label="Safety summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>SAFETY SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.safetyScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.safetyRisk])}>
                    {RISK_LABEL[intel.safetyRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DAYS SINCE RECORDABLE</div>
                <div className={styles.kpiValue}>
                  {intel.daysSinceLastRecordableIncident === null
                    ? "None"
                    : num(intel.daysSinceLastRecordableIncident)}
                </div>
                <div className={styles.kpiSub}>
                  {intel.recordableIncidents} recordable · {intel.lostTimeIncidents} lost-time ·{" "}
                  {num(model.lostDays)} days lost
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN INCIDENTS</div>
                <div
                  className={cx(
                    styles.kpiValue,
                    intel.criticalOpenIncidents > 0 && styles.neg,
                  )}
                >
                  {intel.openIncidents}
                </div>
                <div className={styles.kpiSub}>
                  {intel.criticalOpenIncidents} critical · {intel.totalIncidents} in total
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>POSITIVE OBSERVATIONS</div>
                <div className={styles.kpiValue}>
                  {positiveShare === null ? "—" : `${num(positiveShare)}%`}
                </div>
                <div className={styles.kpiSub}>
                  {positiveTotal} positive · {unsafeTotal} unsafe
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN ACTIONS</div>
                <div
                  className={cx(styles.kpiValue, intel.overdueActions > 0 && styles.neg)}
                >
                  {intel.openActions}
                </div>
                <div className={styles.kpiSub}>{intel.overdueActions} overdue</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ACTIVE PERMITS</div>
                <div
                  className={cx(styles.kpiValue, intel.expiredPermits > 0 && styles.neg)}
                >
                  {intel.activePermits}
                </div>
                <div className={styles.kpiSub}>{intel.expiredPermits} expired</div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">INCIDENT TREND</div>
                  <h2>Incidents per month</h2>
                </div>

                <div aria-label="Colour by" className={styles.segmented} role="group">
                  {(["severity", "type"] as const).map((key) => (
                    <button
                      aria-pressed={mode === key}
                      className={cx(styles.segment, mode === key && styles.segmentOn)}
                      key={key}
                      onClick={() => setMode(key)}
                      type="button"
                    >
                      By {key}
                    </button>
                  ))}
                </div>
              </header>

              {model.windowTotal === 0 ? (
                <div className={styles.emptySmall}>
                  No incidents recorded in the last {MONTH_WINDOW} months.
                </div>
              ) : (
                <div className={styles.chartScroll}>
                  <svg
                    aria-label={`Incidents per month for the last ${MONTH_WINDOW} months, ${model.windowTotal} in total`}
                    className={styles.chart}
                    role="img"
                    viewBox={`0 0 ${barArea.width} ${barArea.height}`}
                  >
                    {[0, 1, 2, 3, 4].map((step) => {
                      const value = chartStep * step;
                      const y = barArea.top + plotH - (value / chartTop) * plotH;

                      return (
                        <g key={step}>
                          <line
                            stroke="#e8ebe7"
                            x1={barArea.left}
                            x2={barArea.width - barArea.right}
                            y1={y}
                            y2={y}
                          />
                          <text
                            fill="#7a847f"
                            fontSize="11"
                            textAnchor="end"
                            x={barArea.left - 6}
                            y={y + 3}
                          >
                            {num(value)}
                          </text>
                        </g>
                      );
                    })}

                    {model.buckets.map((bucket, index) => {
                      const x = barArea.left + slot * index + (slot - barW) / 2;
                      let stackTop = barArea.top + plotH;
                      const parts =
                        mode === "severity"
                          ? SEVERITIES.map((key) => ({
                              key,
                              value: bucket.bySeverity[key],
                              color: SEVERITY_COLOR[key],
                              label: SEVERITY_LABEL[key],
                            }))
                          : TYPE_ORDER.map((key) => ({
                              key,
                              value: bucket.byType[key],
                              color: TYPE_COLOR[key],
                              label: TYPE_LABEL[key],
                            }));

                      return (
                        <g key={bucket.key}>
                          {parts.map((part) => {
                            if (part.value === 0) {
                              return null;
                            }

                            const h = (part.value / chartTop) * plotH;
                            stackTop -= h;

                            return (
                              <rect
                                fill={part.color}
                                height={h}
                                key={part.key}
                                rx="2"
                                width={barW}
                                x={x}
                                y={stackTop}
                              >
                                <title>
                                  {`${monthLabel(bucket.key)}: ${part.value} ${part.label.toLowerCase()}`}
                                </title>
                              </rect>
                            );
                          })}

                          {bucket.total > 0 && (
                            <text
                              fill="#3c4642"
                              fontSize="11.5"
                              fontWeight="700"
                              textAnchor="middle"
                              x={x + barW / 2}
                              y={barArea.top + plotH - (bucket.total / chartTop) * plotH - 5}
                            >
                              {bucket.total}
                            </text>
                          )}

                          <text
                            fill="#66706b"
                            fontSize="11.5"
                            textAnchor="middle"
                            x={x + barW / 2}
                            y={barArea.height - 10}
                          >
                            {monthLabel(bucket.key)}
                            {bucket.key % 12 === 0 ? ` ${Math.floor(bucket.key / 12)}` : ""}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              <ul aria-label="Chart legend" className={styles.legend}>
                {legend.map((item) => (
                  <li key={item.key}>
                    <i className={styles.swatch} style={{ background: item.color }} />
                    {item.label}
                  </li>
                ))}
              </ul>

              {model.outsideWindow > 0 && (
                <p className={styles.hint}>
                  {model.outsideWindow} older incident
                  {model.outsideWindow === 1 ? " is" : "s are"} outside this
                  12-month window.
                </p>
              )}
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">HAZARDS</div>
                    <h2>Observations by category</h2>
                  </div>

                  <span className={styles.muted}>{model.recurringCount} recurring</span>
                </header>

                {model.hazardRows.length === 0 ? (
                  <div className={styles.emptySmall}>No observations recorded yet.</div>
                ) : (
                  <ul className={styles.hazards}>
                    {model.hazardRows.map((row) => {
                      const total = row.unsafe + row.positive;
                      const recurring = row.recent >= RECURRING_THRESHOLD;

                      return (
                        <li key={row.category}>
                          <div className={styles.hazardTop}>
                            <strong>
                              {HAZARD_LABEL[row.category]}
                              {recurring && <em className={styles.late}>RECURRING</em>}
                            </strong>
                            <span>
                              {row.unsafe} unsafe · {row.positive} positive
                              <small>{row.open} open</small>
                            </span>
                          </div>

                          <div
                            aria-label={`${row.unsafe} unsafe and ${row.positive} positive observations`}
                            className={styles.split}
                            role="img"
                          >
                            <div
                              className={styles.splitBad}
                              style={{ width: `${(row.unsafe / total) * 100}%` }}
                            />
                            <div
                              className={styles.splitGood}
                              style={{ width: `${(row.positive / total) * 100}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <p className={styles.hint}>
                  Recurring means {RECURRING_THRESHOLD} or more unsafe
                  observations in the same category in the last {RECENT_DAYS}{" "}
                  days. Red is unsafe acts and conditions; green is safe acts
                  and good practice.
                </p>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">WORK PERMITS</div>
                    <h2>Permits needing attention first</h2>
                  </div>

                  <span className={styles.muted}>{model.permits.length} open</span>
                </header>

                {model.permits.length === 0 ? (
                  <div className={styles.emptySmall}>No open permits.</div>
                ) : (
                  <ul className={styles.permits}>
                    {model.permits.slice(0, 8).map((row) => (
                      <li className={row.rank <= 1 ? styles.permitAlert : ""} key={row.permit.id}>
                        <div className={styles.permitTop}>
                          <strong>{row.permit.reference}</strong>
                          <span>{PERMIT_LABEL[row.permit.permitType]}</span>
                        </div>
                        <div className={styles.permitTitle}>{row.permit.title}</div>
                        <div className={styles.permitMeta}>
                          <span>
                            {formatIso(row.permit.validFrom)} → {formatIso(row.permit.validUntil)}
                          </span>
                          <span className={row.rank <= 1 ? styles.neg : ""}>{row.note}</span>
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
                  <div className="eyebrow">CORRECTIVE ACTIONS</div>
                  <h2>Open safety actions</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>
                    {model.actions.length} open ·{" "}
                    {model.actions.filter((row) => row.lateDays > 0).length} overdue
                  </span>

                  {model.actions.length > LIST_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllActions((value) => !value)}
                      type="button"
                    >
                      {showAllActions ? `Show first ${LIST_LIMIT}` : `Show all ${model.actions.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.actions.length === 0 ? (
                <div className={styles.emptySmall}>No open actions. Everything is closed out.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>REFERENCE</th>
                        <th>ACTION</th>
                        <th>FROM</th>
                        <th>OWNER</th>
                        <th>DUE</th>
                        <th className={styles.num}>LATE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleActions.map((row) => (
                        <tr key={row.action.id}>
                          <td>
                            <strong>{row.action.reference}</strong>
                          </td>
                          <td className={styles.wrap}>{row.action.title}</td>
                          <td>
                            {row.action.incidentReference ??
                              row.action.observationReference ??
                              "—"}
                          </td>
                          <td>{row.action.ownerName ?? "Unassigned"}</td>
                          <td>{formatDay(row.dueDay)}</td>
                          <td className={cx(styles.num, row.lateDays > 0 && styles.neg)}>
                            {row.lateDays > 0 ? `${row.lateDays} d` : "—"}
                          </td>
                          <td>{humanize(row.action.status)}</td>
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
                  <div className="eyebrow">LATEST</div>
                  <h2>Recent incidents</h2>
                </div>
              </header>

              {model.recent.length === 0 ? (
                <div className={styles.emptySmall}>No incidents recorded.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>REFERENCE</th>
                        <th>DATE</th>
                        <th>TYPE</th>
                        <th>SEVERITY</th>
                        <th>TITLE</th>
                        <th>LOCATION</th>
                        <th className={styles.num}>PEOPLE</th>
                        <th className={styles.num}>DAYS LOST</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {model.recent.map((incident) => (
                        <tr key={incident.id}>
                          <td>
                            <strong>{incident.reference}</strong>
                          </td>
                          <td>{formatIso(incident.occurredDate)}</td>
                          <td>{TYPE_LABEL[incident.incidentType]}</td>
                          <td>
                            <span className={cx(styles.sev, SEVERITY_CLASS[incident.severity])}>
                              {SEVERITY_LABEL[incident.severity]}
                            </span>
                          </td>
                          <td className={styles.wrap}>{incident.title}</td>
                          <td>{incident.location ?? "—"}</td>
                          <td className={styles.num}>{incident.peopleAffected}</td>
                          <td className={styles.num}>{incident.lostTimeDays || "—"}</td>
                          <td>{humanize(incident.status)}</td>
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
