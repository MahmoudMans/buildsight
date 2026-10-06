"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectRiskControl } from "@/lib/api";
import { DEFAULT_WINDOW, FILTERS, LANES, PAGE, PAIR_KIND_LABEL, WINDOWS, buildConcurrency, concurrencyMarkdown, dayCount, filterPairs, pct, type Concurrency, type Pair, type PairFilter, type PairKind, type Span } from "@/lib/delayConcurrency";
import { formatDay, plural, trunc, words } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { RiskControl } from "@/types/project";

import styles from "./ProjectDelayConcurrencyView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const KIND_CHIP: Record<PairKind, string | undefined> = {
  mixed: styles.chipWatch,
  bothExcusable: styles.chipPlain,
  bothCulpable: styles.chipPlain,
};

function nature(span: Span): string {
  return `${span.causeLabel.toLowerCase()}, ${span.excusable ? "excusable" : "not excusable"}`;
}

function Lane({ span, runs }: { span: Span; runs: Concurrency["runs"] }) {
  const cutLeft = span.start < span.from;
  const cutRight = span.end > span.to;

  return (
    <li className={styles.lane}>
      <span className={styles.what}>
        <strong>
          {span.reference} {trunc(span.title, 40)}
        </strong>
        <small>
          {nature(span)}, {dayCount(span.days)}
          {span.recordedEnd ? "" : ", forecast"}
        </small>
      </span>

      <span className={styles.laneTrack}>
        {runs.map((run) => (
          <i className={styles.shade} key={run.from} style={{ left: `${run.left}%`, width: `${run.width}%` }} />
        ))}

        <i
          className={cx(styles.bar, span.excusable ? styles.barExcusable : styles.barOther, !span.recordedEnd && styles.barForecast, cutLeft && styles.cutLeft, cutRight && styles.cutRight)}
          style={{ left: `${span.left}%`, width: `${span.width}%` }}
          title={`${span.reference}: ${formatDay(span.start)} to ${formatDay(span.end)}${span.recordedEnd ? "" : " (forecast)"}`}
        />
      </span>
    </li>
  );
}

function DelayText({ span, label }: { span: Span; label: string }) {
  return (
    <span className={styles.delay}>
      <b>{label}</b>
      <strong>
        {span.reference} {trunc(span.title, 56)}
      </strong>
      <small>
        {nature(span)}, {words(span.status).toLowerCase()}
      </small>
    </span>
  );
}

function PairLine({ pair }: { pair: Pair }) {
  return (
    <li className={styles.item}>
      <DelayText label="One delay" span={pair.a} />
      <DelayText label="Ran alongside" span={pair.b} />

      <span className={styles.verdict}>
        <strong className={styles.overlapDays}>{dayCount(pair.days)}</strong>
        <small>{pair.days === 1 ? formatDay(pair.from) : `${formatDay(pair.from)} to ${formatDay(pair.to)}`}</small>
        <em className={cx(styles.chip, KIND_CHIP[pair.kind])}>{PAIR_KIND_LABEL[pair.kind]}</em>
        {pair.sameCause && <em className={cx(styles.chip, styles.chipPlain)}>Same cause</em>}
      </span>
    </li>
  );
}

export function ProjectDelayConcurrencyView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<RiskControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [filter, setFilter] = useState<PairFilter>("all");
  const [lanesShown, setLanesShown] = useState(LANES);
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(() => {
    const now = new Date();

    return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectRiskControl(projectId)
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

  const built = useMemo(() => (data ? buildConcurrency(data, today, windowDays) : null), [data, today, windowDays]);
  const concurrency: Concurrency | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (concurrency ? filterPairs(concurrency.pairs, filter) : []), [concurrency, filter]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const maxCauseDays = concurrency ? Math.max(1, ...concurrency.causes.map((row) => row.days)) : 1;

  async function copySummary() {
    if (!concurrency) {
      return;
    }

    const ok = await copyText(concurrencyMarkdown(concurrency, list, projectName, windowLabel, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the delay concurrency as Markdown." : "Could not copy the delay concurrency.");
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

            <div className="eyebrow">DELAY CONCURRENCY</div>

            <h1>How much do the delays overlap?</h1>

            <p className={styles.subtitle}>
              When delays run at the same time, adding up their days counts some calendar days more than once. This page lays the delay events on a calendar, shows how many days are counted twice, and lists which delays ran alongside each other. It describes timing only: whether a delay is excusable or compensable is as recorded, and what an overlap means depends on the contract.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/entitlement-board`}>
              Entitlement board
            </Link>

            <Link className="secondary-link-button" href={`${base}/risk-board`}>
              Risk board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the delay events…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the risk data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No delay events have been logged yet, so there is nothing to compare.</div>
          </section>
        )}

        {state === "ready" && concurrency && (
          <>
            <section aria-label="Delay concurrency summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>DELAYS</div>
                <div className={styles.kpiValue}>{concurrency.delays}</div>
                <div className={styles.kpiSub}>active in the last {windowLabel}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DAYS ADDED UP</div>
                <div className={styles.kpiValue}>{concurrency.sumDays}</div>
                <div className={styles.kpiSub}>each delay counted on its own</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CALENDAR DAYS</div>
                <div className={styles.kpiValue}>{concurrency.calendarDays}</div>
                <div className={styles.kpiSub}>days with a delay running</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVERLAP DAYS</div>
                <div className={styles.kpiValue}>{concurrency.overlapDays}</div>
                <div className={styles.kpiSub}>{concurrency.overlapShare === null ? "no delay in this period" : `${pct(concurrency.overlapShare)} of days added up`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MIXED DAYS</div>
                <div className={styles.kpiValue}>{concurrency.concurrentDays}</div>
                <div className={styles.kpiSub}>excusable beside non-excusable</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Active in the last</span>

                <div aria-label="Period measured" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={windowDays === option.days}
                      className={cx(styles.segment, windowDays === option.days && styles.segmentOn)}
                      key={option.days}
                      onClick={() => {
                        setWindowDays(option.days);
                        setLanesShown(LANES);
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
                <span className={styles.controlLabel}>Overlaps</span>

                <div aria-label="Which overlaps to list" className={styles.segmented} role="group">
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

            {concurrency.delays === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No delay was active in this period. Try a longer period.</div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">ON A CALENDAR</div>
                      <h2>When each delay ran</h2>
                    </div>

                    <span className={styles.muted}>
                      {formatDay(concurrency.from)} to {formatDay(concurrency.to)}
                    </span>
                  </header>

                  <div className={styles.chart}>
                    <div aria-hidden="true" className={styles.axis}>
                      <span />
                      <span className={styles.axisTrack}>
                        {concurrency.ticks.map((tick) => (
                          <em key={`${tick.label}-${tick.left}`} style={{ left: `${tick.left}%` }}>
                            {tick.label}
                          </em>
                        ))}
                      </span>
                    </div>

                    <ol className={styles.lanes}>
                      {concurrency.spans.slice(0, lanesShown).map((span) => (
                        <Lane key={span.key} runs={concurrency.runs} span={span} />
                      ))}
                    </ol>
                  </div>

                  {concurrency.spans.length > lanesShown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setLanesShown((current) => current + LANES)} type="button">
                        Show {Math.min(LANES, concurrency.spans.length - lanesShown)} more
                      </button>
                      <span className={styles.muted}>
                        {lanesShown} of {concurrency.spans.length} delays shown
                      </span>
                    </div>
                  )}

                  <ul className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.barExcusable)} />
                      Excusable
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.barOther)} />
                      Not excusable
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.barForecast, styles.barOther)} />
                      No end date, drawn for the forecast days
                    </li>
                    {concurrency.runs.length > 0 && (
                      <li>
                        <i className={cx(styles.swatch, styles.shade)} />
                        Two or more delays running
                      </li>
                    )}
                  </ul>

                  <p className={styles.hint}>
                    {concurrency.peak > 1 && concurrency.peakDay !== null ? `At most ${concurrency.peak} delays ran at once, first on ${formatDay(concurrency.peakDay)}.` : "No two delays ran at the same time."}
                    {concurrency.forecastWindows > 0 ? ` ${concurrency.forecastWindows} ${plural(concurrency.forecastWindows, "delay has", "delays have")} no end date, so ${plural(concurrency.forecastWindows, "its", "their")} length is the forecast delay days (at least one day).` : ""}
                  </p>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">BY CAUSE</div>
                      <h2>Which causes ran alongside others</h2>
                    </div>

                    <span className={styles.muted}>
                      {concurrency.causes.length} {plural(concurrency.causes.length, "cause", "causes")}
                    </span>
                  </header>

                  <ul className={styles.rates}>
                    {concurrency.causes.map((row) => (
                      <li className={styles.groupRow} key={row.cause}>
                        <span className={styles.what}>
                          <strong>{row.label}</strong>
                          <small>
                            {row.delays} {plural(row.delays, "delay", "delays")}
                          </small>
                        </span>

                        <span aria-label={`${row.label}: ${dayCount(row.days)}, ${row.shared} shared with another cause`} className={styles.track} role="img">
                          <i className={cx(styles.fill, styles.fillQuiet)} style={{ width: `${(row.days / maxCauseDays) * 100}%` }} />
                          {row.shared > 0 && <i className={cx(styles.fill, styles.fillShared)} style={{ width: `${(row.shared / maxCauseDays) * 100}%` }} />}
                        </span>

                        <span className={styles.rateFig}>
                          <b>{dayCount(row.days)}</b>
                          <small>
                            {row.shared} shared ({pct(row.share)})
                          </small>
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className={styles.hint}>
                    {concurrency.causes.some((row) => row.shared > 0) ? "The dark part of each bar is the days when a delay with a different cause was also running. " : "No cause ran alongside a different cause in this period. "}A cause is counted once per calendar day, however many of its delays ran that day.
                  </p>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">OVERLAP BY OVERLAP</div>
                      <h2>Delays that ran at the same time</h2>
                    </div>

                    <span className={styles.muted}>
                      {list.length} of {concurrency.pairs.length} {plural(concurrency.pairs.length, "overlap", "overlaps")}, longest first
                    </span>
                  </header>

                  {concurrency.pairs.length === 0 ? (
                    <p className={styles.quiet}>No two delays ran at the same time in this period.</p>
                  ) : list.length === 0 ? (
                    <p className={styles.quiet}>No overlap matches this selection.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {list.slice(0, shown).map((pair) => (
                          <PairLine key={pair.key} pair={pair} />
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
              A delay occupies the dates from its start to its end date. A delay with no end date, or an end date before its start, occupies its forecast delay days from its start, and at least one day. Only days up to today are counted, and a delay that started before the period is counted from the first day of the period. &quot;Days added up&quot; is the total of every delay&apos;s days; &quot;calendar days&quot; counts each day once; the difference is the overlap. &quot;Mixed days&quot; are days when a delay recorded as excusable and one recorded as not excusable were both running. Excusable and compensable are shown as recorded and are not judged here.
              {concurrency.outside > 0 ? ` ${concurrency.outside} ${plural(concurrency.outside, "delay ended", "delays ended")} before this period and ${plural(concurrency.outside, "is", "are")} left out.` : ""}
              {concurrency.future > 0 ? ` ${concurrency.future} ${plural(concurrency.future, "delay starts", "delays start")} in the future and ${plural(concurrency.future, "is", "are")} left out.` : ""}
              {concurrency.skipped > 0 ? ` ${concurrency.skipped} ${plural(concurrency.skipped, "delay has", "delays have")} no usable start date and ${plural(concurrency.skipped, "is", "are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
