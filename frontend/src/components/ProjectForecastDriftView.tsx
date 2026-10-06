"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { type ChartSeries, LineChart } from "@/components/LineChart";
import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectForecast } from "@/lib/api";
import { BIG_COST, BIG_FINISH, DEFAULT_WINDOW, PAGE, STALE_AFTER, WINDOWS, buildDrift, daysText, driftMarkdown, finishText, ratio, shortDay, signedDays, signedMoney, signedPct, tallyText, type Drift, type Step, type Tally } from "@/lib/forecastDrift";
import { formatDay, money, plural, startOfToday } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { ForecastControl } from "@/types/project";

import styles from "./ProjectForecastDriftView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function ScrollChart({ children }: { children: ReactNode }) {
  return (
    <>
      <div className={styles.chartScroll}>
        <div className={styles.chartInner}>{children}</div>
      </div>

      <p className={styles.swipe}>Swipe sideways to see the latest snapshots.</p>
    </>
  );
}

function Direction({ label, tally, worse, better, largest }: { label: string; tally: Tally; worse: string; better: string; largest: string }) {
  const total = tally.worse + tally.better + tally.flat;

  return (
    <li className={styles.dirRow}>
      <strong>{label}</strong>

      <span
        aria-label={`${label}: ${tallyText(tally, worse, better)}`}
        className={styles.split}
        role="img"
      >
        {tally.worse > 0 && <i className={styles.splitBad} style={{ flexGrow: tally.worse }} title={`${worse} ${tally.worse}`} />}
        {tally.flat > 0 && <i className={styles.splitFlat} style={{ flexGrow: tally.flat }} title={`unchanged ${tally.flat}`} />}
        {tally.better > 0 && <i className={styles.splitGood} style={{ flexGrow: tally.better }} title={`${better} ${tally.better}`} />}
      </span>

      <span>
        {total === 0 ? "no updates to compare" : tallyText(tally, worse, better)}
        <small>{largest}</small>
      </span>
    </li>
  );
}

function StepRow({ step }: { step: Step }) {
  const cost = step.dEac;
  const finish = step.dFinish;

  return (
    <li className={styles.row}>
      <span>
        <strong>{formatDay(step.to.date)}</strong>
        <small>{step.gap} d after the last</small>
      </span>

      <span>
        <b>{money(step.to.eac)}</b>
        <em className={cx(styles.chip, cost > 0 ? styles.chipBad : cost < 0 ? styles.chipGood : styles.chipPlain)}>{cost === 0 ? "no change" : signedMoney(cost)}</em>
        {step.bigCost && <em className={styles.tag}>large</em>}
      </span>

      <span>
        <b>{step.to.finish !== null ? formatDay(step.to.finish) : "not recorded"}</b>
        <em className={cx(styles.chip, finish === null ? styles.chipPlain : finish > 0 ? styles.chipBad : finish < 0 ? styles.chipGood : styles.chipPlain)}>{finish === null ? "—" : finish === 0 ? "no change" : finishText(finish)}</em>
        {step.bigFinish && <em className={styles.tag}>large</em>}
      </span>

      <span className={styles.ratios}>
        CPI {ratio(step.to.cpi)}
        <small>SPI {ratio(step.to.spi)}</small>
      </span>
    </li>
  );
}

export function ProjectForecastDriftView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ForecastControl | null>(null);
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

    getProjectForecast(projectId)
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

  const built = useMemo(() => (data ? buildDrift(data, today, windowDays) : null), [data, today, windowDays]);
  const drift: Drift | null = built && built.ok ? built.drift : null;
  const projectName = data?.project?.name ?? "Project";
  const hasSteps = drift !== null && drift.steps.length > 0;

  const charts = useMemo(() => {
    if (!drift) {
      return null;
    }

    const eac: ChartSeries = {
      name: "Estimate at completion",
      color: "#c9685d",
      points: drift.window.map((snap) => ({ x: snap.date, y: snap.eac })),
    };
    const finish: ChartSeries = {
      name: "Forecast finish",
      color: "#4f6f8a",
      points: drift.window.filter((snap) => snap.finish !== null).map((snap) => ({ x: snap.date, y: snap.finish as number })),
    };

    return { eac, finish };
  }, [drift]);

  const steps = useMemo(() => (drift ? [...drift.steps].reverse() : []), [drift]);

  async function copySummary() {
    if (!drift) {
      return;
    }

    const ok = await copyText(driftMarkdown(drift, projectName, today));

    setMessage(ok ? "Copied the drift summary as Markdown." : "Could not copy the drift summary.");
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

            <div className="eyebrow">FORECAST DRIFT</div>

            <h1>Is the forecast settling down, or still moving?</h1>

            <p className={styles.subtitle}>
              A forecast that moves a little each time it is refreshed is being corrected; one that keeps moving the same way is being chased. This sets the saved forecast snapshots side by side to show how far the cost estimate and finish date have travelled, and in which direction.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/scenarios`}>
              Scenario board
            </Link>

            <Link className="secondary-link-button" href={`${base}/progress-curve`}>
              Progress curve
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the forecast snapshots…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the forecast. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No forecast snapshots are saved yet, so there is nothing to compare. Snapshots are saved each time the forecast is refreshed.</div>
          </section>
        )}

        {state === "ready" && drift && charts && (
          <>
            <section aria-label="Forecast drift summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>ESTIMATE AT COMPLETION</div>
                <div className={styles.kpiValue}>{money(drift.last.eac)}</div>
                <div className={styles.kpiSub}>{drift.last.bac > 0 ? `${money(Math.abs(drift.vac))} ${drift.vac < 0 ? "over" : "under"} the ${money(drift.last.bac)} budget` : "no budget on the snapshot"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COST MOVED</div>
                <div className={cx(styles.kpiValue, hasSteps && drift.dEac > 0 && styles.neg, hasSteps && drift.dEac < 0 && styles.pos)}>{hasSteps ? signedMoney(drift.dEac) : "—"}</div>
                <div className={styles.kpiSub}>{hasSteps ? `${signedPct(drift.dEacShare)} since ${formatDay(drift.base.date)}` : "needs a second snapshot"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST FINISH</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>{drift.last.finish !== null ? formatDay(drift.last.finish) : "—"}</div>
                <div className={styles.kpiSub}>as forecast on {formatDay(drift.last.date)}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FINISH MOVED</div>
                <div className={cx(styles.kpiValue, hasSteps && drift.dFinish !== null && drift.dFinish > 0 && styles.neg, hasSteps && drift.dFinish !== null && drift.dFinish < 0 && styles.pos)}>{hasSteps ? signedDays(drift.dFinish) : "—"}</div>
                <div className={styles.kpiSub}>{hasSteps && drift.dFinish !== null ? finishText(drift.dFinish) : "needs a second snapshot"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LAST UPDATED</div>
                <div className={cx(styles.kpiValue, drift.stale && styles.neg)}>{drift.sinceLast === 0 ? "Today" : `${drift.sinceLast} d`}</div>
                <div className={styles.kpiSub}>
                  {drift.snaps.length} {plural(drift.snaps.length, "snapshot", "snapshots")} on record
                </div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Compare over</span>

                <div aria-label="Period compared" className={styles.segmented} role="group">
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

            {drift.stale && (
              <p className={styles.caution} role="note">
                The latest snapshot is {daysText(drift.sinceLast)} old (more than {STALE_AFTER}), so the forecast may not reflect where the project is now. Refresh the forecast to save a new snapshot.
              </p>
            )}

            {hasSteps && !drift.coversWindow && (
              <p className={styles.caution} role="note">
                The snapshots only go back to {formatDay(drift.base.date)}, so this compares with the first one on record rather than a full {WINDOWS.find((option) => option.days === windowDays)?.label ?? "period"} ago.
              </p>
            )}

            {!hasSteps ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>Only one forecast snapshot falls in this period, so there is no movement to measure yet. Drift shows up once the forecast has been saved at least twice.</div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">DIRECTION OF TRAVEL</div>
                      <h2>Which way each update moved the forecast</h2>
                    </div>

                    <span className={styles.muted}>
                      {drift.steps.length} {plural(drift.steps.length, "update", "updates")}, {formatDay(drift.base.date)} to {formatDay(drift.last.date)}
                    </span>
                  </header>

                  <ul className={styles.dirs}>
                    <Direction
                      better="lowered"
                      label="Cost estimate"
                      largest={drift.largestCost ? `largest move ${signedMoney(drift.largestCost.dEac)} on ${formatDay(drift.largestCost.to.date)}` : "never moved"}
                      tally={drift.cost}
                      worse="raised"
                    />

                    <Direction
                      better="pulled earlier"
                      label="Finish date"
                      largest={drift.largestFinish ? `largest move ${signedDays(drift.largestFinish.dFinish)} on ${formatDay(drift.largestFinish.to.date)}` : "never moved"}
                      tally={drift.finish}
                      worse="pushed later"
                    />
                  </ul>

                  <p className={styles.quiet}>
                    {drift.bigMoves === 0
                      ? `No single update moved the finish by ${BIG_FINISH} days or more, or the cost by ${Math.round(BIG_COST * 100)}% of the budget or more.`
                      : `${drift.bigMoves} of ${drift.steps.length} ${plural(drift.steps.length, "update was", "updates were")} large: the finish moved by ${BIG_FINISH} days or more, or the cost by ${Math.round(BIG_COST * 100)}% of the budget or more.`}
                    {drift.eacPerMonth !== null && drift.finishPerMonth !== null
                      ? ` At this pace the estimate is ${drift.eacPerMonth >= 0 ? "rising" : "falling"} by about ${money(Math.abs(drift.eacPerMonth))} a month and the finish moving ${drift.finishPerMonth >= 0 ? "later" : "earlier"} by about ${Math.abs(drift.finishPerMonth).toFixed(1)} days a month.`
                      : drift.eacPerMonth !== null
                        ? ` At this pace the estimate is ${drift.eacPerMonth >= 0 ? "rising" : "falling"} by about ${money(Math.abs(drift.eacPerMonth))} a month.`
                        : ""}
                  </p>

                  <ul className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.splitBad)} />
                      Higher cost or later finish
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.splitFlat)} />
                      Unchanged
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.splitGood)} />
                      Lower cost or earlier finish
                    </li>
                  </ul>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">COST</div>
                      <h2>Estimate at completion</h2>
                    </div>
                  </header>

                  <ScrollChart>
                    <LineChart
                      ariaLabel="Estimate at completion at each forecast snapshot, against the budget"
                      formatX={formatDay}
                      formatY={money}
                      height={240}
                      refs={drift.last.bac > 0 ? [{ y: drift.last.bac, label: "Budget", color: "#8a948f" }] : []}
                      series={[charts.eac]}
                    />
                  </ScrollChart>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">FINISH</div>
                      <h2>Forecast finish date</h2>
                    </div>
                  </header>

                  {charts.finish.points.length < 2 ? (
                    <p className={styles.quiet}>The snapshots in this period do not carry a usable finish date.</p>
                  ) : (
                    <ScrollChart>
                      <LineChart ariaLabel="Forecast finish date at each forecast snapshot" formatX={formatDay} formatY={shortDay} height={240} series={[charts.finish]} />
                    </ScrollChart>
                  )}
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">UPDATE BY UPDATE</div>
                      <h2>What each snapshot changed</h2>
                    </div>

                    <span className={styles.muted}>newest first</span>
                  </header>

                  <ul className={styles.rows}>
                    {steps.slice(0, shown).map((step) => (
                      <StepRow key={step.to.id} step={step} />
                    ))}

                    {steps.length <= shown && (
                      <li className={cx(styles.row, styles.rowStart)}>
                        <span>
                          <strong>{formatDay(drift.base.date)}</strong>
                          <small>start of the period</small>
                        </span>

                        <span>
                          <b>{money(drift.base.eac)}</b>
                        </span>

                        <span>
                          <b>{drift.base.finish !== null ? formatDay(drift.base.finish) : "not recorded"}</b>
                        </span>

                        <span className={styles.ratios}>
                          CPI {ratio(drift.base.cpi)}
                          <small>SPI {ratio(drift.base.spi)}</small>
                        </span>
                      </li>
                    )}
                  </ul>

                  {steps.length > shown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, steps.length - shown)} more
                      </button>
                      <span className={styles.muted}>
                        {shown} of {steps.length} shown
                      </span>
                    </div>
                  )}
                </section>
              </>
            )}

            <p className={styles.note}>
              Each snapshot is a saved forecast. A change compares a snapshot with the one before it, and the movement in the headline figures compares the latest snapshot with the one at or before the start of the period, counted back from the latest snapshot. Higher cost and later finish are the unfavourable directions. Where two snapshots share a date the later one is used. A large move is a finish date shifting by {BIG_FINISH} days or more, or the cost estimate shifting by {Math.round(BIG_COST * 100)}% of the budget or more, in a single update.
              {drift.collapsed > 0 ? ` ${drift.collapsed} ${plural(drift.collapsed, "snapshot shared", "snapshots shared")} a date with a later one and ${plural(drift.collapsed, "was", "were")} left out.` : ""}
              {drift.skipped > 0 ? ` ${drift.skipped} ${plural(drift.skipped, "snapshot has", "snapshots have")} no usable date or estimate and ${plural(drift.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
