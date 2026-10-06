"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { BINS, DEFAULT_WINDOW, MIN_SAMPLE, WINDOWS, buildClosureSpeed, closureMarkdown, daysText, rateText, trendText, windowLabel, type ClosureSpeed, type Rec, type StreamStats } from "@/lib/closureSpeed";
import type { StreamKey } from "@/lib/backlog";
import { MODULE_LABEL, MODULE_PATH, formatDay, loadSources, plural, projectOf, startOfToday, trunc, type Sources } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";

import styles from "./ProjectClosureSpeedView.module.css";

const SOURCE_COUNT = 9;

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function rateClass(rate: number | null): string | undefined {
  if (rate === null) {
    return undefined;
  }

  return rate >= 0.85 ? styles.rateGood : rate >= 0.6 ? styles.rateWatch : styles.rateBad;
}

function RangeBar({ row, scale }: { row: StreamStats; scale: number }) {
  if (row.median === null || row.p90 === null) {
    return <span className={styles.missing}>—</span>;
  }

  const median = Math.min(100, (row.median / scale) * 100);
  const spread = Math.min(100, (row.p90 / scale) * 100);

  return (
    <span aria-hidden="true" className={styles.range}>
      <i className={styles.rangeSpread} style={{ width: `${Math.max(spread, 3)}%` }} />
      <i className={styles.rangeMedian} style={{ width: `${Math.max(median, 2)}%` }} />
    </span>
  );
}

function Distribution({ row }: { row: StreamStats }) {
  const peak = Math.max(1, ...row.bins);
  const total = row.bins.reduce((sum, value) => sum + value, 0);
  const slot = (value: number | null) => (value === null ? -1 : BINS.findIndex((bin) => value <= bin.max));
  const medianSlot = slot(row.median);
  const tailSlot = slot(row.p90);

  return (
    <div className={styles.histo} role="img" aria-label={`Closing times for ${row.label}: ${row.bins.map((count, index) => `${count} within ${BINS[index]?.label} days`).join(", ")}`}>
      {BINS.map((bin, index) => {
        const count = row.bins[index] ?? 0;

        return (
          <div className={styles.histoCol} key={bin.label}>
            <span className={styles.histoCount}>{count > 0 ? count : ""}</span>

            <span className={styles.histoTrack}>
              <i
                className={cx(styles.histoBar, index === medianSlot && styles.histoMedian, index > tailSlot && tailSlot >= 0 && styles.histoTail)}
                style={{ height: `${count === 0 ? 0 : Math.max(4, (count / peak) * 100)}%`, "--bar": row.color } as CSSProperties}
                title={`${count} of ${total} closed in ${bin.label} days`}
              />
            </span>

            <span className={styles.histoLabel}>{bin.label}</span>

            <span className={styles.histoMark}>{index === medianSlot ? "typical" : index === tailSlot && tailSlot !== medianSlot ? "9 in 10" : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

function Months({ row, mode }: { row: StreamStats; mode: "median" | "onTime" }) {
  const values = row.months.map((month) => (mode === "median" ? month.median : month.onTime));
  const peak = mode === "median" ? Math.max(1, ...values.map((value) => value ?? 0)) : 1;

  return (
    <div className={styles.months} role="img" aria-label={`${mode === "median" ? "Median days to close" : "Share closed on time"} by month for ${row.label}`}>
      {row.months.map((month, index) => {
        const value = values[index] ?? null;

        return (
          <div className={styles.monthCol} key={`${month.label}-${index}`}>
            <span className={styles.monthValue}>{value === null ? "" : mode === "median" ? daysText(value).replace(" d", "") : `${Math.round(value * 100)}`}</span>

            <span className={styles.monthTrack}>
              <i
                className={cx(styles.monthBar, mode === "onTime" && rateClass(value) === styles.rateBad && styles.barBad, mode === "onTime" && rateClass(value) === styles.rateWatch && styles.barWatch)}
                style={{ height: value === null ? "0%" : `${Math.max(4, (value / peak) * 100)}%`, "--bar": row.color } as CSSProperties}
                title={value === null ? `${month.label}: nothing closed${mode === "onTime" ? " with a due date" : ""}` : `${month.label}: ${mode === "median" ? daysText(value) : `${Math.round(value * 100)}% on time`}, ${month.closed} closed`}
              />
            </span>

            <span className={styles.monthLabel}>{month.label}</span>

            <span className={styles.monthCount}>{month.closed > 0 ? `n=${month.closed}` : ""}</span>
          </div>
        );
      })}
    </div>
  );
}

function Records({ empty, items, kind, now }: { empty: string; items: Array<Rec & { took?: number }>; kind: "closed" | "open"; now: number }) {
  if (items.length === 0) {
    return <p className={styles.quiet}>{empty}</p>;
  }

  return (
    <ul className={styles.records}>
      {items.map((item) => {
        const age = kind === "closed" ? (item.took ?? 0) : now - item.raised;
        const late = item.due !== null && (kind === "open" ? item.due < now : (item.closed ?? 0) > item.due);

        return (
          <li key={item.id}>
            <div className={styles.recTop}>
              <strong>{item.reference}</strong>
              <span>{trunc(item.title, 52)}</span>
            </div>

            <div className={styles.recMeta}>
              <span className={styles.recDays}>
                {age} {plural(age, "day", "days")}
              </span>
              <span>{item.owner ?? "No owner"}</span>
              <span>raised {formatDay(item.raised)}</span>
              {late && item.due !== null && <em className={styles.lateTag}>{kind === "open" ? `due ${formatDay(item.due)}` : `${(item.closed ?? 0) - item.due} d late`}</em>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ProjectClosureSpeedView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [windowKey, setWindowKey] = useState(DEFAULT_WINDOW);
  const [picked, setPicked] = useState<StreamKey | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    loadSources(projectId).then((result) => {
      if (cancelled) {
        return;
      }

      setSources(result.sources);
      setFailed(result.failed);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const windowDays = WINDOWS.find((item) => item.key === windowKey)?.days ?? null;
  const result: ClosureSpeed | null = useMemo(() => (sources ? buildClosureSpeed(sources, failed, today, windowDays) : null), [sources, failed, today, windowDays]);
  const project = sources ? projectOf(sources) : null;
  const projectName = project?.name ?? "Project";

  const loaded = sources !== null && result !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;
  const needed = failed.filter((key) => key === "quality" || key === "documents" || key === "safety" || key === "governance");
  const live = result ? result.streams.filter((row) => row.available) : [];
  const empty = loaded && !failedAll && live.every((row) => row.closed === 0 && row.openNow === 0);
  const active = live.find((row) => row.key === picked) ?? (result?.slowest ? live.find((row) => row.key === result.slowest?.key) : undefined) ?? [...live].sort((a, b) => b.closed - a.closed)[0] ?? null;
  const scale = Math.max(1, ...live.map((row) => row.p90 ?? 0));
  const label = windowLabel(windowDays).toLowerCase();
  const span = windowDays === null ? "so far" : `in the last ${label}`;

  function choose(key: StreamKey) {
    setPicked(key);
    setMessage(null);
  }

  async function copySummary() {
    if (!result) {
      return;
    }

    const ok = await copyText(closureMarkdown(result, projectName, today));

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

            <div className="eyebrow">CLOSURE SPEED</div>

            <h1>How fast do we close things?</h1>

            <p className={styles.subtitle}>
              Snags, non-conformances, RFIs, safety observations, safety actions and meeting actions, timed from the day each was raised to the day it was closed. See the typical time, how often the due date is kept and what has been waiting longer than usual.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/backlog`}>
              Backlog trend
            </Link>

            <Link className="secondary-link-button" href={`${base}/workload`}>
              Who is carrying what
            </Link>
          </div>
        </header>

        {!loaded && <div className={styles.loading}>Timing the closed items…</div>}

        {failedAll && (
          <div className="offline-banner">
            <div>
              <strong>Could not load any project data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {loaded && !failedAll && needed.length > 0 && (
          <div className="offline-banner">
            <div>
              <strong>Could not load {needed.map((key) => MODULE_LABEL[key].toLowerCase()).join(", ")}.</strong>
              <span> Streams that come from {needed.length > 1 ? "them" : "it"} are left out.</span>
            </div>
          </div>
        )}

        {empty && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>There are no open or closed items to time yet.</div>
          </section>
        )}

        {loaded && !failedAll && result && !empty && active && (
          <>
            <section aria-label="Closure summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>CLOSED</div>
                <div className={styles.kpiValue}>{result.closed}</div>
                <div className={styles.kpiSub}>{result.windowDays === null ? "to date" : span}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TYPICAL TIME</div>
                <div className={styles.kpiValue}>{daysText(result.median)}</div>
                <div className={styles.kpiSub}>raised to closed, median</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ON TIME</div>
                <div className={cx(styles.kpiValue, result.onTimeRate !== null && result.onTimeRate >= 0.85 && styles.pos, result.onTimeRate !== null && result.onTimeRate < 0.6 && styles.neg)}>{rateText(result.onTimeRate)}</div>
                <div className={styles.kpiSub}>{result.dated > 0 ? `of ${result.dated} with a due date` : "no due dates on file"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PAST DUE NOW</div>
                <div className={cx(styles.kpiValue, result.overdueNow > 0 && styles.neg)}>{result.overdueNow}</div>
                <div className={styles.kpiSub}>of {result.openNow} still open</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SLOWEST STREAM</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>{result.slowest ? result.slowest.label : "—"}</div>
                <div className={styles.kpiSub}>{result.slowest ? `${daysText(result.slowest.median)} typically` : "needs two streams with closures"}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div aria-label="Closed within" className={styles.segmented} role="group">
                {WINDOWS.map((option) => (
                  <button
                    aria-pressed={windowKey === option.key}
                    className={cx(styles.segment, windowKey === option.key && styles.segmentOn)}
                    key={option.key}
                    onClick={() => setWindowKey(option.key)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
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
                  <div className="eyebrow">BY STREAM</div>
                  <h2>Which kinds of item take longest</h2>
                </div>

                <span className={styles.muted}>{result.windowDays === null ? "Everything closed to date" : `Closed ${span}`}</span>
              </header>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Stream</th>
                      <th className={styles.num} scope="col">
                        Closed
                      </th>
                      <th className={styles.num} scope="col">
                        Typical
                      </th>
                      <th className={styles.num} scope="col">
                        9 in 10 within
                      </th>
                      <th scope="col">Spread</th>
                      <th scope="col">On time</th>
                      <th className={styles.num} scope="col">
                        Late by
                      </th>
                      <th className={styles.num} scope="col">
                        Past due now
                      </th>
                      <th scope="col">Pace</th>
                    </tr>
                  </thead>

                  <tbody>
                    {result.streams.map((row) => (
                      <tr className={cx(row.key === active.key && styles.rowOn)} key={row.key}>
                        <th scope="row">
                          <button aria-pressed={row.key === active.key} className={styles.rowButton} disabled={!row.available} onClick={() => choose(row.key)} type="button">
                            <span aria-hidden="true" className={styles.dot} style={{ "--dot": row.color } as CSSProperties} />
                            {row.label}
                          </button>
                        </th>

                        {row.available ? (
                          <>
                            <td className={styles.num}>{row.closed}</td>
                            <td className={styles.num}>
                              <strong>{daysText(row.median)}</strong>
                            </td>
                            <td className={styles.num}>{daysText(row.p90)}</td>
                            <td>
                              <RangeBar row={row} scale={scale} />
                            </td>
                            <td>
                              {row.onTimeRate === null ? (
                                <span className={styles.missing}>—</span>
                              ) : (
                                <span className={styles.rateCell}>
                                  <span aria-hidden="true" className={styles.rateTrack}>
                                    <i className={cx(styles.rateFill, rateClass(row.onTimeRate))} style={{ width: `${Math.round(row.onTimeRate * 100)}%` }} />
                                  </span>
                                  <span className={rateClass(row.onTimeRate)}>{rateText(row.onTimeRate)}</span>
                                </span>
                              )}
                            </td>
                            <td className={styles.num}>{daysText(row.avgLate)}</td>
                            <td className={cx(styles.num, row.overdueNow > 0 && styles.neg)}>
                              {row.overdueNow}
                              <small className={styles.of}> / {row.openNow}</small>
                            </td>
                            <td>
                              <span className={cx(styles.pace, row.trend === "slower" && styles.paceBad, row.trend === "faster" && styles.paceGood)}>{trendText(row.trend)}</span>
                            </td>
                          </>
                        ) : (
                          <td className={styles.missing} colSpan={8}>
                            Not loaded
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className={styles.scrollHint}>Swipe the table sideways for the rest of the columns.</p>

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.swatchMedian)} />
                  Typical (median) time
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchSpread)} />
                  Up to the time 9 in 10 were done by
                </li>
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">CLOSE UP</div>
                  <h2>
                    <span aria-hidden="true" className={styles.dot} style={{ "--dot": active.color } as CSSProperties} /> {active.label}
                  </h2>
                </div>

                <Link className={styles.moduleLink} href={`${base}/${MODULE_PATH[active.module]}`}>
                  Open {MODULE_LABEL[active.module].toLowerCase()}
                </Link>
              </header>

              {active.closed < MIN_SAMPLE ? (
                <div className={styles.emptySmall}>
                  {active.closed === 0
                    ? `${windowDays === null ? "Nothing has been closed yet" : `Nothing was closed ${span}`}, so there is no closing time to show.`
                    : `Only ${active.closed} ${plural(active.closed, "item has", "items have")} been closed ${windowDays === null ? "so far" : span}, too few to draw a pattern.`}
                </div>
              ) : (
                <div className={styles.twoCol}>
                  <div>
                    <h3 className={styles.subhead}>How long closing took</h3>
                    <Distribution row={active} />
                    <p className={styles.hint}>
                      Days from raised to closed. Half were done within {daysText(active.median)} and 9 in 10 within {daysText(active.p90)}. The quickest took {daysText(active.fastest)} and the slowest {daysText(active.slowest)}.
                    </p>
                  </div>

                  <div>
                    <h3 className={styles.subhead}>Month by month (median days)</h3>
                    <Months mode="median" row={active} />

                    <h3 className={cx(styles.subhead, styles.subheadGap)}>Month by month (% closed on time)</h3>
                    <Months mode="onTime" row={active} />
                  </div>
                </div>
              )}

              <div className={cx(styles.twoCol, styles.lists)}>
                <div>
                  <h3 className={styles.subhead}>Slowest to close</h3>
                  <Records empty={windowDays === null ? "Nothing has been closed yet." : `Nothing closed ${span}.`} items={active.slowestClosed} kind="closed" now={today} />
                </div>

                <div>
                  <h3 className={styles.subhead}>
                    Open longer than usual{active.stuckCount > 0 ? ` (${active.stuckCount})` : ""}
                  </h3>

                  <Records
                    empty={active.closed < MIN_SAMPLE ? "Needs a few closed items to know what usual looks like." : "Nothing open has waited longer than 9 in 10 closed items took."}
                    items={active.stuck}
                    kind="open"
                    now={today}
                  />

                  {active.stuckCount > active.stuck.length && <p className={styles.quiet}>and {active.stuckCount - active.stuck.length} more, oldest first above.</p>}
                </div>
              </div>
            </section>

            <p className={styles.note}>
              Time to close runs from the day an item was raised (observed, for observations; created, for safety and meeting actions) to the day it was closed, answered or completed, counted in calendar days. Items are counted in the period in which they were closed, and voided records are ignored.
              “On time” means closed on or before the item’s own due date. “Open longer than usual” lists items still open that are older than 9 in 10 closed items took in the same period, and needs at least {MIN_SAMPLE} closed items to judge.
              {result.undated > 0 ? ` ${result.undated} closed ${plural(result.undated, "item has", "items have")} no closing date and ${plural(result.undated, "was", "were")} left out.` : ""}
              {result.skipped > 0 ? ` ${result.skipped} ${plural(result.skipped, "record was", "records were")} left out for a missing or future date.` : ""} Pace compares the typical time in the later half of the period with the earlier half.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
