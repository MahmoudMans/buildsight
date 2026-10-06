"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import {
  PERCENTILES,
  SPREADS,
  WIDEN_FACTOR,
  chanceBy,
  dayAtConfidence,
  failMessage,
  simulate,
  sourceLabel,
  summaryMarkdown,
  type Spread,
} from "@/lib/finishSimulation";
import { formatDay, isoDay, plural, toDay, words } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { ScheduleControl } from "@/types/project";

import styles from "./ProjectFinishSimulationView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function percent(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const rounded = Math.round(value * 100);

  return rounded === 0 && value > 0 ? "<1%" : rounded === 100 && value < 1 ? ">99%" : `${rounded}%`;
}

function signed(days: number): string {
  return days === 0 ? "same day" : `${days > 0 ? "+" : "−"}${Math.abs(days)} ${plural(Math.abs(days), "day", "days")}`;
}

function shortDate(day: number): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC", year: "2-digit" }).format(new Date(day * 86_400_000)).replace(/ (\d\d)$/, " ’$1");
}

function pull(value: number): string {
  const size = Math.abs(value);

  return size >= 0.5 ? "Strong" : size >= 0.25 ? "Moderate" : size >= 0.1 ? "Slight" : "None";
}

export function ProjectFinishSimulationView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [spread, setSpread] = useState<Spread>("normal");
  const [widen, setWiden] = useState(true);
  const [seed, setSeed] = useState(1);
  const [probe, setProbe] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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
          setState("failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const result = useMemo(() => (data ? simulate(data, { spread, widen, seed }) : null), [data, spread, widen, seed]);
  const spreadInfo = SPREADS.find((item) => item.key === spread) ?? (SPREADS[1] as (typeof SPREADS)[number]);
  const projectName = data?.project?.name ?? "Project";

  const view = useMemo(() => {
    if (!result || !result.ok) {
      return null;
    }

    const first = result.bins[0]?.from ?? 0;
    const last = result.bins[result.bins.length - 1]?.to ?? 1;
    const span = Math.max(1, last - first);
    const top = Math.max(1, ...result.bins.map((bin) => bin.count));
    const place = (day: number) => Math.min(100, Math.max(0, ((day - result.anchor - first) / span) * 100));
    const hasTarget = Number.isFinite(result.target);

    const marks = [
      { key: "forecast", label: sourceLabel(result.anchorSource), day: result.anchor, className: styles.markForecast },
      ...(hasTarget ? [{ key: "plan", label: result.targetSource === "baseline" ? "Baseline finish" : "Planned finish", day: result.target, className: styles.markPlan }] : []),
      { key: "p50", label: "50% likely", day: dayAtConfidence(result, 50), className: styles.markMedian },
      { key: "p80", label: "80% likely", day: dayAtConfidence(result, 80), className: styles.markSafe },
    ];

    const ticks = Array.from({ length: 5 }, (_, index) => {
      const offset = first + (span * index) / 4;

      return { x: (index / 4) * 100, day: result.anchor + Math.round(offset) };
    });

    return { first, last, span, top, place, marks, ticks, hasTarget };
  }, [result]);

  const probeDay = result && result.ok ? toDay(probe !== "" ? probe : isoDay(result.target)) : NaN;

  async function copySummary() {
    if (!result || !result.ok) {
      return;
    }

    const ok = await copyText(summaryMarkdown(result, projectName, spreadInfo.label));

    setMessage(ok ? "Copied the summary as Markdown." : "Could not copy the summary.");
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

            <div className="eyebrow">SCHEDULE RISK</div>

            <h1>How sure is the finish date?</h1>

            <p className={styles.subtitle}>
              A single forecast date hides how much the remaining work can vary. This replays the schedule logic thousands of times with
              slightly different activity durations to show the dates you can promise with real confidence.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/lookahead`}>
              Lookahead board
            </Link>

            <Link className="secondary-link-button" href={`${base}/milestone-board`}>
              Milestone board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Loading the schedule…</div>}

        {state === "failed" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the schedule. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {result && !result.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{failMessage(result)}</div>
          </section>
        )}

        {result && result.ok && view && (
          <>
            <section aria-label="Simulation controls" className={cx(styles.panel, styles.controlsPanel)}>
              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>How much can durations vary?</span>

                <div aria-label="Duration spread" className={styles.segmented} role="group">
                  {SPREADS.map((option) => (
                    <button
                      aria-pressed={spread === option.key}
                      className={cx(styles.segment, spread === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => setSpread(option.key)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <span className={styles.controlHint}>
                  Each remaining duration runs from {Math.round(spreadInfo.faster * 100)}% shorter to {Math.round(spreadInfo.slower * 100)}% longer than planned, most often as planned.
                </span>
              </div>

              <label className={styles.check}>
                <input checked={widen} onChange={(event) => setWiden(event.target.checked)} type="checkbox" />
                <span>
                  Widen the range for risky activities
                  <small>
                    Open constraints or overdue: {WIDEN_FACTOR}× the upper range
                    {widen ? ` (${result.widened} ${plural(result.widened, "activity", "activities")})` : ""}
                  </small>
                </span>
              </label>

              <div className={styles.controlGroup}>
                <label className={styles.controlLabel} htmlFor="probe-date">
                  Chance of finishing by
                </label>

                <div className={styles.probe}>
                  <input id="probe-date" onChange={(event) => setProbe(event.target.value)} type="date" value={probe !== "" ? probe : isoDay(result.target)} />

                  <strong className={styles.probeValue}>{percent(chanceBy(result, probeDay))}</strong>
                </div>

                {probe !== "" && (
                  <button className={styles.linkButton} onClick={() => setProbe("")} type="button">
                    Back to planned finish
                  </button>
                )}
              </div>

              <div className={styles.controlActions}>
                <button className={styles.actionButton} onClick={() => setSeed((value) => value + 1)} type="button">
                  Run again
                </button>

                <button className={styles.linkButton} onClick={copySummary} type="button">
                  Copy summary
                </button>
              </div>

              {message && (
                <p className={styles.statusLine} role="status">
                  {message}
                </p>
              )}
            </section>

            <section aria-label="Finish dates" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>FORECAST</div>
                <div className={styles.kpiValue}>{shortDate(result.anchor)}</div>
                <div className={styles.kpiSub}>
                  {percent(chanceBy(result, result.anchor))} chance · {sourceLabel(result.anchorSource).toLowerCase()}
                </div>
              </article>

              {[50, 80, 90].map((level) => {
                const day = dayAtConfidence(result, level);

                return (
                  <article className={styles.kpi} key={level}>
                    <div className={styles.kpiLabel}>{level}% LIKELY BY</div>
                    <div className={styles.kpiValue}>{shortDate(day)}</div>
                    <div className={styles.kpiSub}>{signed(day - result.anchor)} vs forecast</div>
                  </article>
                );
              })}

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CHANCE OF PLAN</div>
                <div className={cx(styles.kpiValue, view.hasTarget && chanceBy(result, result.target) >= 0.7 && styles.pos, view.hasTarget && chanceBy(result, result.target) < 0.3 && styles.neg)}>
                  {view.hasTarget ? percent(chanceBy(result, result.target)) : "—"}
                </div>
                <div className={styles.kpiSub}>{view.hasTarget ? `by ${shortDate(result.target)}` : "no planned finish date"}</div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">THE SPREAD</div>
                  <h2>Where the finish is likely to land</h2>
                </div>

                <span className={styles.muted}>{result.runs.toLocaleString("en-GB")} simulated outcomes</span>
              </header>

              <ul className={styles.legend}>
                {view.hasTarget && (
                  <>
                    <li>
                      <span className={cx(styles.swatch, styles.binOk)} />
                      On or before the planned finish
                    </li>
                    <li>
                      <span className={cx(styles.swatch, styles.binLate)} />
                      After it
                    </li>
                  </>
                )}

                {view.marks.map((mark) => (
                  <li key={mark.key}>
                    <span className={cx(styles.line, mark.className)} />
                    {mark.label} · {shortDate(mark.day)}
                  </li>
                ))}
              </ul>

              <div className={styles.chart}>
                <div aria-label="Distribution of simulated finish dates" className={styles.bins} role="img">
                  {result.bins.map((bin) => {
                    const lastDay = result.anchor + bin.to - 1;
                    const early = view.hasTarget && lastDay <= result.target;

                    return (
                      <span
                        className={cx(styles.bin, view.hasTarget ? (early ? styles.binOk : styles.binLate) : styles.binPlain)}
                        key={bin.from}
                        style={{ height: `${Math.max(bin.count > 0 ? 2 : 0, (bin.count / view.top) * 100)}%` }}
                        title={`${shortDate(result.anchor + bin.from)}${bin.to - bin.from > 1 ? ` to ${shortDate(lastDay)}` : ""}: ${percent(bin.count / result.runs)} of outcomes`}
                      />
                    );
                  })}

                  {view.marks.map((mark) => (
                    <span className={cx(styles.marker, mark.className)} key={mark.key} style={{ left: `${view.place(mark.day)}%` }} />
                  ))}
                </div>

                <div aria-hidden="true" className={styles.axis}>
                  {view.ticks.map((tick) => (
                    <span key={tick.x} style={{ left: `${tick.x}%` }}>
                      {shortDate(tick.day)}
                    </span>
                  ))}
                </div>
              </div>

              <p className={styles.hint}>Taller bars are finish dates that came up more often. The first and last bars include the rare extremes.</p>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">CONFIDENCE</div>
                  <h2>Which date can you promise?</h2>
                </div>
              </header>

              <div className={styles.tableWrap}>
                <table className={cx(styles.table, styles.small)}>
                  <thead>
                    <tr>
                      <th>Confidence</th>
                      <th>Finish by</th>
                      <th className={styles.num}>Vs forecast</th>
                      {view.hasTarget && <th className={styles.num}>Vs plan</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {PERCENTILES.map((level) => {
                      const day = dayAtConfidence(result, level);

                      return (
                        <tr className={level === 80 ? styles.highlight : undefined} key={level}>
                          <td>{level}%</td>
                          <td>{formatDay(day)}</td>
                          <td className={styles.num}>{signed(day - result.anchor)}</td>
                          {view.hasTarget && <td className={cx(styles.num, day > result.target && styles.lateText)}>{signed(day - result.target)}</td>}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className={styles.hint}>
                {view.hasTarget
                  ? `Planning to the planned finish gives a ${percent(chanceBy(result, result.target))} chance. At 80% confidence the project finishes ${signed(dayAtConfidence(result, 80) - result.target)} against it.`
                  : "Pick the confidence you are comfortable promising, then read the date next to it."}
              </p>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WHAT DRIVES THE FINISH</div>
                  <h2>Activities worth protecting</h2>
                </div>

                <span className={styles.muted}>
                  {result.live} unfinished · {result.links} {plural(result.links, "link", "links")}
                </span>
              </header>

              {result.drivers.length === 0 ? (
                <div className={styles.emptySmall}>No single activity sits on the longest path often enough to stand out.</div>
              ) : (
                <>
                  <p className={styles.hint}>
                    “Longest path” is the share of outcomes where the activity decided the finish date. “Pull” shows how closely its own
                    duration moves the finish.
                  </p>

                  <div className={styles.tableWrap}>
                    <table className={cx(styles.table, styles.small)}>
                      <thead>
                        <tr>
                          <th>Activity</th>
                          <th>Longest path</th>
                          <th className={styles.hideSmall}>Pull</th>
                          <th className={styles.num}>Duration</th>
                          <th className={cx(styles.num, styles.hideSmall)}>Float</th>
                        </tr>
                      </thead>

                      <tbody>
                        {result.drivers.map((driver) => (
                          <tr key={driver.id}>
                            <td className={styles.wrapCell}>
                              <strong>{driver.code}</strong> {driver.name}
                              <span className={styles.rowTags}>
                                {words(driver.status)}
                                {driver.constraints > 0 && ` · ${driver.constraints} open ${plural(driver.constraints, "constraint", "constraints")}`}
                                {driver.widened && " · wider range"}
                              </span>
                            </td>

                            <td>
                              <span className={styles.pathCell}>
                                <span aria-hidden="true" className={styles.pathTrack}>
                                  <span className={styles.pathFill} style={{ width: `${Math.round(driver.criticality * 100)}%` }} />
                                </span>
                                {percent(driver.criticality)}
                              </span>
                            </td>

                            <td className={styles.hideSmall}>{pull(driver.sensitivity)}</td>

                            <td className={styles.num}>
                              {Math.round(driver.days)} d
                              <span className={styles.rowTags}>
                                {Math.round(driver.fastest)}–{Math.round(driver.slowest)} d
                              </span>
                            </td>

                            <td className={cx(styles.num, styles.hideSmall)}>{Number.isFinite(driver.float) ? `${driver.float} d` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <p className={styles.note}>
              Each run draws a new duration for every unfinished activity, most likely the remaining duration on the schedule, then follows the
              logic links, planned start dates and lags to find when the last activity ends. Completed work is fixed. Because delays pass down
              the chain while savings often do not, the middle outcome usually lands later than a forecast built from single durations.
              The result shows how the dates spread around the {sourceLabel(result.anchorSource).toLowerCase()}. It does not replace it.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
