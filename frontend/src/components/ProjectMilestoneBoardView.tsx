"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectCommandCenter } from "@/lib/api";
import { DAY_MS, formatDay, plural, startOfToday, toDay } from "@/lib/openItems";
import type { MilestoneStatus, ProjectCommandCenter } from "@/types/project";

import styles from "./ProjectMilestoneBoardView.module.css";

type Tone = "done" | "ok" | "watch" | "late" | "blocked";
type SortKey = "date" | "slip" | "weight";

interface Row {
  id: string;
  name: string;
  status: MilestoneStatus | "PROJECT";
  planned: number;
  forecast: number;
  actual: number;
  finish: number;
  slip: number;
  weight: number;
  tone: Tone;
  overdue: boolean;
  isProject: boolean;
}

const WATCH_DAYS = 7;
const MAX_TICKS = 7;
const STEPS = [1, 2, 3, 6, 12];

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "date", label: "By date" },
  { key: "slip", label: "Biggest slip" },
  { key: "weight", label: "Weight" },
];

const TONE_CLASS: Record<Tone, string | undefined> = {
  done: styles.toneDone,
  ok: styles.toneOk,
  watch: styles.toneWatch,
  late: styles.toneLate,
  blocked: styles.toneBlocked,
};

const TONE_LABEL: Record<Tone, string> = {
  done: "Done",
  ok: "On plan",
  watch: "Slipping",
  late: "Late",
  blocked: "Blocked",
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function signed(value: number): string {
  if (value === 0) {
    return "0";
  }

  return value > 0 ? `+${value}` : `−${Math.abs(value)}`;
}

function slipText(row: Row): string {
  if (!Number.isFinite(row.slip)) {
    return "—";
  }

  const days = Math.abs(row.slip);
  const unit = plural(days, "day", "days");

  if (row.status === "COMPLETED") {
    return row.slip === 0 ? "Done on plan" : row.slip > 0 ? `Done ${days} ${unit} late` : `Done ${days} ${unit} early`;
  }

  return row.slip === 0 ? "On plan" : row.slip > 0 ? `${days} ${unit} behind` : `${days} ${unit} ahead`;
}

function slipShort(row: Row): string {
  if (!Number.isFinite(row.slip)) {
    return "—";
  }

  return row.slip === 0 ? "On plan" : `${signed(row.slip)} d`;
}

function toneOf(status: Row["status"], slip: number, overdue: boolean): Tone {
  if (status === "COMPLETED") {
    return "done";
  }

  if (status === "BLOCKED") {
    return "blocked";
  }

  if (overdue || slip > WATCH_DAYS) {
    return "late";
  }

  return slip > 0 ? "watch" : "ok";
}

function monthStart(day: number): number {
  const date = new Date(day * DAY_MS);

  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / DAY_MS);
}

function addMonths(day: number, count: number): number {
  const date = new Date(day * DAY_MS);

  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1) / DAY_MS);
}

function tickLabel(day: number, withYear: boolean): string {
  const date = new Date(day * DAY_MS);
  const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);

  return withYear ? `${month} \u2019${String(date.getUTCFullYear()).slice(2)}` : month;
}

export function ProjectMilestoneBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [center, setCenter] = useState<ProjectCommandCenter | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [sort, setSort] = useState<SortKey>("date");

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectCommandCenter(projectId)
      .then((result) => {
        if (!cancelled) {
          setCenter(result);
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState("failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const project = center?.project ?? null;

  const rows = useMemo<Row[]>(() => {
    const list: Row[] = [];

    for (const item of center?.milestones ?? []) {
      const planned = toDay(item.plannedDate);
      const forecast = toDay(item.forecastDate);
      const actual = toDay(item.actualDate);
      const done = item.status === "COMPLETED";
      const finish = done ? (Number.isFinite(actual) ? actual : Number.isFinite(forecast) ? forecast : planned) : Number.isFinite(forecast) ? forecast : planned;
      const slip = Number.isFinite(finish) && Number.isFinite(planned) ? finish - planned : NaN;
      const overdue = !done && Number.isFinite(finish) && finish < today;

      list.push({
        id: item.id,
        name: item.name,
        status: item.status,
        planned,
        forecast,
        actual: done ? actual : NaN,
        finish,
        slip,
        weight: item.weightPercentage,
        tone: toneOf(item.status, slip, overdue),
        overdue,
        isProject: false,
      });
    }

    return list.sort((a, b) => a.planned - b.planned || a.name.localeCompare(b.name));
  }, [center, today]);

  const finishRow = useMemo<Row | null>(() => {
    if (!project) {
      return null;
    }

    const planned = toDay(project.plannedEndDate);
    const forecast = toDay(project.forecastEndDate);
    const actual = toDay(project.actualEndDate);
    const done = project.status === "COMPLETED" && Number.isFinite(actual);
    const finish = done ? actual : forecast;
    const slip = Number.isFinite(finish) && Number.isFinite(planned) ? finish - planned : NaN;

    if (!Number.isFinite(planned) && !Number.isFinite(forecast)) {
      return null;
    }

    return {
      id: "project-finish",
      name: "Project completion",
      status: "PROJECT",
      planned,
      forecast,
      actual: done ? actual : NaN,
      finish,
      slip,
      weight: NaN,
      tone: done ? "done" : toneOf("PLANNED", slip, false),
      overdue: false,
      isProject: true,
    };
  }, [project]);

  const open = rows.filter((row) => row.status !== "COMPLETED");
  const completed = rows.filter((row) => row.status === "COMPLETED");
  const slipping = open.filter((row) => Number.isFinite(row.slip) && row.slip > 0);
  const overdueRows = open.filter((row) => row.overdue);
  const blocked = open.filter((row) => row.status === "BLOCKED");
  const worst = slipping.length > 0 ? Math.max(...slipping.map((row) => row.slip)) : 0;
  const oldestLate = overdueRows.length > 0 ? Math.max(...overdueRows.map((row) => today - row.finish)) : 0;

  const totalWeight = rows.reduce((sum, row) => sum + (Number.isFinite(row.weight) ? row.weight : 0), 0);
  const share = (row: Row) => (totalWeight > 0 ? (Number.isFinite(row.weight) ? row.weight : 0) / totalWeight : 1 / Math.max(1, rows.length));
  const donePct = rows.length > 0 ? completed.reduce((sum, row) => sum + share(row), 0) * 100 : NaN;
  const duePct = rows.length > 0 ? rows.filter((row) => row.planned <= today).reduce((sum, row) => sum + share(row), 0) * 100 : NaN;
  const gap = Number.isFinite(donePct) && Number.isFinite(duePct) ? Math.round(donePct) - Math.round(duePct) : NaN;

  const axis = useMemo(() => {
    const days: number[] = [today];

    for (const row of [...rows, ...(finishRow ? [finishRow] : [])]) {
      for (const day of [row.planned, row.forecast, row.actual]) {
        if (Number.isFinite(day)) {
          days.push(day);
        }
      }
    }

    let min = Math.min(...days);
    let max = Math.max(...days);
    const pad = Math.max(3, Math.round((max - min) * 0.03));

    min -= pad;
    max += pad;

    if (max - min < 6) {
      max = min + 6;
    }

    const span = max - min;

    const firstTick = monthStart(min) >= min ? monthStart(min) : addMonths(min, 1);

    let step = STEPS[STEPS.length - 1] ?? 12;

    for (const candidate of STEPS) {
      let count = 0;

      for (let cursor = firstTick; cursor <= max; cursor = addMonths(cursor, candidate)) {
        count += 1;
      }

      if (count <= MAX_TICKS) {
        step = candidate;
        break;
      }
    }

    const ticks: Array<{ day: number; label: string }> = [];

    for (let cursor = firstTick; cursor <= max; cursor = addMonths(cursor, step)) {
      const date = new Date(cursor * DAY_MS);

      ticks.push({ day: cursor, label: tickLabel(cursor, ticks.length === 0 || date.getUTCMonth() === 0) });
    }

    return { min, span, ticks };
  }, [rows, finishRow, today]);

  const pct = (day: number) => Math.min(100, Math.max(0, ((day - axis.min) / axis.span) * 100));

  const register = useMemo(() => {
    const copy = [...rows];

    if (sort === "slip") {
      return copy.sort((a, b) => (Number.isFinite(b.slip) ? b.slip : -Infinity) - (Number.isFinite(a.slip) ? a.slip : -Infinity) || a.planned - b.planned);
    }

    if (sort === "weight") {
      return copy.sort((a, b) => (Number.isFinite(b.weight) ? b.weight : -1) - (Number.isFinite(a.weight) ? a.weight : -1) || a.planned - b.planned);
    }

    return copy;
  }, [rows, sort]);

  const empty = state === "ready" && rows.length === 0;

  function renderTrack(row: Row) {
    const planned = Number.isFinite(row.planned) ? pct(row.planned) : NaN;
    const marker = Number.isFinite(row.actual) ? row.actual : Number.isFinite(row.forecast) ? row.forecast : row.planned;
    const markerPct = Number.isFinite(marker) ? pct(marker) : NaN;
    const from = Math.min(planned, markerPct);
    const to = Math.max(planned, markerPct);

    return (
      <div aria-hidden="true" className={styles.plot}>
        {axis.ticks.map((tick) => (
          <span className={styles.gridline} key={tick.day} style={{ left: `${pct(tick.day)}%` }} />
        ))}

        <span className={styles.todayLine} style={{ left: `${pct(today)}%` }} />

        {Number.isFinite(planned) && Number.isFinite(markerPct) && to - from > 0.2 && (
          <span className={cx(styles.span, TONE_CLASS[row.tone])} style={{ left: `${from}%`, width: `${to - from}%` }} />
        )}

        {Number.isFinite(planned) && (
          <span className={styles.planned} style={{ left: `${planned}%` }} title={`Planned ${formatDay(row.planned)}`} />
        )}

        {Number.isFinite(markerPct) && (
          <span
            className={cx(styles.marker, TONE_CLASS[row.tone], row.isProject && styles.markerProject)}
            style={{ left: `${markerPct}%` }}
            title={`${Number.isFinite(row.actual) ? "Actual" : "Forecast"} ${formatDay(marker)}`}
          />
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">MILESTONES</div>

            <h1>{project ? project.name : "Milestone board"}</h1>

            <p className={styles.subtitle}>
              Every milestone against its plan: where it was meant to land, where it is now forecast to land, and how far it has slipped.
              Weighted by each milestone&apos;s importance, so a small slip on a big milestone shows up.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/schedule`}>
              Open schedule
            </Link>

            <Link className="secondary-link-button" href={`${base}/lookahead`}>
              Lookahead board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Loading milestones…</div>}

        {state === "failed" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the milestones. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {empty && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No milestones are recorded for this project yet. Add them on the schedule page and they will appear here.</div>
          </section>
        )}

        {state === "ready" && rows.length > 0 && (
          <>
            <section aria-label="Milestone summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>DONE</div>
                <div className={styles.kpiValue}>
                  {completed.length} <span className={styles.kpiOf}>of {rows.length}</span>
                </div>
                <div className={styles.kpiSub}>{Number.isFinite(donePct) ? `${Math.round(donePct)}% of the weight` : "no weights set"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AGAINST PLAN</div>
                <div className={cx(styles.kpiValue, Number.isFinite(gap) && gap < 0 && styles.neg, Number.isFinite(gap) && gap > 0 && styles.pos)}>
                  {Number.isFinite(gap) ? `${signed(gap)} pts` : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {Number.isFinite(donePct) ? `${Math.round(donePct)}% done · ${Math.round(duePct)}% planned by today` : "not enough data"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SLIPPING</div>
                <div className={cx(styles.kpiValue, slipping.length > 0 && styles.neg)}>{slipping.length}</div>
                <div className={styles.kpiSub}>
                  {slipping.length > 0 ? `worst ${worst} ${plural(worst, "day", "days")}` : "none behind plan"}
                  {blocked.length > 0 ? ` · ${blocked.length} blocked` : ""}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PAST FORECAST DATE</div>
                <div className={cx(styles.kpiValue, overdueRows.length > 0 && styles.neg)}>{overdueRows.length}</div>
                <div className={styles.kpiSub}>
                  {overdueRows.length > 0 ? `oldest ${oldestLate} ${plural(oldestLate, "day", "days")} ago` : "none overdue"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PROJECT FINISH</div>
                <div
                  className={cx(
                    styles.kpiValue,
                    finishRow && Number.isFinite(finishRow.slip) && finishRow.slip > 0 && styles.neg,
                    finishRow && Number.isFinite(finishRow.slip) && finishRow.slip < 0 && styles.pos,
                  )}
                >
                  {finishRow && Number.isFinite(finishRow.slip) ? `${signed(finishRow.slip)} d` : "—"}
                </div>
                <div className={styles.kpiSub}>{finishRow && Number.isFinite(finishRow.finish) ? `forecast ${formatDay(finishRow.finish)}` : "no end date"}</div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PLAN VS FORECAST</div>
                  <h2>When each milestone lands</h2>
                </div>
              </header>

              <ul className={styles.legend}>
                <li>
                  <span className={styles.legendRing} />
                  Planned date
                </li>
                <li>
                  <span className={cx(styles.legendDot, styles.toneOk)} />
                  Forecast or actual date
                </li>
                <li>
                  <span className={styles.legendToday} />
                  Today
                </li>
              </ul>

              <div className={styles.timeline} role="list">
                <div aria-hidden="true" className={cx(styles.line, styles.axisRow)}>
                  <div className={styles.lineLabel} />

                  <div className={styles.axis}>
                    {axis.ticks.map((tick) => (
                      <span className={styles.tickLabel} key={tick.day} style={{ left: `${pct(tick.day)}%` }}>
                        {tick.label}
                      </span>
                    ))}
                  </div>
                </div>

                {[...rows, ...(finishRow ? [finishRow] : [])].map((row) => (
                  <div className={cx(styles.line, row.isProject && styles.lineProject)} key={row.id} role="listitem">
                    <div className={styles.lineLabel}>
                      <strong>{row.name}</strong>

                      <small>
                        {Number.isFinite(row.finish) ? `${row.status === "COMPLETED" ? "Done" : "Forecast"} ${formatDay(row.finish)}` : "No date"}
                        {Number.isFinite(row.slip) && row.slip !== 0 ? ` · ${signed(row.slip)} d` : ""}
                        {row.overdue ? " · overdue" : ""}
                      </small>
                    </div>

                    {renderTrack(row)}
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">REGISTER</div>
                  <h2>Dates and slip</h2>
                </div>

                <div aria-label="Sort milestones" className={styles.segmented} role="group">
                  {SORTS.map((option) => (
                    <button
                      aria-pressed={sort === option.key}
                      className={cx(styles.segment, sort === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => setSort(option.key)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </header>

              <div className={styles.tableWrap}>
                <table className={cx(styles.table, styles.register)}>
                  <thead>
                    <tr>
                      <th>Milestone</th>
                      <th>Planned</th>
                      <th>Forecast</th>
                      <th>Slip</th>
                      <th className={styles.weightCol}>Weight</th>
                    </tr>
                  </thead>

                  <tbody>
                    {register.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.name}</strong>
                          <span className={cx(styles.statePill, TONE_CLASS[row.tone])}>
                            {TONE_LABEL[row.tone]}
                          </span>
                        </td>
                        <td className={styles.nowrap}>{formatDay(row.planned)}</td>
                        <td className={styles.nowrap}>{formatDay(row.status === "COMPLETED" && Number.isFinite(row.actual) ? row.actual : row.forecast)}</td>
                        <td className={cx(styles.slipCell, row.slip > 0 && row.status !== "COMPLETED" && styles.neg)}>
                          <span className={styles.slipLong}>{slipText(row)}</span>
                          <span className={styles.slipShort}>{slipShort(row)}</span>
                        </td>
                        <td className={cx(styles.num, styles.weightCol)}>{Number.isFinite(row.weight) ? `${row.weight}%` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className={styles.note}>
              Slip is the forecast date minus the planned date, or the actual date once a milestone is done. A milestone counts as past its
              forecast date when it is not complete and that date has gone by. “Against plan” compares the weight of milestones completed
              with the weight of milestones whose planned date has passed; when no weights are set, every milestone counts equally. Blocked
              milestones are drawn in dark red whatever their slip, and open milestones more than {WATCH_DAYS} days behind show as late.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
