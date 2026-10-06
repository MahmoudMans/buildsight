"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { ago, buildActivity, dayName, digestMarkdown, type ActivityEvent, type Tone } from "@/lib/activity";
import { MODULES, MODULE_LABEL, MODULE_PATH, formatDay, loadSources, plural, projectOf, startOfToday, type ModuleKey, type Sources } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";

import styles from "./ProjectActivityView.module.css";

const SOURCE_COUNT = 9;
const PAGE_SIZE = 60;
const WEEKS = 12;
const DIGEST_PER_MODULE = 8;

const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const TONE_CLASS: Record<Tone, string | undefined> = {
  good: styles.whatGood,
  bad: styles.whatBad,
  plain: undefined,
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function shortDay(day: number): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(day * 86_400_000));
}

export function ProjectActivityView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [windowDays, setWindowDays] = useState(30);
  const [moduleFilter, setModuleFilter] = useState<ModuleKey | "all">("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    loadSources(projectId).then((result) => {
      if (cancelled) {
        return;
      }

      setSources(result.sources);
      setFailed(result.failed);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const project = useMemo(() => (sources ? projectOf(sources) : null), [sources]);
  const events = useMemo(() => (sources ? buildActivity(sources, today) : []), [sources, today]);

  const since = today - windowDays;
  const inWindow = useMemo(() => events.filter((event) => event.day > since), [events, since]);
  const scoped = useMemo(() => (moduleFilter === "all" ? inWindow : inWindow.filter((event) => event.module === moduleFilter)), [inWindow, moduleFilter]);

  const pulse = useMemo(() => {
    return MODULES.map((item) => {
      const own = events.filter((event) => event.module === item.key);
      const recent = own.filter((event) => event.day > since).length;
      const last = own.length > 0 ? Math.max(...own.map((event) => event.day)) : NaN;

      return { key: item.key, label: item.label, total: own.length, recent, last, failedToLoad: failed.includes(item.key) };
    }).sort((a, b) => b.recent - a.recent || a.label.localeCompare(b.label));
  }, [events, since, failed]);

  const quiet = pulse.filter((row) => !row.failedToLoad && row.total > 0 && row.recent === 0);
  const topPulse = Math.max(1, ...pulse.map((row) => row.recent));

  const weeks = useMemo(() => {
    const source = moduleFilter === "all" ? events : events.filter((event) => event.module === moduleFilter);

    return Array.from({ length: WEEKS }, (_, index) => {
      const end = today - 7 * (WEEKS - 1 - index);
      const start = end - 6;
      const count = source.filter((event) => event.day >= start && event.day <= end).length;

      return { end, start, count, inside: end > since };
    });
  }, [events, moduleFilter, today, since]);

  const topWeek = Math.max(1, ...weeks.map((week) => week.count));

  const dayCounts = useMemo(() => {
    const map = new Map<number, number>();

    for (const event of scoped) {
      map.set(event.day, (map.get(event.day) ?? 0) + 1);
    }

    return map;
  }, [scoped]);

  const busiest = useMemo(() => {
    let best: { day: number; count: number } | null = null;

    for (const [day, count] of dayCounts) {
      if (!best || count > best.count || (count === best.count && day > best.day)) {
        best = { day, count };
      }
    }

    return best;
  }, [dayCounts]);

  const mostActive = pulse[0] && pulse[0].recent > 0 ? pulse[0] : null;
  const latest = events.length > 0 ? Math.max(...events.map((event) => event.day)) : NaN;

  const groups = useMemo(() => {
    const out: Array<{ day: number; items: ActivityEvent[] }> = [];

    for (const event of scoped.slice(0, shown)) {
      const last = out[out.length - 1];

      if (last && last.day === event.day) {
        last.items.push(event);
      } else {
        out.push({ day: event.day, items: [event] });
      }
    }

    return out;
  }, [scoped, shown]);

  async function copyDigest() {
    const ok = await copyText(digestMarkdown(scoped, project?.name ?? "Project", today, windowDays, DIGEST_PER_MODULE));

    setMessage(ok ? "Copied the digest as Markdown." : "Could not copy the digest.");
  }

  const loaded = sources !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;
  const nothing = loaded && !failedAll && events.length === 0;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">ACTIVITY</div>

            <h1>What has been happening</h1>

            <p className={styles.subtitle}>
              The recent history of the project, drawn from the dates on every record: what was raised, closed, held, decided, certified and
              awarded. A module that has gone quiet is worth a phone call.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/since-report`}>
            Compare with last report
          </Link>
        </header>

        {!loaded && <div className={styles.loading}>Reading the records…</div>}

        {failedAll && (
          <div className="offline-banner">
            <div>
              <strong>Could not load any project data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {loaded && !failedAll && failed.length > 0 && (
          <div className="offline-banner">
            <div>
              <strong>Could not load {failed.map((key) => MODULE_LABEL[key].toLowerCase()).join(", ")}.</strong>
              <span> Their activity is missing below.</span>
            </div>
          </div>
        )}

        {nothing && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No dated activity is recorded yet. Raise an NCR, hold a meeting or log a site report and it will show up here.</div>
          </section>
        )}

        {loaded && !failedAll && !nothing && (
          <>
            <section aria-label="Activity summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>EVENTS</div>
                <div className={styles.kpiValue}>{scoped.length}</div>
                <div className={styles.kpiSub}>
                  in the last {windowDays} days{moduleFilter !== "all" ? ` · ${MODULE_LABEL[moduleFilter]}` : ""}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>BUSIEST DAY</div>
                <div className={styles.kpiValue}>{busiest ? busiest.count : "—"}</div>
                <div className={styles.kpiSub}>{busiest ? dayName(busiest.day) : "no activity"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MOST ACTIVE</div>
                <div className={cx(styles.kpiValue, styles.kpiName)}>{mostActive ? mostActive.label : "—"}</div>
                <div className={styles.kpiSub}>{mostActive ? `${mostActive.recent} ${plural(mostActive.recent, "event", "events")}` : "nothing in this window"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>QUIET MODULES</div>
                <div className={cx(styles.kpiValue, quiet.length > 0 && styles.neg)}>{quiet.length}</div>
                <div className={styles.kpiSub}>
                  {quiet.length > 0 ? quiet.slice(0, 3).map((row) => row.label).join(", ") + (quiet.length > 3 ? "…" : "") : "all have recent activity"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LATEST EVENT</div>
                <div className={styles.kpiValue}>{Number.isFinite(latest) ? ago(today - latest) : "—"}</div>
                <div className={styles.kpiSub}>{Number.isFinite(latest) ? formatDay(latest) : "none recorded"}</div>
              </article>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">WEEK BY WEEK</div>
                    <h2>Events per week</h2>
                  </div>

                  <div aria-label="Time window" className={styles.segmented} role="group">
                    {WINDOWS.map((option) => (
                      <button
                        aria-pressed={windowDays === option.days}
                        className={cx(styles.segment, windowDays === option.days && styles.segmentOn)}
                        key={option.days}
                        onClick={() => {
                          setWindowDays(option.days);
                          setShown(PAGE_SIZE);
                        }}
                        type="button"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </header>

                <ol className={styles.weeks}>
                  {weeks.map((week) => (
                    <li key={week.end} title={`${shortDay(week.start)} to ${shortDay(week.end)}: ${week.count}`}>
                      <span className={styles.weekCount}>{week.count}</span>

                      <span className={styles.weekBar}>
                        <span className={cx(styles.weekFill, !week.inside && styles.weekOutside)} style={{ height: `${Math.max(week.count > 0 ? 4 : 0, (week.count / topWeek) * 100)}%` }} />
                      </span>

                      <span className={styles.weekLabel}>{shortDay(week.end)}</span>
                    </li>
                  ))}
                </ol>

                <p className={styles.hint}>Each bar is the seven days ending on the date underneath. Bars inside the chosen window are dark.</p>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY MODULE</div>
                    <h2>Where the activity is</h2>
                  </div>

                  {moduleFilter !== "all" && (
                    <button className={styles.linkButton} onClick={() => setModuleFilter("all")} type="button">
                      Show every module
                    </button>
                  )}
                </header>

                <ul className={styles.pulse}>
                  {pulse.map((row) => {
                    const unavailable = row.failedToLoad;
                    const silent = !unavailable && row.total > 0 && row.recent === 0;

                    return (
                      <li key={row.key}>
                        <button
                          aria-pressed={moduleFilter === row.key}
                          className={cx(styles.pulseRow, moduleFilter === row.key && styles.pulseOn, silent && styles.pulseQuiet)}
                          disabled={unavailable || row.total === 0}
                          onClick={() => {
                            setModuleFilter(moduleFilter === row.key ? "all" : row.key);
                            setShown(PAGE_SIZE);
                          }}
                          type="button"
                        >
                          <span className={styles.pulseName}>{row.label}</span>

                          <span aria-hidden="true" className={styles.pulseTrack}>
                            <span className={styles.pulseFill} style={{ width: `${(row.recent / topPulse) * 100}%` }} />
                          </span>

                          <span className={styles.pulseCount}>{unavailable ? "—" : row.recent}</span>

                          <span className={styles.pulseLast}>
                            {unavailable ? "Not loaded" : row.total === 0 ? "No dated records" : silent ? `quiet · latest ${ago(today - row.last)}` : `latest ${ago(today - row.last)}`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">TIMELINE</div>
                  <h2>
                    {moduleFilter === "all" ? "Everything" : MODULE_LABEL[moduleFilter]}, newest first
                  </h2>
                </div>

                <button className={styles.linkButton} disabled={scoped.length === 0} onClick={copyDigest} type="button">
                  Copy digest
                </button>
              </header>

              {message && (
                <p className={styles.statusLine} role="status">
                  {message}
                </p>
              )}

              {scoped.length === 0 ? (
                <div className={styles.emptySmall}>Nothing happened in the last {windowDays} days{moduleFilter !== "all" ? ` in ${MODULE_LABEL[moduleFilter].toLowerCase()}` : ""}. Try a longer window.</div>
              ) : (
                <>
                  {groups.map((group) => (
                    <div className={styles.day} key={group.day}>
                      <div className={styles.dayHead}>
                        <h3>{dayName(group.day)}</h3>
                        <span>
                          {dayCounts.get(group.day)} {plural(dayCounts.get(group.day) ?? 0, "event", "events")} · {ago(today - group.day)}
                        </span>
                      </div>

                      <ul className={styles.events}>
                        {group.items.map((event) => (
                          <li key={event.id}>
                            <span className={cx(styles.what, TONE_CLASS[event.tone])}>{event.what}</span>

                            <span className={styles.eventMain}>
                              <span className={styles.eventTitle}>
                                {event.reference !== "" && <strong>{event.reference}</strong>}
                                {event.title}
                              </span>

                              <span className={styles.eventMeta}>
                                {MODULE_LABEL[event.module]} · {event.kind}
                                {event.who ? ` · ${event.who}` : ""}
                              </span>
                            </span>

                            <Link className={styles.itemLink} href={`${base}/${MODULE_PATH[event.module]}`}>
                              Open →
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  {scoped.length > shown && (
                    <button className={cx(styles.linkButton, styles.moreButton)} onClick={() => setShown((count) => count + PAGE_SIZE)} type="button">
                      Show {Math.min(PAGE_SIZE, scoped.length - shown)} more ({scoped.length - shown} left)
                    </button>
                  )}
                </>
              )}
            </section>

            <p className={styles.note}>
              Events come from the dates on the records themselves: raised, closed, held, decided, submitted, certified, paid, awarded,
              started, finished, reached and reported, plus progress updates and revision issue dates. Risks and issues have no date of
              their own, so they appear on the day they were logged. A module counts as quiet when it has dated records but none of them
              fall inside the chosen window. Future dates are left out.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
