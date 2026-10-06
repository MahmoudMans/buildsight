"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectGovernance } from "@/lib/api";
import { DEFAULT_WINDOW, FILTERS, PAGE, TYPE_LABEL, WINDOWS, buildOutputs, daysText, filterMeetings, outputsMarkdown, pct, perMeeting, type Filter, type MeetingRow, type Outputs, type TypeRow } from "@/lib/meetingOutputs";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { GovernanceControl } from "@/types/project";

import styles from "./ProjectMeetingOutputsView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const AGE_STYLE: Record<string, string | undefined> = {
  fresh: styles.ageFresh,
  month: styles.ageMonth,
  stale: styles.ageStale,
  old: styles.ageOld,
};

function TypeLine({ row }: { row: TypeRow }) {
  return (
    <li className={styles.typeRow}>
      <span className={styles.what}>
        <strong>{row.label}</strong>
        <small>
          {row.held} {plural(row.held, "meeting", "meetings")} held
        </small>
      </span>

      <span className={styles.cell}>
        <span aria-label={`${row.label}: ${row.withOutputs} of ${row.held} meetings have a decision or action linked`} className={styles.track} role="img">
          <i className={cx(styles.fill, styles.fillOutputs)} style={{ width: `${(row.outputShare ?? 0) * 100}%` }} />
        </span>
        <b>{pct(row.outputShare)}</b>
        <small>
          {row.withOutputs} of {row.held} have something linked
        </small>
      </span>

      <span className={styles.cell}>
        <b>
          {perMeeting(row.decisions, row.held)} {perMeeting(row.decisions, row.held) === "1" ? "decision" : "decisions"}, {perMeeting(row.actions, row.held)} {perMeeting(row.actions, row.held) === "1" ? "action" : "actions"}
        </b>
        <small>per meeting ({row.decisions} and {row.actions} in all)</small>
      </span>

      <span className={styles.cell}>
        <span aria-label={`${row.label}: ${row.done} of ${row.actions} actions done`} className={styles.track} role="img">
          <i className={cx(styles.fill, styles.fillDone)} style={{ width: `${(row.closure ?? 0) * 100}%` }} />
        </span>
        <b>{row.closure === null ? "No actions" : `${pct(row.closure)} done`}</b>
        <small>
          {row.actions > 0 ? `${row.open} open, ${row.overdue} overdue${row.medianClose !== null ? `, median ${daysText(row.medianClose)} to complete` : ""}` : "nothing was assigned"}
        </small>
      </span>
    </li>
  );
}

function MeetingLine({ row }: { row: MeetingRow }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{row.number}</strong> {trunc(row.title, 60)}
        <small>
          {TYPE_LABEL[row.type] ?? row.type} meeting, {formatDay(row.day)}
        </small>
      </span>

      <span className={styles.figs}>
        <span>
          <b>Decisions</b>
          {row.decisions}
          {row.pending > 0 && <small>{row.pending} still proposed</small>}
        </span>
        <span>
          <b>Actions</b>
          {row.actions}
          {row.actions > 0 && <small>{row.done} done</small>}
        </span>
      </span>

      <span className={styles.verdict}>
        {!row.hasOutputs && <em className={cx(styles.chip, styles.chipPlain)}>Nothing linked</em>}
        {row.overdue > 0 && (
          <em className={cx(styles.chip, styles.chipBad)}>
            {row.overdue} overdue
          </em>
        )}
        {row.blocked > 0 && (
          <em className={cx(styles.chip, styles.chipWatch)}>
            {row.blocked} blocked
          </em>
        )}
        {row.decisionsOverdue > 0 && (
          <em className={cx(styles.chip, styles.chipWatch)}>
            {row.decisionsOverdue} {plural(row.decisionsOverdue, "decision", "decisions")} overdue
          </em>
        )}
      </span>
    </li>
  );
}

function Ages({ outputs }: { outputs: Outputs }) {
  const total = outputs.ages.reduce((sum, bucket) => sum + bucket.count, 0);

  return (
    <>
      <span aria-label={`Open actions by age: ${outputs.ages.map((bucket) => `${bucket.count} ${bucket.label.toLowerCase()}`).join(", ")}`} className={styles.split} role="img">
        {outputs.ages.map((bucket) => (bucket.count > 0 ? <i className={AGE_STYLE[bucket.key]} key={bucket.key} style={{ flexGrow: bucket.count }} title={`${bucket.label}: ${bucket.count}`} /> : null))}
      </span>

      <ul className={styles.legend}>
        {outputs.ages.map((bucket) => (
          <li key={bucket.key}>
            <i className={cx(styles.swatch, AGE_STYLE[bucket.key])} />
            {bucket.label}: {bucket.count}
            {total > 0 ? ` (${Math.round((bucket.count / total) * 100)}%)` : ""}
          </li>
        ))}
      </ul>
    </>
  );
}

export function ProjectMeetingOutputsView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<GovernanceControl | null>(null);
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

    getProjectGovernance(projectId)
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

  const built = useMemo(() => (data ? buildOutputs(data, today, windowDays) : null), [data, today, windowDays]);
  const outputs = built && built.ok ? built.outputs : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (outputs ? filterMeetings(outputs.meetings, filter) : []), [outputs, filter]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const oldOpen = outputs ? (outputs.ages[outputs.ages.length - 1]?.count ?? 0) : 0;
  const unlinked = outputs ? outputs.unlinkedDecisions + outputs.unlinkedActions : 0;

  async function copySummary() {
    if (!outputs) {
      return;
    }

    const ok = await copyText(outputsMarkdown(outputs, list, projectName, today, windowLabel, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the meeting outputs as Markdown." : "Could not copy the meeting outputs.");
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

            <div className="eyebrow">MEETING OUTPUTS</div>

            <h1>Do the meetings produce decisions and actions that get done?</h1>

            <p className={styles.subtitle}>
              A meeting is worth having when something comes out of it. Following the decisions and actions linked to each meeting shows which kinds of meeting produce results, which leave nothing behind, and where the actions they raise go quiet.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/meeting-cadence`}>
              Meeting cadence
            </Link>

            <Link className="secondary-link-button" href={`${base}/governance-board`}>
              Governance board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the meetings, decisions and actions…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the meetings, decisions and actions. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No meetings have been recorded yet, so there are no outputs to follow.</div>
          </section>
        )}

        {state === "ready" && outputs && (
          <>
            <section aria-label="Meeting outputs summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>MEETINGS HELD</div>
                <div className={styles.kpiValue}>{outputs.held}</div>
                <div className={styles.kpiSub}>in the last {windowLabel}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WITH OUTPUTS</div>
                <div className={cx(styles.kpiValue, outputs.outputShare !== null && outputs.outputShare < 0.6 && styles.neg)}>{pct(outputs.outputShare)}</div>
                <div className={styles.kpiSub}>{outputs.held > 0 ? `${outputs.withOutputs} of ${outputs.held} have a decision or action linked` : "no meetings held in this period"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DECISIONS</div>
                <div className={styles.kpiValue}>{outputs.decisions}</div>
                <div className={styles.kpiSub}>
                  {outputs.pending} still proposed, {outputs.decisionsOverdue} overdue
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ACTIONS DONE</div>
                <div className={styles.kpiValue}>{pct(outputs.closure)}</div>
                <div className={styles.kpiSub}>{outputs.actions > 0 ? `${outputs.done} of ${outputs.actions}${outputs.medianClose !== null ? `, median ${daysText(outputs.medianClose)} to complete` : ""}` : "no actions linked"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVERDUE</div>
                <div className={cx(styles.kpiValue, outputs.overdue > 0 && styles.neg)}>{outputs.overdue}</div>
                <div className={styles.kpiSub}>
                  of {outputs.open} open {plural(outputs.open, "action", "actions")}
                  {outputs.blocked > 0 ? `, ${outputs.blocked} blocked` : ""}
                </div>
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
                <span className={styles.controlLabel}>Meetings</span>

                <div aria-label="Which meetings to list" className={styles.segmented} role="group">
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

            {oldOpen > 0 && (
              <p className={styles.caution} role="note">
                {oldOpen} open {plural(oldOpen, "action has", "actions have")} been waiting more than two months since the meeting that raised {plural(oldOpen, "it", "them")}.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY MEETING TYPE</div>
                  <h2>Which kinds of meeting leave something behind</h2>
                </div>

                <span className={styles.muted}>
                  {outputs.types.length} {plural(outputs.types.length, "type", "types")}, most held first
                </span>
              </header>

              {outputs.types.length === 0 ? (
                <p className={styles.quiet}>No meeting was held in this period.</p>
              ) : (
                <>
                  <div aria-hidden="true" className={styles.typeHead}>
                    <span>Type</span>
                    <span>With something linked</span>
                    <span>Output per meeting</span>
                    <span>Actions completed</span>
                  </div>

                  <ul className={styles.types}>
                    {outputs.types.map((row) => (
                      <TypeLine key={row.type} row={row} />
                    ))}
                  </ul>
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">OPEN ACTIONS</div>
                  <h2>How long the open actions have been waiting</h2>
                </div>

                <span className={styles.muted}>
                  {outputs.open} open, counted from the meeting date
                </span>
              </header>

              {outputs.open === 0 ? <p className={styles.quiet}>No action raised in these meetings is still open.</p> : <Ages outputs={outputs} />}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">MEETING BY MEETING</div>
                  <h2>What each meeting produced</h2>
                </div>

                <span className={styles.muted}>
                  {list.length} of {outputs.meetings.length} {plural(outputs.meetings.length, "meeting", "meetings")}, latest first
                </span>
              </header>

              {list.length === 0 ? (
                <p className={styles.quiet}>{outputs.meetings.length === 0 ? "No meeting was held in this period." : "No meeting matches this selection."}</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {list.slice(0, shown).map((row) => (
                      <MeetingLine key={row.id} row={row} />
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

            <p className={styles.note}>
              Only meetings recorded as held are counted, by the date they were held. A decision belongs to a meeting when it is linked to it, and an action belongs to a meeting when it is linked to it directly or through a decision taken at it; void actions are left out. A meeting with nothing linked may still have produced outputs that were recorded without a link, so read it as a prompt to check rather than a verdict. Actions done is the share of linked actions that are done. An open action is overdue once its due date has passed, and its age runs from the meeting date. Time to complete runs from the meeting date to the completion date of each finished action.
              {unlinked > 0 ? ` ${outputs.unlinkedDecisions} ${plural(outputs.unlinkedDecisions, "decision", "decisions")} and ${outputs.unlinkedActions} ${plural(outputs.unlinkedActions, "action", "actions")} are not linked to any meeting, whatever the period.` : ""}
              {outputs.danglingDecisions + outputs.danglingActions > 0 ? ` ${outputs.danglingDecisions + outputs.danglingActions} ${plural(outputs.danglingDecisions + outputs.danglingActions, "item points", "items point")} at a meeting that is not on the register.` : ""}
              {outputs.future > 0 ? ` ${outputs.future} ${plural(outputs.future, "meeting is", "meetings are")} recorded as held on a future date and ${plural(outputs.future, "is", "are")} left out.` : ""}
              {outputs.skipped > 0 ? ` ${outputs.skipped} ${plural(outputs.skipped, "meeting has", "meetings have")} no usable date and ${plural(outputs.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
