"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectResources } from "@/lib/api";
import { DEFAULT_WINDOW, FILTERS, OVER, PAGE, SHORT, VERDICT_LABEL, WINDOWS, buildCrewPlan, crewMarkdown, crewText, filterRows, numberText, pct, periodText, type CrewPlan, type PlanRow, type TradeRow, type Verdict, type Week } from "@/lib/crewPlan";
import { formatDay, plural, startOfToday } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { ResourceControl } from "@/types/project";

import styles from "./ProjectCrewPlanView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const FILL: Record<Verdict, string | undefined> = {
  short: styles.fillShort,
  onPlan: styles.fillOn,
  over: styles.fillOver,
  absent: styles.fillShort,
};

const CHIP: Record<Verdict, string | undefined> = {
  short: styles.chipWatch,
  onPlan: styles.chipGood,
  over: styles.chipPlain,
  absent: styles.chipBad,
};

const SCALE = 1.5;

function PlanBar({ attendance, verdict, label }: { attendance: number; verdict: Verdict; label: string }) {
  return (
    <span aria-label={label} className={styles.track} role="img">
      <i className={cx(styles.fill, FILL[verdict])} style={{ width: `${(Math.min(attendance, SCALE) / SCALE) * 100}%` }} />
      <i className={styles.mark} />
    </span>
  );
}

function bandOf(attendance: number): Verdict {
  return attendance < SHORT ? "short" : attendance > OVER ? "over" : "onPlan";
}

function Chart({ data, today }: { data: CrewPlan; today: number }) {
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scroller.current;

    if (node) {
      node.scrollLeft = node.scrollWidth;
    }
  }, [data.weeks.length]);

  return (
    <div className={styles.chartScroll} ref={scroller}>
      <div className={styles.chart}>
        {data.weeks.map((week: Week) => {
          const partial = week.from < data.from || week.from + 6 > today;
          const band = week.attendance === null ? null : bandOf(week.attendance);

          return (
            <div
              className={styles.col}
              key={week.from}
              title={week.attendance === null ? `Week commencing ${formatDay(week.from)}: no planned crew on a site day.` : `Week commencing ${formatDay(week.from)}${partial ? " (part of a week inside this period)" : ""}: ${numberText(week.crew)} of ${numberText(week.planned)} planned worker-days on site (${pct(week.attendance)}).`}
            >
              <span className={styles.colValue}>{week.attendance === null ? "" : pct(week.attendance)}</span>

              <span className={styles.colTrack}>
                <i className={styles.planLine} />
                {week.attendance !== null && band && <i className={cx(styles.bar, FILL[band])} style={{ height: `${(Math.min(week.attendance, SCALE) / SCALE) * 100}%` }} />}
              </span>

              <span className={styles.colLabel}>{formatDay(week.from).slice(0, 6).trim()}</span>
              <span className={styles.colSub}>{partial ? "part week" : " "}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TradeLine({ row }: { row: TradeRow }) {
  return (
    <li className={styles.tradeRow}>
      <span className={styles.what}>
        <strong>{row.trade}</strong>
        <small>
          {row.plans} {plural(row.plans, "plan", "plans")}
        </small>
      </span>

      <PlanBar attendance={row.attendance} label={`${row.trade}: ${pct(row.attendance)} of the planned crew on site`} verdict={row.verdict} />

      <span className={styles.rateFig}>
        <b>{pct(row.attendance)}</b>
        <small>{row.gap > 0 ? `${numberText(row.gap)} worker-days short` : row.gap < 0 ? `${numberText(-row.gap)} worker-days over` : "exactly on plan"}</small>
      </span>
    </li>
  );
}

function PlanLine({ row }: { row: PlanRow }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{row.trade}</strong>
        <small>{periodText(row)}</small>
        <small>
          {row.planned} planned {plural(row.planned, "worker", "workers")}
          {row.packageId ? ", plan for one work package" : ""}
          {row.status === "CLOSED" ? ", closed plan" : ""}
        </small>
      </span>

      <span className={styles.cell}>
        <PlanBar attendance={row.attendance} label={`${row.trade}: ${pct(row.attendance)} of the planned crew on site`} verdict={row.verdict} />
        <b>{pct(row.attendance)}</b> of the planned crew
        <small>
          average {crewText(row.average)} of {row.planned}, peak {row.peak}
        </small>
        <small>
          crew on site {row.daysWithCrew} of {row.siteDays} site {plural(row.siteDays, "day", "days")}
        </small>
      </span>

      <span className={styles.verdict}>
        <em className={cx(styles.chip, CHIP[row.verdict])}>{VERDICT_LABEL[row.verdict]}</em>
        {row.gap > 0 && row.verdict !== "onPlan" && <small>{numberText(row.gap)} worker-days short</small>}
        {row.gap < 0 && row.verdict === "over" && <small>{numberText(-row.gap)} worker-days over</small>}
      </span>
    </li>
  );
}

export function ProjectCrewPlanView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ResourceControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [filter, setFilter] = useState<"all" | "short" | "over" | "absent">("all");
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectResources(projectId)
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

  const built = useMemo(() => (data ? buildCrewPlan(data, today, windowDays) : null), [data, today, windowDays]);
  const crew = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (crew ? filterRows(crew.rows, filter) : []), [crew, filter]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const never = crew ? crew.rows.filter((row) => row.verdict === "absent") : [];

  async function copySummary() {
    if (!crew) {
      return;
    }

    const ok = await copyText(crewMarkdown(crew, list, projectName, windowLabel, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the crew comparison as Markdown." : "Could not copy the crew comparison.");
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

            <div className="eyebrow">CREW SIZE</div>

            <h1>Are the crews on site as big as the plan?</h1>

            <p className={styles.subtitle}>
              Each workforce plan says how many people a trade should have on site. Setting that headcount against the workers recorded each day shows which trades are running short, which are over, and which planned crews never turned up.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/labour-reconciliation`}>
              Labour reconciliation
            </Link>

            <Link className="secondary-link-button" href={`${base}/labour-burn`}>
              Labour budget burn
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the workforce plans and deployments…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the workforce plans and deployments. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "noPlans" ? "No workforce plans have been recorded yet, so there is no planned crew to compare with." : "Workforce plans exist but no daily deployments have been recorded yet, so there is no crew to compare."}</div>
          </section>
        )}

        {state === "ready" && crew && (
          <>
            <section aria-label="Crew size summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>PLANS</div>
                <div className={styles.kpiValue}>{crew.rows.length}</div>
                <div className={styles.kpiSub}>
                  measured across {crew.trades.length} {plural(crew.trades.length, "trade", "trades")} and {crew.siteDays} site {plural(crew.siteDays, "day", "days")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CREW VS PLAN</div>
                <div className={cx(styles.kpiValue, crew.attendance !== null && crew.attendance < SHORT && styles.neg)}>{pct(crew.attendance)}</div>
                <div className={styles.kpiSub}>{crew.rows.length > 0 ? `${numberText(crew.crewDays)} of ${numberText(crew.plannedDays)} planned worker-days` : "no plan covers this period"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SHORT OF PLAN</div>
                <div className={cx(styles.kpiValue, crew.short + crew.absent > 0 && styles.neg)}>{crew.short + crew.absent}</div>
                <div className={styles.kpiSub}>
                  below {Math.round(SHORT * 100)}% of the planned crew{crew.absent > 0 ? `, ${crew.absent} never on site` : ""}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVER PLAN</div>
                <div className={styles.kpiValue}>{crew.over}</div>
                <div className={styles.kpiSub}>above {Math.round(OVER * 100)}% of the planned crew</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SHORTFALL</div>
                <div className={cx(styles.kpiValue, crew.shortfall > 0 && styles.neg)}>{numberText(crew.shortfall)}</div>
                <div className={styles.kpiSub}>worker-days missing on short plans</div>
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
                <span className={styles.controlLabel}>Plans</span>

                <div aria-label="Which plans to list" className={styles.segmented} role="group">
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

            {never.length > 0 && (
              <p className={styles.caution} role="note">
                {never.length} planned {plural(never.length, "crew was", "crews were")} never recorded on site during {plural(never.length, "its", "their")} plan dates: {never.map((row) => row.trade).join(", ")}.
              </p>
            )}

            {crew.rows.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No approved or closed plan covers a recorded site day in this period. Try a longer period.</div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">WEEK BY WEEK</div>
                      <h2>How much of the planned crew was on site</h2>
                    </div>

                    <span className={styles.muted}>worker-days on site against planned, all measured plans</span>
                  </header>

                  <Chart data={crew} today={today} />

                  <ul className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.fillShort)} />
                      Below {Math.round(SHORT * 100)}%
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.fillOn)} />
                      On plan
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.fillOver)} />
                      Above {Math.round(OVER * 100)}%
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.planKey)} />
                      Planned crew (100%)
                    </li>
                  </ul>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">BY TRADE</div>
                      <h2>Which trades are furthest from their plan</h2>
                    </div>

                    <span className={styles.muted}>
                      {crew.trades.length} {plural(crew.trades.length, "trade", "trades")}, largest shortfall first
                    </span>
                  </header>

                  <ul className={styles.rates}>
                    {crew.trades.map((row) => (
                      <TradeLine key={row.key} row={row} />
                    ))}
                  </ul>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">PLAN BY PLAN</div>
                      <h2>Each plan against the crew that turned up</h2>
                    </div>

                    <span className={styles.muted}>
                      {list.length} of {crew.rows.length} {plural(crew.rows.length, "plan", "plans")}
                    </span>
                  </header>

                  {list.length === 0 ? (
                    <p className={styles.quiet}>No plan matches this selection.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {list.slice(0, shown).map((row) => (
                          <PlanLine key={row.id} row={row} />
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
              A site day is a date on which any crew was recorded on site. For each plan, the crew on a site day is the number of workers deployed in the plan&apos;s trade that day, or on its work package when the plan names one, and zero when none were recorded. Crew against plan is the worker-days on site divided by the planned headcount multiplied by the number of site days, counted only inside the plan dates and the period shown. A plan below {Math.round(SHORT * 100)}% is short of plan and one above {Math.round(OVER * 100)}% is over plan. A deployment counts towards every plan it matches, so overlapping plans for one trade are each measured against the same crew. Only approved and closed plans are measured.
              {crew.drafts > 0 ? ` ${crew.drafts} draft ${plural(crew.drafts, "plan is", "plans are")} left out.` : ""}
              {crew.noHeadcount > 0 ? ` ${crew.noHeadcount} ${plural(crew.noHeadcount, "plan has", "plans have")} no planned headcount and ${plural(crew.noHeadcount, "is", "are")} left out.` : ""}
              {crew.outside > 0 ? ` ${crew.outside} ${plural(crew.outside, "plan falls", "plans fall")} outside this period.` : ""}
              {crew.noSiteDays > 0 ? ` ${crew.noSiteDays} ${plural(crew.noSiteDays, "plan has", "plans have")} no site day recorded within its dates and ${plural(crew.noSiteDays, "is", "are")} left out.` : ""}
              {crew.skippedPlans > 0 ? ` ${crew.skippedPlans} ${plural(crew.skippedPlans, "plan has", "plans have")} unusable dates and ${plural(crew.skippedPlans, "was", "were")} left out.` : ""}
              {crew.skippedDeployments > 0 ? ` ${crew.skippedDeployments} ${plural(crew.skippedDeployments, "deployment has", "deployments have")} an unusable date or headcount and ${plural(crew.skippedDeployments, "was", "were")} left out.` : ""}
              {crew.future > 0 ? ` ${crew.future} ${plural(crew.future, "deployment is", "deployments are")} dated in the future and ${plural(crew.future, "is", "are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
