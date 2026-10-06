"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import { formatDay, plural, startOfToday } from "@/lib/openItems";
import { holdText, type Kind } from "@/lib/startReadiness";
import { DEFAULT_WEEKS, HORIZONS, PHASE_LABEL, STALE_DAYS, buildSheet, daysLateText, floatText, readyLabel, shortDay, sheetMarkdown, tradeTitle, weekRange, type Row, type Sheet } from "@/lib/tradeSheet";
import { copyText } from "@/lib/textExport";
import type { ScheduleControl } from "@/types/project";

import styles from "./ProjectTradeSheetView.module.css";

const ALL = "__all";

const PRINT_RULES = "@media print{.sidebar{display:none!important}.app-shell{display:block!important}.main{margin:0!important;max-width:none!important;padding:0!important}}";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function chipTone(kind: Kind | null): string | undefined {
  if (kind === "ready") {
    return styles.chipReady;
  }

  return kind === "hold" ? styles.chipHold : styles.chipWait;
}

function SheetRow({ checked, onToggle, row, showTrade }: { checked: boolean; onToggle: (key: string) => void; row: Row; showTrade: boolean }) {
  const label = readyLabel(row);
  const late = daysLateText(row);
  const float = floatText(row);
  const bad = row.phase === "overrun" || row.phase === "lateStart";

  return (
    <li className={cx(styles.row, checked && styles.rowTicked)}>
      <input aria-label={`Committed: ${row.code} ${row.name}`} checked={checked} className={styles.tick} onChange={() => onToggle(row.key)} type="checkbox" />

      <div className={styles.main}>
        <div className={styles.title}>
          <strong>{row.code}</strong>
          <span>{row.name}</span>
        </div>

        <div className={styles.tags}>
          {row.critical && <em className={styles.critTag}>Critical</em>}
          {!row.critical && row.nearCritical && <em className={styles.nearTag}>Near critical</em>}
          {showTrade && <em className={styles.tradeTag}>{row.discipline}</em>}
        </div>
      </div>

      <div className={styles.plan}>
        <span>
          {shortDay(row.start)} → {shortDay(row.finish)}
        </span>
        {float && <small>{float}</small>}
      </div>

      <div className={styles.done}>
        <span aria-hidden="true" className={styles.bar}>
          <i style={{ width: `${row.progress}%` }} />
        </span>
        <span>{row.progress}%</span>
      </div>

      <div className={styles.stage}>
        <strong className={cx(styles.phase, bad && styles.phaseBad)}>{PHASE_LABEL[row.phase]}</strong>
        {late && <small className={styles.lateText}>{late}</small>}
        {label && <em className={cx(styles.chip, chipTone(row.kind))}>{label}</em>}
      </div>

      <div className={styles.notes}>
        {row.blockers.length + row.holds.length === 0 ? (
          <span className={styles.none}>{row.first && row.kind === "ready" ? "Nothing stops it starting" : ""}</span>
        ) : (
          <ul>
            {row.blockers.map((text, index) => (
              <li key={`b${index}`}>{text}</li>
            ))}

            {row.holds.map((hold) => (
              <li className={hold.overdue ? styles.overdue : undefined} key={hold.id}>
                {holdText(hold)}
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function ProjectTradeSheetView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [trade, setTrade] = useState(ALL);
  const [weeks, setWeeks] = useState(DEFAULT_WEEKS);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set<string>());
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

  const built = useMemo(() => (data ? buildSheet(data, today, weeks, trade === ALL ? null : trade) : null), [data, today, weeks, trade]);
  const sheet: Sheet | null = built && built.ok ? built.sheet : null;
  const projectName = data?.project?.name ?? "Project";
  const weeksText = HORIZONS.find((item) => item.weeks === weeks)?.label ?? `${weeks} weeks`;

  const options = useMemo(() => {
    if (!sheet) {
      return [];
    }

    const list = sheet.trades.map((item) => ({ name: item.name, count: item.activities }));

    return trade !== ALL && !list.some((item) => item.name === trade) ? [...list, { name: trade, count: 0 }] : list;
  }, [sheet, trade]);

  function toggle(key: string) {
    setTicked((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
    setMessage(null);
  }

  async function copySheet() {
    if (!sheet) {
      return;
    }

    const ok = await copyText(sheetMarkdown(sheet, projectName, today, ticked));

    setMessage(ok ? "Copied the sheet as Markdown." : "Could not copy the sheet.");
  }

  const visibleTicks = sheet ? sheet.weeks.reduce((sum, week) => sum + week.rows.filter((row) => ticked.has(row.key)).length, 0) : 0;

  return (
    <div className="app-shell">
      <style>{PRINT_RULES}</style>

      <BuildSightSidebar />

      <main className="main">
        <header className={cx(styles.header, styles.noPrint)}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">TRADE SHEET</div>

            <h1>Weekly work sheet for each trade</h1>

            <p className={styles.subtitle}>
              A printable plan for one trade at a time: the work planned or under way over the coming weeks, whether each start is clear to go, and what is still holding it up.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/start-readiness`}>
              Start readiness
            </Link>

            <Link className="secondary-link-button" href={`${base}/trade-flow`}>
              Trade flow
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={cx(styles.loading, styles.noPrint)}>Reading the schedule…</div>}

        {state === "error" && (
          <div className={cx("offline-banner", styles.noPrint)}>
            <div>
              <strong>Could not load the schedule. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "empty" ? "The schedule has no activities yet, so there is no work to plan." : "The schedule's activities have no usable dates, so there is no work to plan."}</div>
          </section>
        )}

        {state === "ready" && sheet && (
          <>
            <section aria-label="Trade sheet summary" className={cx(styles.kpis, styles.noPrint)}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>ON THE SHEET</div>
                <div className={styles.kpiValue}>{sheet.activities}</div>
                <div className={styles.kpiSub}>
                  planned or under way in {weeksText}, {sheet.starting} yet to start
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>READY TO START</div>
                <div className={cx(styles.kpiValue, sheet.ready > 0 && styles.pos)}>{sheet.ready}</div>
                <div className={styles.kpiSub}>of {sheet.starting} yet to start</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NOT READY</div>
                <div className={cx(styles.kpiValue, sheet.notReady > 0 && styles.neg)}>{sheet.notReady}</div>
                <div className={styles.kpiSub}>{sheet.notReady > 0 ? "waiting on work, a constraint or a hold" : "nothing recorded in the way"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SHOULD HAVE STARTED</div>
                <div className={cx(styles.kpiValue, sheet.lateStarts > 0 && styles.neg)}>{sheet.lateStarts}</div>
                <div className={styles.kpiSub}>{sheet.overruns > 0 ? `plus ${sheet.overruns} past ${plural(sheet.overruns, "its", "their")} finish date` : "none past their planned start"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN CONSTRAINTS</div>
                <div className={styles.kpiValue}>{sheet.holds.length}</div>
                <div className={styles.kpiSub}>{sheet.holdsOverdue > 0 ? `${sheet.holdsOverdue} overdue` : "none overdue"}</div>
              </article>
            </section>

            <section className={cx(styles.controls, styles.noPrint)}>
              <div className={styles.field}>
                <label className={styles.controlLabel} htmlFor="sheet-trade">
                  Trade
                </label>

                <select className={styles.select} id="sheet-trade" onChange={(event) => setTrade(event.target.value)} value={trade}>
                  <option value={ALL}>All trades</option>
                  {options.map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name} ({item.count})
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <span className={styles.controlLabel}>Look ahead</span>

                <div aria-label="Weeks on the sheet" className={styles.segmented} role="group">
                  {HORIZONS.map((option) => (
                    <button
                      aria-pressed={weeks === option.weeks}
                      className={cx(styles.segment, weeks === option.weeks && styles.segmentOn)}
                      key={option.weeks}
                      onClick={() => {
                        setWeeks(option.weeks);
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
                {visibleTicks > 0 && (
                  <button
                    className={styles.linkButton}
                    onClick={() => {
                      setTicked(new Set<string>());
                      setMessage(null);
                    }}
                    type="button"
                  >
                    Clear {visibleTicks} {plural(visibleTicks, "tick", "ticks")}
                  </button>
                )}

                <button className={styles.linkButton} onClick={copySheet} type="button">
                  Copy as Markdown
                </button>

                <button className={styles.printButton} onClick={() => window.print()} type="button">
                  Print sheet
                </button>
              </div>
            </section>

            {message && (
              <p className={cx(styles.statusLine, styles.noPrint)} role="status">
                {message}
              </p>
            )}

            <section aria-label="Work sheet" className={styles.sheet}>
              <header className={styles.sheetHead}>
                <div>
                  <div className="eyebrow">TRADE SHEET</div>
                  <h2>{tradeTitle(sheet)}</h2>
                  <p className={styles.sheetMeta}>
                    {projectName} · {formatDay(sheet.from)} to {formatDay(sheet.to)}
                  </p>
                </div>

                <div className={styles.sheetDate}>
                  <strong>Prepared {formatDay(today)}</strong>
                  <span>
                    {sheet.activities} {plural(sheet.activities, "activity", "activities")}, {sheet.holds.length} open {plural(sheet.holds.length, "constraint", "constraints")}
                  </span>
                </div>
              </header>

              {sheet.activities === 0 && <p className={styles.quiet}>Nothing is planned or under way for {tradeTitle(sheet).toLowerCase() === "all trades" ? "any trade" : tradeTitle(sheet)} in the next {weeksText}.</p>}

              {sheet.activities > 0 &&
                sheet.weeks.map((week) => {
                  const count = week.rows.filter((row) => ticked.has(row.key)).length;

                  return (
                    <section className={styles.week} key={week.start}>
                      <header className={styles.weekHead}>
                        <h3>Week of {weekRange(week.start, week.end)}</h3>
                        {week.current && <em className={styles.nowTag}>This week</em>}
                        <span className={styles.muted}>
                          {week.rows.length} {plural(week.rows.length, "activity", "activities")}
                          {count > 0 ? `, ${count} committed` : ""}
                        </span>
                      </header>

                      {week.rows.length === 0 ? (
                        <p className={styles.quiet}>Nothing planned this week.</p>
                      ) : (
                        <>
                          <div aria-hidden="true" className={styles.columns}>
                            <span />
                            <span>Activity</span>
                            <span>Planned</span>
                            <span>Done</span>
                            <span>Stage</span>
                            <span>What stops it, or needs doing first</span>
                          </div>

                          <ul className={styles.rows}>
                            {week.rows.map((row) => (
                              <SheetRow checked={ticked.has(row.key)} key={row.key} onToggle={toggle} row={row} showTrade={sheet.discipline === null} />
                            ))}
                          </ul>
                        </>
                      )}
                    </section>
                  );
                })}

              {sheet.holds.length > 0 && (
                <section className={styles.week}>
                  <header className={styles.weekHead}>
                    <h3>Open constraints</h3>
                    <span className={styles.muted}>
                      {sheet.holds.length} on this sheet{sheet.holdsOverdue > 0 ? `, ${sheet.holdsOverdue} overdue` : ""}
                    </span>
                  </header>

                  <ul className={styles.holdList}>
                    {sheet.holds.map((hold) => (
                      <li key={hold.id}>
                        <strong>{hold.code}</strong>
                        <span>{holdText(hold)}</span>
                        {hold.overdue && <em className={styles.lateTag}>Overdue</em>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <p className={styles.sheetNote}>
                Weeks run Monday to Sunday and an activity is listed in every week it is planned or under way. Ready means nothing recorded stops it starting: its finish-to-start predecessors are finished, its start-to-start predecessors have started, any lag has run out and it has no open constraint. This reflects what the schedule records, not what is happening on site.
                {sheet.staleDays > STALE_DAYS ? ` The schedule was last updated on ${formatDay(today - sheet.staleDays)}, so work that has started since may still show as not started.` : ""}
                {sheet.linkCount === 0 ? " The schedule has no links between activities, so readiness only reflects open constraints." : ""}
                {sheet.skipped > 0 ? ` ${sheet.skipped} ${plural(sheet.skipped, "activity has", "activities have")} no usable dates and ${plural(sheet.skipped, "was", "were")} left out.` : ""}
              </p>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
