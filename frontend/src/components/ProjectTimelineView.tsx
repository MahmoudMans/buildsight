"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import type {
  ScheduleActivity,
  ScheduleControl,
  ScheduleRiskLevel,
} from "@/types/project";

import styles from "./ProjectTimelineView.module.css";

const DAY_MS = 86_400_000;
const ROW_HEIGHT = 38;
const HEADER_HEIGHT = 58;
const MONTH_ROW_HEIGHT = 26;
const LABEL_WIDTH = 320;

type Filter = "ALL" | "CRITICAL" | "ACTIVE" | "OVERDUE" | "CONSTRAINED";
type Zoom = "compact" | "normal" | "detailed";
type MarkerTone = "data" | "baseline" | "forecast";

const ZOOM_WIDTH: Record<Zoom, number> = {
  compact: 4,
  normal: 8,
  detailed: 16,
};

const ZOOM_LABEL: Record<Zoom, string> = {
  compact: "Compact",
  normal: "Normal",
  detailed: "Detailed",
};

const FILTERS: ReadonlyArray<readonly [Filter, string]> = [
  ["ALL", "All"],
  ["CRITICAL", "Critical"],
  ["ACTIVE", "In progress"],
  ["OVERDUE", "Overdue"],
  ["CONSTRAINED", "Constrained"],
];

const RISK_LABEL: Record<ScheduleRiskLevel, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<ScheduleRiskLevel, string> = {
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const LINE_CLASS: Record<MarkerTone, string> = {
  data: styles.lineData,
  baseline: styles.lineBaseline,
  forecast: styles.lineForecast,
};

const TAG_CLASS: Record<MarkerTone, string> = {
  data: styles.tagData,
  baseline: styles.tagBaseline,
  forecast: styles.tagForecast,
};

interface MonthSegment {
  key: string;
  label: string;
  left: number;
  width: number;
}

interface Marker {
  key: string;
  label: string;
  title: string;
  x: number;
  tone: MarkerTone;
}

interface DependencyLink {
  id: string;
  path: string;
  critical: boolean;
}

function dayNumber(value: string): number {
  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(
    Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS,
  );
}

function dayToDate(day: number): Date {
  return new Date(day * DAY_MS);
}

function formatDay(day: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(dayToDate(day));
}

function formatIso(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const day = dayNumber(value);

  return Number.isFinite(day) ? formatDay(day) : "—";
}

function describeDelta(delta: number | null): string {
  if (delta === null) {
    return "—";
  }

  if (delta === 0) {
    return "On baseline";
  }

  return delta > 0 ? `${delta} d late` : `${Math.abs(delta)} d early`;
}

function buildMonths(
  minDay: number,
  maxDay: number,
  dayWidth: number,
): MonthSegment[] {
  const segments: MonthSegment[] = [];
  const first = dayToDate(minDay);
  let year = first.getUTCFullYear();
  let month = first.getUTCMonth();

  for (let guard = 0; guard < 600; guard += 1) {
    const monthStart = Math.floor(Date.UTC(year, month, 1) / DAY_MS);
    const nextStart = Math.floor(Date.UTC(year, month + 1, 1) / DAY_MS);

    if (monthStart > maxDay) {
      break;
    }

    const from = Math.max(monthStart, minDay);
    const to = Math.min(nextStart, maxDay + 1);

    segments.push({
      key: `${year}-${month}`,
      label: new Intl.DateTimeFormat("en-GB", {
        month: "short",
        year: "2-digit",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(year, month, 1))),
      left: (from - minDay) * dayWidth,
      width: (to - from) * dayWidth,
    });

    month += 1;

    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return segments;
}

function barTone(activity: ScheduleActivity): string {
  if (activity.status === "COMPLETED") {
    return styles.barDone;
  }

  if (activity.critical) {
    return styles.barCritical;
  }

  if (activity.nearCritical) {
    return styles.barNear;
  }

  return styles.barNormal;
}

export function ProjectTimelineView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [zoom, setZoom] = useState<Zoom>("normal");
  const [query, setQuery] = useState("");
  const [showDependencies, setShowDependencies] = useState(true);

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
            setError(
              "Could not load the schedule. Check that the backend is running.",
            );
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const dayWidth = ZOOM_WIDTH[zoom];

  const activities = useMemo(
    () =>
      [...(data?.activities ?? [])].sort(
        (a, b) =>
          a.currentStart.localeCompare(b.currentStart) ||
          a.activityCode.localeCompare(b.activityCode),
      ),
    [data],
  );

  const openConstraints = useMemo(() => {
    const map = new Map<string, number>();

    for (const constraint of data?.constraints ?? []) {
      if (constraint.status === "OPEN") {
        map.set(
          constraint.activityId,
          (map.get(constraint.activityId) ?? 0) + 1,
        );
      }
    }

    return map;
  }, [data]);

  const counts = useMemo(
    () => ({
      ALL: activities.length,
      CRITICAL: activities.filter((a) => a.critical).length,
      ACTIVE: activities.filter((a) => a.status === "IN_PROGRESS").length,
      OVERDUE: activities.filter((a) => a.overdue).length,
      CONSTRAINED: activities.filter((a) => openConstraints.has(a.id)).length,
    }),
    [activities, openConstraints],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    return activities.filter((activity) => {
      if (filter === "CRITICAL" && !activity.critical) {
        return false;
      }

      if (filter === "ACTIVE" && activity.status !== "IN_PROGRESS") {
        return false;
      }

      if (filter === "OVERDUE" && !activity.overdue) {
        return false;
      }

      if (filter === "CONSTRAINED" && !openConstraints.has(activity.id)) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return `${activity.activityCode} ${activity.name} ${
        activity.discipline ?? ""
      }`
        .toLowerCase()
        .includes(needle);
    });
  }, [activities, filter, query, openConstraints]);

  const range = useMemo(() => {
    const days: number[] = [];

    for (const activity of activities) {
      days.push(
        dayNumber(activity.currentStart),
        dayNumber(activity.currentFinish),
      );
    }

    const intel = data?.intelligence;

    for (const value of [
      intel?.dataDate,
      intel?.baselineFinishDate,
      intel?.cpmForecastFinishDate,
    ]) {
      if (value) {
        days.push(dayNumber(value));
      }
    }

    const finite = days.filter(Number.isFinite);

    if (finite.length === 0) {
      return null;
    }

    return {
      min: Math.min(...finite) - 7,
      max: Math.max(...finite) + 14,
    };
  }, [activities, data]);

  const totalWidth = range ? (range.max - range.min + 1) * dayWidth : 0;

  const months = useMemo(
    () => (range ? buildMonths(range.min, range.max, dayWidth) : []),
    [range, dayWidth],
  );

  const markers = useMemo(() => {
    const result: Marker[] = [];

    if (!range || !data) {
      return result;
    }

    const intel = data.intelligence;

    const entries: ReadonlyArray<
      readonly [MarkerTone, string, string | null | undefined]
    > = [
      ["data", "Data date", intel.dataDate],
      ["baseline", "Baseline finish", intel.baselineFinishDate],
      ["forecast", "Forecast finish", intel.cpmForecastFinishDate],
    ];

    for (const [tone, label, value] of entries) {
      if (!value) {
        continue;
      }

      const day = dayNumber(value);

      if (!Number.isFinite(day)) {
        continue;
      }

      result.push({
        key: tone,
        label,
        title: `${label}: ${formatDay(day)}`,
        x: (day - range.min) * dayWidth,
        tone,
      });
    }

    return result;
  }, [range, data, dayWidth]);

  const links = useMemo(() => {
    const result: DependencyLink[] = [];

    if (!range || !data || !showDependencies) {
      return result;
    }

    const byId = new Map(activities.map((a) => [a.id, a] as const));
    const rows = new Map(visible.map((a, index) => [a.id, index] as const));

    for (const dependency of data.dependencies) {
      const from = byId.get(dependency.predecessorActivityId);
      const to = byId.get(dependency.successorActivityId);
      const fromRow = rows.get(dependency.predecessorActivityId);
      const toRow = rows.get(dependency.successorActivityId);

      if (
        !from ||
        !to ||
        fromRow === undefined ||
        toRow === undefined
      ) {
        continue;
      }

      const type = dependency.dependencyType;
      const leavesFromStart = type === "SS" || type === "SF";
      const entersAtFinish = type === "FF" || type === "SF";

      const x1 =
        ((leavesFromStart
          ? dayNumber(from.currentStart)
          : dayNumber(from.currentFinish) + 1) -
          range.min) *
        dayWidth;

      const x2 =
        ((entersAtFinish
          ? dayNumber(to.currentFinish) + 1
          : dayNumber(to.currentStart)) -
          range.min) *
        dayWidth;

      const y1 = fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
      const y2 = toRow * ROW_HEIGHT + ROW_HEIGHT / 2;

      if (![x1, x2, y1, y2].every(Number.isFinite)) {
        continue;
      }

      result.push({
        id: dependency.id,
        path: `M ${x1} ${y1} H ${x1 + 6} V ${y2} H ${x2}`,
        critical: from.critical && to.critical,
      });
    }

    return result;
  }, [range, data, showDependencies, activities, visible, dayWidth]);

  const finishDelta = useMemo(() => {
    const intel = data?.intelligence;

    if (!intel?.cpmForecastFinishDate || !intel.baselineFinishDate) {
      return null;
    }

    const delta =
      dayNumber(intel.cpmForecastFinishDate) -
      dayNumber(intel.baselineFinishDate);

    return Number.isFinite(delta) ? delta : null;
  }, [data]);

  const intel = data?.intelligence;
  const bodyHeight = visible.length * ROW_HEIGHT;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">SCHEDULE TIMELINE</div>

            <h1>{data ? data.project.name : "Project timeline"}</h1>

            <p className={styles.subtitle}>
              Gantt view of the current schedule with critical path,
              dependencies and open constraints. Edit activities in
              schedule control.
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

        {!data && !error && (
          <div className={styles.loading}>Loading timeline…</div>
        )}

        {data && intel && (
          <>
            <section aria-label="Schedule summary" className={styles.kpis}>
              <article className={`${styles.kpi} ${styles.kpiDark}`}>
                <div className={styles.kpiLabel}>SCHEDULE SCORE</div>
                <div className={styles.kpiValue}>
                  {Math.round(intel.scheduleScore)}
                </div>
                <div className={styles.kpiSub}>
                  <span
                    className={`${styles.pill} ${
                      RISK_CLASS[intel.scheduleRisk]
                    }`}
                  >
                    {RISK_LABEL[intel.scheduleRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST FINISH</div>
                <div className={styles.kpiValue}>
                  {formatIso(intel.cpmForecastFinishDate)}
                </div>
                <div className={styles.kpiSub}>
                  {intel.baselineFinishDate
                    ? `Baseline ${formatIso(intel.baselineFinishDate)}`
                    : "No approved baseline"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FINISH VS BASELINE</div>
                <div
                  className={`${styles.kpiValue} ${
                    finishDelta !== null && finishDelta > 0
                      ? styles.bad
                      : finishDelta !== null && finishDelta < 0
                        ? styles.good
                        : ""
                  }`}
                >
                  {describeDelta(finishDelta)}
                </div>
                <div className={styles.kpiSub}>
                  {intel.approvedBaselineName ?? "Forecast vs approved plan"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CRITICAL PATH</div>
                <div className={styles.kpiValue}>
                  {intel.criticalPathLengthDays} d
                </div>
                <div className={styles.kpiSub}>
                  {intel.criticalActivities} critical ·{" "}
                  {intel.nearCriticalActivities} near-critical
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PRESSURE</div>
                <div className={styles.kpiValue}>
                  {intel.overdueActivities} overdue
                </div>
                <div className={styles.kpiSub}>
                  {intel.openConstraints} open constraints
                </div>
              </article>
            </section>

            {!intel.networkValid && (
              <div className={styles.banner}>
                <strong>Schedule network needs attention</strong>
                <span>
                  {intel.networkError ??
                    "The dependency network could not be calculated."}
                </span>
              </div>
            )}

            <section className={styles.panel}>
              <div className={styles.toolbar}>
                <div className={styles.chips} role="group" aria-label="Filter">
                  {FILTERS.map(([value, label]) => (
                    <button
                      aria-pressed={filter === value}
                      className={`${styles.chip} ${
                        filter === value ? styles.chipActive : ""
                      }`}
                      key={value}
                      onClick={() => setFilter(value)}
                      type="button"
                    >
                      {label}
                      <span>{counts[value]}</span>
                    </button>
                  ))}
                </div>

                <input
                  aria-label="Search activities"
                  className={styles.search}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search activities…"
                  type="search"
                  value={query}
                />

                <div className={styles.zoom} role="group" aria-label="Zoom">
                  {(Object.keys(ZOOM_WIDTH) as Zoom[]).map((value) => (
                    <button
                      aria-pressed={zoom === value}
                      className={`${styles.zoomButton} ${
                        zoom === value ? styles.zoomActive : ""
                      }`}
                      key={value}
                      onClick={() => setZoom(value)}
                      type="button"
                    >
                      {ZOOM_LABEL[value]}
                    </button>
                  ))}
                </div>

                <label className={styles.check}>
                  <input
                    checked={showDependencies}
                    onChange={(event) =>
                      setShowDependencies(event.target.checked)
                    }
                    type="checkbox"
                  />
                  Dependencies
                </label>
              </div>

              <div className={styles.legend}>
                <span>
                  <i className={`${styles.swatch} ${styles.swatchCritical}`} />
                  Critical
                </span>
                <span>
                  <i className={`${styles.swatch} ${styles.swatchNear}`} />
                  Near-critical
                </span>
                <span>
                  <i className={`${styles.swatch} ${styles.swatchNormal}`} />
                  Normal
                </span>
                <span>
                  <i className={`${styles.swatch} ${styles.swatchDone}`} />
                  Completed
                </span>
                <span className={styles.legendNote}>
                  Filled portion = progress
                </span>
              </div>

              {!range || activities.length === 0 ? (
                <div className={styles.empty}>
                  No schedule activities yet. Add activities in{" "}
                  <Link href={`${base}/schedule`}>schedule control</Link> to
                  see the timeline.
                </div>
              ) : visible.length === 0 ? (
                <div className={styles.empty}>
                  No activities match the current filters.
                </div>
              ) : (
                <div className={styles.scroll}>
                  <div
                    className={styles.canvas}
                    style={{ width: LABEL_WIDTH + totalWidth }}
                  >
                    <div
                      className={styles.headerRow}
                      style={{ height: HEADER_HEIGHT }}
                    >
                      <div
                        className={styles.labelHead}
                        style={{ width: LABEL_WIDTH }}
                      >
                        ACTIVITY
                      </div>

                      <div
                        className={styles.axis}
                        style={{ height: HEADER_HEIGHT, width: totalWidth }}
                      >
                        {months.map((month) => (
                          <div
                            className={styles.month}
                            key={month.key}
                            style={{
                              height: MONTH_ROW_HEIGHT,
                              left: month.left,
                              width: month.width,
                            }}
                          >
                            {month.label}
                          </div>
                        ))}

                        {markers.map((marker) => (
                          <span
                            className={`${styles.markerTag} ${
                              TAG_CLASS[marker.tone]
                            }`}
                            key={marker.key}
                            style={{ left: marker.x + 4 }}
                            title={marker.title}
                          >
                            {marker.label}
                          </span>
                        ))}
                      </div>
                    </div>

                    {visible.map((activity) => {
                      const start = dayNumber(activity.currentStart);
                      const finish = dayNumber(activity.currentFinish);
                      const left = (start - (range?.min ?? 0)) * dayWidth;

                      const width = Math.max(
                        (finish - start + 1) * dayWidth,
                        6,
                      );

                      const pct = Math.min(
                        100,
                        Math.max(0, Number(activity.progressPercentage)),
                      );

                      const flags = openConstraints.get(activity.id) ?? 0;

                      return (
                        <div
                          className={styles.row}
                          key={activity.id}
                          style={{ height: ROW_HEIGHT }}
                        >
                          <div
                            className={styles.label}
                            style={{ width: LABEL_WIDTH }}
                          >
                            <span className={styles.code}>
                              {activity.activityCode}
                            </span>

                            <span
                              className={styles.name}
                              title={activity.name}
                            >
                              {activity.name}
                            </span>

                            {activity.overdue && (
                              <span className={styles.late}>LATE</span>
                            )}

                            {flags > 0 && (
                              <span
                                className={styles.flag}
                                title={`${flags} open constraint${
                                  flags === 1 ? "" : "s"
                                }`}
                              >
                                ⚑{flags}
                              </span>
                            )}

                            <span className={styles.pct}>
                              {Math.round(pct)}%
                            </span>
                          </div>

                          <div
                            className={styles.lane}
                            style={{
                              backgroundSize: `${dayWidth * 7}px 100%`,
                              width: totalWidth,
                            }}
                          >
                            <div
                              className={`${styles.bar} ${barTone(activity)}`}
                              style={{ left, width }}
                              title={`${activity.activityCode} · ${
                                activity.name
                              }\n${formatDay(start)} → ${formatDay(
                                finish,
                              )}\nProgress ${Math.round(pct)}% · Float ${
                                activity.totalFloatDays
                              } d${activity.critical ? " · Critical" : ""}`}
                            >
                              <div
                                className={styles.progress}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    <div
                      aria-hidden="true"
                      className={styles.overlay}
                      style={{
                        height: bodyHeight,
                        left: LABEL_WIDTH,
                        top: HEADER_HEIGHT,
                        width: totalWidth,
                      }}
                    >
                      {markers.map((marker) => (
                        <div
                          className={`${styles.line} ${
                            LINE_CLASS[marker.tone]
                          }`}
                          key={marker.key}
                          style={{ left: marker.x }}
                        />
                      ))}

                      <svg
                        className={styles.links}
                        height={bodyHeight}
                        width={totalWidth}
                      >
                        <defs>
                          <marker
                            id="bs-arrow"
                            markerHeight="6"
                            markerWidth="6"
                            orient="auto"
                            refX="5"
                            refY="3"
                          >
                            <path d="M0,0 L6,3 L0,6 z" fill="#8a948f" />
                          </marker>

                          <marker
                            id="bs-arrow-critical"
                            markerHeight="6"
                            markerWidth="6"
                            orient="auto"
                            refX="5"
                            refY="3"
                          >
                            <path d="M0,0 L6,3 L0,6 z" fill="#b5493e" />
                          </marker>
                        </defs>

                        {links.map((link) => (
                          <path
                            className={
                              link.critical ? styles.linkCritical : styles.link
                            }
                            d={link.path}
                            key={link.id}
                            markerEnd={`url(#${
                              link.critical ? "bs-arrow-critical" : "bs-arrow"
                            })`}
                          />
                        ))}
                      </svg>
                    </div>
                  </div>
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
