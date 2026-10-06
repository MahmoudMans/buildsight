"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectCommercial } from "@/lib/api";
import { MIN_SAMPLE, WINDOWS, daysText, rateText } from "@/lib/closureSpeed";
import { STREAMS, STREAM_LABEL, buildDecisions, decisionMarkdown, type Case, type Decisions, type StreamStats } from "@/lib/decisionTimes";
import { formatDay, money, plural, startOfToday, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { CommercialControl } from "@/types/project";

import styles from "./ProjectDecisionTimesView.module.css";

const PAGE = 10;
const DEFAULT_KEY = "365";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function rateClass(rate: number | null): string | undefined {
  if (rate === null) {
    return undefined;
  }

  return rate >= 0.85 ? styles.rateGood : rate >= 0.6 ? styles.rateWatch : styles.rateBad;
}

function Strip({ scaleMax, stats }: { scaleMax: number; stats: StreamStats }) {
  const dots = [
    ...stats.done.map((item) => ({ id: item.id, at: item.took as number, kind: item.due === null ? styles.dotNone : item.late > 0 ? styles.dotLate : styles.dotOk, text: `${item.reference}: ${item.took} ${plural(item.took as number, "day", "days")}${item.late > 0 ? `, ${item.late} late` : ""}` })),
    ...stats.pending.map((item) => ({ id: item.id, at: item.wait, kind: item.late > 0 ? styles.dotOverdue : styles.dotWaiting, text: `${item.reference}: waiting ${item.wait} ${plural(item.wait, "day", "days")}${item.late > 0 ? `, ${item.late} past due` : ""}` })),
  ].sort((a, b) => a.at - b.at);

  const percent = (value: number) => `${Math.min(100, Math.max(0, (value / scaleMax) * 100))}%`;

  return (
    <div>
      <div aria-label={`${stats.label}: ${stats.count} decided and ${stats.pendingCount} still waiting, plotted by days taken`} className={styles.strip} role="img">
        {stats.median !== null && <b className={styles.medianTick} style={{ left: percent(stats.median) }} title={`Typical: ${daysText(stats.median)}`} />}

        {dots.map((dot, index) => (
          <i className={cx(styles.dot, dot.kind)} key={dot.id} style={{ left: percent(dot.at), top: `${4 + (index % 3) * 10}px` }} title={dot.text} />
        ))}
      </div>

      <div className={styles.stripScale}>
        <span>0</span>
        <span>{Math.round(scaleMax / 2)} d</span>
        <span>{scaleMax} d</span>
      </div>
    </div>
  );
}

function Rows({ empty, items, kind }: { empty: string; items: Case[]; kind: "waiting" | "decided" }) {
  if (items.length === 0) {
    return <p className={styles.quiet}>{empty}</p>;
  }

  return (
    <ul className={styles.records}>
      {items.map((item) => (
        <li key={item.id}>
          <div className={styles.recTop}>
            <strong>{item.reference}</strong>
            <span>{trunc(item.title, 56)}</span>
            <em className={styles.tag}>{STREAM_LABEL[item.stream]}</em>
          </div>

          <div className={styles.recMeta}>
            <span className={styles.recDays}>{kind === "waiting" ? `waiting ${item.wait} ${plural(item.wait, "day", "days")}` : `${item.took ?? 0} ${plural(item.took ?? 0, "day", "days")} to decide`}</span>
            <span>{money(item.amount)}</span>
            {item.due !== null && <span>due {formatDay(item.due)}</span>}
            {item.late > 0 && <em className={styles.lateTag}>{kind === "waiting" ? `${item.late} d past due` : `${item.late} d late`}</em>}
            {kind === "decided" && item.end !== null && <span>decided {formatDay(item.end)}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProjectDecisionTimesView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<CommercialControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowKey, setWindowKey] = useState(DEFAULT_KEY);
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectCommercial(projectId)
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

  const windowDays = WINDOWS.find((item) => item.key === windowKey)?.days ?? null;
  const built = useMemo(() => (data ? buildDecisions(data, today, windowDays) : null), [data, today, windowDays]);
  const result: Decisions | null = built && built.ok ? built.decisions : null;
  const projectName = data?.project?.name ?? "Project";
  const windowText = (WINDOWS.find((item) => item.key === windowKey)?.label ?? "").toLowerCase();
  const span = windowDays === null ? "so far" : `in the last ${windowText}`;

  async function copySummary() {
    if (!result) {
      return;
    }

    const ok = await copyText(decisionMarkdown(result, projectName, today));

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

            <div className="eyebrow">DECISION TIMES</div>

            <h1>How long do decisions and payments take?</h1>

            <p className={styles.subtitle}>
              How quickly change orders and claims are decided, payment applications certified and certificates paid, how often that beats the due date, and what is still waiting on an answer today.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/commercial-board`}>
              Commercial board
            </Link>

            <Link className="secondary-link-button" href={`${base}/cash-position`}>
              Cash position
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the commercial records…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the commercial data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No change orders, claims or payment certificates have been recorded yet, so there is nothing to time.</div>
          </section>
        )}

        {state === "ready" && result && (
          <>
            <section aria-label="Decision times summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>STILL WAITING</div>
                <div className={styles.kpiValue}>{result.pendingCount}</div>
                <div className={styles.kpiSub}>{money(result.pendingValue)} waiting on an answer</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PAST DUE</div>
                <div className={cx(styles.kpiValue, result.overdueCount > 0 && styles.neg)}>{result.overdueCount}</div>
                <div className={styles.kpiSub}>{result.overdueCount > 0 ? `${money(result.overdueValue)} past its due date` : "nothing past its due date"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TYPICAL TURNAROUND</div>
                <div className={styles.kpiValue}>{daysText(result.median)}</div>
                <div className={styles.kpiSub}>{result.count === 0 ? `nothing decided ${span}` : `across ${result.count} decided ${span}`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DECIDED BY DUE DATE</div>
                <div className={cx(styles.kpiValue, rateClass(result.rate))}>{rateText(result.rate)}</div>
                <div className={styles.kpiSub}>{result.dated > 0 ? `of ${result.dated} with a due date` : "no decided item has a due date"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SLOWEST TO ANSWER</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>{result.slowestStream ? result.slowestStream.label : "—"}</div>
                <div className={styles.kpiSub}>{result.slowestStream ? `typically ${daysText(result.slowestStream.median)}` : `needs ${MIN_SAMPLE}+ decided in a stream`}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div aria-label="Decided within" className={styles.segmented} role="group">
                {WINDOWS.map((option) => (
                  <button
                    aria-pressed={windowKey === option.key}
                    className={cx(styles.segment, windowKey === option.key && styles.segmentOn)}
                    key={option.key}
                    onClick={() => {
                      setWindowKey(option.key);
                      setMessage(null);
                    }}
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

            <section aria-label="Turnaround by stream" className={styles.cards}>
              {result.streams.map((stats) => {
                const info = STREAMS.find((item) => item.key === stats.key);

                return (
                  <article className={styles.card} key={stats.key}>
                    <header className={styles.cardHead}>
                      <h3>{stats.label}</h3>
                      <span className={styles.flow}>
                        {info?.from} → {info?.to}
                      </span>
                    </header>

                    <div className={styles.cardValue}>{daysText(stats.median)}</div>
                    <div className={styles.cardSub}>{stats.count >= MIN_SAMPLE ? `typical, 9 in 10 within ${daysText(stats.p90)}` : stats.count === 0 ? `none ${info?.decided} ${span}` : `typical, but only ${stats.count} ${info?.decided} ${span}`}</div>

                    <div className={styles.cardRate}>
                      <span aria-hidden="true" className={styles.rateTrack}>
                        <i className={cx(styles.rateFill, rateClass(stats.rate))} style={{ width: `${Math.round((stats.rate ?? 0) * 100)}%` }} />
                      </span>
                      <span className={rateClass(stats.rate)}>{rateText(stats.rate)}</span>
                      <small className={styles.of}>{stats.dated > 0 ? `by the due date, ${stats.onTime} of ${stats.dated}` : "no due dates to compare"}</small>
                    </div>

                    <Strip scaleMax={result.scaleMax} stats={stats} />

                    <div className={styles.cardWait}>
                      {stats.pendingCount === 0 ? (
                        <span className={styles.muted}>Nothing {info?.waiting}.</span>
                      ) : (
                        <>
                          <span>
                            <strong>{stats.pendingCount}</strong> {info?.waiting}, {money(stats.waitingValue)}
                          </span>
                          {stats.overdueCount > 0 && <em className={styles.lateTag}>{stats.overdueCount} past due</em>}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </section>

            <ul className={styles.legend}>
              <li>
                <i className={cx(styles.swatchDot, styles.dotOk)} />
                Decided by the due date
              </li>
              <li>
                <i className={cx(styles.swatchDot, styles.dotLate)} />
                Decided late
              </li>
              <li>
                <i className={cx(styles.swatchDot, styles.dotNone)} />
                No due date
              </li>
              <li>
                <i className={cx(styles.swatchDot, styles.dotWaiting)} />
                Still waiting
              </li>
              <li>
                <i className={cx(styles.swatchDot, styles.dotOverdue)} />
                Waiting, past due
              </li>
              <li>
                <i className={styles.swatchTick} />
                Typical
              </li>
            </ul>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WAITING NOW</div>
                  <h2>Still waiting for an answer</h2>
                </div>

                <span className={styles.muted}>Most overdue first</span>
              </header>

              <Rows empty="Nothing is waiting on a decision, certification or payment." items={result.pending.slice(0, shown)} kind="waiting" />

              {result.pending.length > shown && (
                <div className={styles.more}>
                  <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                    Show {Math.min(PAGE, result.pending.length - shown)} more
                  </button>
                  <span className={styles.muted}>
                    {shown} of {result.pending.length} shown
                  </span>
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">SLOWEST</div>
                  <h2>The longest decisions {span}</h2>
                </div>

                <span className={styles.muted}>Calendar days from start to decision</span>
              </header>

              <Rows empty={`Nothing was decided ${span}.`} items={result.slowest} kind="decided" />
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY STREAM</div>
                  <h2>The figures side by side</h2>
                </div>

                <span className={styles.muted}>Decided {span}</span>
              </header>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Stream</th>
                      <th className={styles.num} scope="col">
                        Decided
                      </th>
                      <th className={styles.num} scope="col">
                        Typical
                      </th>
                      <th className={styles.num} scope="col">
                        9 in 10 within
                      </th>
                      <th scope="col">By the due date</th>
                      <th className={styles.num} scope="col">
                        Average days late
                      </th>
                      <th className={styles.num} scope="col">
                        Waiting
                      </th>
                      <th className={styles.num} scope="col">
                        Past due
                      </th>
                      <th className={styles.num} scope="col">
                        Value waiting
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {result.streams.map((stats) => (
                      <tr key={stats.key}>
                        <th scope="row">
                          <span className={styles.groupName}>{stats.label}</span>
                        </th>
                        <td className={styles.num}>{stats.count}</td>
                        <td className={styles.num}>{stats.count > 0 ? daysText(stats.median) : <span className={styles.missing}>—</span>}</td>
                        <td className={styles.num}>{stats.count > 0 ? daysText(stats.p90) : <span className={styles.missing}>—</span>}</td>
                        <td>
                          {stats.rate === null ? (
                            <span className={styles.missing}>—</span>
                          ) : (
                            <span className={styles.rateCell}>
                              <span aria-hidden="true" className={styles.rateTrack}>
                                <i className={cx(styles.rateFill, rateClass(stats.rate))} style={{ width: `${Math.round(stats.rate * 100)}%` }} />
                              </span>
                              <span className={rateClass(stats.rate)}>{rateText(stats.rate)}</span>
                              <small className={styles.of}>
                                {stats.onTime}/{stats.dated}
                              </small>
                            </span>
                          )}
                        </td>
                        <td className={styles.num}>{stats.avgLate === null ? <span className={styles.missing}>—</span> : daysText(stats.avgLate)}</td>
                        <td className={styles.num}>{stats.pendingCount}</td>
                        <td className={cx(styles.num, stats.overdueCount > 0 && styles.neg)}>{stats.overdueCount}</td>
                        <td className={styles.num}>{money(stats.waitingValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className={styles.scrollHint}>Swipe the table sideways for the rest of the columns.</p>
            </section>

            <p className={styles.note}>
              Turnaround runs in calendar days from the date an item was submitted (applied for, or certified, for the last two streams) to the date it was decided (certified, paid in full). “By the due date” means on or before the due date held in the system, and an item with no due date is left out of that rate. A certificate counts as paid in full when nothing is outstanding and it has a last payment date. Turnaround figures cover items decided in the period you pick, while the waiting figures are always as they stand today. Drafts, void items and rejected certificates are left out, and amounts are the figures claimed, submitted, applied for or still outstanding.
              {result.undated > 0 ? ` ${result.undated} ${plural(result.undated, "item is", "items are")} missing a date needed to time ${plural(result.undated, "it", "them")} and ${plural(result.undated, "was", "were")} left out.` : ""}
              {result.skipped > 0 ? ` ${result.skipped} ${plural(result.skipped, "item has", "items have")} no start date and ${plural(result.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
