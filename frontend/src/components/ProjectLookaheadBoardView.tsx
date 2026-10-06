"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import type {
  ScheduleActivity,
  ScheduleConstraint,
  ScheduleConstraintType,
  ScheduleControl,
  ScheduleRiskLevel,
} from "@/types/project";

import styles from "./ProjectLookaheadBoardView.module.css";

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 42;
const WEEKS = WINDOW_DAYS / 7;
const ROW_LIMIT = 20;
const LIST_LIMIT = 10;
const CHAIN_LIMIT = 14;
const STALE_DATA_DAYS = 7;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const RISK_LABEL: Record<ScheduleRiskLevel, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<ScheduleRiskLevel, string | undefined> = {
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const CONSTRAINT_LABEL: Record<ScheduleConstraintType, string> = {
  DESIGN_INFORMATION: "Design information",
  MATERIAL: "Material",
  ACCESS: "Access",
  LABOR: "Labour",
  EQUIPMENT: "Equipment",
  APPROVAL: "Approval",
  PERMIT: "Permit",
  PREDECESSOR: "Predecessor",
  OTHER: "Other",
};

const CONSTRAINT_ORDER = Object.keys(CONSTRAINT_LABEL) as ScheduleConstraintType[];

const FLOAT_BUCKETS: ReadonlyArray<{ label: string; test: (value: number) => boolean; color: string }> = [
  { label: "Negative float", test: (value) => value < 0, color: "#8f3a31" },
  { label: "Zero float", test: (value) => value === 0, color: "#b5493e" },
  { label: "1 to 5 days", test: (value) => value >= 1 && value <= 5, color: "#d9823a" },
  { label: "6 to 10 days", test: (value) => value >= 6 && value <= 10, color: "#dcb85e" },
  { label: "11 to 20 days", test: (value) => value >= 11 && value <= 20, color: "#9cc9b2" },
  { label: "Over 20 days", test: (value) => value > 20, color: "#3f8a68" },
];

const BAR_COLOR = { critical: "#b5493e", near: "#d9823a", normal: "#6fa88c" } as const;

const STATUS_LABEL: Record<ScheduleActivity["status"], string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};

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

function shortDay(day: number): string {
  const date = new Date(day * DAY_MS);

  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ""}`;
}

function num(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function signed(value: number, digits = 0): string {
  const text = num(Math.abs(value), digits);

  if (value > 0) {
    return `+${text}`;
  }

  return value < 0 ? `−${text}` : text;
}

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

interface BarRow {
  activity: ScheduleActivity;
  startDay: number;
  finishDay: number;
  left: number;
  width: number;
  clippedStart: boolean;
  clippedEnd: boolean;
  tone: keyof typeof BAR_COLOR;
  constrained: boolean;
}

interface ConstraintRow {
  constraint: ScheduleConstraint;
  dueDay: number;
  lateDays: number;
  critical: boolean;
}

export function ProjectLookaheadBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [error, setError] = useState("");
  const [showAllRows, setShowAllRows] = useState(false);
  const [showAllConstraints, setShowAllConstraints] = useState(false);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectSchedule(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load schedule data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const activities = data?.activities ?? [];
    const constraints = data?.constraints ?? [];
    const dataDay = toDay(data?.intelligence.dataDate ?? null);
    const anchor = Number.isFinite(dataDay) ? dataDay : today;
    const windowEnd = anchor + WINDOW_DAYS;

    const openByActivity = new Map<string, number>();

    for (const constraint of constraints) {
      if (constraint.status === "OPEN") {
        openByActivity.set(
          constraint.activityId,
          (openByActivity.get(constraint.activityId) ?? 0) + 1,
        );
      }
    }

    const rows: BarRow[] = activities
      .filter((item) => item.status !== "COMPLETED")
      .map((activity) => {
        const start = toDay(activity.currentStart);
        const finish = toDay(activity.currentFinish);

        return { activity, start, finish };
      })
      .filter(
        ({ start, finish }) =>
          Number.isFinite(start) && Number.isFinite(finish) && finish >= anchor && start < windowEnd,
      )
      .map(({ activity, start, finish }) => {
        const clippedStart = start < anchor;
        const clippedEnd = finish + 1 > windowEnd;
        const from = Math.max(start, anchor);
        const to = Math.min(finish + 1, windowEnd);

        return {
          activity,
          startDay: start,
          finishDay: finish,
          left: percent(from - anchor, WINDOW_DAYS),
          width: Math.max(1.4, percent(to - from, WINDOW_DAYS)),
          clippedStart,
          clippedEnd,
          tone: activity.critical ? "critical" : activity.nearCritical ? "near" : "normal",
          constrained: (openByActivity.get(activity.id) ?? 0) > 0,
        } as BarRow;
      })
      .sort(
        (a, b) =>
          a.startDay - b.startDay ||
          Number(b.activity.critical) - Number(a.activity.critical) ||
          a.activity.activityCode.localeCompare(b.activity.activityCode),
      );

    const live = activities.filter((item) => item.status !== "COMPLETED");
    const floatBuckets = FLOAT_BUCKETS.map((bucket) => ({
      label: bucket.label,
      color: bucket.color,
      count: live.filter((item) => bucket.test(item.totalFloatDays)).length,
    }));

    const byCode = new Map(activities.map((item) => [item.activityCode, item]));
    const byId = new Map(activities.map((item) => [item.id, item]));

    const open: ConstraintRow[] = constraints
      .filter((item) => item.status === "OPEN")
      .map((constraint) => {
        const dueDay = toDay(constraint.dueDate);
        const late = Number.isFinite(dueDay) ? Math.max(0, today - dueDay) : 0;

        return {
          constraint,
          dueDay,
          lateDays: constraint.overdue ? Math.max(1, late) : late,
          critical: byId.get(constraint.activityId)?.critical ?? false,
        };
      })
      .sort(
        (a, b) =>
          b.lateDays - a.lateDays ||
          Number(b.critical) - Number(a.critical) ||
          a.dueDay - b.dueDay,
      );

    const byType = CONSTRAINT_ORDER.map((type) => {
      const items = open.filter((row) => row.constraint.constraintType === type);

      return {
        type,
        total: items.length,
        late: items.filter((row) => row.lateDays > 0).length,
      };
    }).filter((row) => row.total > 0);

    const chain = (data?.intelligence.criticalPathActivityCodes ?? [])
      .map((code) => byCode.get(code))
      .filter((item): item is ScheduleActivity => Boolean(item));

    return {
      anchor,
      windowEnd,
      rows,
      floatBuckets,
      floatMax: Math.max(0, ...floatBuckets.map((item) => item.count)),
      open,
      byType,
      typeMax: Math.max(0, ...byType.map((item) => item.total)),
      chain,
      liveCount: live.length,
      todayOffset: percent(today - anchor, WINDOW_DAYS),
      todayInside: today > anchor && today < windowEnd,
      staleDays: today - anchor,
    };
  }, [data, today]);

  const intel = data?.intelligence;
  const visibleRows = showAllRows ? model.rows : model.rows.slice(0, ROW_LIMIT);
  const visibleConstraints = showAllConstraints ? model.open : model.open.slice(0, LIST_LIMIT);
  const cpmDay = intel ? toDay(intel.cpmForecastFinishDate) : NaN;
  const baselineDay = intel ? toDay(intel.baselineFinishDate) : NaN;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">LOOKAHEAD BOARD</div>

            <h1>{data ? data.project.name : "Lookahead board"}</h1>

            <p className={styles.subtitle}>
              The next six weeks of work, how much float the programme has, and the constraints
              standing in the way. Record activities and constraints in schedule control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/schedule`}>
            Open schedule control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {data && intel && !intel.networkValid && (
          <div className="offline-banner">
            <div>
              <strong>The schedule network is not valid.</strong>
              <span> {intel.networkError ?? "Float and critical path figures may be unreliable."}</span>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading schedule data…</div>}

        {data && intel && (
          <>
            <section aria-label="Schedule summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>SCHEDULE SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.scheduleScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.scheduleRisk])}>
                    {RISK_LABEL[intel.scheduleRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST FINISH</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>
                  {Number.isFinite(cpmDay) ? formatDay(cpmDay) : "—"}
                </div>
                <div className={cx(styles.kpiSub, intel.baselineFinishVarianceDays > 0 && styles.neg)}>
                  {intel.approvedBaselineName
                    ? `${signed(intel.baselineFinishVarianceDays)} d vs baseline`
                    : "No approved baseline"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CRITICAL PATH</div>
                <div className={styles.kpiValue}>{intel.criticalActivities}</div>
                <div className={styles.kpiSub}>
                  activities · {intel.criticalPathLengthDays} d long · {intel.nearCriticalActivities}{" "}
                  near critical
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AVERAGE FLOAT</div>
                <div className={cx(styles.kpiValue, intel.averageTotalFloatDays < 0 && styles.neg)}>
                  {num(intel.averageTotalFloatDays, 1)} d
                </div>
                <div className={styles.kpiSub}>
                  {intel.overdueActivities} overdue · {intel.inProgressActivities} in progress
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN CONSTRAINTS</div>
                <div className={cx(styles.kpiValue, intel.overdueConstraints > 0 && styles.neg)}>
                  {intel.openConstraints}
                </div>
                <div className={styles.kpiSub}>
                  {intel.overdueConstraints} overdue · {intel.constrainedCriticalActivities} on the
                  critical path
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NEXT 6 WEEKS</div>
                <div className={styles.kpiValue}>{intel.lookahead42DayActivities}</div>
                <div className={styles.kpiSub}>
                  activities · {intel.lookahead14DayActivities} in 14 d · {intel.lookahead28DayActivities}{" "}
                  in 28 d
                </div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">SIX-WEEK LOOKAHEAD</div>
                  <h2>
                    {shortDay(model.anchor)} to {shortDay(model.windowEnd - 1)}
                  </h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>
                    {model.rows.length} {model.rows.length === 1 ? "activity" : "activities"}
                  </span>

                  {model.rows.length > ROW_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllRows((value) => !value)}
                      type="button"
                    >
                      {showAllRows ? `Show first ${ROW_LIMIT}` : `Show all ${model.rows.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.staleDays > STALE_DATA_DAYS && (
                <p className={styles.warn}>
                  The schedule data date is {model.staleDays} days old, so this window starts in the
                  past. Update progress and re-run the schedule to refresh it.
                </p>
              )}

              {model.rows.length === 0 ? (
                <div className={styles.emptySmall}>No activities are scheduled in this window.</div>
              ) : (
                <div className={styles.ganttScroll}>
                  <div className={styles.gantt}>
                    <div className={styles.ganttHead}>
                      <span className={styles.ganttLabelHead}>ACTIVITY</span>

                      <div className={styles.ganttAxis}>
                        {Array.from({ length: WEEKS }, (_, index) => (
                          <span key={index}>{shortDay(model.anchor + index * 7)}</span>
                        ))}
                      </div>
                    </div>

                    {visibleRows.map((row) => (
                      <div className={styles.ganttRow} key={row.activity.id}>
                        <div className={styles.ganttLabel}>
                          <strong>{row.activity.activityCode}</strong>
                          <span title={row.activity.name}>{row.activity.name}</span>
                        </div>

                        <div className={styles.ganttTrack}>
                          {model.todayInside && (
                            <i className={styles.todayLine} style={{ left: `${model.todayOffset}%` }} />
                          )}

                          <div
                            aria-label={`${row.activity.activityCode} ${row.activity.name}, ${formatDay(row.startDay)} to ${formatDay(row.finishDay)}, ${num(row.activity.progressPercentage)}% complete`}
                            className={cx(
                              styles.bar,
                              row.activity.status === "ON_HOLD" && styles.barHold,
                              row.clippedStart && styles.barClipStart,
                              row.clippedEnd && styles.barClipEnd,
                            )}
                            role="img"
                            style={{
                              background: `${BAR_COLOR[row.tone]}40`,
                              left: `${row.left}%`,
                              width: `${row.width}%`,
                            }}
                            title={`${row.activity.activityCode}: ${formatDay(row.startDay)} to ${formatDay(row.finishDay)} · ${num(row.activity.progressPercentage)}% · float ${row.activity.totalFloatDays} d · ${STATUS_LABEL[row.activity.status]}`}
                          >
                            <span
                              className={styles.barFill}
                              style={{
                                background: BAR_COLOR[row.tone],
                                width: `${Math.min(100, Math.max(0, row.activity.progressPercentage))}%`,
                              }}
                            />
                            {row.constrained && <em className={styles.flag}>!</em>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {model.rows.length > 0 && <p className={styles.swipe}>Swipe sideways to see all six weeks.</p>}

              {model.rows.length > 0 && (
                <>
                  <ul aria-label="Bar legend" className={styles.legend}>
                    <li>
                      <i className={styles.swatch} style={{ background: BAR_COLOR.critical }} />
                      Critical
                    </li>
                    <li>
                      <i className={styles.swatch} style={{ background: BAR_COLOR.near }} />
                      Near critical
                    </li>
                    <li>
                      <i className={styles.swatch} style={{ background: BAR_COLOR.normal }} />
                      Other
                    </li>
                    <li>
                      <em className={cx(styles.flag, styles.flagStatic)}>!</em>
                      Open constraint
                    </li>
                    {model.todayInside && (
                      <li>
                        <i className={styles.swatchToday} />
                        Today
                      </li>
                    )}
                  </ul>
                  <p className={styles.hint}>
                    The solid part of each bar is the progress recorded so far. Activities that started
                    before the window or finish after it are cut at the edge.
                  </p>
                </>
              )}
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">FLOAT</div>
                    <h2>How much slack is left</h2>
                  </div>

                  <span className={styles.muted}>{model.liveCount} unfinished</span>
                </header>

                {model.liveCount === 0 ? (
                  <div className={styles.emptySmall}>All activities are complete.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.floatBuckets.map((bucket) => (
                      <li key={bucket.label}>
                        <div className={styles.ageingTop}>
                          <span>{bucket.label}</span>
                          <strong>
                            {bucket.count}
                            <small>{num(percent(bucket.count, model.liveCount))}%</small>
                          </strong>
                        </div>

                        <div
                          aria-label={`${bucket.count} activities with ${bucket.label.toLowerCase()}`}
                          className={styles.track}
                          role="img"
                        >
                          <div
                            className={styles.fill}
                            style={{
                              background: bucket.color,
                              width: `${percent(bucket.count, model.floatMax)}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                <p className={styles.hint}>
                  Total float is how far an activity can slip before the finish date moves. Zero or
                  negative float means the activity is driving the finish.
                </p>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">CONSTRAINTS</div>
                    <h2>What is holding work back</h2>
                  </div>

                  <span className={styles.muted}>{model.open.length} open</span>
                </header>

                {model.byType.length === 0 ? (
                  <div className={styles.emptySmall}>No open constraints.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.byType.map((row) => (
                      <li key={row.type}>
                        <div className={styles.ageingTop}>
                          <span>{CONSTRAINT_LABEL[row.type]}</span>
                          <strong>
                            {row.total}
                            {row.late > 0 && <small className={styles.neg}>{row.late} overdue</small>}
                          </strong>
                        </div>

                        <div
                          aria-label={`${row.total} open ${CONSTRAINT_LABEL[row.type].toLowerCase()} constraints`}
                          className={styles.stackTrack}
                          role="img"
                        >
                          <div
                            className={styles.stack}
                            style={{ width: `${percent(row.total, model.typeMax)}%` }}
                          >
                            {row.late > 0 && (
                              <i
                                style={{ background: "#b5493e", flexGrow: row.late }}
                                title={`${row.late} overdue`}
                              />
                            )}
                            {row.total - row.late > 0 && (
                              <i
                                style={{ background: "#dcb85e", flexGrow: row.total - row.late }}
                                title={`${row.total - row.late} not yet due`}
                              />
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {model.byType.length > 0 && (
                  <ul aria-label="Constraint legend" className={styles.legend}>
                    <li>
                      <i className={styles.swatch} style={{ background: "#b5493e" }} />
                      Overdue
                    </li>
                    <li>
                      <i className={styles.swatch} style={{ background: "#dcb85e" }} />
                      Not yet due
                    </li>
                  </ul>
                )}
              </section>
            </div>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">CRITICAL PATH</div>
                    <h2>The chain driving the finish</h2>
                  </div>

                  <span className={styles.muted}>
                    {model.chain.length} {model.chain.length === 1 ? "activity" : "activities"}
                  </span>
                </header>

                {model.chain.length === 0 ? (
                  <div className={styles.emptySmall}>No critical path has been calculated yet.</div>
                ) : (
                  <ol className={styles.chain}>
                    {model.chain.slice(0, CHAIN_LIMIT).map((item) => (
                      <li key={item.id}>
                        <span
                          className={cx(
                            styles.chainChip,
                            item.status === "COMPLETED" && styles.chainDone,
                            item.status === "IN_PROGRESS" && styles.chainActive,
                            item.overdue && styles.chainLate,
                          )}
                          title={`${item.name} · ${STATUS_LABEL[item.status]} · ${num(item.progressPercentage)}%`}
                        >
                          <strong>{item.activityCode}</strong>
                          <small>{item.name}</small>
                        </span>
                      </li>
                    ))}
                    {model.chain.length > CHAIN_LIMIT && (
                      <li className={styles.chainMore}>+{model.chain.length - CHAIN_LIMIT} more</li>
                    )}
                  </ol>
                )}

                {model.chain.length > 0 && (
                  <ul aria-label="Chain legend" className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchDone)} />
                      Completed
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchActive)} />
                      In progress
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchLate)} />
                      Overdue
                    </li>
                  </ul>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BASELINE</div>
                    <h2>Finish date against the plan</h2>
                  </div>

                  <span className={styles.muted}>
                    {intel.activityCount} {intel.activityCount === 1 ? "activity" : "activities"}
                  </span>
                </header>

                <dl className={styles.facts}>
                  <div>
                    <dt>Approved baseline</dt>
                    <dd>{intel.approvedBaselineName ?? "None"}</dd>
                  </div>
                  <div>
                    <dt>Baseline finish</dt>
                    <dd>{Number.isFinite(baselineDay) ? formatDay(baselineDay) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Forecast finish (critical path)</dt>
                    <dd>{Number.isFinite(cpmDay) ? formatDay(cpmDay) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Forecast against baseline</dt>
                    <dd className={intel.baselineFinishVarianceDays > 0 ? styles.neg : styles.pos}>
                      {signed(intel.baselineFinishVarianceDays)} d
                    </dd>
                  </div>
                  <div>
                    <dt>Forecast against project end date</dt>
                    <dd className={intel.projectFinishVarianceDays > 0 ? styles.neg : styles.pos}>
                      {signed(intel.projectFinishVarianceDays)} d
                    </dd>
                  </div>
                  <div>
                    <dt>Data date</dt>
                    <dd>{formatDay(model.anchor)}</dd>
                  </div>
                </dl>

                <p className={styles.hint}>A positive number means later than the date it is compared with.</p>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">OPEN CONSTRAINTS</div>
                  <h2>Most overdue first</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>
                    {model.open.length} open · {model.open.filter((row) => row.lateDays > 0).length}{" "}
                    overdue
                  </span>

                  {model.open.length > LIST_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllConstraints((value) => !value)}
                      type="button"
                    >
                      {showAllConstraints ? `Show first ${LIST_LIMIT}` : `Show all ${model.open.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.open.length === 0 ? (
                <div className={styles.emptySmall}>No open constraints. Nothing is blocking the programme.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ACTIVITY</th>
                        <th>TYPE</th>
                        <th>CONSTRAINT</th>
                        <th>OWNER</th>
                        <th>DUE</th>
                        <th className={styles.num}>LATE</th>
                        <th>PATH</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleConstraints.map((row) => (
                        <tr key={row.constraint.id}>
                          <td>
                            <strong>{row.constraint.activityCode}</strong>
                          </td>
                          <td>{CONSTRAINT_LABEL[row.constraint.constraintType]}</td>
                          <td className={styles.wrap}>{row.constraint.title}</td>
                          <td>{row.constraint.ownerName ?? "Unassigned"}</td>
                          <td>{formatDay(row.dueDay)}</td>
                          <td className={cx(styles.num, row.lateDays > 0 && styles.neg)}>
                            {row.lateDays > 0 ? `${row.lateDays} d` : "—"}
                          </td>
                          <td>{row.critical ? <em className={styles.late}>CRITICAL</em> : "—"}</td>
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
