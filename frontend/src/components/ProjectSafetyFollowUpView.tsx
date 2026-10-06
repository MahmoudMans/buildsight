"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSafety } from "@/lib/api";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { DEFAULT_WINDOW, FILTERS, FLAG_LABEL, GOOD, GRACE_DAYS, MIN_GROUP, PAGE, WATCH, WINDOWS, actionText, bandOf, buildFollowUp, daysText, filterUnits, followMarkdown, pct, severityLabel, type Filter, type Flag, type FollowUp, type Group, type Month, type Unit } from "@/lib/safetyFollowUp";
import { copyText } from "@/lib/textExport";
import type { SafetyControl } from "@/types/project";

import styles from "./ProjectSafetyFollowUpView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const FILL: Record<"good" | "watch" | "bad", string | undefined> = {
  good: styles.fillGood,
  watch: styles.fillWatch,
  bad: styles.fillBad,
};

function chipOf(flag: Flag, unit: Unit): string | undefined {
  if (flag === "closedNoAction" || flag === "stillOpen") {
    return styles.chipBad;
  }

  if (flag === "noAction") {
    return unit.severity === "CRITICAL" || unit.severity === "HIGH" ? styles.chipBad : styles.chipWatch;
  }

  if (flag === "overdue") {
    return styles.chipWatch;
  }

  return flag === "followed" ? styles.chipGood : styles.chipPlain;
}

function Chart({ months }: { months: Month[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  const peak = Math.max(1, ...months.map((month) => month.total));

  useEffect(() => {
    const node = scroller.current;

    if (node) {
      node.scrollLeft = node.scrollWidth;
    }
  }, [months.length]);

  return (
    <div className={styles.chartScroll} ref={scroller}>
      <div className={styles.chart}>
        {months.map((month) => (
          <div
            className={styles.col}
            key={month.key}
            title={
              month.total === 0
                ? `${month.label}: no hazards raised${month.partial ? " (part of a month inside this period)" : ""}.`
                : `${month.label}${month.partial ? " (part of a month inside this period)" : ""}: ${month.total} ${plural(month.total, "hazard", "hazards")} raised, ${month.followed} with an action, ${month.none} without${month.fresh > 0 ? `, ${month.fresh} too new to judge` : ""}.`
            }
          >
            <span className={styles.colValue}>{month.total > 0 ? month.total : ""}</span>

            <span className={styles.colTrack}>
              {month.fresh > 0 && <i className={cx(styles.bar, styles.barFresh)} style={{ height: `${(month.fresh / peak) * 100}%` }} />}
              {month.none > 0 && <i className={cx(styles.bar, styles.barNone)} style={{ height: `${(month.none / peak) * 100}%` }} />}
              {month.followed > 0 && <i className={cx(styles.bar, styles.barDone)} style={{ height: `${(month.followed / peak) * 100}%` }} />}
            </span>

            <span className={styles.colLabel}>{month.label}</span>
            <span className={styles.colSub}>{pct(month.coverage)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverageBar({ group, label }: { group: Group; label: string }) {
  const band = bandOf(group);

  return (
    <span aria-label={label} className={styles.track} role="img">
      {group.coverage !== null && <i className={cx(styles.fill, band ? FILL[band] : styles.fillQuiet)} style={{ width: `${group.coverage * 100}%` }} />}
    </span>
  );
}

function GroupLine({ group }: { group: Group }) {
  const noun = group.key === "incident" ? "incident" : group.key === "observation" ? "unsafe observation" : "hazard";
  const text = group.judged === 0 ? `${group.count} new, too early to judge` : `${group.withAction} of ${group.judged} with an action`;

  return (
    <li className={styles.groupRow}>
      <span className={styles.what}>
        <strong>{group.label}</strong>
        <small>
          {group.count} {plural(group.count, noun, `${noun}s`)}
        </small>
      </span>

      <CoverageBar group={group} label={`${group.label}: ${pct(group.coverage)} of hazards have a corrective action`} />

      <span className={styles.rateFig}>
        <b>{pct(group.coverage)}</b>
        <small>{text}</small>
      </span>
    </li>
  );
}

function UnitLine({ unit, today }: { unit: Unit; today: number }) {
  const age = today - unit.raised;

  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{trunc(unit.title, 72)}</strong>
        <small>
          {unit.reference}, {unit.typeLabel.toLowerCase()}, {severityLabel(unit.severity).toLowerCase()} severity
        </small>
        <small>
          Raised {formatDay(unit.raised)}, {age === 0 ? "today" : `${age} ${plural(age, "day", "days")} ago`}
          {unit.location ? `, ${unit.location}` : ""}
        </small>
      </span>

      <span className={styles.cell}>
        <b>{actionText(unit)}</b>
        {unit.firstActionDays !== null && <small>First action recorded {unit.firstActionDays === 0 ? "the same day" : `${daysText(unit.firstActionDays)} after`}</small>}
        {unit.overdueActions > 0 && (
          <small>
            {unit.overdueActions} overdue, up to {unit.worstLate} {plural(unit.worstLate, "day", "days")} past due
          </small>
        )}
        {unit.overdueActions === 0 && unit.nextDue !== null && <small>Next due {formatDay(unit.nextDue)}</small>}
        {unit.actions === 0 && unit.immediate && <small>An immediate action is noted on the incident, but no action is recorded.</small>}
      </span>

      <span className={styles.verdict}>
        {unit.flags.map((flag) => (
          <em className={cx(styles.chip, chipOf(flag, unit))} key={flag}>
            {FLAG_LABEL[flag]}
          </em>
        ))}
      </span>
    </li>
  );
}

export function ProjectSafetyFollowUpView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<SafetyControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectSafety(projectId)
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

  const built = useMemo(() => (data ? buildFollowUp(data, today, windowDays) : null), [data, today, windowDays]);
  const follow: FollowUp | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (follow ? filterUnits(follow.units, filter) : []), [follow, filter]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const closedBare = follow ? follow.units.filter((unit) => unit.flags.includes("closedNoAction")) : [];

  async function copySummary() {
    if (!follow) {
      return;
    }

    const ok = await copyText(followMarkdown(follow, list, projectName, windowLabel, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the safety follow-up as Markdown." : "Could not copy the safety follow-up.");
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

            <div className="eyebrow">SAFETY FOLLOW-UP</div>

            <h1>Does every hazard get a corrective action?</h1>

            <p className={styles.subtitle}>
              Reporting an incident or an unsafe observation only matters if something is done about it. This page matches each one to the corrective actions recorded against it, and shows which have none, which are overdue, and which were closed without the follow-through.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/safety-board`}>
              Safety board
            </Link>

            <Link className="secondary-link-button" href={`${base}/safety-rates`}>
              Safety rates
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the incidents, observations and actions…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the safety records. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No incidents or unsafe observations have been recorded yet, so there is nothing to follow up.</div>
          </section>
        )}

        {state === "ready" && follow && (
          <>
            <section aria-label="Safety follow-up summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>HAZARDS RAISED</div>
                <div className={styles.kpiValue}>{follow.raised}</div>
                <div className={styles.kpiSub}>
                  {follow.incidents} {plural(follow.incidents, "incident", "incidents")} and {follow.observations} unsafe {plural(follow.observations, "observation", "observations")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WITH AN ACTION</div>
                <div className={cx(styles.kpiValue, follow.coverage !== null && follow.coverage < WATCH && styles.neg)}>{pct(follow.coverage)}</div>
                <div className={styles.kpiSub}>{follow.judged > 0 ? `${follow.withAction} of ${follow.judged} ${plural(follow.judged, "hazard", "hazards")} have a corrective action` : "nothing old enough to judge"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO ACTION</div>
                <div className={cx(styles.kpiValue, follow.noAction > 0 && styles.neg)}>{follow.noAction}</div>
                <div className={styles.kpiSub}>
                  {follow.closedNoAction > 0 ? `${follow.closedNoAction} already closed` : "none closed without one"}
                  {follow.fresh > 0 ? `, ${follow.fresh} new not counted` : ""}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVERDUE</div>
                <div className={cx(styles.kpiValue, follow.overdueActions > 0 && styles.neg)}>{follow.overdueActions}</div>
                <div className={styles.kpiSub}>
                  {follow.overdueActions === 1 ? "action" : "actions"} past due on {follow.overdueUnits} {plural(follow.overdueUnits, "hazard", "hazards")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TIME TO ACTION</div>
                <div className={styles.kpiValue}>{daysText(follow.medianDays)}</div>
                <div className={styles.kpiSub}>median until the first action was recorded</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Raised in the last</span>

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
                <span className={styles.controlLabel}>Hazards</span>

                <div aria-label="Which hazards to list" className={styles.segmented} role="group">
                  {FILTERS.map((option) => (
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

            {closedBare.length > 0 && (
              <p className={styles.caution} role="note">
                {closedBare.length} {plural(closedBare.length, "hazard was", "hazards were")} marked closed with no corrective action recorded: {closedBare.slice(0, 4).map((unit) => unit.reference).join(", ")}
                {closedBare.length > 4 ? ` and ${closedBare.length - 4} more` : ""}.
              </p>
            )}

            {follow.units.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No incident or unsafe observation was raised in this period. Try a longer period.</div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">MONTH BY MONTH</div>
                      <h2>Hazards raised, and whether they got an action</h2>
                    </div>

                    <span className={styles.muted}>count above each column, share with an action below</span>
                  </header>

                  <Chart months={follow.months} />

                  <ul className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.barDone)} />
                      Action recorded
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.barNone)} />
                      No action
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.barFresh)} />
                      New, under {GRACE_DAYS} days and none yet
                    </li>
                  </ul>
                </section>

                <div className={styles.twoCol}>
                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY SEVERITY</div>
                        <h2>Are the serious ones covered</h2>
                      </div>
                    </header>

                    <ul className={styles.rates}>
                      {follow.severities.map((group) => (
                        <GroupLine group={group} key={group.key} />
                      ))}
                    </ul>
                  </section>

                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY SOURCE</div>
                        <h2>Incidents against observations</h2>
                      </div>
                    </header>

                    <ul className={styles.rates}>
                      {follow.sources.map((group) => (
                        <GroupLine group={group} key={group.key} />
                      ))}
                    </ul>

                    <p className={styles.hint}>
                      Green is {Math.round(GOOD * 100)}% or more, amber {Math.round(WATCH * 100)}% or more, red below that. Groups of fewer than {MIN_GROUP} hazards are not coloured.
                    </p>
                  </section>
                </div>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">HAZARD BY HAZARD</div>
                      <h2>Each hazard and what was done about it</h2>
                    </div>

                    <span className={styles.muted}>
                      {list.length} of {follow.units.length} {plural(follow.units.length, "hazard", "hazards")}, weakest follow-up first
                    </span>
                  </header>

                  {list.length === 0 ? (
                    <p className={styles.quiet}>No hazard matches this selection.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {list.slice(0, shown).map((unit) => (
                          <UnitLine key={unit.key} today={today} unit={unit} />
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
              A hazard is an incident, or an observation of an unsafe act or unsafe condition, raised in the period. It is dated from the incident&apos;s reported date (its occurred date when that is missing) or from the observation date. Voided records are left out. An action is matched to a hazard by its id, or by its reference when the id is missing, and a voided action does not count. A hazard raised in the last {GRACE_DAYS} days with no action yet is shown as new and is not counted against the share with an action. Time to action runs from the date a hazard was raised to the date its first action was created in BuildSight. An action is overdue when it is not closed and its due date has passed. Closed actions with no verification notes are shown as not verified, and a closed hazard that still has an open action is flagged. Immediate actions written on an incident are not counted as corrective actions.
              {follow.standalone > 0 ? ` ${follow.standalone} ${plural(follow.standalone, "action is", "actions are")} not linked to any hazard and ${plural(follow.standalone, "is", "are")} left out.` : ""}
              {follow.dangling > 0 ? ` ${follow.dangling} ${plural(follow.dangling, "action points", "actions point")} at a record that does not exist and ${plural(follow.dangling, "is", "are")} left out.` : ""}
              {follow.voided > 0 ? ` ${follow.voided} voided ${plural(follow.voided, "record is", "records are")} left out.` : ""}
              {follow.skippedUnits > 0 ? ` ${follow.skippedUnits} ${plural(follow.skippedUnits, "hazard has", "hazards have")} no usable date and ${plural(follow.skippedUnits, "is", "are")} left out.` : ""}
              {follow.future > 0 ? ` ${follow.future} ${plural(follow.future, "hazard is", "hazards are")} dated in the future and ${plural(follow.future, "is", "are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
