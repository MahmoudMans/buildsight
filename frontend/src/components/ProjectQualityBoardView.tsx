"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { type ChartSeries, LineChart } from "@/components/LineChart";
import { getProjectQuality } from "@/lib/api";
import type {
  HandoverCategory,
  NcrCategory,
  NcrSeverity,
  NcrStatus,
  ProjectNcr,
  PunchItem,
  PunchPriority,
  QualityControl,
  QualityDiscipline,
  QualityRiskLevel,
} from "@/types/project";

import styles from "./ProjectQualityBoardView.module.css";

const DAY_MS = 86_400_000;
const RECENT_DAYS = 90;
const RECURRING_THRESHOLD = 3;
const LIST_LIMIT = 10;
const GROUP_LIMIT = 8;

const RISK_LABEL: Record<QualityRiskLevel, string> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<QualityRiskLevel, string | undefined> = {
  NO_DATA: styles.riskNone,
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const NCR_SEVERITIES: ReadonlyArray<NcrSeverity> = ["MINOR", "MAJOR", "CRITICAL"];

const NCR_SEVERITY_LABEL: Record<NcrSeverity, string> = {
  MINOR: "Minor",
  MAJOR: "Major",
  CRITICAL: "Critical",
};

const NCR_SEVERITY_COLOR: Record<NcrSeverity, string> = {
  MINOR: "#a9c1b8",
  MAJOR: "#d9823a",
  CRITICAL: "#b5493e",
};

const NCR_SEVERITY_CLASS: Record<NcrSeverity, string | undefined> = {
  MINOR: styles.sevLow,
  MAJOR: styles.sevHigh,
  CRITICAL: styles.sevCritical,
};

const NCR_SEVERITY_RANK: Record<NcrSeverity, number> = { MINOR: 0, MAJOR: 1, CRITICAL: 2 };

const NCR_CATEGORY_LABEL: Record<NcrCategory, string> = {
  WORKMANSHIP: "Workmanship",
  MATERIAL: "Material",
  DESIGN: "Design",
  INSTALLATION: "Installation",
  DOCUMENTATION: "Documentation",
  TEST_FAILURE: "Test failure",
  OTHER: "Other",
};

const NCR_STATUS_LABEL: Record<NcrStatus, string> = {
  OPEN: "Open",
  CORRECTIVE_ACTION_IN_PROGRESS: "Corrective action",
  READY_FOR_VERIFICATION: "Ready to verify",
  CLOSED: "Closed",
  VOID: "Void",
};

const DISCIPLINES: ReadonlyArray<QualityDiscipline> = [
  "CIVIL",
  "STRUCTURAL",
  "ARCHITECTURAL",
  "MEP",
  "HSE",
  "QUALITY",
  "GENERAL",
];

const DISCIPLINE_LABEL: Record<QualityDiscipline, string> = {
  CIVIL: "Civil",
  STRUCTURAL: "Structural",
  ARCHITECTURAL: "Architectural",
  MEP: "MEP",
  HSE: "HSE",
  QUALITY: "Quality",
  GENERAL: "General",
};

const PRIORITIES: ReadonlyArray<PunchPriority> = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const PRIORITY_LABEL: Record<PunchPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const PRIORITY_COLOR: Record<PunchPriority, string> = {
  LOW: "#a9c1b8",
  MEDIUM: "#dcb85e",
  HIGH: "#d9823a",
  CRITICAL: "#b5493e",
};

const HANDOVER_LABEL: Record<HandoverCategory, string> = {
  OM_MANUAL: "O&M manuals",
  AS_BUILT: "As-built drawings",
  CERTIFICATE: "Certificates",
  WARRANTY: "Warranties",
  TEST_RECORD: "Test records",
  TRAINING: "Training",
  OTHER: "Other",
};

const HANDOVER_ORDER: ReadonlyArray<HandoverCategory> = [
  "OM_MANUAL",
  "AS_BUILT",
  "CERTIFICATE",
  "WARRANTY",
  "TEST_RECORD",
  "TRAINING",
  "OTHER",
];

const AGE_BUCKETS: ReadonlyArray<{ label: string; max: number }> = [
  { label: "0–7 days", max: 7 },
  { label: "8–14 days", max: 14 },
  { label: "15–30 days", max: 30 },
  { label: "31–60 days", max: 60 },
  { label: "Over 60 days", max: Number.POSITIVE_INFINITY },
];

const RESULT_COLOR = {
  pass: "#3f8a68",
  observations: "#9cc9b2",
  fail: "#b5493e",
  unassessed: "#c3c9c5",
  pending: "#e3e7e3",
} as const;

type Grouping = "trade" | "location";

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

interface NcrRow {
  ncr: ProjectNcr;
  age: number;
  dueDay: number;
  lateDays: number;
}

interface DisciplineRow {
  discipline: QualityDiscipline;
  pass: number;
  observations: number;
  fail: number;
  unassessed: number;
  pending: number;
  overdue: number;
  total: number;
}

interface PunchGroup {
  label: string;
  total: number;
  overdue: number;
  byPriority: Record<PunchPriority, number>;
}

interface HandoverRow {
  category: HandoverCategory;
  total: number;
  approved: number;
  submitted: number;
  rejected: number;
  notStarted: number;
  overdue: number;
}

function ageBucketIndex(age: number): number {
  const index = AGE_BUCKETS.findIndex((bucket) => age <= bucket.max);

  return index === -1 ? AGE_BUCKETS.length - 1 : index;
}

export function ProjectQualityBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<QualityControl | null>(null);
  const [error, setError] = useState("");
  const [grouping, setGrouping] = useState<Grouping>("trade");
  const [showAllGroups, setShowAllGroups] = useState(false);
  const [showAllNcrs, setShowAllNcrs] = useState(false);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectQuality(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load quality data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const ncrs = (data?.ncrs ?? []).filter((item) => item.status !== "VOID");
    const punch = (data?.punchItems ?? []).filter((item) => item.status !== "VOID");
    const inspections = (data?.inspections ?? []).filter((item) => item.status !== "CANCELLED");
    const handover = (data?.handoverItems ?? []).filter((item) => item.status !== "NOT_REQUIRED");

    const openNcrs: NcrRow[] = ncrs
      .filter((item) => item.status !== "CLOSED")
      .map((ncr) => {
        const raised = toDay(ncr.raisedDate);
        const dueDay = toDay(ncr.dueDate);
        const lateDays = Number.isFinite(dueDay) ? Math.max(0, today - dueDay) : 0;

        return {
          ncr,
          age: Number.isFinite(raised) ? Math.max(0, today - raised) : 0,
          dueDay,
          lateDays: ncr.overdue ? Math.max(1, lateDays) : lateDays,
        };
      })
      .sort(
        (a, b) =>
          NCR_SEVERITY_RANK[b.ncr.severity] - NCR_SEVERITY_RANK[a.ncr.severity] ||
          b.lateDays - a.lateDays ||
          b.age - a.age,
      );

    const ageing = AGE_BUCKETS.map((bucket) => ({
      label: bucket.label,
      total: 0,
      bySeverity: { MINOR: 0, MAJOR: 0, CRITICAL: 0 } as Record<NcrSeverity, number>,
    }));

    for (const row of openNcrs) {
      const bucket = ageing[ageBucketIndex(row.age)];

      if (bucket) {
        bucket.total += 1;
        bucket.bySeverity[row.ncr.severity] += 1;
      }
    }

    const categories = new Map<NcrCategory, { open: number; closed: number; recent: number }>();

    for (const item of ncrs) {
      const entry = categories.get(item.category) ?? { open: 0, closed: 0, recent: 0 };

      if (item.status === "CLOSED") {
        entry.closed += 1;
      } else {
        entry.open += 1;
      }

      if (today - toDay(item.raisedDate) <= RECENT_DAYS) {
        entry.recent += 1;
      }

      categories.set(item.category, entry);
    }

    const categoryRows = [...categories.entries()]
      .map(([category, value]) => ({ category, ...value }))
      .sort((a, b) => b.open + b.closed - (a.open + a.closed));

    const recurringCount = categoryRows.filter((row) => row.recent >= RECURRING_THRESHOLD).length;

    const disciplineMap = new Map<QualityDiscipline, DisciplineRow>();

    for (const discipline of DISCIPLINES) {
      disciplineMap.set(discipline, {
        discipline,
        pass: 0,
        observations: 0,
        fail: 0,
        unassessed: 0,
        pending: 0,
        overdue: 0,
        total: 0,
      });
    }

    for (const item of inspections) {
      const row = disciplineMap.get(item.discipline);

      if (!row) {
        continue;
      }

      row.total += 1;

      if (item.status === "COMPLETED") {
        if (item.result === "PASS") {
          row.pass += 1;
        } else if (item.result === "PASS_WITH_OBSERVATIONS") {
          row.observations += 1;
        } else if (item.result === "FAIL") {
          row.fail += 1;
        } else {
          row.unassessed += 1;
        }
      } else {
        row.pending += 1;

        if (toDay(item.plannedDate) < today) {
          row.overdue += 1;
        }
      }
    }

    const disciplineRows = [...disciplineMap.values()]
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total);

    const events = new Map<number, { raised: number; closed: number }>();

    for (const item of punch) {
      const raisedDay = toDay(item.raisedDate);

      if (Number.isFinite(raisedDay)) {
        const entry = events.get(raisedDay) ?? { raised: 0, closed: 0 };
        entry.raised += 1;
        events.set(raisedDay, entry);
      }

      const closedDay = item.status === "CLOSED" ? toDay(item.closedDate) : NaN;

      if (Number.isFinite(closedDay)) {
        const entry = events.get(closedDay) ?? { raised: 0, closed: 0 };
        entry.closed += 1;
        events.set(closedDay, entry);
      }
    }

    if (events.size > 0 && !events.has(today)) {
      events.set(today, { raised: 0, closed: 0 });
    }

    const days = [...events.keys()].sort((a, b) => a - b);
    const open: ChartSeries = { name: "Open", color: "#19201e", points: [] };
    const raised: ChartSeries = { name: "Raised (cumulative)", color: "#8a948f", points: [], dashed: true };
    const closed: ChartSeries = { name: "Closed (cumulative)", color: "#3f8a68", points: [] };
    let raisedTotal = 0;
    let closedTotal = 0;

    for (const day of days) {
      const entry = events.get(day);

      raisedTotal += entry?.raised ?? 0;
      closedTotal += entry?.closed ?? 0;
      open.points.push({ x: day, y: raisedTotal - closedTotal });
      raised.points.push({ x: day, y: raisedTotal });
      closed.points.push({ x: day, y: closedTotal });
    }

    const burndown: ChartSeries[] = days.length >= 2 ? [open, raised, closed] : [];

    const openPunch = punch.filter((item) => item.status !== "CLOSED");

    const groupFor = (item: PunchItem): string =>
      (grouping === "trade" ? item.trade : item.location)?.trim() ||
      (grouping === "trade" ? "No trade" : "No location");

    const groups = new Map<string, PunchGroup>();

    for (const item of openPunch) {
      const label = groupFor(item);
      const group = groups.get(label) ?? {
        label,
        total: 0,
        overdue: 0,
        byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      };

      group.total += 1;
      group.byPriority[item.priority] += 1;

      if (item.overdue) {
        group.overdue += 1;
      }

      groups.set(label, group);
    }

    const punchGroups = [...groups.values()].sort(
      (a, b) => b.total - a.total || b.overdue - a.overdue,
    );

    const handoverMap = new Map<HandoverCategory, HandoverRow>();

    for (const category of HANDOVER_ORDER) {
      handoverMap.set(category, {
        category,
        total: 0,
        approved: 0,
        submitted: 0,
        rejected: 0,
        notStarted: 0,
        overdue: 0,
      });
    }

    for (const item of handover) {
      const row = handoverMap.get(item.category);

      if (!row) {
        continue;
      }

      row.total += 1;

      if (item.status === "APPROVED") {
        row.approved += 1;
      } else {
        if (item.status === "SUBMITTED") {
          row.submitted += 1;
        } else if (item.status === "REJECTED") {
          row.rejected += 1;
        } else {
          row.notStarted += 1;
        }

        if (item.overdue) {
          row.overdue += 1;
        }
      }
    }

    return {
      openNcrs,
      ageing,
      maxAge: Math.max(0, ...ageing.map((item) => item.total)),
      categoryRows,
      recurringCount,
      disciplineRows,
      burndown,
      openPunchCount: openPunch.length,
      punchGroups,
      handoverRows: [...handoverMap.values()].filter((row) => row.total > 0),
    };
  }, [data, grouping, today]);

  const intel = data?.intelligence;
  const visibleNcrs = showAllNcrs ? model.openNcrs : model.openNcrs.slice(0, LIST_LIMIT);
  const visibleGroups = showAllGroups ? model.punchGroups : model.punchGroups.slice(0, GROUP_LIMIT);
  const maxGroup = Math.max(1, ...model.punchGroups.map((group) => group.total));

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">QUALITY BOARD</div>

            <h1>{data ? data.project.name : "Quality board"}</h1>

            <p className={styles.subtitle}>
              Open NCR ageing, inspection results by discipline, the punch-list
              burn-down and handover progress. Record inspections, NCRs and
              punch items in quality control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/quality`}>
            Open quality control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading quality data…</div>}

        {data && intel && (
          <>
            <section aria-label="Quality summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>QUALITY SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.qualityScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.qualityRisk])}>
                    {RISK_LABEL[intel.qualityRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>INSPECTION PASS RATE</div>
                <div className={styles.kpiValue}>
                  {intel.completedInspections > 0
                    ? `${num(intel.inspectionPassRatePercentage)}%`
                    : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {intel.passedInspections} passed · {intel.failedInspections} failed ·{" "}
                  {intel.completedInspections} completed
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN NCRS</div>
                <div className={cx(styles.kpiValue, intel.criticalOpenNcrs > 0 && styles.neg)}>
                  {intel.openNcrs}
                </div>
                <div className={styles.kpiSub}>
                  {intel.criticalOpenNcrs} critical · {intel.overdueNcrs} overdue
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN PUNCH ITEMS</div>
                <div className={cx(styles.kpiValue, intel.overduePunchItems > 0 && styles.neg)}>
                  {intel.openPunchItems}
                </div>
                <div className={styles.kpiSub}>{intel.overduePunchItems} overdue</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>HANDOVER READINESS</div>
                <div className={styles.kpiValue}>
                  {intel.requiredHandoverItems > 0
                    ? `${num(intel.handoverReadinessPercentage)}%`
                    : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {intel.approvedHandoverItems} of {intel.requiredHandoverItems} approved ·{" "}
                  {intel.overdueHandoverItems} overdue
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>RECURRING DEFECTS</div>
                <div
                  className={cx(
                    styles.kpiValue,
                    model.recurringCount > 0 && styles.neg,
                  )}
                >
                  {model.recurringCount}
                </div>
                <div className={styles.kpiSub}>categories in the last {RECENT_DAYS} days</div>
              </article>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">NCR AGEING</div>
                    <h2>How long open NCRs have waited</h2>
                  </div>

                  <span className={styles.muted}>{model.openNcrs.length} open</span>
                </header>

                {model.openNcrs.length === 0 ? (
                  <div className={styles.emptySmall}>No open NCRs.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.ageing.map((bucket) => (
                      <li key={bucket.label}>
                        <div className={styles.ageingTop}>
                          <span>{bucket.label}</span>
                          <strong>{bucket.total}</strong>
                        </div>

                        <div
                          aria-label={`${bucket.total} open NCRs aged ${bucket.label}`}
                          className={styles.stackTrack}
                          role="img"
                        >
                          <div
                            className={styles.stack}
                            style={{ width: `${percent(bucket.total, model.maxAge)}%` }}
                          >
                            {NCR_SEVERITIES.map((severity) =>
                              bucket.bySeverity[severity] > 0 ? (
                                <i
                                  key={severity}
                                  style={{
                                    background: NCR_SEVERITY_COLOR[severity],
                                    flexGrow: bucket.bySeverity[severity],
                                  }}
                                  title={`${bucket.bySeverity[severity]} ${NCR_SEVERITY_LABEL[
                                    severity
                                  ].toLowerCase()}`}
                                />
                              ) : null,
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <ul aria-label="Severity legend" className={styles.legend}>
                  {NCR_SEVERITIES.map((severity) => (
                    <li key={severity}>
                      <i
                        className={styles.swatch}
                        style={{ background: NCR_SEVERITY_COLOR[severity] }}
                      />
                      {NCR_SEVERITY_LABEL[severity]}
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">DEFECT CATEGORIES</div>
                    <h2>NCRs by category</h2>
                  </div>

                  <span className={styles.muted}>{model.categoryRows.length} categories</span>
                </header>

                {model.categoryRows.length === 0 ? (
                  <div className={styles.emptySmall}>No NCRs recorded yet.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.categoryRows.map((row) => {
                      const total = row.open + row.closed;
                      const recurring = row.recent >= RECURRING_THRESHOLD;

                      return (
                        <li key={row.category}>
                          <div className={styles.ageingTop}>
                            <span>
                              {NCR_CATEGORY_LABEL[row.category]}
                              {recurring && <em className={styles.late}>RECURRING</em>}
                            </span>
                            <strong>
                              {total}
                              <small>
                                {row.open} open · {row.closed} closed
                              </small>
                            </strong>
                          </div>

                          <div
                            aria-label={`${row.open} open and ${row.closed} closed`}
                            className={styles.split}
                            role="img"
                          >
                            <div
                              className={styles.splitBad}
                              style={{ width: `${percent(row.open, total)}%` }}
                            />
                            <div
                              className={styles.splitGood}
                              style={{ width: `${percent(row.closed, total)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <p className={styles.hint}>
                  Recurring means {RECURRING_THRESHOLD} or more NCRs raised in the same
                  category in the last {RECENT_DAYS} days. Red is open, green is closed.
                </p>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">INSPECTIONS</div>
                  <h2>Results by discipline</h2>
                </div>

                <span className={styles.muted}>
                  {model.disciplineRows.reduce((sum, row) => sum + row.total, 0)} inspections
                </span>
              </header>

              {model.disciplineRows.length === 0 ? (
                <div className={styles.emptySmall}>No inspections recorded yet.</div>
              ) : (
                <ul className={styles.disciplines}>
                  {model.disciplineRows.map((row) => {
                    const judged = row.pass + row.observations + row.fail;
                    const passRate = judged > 0 ? percent(row.pass + row.observations, judged) : null;
                    const segments = [
                      { key: "pass", label: "Pass", value: row.pass, color: RESULT_COLOR.pass },
                      {
                        key: "observations",
                        label: "Pass with observations",
                        value: row.observations,
                        color: RESULT_COLOR.observations,
                      },
                      { key: "fail", label: "Fail", value: row.fail, color: RESULT_COLOR.fail },
                      {
                        key: "unassessed",
                        label: "Not assessed",
                        value: row.unassessed,
                        color: RESULT_COLOR.unassessed,
                      },
                      {
                        key: "pending",
                        label: "Planned or in progress",
                        value: row.pending,
                        color: RESULT_COLOR.pending,
                      },
                    ];

                    return (
                      <li key={row.discipline}>
                        <strong className={styles.disciplineName}>
                          {DISCIPLINE_LABEL[row.discipline]}
                        </strong>

                        <div
                          aria-label={`${DISCIPLINE_LABEL[row.discipline]}: ${row.pass} pass, ${row.observations} pass with observations, ${row.fail} fail, ${row.pending} pending`}
                          className={styles.stackFull}
                          role="img"
                        >
                          {segments.map((segment) =>
                            segment.value > 0 ? (
                              <i
                                key={segment.key}
                                style={{ background: segment.color, flexGrow: segment.value }}
                                title={`${segment.value} ${segment.label.toLowerCase()}`}
                              />
                            ) : null,
                          )}
                        </div>

                        <span className={styles.disciplineMeta}>
                          {row.total} total
                          {passRate !== null && <> · {num(passRate)}% pass</>}
                          {row.fail > 0 && <em className={styles.late}>{row.fail} FAILED</em>}
                          {row.overdue > 0 && (
                            <em className={styles.late}>{row.overdue} OVERDUE</em>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <ul aria-label="Result legend" className={styles.legend}>
                <li>
                  <i className={styles.swatch} style={{ background: RESULT_COLOR.pass }} />
                  Pass
                </li>
                <li>
                  <i className={styles.swatch} style={{ background: RESULT_COLOR.observations }} />
                  Pass with observations
                </li>
                <li>
                  <i className={styles.swatch} style={{ background: RESULT_COLOR.fail }} />
                  Fail
                </li>
                <li>
                  <i className={styles.swatch} style={{ background: RESULT_COLOR.unassessed }} />
                  Not assessed
                </li>
                <li>
                  <i
                    className={cx(styles.swatch, styles.swatchOutline)}
                    style={{ background: RESULT_COLOR.pending }}
                  />
                  Planned or in progress
                </li>
              </ul>

              <p className={styles.hint}>
                The pass rate counts a pass with observations as a pass. Overdue means planned in
                the past and not yet completed.
              </p>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PUNCH LIST</div>
                  <h2>Burn-down</h2>
                </div>

                <span className={styles.muted}>{model.openPunchCount} open now</span>
              </header>

              {model.burndown.length === 0 ? (
                <div className={styles.emptySmall}>
                  The burn-down needs punch items raised on at least two different days.
                </div>
              ) : (
                <LineChart
                  ariaLabel="Punch list burn-down: items open, cumulative raised and cumulative closed"
                  formatX={formatDay}
                  formatY={(value) => num(value)}
                  height={280}
                  series={model.burndown}
                  yMin={0}
                />
              )}
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">OPEN PUNCH ITEMS</div>
                    <h2>Where the work is</h2>
                  </div>

                  <div aria-label="Group by" className={styles.segmented} role="group">
                    {(["trade", "location"] as const).map((key) => (
                      <button
                        aria-pressed={grouping === key}
                        className={cx(styles.segment, grouping === key && styles.segmentOn)}
                        key={key}
                        onClick={() => setGrouping(key)}
                        type="button"
                      >
                        By {key}
                      </button>
                    ))}
                  </div>
                </header>

                {model.punchGroups.length === 0 ? (
                  <div className={styles.emptySmall}>No open punch items.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {visibleGroups.map((group) => (
                      <li key={group.label}>
                        <div className={styles.ageingTop}>
                          <span>{group.label}</span>
                          <strong>
                            {group.total}
                            {group.overdue > 0 && (
                              <small className={styles.neg}>{group.overdue} overdue</small>
                            )}
                          </strong>
                        </div>

                        <div
                          aria-label={`${group.total} open punch items for ${group.label}`}
                          className={styles.stackTrack}
                          role="img"
                        >
                          <div
                            className={styles.stack}
                            style={{ width: `${percent(group.total, maxGroup)}%` }}
                          >
                            {PRIORITIES.map((priority) =>
                              group.byPriority[priority] > 0 ? (
                                <i
                                  key={priority}
                                  style={{
                                    background: PRIORITY_COLOR[priority],
                                    flexGrow: group.byPriority[priority],
                                  }}
                                  title={`${group.byPriority[priority]} ${PRIORITY_LABEL[
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

                <div className={styles.footRow}>
                  <ul aria-label="Priority legend" className={styles.legend}>
                    {PRIORITIES.map((priority) => (
                      <li key={priority}>
                        <i
                          className={styles.swatch}
                          style={{ background: PRIORITY_COLOR[priority] }}
                        />
                        {PRIORITY_LABEL[priority]}
                      </li>
                    ))}
                  </ul>

                  {model.punchGroups.length > GROUP_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllGroups((value) => !value)}
                      type="button"
                    >
                      {showAllGroups
                        ? `Show first ${GROUP_LIMIT}`
                        : `Show all ${model.punchGroups.length}`}
                    </button>
                  )}
                </div>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">HANDOVER</div>
                    <h2>Documentation progress</h2>
                  </div>

                  <span className={styles.muted}>
                    {intel.approvedHandoverItems}/{intel.requiredHandoverItems} approved
                  </span>
                </header>

                {model.handoverRows.length === 0 ? (
                  <div className={styles.emptySmall}>No handover items required yet.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.handoverRows.map((row) => {
                      const segments = [
                        { key: "approved", label: "approved", value: row.approved, color: "#3f8a68" },
                        { key: "submitted", label: "submitted", value: row.submitted, color: "#7ab397" },
                        { key: "rejected", label: "rejected", value: row.rejected, color: "#b5493e" },
                        { key: "notStarted", label: "not started", value: row.notStarted, color: "#d5dad6" },
                      ];

                      return (
                        <li key={row.category}>
                          <div className={styles.ageingTop}>
                            <span>
                              {HANDOVER_LABEL[row.category]}
                              {row.overdue > 0 && (
                                <em className={styles.late}>{row.overdue} OVERDUE</em>
                              )}
                            </span>
                            <strong>
                              {row.approved}/{row.total}
                              <small>
                                {row.submitted} submitted · {row.rejected} rejected
                              </small>
                            </strong>
                          </div>

                          <div
                            aria-label={`${row.approved} of ${row.total} approved`}
                            className={styles.stackFull}
                            role="img"
                          >
                            {segments.map((segment) =>
                              segment.value > 0 ? (
                                <i
                                  key={segment.key}
                                  style={{ background: segment.color, flexGrow: segment.value }}
                                  title={`${segment.value} ${segment.label}`}
                                />
                              ) : null,
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <ul aria-label="Status legend" className={styles.legend}>
                  <li>
                    <i className={styles.swatch} style={{ background: "#3f8a68" }} />
                    Approved
                  </li>
                  <li>
                    <i className={styles.swatch} style={{ background: "#7ab397" }} />
                    Submitted
                  </li>
                  <li>
                    <i className={styles.swatch} style={{ background: "#b5493e" }} />
                    Rejected
                  </li>
                  <li>
                    <i className={styles.swatch} style={{ background: "#d5dad6" }} />
                    Not started
                  </li>
                </ul>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">NEEDS ACTION</div>
                  <h2>Open NCRs, most severe first</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>
                    {model.openNcrs.length} open ·{" "}
                    {model.openNcrs.filter((row) => row.lateDays > 0).length} overdue
                  </span>

                  {model.openNcrs.length > LIST_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllNcrs((value) => !value)}
                      type="button"
                    >
                      {showAllNcrs
                        ? `Show first ${LIST_LIMIT}`
                        : `Show all ${model.openNcrs.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.openNcrs.length === 0 ? (
                <div className={styles.emptySmall}>No open NCRs. Everything is closed out.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>REFERENCE</th>
                        <th>NCR</th>
                        <th>CATEGORY</th>
                        <th>SEVERITY</th>
                        <th>OWNER</th>
                        <th>DUE</th>
                        <th className={styles.num}>AGE</th>
                        <th className={styles.num}>LATE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleNcrs.map((row) => (
                        <tr key={row.ncr.id}>
                          <td>
                            <strong>{row.ncr.reference}</strong>
                          </td>
                          <td className={styles.wrap}>{row.ncr.title}</td>
                          <td>{NCR_CATEGORY_LABEL[row.ncr.category]}</td>
                          <td>
                            <span className={cx(styles.sev, NCR_SEVERITY_CLASS[row.ncr.severity])}>
                              {NCR_SEVERITY_LABEL[row.ncr.severity]}
                            </span>
                          </td>
                          <td>{row.ncr.ownerName ?? "Unassigned"}</td>
                          <td>{formatDay(row.dueDay)}</td>
                          <td className={styles.num}>{row.age} d</td>
                          <td className={cx(styles.num, row.lateDays > 0 && styles.neg)}>
                            {row.lateDays > 0 ? `${row.lateDays} d` : "—"}
                          </td>
                          <td>{NCR_STATUS_LABEL[row.ncr.status]}</td>
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
