"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectGovernance } from "@/lib/api";
import { AHEAD, DEFAULT_WINDOW, FILTERS, KIND_LABEL, LAPSE, MIN_HELD, PAGE, RHYTHM_LABEL, TYPE_LABEL, WINDOWS, agoText, buildCadence, cadenceMarkdown, daysText, filterTypes, gapText, monthTicks, pct, reasonText, type Cadence, type Event, type Filter, type Kind, type Rhythm, type TypeRow } from "@/lib/meetingCadence";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { GovernanceControl } from "@/types/project";

import styles from "./ProjectMeetingCadenceView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const CHIP: Record<Rhythm, string | undefined> = {
  onRhythm: styles.chipGood,
  slipping: styles.chipWatch,
  lapsed: styles.chipBad,
  occasional: styles.chipPlain,
  none: styles.chipPlain,
};

const DOT: Record<Kind, string | undefined> = {
  held: styles.dotHeld,
  cancelled: styles.dotCancelled,
  missed: styles.dotMissed,
  upcoming: styles.dotUpcoming,
};

function joinNames(names: string[]): string {
  if (names.length <= 1) {
    return names[0] ?? "";
  }

  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function TypeLine({ row, today }: { row: TypeRow; today: number }) {
  const reason = reasonText(row);
  const notes = [row.cancelled > 0 ? `${row.cancelled} cancelled` : "", row.onDay !== null ? `${pct(row.onDay)} on the scheduled day` : "", row.minutesMissing > 0 ? `${row.minutesMissing} without minutes` : "", row.missed > 0 ? `${row.missed} past ${plural(row.missed, "meeting", "meetings")} not recorded` : ""].filter(Boolean);

  return (
    <li className={styles.row}>
      <span className={styles.what}>
        <strong>{row.label}</strong> <em className={cx(styles.chip, CHIP[row.rhythm])}>{RHYTHM_LABEL[row.rhythm]}</em>
        <small>{row.gap !== null ? `Meets ${gapText(row.gap)}` : gapText(row.gap)}</small>
        {reason && <small className={cx(styles.reason, (row.rhythm === "lapsed" || row.rhythm === "slipping") && styles.reasonWarn)}>{reason}</small>}
      </span>

      <span className={styles.cell}>
        <b className={styles.cellLabel}>Last held</b>
        {row.lastHeld !== null ? formatDay(row.lastHeld) : "Never"}
        {row.lastHeld !== null && <small>{agoText(row.lastHeld, today)}</small>}
      </span>

      <span className={styles.cell}>
        <b className={styles.cellLabel}>Next meeting</b>
        {row.next !== null ? formatDay(row.next) : "Nothing booked"}
        {row.next !== null && <small>{row.nextSource === "minutes" ? `${agoText(row.next, today)}, named in the last minutes` : agoText(row.next, today)}</small>}
      </span>

      <span className={styles.cell}>
        <b className={styles.cellLabel}>In this period</b>
        {row.held} held
        {notes.length > 0 && <small>{notes.join(", ")}</small>}
      </span>
    </li>
  );
}

function Timeline({ cadence, rows, today }: { cadence: Cadence; rows: TypeRow[]; today: number }) {
  const span = cadence.to - cadence.from;
  const at = (day: number) => `${Math.min(100, Math.max(0, ((day - cadence.from) / span) * 100))}%`;
  const ticks = monthTicks(cadence.from, cadence.to).filter((tick) => tick.day > cadence.from);
  const labelled = ticks.filter((tick) => Math.abs(tick.day - today) / span >= 0.06 && (cadence.to - tick.day) / span >= 0.04);

  return (
    <div className={styles.laneScroll} tabIndex={0}>
      <div className={styles.lanes}>
        <div className={styles.axis}>
          <span />
          <span className={styles.axisTrack}>
            {labelled.map((tick) => (
              <span className={styles.tick} key={tick.day} style={{ left: at(tick.day) }}>
                {tick.label}
              </span>
            ))}
            <span className={cx(styles.tick, styles.tickToday)} style={{ left: at(today) }}>
              Today
            </span>
          </span>
        </div>

        {rows.map((row) => (
          <div className={styles.lane} key={row.type}>
            <span className={styles.laneLabel}>{row.label}</span>

            <span
              aria-label={`${row.label}: ${row.held} held, ${row.cancelled} cancelled, ${row.upcoming} planned${row.events.some((event) => event.kind === "missed") ? `, ${row.events.filter((event) => event.kind === "missed").length} not recorded` : ""}`}
              className={styles.laneTrack}
              role="img"
            >
              {ticks.map((tick) => (
                <i className={styles.grid} key={tick.day} style={{ left: at(tick.day) }} />
              ))}
              <i className={styles.todayLine} style={{ left: at(today) }} />

              {row.events.map((event) => (
                <i className={cx(styles.dot, DOT[event.kind])} key={event.id} style={{ left: at(event.day) }} title={`${event.number} ${trunc(event.title, 50)}: ${KIND_LABEL[event.kind].toLowerCase()} ${formatDay(event.day)}${event.kind === "held" && event.late ? `, scheduled ${formatDay(event.scheduled)}` : ""}${event.kind === "held" && event.minutesMissing ? ", minutes missing" : ""}`} />
              ))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MissedLine({ event }: { event: Event }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{event.number}</strong> {trunc(event.title, 60)}
        <small>
          {TYPE_LABEL[event.type] ?? event.type} meeting scheduled for {formatDay(event.day)}
        </small>
      </span>

      <span className={styles.verdict}>
        <em className={cx(styles.chip, (event.late ?? 0) > 30 ? styles.chipBad : styles.chipWatch)}>{daysText(event.late ?? 0)} overdue</em>
      </span>
    </li>
  );
}

export function ProjectMeetingCadenceView() {
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

  const built = useMemo(() => (data ? buildCadence(data, today, windowDays) : null), [data, today, windowDays]);
  const cadence = built && built.ok ? built.cadence : null;
  const projectName = data?.project?.name ?? "Project";
  const rows = useMemo(() => (cadence ? filterTypes(cadence.types, filter) : []), [cadence, filter]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const lapsed = cadence ? cadence.types.filter((row) => row.rhythm === "lapsed") : [];
  const slipping = cadence ? cadence.types.filter((row) => row.rhythm === "slipping") : [];
  const activeTypes = cadence ? cadence.types.filter((row) => row.held > 0).length : 0;
  const attention = [lapsed.length > 0 ? `${joinNames(lapsed.map((row) => row.label))} ${plural(lapsed.length, "has", "have")} lapsed` : "", slipping.length > 0 ? `${joinNames(slipping.map((row) => row.label))} ${plural(slipping.length, "is", "are")} slipping` : ""].filter(Boolean).join(", and ");

  async function copySummary() {
    if (!cadence) {
      return;
    }

    const ok = await copyText(cadenceMarkdown(rows, cadence.missed, projectName, today, windowLabel));

    setMessage(ok ? "Copied the meeting cadence as Markdown." : "Could not copy the meeting cadence.");
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

            <div className="eyebrow">MEETING CADENCE</div>

            <h1>Are the project meetings still happening as often as they should?</h1>

            <p className={styles.subtitle}>
              Each kind of meeting settles into a rhythm of its own. Reading that rhythm from the meetings actually held shows which ones have quietly lapsed, which have booked meetings that were never recorded, and which are too occasional to call a routine.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/governance-board`}>
              Governance board
            </Link>

            <Link className="secondary-link-button" href={`${base}/governance`}>
              Governance
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the meetings…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the meetings. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No meetings have been recorded yet, so there is no cadence to read.</div>
          </section>
        )}

        {state === "ready" && cadence && (
          <>
            <section aria-label="Meeting cadence summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>MEETINGS HELD</div>
                <div className={styles.kpiValue}>{cadence.held}</div>
                <div className={styles.kpiSub}>
                  in the last {windowLabel}, across {activeTypes} {plural(activeTypes, "type", "types")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ON RHYTHM</div>
                <div className={styles.kpiValue}>{cadence.onRhythm}</div>
                <div className={styles.kpiSub}>
                  of {cadence.types.length} meeting {plural(cadence.types.length, "type", "types")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NEED ATTENTION</div>
                <div className={cx(styles.kpiValue, cadence.attention > 0 && styles.neg)}>{cadence.attention}</div>
                <div className={styles.kpiSub}>
                  {lapsed.length} lapsed, {slipping.length} slipping
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NOT RECORDED</div>
                <div className={cx(styles.kpiValue, cadence.missed.length > 0 && styles.neg)}>{cadence.missed.length}</div>
                <div className={styles.kpiSub}>past meetings still marked as planned</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO MINUTES</div>
                <div className={cx(styles.kpiValue, cadence.minutesMissing > 0 && styles.neg)}>{cadence.minutesMissing}</div>
                <div className={styles.kpiSub}>of {cadence.held} meetings held</div>
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
                <span className={styles.controlLabel}>Meeting types</span>

                <div aria-label="Which meeting types to list" className={styles.segmented} role="group">
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

            {attention && (
              <p className={styles.caution} role="note">
                {attention}.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">RHYTHM BY MEETING TYPE</div>
                  <h2>How regularly each kind of meeting is held</h2>
                </div>

                <span className={styles.muted}>
                  {rows.length} of {cadence.types.length} {plural(cadence.types.length, "type", "types")}, most in need first
                </span>
              </header>

              {rows.length === 0 ? (
                <p className={styles.quiet}>No meeting type has lapsed or is slipping.</p>
              ) : (
                <ul className={styles.rows}>
                  {rows.map((row) => (
                    <TypeLine key={row.type} row={row} today={today} />
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">TIMELINE</div>
                  <h2>Every meeting, type by type</h2>
                </div>

                <span className={styles.muted}>
                  {formatDay(cadence.from)} to {formatDay(cadence.to)}
                </span>
              </header>

              {rows.length === 0 ? <p className={styles.quiet}>No meeting type to draw.</p> : <Timeline cadence={cadence} rows={rows} today={today} />}

              <p className={styles.swipe}>Swipe sideways to see the whole timeline.</p>

              <ul className={styles.legend}>
                {(["held", "cancelled", "missed", "upcoming"] as Kind[]).map((kind) => (
                  <li key={kind}>
                    <i className={cx(styles.dotKey, DOT[kind])} />
                    {kind === "missed" ? "Planned, date passed, not recorded" : KIND_LABEL[kind]}
                  </li>
                ))}
                <li>
                  <i className={styles.legendLine} />
                  Today
                </li>
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">NOT RECORDED</div>
                  <h2>Meetings still marked as planned after their date</h2>
                </div>

                <span className={styles.muted}>
                  {cadence.missed.length} {plural(cadence.missed.length, "meeting", "meetings")}, most recent first, any date
                </span>
              </header>

              {cadence.missed.length === 0 ? (
                <p className={styles.quiet}>Every meeting whose date has passed has been recorded as held or cancelled.</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {cadence.missed.slice(0, shown).map((event) => (
                      <MissedLine event={event} key={event.id} />
                    ))}
                  </ul>

                  {cadence.missed.length > shown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, cadence.missed.length - shown)} more
                      </button>
                      <span className={styles.muted}>
                        {shown} of {cadence.missed.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>

            <p className={styles.note}>
              A meeting type has a usual gap once it has been held {MIN_HELD} or more times in the period; the gap is the median number of days between one held meeting and the next. A type is lapsed when nothing is booked and the time since it last met is more than {LAPSE} times its usual gap. It is slipping when it is that overdue with a meeting booked, or when a booked meeting has passed without being recorded as held. Types held fewer than {MIN_HELD} times are occasional, so no rhythm is judged. A meeting counts as held on the date recorded for when it took place, falling back to its scheduled date. The next meeting is the earliest one still planned, or the date named in the minutes of the last meeting when none is booked. Not recorded means a meeting still marked as planned although its date has passed, which is usually a meeting that took place but was never recorded, or one that was never cancelled; those are counted whatever the period. The timeline looks {AHEAD} days ahead.
              {cadence.future > 0 ? ` ${cadence.future} ${plural(cadence.future, "meeting is", "meetings are")} recorded as held on a future date and ${plural(cadence.future, "is", "are")} left out.` : ""}
              {cadence.skipped > 0 ? ` ${cadence.skipped} ${plural(cadence.skipped, "meeting has", "meetings have")} no usable date and ${plural(cadence.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
