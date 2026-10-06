"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSafety } from "@/lib/api";
import { CONCENTRATED, DEFAULT_WINDOW, FLAG_LABEL, MIN_FOR_SHARE, PAGE, QUIET_SHARE, RECURRING_MONTHS, RISING_BY, WINDOWS, buildCulture, cultureMarkdown, gapText, pct, type Culture, type Hazard, type HazardFlag, type Month, type Observer } from "@/lib/observationCulture";
import { formatDay, plural, startOfToday } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { SafetyControl } from "@/types/project";

import styles from "./ProjectObservationCultureView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const FLAG_CHIP: Record<HazardFlag, string | undefined> = {
  recurring: styles.chipWatch,
  rising: styles.chipBad,
};

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
            title={month.total === 0 ? `${month.label}: no observations${month.partial ? " (part of a month inside this period)" : ""}.` : `${month.label}${month.partial ? " (part of a month inside this period)" : ""}: ${month.total} ${plural(month.total, "observation", "observations")}, ${month.positive} positive and ${month.unsafe} unsafe.`}
          >
            <span className={styles.colValue}>{month.total > 0 ? month.total : ""}</span>

            <span className={styles.colTrack}>
              {month.unsafe > 0 && <i className={cx(styles.bar, styles.barUnsafe)} style={{ height: `${(month.unsafe / peak) * 100}%` }} />}
              {month.positive > 0 && <i className={cx(styles.bar, styles.barPositive)} style={{ height: `${(month.positive / peak) * 100}%` }} />}
            </span>

            <span className={styles.colLabel}>{month.label}</span>
            <span className={styles.colSub}>{pct(month.share)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ObserverLine({ observer, peak }: { observer: Observer; peak: number }) {
  const width = peak > 0 ? (observer.count / peak) * 100 : 0;

  return (
    <li className={styles.row}>
      <span className={styles.what}>
        <strong className={cx(!observer.named && styles.muted)}>{observer.name}</strong>
        <small>last observation {formatDay(observer.last)}</small>
      </span>

      <span aria-label={`${observer.name}: ${observer.positive} positive and ${observer.unsafe} unsafe observations`} className={styles.track} role="img">
        <span className={styles.split} style={{ width: `${width}%` }}>
          {observer.positive > 0 && <i className={styles.barPositive} style={{ flexGrow: observer.positive }} />}
          {observer.unsafe > 0 && <i className={styles.barUnsafe} style={{ flexGrow: observer.unsafe }} />}
        </span>
      </span>

      <span className={styles.rateFig}>
        <b>{observer.count}</b>
        <small>
          {pct(observer.share)} of all, {pct(observer.count > 0 ? observer.positive / observer.count : null)} positive
        </small>
      </span>
    </li>
  );
}

function HazardLine({ hazard, peak }: { hazard: Hazard; peak: number }) {
  return (
    <li className={styles.row}>
      <span className={styles.what}>
        <strong>{hazard.label}</strong>
        <span className={styles.tags}>
          {hazard.flags.map((flag) => (
            <em className={cx(styles.chip, FLAG_CHIP[flag])} key={flag}>
              {FLAG_LABEL[flag]}
            </em>
          ))}
        </span>
      </span>

      <span aria-label={`${hazard.label}: ${hazard.now} unsafe observations this period, ${hazard.before} before`} className={styles.bars} role="img">
        <span className={styles.track}>
          <i className={cx(styles.fill, styles.fillNow)} style={{ width: `${(hazard.now / peak) * 100}%` }} />
        </span>
        <span className={styles.track}>
          <i className={cx(styles.fill, styles.fillBefore)} style={{ width: `${(hazard.before / peak) * 100}%` }} />
        </span>
      </span>

      <span className={styles.rateFig}>
        <b>{hazard.now}</b>
        <small>
          {hazard.before} before, seen in {hazard.months} {plural(hazard.months, "month", "months")}
        </small>
      </span>
    </li>
  );
}

export function ProjectObservationCultureView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<SafetyControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
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

  const built = useMemo(() => (data ? buildCulture(data, today, windowDays) : null), [data, today, windowDays]);
  const culture: Culture | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const observerPeak = culture ? Math.max(1, ...culture.observers.map((observer) => observer.count)) : 1;
  const hazardPeak = culture ? Math.max(1, ...culture.hazards.flatMap((hazard) => [hazard.now, hazard.before])) : 1;

  async function copySummary() {
    if (!culture) {
      return;
    }

    const ok = await copyText(cultureMarkdown(culture, projectName, windowLabel));

    setMessage(ok ? "Copied the observation culture as Markdown." : "Could not copy the observation culture.");
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

            <div className="eyebrow">OBSERVATION CULTURE</div>

            <h1>Is the whole site looking out for hazards?</h1>

            <p className={styles.subtitle}>
              Safety observations show whether people are watching for hazards, not just whether hazards exist. This page looks at how many are made, how many are positive, who makes them, and which hazards keep coming back.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/safety-board`}>
              Safety board
            </Link>

            <Link className="secondary-link-button" href={`${base}/hotspots`}>
              Hotspots
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the safety observations…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the safety observations. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No safety observations have been recorded yet, so there is no observation culture to look at.</div>
          </section>
        )}

        {state === "ready" && culture && (
          <>
            <section aria-label="Observation culture summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OBSERVATIONS</div>
                <div className={styles.kpiValue}>{culture.total}</div>
                <div className={styles.kpiSub}>
                  {culture.last30} in the last 30 days, {culture.prev30} in the 30 before
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>POSITIVE SHARE</div>
                <div className={styles.kpiValue}>{pct(culture.positiveShare)}</div>
                <div className={styles.kpiSub}>
                  {culture.positive} positive, {culture.unsafe} unsafe
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OBSERVERS</div>
                <div className={styles.kpiValue}>{culture.observerCount}</div>
                <div className={styles.kpiSub}>{culture.total === 0 ? "no observation in this period" : culture.unnamed > 0 ? `${culture.unnamed} ${plural(culture.unnamed, "observation has", "observations have")} no observer recorded` : "every observation names its observer"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TOP OBSERVER</div>
                <div className={cx(styles.kpiValue, culture.concentrated && styles.neg)}>{pct(culture.topShare)}</div>
                <div className={styles.kpiSub}>{culture.top ? `${culture.top.name}, ${culture.top.count} of ${culture.total}` : "no named observer"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>QUIET WEEKS</div>
                <div className={cx(styles.kpiValue, culture.weeksMeasured > 0 && culture.quietWeeks / culture.weeksMeasured > QUIET_SHARE && styles.neg)}>{culture.quietWeeks}</div>
                <div className={styles.kpiSub}>
                  of {culture.weeksMeasured} complete {plural(culture.weeksMeasured, "week", "weeks")}, longest gap {gapText(culture.longestGap)}
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

            {culture.concentrated && culture.top && culture.topShare !== null && (
              <p className={styles.caution} role="note">
                {culture.top.name} made {pct(culture.topShare)} of the observations in this period ({culture.top.count} of {culture.total}), so the picture of the site rests largely on one observer.
              </p>
            )}

            {culture.total === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No safety observation was recorded in this period. Try a longer period.</div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">MONTH BY MONTH</div>
                      <h2>How many observations were made, and how many were positive</h2>
                    </div>

                    <span className={styles.muted}>count above each column, positive share below</span>
                  </header>

                  <Chart months={culture.months} />

                  <ul className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.barPositive)} />
                      Positive: safe act or good practice
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.barUnsafe)} />
                      Unsafe: act or condition
                    </li>
                  </ul>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">WHO IS OBSERVING</div>
                      <h2>Observations by observer</h2>
                    </div>

                    <span className={styles.muted}>
                      {culture.observers.length} {plural(culture.observers.length, "observer", "observers")}, most active first
                    </span>
                  </header>

                  <ul className={styles.rows}>
                    {culture.observers.slice(0, shown).map((observer) => (
                      <ObserverLine key={observer.key} observer={observer} peak={observerPeak} />
                    ))}
                  </ul>

                  {culture.observers.length > shown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, culture.observers.length - shown)} more
                      </button>
                      <span className={styles.muted}>
                        {shown} of {culture.observers.length} shown
                      </span>
                    </div>
                  )}

                  <ul className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.barPositive)} />
                      Positive
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.barUnsafe)} />
                      Unsafe
                    </li>
                  </ul>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">WHAT KEEPS COMING UP</div>
                      <h2>Unsafe observations by hazard category</h2>
                    </div>

                    <span className={styles.muted}>against the same length of time before</span>
                  </header>

                  {culture.hazards.length === 0 ? (
                    <p className={styles.quiet}>No unsafe act or condition was observed in this period.</p>
                  ) : (
                    <>
                      <ul className={styles.rows}>
                        {culture.hazards.map((hazard) => (
                          <HazardLine hazard={hazard} key={hazard.key} peak={hazardPeak} />
                        ))}
                      </ul>

                      <ul className={styles.legend}>
                        <li>
                          <i className={cx(styles.swatch, styles.fillNow)} />
                          This period
                        </li>
                        <li>
                          <i className={cx(styles.swatch, styles.fillBefore)} />
                          Before
                        </li>
                      </ul>
                    </>
                  )}
                </section>
              </>
            )}

            <p className={styles.note}>
              A positive observation is a safe act or good practice, and an unsafe observation is an unsafe act or an unsafe condition. Voided observations are left out. Observers are matched by name regardless of capitals or spaces, and an observation with no name is counted as having no observer recorded. The top observer share is flagged when one person made at least {Math.round(CONCENTRATED * 100)}% of the observations and there are at least {MIN_FOR_SHARE} of them. A quiet week is a complete Monday to Sunday week inside the period with no observation, and the longest gap counts the days in a row with none, including the days since the latest one. A hazard category is recurring when it was seen in at least {RECURRING_MONTHS} calendar months of the period, and rising when it has at least {RISING_BY} more unsafe observations than the same length of time before.
              {culture.voided > 0 ? ` ${culture.voided} voided ${plural(culture.voided, "observation is", "observations are")} left out.` : ""}
              {culture.skipped > 0 ? ` ${culture.skipped} ${plural(culture.skipped, "observation has", "observations have")} no usable date and ${plural(culture.skipped, "is", "are")} left out.` : ""}
              {culture.future > 0 ? ` ${culture.future} ${plural(culture.future, "observation is", "observations are")} dated in the future and ${plural(culture.future, "is", "are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
