"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProduction } from "@/lib/api";
import type {
  ProductionControl,
  ProductionRiskLevel,
  SiteReport,
  SiteReportStatus,
  WeatherCondition,
  WorkPackage,
} from "@/types/project";

import styles from "./ProjectProductionBoardView.module.css";

const DAY_MS = 86_400_000;
const WEEK_WINDOW = 12;
const CALENDAR_WEEKS = 10;
const LIST_LIMIT = 8;
const BEHIND_WATCH = 2;
const BEHIND_BAD = 10;
const LABEL_LIMIT = 3;

const RISK_LABEL: Record<ProductionRiskLevel, string> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<ProductionRiskLevel, string | undefined> = {
  NO_DATA: styles.riskNone,
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const WEATHER_LABEL: Record<WeatherCondition, string> = {
  CLEAR: "Clear",
  CLOUDY: "Cloudy",
  RAIN: "Rain",
  WIND: "Wind",
  EXTREME_HEAT: "Extreme heat",
  EXTREME_COLD: "Extreme cold",
  OTHER: "Other",
};

const STATUS_LABEL: Record<SiteReportStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
};

const STATUS_COLOR: Record<SiteReportStatus, string> = {
  DRAFT: "#dcb85e",
  SUBMITTED: "#7ab397",
  APPROVED: "#2f6f55",
};

const STATUS_RANK: Record<SiteReportStatus, number> = { DRAFT: 0, SUBMITTED: 1, APPROVED: 2 };

const PACKAGE_STATUS_LABEL: Record<WorkPackage["status"], string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const TONE = {
  good: "#3f8a68",
  watch: "#d1a13a",
  bad: "#b5493e",
} as const;

const SERIES_COLOR = { labour: "#2f6f55", equipment: "#b9d6c8" } as const;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Tone = keyof typeof TONE;

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

function weekStart(day: number): number {
  return day - ((day + 3) % 7);
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function axisStep(max: number): number {
  const rough = Math.max(max, 1) / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const fraction = rough / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;

  return Math.max(1, nice * magnitude);
}

function behindTone(behind: number): Tone {
  if (behind >= BEHIND_BAD) {
    return "bad";
  }

  return behind >= BEHIND_WATCH ? "watch" : "good";
}

function indexTone(index: number): Tone {
  if (index >= 1) {
    return "good";
  }

  return index >= 0.85 ? "watch" : "bad";
}

const CHIP_CLASS: Record<Tone, string | undefined> = {
  good: styles.chipGood,
  watch: styles.chipWatch,
  bad: styles.chipBad,
};

interface PackageRow {
  pkg: WorkPackage;
  actual: number;
  expected: number;
  behind: number;
  tone: Tone;
}

export function ProjectProductionBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ProductionControl | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectProduction(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load production data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const packages = (data?.workPackages ?? []).filter((item) => item.status !== "CANCELLED");
    const reports = data?.siteReports ?? [];
    const entries = data?.productionEntries ?? [];

    const rows: PackageRow[] = packages
      .filter((item) => item.status !== "PLANNED" || item.completionPercentage > 0)
      .map((pkg) => {
        const actual = clamp(pkg.completionPercentage, 0, 100);
        const expected = clamp(pkg.expectedProgressPercentage, 0, 100);
        const behind = expected - actual;

        return { pkg, actual, expected, behind, tone: behindTone(behind) };
      });

    const live = rows
      .filter((row) => row.pkg.status === "IN_PROGRESS" || row.pkg.status === "BLOCKED")
      .sort((a, b) => b.behind - a.behind);

    const labelled = new Set(
      [...live]
        .filter((row) => row.behind >= BEHIND_WATCH)
        .slice(0, LABEL_LIMIT)
        .map((row) => row.pkg.id),
    );

    const blocked = packages.filter((item) => item.status === "BLOCKED");

    const thisWeek = weekStart(today);
    const weeks: Array<{ start: number; labour: number; equipment: number; entries: number }> = [];

    for (let offset = WEEK_WINDOW - 1; offset >= 0; offset -= 1) {
      weeks.push({ start: thisWeek - offset * 7, labour: 0, equipment: 0, entries: 0 });
    }

    for (const entry of entries) {
      const start = weekStart(toDay(entry.reportDate));
      const week = weeks.find((item) => item.start === start);

      if (week) {
        week.labour += entry.laborHours;
        week.equipment += entry.equipmentHours;
        week.entries += 1;
      }
    }

    const byDay = new Map<number, SiteReport>();

    for (const report of reports) {
      const day = toDay(report.reportDate);
      const current = byDay.get(day);

      if (!current || STATUS_RANK[report.status] > STATUS_RANK[current.status]) {
        byDay.set(day, report);
      }
    }

    const calendarStart = thisWeek - (CALENDAR_WEEKS - 1) * 7;
    const calendar: Array<{ start: number; days: Array<{ day: number; report: SiteReport | null }> }> = [];
    let gaps = 0;

    for (let week = 0; week < CALENDAR_WEEKS; week += 1) {
      const start = calendarStart + week * 7;
      const days: Array<{ day: number; report: SiteReport | null }> = [];

      for (let offset = 0; offset < 7; offset += 1) {
        const day = start + offset;
        const report = byDay.get(day) ?? null;

        days.push({ day, report });

        if (!report && offset < 6 && day <= today && today - day < 28) {
          gaps += 1;
        }
      }

      calendar.push({ start, days });
    }

    const weather = new Map<WeatherCondition, { reports: number; labour: number }>();

    for (const report of reports) {
      if (report.totalLaborHours <= 0) {
        continue;
      }

      const entry = weather.get(report.weatherCondition) ?? { reports: 0, labour: 0 };
      entry.reports += 1;
      entry.labour += report.totalLaborHours;
      weather.set(report.weatherCondition, entry);
    }

    const weatherRows = [...weather.entries()]
      .map(([condition, value]) => ({
        condition,
        reports: value.reports,
        average: value.labour / value.reports,
      }))
      .sort((a, b) => b.reports - a.reports);

    const clear = weatherRows.find((row) => row.condition === "CLEAR");

    return {
      rows,
      live,
      labelled,
      blocked,
      weeks,
      weekMax: Math.max(0, ...weeks.flatMap((week) => [week.labour, week.equipment])),
      calendar,
      gaps,
      weatherRows,
      weatherMax: Math.max(0, ...weatherRows.map((row) => row.average)),
      clearAverage: clear ? clear.average : null,
    };
  }, [data, today]);

  const intel = data?.intelligence;
  const visible = showAll ? model.live : model.live.slice(0, LIST_LIMIT);

  const scatter = { left: 46, right: 14, top: 14, bottom: 44, width: 540, height: 440 };
  const sx = (value: number) =>
    scatter.left + (value / 100) * (scatter.width - scatter.left - scatter.right);
  const sy = (value: number) =>
    scatter.height - scatter.bottom - (value / 100) * (scatter.height - scatter.top - scatter.bottom);

  const hours = { left: 52, right: 12, top: 14, bottom: 30, width: 800, height: 250 };
  const weekStep = axisStep(model.weekMax);
  const weekTop = weekStep * 4;
  const plotW = hours.width - hours.left - hours.right;
  const plotH = hours.height - hours.top - hours.bottom;
  const slot = plotW / WEEK_WINDOW;
  const barW = Math.min(20, slot * 0.34);

  const daysSinceReport =
    intel && intel.latestAcceptedReportDate
      ? Math.max(0, today - toDay(intel.latestAcceptedReportDate))
      : null;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">PRODUCTION BOARD</div>

            <h1>{data ? data.project.name : "Production board"}</h1>

            <p className={styles.subtitle}>
              Planned against actual progress for every work package, weekly labour and equipment
              hours, and how consistently site reports are filed. Record packages and site reports
              in production control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/production`}>
            Open production control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading production data…</div>}

        {data && intel && (
          <>
            <section aria-label="Production summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>PRODUCTION SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.productionScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.productionRisk])}>
                    {RISK_LABEL[intel.productionRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PROGRESS VS PLAN</div>
                <div
                  className={cx(
                    styles.kpiValue,
                    intel.productionVariancePoints <= -BEHIND_BAD && styles.neg,
                  )}
                >
                  {num(intel.averagePackageCompletionPercentage)}%
                </div>
                <div className={styles.kpiSub}>
                  {num(intel.averageExpectedProgressPercentage)}% planned ·{" "}
                  {signed(intel.productionVariancePoints, 1)} pts
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PRODUCTIVITY INDEX</div>
                <div
                  className={cx(
                    styles.kpiValue,
                    intel.overallProductivityIndex < 0.85 && styles.neg,
                  )}
                >
                  {num(intel.overallProductivityIndex, 2)}
                </div>
                <div className={styles.kpiSub}>1.00 means output matches plan</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WEEKLY TREND</div>
                <div
                  className={cx(
                    styles.kpiValue,
                    intel.weeklyProductionTrendPercentage < 0 ? styles.neg : styles.pos,
                  )}
                >
                  {signed(intel.weeklyProductionTrendPercentage, 1)}%
                </div>
                <div className={styles.kpiSub}>output against the previous week</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>BLOCKED PACKAGES</div>
                <div className={cx(styles.kpiValue, intel.blockedPackages > 0 && styles.neg)}>
                  {intel.blockedPackages}
                </div>
                <div className={styles.kpiSub}>
                  {intel.activePackages} active · {intel.completedPackages} completed
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LAST SITE REPORT</div>
                <div className={cx(styles.kpiValue, styles.kpiText, intel.reportingStale && styles.neg)}>
                  {daysSinceReport === null
                    ? "None"
                    : daysSinceReport === 0
                      ? "Today"
                      : `${daysSinceReport} d ago`}
                </div>
                <div className={styles.kpiSub}>
                  {intel.reportingStale ? "Reporting is stale · " : ""}
                  {intel.approvedSiteReports} of {intel.totalSiteReports} approved
                </div>
              </article>
            </section>

            <div className={styles.radarGrid}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">PLAN VS ACTUAL</div>
                    <h2>Every package against the diagonal</h2>
                  </div>

                  <span className={styles.muted}>{model.rows.length} packages</span>
                </header>

                {model.rows.length === 0 ? (
                  <div className={styles.emptySmall}>No work packages have started yet.</div>
                ) : (
                  <svg
                    aria-label={`Scatter of planned against actual progress for ${model.rows.length} work packages`}
                    className={styles.scatter}
                    role="img"
                    viewBox={`0 0 ${scatter.width} ${scatter.height}`}
                  >
                    <polygon
                      fill="rgba(181, 73, 62, 0.07)"
                      points={`${sx(0)},${sy(0)} ${sx(100)},${sy(0)} ${sx(100)},${sy(100)}`}
                    />

                    {[0, 25, 50, 75, 100].map((tick) => (
                      <g key={tick}>
                        <line
                          stroke="#e8ebe7"
                          x1={sx(0)}
                          x2={sx(100)}
                          y1={sy(tick)}
                          y2={sy(tick)}
                        />
                        <line
                          stroke="#e8ebe7"
                          x1={sx(tick)}
                          x2={sx(tick)}
                          y1={sy(0)}
                          y2={sy(100)}
                        />
                        <text className={styles.tick} textAnchor="end" x={sx(0) - 6} y={sy(tick) + 3}>
                          {tick}
                        </text>
                        <text className={styles.tick} textAnchor="middle" x={sx(tick)} y={sy(0) + 16}>
                          {tick}
                        </text>
                      </g>
                    ))}

                    <line
                      stroke="#8a948f"
                      strokeDasharray="5 5"
                      strokeWidth="1.4"
                      x1={sx(0)}
                      x2={sx(100)}
                      y1={sy(0)}
                      y2={sy(100)}
                    />

                    <text className={styles.axisTitle} textAnchor="middle" x={sx(50)} y={scatter.height - 8}>
                      Planned progress %
                    </text>
                    <text
                      className={styles.axisTitle}
                      textAnchor="middle"
                      transform={`rotate(-90 12 ${sy(50)})`}
                      x={12}
                      y={sy(50)}
                    >
                      Actual progress %
                    </text>

                    <text className={styles.zoneLabel} textAnchor="end" x={sx(98)} y={sy(8)}>
                      Behind plan
                    </text>
                    <text className={styles.zoneLabel} textAnchor="start" x={sx(2)} y={sy(95)}>
                      Ahead of plan
                    </text>

                    {model.rows.map((row) => (
                      <g key={row.pkg.id}>
                        <circle
                          cx={sx(row.expected)}
                          cy={sy(row.actual)}
                          fill={TONE[row.tone]}
                          fillOpacity={row.pkg.status === "COMPLETED" ? 0.45 : 0.9}
                          r={7}
                          stroke={row.pkg.status === "BLOCKED" ? "#19201e" : "#ffffff"}
                          strokeDasharray={row.pkg.status === "BLOCKED" ? "2 2" : undefined}
                          strokeWidth={row.pkg.status === "BLOCKED" ? 2 : 1.6}
                        >
                          <title>
                            {`${row.pkg.code} ${row.pkg.name}: ${num(row.actual)}% actual, ${num(row.expected)}% planned (${PACKAGE_STATUS_LABEL[row.pkg.status]})`}
                          </title>
                        </circle>

                        {model.labelled.has(row.pkg.id) && (
                          <text
                            className={styles.pointLabel}
                            textAnchor={row.expected > 80 ? "end" : "start"}
                            x={sx(row.expected) + (row.expected > 80 ? -11 : 11)}
                            y={sy(row.actual) + 4}
                          >
                            {row.pkg.code}
                          </text>
                        )}
                      </g>
                    ))}
                  </svg>
                )}

                <ul aria-label="Colour legend" className={styles.legend}>
                  <li>
                    <i className={styles.dot} style={{ background: TONE.good }} />
                    On or ahead of plan
                  </li>
                  <li>
                    <i className={styles.dot} style={{ background: TONE.watch }} />
                    {BEHIND_WATCH}–{BEHIND_BAD} pts behind
                  </li>
                  <li>
                    <i className={styles.dot} style={{ background: TONE.bad }} />
                    {BEHIND_BAD}+ pts behind
                  </li>
                  <li>
                    <i className={cx(styles.dot, styles.dotBlocked)} />
                    Blocked
                  </li>
                </ul>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">FURTHEST BEHIND</div>
                    <h2>Active packages by shortfall</h2>
                  </div>

                  <div className={styles.controls}>
                    <span className={styles.muted}>{model.live.length} active</span>

                    {model.live.length > LIST_LIMIT && (
                      <button
                        className={styles.linkButton}
                        onClick={() => setShowAll((value) => !value)}
                        type="button"
                      >
                        {showAll ? `Show first ${LIST_LIMIT}` : `Show all ${model.live.length}`}
                      </button>
                    )}
                  </div>
                </header>

                {model.live.length === 0 ? (
                  <div className={styles.emptySmall}>No packages are in progress.</div>
                ) : (
                  <ul className={styles.rankList}>
                    {visible.map((row) => {
                      const pi = row.pkg.productivityIndex;

                      return (
                        <li className={styles.rank} key={row.pkg.id}>
                          <div className={styles.rankTop}>
                            <span className={styles.rankName}>
                              <strong>{row.pkg.code}</strong> {row.pkg.name}
                            </span>

                            {row.pkg.status === "BLOCKED" && <em className={styles.late}>BLOCKED</em>}

                            <span className={cx(styles.chip, CHIP_CLASS[indexTone(pi)])}>
                              PI {num(pi, 2)}
                            </span>
                          </div>

                          <div
                            aria-label={`${row.pkg.code}: ${num(row.actual)}% actual against ${num(row.expected)}% planned`}
                            className={styles.progress}
                            role="img"
                          >
                            <div
                              className={styles.progressFill}
                              style={{ background: TONE[row.tone], width: `${row.actual}%` }}
                            />
                            <i className={styles.planMark} style={{ left: `${row.expected}%` }} />
                          </div>

                          <div className={styles.rankMeta}>
                            <span>
                              {num(row.actual)}% done · {num(row.expected)}% planned
                            </span>
                            <span className={row.behind >= BEHIND_WATCH ? styles.neg : styles.pos}>
                              {row.behind >= BEHIND_WATCH
                                ? `${num(row.behind, 1)} pts behind`
                                : row.behind > -BEHIND_WATCH
                                  ? "On plan"
                                  : `${num(-row.behind, 1)} pts ahead`}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <p className={styles.hint}>
                  The tick on each bar marks where the package should be today. PI is the
                  productivity index; below 0.85 means output is well under the planned rate.
                </p>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WEEKLY EFFORT</div>
                  <h2>Labour and equipment hours per week</h2>
                </div>

                <span className={styles.muted}>
                  {num(intel.totalLaborHours)} labour h · {num(intel.totalEquipmentHours)} equipment h
                </span>
              </header>

              {model.weekMax === 0 ? (
                <div className={styles.emptySmall}>
                  No production entries in the last {WEEK_WINDOW} weeks.
                </div>
              ) : (
                <div className={styles.chartScroll}>
                  <svg
                    aria-label={`Labour and equipment hours per week for the last ${WEEK_WINDOW} weeks`}
                    className={styles.chart}
                    role="img"
                    viewBox={`0 0 ${hours.width} ${hours.height}`}
                  >
                    {[0, 1, 2, 3, 4].map((step) => {
                      const value = weekStep * step;
                      const y = hours.top + plotH - (value / weekTop) * plotH;

                      return (
                        <g key={step}>
                          <line
                            stroke="#e8ebe7"
                            x1={hours.left}
                            x2={hours.width - hours.right}
                            y1={y}
                            y2={y}
                          />
                          <text fill="#7a847f" fontSize="11" textAnchor="end" x={hours.left - 6} y={y + 3}>
                            {num(value)}
                          </text>
                        </g>
                      );
                    })}

                    {model.weeks.map((week, index) => {
                      const groupX = hours.left + slot * index + (slot - barW * 2 - 3) / 2;
                      const bars = [
                        { key: "labour", label: "labour hours", value: week.labour, color: SERIES_COLOR.labour },
                        { key: "equipment", label: "equipment hours", value: week.equipment, color: SERIES_COLOR.equipment },
                      ];

                      return (
                        <g key={week.start}>
                          {bars.map((bar, barIndex) => {
                            const h = (bar.value / weekTop) * plotH;

                            return (
                              <rect
                                fill={bar.color}
                                height={Math.max(h, 0)}
                                key={bar.key}
                                rx="2"
                                width={barW}
                                x={groupX + barIndex * (barW + 3)}
                                y={hours.top + plotH - h}
                              >
                                <title>{`Week of ${shortDay(week.start)}: ${num(bar.value)} ${bar.label}`}</title>
                              </rect>
                            );
                          })}

                          <text
                            fill="#66706b"
                            fontSize="11"
                            textAnchor="middle"
                            x={groupX + (barW * 2 + 3) / 2}
                            y={hours.height - 10}
                          >
                            {shortDay(week.start)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}

              <ul aria-label="Chart legend" className={styles.legend}>
                <li>
                  <i className={styles.swatch} style={{ background: SERIES_COLOR.labour }} />
                  Labour hours
                </li>
                <li>
                  <i className={styles.swatch} style={{ background: SERIES_COLOR.equipment }} />
                  Equipment hours
                </li>
              </ul>
              <p className={styles.hint}>Weeks start on Monday and are summed from production entries.</p>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">SITE REPORTING</div>
                    <h2>Last {CALENDAR_WEEKS} weeks</h2>
                  </div>

                  {data.siteReports.length > 0 && (
                    <span className={cx(styles.muted, model.gaps > 0 && styles.neg)}>
                      {model.gaps} missing day{model.gaps === 1 ? "" : "s"} in the last 28
                    </span>
                  )}
                </header>

                {data.siteReports.length === 0 ? (
                  <div className={styles.emptySmall}>No site reports filed yet.</div>
                ) : (
                  <div className={styles.calendar} role="img" aria-label="Calendar of days with and without a site report">
                    <div className={styles.calHead}>
                      <span />
                      {WEEKDAYS.map((name) => (
                        <span key={name}>{name}</span>
                      ))}
                    </div>

                    {model.calendar.map((week) => (
                      <div className={styles.calRow} key={week.start}>
                        <span className={styles.calWeek}>{shortDay(week.start)}</span>

                        {week.days.map(({ day, report }, index) => {
                          const future = day > today;
                          const label = report
                            ? `${formatDay(day)}: ${STATUS_LABEL[report.status].toLowerCase()} report ${report.reference}, ${WEATHER_LABEL[report.weatherCondition].toLowerCase()}, ${num(report.totalLaborHours)} labour hours`
                            : future
                              ? formatDay(day)
                              : `${formatDay(day)}: no report`;

                          return (
                            <i
                              className={cx(
                                styles.cell,
                                !report && !future && index < 6 && styles.cellMissing,
                                !report && !future && index === 6 && styles.cellRest,
                                future && styles.cellFuture,
                              )}
                              key={day}
                              style={report ? { background: STATUS_COLOR[report.status] } : undefined}
                              title={label}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}

                <ul aria-label="Status legend" className={styles.legend}>
                  {(["APPROVED", "SUBMITTED", "DRAFT"] as const).map((status) => (
                    <li key={status}>
                      <i className={styles.swatch} style={{ background: STATUS_COLOR[status] }} />
                      {STATUS_LABEL[status]}
                    </li>
                  ))}
                  <li>
                    <i className={cx(styles.swatch, styles.swatchMissing)} />
                    No report
                  </li>
                </ul>
                <p className={styles.hint}>
                  Sundays are not counted as missing. Weeks are listed by their Monday.
                </p>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">WEATHER</div>
                    <h2>Average labour hours per report</h2>
                  </div>

                  <span className={styles.muted}>{model.weatherRows.length} conditions</span>
                </header>

                {model.weatherRows.length === 0 ? (
                  <div className={styles.emptySmall}>No site reports with labour hours yet.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.weatherRows.map((row) => {
                      const delta =
                        model.clearAverage !== null && row.condition !== "CLEAR"
                          ? percent(row.average - model.clearAverage, model.clearAverage)
                          : null;

                      return (
                        <li key={row.condition}>
                          <div className={styles.ageingTop}>
                            <span>{WEATHER_LABEL[row.condition]}</span>
                            <strong>
                              {num(row.average)} h
                              <small>
                                {row.reports} report{row.reports === 1 ? "" : "s"}
                                {delta !== null && (
                                  <>
                                    {" · "}
                                    <span className={delta < 0 ? styles.neg : styles.pos}>
                                      {signed(delta)}% vs clear
                                    </span>
                                  </>
                                )}
                              </small>
                            </strong>
                          </div>

                          <div
                            aria-label={`${WEATHER_LABEL[row.condition]}: ${num(row.average)} labour hours per report`}
                            className={styles.track}
                            role="img"
                          >
                            <div
                              className={cx(styles.fill, styles.toneGood)}
                              style={{ width: `${percent(row.average, model.weatherMax)}%` }}
                            />
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <p className={styles.hint}>
                  Based on reports with labour hours logged. The comparison is against the average
                  for clear days.
                </p>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BLOCKED</div>
                  <h2>Packages that cannot proceed</h2>
                </div>

                <span className={styles.muted}>{model.blocked.length} blocked</span>
              </header>

              {model.blocked.length === 0 ? (
                <div className={styles.emptySmall}>No blocked packages.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>CODE</th>
                        <th>PACKAGE</th>
                        <th>REASON</th>
                        <th className={styles.num}>DONE</th>
                        <th>PLANNED END</th>
                        <th className={styles.num}>TO PLANNED END</th>
                      </tr>
                    </thead>

                    <tbody>
                      {model.blocked.map((pkg) => {
                        const endDay = toDay(pkg.plannedEndDate);
                        const left = Number.isFinite(endDay) ? endDay - today : NaN;

                        return (
                          <tr key={pkg.id}>
                            <td>
                              <strong>{pkg.code}</strong>
                            </td>
                            <td className={styles.wrap}>{pkg.name}</td>
                            <td className={styles.wrap}>{pkg.blockReason ?? "No reason recorded"}</td>
                            <td className={styles.num}>{num(pkg.completionPercentage)}%</td>
                            <td>{formatDay(endDay)}</td>
                            <td className={cx(styles.num, left < 0 && styles.neg)}>
                              {Number.isFinite(left)
                                ? left < 0
                                  ? `${-left} d past`
                                  : `${left} d left`
                                : "—"}
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
