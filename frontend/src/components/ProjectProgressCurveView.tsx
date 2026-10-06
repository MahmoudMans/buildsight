"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import {
  BEHIND_PP,
  LIST_LIMIT,
  aheadRows,
  behindRows,
  buildProgress,
  pctText,
  ppText,
  progressMarkdown,
  verdict,
  workText,
  type Group,
  type Point,
  type Progress,
  type Row,
} from "@/lib/progressCurve";
import { copyText } from "@/lib/textExport";
import type { ScheduleControl } from "@/types/project";

import styles from "./ProjectProgressCurveView.module.css";

type Tone = "good" | "watch" | "bad";

const PAD = { left: 44, right: 16, top: 16, bottom: 30 };
const DAY = 86_400_000;

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function toneOf(gap: number): Tone {
  return gap <= -BEHIND_PP ? "bad" : gap < -0.02 ? "watch" : "good";
}

function gapClass(gap: number): string | undefined {
  const tone = toneOf(gap);

  return tone === "bad" ? styles.neg : tone === "good" && gap > 0.02 ? styles.pos : tone === "watch" ? styles.warn : undefined;
}

function monthTicks(from: number, to: number): Array<{ day: number; label: string }> {
  const ticks: Array<{ day: number; label: string }> = [];
  const start = new Date(from * DAY);
  const year = start.getUTCFullYear();
  let month = start.getUTCMonth() + 1;

  for (let guard = 0; guard < 400; guard += 1) {
    const date = new Date(Date.UTC(year, month, 1));
    const day = Math.floor(date.getTime() / DAY);

    if (day > to) {
      break;
    }

    const name = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" }).format(date);

    ticks.push({ day, label: date.getUTCMonth() === 0 || ticks.length === 0 ? `${name} ${String(date.getUTCFullYear()).slice(2)}` : name });
    month += 1;
  }

  return ticks;
}

function Curve({ progress, width }: { progress: Progress; width: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const height = width < 520 ? 230 : 290;
  const first = progress.startDay - 1;
  const last = progress.endDay;
  const span = Math.max(1, last - first);
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const x = (day: number) => PAD.left + ((day - first) / span) * innerW;
  const y = (value: number) => PAD.top + (1 - value) * innerH;
  const points = progress.curve;

  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point.day).toFixed(1)} ${y(point.planned).toFixed(1)}`).join(" ");
  const area = `${line} L${x(last).toFixed(1)} ${y(0).toFixed(1)} L${x(first).toFixed(1)} ${y(0).toFixed(1)} Z`;
  const ticks = monthTicks(first, last);
  const every = Math.max(1, Math.ceil(ticks.length / Math.max(2, Math.floor(innerW / 64))));
  const shown = ticks.filter((_, index) => index % every === 0);
  const inside = progress.asOf >= first && progress.asOf <= last;
  const tone = toneOf(progress.gap);
  const asX = x(Math.min(Math.max(progress.asOf, first), last));
  const flip = asX > PAD.left + innerW * 0.62;
  const planY = y(progress.planned);
  const actY = y(progress.actual);
  const lowest = Math.max(planY, actY);
  const highest = Math.min(planY, actY);
  const below = y(0) - lowest >= 44;
  const labelLeft = below ? flip : asX >= PAD.left + 130;
  const firstY = below ? lowest + 18 : highest - 26;
  const labels = [
    { text: `Expected ${pctText(progress.planned)}`, y: firstY, strong: false },
    { text: `Actual ${pctText(progress.actual)}`, y: firstY + 15, strong: true },
  ];

  function nearest(day: number): Point {
    let best = points[0] as Point;

    for (const point of points) {
      if (Math.abs(point.day - day) < Math.abs(best.day - day)) {
        best = point;
      }
    }

    return best;
  }

  function move(event: MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left - PAD.left) / innerW;

    setHover(ratio < 0 || ratio > 1 ? null : first + ratio * span);
  }

  const hoverPoint = hover === null ? null : nearest(hover);
  const hoverFlip = hoverPoint !== null && x(hoverPoint.day) > PAD.left + innerW * 0.7;

  return (
    <svg
      aria-label={`Expected progress climbs from 0% to 100% between ${formatDay(progress.startDay)} and ${formatDay(progress.endDay)}. As of ${formatDay(progress.asOf)} the schedule expects ${pctText(progress.planned)} and ${pctText(progress.actual)} is done.`}
      className={styles.chart}
      height={height}
      onMouseLeave={() => setHover(null)}
      onMouseMove={move}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      {[0, 0.25, 0.5, 0.75, 1].map((value) => (
        <g key={value}>
          <line className={styles.grid} x1={PAD.left} x2={width - PAD.right} y1={y(value)} y2={y(value)} />
          <text className={styles.axis} textAnchor="end" x={PAD.left - 8} y={y(value) + 4}>
            {Math.round(value * 100)}%
          </text>
        </g>
      ))}

      {shown.map((tick) => (
        <g key={tick.day}>
          <line className={styles.tick} x1={x(tick.day)} x2={x(tick.day)} y1={y(0)} y2={y(0) + 4} />
          <text className={styles.axis} textAnchor="middle" x={x(tick.day)} y={y(0) + 18}>
            {tick.label}
          </text>
        </g>
      ))}

      <path className={styles.planArea} d={area} />
      <path className={styles.planLine} d={line} />

      {inside && (
        <>
          <line className={styles.asOf} x1={asX} x2={asX} y1={PAD.top} y2={y(0)} />

          {Math.abs(actY - planY) > 1 && <line className={cx(styles.gapBar, tone === "bad" && styles.gapBad, tone === "watch" && styles.gapWatch, tone === "good" && styles.gapGood)} x1={asX} x2={asX} y1={planY} y2={actY} />}

          <circle className={styles.dotPlan} cx={asX} cy={planY} r={4.5} />
          <circle className={cx(styles.dotActual, tone === "bad" && styles.fillBad, tone === "watch" && styles.fillWatch, tone === "good" && styles.fillGood)} cx={asX} cy={actY} r={5} />

          {labels.map((label) => (
            <text className={cx(styles.mark, label.strong && styles.markStrong)} key={label.text} textAnchor={labelLeft ? "end" : "start"} x={asX + (labelLeft ? -10 : 10)} y={label.y}>
              {label.text}
            </text>
          ))}
        </>
      )}

      {hoverPoint && (
        <g>
          <line className={styles.hoverLine} x1={x(hoverPoint.day)} x2={x(hoverPoint.day)} y1={PAD.top} y2={y(0)} />
          <circle className={styles.dotPlan} cx={x(hoverPoint.day)} cy={y(hoverPoint.planned)} r={3.5} />
          <text className={styles.readout} textAnchor={hoverFlip ? "end" : "start"} x={x(hoverPoint.day) + (hoverFlip ? -8 : 8)} y={PAD.top + 12}>
            {formatDay(hoverPoint.day)}: {pctText(hoverPoint.planned)} expected
          </text>
        </g>
      )}
    </svg>
  );
}

function Pair({ row }: { row: Row }) {
  return (
    <span aria-hidden="true" className={styles.pair}>
      <i className={styles.pairPlan} style={{ width: `${Math.round(row.planned * 100)}%` }} />
      <i className={cx(styles.pairActual, row.work > 0 ? styles.fillBad : styles.fillGood)} style={{ width: `${Math.round(row.actual * 100)}%` }} />
    </span>
  );
}

function Activities({ empty, rows }: { empty: string; rows: Row[] }) {
  if (rows.length === 0) {
    return <p className={styles.quiet}>{empty}</p>;
  }

  return (
    <ul className={styles.records}>
      {rows.map((row) => (
        <li key={row.id}>
          <div className={styles.recTop}>
            <strong>{row.code}</strong>
            <span>{trunc(row.name, 52)}</span>
            {row.critical && <em className={styles.critTag}>critical</em>}
          </div>

          <Pair row={row} />

          <div className={styles.recMeta}>
            <span className={styles.recDays}>{workText(row.work)}</span>
            <span>
              expected {pctText(row.planned)}, actual {pctText(row.actual)}
            </span>
            <span>{row.discipline}</span>
            <span>
              {formatDay(row.start)} to {formatDay(row.finish)}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function GroupBar({ group }: { group: Group }) {
  return (
    <span aria-hidden="true" className={styles.groupBar}>
      <i className={cx(styles.groupFill, toneOf(group.gap) === "bad" ? styles.fillBad : toneOf(group.gap) === "watch" ? styles.fillWatch : styles.fillGood)} style={{ width: `${Math.round(group.actual * 100)}%` }} />
      <b className={styles.groupMark} style={{ left: `${Math.min(99, Math.round(group.planned * 100))}%` }} />
    </span>
  );
}

export function ProjectProgressCurveView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [width, setWidth] = useState(900);
  const holder = useRef<HTMLDivElement | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectSchedule(projectId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const built = useMemo(() => (data ? buildProgress(data, today) : null), [data, today]);
  const progress: Progress | null = built && built.ok ? built.progress : null;

  useEffect(() => {
    const node = holder.current;

    if (!node || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const measure = () => setWidth(Math.max(300, Math.floor(node.clientWidth)));
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(node);

    return () => observer.disconnect();
  }, [progress]);

  const projectName = data?.project?.name ?? "Project";
  const active = progress && picked !== null ? (progress.groups.find((group) => group.name === picked) ?? null) : null;
  const filter = active ? active.name : null;
  const behind = progress ? behindRows(progress, filter, LIST_LIMIT) : { rows: [], total: 0 };
  const ahead = progress ? aheadRows(progress, filter, LIST_LIMIT / 2) : { rows: [], total: 0 };
  const call = progress ? verdict(progress) : null;
  const live = progress ? progress.counts.total - progress.counts.complete : 0;

  function choose(name: string) {
    setPicked((current) => (current === name ? null : name));
    setMessage(null);
  }

  async function copySummary() {
    if (!progress) {
      return;
    }

    const ok = await copyText(progressMarkdown(progress, projectName, today));

    setMessage(ok ? "Copied the figures as Markdown." : "Could not copy the figures.");
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

            <div className="eyebrow">PROGRESS CURVE</div>

            <h1>Are we where the schedule says we should be?</h1>

            <p className={styles.subtitle}>
              Every activity is weighted by its duration and spread evenly between its start and finish. Added up, that is how much of the work the schedule expects to be done by now. Set against the progress actually reported, it shows how far ahead or behind the job is, and where.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/schedule-health`}>
              Schedule health
            </Link>

            <Link className="secondary-link-button" href={`${base}/lookahead`}>
              Look-ahead
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Adding up the schedule…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the schedule. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "empty" ? "The schedule has no activities yet, so there is no progress to measure." : "None of the schedule’s activities has usable start and finish dates."}</div>
          </section>
        )}

        {state === "ready" && progress && call && (
          <>
            <section aria-label="Progress summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>AS OF</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>{formatDay(progress.asOf)}</div>
                <div className={styles.kpiSub}>{progress.usedToday ? "today (no data date set)" : "schedule data date"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>EXPECTED BY NOW</div>
                <div className={styles.kpiValue}>{pctText(progress.planned)}</div>
                <div className={styles.kpiSub}>of the work, per the schedule</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ACTUAL</div>
                <div className={styles.kpiValue}>{pctText(progress.actual)}</div>
                <div className={styles.kpiSub}>of the work, as reported</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>GAP</div>
                <div className={cx(styles.kpiValue, gapClass(progress.gap))}>{ppText(progress.gap)}</div>
                <div className={styles.kpiSub}>{workText(progress.work)}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>BEHIND BY {Math.round(BEHIND_PP * 100)}+ PTS</div>
                <div className={cx(styles.kpiValue, progress.counts.behind > 0 && styles.neg)}>{progress.counts.behind}</div>
                <div className={styles.kpiSub}>
                  of {live} {plural(live, "activity", "activities")} not complete
                  {progress.counts.shouldHaveStarted > 0 ? `, ${progress.counts.shouldHaveStarted} not yet started` : ""}
                </div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">THE CURVE</div>
                  <h2>Expected progress, and where we actually are</h2>
                </div>

                <button className={styles.linkButton} onClick={copySummary} type="button">
                  Copy as Markdown
                </button>
              </header>

              <p className={cx(styles.verdict, call.tone === "bad" && styles.verdictBad, call.tone === "watch" && styles.verdictWatch, call.tone === "good" && styles.verdictGood)}>{call.text}</p>

              <div className={styles.chartWrap} ref={holder}>
                <Curve progress={progress} width={width} />
              </div>

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.swatchPlan)} />
                  Expected, from the current schedule
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchDot)} />
                  Actual, as reported at the date shown
                </li>
              </ul>

              {message && (
                <p className={styles.statusLine} role="status">
                  {message}
                </p>
              )}

              <p className={styles.hint}>
                {pctText(progress.leftActual)} of the work is still to do; the schedule expects {pctText(progress.leftPlanned)} to be left by now.
                {progress.leftPlanned > 0 && progress.leftActual > progress.leftPlanned ? ` That is ${((progress.leftActual / progress.leftPlanned - 1) * 100).toFixed(0)}% more work left than the plan assumed for the same finish.` : ""}{" "}
                {progress.forecastFinish !== null ? `The scheduler’s forecast finish is ${formatDay(progress.forecastFinish)}` : `The last activity finishes ${formatDay(progress.endDay)}`}
                {progress.baselineFinish !== null ? `, against an approved baseline finish of ${formatDay(progress.baselineFinish)}.` : "."}
              </p>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY DISCIPLINE</div>
                  <h2>Where the gap comes from</h2>
                </div>

                <span className={styles.muted}>{active ? `Showing ${active.name} only below` : "Select a row to focus the lists below"}</span>
              </header>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Discipline</th>
                      <th className={styles.num} scope="col">
                        Activities
                      </th>
                      <th className={styles.num} scope="col">
                        Share of work
                      </th>
                      <th scope="col">Actual against expected</th>
                      <th className={styles.num} scope="col">
                        Expected
                      </th>
                      <th className={styles.num} scope="col">
                        Actual
                      </th>
                      <th className={styles.num} scope="col">
                        Gap
                      </th>
                      <th className={styles.num} scope="col">
                        Net work behind
                      </th>
                      <th className={styles.num} scope="col">
                        Behind
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {progress.groups.map((group) => (
                      <tr className={cx(active && group.name === active.name && styles.rowOn)} key={group.name}>
                        <th scope="row">
                          <button aria-pressed={active !== null && group.name === active.name} className={styles.rowButton} onClick={() => choose(group.name)} type="button">
                            {group.name}
                          </button>
                        </th>
                        <td className={styles.num}>{group.count}</td>
                        <td className={styles.num}>{pctText(group.share)}</td>
                        <td>
                          <GroupBar group={group} />
                        </td>
                        <td className={styles.num}>{pctText(group.planned)}</td>
                        <td className={styles.num}>
                          <strong>{pctText(group.actual)}</strong>
                        </td>
                        <td className={cx(styles.num, gapClass(group.gap))}>{ppText(group.gap)}</td>
                        <td className={cx(styles.num, group.work > 0.5 && styles.neg)}>{Math.abs(group.work) < 0.5 ? "—" : `${group.work > 0 ? "" : "−"}${Math.abs(Math.round(group.work * 10) / 10)} d`}</td>
                        <td className={cx(styles.num, group.behind > 0 && styles.neg)}>{group.behind}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className={styles.scrollHint}>Swipe the table sideways for the rest of the columns.</p>

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.swatchBar)} />
                  Bar is the actual progress
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchTick)} />
                  Tick is where the schedule expects it to be
                </li>
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">ACTIVITIES{active ? `: ${active.name.toUpperCase()}` : ""}</div>
                  <h2>What is behind, and what is ahead</h2>
                </div>

                {active && (
                  <button className={styles.linkButton} onClick={() => setPicked(null)} type="button">
                    Show every discipline
                  </button>
                )}
              </header>

              <div className={cx(styles.twoCol, styles.lists, styles.plain)}>
                <div>
                  <h3 className={styles.subhead}>Furthest behind{behind.total > 0 ? ` (${behind.total})` : ""}</h3>
                  <Activities empty="No unfinished activity is behind where the schedule expects it to be." rows={behind.rows} />
                  {behind.total > behind.rows.length && <p className={styles.quiet}>and {behind.total - behind.rows.length} more, most days of work behind first above.</p>}
                </div>

                <div>
                  <h3 className={styles.subhead}>Ahead of plan{ahead.total > 0 ? ` (${ahead.total})` : ""}</h3>
                  <Activities empty="No activity is ahead of where the schedule expects it to be." rows={ahead.rows} />
                  {ahead.total > ahead.rows.length && <p className={styles.quiet}>and {ahead.total - ahead.rows.length} more.</p>}
                </div>
              </div>
            </section>

            <p className={styles.note}>
              Progress is weighted by each activity’s duration, not by cost or quantity, so a long activity counts for more than a short one. Expected progress spreads each activity evenly between its current start and finish dates, up to and including the date shown; because those are the <em>current</em> dates, an activity the schedule has already pushed out will not show as behind. Actual progress is the percent complete reported on each activity, and a completed activity counts as 100%. “Days of work behind” is the activity’s duration multiplied by how far short of expected it is. An activity counts as behind when it is {Math.round(BEHIND_PP * 100)} points or more short and not yet complete.
              {progress.skipped > 0 ? ` ${progress.skipped} ${plural(progress.skipped, "activity has", "activities have")} no usable dates and ${plural(progress.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
