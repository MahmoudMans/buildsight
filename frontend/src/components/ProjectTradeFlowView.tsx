"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import { formatDay, plural, startOfToday, trunc, words } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import {
  DEFAULT_RANGE,
  DETAIL_LIMIT,
  GAP_WEEKS,
  MAX_WEEKS,
  MEASURES,
  RANGES,
  activeIn,
  buildFlow,
  dayOfMonth,
  flowMarkdown,
  gapIndexes,
  gapText,
  heatLevel,
  monthSpans,
  nowWeek,
  rangeText,
  weekEnd,
  type Flow,
  type Lane,
  type Measure,
} from "@/lib/tradeFlow";
import type { ScheduleControl } from "@/types/project";

import styles from "./ProjectTradeFlowView.module.css";

interface Picked {
  lane: string | null;
  start: number;
}

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const HEAT = [undefined, styles.h1, styles.h2, styles.h3, styles.h4] as const;
const TOTAL = [undefined, styles.t1, styles.t2, styles.t3, styles.t4] as const;

function densityClass(weeks: number): string | undefined {
  return weeks > 52 ? styles.tight : weeks > 26 ? styles.mid : styles.wide;
}

function Grid({ flow, measure, now, onPick, picked }: { flow: Flow; measure: Measure; now: number | null; onPick: (pick: Picked) => void; picked: Picked | null }) {
  const key = measure === "critical" ? "critical" : "all";
  const laneValues = flow.lanes.map((lane) => lane[key]);
  const laneMax = Math.max(0, ...laneValues.map((values) => Math.max(0, ...values)));
  const totalValues = flow.total[key];
  const totalMax = Math.max(0, ...totalValues);
  const peakIndex = totalMax === 0 ? null : totalValues.indexOf(totalMax);
  const months = monthSpans(flow.weeks);
  const unit = measure === "critical" ? "critical activity" : "activity";
  const units = measure === "critical" ? "critical activities" : "activities";

  function cell(lane: Lane | null, index: number, value: number, level: number, gap: boolean) {
    const start = flow.weeks[index] as number;
    const name = lane ? lane.name : "All trades";
    const on = picked !== null && picked.start === start && picked.lane === (lane ? lane.name : null);
    const text = `${name}, week of ${formatDay(start)}: ${value} ${value === 1 ? unit : units}${gap ? ", idle between two busy spells" : ""}`;

    return (
      <td key={start}>
        <button
          aria-label={text}
          aria-pressed={on}
          className={cx(styles.cell, lane ? HEAT[level] : TOTAL[level], gap && styles.gapCell, on && styles.cellOn, !lane && index === peakIndex && styles.peakCell)}
          onClick={() => onPick({ lane: lane ? lane.name : null, start })}
          title={text}
          type="button"
        >
          {value > 0 ? value : ""}
        </button>
      </td>
    );
  }

  return (
    <div className={styles.gridWrap}>
      <table className={cx(styles.grid, densityClass(flow.weeks.length), measure === "critical" && styles.critical)}>
        <thead>
          <tr>
            <th className={styles.corner} rowSpan={2} scope="col">
              Discipline
            </th>

            {months.map((month, index) => (
              <th className={styles.month} colSpan={month.span} key={`${month.label}-${index}`} scope="colgroup">
                <span>{month.label}</span>
              </th>
            ))}
          </tr>

          <tr className={styles.dayRow}>
            {flow.weeks.map((start, index) => (
              <th className={cx(styles.day, index === now && styles.nowHead)} key={start} scope="col" title={`Week of ${formatDay(start)}`}>
                {index === now ? "now" : dayOfMonth(start)}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          <tr className={styles.totalRow}>
            <th className={styles.rowHead} scope="row">
              <span className={styles.rowName}>All trades</span>
              <small>{totalMax > 0 ? `peak ${totalMax}` : "nothing"}</small>
            </th>
            {totalValues.map((value, index) => cell(null, index, value, heatLevel(value, totalMax, 6), false))}
          </tr>

          {flow.lanes.map((lane, row) => {
            const gaps = gapIndexes(lane);
            const values = laneValues[row] as number[];

            return (
              <tr key={lane.name}>
                <th className={styles.rowHead} scope="row" title={lane.name}>
                  <span className={styles.rowName}>{lane.name}</span>
                  <small>
                    {lane.activities} {plural(lane.activities, "activity", "activities")}
                  </small>
                </th>
                {values.map((value, index) => cell(lane, index, value, heatLevel(value, laneMax), measure === "all" && gaps.has(index)))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectTradeFlowView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [rangeKey, setRangeKey] = useState(DEFAULT_RANGE);
  const [measure, setMeasure] = useState<Measure>("all");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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

  const weeksShown = RANGES.find((item) => item.key === rangeKey)?.weeks ?? null;
  const built = useMemo(() => (data ? buildFlow(data, today, weeksShown) : null), [data, today, weeksShown]);
  const flow: Flow | null = built && built.ok ? built.flow : null;
  const projectName = data?.project?.name ?? "Project";
  const onlyCritical = measure === "critical";
  const key = onlyCritical ? "critical" : "all";
  const now = flow ? nowWeek(flow, today) : null;

  const totalValues = flow ? flow.total[key] : [];
  const totalPeak = Math.max(0, ...totalValues);
  const peakIndex = totalPeak === 0 ? null : totalValues.indexOf(totalPeak);
  const pickedIndex = flow && picked ? flow.weeks.indexOf(picked.start) : -1;
  const effective: Picked | null = flow && pickedIndex >= 0 && picked ? picked : flow && peakIndex !== null ? { lane: null, start: flow.weeks[peakIndex] as number } : null;
  const effectiveIndex = flow && effective ? flow.weeks.indexOf(effective.start) : -1;
  const detail = flow && effective && effectiveIndex >= 0 ? activeIn(flow, effective.lane, effectiveIndex, onlyCritical) : [];

  const peakTrades = useMemo(() => {
    if (!flow || peakIndex === null) {
      return [] as Array<{ name: string; count: number }>;
    }

    return flow.lanes
      .map((lane) => ({ name: lane.name, count: lane[key][peakIndex] ?? 0 }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [flow, key, peakIndex]);

  const gaps = useMemo(() => {
    if (!flow) {
      return [] as Array<{ lane: Lane; from: number; to: number; weeks: number; returnsWith: string | null }>;
    }

    return flow.lanes
      .flatMap((lane) =>
        lane.gaps.map((gap) => {
          const back = activeIn(flow, lane.name, gap.to + 1, false)[0];

          return { lane, from: gap.from, to: gap.to, weeks: gap.weeks, returnsWith: back ? `${back.code} ${trunc(back.name, 40)}` : null };
        }),
      )
      .sort((a, b) => b.weeks - a.weeks || a.from - b.from);
  }, [flow]);

  const nowTotal = flow && now !== null ? (flow.total[key][now] ?? 0) : null;

  function choose<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setMessage(null);
  }

  async function copySummary() {
    if (!flow) {
      return;
    }

    const ok = await copyText(flowMarkdown(flow, measure, projectName, today));

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

            <div className="eyebrow">TRADE FLOW</div>

            <h1>Which trades are on site, week by week?</h1>

            <p className={styles.subtitle}>
              How many schedule activities each discipline has running in every week, so crowded weeks, handovers between trades and trades that leave and come back are easy to see before they happen.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/resource-heatmap`}>
              Resource heatmap
            </Link>

            <Link className="secondary-link-button" href={`${base}/lookahead`}>
              Look-ahead
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the schedule…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the schedule. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "empty" ? "The schedule has no activities yet." : "None of the activities has usable start and finish dates."}</div>
          </section>
        )}

        {state === "ready" && flow && (
          <>
            <section aria-label="Trade flow summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>BUSIEST WEEK</div>
                <div className={styles.kpiValue}>{peakIndex === null ? "—" : totalPeak}</div>
                <div className={styles.kpiSub}>{peakIndex === null ? "nothing in these weeks" : `${onlyCritical ? "critical " : ""}${plural(totalPeak, "activity", "activities")} at once, week of ${formatDay(flow.weeks[peakIndex] as number)}`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ON NOW</div>
                <div className={styles.kpiValue}>{nowTotal === null ? "—" : nowTotal}</div>
                <div className={styles.kpiSub}>{nowTotal === null ? "this week is outside the range" : `${onlyCritical ? "critical " : ""}${plural(nowTotal, "activity", "activities")} this week`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DISCIPLINES</div>
                <div className={styles.kpiValue}>{flow.lanes.length}</div>
                <div className={styles.kpiSub}>with work in these weeks</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MOST WORK</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>{flow.busiest ? flow.busiest.name : "—"}</div>
                <div className={styles.kpiSub}>{flow.busiest ? `${flow.busiest.load} activity-weeks over ${flow.busiest.activeWeeks} ${plural(flow.busiest.activeWeeks, "week", "weeks")}` : "no discipline named"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LEAVE AND RETURN</div>
                <div className={cx(styles.kpiValue, gaps.length > 0 && styles.warn)}>{gaps.length}</div>
                <div className={styles.kpiSub}>{gaps.length === 0 ? `no idle gap of ${GAP_WEEKS}+ weeks` : `${plural(gaps.length, "trade gap", "trade gaps")} of ${GAP_WEEKS}+ weeks`}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.controlGroup}>
                <div aria-label="Weeks shown" className={styles.segmented} role="group">
                  {RANGES.map((option) => (
                    <button aria-pressed={rangeKey === option.key} className={cx(styles.segment, rangeKey === option.key && styles.segmentOn)} key={option.key} onClick={() => choose(setRangeKey, option.key)} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>

                <div aria-label="Count" className={styles.segmented} role="group">
                  {MEASURES.map((option) => (
                    <button aria-pressed={measure === option.key} className={cx(styles.segment, measure === option.key && styles.segmentOn)} key={option.key} onClick={() => choose(setMeasure, option.key)} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className={styles.linkButton} onClick={copySummary} type="button">
                Copy as Markdown
              </button>
            </section>

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WEEK BY WEEK</div>
                  <h2>{onlyCritical ? "Critical activities per discipline" : "Activities per discipline"}</h2>
                </div>

                <span className={styles.muted}>
                  {flow.weeks.length} {plural(flow.weeks.length, "week", "weeks")} from {formatDay(flow.weeks[0] as number)}
                </span>
              </header>

              {flow.lanes.length === 0 ? (
                <div className={styles.emptySmall}>{onlyCritical ? "No critical activity falls in these weeks." : "Nothing is planned or running in these weeks."} Try a longer range.</div>
              ) : (
                <>
                  <Grid flow={flow} measure={measure} now={now} onPick={(pick) => setPicked(pick)} picked={effective} />

                  <ul className={styles.legend}>
                    <li>
                      <span className={styles.ramp} aria-hidden="true">
                        <i className={cx(styles.swatch, onlyCritical ? styles.c1 : styles.h1)} />
                        <i className={cx(styles.swatch, onlyCritical ? styles.c2 : styles.h2)} />
                        <i className={cx(styles.swatch, onlyCritical ? styles.c3 : styles.h3)} />
                        <i className={cx(styles.swatch, onlyCritical ? styles.c4 : styles.h4)} />
                      </span>
                      Darker means more at once
                    </li>
                    {!onlyCritical && (
                      <li>
                        <i className={cx(styles.swatch, styles.swatchGap)} />
                        Idle between two busy spells
                      </li>
                    )}
                    <li>
                      <i className={cx(styles.swatch, styles.swatchTotal)} />
                      All-trades row, scaled on its own
                    </li>
                  </ul>

                  <p className={styles.scrollHint}>Swipe the grid sideways to see later weeks.</p>
                </>
              )}
            </section>

            {flow.lanes.length > 0 && effective && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">{effective.lane === null ? "ALL TRADES" : effective.lane.toUpperCase()}</div>
                    <h2>Week of {formatDay(effective.start)}</h2>
                  </div>

                  <span className={styles.muted}>
                    {detail.length} {onlyCritical ? "critical " : ""}
                    {plural(detail.length, "activity", "activities")} in progress or planned
                  </span>
                </header>

                {effective.lane === null && peakIndex !== null && effective.start === flow.weeks[peakIndex] && peakTrades.length > 0 && (
                  <p className={styles.quiet}>
                    Busiest week. {peakTrades.map((item) => `${item.name} ${item.count}`).join(", ")}.
                  </p>
                )}

                {detail.length === 0 ? (
                  <p className={styles.quiet}>Nothing is running for this discipline that week.</p>
                ) : (
                  <ul className={styles.records}>
                    {detail.slice(0, DETAIL_LIMIT).map((act) => (
                      <li key={act.id}>
                        <div className={styles.recTop}>
                          <strong>{act.code}</strong>
                          <span>{trunc(act.name, 56)}</span>
                          {act.critical && <em className={styles.critTag}>critical</em>}
                          {!act.critical && act.nearCritical && <em className={styles.nearTag}>near critical</em>}
                          {act.overrun && <em className={styles.lateTag}>past planned finish</em>}
                        </div>

                        <div className={styles.recMeta}>
                          <span className={styles.recDays}>
                            {formatDay(act.start)} to {formatDay(act.end)}
                          </span>
                          <span>{act.discipline}</span>
                          <span>{words(act.status)}</span>
                          {act.status !== "NOT_STARTED" && <span>{Math.round(act.progress)}% done</span>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {detail.length > DETAIL_LIMIT && <p className={styles.quiet}>{detail.length - DETAIL_LIMIT} more not listed.</p>}
              </section>
            )}

            {gaps.length > 0 && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">LEAVE AND RETURN</div>
                    <h2>Trades that stand down and come back</h2>
                  </div>

                  <span className={styles.muted}>Idle for {GAP_WEEKS}+ weeks between two busy spells</span>
                </header>

                <ul className={styles.records}>
                  {gaps.map((gap) => (
                    <li key={`${gap.lane.name}-${gap.from}`}>
                      <div className={styles.recTop}>
                        <strong>{gap.lane.name}</strong>
                        <span>{gapText(flow, gap)}</span>
                      </div>

                      <div className={styles.recMeta}>
                        <span className={styles.recDays}>
                          Back on {formatDay(flow.weeks[gap.to + 1] as number)}
                        </span>
                        {gap.returnsWith && <span>with {gap.returnsWith}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {flow.lanes.length > 0 && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY DISCIPLINE</div>
                    <h2>Each trade at a glance</h2>
                  </div>

                  <span className={styles.muted}>Within the weeks shown</span>
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
                          Critical
                        </th>
                        <th scope="col">First week</th>
                        <th scope="col">Last week</th>
                        <th className={styles.num} scope="col">
                          Busiest week
                        </th>
                        <th className={styles.num} scope="col">
                          Weeks on site
                        </th>
                        <th scope="col">Idle gaps</th>
                      </tr>
                    </thead>

                    <tbody>
                      {flow.lanes.map((lane) => {
                        const peak = Math.max(0, ...lane[key]);

                        return (
                          <tr key={lane.name}>
                            <th scope="row">
                              <span className={styles.groupName}>{lane.name}</span>
                            </th>
                            <td className={styles.num}>{lane.activities}</td>
                            <td className={cx(styles.num, lane.criticalActivities > 0 && styles.neg)}>{lane.criticalActivities}</td>
                            <td>{lane.first === null ? <span className={styles.missing}>—</span> : formatDay(flow.weeks[lane.first] as number)}</td>
                            <td>{lane.last === null ? <span className={styles.missing}>—</span> : formatDay(weekEnd(flow.weeks[lane.last] as number))}</td>
                            <td className={styles.num}>{peak}</td>
                            <td className={styles.num}>{lane.activeWeeks}</td>
                            <td className={styles.wrapCell}>
                              {lane.gaps.length === 0 ? (
                                <span className={styles.missing}>{lane.name === "No discipline" ? "not checked" : "none"}</span>
                              ) : (
                                <span className={styles.warn}>{lane.gaps.map((gap) => `${gap.weeks} ${plural(gap.weeks, "week", "weeks")}, ${rangeText(flow, gap.from, gap.to)}`).join("; ")}</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <p className={styles.scrollHint}>Swipe the table sideways for the rest of the columns.</p>
              </section>
            )}

            <p className={styles.note}>
              A week runs Monday to Sunday and counts an activity if it is planned, or has run, on any day of it, using the actual start where there is one and the current planned dates otherwise. A started activity that has gone past its planned finish keeps counting up to today. “Activity-weeks” adds up each week’s count for a discipline. An idle gap is {GAP_WEEKS} or more empty weeks between two weeks in which the discipline has work, within the weeks shown, and is not checked for activities with no discipline. Counts are activities, not people: this page does not know crew sizes.
              {flow.truncated ? ` Only ${MAX_WEEKS} weeks are shown, starting ${formatDay(flow.weeks[0] as number)}; the rest of the programme is left out.` : ""}
              {flow.skipped > 0 ? ` ${flow.skipped} ${plural(flow.skipped, "activity has", "activities have")} no usable dates and ${plural(flow.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
