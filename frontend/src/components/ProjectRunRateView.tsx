"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProduction } from "@/lib/api";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { DEFAULT_WINDOW, FILTERS, PAGE, STALE_DAYS, STATE_LABEL, WINDOWS, buildRunRate, endText, filterPacks, paceText, qty, runMarkdown, trendText, verdictText, type Filter, type Pack, type State } from "@/lib/runRate";
import { copyText } from "@/lib/textExport";
import type { ProductionControl } from "@/types/project";

import styles from "./ProjectRunRateView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function stateClass(state: State): string | undefined {
  return state === "onTrack" || state === "quantityDone" ? styles.chipGood : state === "slipping" ? styles.chipWatch : styles.chipBad;
}

function Spark({ pack }: { pack: Pack }) {
  const width = 104;
  const height = 34;
  const gap = 3;
  const barWidth = (width - gap * (pack.weeks.length - 1)) / pack.weeks.length;
  const top = Math.max(...pack.weeks, pack.weeklyRequired ?? 0, 1) * 1.1;
  const y = (value: number) => height - (value / top) * height;

  return (
    <svg aria-label={`${pack.code}: output in each of the last ${pack.weeks.length} weeks${pack.weeklyRequired === null ? "" : `, against ${qty(pack.weeklyRequired)} ${pack.unit} a week needed`}`} className={styles.spark} role="img" viewBox={`0 0 ${width} ${height}`}>
      {pack.weeks.map((value, index) => (
        <rect className={index === pack.weeks.length - 1 ? styles.sparkNow : styles.sparkBar} height={Math.max(value > 0 ? 1.5 : 0, height - y(value))} key={index} rx={1} width={barWidth} x={index * (barWidth + gap)} y={y(value)}>
          <title>{`${qty(value)} ${pack.unit}`}</title>
        </rect>
      ))}

      {pack.weeklyRequired !== null && <line className={styles.sparkNeed} x1={0} x2={width} y1={y(pack.weeklyRequired)} y2={y(pack.weeklyRequired)} />}
    </svg>
  );
}

function PackRow({ pack }: { pack: Pack }) {
  const scale = Math.max(pack.pace, pack.required ?? 0, 0.000001);
  const trend = trendText(pack.trend);
  const late = pack.lateDays;

  return (
    <li className={styles.row}>
      <div className={styles.pack}>
        <div className={styles.title}>
          <strong>{pack.code}</strong>
          <span>{trunc(pack.name, 48)}</span>
        </div>

        <div className={styles.tags}>
          <em className={cx(styles.chip, stateClass(pack.state))}>{STATE_LABEL[pack.state]}</em>
          {pack.status === "BLOCKED" && <em className={styles.blockedTag}>Blocked</em>}
        </div>

        {pack.blockReason && <small className={styles.reason}>{trunc(pack.blockReason, 90)}</small>}
      </div>

      <div className={styles.progress}>
        <span aria-hidden="true" className={styles.track}>
          <i className={styles.fill} style={{ width: `${pack.percent}%` }} />
          <b className={styles.expected} style={{ left: `${pack.expected}%` }} />
        </span>
        <span>
          <strong>{Math.round(pack.percent)}%</strong> done
        </span>
        <small>{Math.round(pack.expected)}% expected by now</small>
      </div>

      <div className={styles.pace}>
        <span aria-hidden="true" className={styles.track}>
          <i className={cx(styles.fill, pack.state === "onTrack" || pack.state === "quantityDone" ? styles.fillGood : styles.fillBad)} style={{ width: `${Math.min(100, (pack.pace / scale) * 100)}%` }} />
          {pack.required !== null && !pack.overdue && <b className={styles.need} style={{ left: `${Math.min(100, (pack.required / scale) * 100)}%` }} />}
        </span>
        <span>
          <strong>{paceText(pack.pace, pack.unit)}</strong> now
        </span>
        <small>
          {pack.required === null ? "nothing left to build" : pack.overdue ? `${qty(pack.remaining)} ${pack.unit} left and the end date has passed` : `needs ${paceText(pack.required, pack.unit)} for ${qty(pack.remaining)} ${pack.unit} left`}
        </small>
        {trend && <small className={styles.trend}>{trend}</small>}
      </div>

      <div className={styles.finish}>
        <span>
          Planned end <strong>{formatDay(pack.end)}</strong>
        </span>
        <span className={cx(styles.verdict, late !== null && late > 0 && styles.verdictBad, late !== null && late <= 0 && styles.verdictGood)}>{verdictText(pack)}</span>
        {pack.forecast !== null && pack.state !== "quantityDone" && <small>At this pace: {formatDay(pack.forecast)}</small>}
        <small className={pack.overdue ? styles.overdue : undefined}>{endText(pack)}</small>
      </div>

      <div className={styles.sparkCell}>
        <Spark pack={pack} />
        <small>8 weeks of output</small>
      </div>
    </li>
  );
}

export function ProjectRunRateView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ProductionControl | null>(null);
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

    getProjectProduction(projectId)
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

  const built = useMemo(() => (data ? buildRunRate(data, today, windowDays) : null), [data, today, windowDays]);
  const rate = built && built.ok ? built.rate : null;
  const projectName = data?.project?.name ?? "Project";
  const rows = rate ? filterPacks(rate.packs, filter) : [];
  const total = rate ? rate.packs.length : 0;
  const windowText = WINDOWS.find((item) => item.days === windowDays)?.label ?? `${windowDays} days`;

  async function copySummary() {
    if (!rate) {
      return;
    }

    const ok = await copyText(runMarkdown(rate, rows, projectName, today));

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

            <div className="eyebrow">RUN RATE</div>

            <h1>Will each work package finish on time at its current pace?</h1>

            <p className={styles.subtitle}>
              Output logged on site over recent weeks, set against what each package still has to deliver before its planned end. Where the pace falls short, the page shows when the work would really finish.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/production-board`}>
              Production board
            </Link>

            <Link className="secondary-link-button" href={`${base}/trade-flow`}>
              Trade flow
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the site reports…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the production data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No work packages have been set up yet, so there is no output to measure.</div>
          </section>
        )}

        {state === "ready" && rate && (
          <>
            <section aria-label="Run rate summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>ON PACE</div>
                <div className={styles.kpiValue}>{rate.counts.onTrack + rate.counts.quantityDone}</div>
                <div className={styles.kpiSub}>of {total} {plural(total, "package", "packages")} in progress would finish on time</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SLIPPING</div>
                <div className={cx(styles.kpiValue, rate.late > 0 && styles.neg)}>{rate.late}</div>
                <div className={styles.kpiSub}>{rate.late > 0 ? "would finish after the planned end" : "none behind the pace they need"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO OUTPUT</div>
                <div className={cx(styles.kpiValue, rate.counts.stalled > 0 && styles.neg)}>{rate.counts.stalled}</div>
                <div className={styles.kpiSub}>{rate.counts.stalled > 0 ? `nothing logged in the last ${windowText}` : "all are producing"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PAST PLANNED END</div>
                <div className={cx(styles.kpiValue, rate.overdue > 0 && styles.neg)}>{rate.overdue}</div>
                <div className={styles.kpiSub}>{rate.overdue > 0 ? "with work still to build" : "none overrunning"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LATEST SITE REPORT</div>
                <div className={cx(styles.kpiValue, styles.kpiText, rate.staleDays > STALE_DAYS && styles.neg)}>{rate.latestReport === null ? "None" : formatDay(rate.latestReport)}</div>
                <div className={styles.kpiSub}>{rate.latestReport === null ? "no report has been accepted yet" : rate.staleDays === 0 ? "pace is measured up to today" : `pace is measured up to ${rate.staleDays} ${plural(rate.staleDays, "day", "days")} ago`}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Pace measured over</span>

                <div aria-label="Period the pace is measured over" className={styles.segmented} role="group">
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
                <span className={styles.controlLabel}>Show</span>

                <div aria-label="Which packages to show" className={styles.segmented} role="group">
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

            {rate.staleDays > STALE_DAYS && (
              <div className="offline-banner">
                <div>
                  <strong>The latest site report is from {formatDay(rate.asOf)}. Pace is measured up to that date, so it may understate what site is producing now.</strong>
                </div>
              </div>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">IN PROGRESS</div>
                  <h2>Pace against what each package needs</h2>
                </div>

                <span className={styles.muted}>
                  {rows.length} of {total} {plural(total, "package", "packages")}, worst first
                </span>
              </header>

              {rows.length === 0 ? (
                <p className={styles.quiet}>{total === 0 ? "No work package is in progress." : "No package matches this view."}</p>
              ) : (
                <>
                  <div aria-hidden="true" className={styles.columns}>
                    <span>Package</span>
                    <span>Progress</span>
                    <span>Pace now and needed</span>
                    <span>Finish</span>
                    <span>Weekly output</span>
                  </div>

                  <ul className={styles.rows}>
                    {rows.slice(0, shown).map((pack) => (
                      <PackRow key={pack.id} pack={pack} />
                    ))}
                  </ul>

                  {rows.length > shown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, rows.length - shown)} more
                      </button>
                      <span className={styles.muted}>
                        {shown} of {rows.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.swatchNow)} />
                  Latest week
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchBar)} />
                  Earlier weeks
                </li>
                <li>
                  <i className={styles.swatchLine} />
                  Weekly output needed
                </li>
                <li>
                  <i className={styles.swatchTick} />
                  Where the bar needs to reach, or the progress expected by now
                </li>
              </ul>
            </section>

            {rate.waiting.length > 0 && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">NOT STARTED</div>
                    <h2>Packages still waiting to begin</h2>
                  </div>

                  <span className={styles.muted}>
                    {rate.waiting.length} {plural(rate.waiting.length, "package", "packages")}
                  </span>
                </header>

                <ul className={styles.waiting}>
                  {rate.waiting.map((item) => (
                    <li key={item.id}>
                      <strong>{item.code}</strong>
                      <span>{trunc(item.name, 60)}</span>
                      <span className={styles.muted}>
                        {qty(item.planned)} {item.unit}
                      </span>
                      <span className={item.late ? styles.overdue : styles.muted}>{item.start === null ? "No start date" : item.late ? `should have started ${formatDay(item.start)}` : `starts ${formatDay(item.start)}`}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <p className={styles.note}>
              Pace is the quantity logged against a package per calendar day over the period you pick, ending on the date of the latest site report that is not a draft. What a package needs is the quantity still to build divided by the days left to its planned end, or the whole quantity left once that date has passed. A package is on pace when its pace covers that, slipping when it covers at least three quarters of it, and well behind below that or once its end date has passed; one with no output in the period is shown as having none. The finish date assumes the recent pace simply carries on, with no allowance for weather, hold-ups or a change of crew. A package that started inside the period is measured from its first day. Output from draft site reports is left out
              {rate.draftEntries > 0 ? ` (${rate.draftEntries} ${plural(rate.draftEntries, "entry", "entries")} at the moment)` : ""}, and the quantity done is the figure held on the work package, so the two can differ where site reports are missing.
              {rate.completed > 0 ? ` ${rate.completed} completed ${plural(rate.completed, "package is", "packages are")} not shown.` : ""}
              {rate.skipped > 0 ? ` ${rate.skipped} ${plural(rate.skipped, "package has", "packages have")} no planned end date or quantity and ${plural(rate.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
