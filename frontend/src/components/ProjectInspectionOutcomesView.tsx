"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectQuality } from "@/lib/api";
import { DEFAULT_WINDOW, DISCIPLINE_LABEL, FOLLOW_FILTERS, PAGE, SEVERITY_LABEL, TYPE_LABEL, WINDOWS, buildOutcomes, filterFollow, ncrText, outcomesMarkdown, pct, recheckText, type Follow, type FollowFilter, type Outcomes, type Recheck, type Tally } from "@/lib/inspectionOutcomes";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { QualityControl } from "@/types/project";

import styles from "./ProjectInspectionOutcomesView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const RECHECK_CHIP: Record<Recheck, string | undefined> = {
  passed: styles.chipGood,
  failedAgain: styles.chipBad,
  held: styles.chipPlain,
  planned: styles.chipWatch,
  none: styles.chipPlain,
};

function Chart({ outcomes }: { outcomes: Outcomes }) {
  const top = Math.max(1, ...outcomes.months.map((month) => month.assessed));
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scroller.current;

    if (node) {
      node.scrollLeft = node.scrollWidth;
    }
  }, [outcomes.months.length]);

  return (
    <div className={styles.chartScroll} ref={scroller}>
      <div className={styles.chart}>
        {outcomes.months.map((month) => (
          <div
            className={styles.col}
            key={month.month}
            title={`${month.label}: ${month.assessed} ${plural(month.assessed, "inspection", "inspections")} with a result, ${month.pass} passed, ${month.obs} passed with observations, ${month.fail} failed.`}
          >
            <span className={styles.colValue}>{month.assessed > 0 ? pct((month.pass + month.obs) / month.assessed) : "—"}</span>

            <span className={styles.colTrack}>
              <span className={styles.colStack}>
                {month.pass > 0 && <i className={styles.splitGood} style={{ flexBasis: `${(month.pass / top) * 100}%` }} />}
                {month.obs > 0 && <i className={styles.splitWatch} style={{ flexBasis: `${(month.obs / top) * 100}%` }} />}
                {month.fail > 0 && <i className={styles.splitBad} style={{ flexBasis: `${(month.fail / top) * 100}%` }} />}
              </span>
            </span>

            <span className={styles.colLabel}>{month.label}</span>
            <span className={styles.colSub}>{month.assessed > 0 ? `${month.assessed} held${month.fail > 0 ? `, ${month.fail} failed` : ""}` : " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Breakdown({ rows, label }: { rows: Tally[]; label: string }) {
  return (
    <>
      <ul className={styles.breakdown}>
        {rows.map((row) => (
          <li className={styles.breakRow} key={row.key}>
            <strong>{row.label}</strong>

            <span
              aria-label={`${row.label}: ${row.pass} passed, ${row.obs} passed with observations, ${row.fail} failed`}
              className={styles.split}
              role="img"
            >
              {row.pass > 0 && <i className={styles.splitGood} style={{ flexGrow: row.pass }} title={`${row.pass} passed`} />}
              {row.obs > 0 && <i className={styles.splitWatch} style={{ flexGrow: row.obs }} title={`${row.obs} passed with observations`} />}
              {row.fail > 0 && <i className={styles.splitBad} style={{ flexGrow: row.fail }} title={`${row.fail} failed`} />}
            </span>

            <span className={styles.breakNum}>
              <b className={cx(row.failRate >= 0.25 && styles.neg)}>{pct(row.failRate)}</b>
              <small>
                {row.fail} of {row.assessed}
              </small>
            </span>
          </li>
        ))}
      </ul>

      <p className={styles.keyNote}>{label}</p>
    </>
  );
}

function FailureRow({ entry }: { entry: Follow }) {
  return (
    <li className={cx(styles.row, entry.gap && styles.rowGap)}>
      <span>
        <strong>{formatDay(entry.item.date)}</strong>
        <small>{entry.item.reference}</small>
      </span>

      <span className={styles.what}>
        {trunc(entry.item.title, 70)}
        <small>
          {DISCIPLINE_LABEL[entry.item.discipline]}, {TYPE_LABEL[entry.item.type].toLowerCase()}
          {entry.item.inspector ? `, ${entry.item.inspector}` : ""}
        </small>
      </span>

      <span className={styles.follow}>
        {entry.gap && <em className={cx(styles.chip, styles.chipBad)}>No follow-up</em>}

        {entry.ncrs.map((ncr) => (
          <em className={cx(styles.chip, ncr.open ? (ncr.severity === "MINOR" ? styles.chipWatch : styles.chipBad) : styles.chipGood)} key={ncr.id} title={`${ncrText(ncr)}${ncr.after !== null ? `, raised ${ncr.after === 0 ? "the same day" : ncr.after > 0 ? `${ncr.after} ${plural(ncr.after, "day", "days")} after` : "before"}` : ""}`}>
            {ncr.reference} {SEVERITY_LABEL[ncr.severity]}, {ncr.open ? "open" : "closed"}
          </em>
        ))}

        {!entry.gap && entry.ncrs.length === 0 && <em className={cx(styles.chip, styles.chipWatch)}>No NCR raised</em>}

        {(entry.recheck !== "none" || !entry.gap) && <em className={cx(styles.chip, RECHECK_CHIP[entry.recheck])}>{recheckText(entry)}</em>}
      </span>
    </li>
  );
}

export function ProjectInspectionOutcomesView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<QualityControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [filter, setFilter] = useState<FollowFilter>("all");
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectQuality(projectId)
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

  const built = useMemo(() => (data ? buildOutcomes(data, today, windowDays) : null), [data, today, windowDays]);
  const outcomes = built && built.ok ? built.outcomes : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (outcomes ? filterFollow(outcomes.follow, filter) : []), [outcomes, filter]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;

  async function copySummary() {
    if (!outcomes) {
      return;
    }

    const ok = await copyText(outcomesMarkdown(outcomes, list, projectName, today, windowLabel));

    setMessage(ok ? "Copied the outcomes as Markdown." : "Could not copy the outcomes.");
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

            <div className="eyebrow">INSPECTION OUTCOMES</div>

            <h1>Do inspections pass first time, and what happens when they fail?</h1>

            <p className={styles.subtitle}>
              Every failed inspection should leave a trail: a non-conformance raised, a re-inspection booked, or both. This shows how often work passes, where it fails, and which failures have been left without any follow-up.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/quality-board`}>
              Quality board
            </Link>

            <Link className="secondary-link-button" href={`${base}/inspection-schedule`}>
              Inspection schedule
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the inspection register…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the quality data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No inspection has been completed yet, so there are no outcomes to show.</div>
          </section>
        )}

        {state === "ready" && outcomes && (
          <>
            <section aria-label="Inspection outcome summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>INSPECTED</div>
                <div className={styles.kpiValue}>{outcomes.assessed}</div>
                <div className={styles.kpiSub}>with a result, in the last {windowLabel}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PASSED</div>
                <div className={cx(styles.kpiValue, outcomes.passRate !== null && outcomes.passRate < 0.8 && styles.neg)}>{pct(outcomes.passRate)}</div>
                <div className={styles.kpiSub}>{outcomes.passRate === null ? "nothing inspected" : `${pct(outcomes.cleanRate)} with no observations`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FAILED</div>
                <div className={cx(styles.kpiValue, outcomes.fail > 0 && styles.neg)}>{outcomes.fail}</div>
                <div className={styles.kpiSub}>{outcomes.failRate === null ? "nothing inspected" : `${pct(outcomes.failRate)} of those inspected`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>THIRD-PARTY FAILS</div>
                <div className={cx(styles.kpiValue, outcomes.thirdParty.rate !== null && outcomes.thirdParty.rate >= 0.2 && styles.neg)}>{pct(outcomes.thirdParty.rate)}</div>
                <div className={styles.kpiSub}>{outcomes.thirdParty.assessed === 0 ? "none inspected" : `${outcomes.thirdParty.fail} of ${outcomes.thirdParty.assessed}, in-house ${pct(outcomes.inHouse.rate)}`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO FOLLOW-UP</div>
                <div className={cx(styles.kpiValue, outcomes.gaps > 0 && styles.neg, outcomes.fail > 0 && outcomes.gaps === 0 && styles.pos)}>{outcomes.gaps}</div>
                <div className={styles.kpiSub}>{outcomes.fail === 0 ? "no failures to follow up" : `of ${outcomes.fail} ${plural(outcomes.fail, "failure", "failures")}, no NCR or re-inspection`}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Period</span>

                <div aria-label="Period measured" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={windowDays === option.days}
                      className={cx(styles.segment, windowDays === option.days && styles.segmentOn)}
                      key={option.days}
                      onClick={() => {
                        setWindowDays(option.days);
                        setShown(PAGE);
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
                <span className={styles.controlLabel}>Failures</span>

                <div aria-label="Which failures to list" className={styles.segmented} role="group">
                  {FOLLOW_FILTERS.map((option) => (
                    <button
                      aria-pressed={filter === option.key}
                      className={cx(styles.segment, filter === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setFilter(option.key);
                        setShown(PAGE);
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

            {outcomes.assessed === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No completed inspection with a result falls in the last {windowLabel}. Try a longer period.</div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">MONTH BY MONTH</div>
                      <h2>How inspections turned out</h2>
                    </div>

                    <span className={styles.muted}>
                      {formatDay(outcomes.from)} to {formatDay(outcomes.to)}
                    </span>
                  </header>

                  <Chart outcomes={outcomes} />

                  <ul className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.splitGood)} />
                      Passed
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.splitWatch)} />
                      Passed with observations
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.splitBad)} />
                      Failed
                    </li>
                    <li>
                      <b className={styles.legendPct}>%</b>
                      Share that passed
                    </li>
                  </ul>
                </section>

                <div className={styles.twoCol}>
                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY DISCIPLINE</div>
                        <h2>Where work fails most</h2>
                      </div>
                    </header>

                    <Breakdown label="Highest fail rate first" rows={outcomes.disciplines} />
                  </section>

                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY INSPECTOR</div>
                        <h2>Who is inspecting</h2>
                      </div>
                    </header>

                    <Breakdown label="Third party: client, consultant, regulatory" rows={outcomes.types} />
                  </section>
                </div>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">AFTER A FAILURE</div>
                      <h2>What followed each failed inspection</h2>
                    </div>

                    <span className={styles.muted}>
                      {list.length} of {outcomes.fail} {plural(outcomes.fail, "failure", "failures")}, no follow-up first
                    </span>
                  </header>

                  {list.length === 0 ? (
                    <p className={styles.quiet}>{outcomes.fail === 0 ? "No inspection failed in this period." : "Every failure has an NCR or a re-inspection against it."}</p>
                  ) : (
                    <>
                      <ul className={styles.rows}>
                        {list.slice(0, shown).map((entry) => (
                          <FailureRow entry={entry} key={entry.item.id} />
                        ))}
                      </ul>

                      {list.length > shown && (
                        <div className={styles.more}>
                          <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                            Show {Math.min(PAGE, list.length - shown)} more
                          </button>
                          <span className={styles.muted}>
                            {shown} of {list.length} shown
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}

            <p className={styles.note}>
              An inspection counts once it is marked completed with a result of pass, pass with observations or fail, and it is dated by the day it was held, or the planned date if no actual date is recorded. A failure has follow-up when a non-conformance report is linked to it, or when a later inspection with the same title and discipline has been held or planned; that match is on the title, so a re-inspection booked under a different title is not found. Void NCRs are ignored. Third party means client, consultant or regulatory inspections; internal and test inspections are in-house.
              {outcomes.unassessed > 0 ? ` ${outcomes.unassessed} completed ${plural(outcomes.unassessed, "inspection has", "inspections have")} no result recorded and ${plural(outcomes.unassessed, "is", "are")} left out.` : ""}
              {outcomes.skipped > 0 ? ` ${outcomes.skipped} completed ${plural(outcomes.skipped, "inspection has", "inspections have")} no usable date and ${plural(outcomes.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
