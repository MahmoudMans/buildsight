"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectResources } from "@/lib/api";
import { DEFAULT_WINDOW, FILTERS, LONG_DAY, PAGE, RECENT, RUN_HIGH, RUN_WATCH, STATUS_LABEL, VERY_LONG_DAY, WINDOWS, buildFatigue, daysText, fatigueMarkdown, filterTrades, perText, reasonText, type Band, type Fatigue, type Filter, type Status, type Trade } from "@/lib/fatigue";
import { formatDay, plural, startOfToday } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { ResourceControl } from "@/types/project";

import styles from "./ProjectFatigueWatchView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const BAND_CLASS: Record<Band, string | undefined> = {
  none: undefined,
  normal: styles.cellNormal,
  long: styles.cellLong,
  veryLong: styles.cellVeryLong,
};

function statusClass(status: Status): string | undefined {
  return status === "high" ? styles.chipBad : status === "watch" ? styles.chipWatch : status === "ok" ? styles.chipGood : styles.chipPlain;
}

function cellTitle(trade: string, cell: Trade["cells"][number]): string {
  if (cell.band === "none") {
    return `${trade}, ${formatDay(cell.day)}: no labour logged`;
  }

  const per = cell.hoursPer === null ? "no headcount logged" : `${cell.hoursPer.toFixed(1)} h a worker`;
  const run = cell.runPos >= RUN_WATCH ? `, day ${cell.runPos} in a row` : "";

  return `${trade}, ${formatDay(cell.day)}: ${Math.round(cell.hours * 10) / 10} h from ${cell.workers} ${plural(cell.workers, "worker", "workers")}, ${per}${run}`;
}

function Sheet({ fatigue, trades }: { fatigue: Fatigue; trades: Trade[] }) {
  const count = fatigue.windowDays;
  const template = `repeat(${count}, minmax(9px, 1fr))`;
  const first = trades[0];
  const heads = first ? first.cells : [];

  return (
    <div className={styles.sheetWrap}>
      <div className={styles.sheet} style={{ "--sheet-min": `${200 + 190 + 32 + count * 11}px`, "--cells-min": `${count * 11}px` } as CSSProperties}>
        <div aria-hidden="true" className={cx(styles.sheetRow, styles.sheetHead)}>
          <span />

          <div className={styles.cells} style={{ gridTemplateColumns: template }}>
            {heads.map((cell) => (
              <span className={styles.tick} key={cell.day}>
                {cell.monday && <span>{formatDay(cell.day).slice(0, 6).trim()}</span>}
              </span>
            ))}
          </div>

          <span />
        </div>

        {trades.map((trade) => (
          <div className={cx(styles.sheetRow, styles.sheetBody)} key={trade.name}>
            <div className={styles.who}>
              <strong>{trade.name}</strong>
              <em className={cx(styles.chip, statusClass(trade.status))}>{STATUS_LABEL[trade.status]}</em>
              <small>
                {trade.avgPer === null ? "No headcount logged" : `${perText(trade.avgPer)} a worker on an average day`}
                {trade.overtimeShare !== null && `, ${Math.round(trade.overtimeShare * 100)}% overtime`}
              </small>
            </div>

            <div aria-label={`${trade.name}: ${reasonText(trade)}`} className={styles.cells} role="img" style={{ gridTemplateColumns: template }}>
              {trade.cells.map((cell) => (
                <i className={cx(styles.cell, cell.band === "none" && cell.weekend && styles.cellWeekend, BAND_CLASS[cell.band], cell.runPos >= RUN_WATCH && styles.cellRun)} key={cell.day} title={cellTitle(trade.name, cell)} />
              ))}
            </div>

            <div className={styles.sum}>
              <span className={styles.sumNow}>
                {trade.status === "off" ? <strong>Off site</strong> : <strong>{trade.currentRun > 0 ? `${daysText(trade.currentRun)} in a row` : "Rested"}</strong>}
              </span>
              <small>{trade.status === "off" && trade.lastDay !== null ? `last logged ${formatDay(trade.lastDay)}` : `longest run ${daysText(trade.longestRun)}`}</small>
              <small>
                {trade.longDays} {plural(trade.longDays, "day", "days")} over {LONG_DAY} h
              </small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectFatigueWatchView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ResourceControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [filter, setFilter] = useState<Filter>("all");
  const [shownDays, setShownDays] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectResources(projectId)
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

  const built = useMemo(() => (data ? buildFatigue(data, today, windowDays) : null), [data, today, windowDays]);
  const fatigue = built && built.ok ? built.fatigue : null;
  const trades = useMemo(() => (fatigue ? filterTrades(fatigue.trades, filter) : []), [fatigue, filter]);
  const projectName = data?.project?.name ?? "Project";
  const windowText = WINDOWS.find((item) => item.days === windowDays)?.label ?? `${windowDays} days`;

  async function copySummary() {
    if (!fatigue) {
      return;
    }

    const ok = await copyText(fatigueMarkdown(fatigue, trades, projectName, today));

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

            <div className="eyebrow">FATIGUE WATCH</div>

            <h1>Which crews are working too long without a break?</h1>

            <p className={styles.subtitle}>
              Hours per worker per day and the number of days in a row each trade has been on site, from the labour logs. Long days and runs with no rest day are where mistakes and injuries pile up.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/safety-rates`}>
              Safety rates
            </Link>

            <Link className="secondary-link-button" href={`${base}/resource-heatmap`}>
              Resource heatmap
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the labour logs…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the resource data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No labour hours are logged yet, so there is nothing to check for long days or missing rest days.</div>
          </section>
        )}

        {state === "ready" && fatigue && (
          <>
            <section aria-label="Fatigue summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>NEED ATTENTION</div>
                <div className={styles.kpiValue}>
                  {fatigue.attention} of {fatigue.onSite}
                </div>
                <div className={styles.kpiSub}>{fatigue.onSite === 0 ? "no trade logged hours in the last week" : `${plural(fatigue.onSite, "trade", "trades")} on site, flagged high or watch`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LONGEST RUN NOW</div>
                <div className={cx(styles.kpiValue, fatigue.longestCurrent !== null && fatigue.longestCurrent.length >= RUN_WATCH && styles.neg)}>{fatigue.longestCurrent ? daysText(fatigue.longestCurrent.length) : "None"}</div>
                <div className={styles.kpiSub}>{fatigue.longestCurrent ? `${fatigue.longestCurrent.trade}, with no rest day` : "no trade is working through"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LONG DAYS</div>
                <div className={cx(styles.kpiValue, fatigue.longCount > 0 && styles.neg)}>{fatigue.longCount}</div>
                <div className={styles.kpiSub}>
                  trade days over {LONG_DAY} h a worker, {fatigue.veryLongCount} over {VERY_LONG_DAY} h
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AVERAGE DAY</div>
                <div className={styles.kpiValue}>{perText(fatigue.avgPer)}</div>
                <div className={styles.kpiSub}>
                  a worker, across {fatigue.workDays} trade {plural(fatigue.workDays, "day", "days")}
                </div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Look back</span>

                <div aria-label="Period shown" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={windowDays === option.days}
                      className={cx(styles.segment, windowDays === option.days && styles.segmentOn)}
                      key={option.days}
                      onClick={() => {
                        setWindowDays(option.days);
                        setShownDays(PAGE);
                        setMessage(null);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.controlLabel}>Show</span>

                <div aria-label="Which trades to show" className={styles.segmented} role="group">
                  {FILTERS.map((option) => (
                    <button
                      aria-pressed={filter === option.key}
                      className={cx(styles.segment, filter === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setFilter(option.key);
                        setMessage(null);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.actions}>
                <button className={styles.linkButton} onClick={copySummary} type="button">
                  Copy as Markdown
                </button>
              </div>
            </section>

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            {today - fatigue.latest > 3 && (
              <div className="offline-banner">
                <div>
                  <strong>The latest labour log is from {formatDay(fatigue.latest)}, so the last few days may be missing and runs may look shorter than they are.</strong>
                </div>
              </div>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">DAY BY DAY</div>
                  <h2>Every day on site, by trade</h2>
                </div>

                <span className={styles.muted}>
                  {formatDay(fatigue.from)} to {formatDay(fatigue.to)}
                </span>
              </header>

              {trades.length === 0 ? (
                <p className={styles.quiet}>No trade needs attention in the last {windowText}. Switch to all trades to see every crew.</p>
              ) : (
                <Sheet fatigue={fatigue} trades={trades} />
              )}

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.swatchNone)} />
                  No labour logged
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchNormal)} />
                  Up to {LONG_DAY} h a worker
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchLong)} />
                  {LONG_DAY} to {VERY_LONG_DAY} h
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchVeryLong)} />
                  Over {VERY_LONG_DAY} h
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchRun)} />
                  Day {RUN_WATCH} or later in a row
                </li>
              </ul>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">NO REST DAY</div>
                    <h2>Runs of {RUN_WATCH} days or more</h2>
                  </div>

                  <span className={styles.muted}>{fatigue.runs.length}</span>
                </header>

                {fatigue.runs.length === 0 ? (
                  <p className={styles.quiet}>No trade worked {RUN_WATCH} days or more in a row in this period.</p>
                ) : (
                  <ul className={styles.listRows}>
                    {fatigue.runs.slice(0, 12).map((run) => (
                      <li className={styles.listRow} key={`${run.trade}-${run.from}`}>
                        <span>
                          <strong>{run.trade}</strong>
                          <small>{run.workers > 0 ? `${(run.hours / run.workers).toFixed(1)} h a worker on average` : "no headcount logged"}</small>
                        </span>

                        <span>
                          {formatDay(run.from)} to {formatDay(run.to)}
                          <small>{run.current ? (run.length >= RUN_HIGH ? "still going, high" : "still going") : "ended"}</small>
                        </span>

                        <span className={styles.listNum}>{daysText(run.length)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">LONG DAYS</div>
                    <h2>Over {LONG_DAY} hours a worker</h2>
                  </div>

                  <span className={styles.muted}>{fatigue.longDays.length}</span>
                </header>

                {fatigue.longDays.length === 0 ? (
                  <p className={styles.quiet}>No trade averaged more than {LONG_DAY} hours a worker on any day in this period.</p>
                ) : (
                  <>
                    <ul className={styles.listRows}>
                      {fatigue.longDays.slice(0, shownDays).map((item) => (
                        <li className={styles.listRow} key={`${item.trade}-${item.day}`}>
                          <span>
                            <strong>{item.trade}</strong>
                            <small>
                              {item.workers} {plural(item.workers, "worker", "workers")}, {Math.round(item.hours * 10) / 10} h
                            </small>
                          </span>

                          <span>
                            {formatDay(item.day)}
                            {item.veryLong && <small>over {VERY_LONG_DAY} hours</small>}
                          </span>

                          <span className={styles.listNum}>{perText(item.hoursPer)}</span>
                        </li>
                      ))}
                    </ul>

                    {fatigue.longDays.length > shownDays && (
                      <div className={styles.more}>
                        <button className={styles.moreButton} onClick={() => setShownDays((current) => current + PAGE)} type="button">
                          Show {Math.min(PAGE, fatigue.longDays.length - shownDays)} more
                        </button>
                        <span className={styles.muted}>
                          {shownDays} of {fatigue.longDays.length} shown
                        </span>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>

            <p className={styles.note}>
              Hours a worker is the labour hours logged for a trade on a day divided by the workers logged, a crew average that hides a few people working much longer than the rest; where a trade has several records on a day they are added together, so a crew split across work packages can look shorter than it really worked. A day is long above {LONG_DAY} hours and very long above {VERY_LONG_DAY}. A run is consecutive calendar days with labour logged for the trade; a day with nothing logged counts as a rest day, so a missing log makes runs look shorter. A trade is high when its current run reaches {RUN_HIGH} days or it had a very long day in the last {RECENT} days, and watch when the run reaches {RUN_WATCH} days or it had a long day in the last {RECENT} days; one that went over the limits earlier in the period but not in the last week is marked earlier, and one with no labour in the last {RECENT} days is off site. Overtime is the share of logged hours booked as overtime. The figures cover {formatDay(fatigue.from)} to {formatDay(fatigue.to)}.
              {fatigue.noHeadcount > 0 ? ` ${fatigue.noHeadcount} ${plural(fatigue.noHeadcount, "record has", "records have")} hours but no headcount, so ${plural(fatigue.noHeadcount, "it counts", "they count")} as a day worked without a length.` : ""}
              {fatigue.skipped > 0 ? ` ${fatigue.skipped} labour ${plural(fatigue.skipped, "record has", "records have")} no usable date and ${plural(fatigue.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
