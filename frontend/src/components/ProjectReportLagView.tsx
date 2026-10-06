"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProduction } from "@/lib/api";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { BATCH_MIN, BATCH_SPAN, BUCKETS, DEFAULT_WINDOW, LATE_AFTER, PAGE, WINDOWS, buildLag, daysText, lagMarkdown, lagText, lateList, medianText, pct, type BucketKey, type Lag, type Weekday } from "@/lib/reportLag";
import { copyText } from "@/lib/textExport";
import type { ProductionControl } from "@/types/project";

import styles from "./ProjectReportLagView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const SEGMENT: Record<BucketKey, string | undefined> = {
  same: styles.sSame,
  next: styles.sNext,
  few: styles.sFew,
  late: styles.sLate,
};

function Chart({ lag, today }: { lag: Lag; today: number }) {
  const top = Math.max(1, ...lag.weeks.map((week) => week.total));
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scroller.current;

    if (node) {
      node.scrollLeft = node.scrollWidth;
    }
  }, [lag.weeks.length]);

  return (
    <div className={styles.chartScroll} ref={scroller}>
      <div className={styles.chart}>
        {lag.weeks.map((week) => {
          const partial = week.from < lag.from || week.from + 6 > today;
          const parts = BUCKETS.filter((bucket) => week.counts[bucket.key] > 0).map((bucket) => `${week.counts[bucket.key]} ${bucket.label.toLowerCase()}`);

          if (week.drafts > 0) {
            parts.push(`${week.drafts} still draft`);
          }

          return (
            <div
              className={styles.col}
              key={week.from}
              title={`Week commencing ${formatDay(week.from)}${partial ? " (part of a week inside this period)" : ""}: ${week.total} ${plural(week.total, "report", "reports")}${parts.length > 0 ? `, ${parts.join(", ")}` : ""}.`}
            >
              <span className={styles.colValue}>{week.total > 0 ? week.total : ""}</span>

              <span className={styles.colTrack}>
                <span className={styles.stack}>
                  {week.drafts > 0 && <i className={styles.sDraft} style={{ height: `${(week.drafts / top) * 100}%` }} />}
                  {BUCKETS.slice()
                    .reverse()
                    .map((bucket) => (week.counts[bucket.key] > 0 ? <i className={SEGMENT[bucket.key]} key={bucket.key} style={{ height: `${(week.counts[bucket.key] / top) * 100}%` }} /> : null))}
                </span>
              </span>

              <span className={styles.colLabel}>{formatDay(week.from).slice(0, 6).trim()}</span>
              <span className={styles.colSub}>{partial ? "part week" : " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayRow({ row }: { row: Weekday }) {
  return (
    <li className={styles.dayRow}>
      <strong>{row.label}</strong>

      <span
        aria-label={`${row.label}: ${BUCKETS.map((bucket) => `${row.counts[bucket.key]} ${bucket.label.toLowerCase()}`).join(", ")}`}
        className={styles.mini}
        role="img"
      >
        {BUCKETS.map((bucket) => (row.counts[bucket.key] > 0 ? <i className={SEGMENT[bucket.key]} key={bucket.key} style={{ flexGrow: row.counts[bucket.key] }} title={`${row.counts[bucket.key]} ${bucket.label.toLowerCase()}`} /> : null))}
      </span>

      <span>
        {row.count} {plural(row.count, "report", "reports")}
        <small>median {medianText(row.median).toLowerCase()}</small>
      </span>
    </li>
  );
}

function More({ total, shown, onMore }: { total: number; shown: number; onMore: () => void }) {
  if (total <= shown) {
    return null;
  }

  return (
    <div className={styles.more}>
      <button className={styles.moreButton} onClick={onMore} type="button">
        Show {Math.min(PAGE, total - shown)} more
      </button>
      <span className={styles.muted}>
        {shown} of {total} shown
      </span>
    </div>
  );
}

export function ProjectReportLagView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ProductionControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [lateShown, setLateShown] = useState(PAGE);
  const [draftShown, setDraftShown] = useState(PAGE);
  const [batchShown, setBatchShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectProduction(projectId)
      .then((value) => {
        if (!cancelled) {
          setData(value);
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

  const built = useMemo(() => (data ? buildLag(data, today, windowDays) : null), [data, today, windowDays]);
  const lag = built && built.ok ? built.lag : null;
  const projectName = data?.project?.name ?? "Project";
  const late = useMemo(() => (lag ? lateList(lag) : []), [lag]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const days = lag ? lag.weekdays.filter((row) => row.count > 0) : [];
  const ranked = days.filter((row) => row.count >= 3 && row.median !== null);
  const slowest = ranked.length >= 2 ? [...ranked].sort((a, b) => (b.median as number) - (a.median as number) || b.late - a.late)[0] : undefined;
  const quickest = ranked.length >= 2 ? [...ranked].sort((a, b) => (a.median as number) - (b.median as number) || a.late - b.late)[0] : undefined;
  const dayHint = slowest && quickest && slowest.index !== quickest.index && (slowest.median as number) > (quickest.median as number) ? `${slowest.label} reports are the slowest to be written up (median ${medianText(slowest.median).toLowerCase()}) and ${quickest.label} reports the quickest (median ${medianText(quickest.median).toLowerCase()}).` : null;

  async function copySummary() {
    if (!lag) {
      return;
    }

    const ok = await copyText(lagMarkdown(lag, projectName, today, windowLabel));

    setMessage(ok ? "Copied the filing lag as Markdown." : "Could not copy the filing lag.");
  }

  function pickWindow(value: number) {
    setWindowDays(value);
    setLateShown(PAGE);
    setBatchShown(PAGE);
    setMessage(null);
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

            <div className="eyebrow">REPORT FILING LAG</div>

            <h1>How long after the day are site reports written up?</h1>

            <p className={styles.subtitle}>
              A site report is only as useful as it is fresh. The gap between the day a report covers and the day its record was created shows whether the diary is kept as the work happens or written up days later from memory, when the detail has faded.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/production-board`}>
              Production board
            </Link>

            <Link className="secondary-link-button" href={`${base}/labour-reconciliation`}>
              Labour reconciliation
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the site reports…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the site reports. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No site reports have been recorded yet, so there is no filing lag to measure.</div>
          </section>
        )}

        {state === "ready" && lag && (
          <>
            <section aria-label="Report filing lag summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>REPORTS FILED</div>
                <div className={styles.kpiValue}>{lag.filed.length}</div>
                <div className={styles.kpiSub}>
                  dated in the last {windowLabel}
                  {lag.windowDrafts > 0 ? `, ${lag.windowDrafts} more still draft` : ""}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MEDIAN LAG</div>
                <div className={cx(styles.kpiValue, lag.median !== null && lag.median > LATE_AFTER && styles.neg)}>{medianText(lag.median)}</div>
                <div className={styles.kpiSub}>{lag.filed.length > 0 ? `longest ${daysText(lag.longest)}` : "no reports filed in this period"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SAME DAY</div>
                <div className={styles.kpiValue}>{pct(lag.sameShare)}</div>
                <div className={styles.kpiSub}>{lag.filed.length > 0 ? `${lag.same} of ${lag.filed.length} created on the day they cover` : "no reports filed in this period"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FILED LATE</div>
                <div className={cx(styles.kpiValue, lag.lateShare !== null && lag.lateShare > 0.25 && styles.neg)}>{lag.late}</div>
                <div className={styles.kpiSub}>{lag.lateShare === null ? "no reports filed in this period" : `${pct(lag.lateShare)} created more than ${LATE_AFTER} days after`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DRAFTS OPEN</div>
                <div className={cx(styles.kpiValue, lag.staleDrafts > 0 && styles.neg)}>{lag.drafts.length}</div>
                <div className={styles.kpiSub}>{lag.oldestDraft !== null ? `oldest is ${daysText(lag.oldestDraft)} old` : "every report is filed"}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Period</span>

                <div aria-label="Period measured" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button aria-pressed={windowDays === option.days} className={cx(styles.segment, windowDays === option.days && styles.segmentOn)} key={option.days} onClick={() => pickWindow(option.days)} type="button">
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

            {lag.staleDrafts > 0 && (
              <p className={styles.caution} role="note">
                {lag.staleDrafts} draft {plural(lag.staleDrafts, "report is", "reports are")} more than {LATE_AFTER} days old and still not filed, so {plural(lag.staleDrafts, "its", "their")} labour and progress are missing from everything that reads site reports.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WEEK BY WEEK</div>
                  <h2>How late each week&rsquo;s reports were written up</h2>
                </div>

                <span className={styles.muted}>
                  {formatDay(lag.from)} to {formatDay(lag.to)}
                </span>
              </header>

              {lag.filed.length === 0 && lag.windowDrafts === 0 ? <p className={styles.quiet}>No site reports are dated in this period.</p> : <Chart lag={lag} today={today} />}

              <ul className={styles.legend}>
                {BUCKETS.map((bucket) => (
                  <li key={bucket.key}>
                    <i className={cx(styles.swatch, SEGMENT[bucket.key])} />
                    {bucket.label} ({lag.counts[bucket.key]})
                  </li>
                ))}
                <li>
                  <i className={cx(styles.swatch, styles.sDraftKey)} />
                  Still a draft ({lag.windowDrafts})
                </li>
              </ul>
            </section>

            {days.length > 0 && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY DAY OF THE WEEK</div>
                    <h2>Which days get written up late</h2>
                  </div>

                  <span className={styles.muted}>by the day the report covers</span>
                </header>

                <ul className={styles.days}>
                  {days.map((row) => (
                    <DayRow key={row.index} row={row} />
                  ))}
                </ul>

                {dayHint && <p className={styles.hint}>{dayHint}</p>}
              </section>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">STILL A DRAFT</div>
                  <h2>Reports that have not been filed</h2>
                </div>

                <span className={styles.muted}>
                  {lag.drafts.length} {plural(lag.drafts.length, "draft", "drafts")}, oldest first, any date
                </span>
              </header>

              {lag.drafts.length === 0 ? (
                <p className={styles.quiet}>Every site report has been filed.</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {lag.drafts.slice(0, draftShown).map((item) => (
                      <li className={styles.item} key={item.id}>
                        <span className={styles.what}>
                          <strong>{trunc(item.reference || "Report", 40)}</strong>
                          <small>
                            Report dated {formatDay(item.reportDate)}, {Math.round(item.labour)} labour hours, {item.entries} {plural(item.entries, "entry", "entries")}
                          </small>
                        </span>

                        <span className={styles.verdict}>
                          <em className={cx(styles.chip, item.age > LATE_AFTER ? styles.chipBad : styles.chipWatch)}>{item.age === 0 ? "Today" : `${daysText(item.age)} old`}</em>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <More onMore={() => setDraftShown((current) => current + PAGE)} shown={draftShown} total={lag.drafts.length} />
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WRITTEN UP LATE</div>
                  <h2>Reports created more than {LATE_AFTER} days after their date</h2>
                </div>

                <span className={styles.muted}>
                  {late.length} of {lag.filed.length} filed, slowest first
                </span>
              </header>

              {late.length === 0 ? (
                <p className={styles.quiet}>{lag.filed.length === 0 ? "No reports were filed for this period." : `Every report in this period was created within ${LATE_AFTER} days of its date.`}</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {late.slice(0, lateShown).map((item) => (
                      <li className={styles.item} key={item.id}>
                        <span className={styles.what}>
                          <strong>{trunc(item.reference || "Report", 40)}</strong>
                          <small>
                            Report dated {formatDay(item.reportDate)}, created {formatDay(item.createdDay)}
                          </small>
                        </span>

                        <span className={styles.verdict}>
                          <em className={cx(styles.chip, item.lag >= 7 ? styles.chipBad : styles.chipWatch)}>{lagText(item.lag)}</em>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <More onMore={() => setLateShown((current) => current + PAGE)} shown={lateShown} total={late.length} />
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WRITTEN UP IN ONE GO</div>
                  <h2>Days when several days of reports were created together</h2>
                </div>

                <span className={styles.muted}>
                  {lag.batches.length} {plural(lag.batches.length, "day", "days")}
                </span>
              </header>

              {lag.batches.length === 0 ? (
                <p className={styles.quiet}>
                  No day in this period has {BATCH_MIN} or more reports created together covering {BATCH_SPAN} or more different dates.
                </p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {lag.batches.slice(0, batchShown).map((item) => (
                      <li className={styles.item} key={item.day}>
                        <span className={styles.what}>
                          <strong>{formatDay(item.day)}</strong>
                          <small>
                            {item.count} reports created, covering {formatDay(item.firstDate)} to {formatDay(item.lastDate)} ({item.dates} different dates)
                          </small>
                        </span>

                        <span className={styles.verdict}>
                          <em className={cx(styles.chip, item.maxLag > LATE_AFTER ? styles.chipBad : styles.chipWatch)}>Up to {daysText(item.maxLag)} behind</em>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <More onMore={() => setBatchShown((current) => current + PAGE)} shown={batchShown} total={lag.batches.length} />
                </>
              )}
            </section>

            <p className={styles.note}>
              Lag is the number of days from the date a site report covers to the day its record was created in the system. It is not the time taken to submit or approve the report, so a report opened on the day and completed later still counts as same day, and reports entered in bulk show the day they were entered. Draft reports are not counted as filed and are listed separately whatever their date. A report is late when it was created more than {LATE_AFTER} days after its date. A day of batch filing is one on which {BATCH_MIN} or more reports were created covering {BATCH_SPAN} or more different dates. Weeks run Monday to Sunday, and the first and last may cover only part of a week.
              {lag.future > 0 ? ` ${lag.future} ${plural(lag.future, "report is", "reports are")} dated in the future and ${plural(lag.future, "is", "are")} left out.` : ""}
              {lag.skipped > 0 ? ` ${lag.skipped} ${plural(lag.skipped, "report has", "reports have")} no usable date and ${plural(lag.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
