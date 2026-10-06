"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectQuality } from "@/lib/api";
import { DEFAULT_HORIZON, DISCIPLINES, DISCIPLINE_LABEL, HORIZONS, LATE_DAYS, PAGE, SCOPES, SOON, TYPE_LABEL, buildSchedule, daysText, dueText, pct, scheduleMarkdown, type Bucket, type Item, type Schedule, type Scope } from "@/lib/inspectionSchedule";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { QualityControl, QualityDiscipline } from "@/types/project";

import styles from "./ProjectInspectionScheduleView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const COLOR: Record<QualityDiscipline, string | undefined> = {
  CIVIL: styles.dCivil,
  STRUCTURAL: styles.dStructural,
  ARCHITECTURAL: styles.dArchitectural,
  MEP: styles.dMep,
  HSE: styles.dHse,
  QUALITY: styles.dQuality,
  GENERAL: styles.dGeneral,
};

function Chart({ schedule }: { schedule: Schedule }) {
  const columns: Bucket[] = [schedule.overdueBucket, ...schedule.buckets];
  const top = Math.max(1, ...columns.map((column) => column.total));

  return (
    <div className={styles.chartScroll}>
      <div className={styles.chart}>
        {columns.map((column, index) => (
          <div
            className={cx(styles.col, index === 0 && styles.colOverdue)}
            key={column.label}
            title={`${column.label}: ${DISCIPLINES.filter((discipline) => column.byDiscipline[discipline] > 0)
              .map((discipline) => `${column.byDiscipline[discipline]} ${DISCIPLINE_LABEL[discipline]}`)
              .join(", ") || "nothing planned"}`}
          >
            <span className={styles.colValue}>{column.total}</span>

            <span className={styles.colTrack}>
              <span className={styles.colStack}>
                {DISCIPLINES.map((discipline) =>
                  column.byDiscipline[discipline] > 0 ? <i className={COLOR[discipline]} key={discipline} style={{ flexBasis: `${(column.byDiscipline[discipline] / top) * 100}%` }} /> : null,
                )}
              </span>
            </span>

            <span className={styles.colLabel}>{column.label}</span>
            <span className={styles.colSub}>{column.thirdParty > 0 ? `${column.thirdParty} third party` : " "}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ item, today, tag }: { item: Item & { daysOver?: number }; today: number; tag: "overdue" | "progress" | "soon" }) {
  return (
    <li className={styles.row}>
      <span>
        <strong>{formatDay(item.planned)}</strong>
        <small>{item.reference}</small>
      </span>

      <span className={styles.what}>
        {trunc(item.title, 70)}
        <small>
          {DISCIPLINE_LABEL[item.discipline]}, {TYPE_LABEL[item.type].toLowerCase()}
          {item.inspector ? `, ${item.inspector}` : ", no inspector named"}
        </small>
      </span>

      <span className={styles.when}>
        {tag === "overdue" ? (
          <em className={cx(styles.chip, (item.daysOver ?? 0) > 7 ? styles.chipBad : styles.chipWatch)}>{daysText(item.daysOver ?? 0)} late</em>
        ) : tag === "progress" ? (
          <em className={cx(styles.chip, styles.chipPlain)}>In progress</em>
        ) : (
          <em className={cx(styles.chip, item.thirdParty ? styles.chipWatch : styles.chipPlain)}>{dueText(item, today)}</em>
        )}
      </span>
    </li>
  );
}

export function ProjectInspectionScheduleView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<QualityControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [weeks, setWeeks] = useState(DEFAULT_HORIZON);
  const [scope, setScope] = useState<Scope>("all");
  const [shownOver, setShownOver] = useState(PAGE);
  const [shownSoon, setShownSoon] = useState(PAGE);
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

  const built = useMemo(() => (data ? buildSchedule(data, today, weeks, scope) : null), [data, today, weeks, scope]);
  const schedule = built && built.ok ? built.schedule : null;
  const projectName = data?.project?.name ?? "Project";
  const present = useMemo(() => (schedule ? DISCIPLINES.filter((discipline) => [schedule.overdueBucket, ...schedule.buckets].some((column) => column.byDiscipline[discipline] > 0)) : []), [schedule]);
  const nowList = useMemo(() => (schedule ? [...schedule.inProgress.map((item) => ({ item, tag: "progress" as const })), ...schedule.soon.map((item) => ({ item, tag: "soon" as const }))] : []), [schedule]);

  async function copySummary() {
    if (!schedule) {
      return;
    }

    const ok = await copyText(scheduleMarkdown(schedule, projectName, today, scope));

    setMessage(ok ? "Copied the schedule as Markdown." : "Could not copy the schedule.");
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

            <div className="eyebrow">INSPECTION SCHEDULE</div>

            <h1>Which inspections are due, and which have slipped?</h1>

            <p className={styles.subtitle}>
              Planned inspections laid out week by week, the ones that have passed their date without being held, and how punctually each discipline has turned up so far. Third-party inspections are the ones that hold up the next pour.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/quality-board`}>
              Quality board
            </Link>

            <Link className="secondary-link-button" href={`${base}/lookahead`}>
              Lookahead board
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
            <div className={styles.emptySmall}>No inspections are on the register yet, so there is no schedule to show.</div>
          </section>
        )}

        {state === "ready" && schedule && (
          <>
            <section aria-label="Inspection summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OVERDUE</div>
                <div className={styles.kpiValue}>{schedule.overdue.length}</div>
                <div className={styles.kpiSub}>{schedule.overdue.length === 0 ? "every planned inspection is still ahead" : `oldest ${daysText(schedule.overdue[0]?.daysOver ?? 0)} past its date`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DUE IN {SOON} DAYS</div>
                <div className={styles.kpiValue}>{schedule.soon.length}</div>
                <div className={styles.kpiSub}>{schedule.soon.filter((item) => item.thirdParty).length} of them third party</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>HELD ON TIME</div>
                <div className={cx(styles.kpiValue, schedule.onTimeShare !== null && schedule.onTimeShare < 0.7 && styles.neg)}>{pct(schedule.onTimeShare)}</div>
                <div className={styles.kpiSub}>of {schedule.held} held {plural(schedule.held, "inspection", "inspections")} with a date</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WHEN LATE</div>
                <div className={styles.kpiValue}>{schedule.averageLate === null ? "—" : `${schedule.averageLate.toFixed(1)} d`}</div>
                <div className={styles.kpiSub}>{schedule.averageLate === null ? "none held late" : `average delay, ${schedule.veryLate} over ${LATE_DAYS} days`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NEXT THIRD PARTY</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>{schedule.nextThirdParty ? formatDay(schedule.nextThirdParty.planned) : "None"}</div>
                <div className={styles.kpiSub}>{schedule.nextThirdParty ? `${schedule.nextThirdParty.reference}, ${dueText(schedule.nextThirdParty, today).toLowerCase()}` : "no third-party inspection is planned"}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Look ahead</span>

                <div aria-label="Weeks shown" className={styles.segmented} role="group">
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

              <div className={styles.field}>
                <span className={styles.controlLabel}>Show</span>

                <div aria-label="Which inspections to show" className={styles.segmented} role="group">
                  {SCOPES.map((option) => (
                    <button
                      aria-pressed={scope === option.key}
                      className={cx(styles.segment, scope === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setScope(option.key);
                        setShownOver(PAGE);
                        setShownSoon(PAGE);
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

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">LOOK-AHEAD</div>
                  <h2>Inspections planned, week by week</h2>
                </div>

                <span className={styles.muted}>
                  {schedule.total} {plural(schedule.total, "inspection", "inspections")} on the register
                  {schedule.later > 0 ? `, ${schedule.later} planned later still` : ""}
                </span>
              </header>

              <Chart schedule={schedule} />

              <ul className={styles.legend}>
                {present.map((discipline) => (
                  <li key={discipline}>
                    <i className={cx(styles.swatch, COLOR[discipline])} />
                    {DISCIPLINE_LABEL[discipline]}
                  </li>
                ))}
              </ul>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">OVERDUE</div>
                    <h2>Planned, but not held</h2>
                  </div>

                  <span className={styles.muted}>{schedule.overdue.length}</span>
                </header>

                {schedule.overdue.length === 0 ? (
                  <p className={styles.quiet}>No planned inspection is past its date.</p>
                ) : (
                  <>
                    <ul className={styles.rows}>
                      {schedule.overdue.slice(0, shownOver).map((item) => (
                        <Row item={item} key={item.id} tag="overdue" today={today} />
                      ))}
                    </ul>

                    {schedule.overdue.length > shownOver && (
                      <div className={styles.more}>
                        <button className={styles.moreButton} onClick={() => setShownOver((current) => current + PAGE)} type="button">
                          Show {Math.min(PAGE, schedule.overdue.length - shownOver)} more
                        </button>
                        <span className={styles.muted}>
                          {shownOver} of {schedule.overdue.length} shown
                        </span>
                      </div>
                    )}
                  </>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">NOW AND NEXT</div>
                    <h2>In progress, and due in {SOON} days</h2>
                  </div>

                  <span className={styles.muted}>{nowList.length}</span>
                </header>

                {nowList.length === 0 ? (
                  <p className={styles.quiet}>Nothing is in progress or due in the next {SOON} days.</p>
                ) : (
                  <>
                    <ul className={styles.rows}>
                      {nowList.slice(0, shownSoon).map(({ item, tag }) => (
                        <Row item={item} key={item.id} tag={tag} today={today} />
                      ))}
                    </ul>

                    {nowList.length > shownSoon && (
                      <div className={styles.more}>
                        <button className={styles.moreButton} onClick={() => setShownSoon((current) => current + PAGE)} type="button">
                          Show {Math.min(PAGE, nowList.length - shownSoon)} more
                        </button>
                        <span className={styles.muted}>
                          {shownSoon} of {nowList.length} shown
                        </span>
                      </div>
                    )}
                  </>
                )}
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PUNCTUALITY</div>
                  <h2>How often each discipline is held on the planned date</h2>
                </div>

                <span className={styles.muted}>{schedule.held} held</span>
              </header>

              {schedule.punctuality.length === 0 ? (
                <p className={styles.quiet}>No held inspection has an actual date yet, so punctuality cannot be measured.</p>
              ) : (
                <ul className={styles.punct}>
                  {schedule.punctuality.map((row) => {
                    const slight = row.late - row.veryLate;

                    return (
                      <li className={styles.punctRow} key={row.discipline}>
                        <strong>{DISCIPLINE_LABEL[row.discipline]}</strong>

                        <span
                          aria-label={`${DISCIPLINE_LABEL[row.discipline]}: ${row.onTime} on time, ${slight} up to ${LATE_DAYS} days late, ${row.veryLate} more than ${LATE_DAYS} days late`}
                          className={styles.split}
                          role="img"
                        >
                          {row.onTime > 0 && <i className={styles.splitGood} style={{ flexGrow: row.onTime }} title={`${row.onTime} on time`} />}
                          {slight > 0 && <i className={styles.splitWatch} style={{ flexGrow: slight }} title={`${slight} up to ${LATE_DAYS} days late`} />}
                          {row.veryLate > 0 && <i className={styles.splitBad} style={{ flexGrow: row.veryLate }} title={`${row.veryLate} more than ${LATE_DAYS} days late`} />}
                        </span>

                        <span>
                          {row.onTime} of {row.held} on time
                          <small>{row.averageLate === null ? "never held late" : `late ones averaged ${row.averageLate.toFixed(1)} days, worst ${daysText(row.worst)}`}</small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.splitGood)} />
                  On or before the planned date
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.splitWatch)} />
                  Up to {LATE_DAYS} days late
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.splitBad)} />
                  More than {LATE_DAYS} days late
                </li>
              </ul>
            </section>

            <p className={styles.note}>
              Overdue means an inspection still marked planned after its planned date; one marked in progress is not counted as overdue and is listed with what is due next. Held on time compares the date an inspection actually took place with the date it was planned for, so one held early or on the day is on time. Third party means client, consultant or regulatory inspections, and test and internal inspections are the rest. The look-ahead counts planned inspections from today; weeks run Monday to Sunday and the overdue column is everything before today. Cancelled inspections are left out.
              {schedule.undated > 0 ? ` ${schedule.undated} held ${plural(schedule.undated, "inspection has", "inspections have")} no actual date, so ${plural(schedule.undated, "it is", "they are")} left out of the punctuality figures.` : ""}
              {schedule.skipped > 0 ? ` ${schedule.skipped} ${plural(schedule.skipped, "inspection has", "inspections have")} no usable planned date and ${plural(schedule.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
