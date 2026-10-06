"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import {
  DEFAULT_HORIZON,
  FILTERS,
  HORIZONS,
  ROLL_LIMIT,
  SORTS,
  STALE_DAYS,
  blockerText,
  buildReadiness,
  filterEntries,
  holdText,
  kindLabel,
  readinessMarkdown,
  sortEntries,
  startText,
  type Entry,
  type Filter,
  type Kind,
  type Readiness,
  type SortKey,
} from "@/lib/startReadiness";
import { copyText } from "@/lib/textExport";
import type { ScheduleControl } from "@/types/project";

import styles from "./ProjectStartReadinessView.module.css";

const PAGE = 20;

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const KIND_CLASS: Record<Kind, string | undefined> = {
  ready: styles.kindReady,
  predecessors: styles.kindWait,
  constraints: styles.kindWait,
  both: styles.kindBad,
  hold: styles.kindHold,
};

function Card({ entry }: { entry: Entry }) {
  const bad = entry.late && entry.kind !== "ready" && entry.kind !== "hold";
  const reasons = [
    ...entry.blockers.map((blocker) => ({ key: `b-${blocker.id}-${blocker.type}`, tag: blocker.kind === "lag" ? "Lag" : blocker.type === "SS" ? "Must start" : "Must finish", text: blockerText(blocker), flag: blocker.late ? "late" : blocker.afterStart ? "after start" : null })),
    ...entry.holds.map((hold) => ({ key: `h-${hold.id}`, tag: "Constraint", text: holdText(hold), flag: hold.overdue ? "overdue" : null })),
  ];

  return (
    <li className={cx(styles.card, entry.kind === "ready" && styles.cardReady, bad && styles.cardBad, entry.kind === "hold" && styles.cardHold)}>
      <div className={styles.cardTop}>
        <div className={styles.cardId}>
          <strong>{entry.code}</strong>
          {entry.critical && <em className={styles.critTag}>critical</em>}
          {!entry.critical && entry.nearCritical && <em className={styles.nearTag}>near critical</em>}
          {entry.discipline && <span className={styles.chip}>{entry.discipline}</span>}
        </div>

        <span className={cx(styles.kind, KIND_CLASS[entry.kind])}>{kindLabel(entry.kind)}</span>
      </div>

      <div className={styles.cardTitle}>{entry.name}</div>

      <div className={styles.cardMeta}>
        <span className={cx(entry.late && styles.lateText)}>{startText(entry)}</span>
        <span>
          {formatDay(entry.start)} to {formatDay(entry.finish)}
        </span>
        <span>
          {entry.duration} {plural(entry.duration, "day", "days")}
        </span>
        {entry.float !== null && <span>{entry.float} d float</span>}
      </div>

      {reasons.length > 0 ? (
        <ul className={styles.reasons}>
          {reasons.map((reason) => (
            <li key={reason.key}>
              <span className={styles.reasonTag}>{reason.tag}</span>
              <span className={styles.reasonText}>{reason.text}</span>
              {reason.flag && <em className={styles.flag}>{reason.flag}</em>}
            </li>
          ))}
        </ul>
      ) : (
        <p className={cx(styles.clear, entry.kind === "hold" && styles.clearHold)}>
          {entry.kind === "hold" ? "Marked on hold in the schedule." : entry.late ? "Nothing recorded stops this starting, yet it is past its planned start. Worth asking why." : "Nothing recorded stops this starting."}
        </p>
      )}
    </li>
  );
}

export function ProjectStartReadinessView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("attention");
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

  const built = useMemo(() => (data ? buildReadiness(data, today, horizon) : null), [data, today, horizon]);
  const readiness: Readiness | null = built && built.ok ? built.readiness : null;
  const entries = useMemo(() => (readiness ? sortEntries(filterEntries(readiness.entries, filter), sort) : []), [readiness, filter, sort]);
  const projectName = data?.project?.name ?? "Project";
  const horizonLabel = HORIZONS.find((item) => item.days === horizon)?.label ?? `${horizon} days`;
  const top = readiness?.blockers[0] ?? null;

  function pick<T>(setter: (value: T) => void, value: T) {
    setter(value);
    setShown(PAGE);
    setMessage(null);
  }

  async function copySummary() {
    if (!readiness) {
      return;
    }

    const ok = await copyText(readinessMarkdown(readiness, entries, projectName, today));

    setMessage(ok ? `Copied ${entries.length} ${plural(entries.length, "activity", "activities")} as Markdown.` : "Could not copy the list.");
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

            <div className="eyebrow">START READINESS</div>

            <h1>Can the next activities actually start?</h1>

            <p className={styles.subtitle}>
              Every activity that is due to start soon, or should already have, checked against what the schedule says holds it back: earlier work that is not finished, links still waiting on a lag and open constraints. It shows what to unblock first.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/lookahead`}>
              Look-ahead
            </Link>

            <Link className="secondary-link-button" href={`${base}/logic-map`}>
              Logic map
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Checking what can start…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the schedule. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "empty" ? "The schedule has no activities yet, so there is nothing to check." : "None of the schedule’s activities has usable start and finish dates."}</div>
          </section>
        )}

        {state === "ready" && readiness && readiness.staleDays > STALE_DAYS && (
          <div className="offline-banner">
            <div>
              <strong>The schedule was last updated {readiness.staleDays} days ago, on {formatDay(today - readiness.staleDays)}.</strong>
              <span> Work that has started since then may still show as not started.</span>
            </div>
          </div>
        )}

        {state === "ready" && readiness && readiness.linkCount === 0 && (
          <div className="offline-banner">
            <div>
              <strong>The schedule has no links between activities.</strong>
              <span> Readiness can only reflect open constraints, so “ready” here means less than usual.</span>
            </div>
          </div>
        )}

        {state === "ready" && readiness && (
          <>
            <section aria-label="Readiness summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>TO START</div>
                <div className={styles.kpiValue}>{readiness.counts.total}</div>
                <div className={styles.kpiSub}>
                  {readiness.counts.late} should have started, {readiness.counts.soon} within {horizonLabel}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>READY</div>
                <div className={cx(styles.kpiValue, readiness.counts.ready > 0 && styles.pos)}>{readiness.counts.ready}</div>
                <div className={styles.kpiSub}>nothing recorded stops them</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NOT READY</div>
                <div className={cx(styles.kpiValue, readiness.counts.notReady > 0 && styles.warn)}>{readiness.counts.notReady}</div>
                <div className={styles.kpiSub}>
                  {readiness.counts.predecessors} waiting on work, {readiness.counts.constraints} on constraints, {readiness.counts.both} both{readiness.counts.onHold > 0 ? `, ${readiness.counts.onHold} on hold` : ""}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LATE AND BLOCKED</div>
                <div className={cx(styles.kpiValue, readiness.counts.lateNotReady > 0 && styles.neg)}>{readiness.counts.lateNotReady}</div>
                <div className={styles.kpiSub}>past planned start and not ready</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>BIGGEST BLOCKER</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>{top ? top.code : "—"}</div>
                <div className={styles.kpiSub}>{top ? `holds ${top.holds.length} ${plural(top.holds.length, "start", "starts")}` : "no unfinished work is holding a start"}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.controlGroup}>
                <div aria-label="Starting within" className={styles.segmented} role="group">
                  {HORIZONS.map((option) => (
                    <button aria-pressed={horizon === option.days} className={cx(styles.segment, horizon === option.days && styles.segmentOn)} key={option.days} onClick={() => pick(setHorizon, option.days)} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>

                <div aria-label="Show" className={styles.segmented} role="group">
                  {FILTERS.map((option) => (
                    <button aria-pressed={filter === option.key} className={cx(styles.segment, filter === option.key && styles.segmentOn)} key={option.key} onClick={() => pick(setFilter, option.key)} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>

                <div aria-label="Sort by" className={styles.segmented} role="group">
                  {SORTS.map((option) => (
                    <button aria-pressed={sort === option.key} className={cx(styles.segment, sort === option.key && styles.segmentOn)} key={option.key} onClick={() => pick(setSort, option.key)} type="button">
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

            {readiness.blockers.length + readiness.owners.length > 0 && (
              <section className={cx(styles.twoCol, styles.rolls)}>
                <div className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">UNBLOCK FIRST</div>
                      <h2>Work holding up the most starts</h2>
                    </div>
                  </header>

                  {readiness.blockers.length === 0 ? (
                    <p className={styles.quiet}>No unfinished work is holding up a start in this window.</p>
                  ) : (
                    <ul className={styles.rollList}>
                      {readiness.blockers.slice(0, ROLL_LIMIT).map((blocker) => (
                        <li key={blocker.id}>
                          <div className={styles.rollTop}>
                            <strong>{blocker.code}</strong>
                            <span>{trunc(blocker.name, 44)}</span>
                          </div>

                          <div className={styles.rollMeta}>
                            <span className={styles.rollCount}>
                              holds {blocker.holds.length} {plural(blocker.holds.length, "start", "starts")}
                            </span>
                            <span>{blocker.progress}% done</span>
                            <span className={cx(blocker.late && styles.lateText)}>{blocker.late ? "already late" : Number.isFinite(blocker.release) ? `due ${formatDay(blocker.release)}` : "no date"}</span>
                          </div>

                          <div className={styles.rollWho}>
                            {blocker.holds
                              .slice(0, 4)
                              .map((hold) => hold.code)
                              .join(", ")}
                            {blocker.holds.length > 4 ? ` and ${blocker.holds.length - 4} more` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {readiness.blockers.length > ROLL_LIMIT && <p className={styles.quiet}>and {readiness.blockers.length - ROLL_LIMIT} more.</p>}
                </div>

                <div className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">CHASE</div>
                      <h2>Open constraints by owner</h2>
                    </div>
                  </header>

                  {readiness.owners.length === 0 ? (
                    <p className={styles.quiet}>No open constraint sits on an activity in this window.</p>
                  ) : (
                    <ul className={styles.rollList}>
                      {readiness.owners.slice(0, ROLL_LIMIT).map((owner) => (
                        <li key={owner.owner}>
                          <div className={styles.rollTop}>
                            <strong>{owner.owner}</strong>
                          </div>

                          <div className={styles.rollMeta}>
                            <span className={styles.rollCount}>
                              {owner.count} {plural(owner.count, "constraint", "constraints")}
                            </span>
                            {owner.overdue > 0 && <span className={styles.lateText}>{owner.overdue} overdue</span>}
                            <span>{Number.isFinite(owner.earliest) ? `earliest due ${formatDay(owner.earliest)}` : "no due date"}</span>
                          </div>

                          <div className={styles.rollWho}>
                            {owner.activities.slice(0, 5).join(", ")}
                            {owner.activities.length > 5 ? ` and ${owner.activities.length - 5} more` : ""}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {readiness.owners.length > ROLL_LIMIT && <p className={styles.quiet}>and {readiness.owners.length - ROLL_LIMIT} more owners.</p>}
                </div>
              </section>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">ACTIVITIES</div>
                  <h2>What is due to start{filter === "all" ? "" : `: ${(FILTERS.find((item) => item.key === filter)?.label ?? "").toLowerCase()}`}</h2>
                </div>

                <span className={styles.muted}>
                  {entries.length} {plural(entries.length, "activity", "activities")}
                </span>
              </header>

              {entries.length === 0 ? (
                <div className={styles.emptySmall}>
                  {readiness.counts.total === 0
                    ? `No activity is waiting to start within ${horizonLabel}, and none is past its planned start.`
                    : filter === "ready"
                      ? "Nothing in this window is ready to start."
                      : filter === "late"
                        ? "Nothing has passed its planned start without starting."
                        : "Nothing matches that filter."}
                </div>
              ) : (
                <ul className={styles.cards}>
                  {entries.slice(0, shown).map((entry) => (
                    <Card entry={entry} key={entry.id} />
                  ))}
                </ul>
              )}

              {entries.length > shown && (
                <div className={styles.more}>
                  <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                    Show {Math.min(PAGE, entries.length - shown)} more
                  </button>
                  <span className={styles.muted}>
                    {shown} of {entries.length} shown
                  </span>
                </div>
              )}
            </section>

            <p className={styles.note}>
              An activity is ready when nothing recorded stops it starting: every finish-to-start predecessor is finished, every start-to-start predecessor has started, any lag has run out and it has no open constraint. Finish-to-finish and start-to-finish links do not hold up a start, so they are ignored. A predecessor “due” date is its current finish (or start) plus the link’s lag. “After start” marks a predecessor that, even on its own dates, finishes after this activity is due to start, a sign the dates need re-planning. Only activities not yet started are listed. This reflects what the schedule records, not what is happening on site.
              {readiness.skipped > 0 ? ` ${readiness.skipped} ${plural(readiness.skipped, "activity has", "activities have")} no usable dates and ${plural(readiness.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
