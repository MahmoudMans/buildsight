"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProduction, getProjectResources, getProjectSafety } from "@/lib/api";
import { formatDay, plural, startOfToday, toDay, trunc, words } from "@/lib/openItems";
import { BASES, DEFAULT_BASE, DEFAULT_WINDOW, LOW_EXPOSURE, PAGE, WINDOWS, baseText, buildRates, compactHours, hoursText, rateText, ratesMarkdown, sinceText, sourceText, windowText, type MonthRow, type Rates, type RateSources, type WindowKey } from "@/lib/safetyRates";
import { copyText } from "@/lib/textExport";
import type { ProductionControl, ResourceControl, SafetyControl } from "@/types/project";

import styles from "./ProjectSafetyRatesView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

interface Loaded extends RateSources {
  hoursFailed: boolean;
}

function Chart({ rates }: { rates: Rates }) {
  const top = Math.max(0.0001, ...rates.months.map((month) => month.rolling ?? 0));
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scroller.current;

    if (node) {
      node.scrollLeft = node.scrollWidth;
    }
  }, [rates.months.length]);

  return (
    <div className={styles.chartScroll} ref={scroller}>
      <div className={styles.chart}>
        {rates.months.map((month: MonthRow) => (
          <div
            className={styles.col}
            key={month.month}
            title={`${month.label}: ${month.recordables} ${plural(month.recordables, "recordable incident", "recordable incidents")} this month. The 12 months to the end of it had ${month.rollingRecordables} in ${hoursText(month.rollingHours)} hours, a rate of ${rateText(month.rolling)}${month.low && month.rolling !== null ? ", which rests on little exposure" : ""}.`}
          >
            <span className={styles.colValue}>{rateText(month.rolling)}</span>

            <span className={styles.colTrack}>
              <span className={cx(styles.colBar, month.low && styles.colLow)} style={{ height: `${month.rolling === null ? 0 : Math.max(1.5, (month.rolling / top) * 100)}%` }} />
            </span>

            <span className={styles.colMonth}>{month.short}</span>
            <span className={styles.colHours}>{month.hours > 0 ? `${compactHours(month.hours)} h` : "no hours"}</span>

            <span className={styles.colRec}>{month.recordables > 0 && <em className={styles.recPill}>{month.recordables}</em>}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProjectSafetyRatesView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowKey, setWindowKey] = useState<WindowKey>(DEFAULT_WINDOW);
  const [basis, setBasis] = useState(DEFAULT_BASE);
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    Promise.allSettled([getProjectSafety(projectId), getProjectResources(projectId), getProjectProduction(projectId)]).then(([safety, resources, production]) => {
      if (cancelled) {
        return;
      }

      if (safety.status !== "fulfilled") {
        setState("error");
        return;
      }

      const res: ResourceControl | null = resources.status === "fulfilled" ? resources.value : null;
      const prod: ProductionControl | null = production.status === "fulfilled" ? production.value : null;
      const sources: SafetyControl = safety.value;

      setData({ safety: sources, resources: res, production: prod, hoursFailed: res === null && prod === null });
      setState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const built = useMemo(() => (data ? buildRates(data, today, windowKey, basis) : null), [data, today, windowKey, basis]);
  const rates = built && built.ok ? built.rates : null;
  const projectName = data?.safety.project?.name ?? "Project";
  const per = `per ${baseText(basis)} hours`;
  const noHours = rates !== null && rates.source === "none";

  async function copySummary() {
    if (!rates) {
      return;
    }

    const ok = await copyText(ratesMarkdown(rates, projectName, today));

    setMessage(ok ? "Copied the figures as Markdown." : "Could not copy the figures.");
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

            <div className="eyebrow">SAFETY RATES</div>

            <h1>How often are people getting hurt, for the hours we work?</h1>

            <p className={styles.subtitle}>
              Incident counts mean little until they are set against exposure. This divides recordable and lost-time injuries by the labour hours logged on site, so a busy month and a quiet one can be compared fairly.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/safety-board`}>
              Safety board
            </Link>

            <Link className="secondary-link-button" href={`${base}/resource-heatmap`}>
              Resource heatmap
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the incident log and labour hours…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the safety data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{data?.hoursFailed ? "No incidents are recorded, and the labour hours could not be loaded." : "No incidents are recorded and no labour hours are logged yet, so there is nothing to measure."}</div>
          </section>
        )}

        {state === "ready" && rates && (
          <>
            <section aria-label="Safety rate summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>RECORDABLE RATE</div>
                <div className={styles.kpiValue}>{rateText(rates.recordableRate)}</div>
                <div className={styles.kpiSub}>
                  {rates.recordables} {plural(rates.recordables, "recordable incident", "recordable incidents")}, {per}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LOST-TIME RATE</div>
                <div className={cx(styles.kpiValue, rates.lostTime > 0 && styles.neg)}>{rateText(rates.lostTimeRate)}</div>
                <div className={styles.kpiSub}>
                  {rates.lostTime} lost-time {plural(rates.lostTime, "injury", "injuries")}, {per}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SEVERITY RATE</div>
                <div className={styles.kpiValue}>{rateText(rates.severityRate)}</div>
                <div className={styles.kpiSub}>
                  {rates.lostDays} {plural(rates.lostDays, "day", "days")} lost, {per}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>HOURS WORKED</div>
                <div className={styles.kpiValue}>{noHours ? "—" : hoursText(rates.hours)}</div>
                <div className={styles.kpiSub}>{noHours ? "no labour hours logged" : `from ${sourceText(rates.source)}`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SINCE LAST RECORDABLE</div>
                <div className={cx(styles.kpiValue, rates.sinceRecordable === null && styles.pos)}>{sinceText(rates)}</div>
                <div className={styles.kpiSub}>{rates.lastRecordable === null ? "no recordable incident on file" : `on ${formatDay(rates.lastRecordable)}`}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Period</span>

                <div aria-label="Period measured" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={windowKey === option.key}
                      className={cx(styles.segment, windowKey === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setWindowKey(option.key);
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
                <span className={styles.controlLabel}>Rates</span>

                <div aria-label="Rate basis" className={styles.segmented} role="group">
                  {BASES.map((option) => (
                    <button
                      aria-pressed={basis === option.value}
                      className={cx(styles.segment, basis === option.value && styles.segmentOn)}
                      key={option.value}
                      onClick={() => {
                        setBasis(option.value);
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

            {noHours && (
              <div className="offline-banner">
                <div>
                  <strong>{data?.hoursFailed ? "The labour hours could not be loaded, so no rates can be worked out. The incident counts below are still right." : "No labour hours are logged yet, so no rates can be worked out. The incident counts below are still right."}</strong>
                </div>
              </div>
            )}

            {rates.low && rates.oneMoves !== null && (
              <p className={styles.caution} role="note">
                Only {hoursText(rates.hours)} hours sit behind this period (under {hoursText(LOW_EXPOSURE)}), so the rates swing sharply: one more recordable incident would add {rateText(rates.oneMoves)} to the recordable rate.
              </p>
            )}

            {rates.unexposed > 0 && !noHours && (
              <p className={styles.caution} role="note">
                {rates.unexposed} {plural(rates.unexposed, "incident happened", "incidents happened")} in {plural(rates.unexposed, "a month", "months")} with no labour hours logged. {plural(rates.unexposed, "It is", "They are")} counted, but the hours behind {plural(rates.unexposed, "it are", "them are")} missing, which pushes the rates up.
              </p>
            )}

            {!noHours && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">TREND</div>
                    <h2>Rolling 12-month recordable rate</h2>
                  </div>

                  <span className={styles.muted}>{rates.months.length} months, {per}</span>
                </header>

                {rates.months.every((month) => month.rolling === null) ? (
                  <p className={styles.quiet}>There are no labour hours in these months, so there is nothing to chart.</p>
                ) : (
                  <Chart rates={rates} />
                )}

                <ul className={styles.legend}>
                  <li>
                    <i className={cx(styles.swatch, styles.swatchBar)} />
                    Recordable incidents in the 12 months to the end of that month, over the hours worked in them
                  </li>
                  <li>
                    <i className={cx(styles.swatch, styles.swatchLow)} />
                    Under {hoursText(LOW_EXPOSURE)} hours behind it, so read with care
                  </li>
                  <li>
                    <em className={styles.recPill}>1</em>
                    Recordable incidents in that month
                  </li>
                </ul>
              </section>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WHAT IS COUNTED</div>
                  <h2>Incidents by class</h2>
                </div>

                <span className={styles.muted}>
                  {rates.incidents} {plural(rates.incidents, "incident", "incidents")} in {windowText(rates)}
                </span>
              </header>

              <ul className={styles.classRows}>
                <li aria-hidden="true" className={cx(styles.classRow, styles.classHead)}>
                  <span>Class</span>
                  <span className={styles.classNum}>Count</span>
                  <span className={styles.classNum}>Rate</span>
                  <span>In the recordable rate</span>
                </li>

                {rates.classRows.map((row) => (
                  <li className={styles.classRow} key={row.cls}>
                    <span className={styles.className}>
                      <strong>{row.label}</strong>
                      <small>{row.note}</small>
                    </span>

                    <span className={styles.classNum}>{row.count}</span>
                    <span className={styles.classNum}>{rateText(row.rate)}</span>

                    <span className={styles.classCounted}>
                      <em className={cx(styles.chip, row.recordable ? styles.chipBad : styles.chipPlain)}>{row.recordable ? "Counted" : "Not counted"}</em>
                    </span>
                  </li>
                ))}
              </ul>

              <p className={styles.ratio}>
                {rates.nearMissRatio === null ? "There is no recordable incident in this period, so there is no near-miss ratio." : `${rates.counts.nearMiss} near ${plural(rates.counts.nearMiss, "miss", "misses")} were reported for every ${rates.recordables} recordable ${plural(rates.recordables, "incident", "incidents")}, ${rates.nearMissRatio.toFixed(1)} to one. More near misses reported per injury usually means hazards are being caught early.`}
              </p>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BEHIND THE RATE</div>
                  <h2>Recordable incidents in this period</h2>
                </div>

                <span className={styles.muted}>
                  {rates.counted.length} {plural(rates.counted.length, "incident", "incidents")}
                </span>
              </header>

              {rates.counted.length === 0 ? (
                <p className={styles.quiet}>No recordable incident was reported in this period.</p>
              ) : (
                <>
                  <ul className={styles.incidents}>
                    {rates.counted.slice(0, shown).map((item) => (
                      <li className={styles.incident} key={item.id}>
                        <span>
                          <strong>{formatDay(toDay(item.occurredDate))}</strong>
                          <small>{item.reference}</small>
                        </span>

                        <span className={styles.incidentWhat}>
                          {trunc(item.title, 70)}
                          {item.location && <small>{item.location}</small>}
                        </span>

                        <span>
                          {item.incidentType === "LOST_TIME_INJURY" ? "Lost-time injury" : "Medical treatment"}
                          <small>
                            {words(item.severity)} severity, {item.lostTimeDays > 0 ? `${item.lostTimeDays} ${plural(item.lostTimeDays, "day", "days")} lost` : "no days lost"}
                          </small>
                        </span>

                        <span>
                          <em className={cx(styles.chip, item.status === "CLOSED" ? styles.chipGood : styles.chipWatch)}>{words(item.status)}</em>
                        </span>
                      </li>
                    ))}
                  </ul>

                  {rates.counted.length > shown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, rates.counted.length - shown)} more
                      </button>
                      <span className={styles.muted}>
                        {shown} of {rates.counted.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>

            <p className={styles.note}>
              Each rate is incidents multiplied by {baseText(rates.base)} and divided by the hours worked. Recordable means medical treatment cases and lost-time injuries; first aid cases, near misses, property damage and environmental incidents are not counted, and neither are voided incidents. The severity rate divides the days lost recorded on incidents. Incidents are placed by the date they occurred, and hours by the date they were worked. The hours are the labour hours logged on site{noHours ? "" : ` (${sourceText(rates.source)})`}, so hours worked by crews or subcontractors that are never logged are missing and would push every rate up. An incident counts once however many people it affected. The figures cover {windowText(rates)}.
              {rates.skipped > 0 ? ` ${rates.skipped} ${plural(rates.skipped, "incident has", "incidents have")} no usable date and ${plural(rates.skipped, "was", "were")} left out.` : ""}
              {rates.skippedHours > 0 ? ` ${rates.skippedHours} labour ${plural(rates.skippedHours, "record has", "records have")} no usable date and ${plural(rates.skippedHours, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
