"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import { MIN_SAMPLE, WINDOWS, DEFAULT_WINDOW, daysText, rateText } from "@/lib/closureSpeed";
import {
  GROUPS,
  OPEN_FILTERS,
  buildConstraintLog,
  constraintMarkdown,
  filterOpen,
  typeLabel,
  type ConstraintLog,
  type GroupBy,
  type Item,
  type OpenFilter,
} from "@/lib/constraintLog";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { ScheduleControl } from "@/types/project";

import styles from "./ProjectConstraintLogView.module.css";

const PAGE = 10;

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function rateClass(rate: number | null): string | undefined {
  if (rate === null) {
    return undefined;
  }

  return rate >= 0.85 ? styles.rateGood : rate >= 0.6 ? styles.rateWatch : styles.rateBad;
}

function AgeBars({ log }: { log: ConstraintLog }) {
  const peak = Math.max(1, ...log.bins.map((bin) => bin.count));

  return (
    <div className={styles.histo} role="img" aria-label={`Open constraints by days since they were logged: ${log.bins.map((bin) => `${bin.count} at ${bin.label} days, ${bin.overdue} of them past due`).join("; ")}`}>
      {log.bins.map((bin) => (
        <div className={styles.histoCol} key={bin.label}>
          <span className={styles.histoCount}>{bin.count > 0 ? bin.count : ""}</span>

          <span className={styles.histoTrack}>
            <span className={styles.stack} style={{ height: `${bin.count === 0 ? 0 : Math.max(4, (bin.count / peak) * 100)}%` }} title={`${bin.count} open, ${bin.overdue} past due`}>
              <i className={styles.stackLate} style={{ flexGrow: bin.overdue }} />
              <i className={styles.stackOk} style={{ flexGrow: bin.count - bin.overdue }} />
            </span>
          </span>

          <span className={styles.histoLabel}>{bin.label}</span>
        </div>
      ))}
    </div>
  );
}

function Rows({ empty, items, kind }: { empty: string; items: Item[]; kind: "open" | "cleared" }) {
  if (items.length === 0) {
    return <p className={styles.quiet}>{empty}</p>;
  }

  return (
    <ul className={styles.records}>
      {items.map((item) => (
        <li key={item.id}>
          <div className={styles.recTop}>
            <strong>{item.code}</strong>
            <span>{trunc(item.title, 56)}</span>
            {item.critical && <em className={styles.critTag}>critical</em>}
            {!item.critical && item.nearCritical && <em className={styles.nearTag}>near critical</em>}
          </div>

          <div className={styles.recMeta}>
            <span className={styles.recDays}>{kind === "open" ? `${item.age} ${plural(item.age, "day", "days")} open` : `${item.took ?? 0} ${plural(item.took ?? 0, "day", "days")} to clear`}</span>
            <span>{typeLabel(item.type)}</span>
            <span>{item.owner ?? "No owner"}</span>
            {item.activity !== "" && <span>{trunc(item.activity, 34)}</span>}
            {kind === "open" && item.due !== null && <span>due {formatDay(item.due)}</span>}
            {kind === "open" && item.daysLate > 0 && <em className={styles.lateTag}>{item.daysLate} d past due</em>}
            {kind === "cleared" && item.daysLate > 0 && <em className={styles.lateTag}>{item.daysLate} d late</em>}
            {kind === "cleared" && item.resolved !== null && <span>cleared {formatDay(item.resolved)}</span>}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProjectConstraintLogView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowKey, setWindowKey] = useState(DEFAULT_WINDOW);
  const [groupBy, setGroupBy] = useState<GroupBy>("type");
  const [filter, setFilter] = useState<OpenFilter>("all");
  const [shown, setShown] = useState(PAGE);
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

  const windowDays = WINDOWS.find((item) => item.key === windowKey)?.days ?? null;
  const built = useMemo(() => (data ? buildConstraintLog(data, today, windowDays, groupBy) : null), [data, today, windowDays, groupBy]);
  const log: ConstraintLog | null = built && built.ok ? built.log : null;
  const rows = useMemo(() => (log ? filterOpen(log.open, filter) : []), [log, filter]);
  const projectName = data?.project?.name ?? "Project";
  const windowText = (WINDOWS.find((item) => item.key === windowKey)?.label ?? "").toLowerCase();
  const span = windowDays === null ? "so far" : `in the last ${windowText}`;

  function choose<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setShown(PAGE);
    setMessage(null);
  }

  async function copySummary() {
    if (!log) {
      return;
    }

    const ok = await copyText(constraintMarkdown(log, groupBy, projectName, today));

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

            <div className="eyebrow">CONSTRAINT LOG</div>

            <h1>How fast do constraints get cleared?</h1>

            <p className={styles.subtitle}>
              Every constraint logged against the schedule: what is still open and for how long, which ones sit on critical work, and how quickly each kind and each owner has cleared them in the past.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/start-readiness`}>
              Start readiness
            </Link>

            <Link className="secondary-link-button" href={`${base}/lookahead`}>
              Look-ahead
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the constraint log…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the schedule. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "empty" ? "No constraints have been logged against the schedule yet." : "None of the constraints has a usable logged date."}</div>
          </section>
        )}

        {state === "ready" && log && (
          <>
            <section aria-label="Constraint summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OPEN NOW</div>
                <div className={styles.kpiValue}>{log.openCount}</div>
                <div className={styles.kpiSub}>{log.overdueCount} past their due date</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ON CRITICAL WORK</div>
                <div className={cx(styles.kpiValue, log.onCritical > 0 && styles.neg)}>{log.onCritical}</div>
                <div className={styles.kpiSub}>open, on critical or near-critical activities</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TYPICAL TO CLEAR</div>
                <div className={styles.kpiValue}>{daysText(log.median)}</div>
                <div className={styles.kpiSub}>{log.cleared >= MIN_SAMPLE ? `9 in 10 within ${daysText(log.p90)}` : log.cleared === 0 ? `none cleared ${span}` : `only ${log.cleared} cleared ${span}`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CLEARED ON TIME</div>
                <div className={cx(styles.kpiValue, rateClass(log.rate))}>{rateText(log.rate)}</div>
                <div className={styles.kpiSub}>{log.dated > 0 ? `of ${log.dated} cleared ${span}` : "no cleared constraints with a due date"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OLDEST OPEN</div>
                <div className={cx(styles.kpiValue, log.oldest && log.oldest.age > 60 && styles.neg)}>{log.oldest ? `${log.oldest.age} d` : "—"}</div>
                <div className={styles.kpiSub}>{log.oldest ? `${log.oldest.code}, ${trunc(log.oldest.title, 30)}` : "nothing is open"}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.controlGroup}>
                <div aria-label="Cleared within" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button aria-pressed={windowKey === option.key} className={cx(styles.segment, windowKey === option.key && styles.segmentOn)} key={option.key} onClick={() => choose(setWindowKey, option.key)} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>

                <div aria-label="Group by" className={styles.segmented} role="group">
                  {GROUPS.map((option) => (
                    <button aria-pressed={groupBy === option.key} className={cx(styles.segment, groupBy === option.key && styles.segmentOn)} key={option.key} onClick={() => choose(setGroupBy, option.key)} type="button">
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
                  <div className="eyebrow">WAITING TIME</div>
                  <h2>How long the open ones have been open</h2>
                </div>

                <span className={styles.muted}>Days since each was logged</span>
              </header>

              {log.openCount === 0 ? (
                <div className={styles.emptySmall}>Nothing is open, so there is nothing waiting.</div>
              ) : (
                <>
                  <AgeBars log={log} />

                  <ul className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchLate)} />
                      Past its due date
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchOk)} />
                      Not yet due
                    </li>
                  </ul>
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">{groupBy === "type" ? "BY KIND" : "BY OWNER"}</div>
                  <h2>{groupBy === "type" ? "Which kinds of constraint linger" : "Who is holding what"}</h2>
                </div>

                <span className={styles.muted}>{log.windowDays === null ? "Cleared to date" : `Cleared ${span}`}</span>
              </header>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">{groupBy === "type" ? "Kind" : "Owner"}</th>
                      <th className={styles.num} scope="col">
                        Open
                      </th>
                      <th className={styles.num} scope="col">
                        Past due
                      </th>
                      <th className={styles.num} scope="col">
                        On critical work
                      </th>
                      <th className={styles.num} scope="col">
                        Oldest open
                      </th>
                      <th className={styles.num} scope="col">
                        Cleared
                      </th>
                      <th className={styles.num} scope="col">
                        Typical to clear
                      </th>
                      <th scope="col">Cleared on time</th>
                    </tr>
                  </thead>

                  <tbody>
                    {log.groups.map((group) => (
                      <tr key={group.key}>
                        <th scope="row">
                          <span className={styles.groupName}>{group.name}</span>
                        </th>
                        <td className={styles.num}>{group.open}</td>
                        <td className={cx(styles.num, group.overdue > 0 && styles.neg)}>{group.overdue}</td>
                        <td className={cx(styles.num, group.onCritical > 0 && styles.neg)}>{group.onCritical}</td>
                        <td className={styles.num}>{group.oldest === null ? <span className={styles.missing}>—</span> : `${group.oldest} d`}</td>
                        <td className={styles.num}>{group.cleared}</td>
                        <td className={styles.num}>{group.cleared >= 1 ? daysText(group.median) : <span className={styles.missing}>—</span>}</td>
                        <td>
                          {group.rate === null ? (
                            <span className={styles.missing}>—</span>
                          ) : (
                            <span className={styles.rateCell}>
                              <span aria-hidden="true" className={styles.rateTrack}>
                                <i className={cx(styles.rateFill, rateClass(group.rate))} style={{ width: `${Math.round(group.rate * 100)}%` }} />
                              </span>
                              <span className={rateClass(group.rate)}>{rateText(group.rate)}</span>
                              <small className={styles.of}>
                                {group.onTime}/{group.dated}
                              </small>
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className={styles.scrollHint}>Swipe the table sideways for the rest of the columns.</p>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">OPEN</div>
                  <h2>Constraints still in the way</h2>
                </div>

                <div aria-label="Show open constraints" className={styles.segmented} role="group">
                  {OPEN_FILTERS.map((option) => (
                    <button aria-pressed={filter === option.key} className={cx(styles.segment, filter === option.key && styles.segmentOn)} key={option.key} onClick={() => choose(setFilter, option.key)} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>
              </header>

              <Rows empty={filter === "late" ? "Nothing open is past its due date." : filter === "critical" ? "No open constraint sits on a critical or near-critical activity." : "Nothing is open."} items={rows.slice(0, shown)} kind="open" />

              {rows.length > shown && (
                <div className={styles.more}>
                  <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                    Show {Math.min(PAGE, rows.length - shown)} more
                  </button>
                  <span className={styles.muted}>
                    {shown} of {rows.length} shown, most overdue first
                  </span>
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">CLEARED</div>
                  <h2>Slowest to clear</h2>
                </div>

                <span className={styles.muted}>{log.windowDays === null ? "Cleared to date" : `Cleared ${span}`}</span>
              </header>

              <Rows empty={log.windowDays === null ? "Nothing has been cleared yet." : `Nothing was cleared ${span}.`} items={log.slowest} kind="cleared" />
            </section>

            <p className={styles.note}>
              Age runs from the day a constraint was logged. Clearing time runs from logged to resolved, in calendar days, and a constraint counts as cleared on time when it was resolved on or before its due date. Clearing figures cover constraints resolved in the period you pick, while open figures are always as they stand today. Waived constraints ({log.waived}) are not counted as cleared. “Critical work” means the constraint’s activity is flagged critical or near-critical in the schedule.
              {log.undated > 0 ? ` ${log.undated} resolved ${plural(log.undated, "constraint has", "constraints have")} no resolved date and ${plural(log.undated, "was", "were")} left out of the clearing figures.` : ""}
              {log.skipped > 0 ? ` ${log.skipped} ${plural(log.skipped, "constraint has", "constraints have")} no logged date and ${plural(log.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
