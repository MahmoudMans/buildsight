"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProduction, getProjectResources } from "@/lib/api";
import { DEFAULT_WINDOW, FILTERS, MIN_GAP, PAGE, TOLERANCE, VERDICT_LABEL, WINDOWS, buildReconciliation, filterPackages, gapText, hoursText, pct, reconciliationMarkdown, type Filter, type PackageRow, type Reconciliation, type Verdict } from "@/lib/labourReconciliation";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { ProductionControl, ResourceControl } from "@/types/project";

import styles from "./ProjectLabourReconciliationView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

interface Loaded {
  resources: ResourceControl;
  production: ProductionControl;
}

const CHIP: Record<Verdict, string | undefined> = {
  matches: styles.chipGood,
  underReported: styles.chipWatch,
  overReported: styles.chipWatch,
  deployedOnly: styles.chipBad,
  reportedOnly: styles.chipBad,
};

function Chart({ rec, today }: { rec: Reconciliation; today: number }) {
  const top = Math.max(1, ...rec.weeks.map((week) => Math.max(week.deployed, week.reported)));
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scroller.current;

    if (node) {
      node.scrollLeft = node.scrollWidth;
    }
  }, [rec.weeks.length]);

  return (
    <div className={styles.chartScroll} ref={scroller}>
      <div className={styles.chart}>
        {rec.weeks.map((week) => {
          const partial = week.from < rec.from || week.from + 6 > today;
          const share = week.deployed > 0 ? week.reported / week.deployed : null;

          return (
            <div
              className={styles.col}
              key={week.from}
              title={`Week commencing ${formatDay(week.from)}${partial ? " (part of a week inside this period)" : ""}: ${hoursText(week.deployed)} hours deployed, ${hoursText(week.reported)} hours reported${share !== null ? `, ${pct(share)} of the deployed hours` : ""}.`}
            >
              <span className={styles.colValue}>{pct(share)}</span>

              <span className={styles.colTrack}>
                <span className={styles.pair}>
                  <i className={styles.barDeployed} style={{ height: `${week.deployed > 0 ? Math.max(1.5, (week.deployed / top) * 100) : 0}%` }} />
                  <i className={styles.barReported} style={{ height: `${week.reported > 0 ? Math.max(1.5, (week.reported / top) * 100) : 0}%` }} />
                </span>
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

function PackageLine({ item, top }: { item: PackageRow; top: number }) {
  return (
    <li className={styles.row}>
      <span className={styles.what}>
        <strong>{item.code || "No code"}</strong> {trunc(item.name || "Unnamed package", 60)}
        <small>
          {item.trades.length > 0 ? item.trades.join(", ") : "no crew booked to it"}
          {item.planned !== null ? `, ${hoursText(item.planned)} h planned in all` : ""}
        </small>
      </span>

      <span
        aria-label={`${item.code}: ${hoursText(item.deployed)} hours deployed, ${hoursText(item.reported)} hours reported`}
        className={styles.bars}
        role="img"
      >
        <span className={styles.barLine}>
          <span className={styles.track}>
            <i className={styles.barDeployed} style={{ width: `${(item.deployed / top) * 100}%` }} />
          </span>
          <b>{hoursText(item.deployed)} h</b>
        </span>

        <span className={styles.barLine}>
          <span className={styles.track}>
            <i className={styles.barReported} style={{ width: `${(item.reported / top) * 100}%` }} />
          </span>
          <b>{hoursText(item.reported)} h</b>
        </span>
      </span>

      <span className={styles.verdict}>
        <em className={cx(styles.chip, CHIP[item.verdict])}>{VERDICT_LABEL[item.verdict]}</em>
        <small>{gapText(item)}</small>
      </span>
    </li>
  );
}

export function ProjectLabourReconciliationView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [failed, setFailed] = useState<string[]>([]);
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

    Promise.allSettled([getProjectResources(projectId), getProjectProduction(projectId)]).then(([resources, production]) => {
      if (cancelled) {
        return;
      }

      if (resources.status !== "fulfilled" || production.status !== "fulfilled") {
        setFailed([resources.status !== "fulfilled" ? "workforce deployments" : "", production.status !== "fulfilled" ? "site reports" : ""].filter(Boolean));
        setState("error");
        return;
      }

      setData({ resources: resources.value, production: production.value });
      setState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const built = useMemo(() => (data ? buildReconciliation(data.resources, data.production, today, windowDays) : null), [data, today, windowDays]);
  const rec = built && built.ok ? built.rec : null;
  const projectName = data?.resources.project?.name ?? data?.production.project?.name ?? "Project";
  const list = useMemo(() => (rec ? filterPackages(rec.packages, filter) : []), [rec, filter]);
  const top = useMemo(() => Math.max(1, ...(rec ? rec.packages.map((item) => Math.max(item.deployed, item.reported)) : [1])), [rec]);
  const tradesTop = rec ? rec.trades.filter((item) => item.unassigned > 0) : [];
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;

  async function copySummary() {
    if (!rec) {
      return;
    }

    const ok = await copyText(reconciliationMarkdown(rec, list, projectName, today));

    setMessage(ok ? "Copied the reconciliation as Markdown." : "Could not copy the reconciliation.");
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

            <div className="eyebrow">LABOUR RECONCILIATION</div>

            <h1>Do the crews we deploy match the hours the site reports record?</h1>

            <p className={styles.subtitle}>
              Daily deployments say who was on site; site reports say what they were booked to. Set side by side, work package by work package, the gaps show labour being paid for without the output being recorded, or output recorded against crews nobody deployed.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/production-board`}>
              Production board
            </Link>

            <Link className="secondary-link-button" href={`${base}/resource-heatmap`}>
              Resource heatmap
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the deployments and site reports…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the {failed.join(" or ")}. Both are needed to compare them, so check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No labour hours are deployed or reported yet, so there is nothing to reconcile.</div>
          </section>
        )}

        {state === "ready" && rec && (
          <>
            <section aria-label="Labour reconciliation summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>DEPLOYED</div>
                <div className={styles.kpiValue}>{hoursText(rec.deployed)} h</div>
                <div className={styles.kpiSub}>in the last {windowLabel}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>REPORTED</div>
                <div className={styles.kpiValue}>{hoursText(rec.reported)} h</div>
                <div className={styles.kpiSub}>on site reports{rec.drafts > 0 ? `, ${rec.drafts} draft ${plural(rec.drafts, "line", "lines")} left out` : ""}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>REPORTED OF DEPLOYED</div>
                <div className={cx(styles.kpiValue, rec.coverage !== null && rec.coverage < 1 - TOLERANCE && styles.neg)}>{pct(rec.coverage)}</div>
                <div className={styles.kpiSub}>{rec.coverage === null ? "no hours deployed" : rec.coverage > 1 + TOLERANCE ? "more reported than deployed" : rec.coverage < 1 - TOLERANCE ? "short of the hours deployed" : "close to the hours deployed"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PACKAGES THAT DISAGREE</div>
                <div className={cx(styles.kpiValue, rec.disagree > 0 && styles.neg)}>{rec.disagree}</div>
                <div className={styles.kpiSub}>
                  {rec.under} short on reports, {rec.over} over
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NOT BOOKED</div>
                <div className={cx(styles.kpiValue, rec.unassignedShare !== null && rec.unassignedShare > 0.25 && styles.neg)}>{hoursText(rec.unassigned)} h</div>
                <div className={styles.kpiSub}>{rec.unassignedShare === null ? "no hours deployed" : `${pct(rec.unassignedShare)} of deployed hours have no package`}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Period</span>

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

              <div className={styles.field}>
                <span className={styles.controlLabel}>Packages</span>

                <div aria-label="Which packages to list" className={styles.segmented} role="group">
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

            {rec.unassignedShare !== null && rec.unassignedShare > 0.25 && (
              <p className={styles.caution} role="note">
                {pct(rec.unassignedShare)} of the deployed hours are not booked to a work package, so the package comparison below covers only {hoursText(rec.assigned)} of the {hoursText(rec.deployed)} hours deployed.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WEEK BY WEEK</div>
                  <h2>Hours deployed against hours reported</h2>
                </div>

                <span className={styles.muted}>
                  {formatDay(rec.from)} to {formatDay(rec.to)}
                </span>
              </header>

              <Chart rec={rec} today={today} />

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.barDeployed)} />
                  Hours in the daily deployments
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.barReported)} />
                  Hours booked on site reports
                </li>
                <li>
                  <b className={styles.legendPct}>%</b>
                  Reported as a share of deployed
                </li>
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY WORK PACKAGE</div>
                  <h2>Where the two disagree most</h2>
                </div>

                <span className={styles.muted}>
                  {list.length} of {rec.packages.length} {plural(rec.packages.length, "package", "packages")}, biggest gap first
                </span>
              </header>

              {list.length === 0 ? (
                <p className={styles.quiet}>{rec.packages.length === 0 ? "No hours are booked to any work package in this period." : "Every package roughly agrees in this period."}</p>
              ) : (
                <>
                  <ul className={styles.rows}>
                    {list.slice(0, shown).map((item) => (
                      <PackageLine item={item} key={item.id} top={top} />
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

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.barDeployed)} />
                  Deployed
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.barReported)} />
                  Reported
                </li>
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">NOT BOOKED</div>
                  <h2>Labour deployed with no work package</h2>
                </div>

                <span className={styles.muted}>
                  {hoursText(rec.unassigned)} h of {hoursText(rec.deployed)} h
                </span>
              </header>

              {tradesTop.length === 0 ? (
                <p className={styles.quiet}>Every deployment in this period is booked to a work package.</p>
              ) : (
                <ul className={styles.trades}>
                  {tradesTop.map((item) => {
                    const assigned = item.deployed - item.unassigned;

                    return (
                      <li className={styles.tradeRow} key={item.trade}>
                        <strong>{item.trade}</strong>

                        <span
                          aria-label={`${item.trade}: ${hoursText(assigned)} hours booked to a package, ${hoursText(item.unassigned)} hours not booked`}
                          className={styles.split}
                          role="img"
                        >
                          {assigned > 0 && <i className={styles.splitGood} style={{ flexGrow: assigned }} title={`${hoursText(assigned)} h booked to a package`} />}
                          {item.unassigned > 0 && <i className={styles.splitWatch} style={{ flexGrow: item.unassigned }} title={`${hoursText(item.unassigned)} h not booked`} />}
                        </span>

                        <span>
                          {hoursText(item.unassigned)} h not booked
                          <small>
                            {pct(item.share)} of {hoursText(item.deployed)} h deployed
                          </small>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.splitGood)} />
                  Booked to a work package
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.splitWatch)} />
                  Not booked
                </li>
              </ul>
            </section>

            <p className={styles.note}>
              Deployed hours are the labour hours in the daily workforce deployments; reported hours are the labour hours booked against a work package on submitted and approved site reports, with draft reports left out. Both cover the same days, from {formatDay(rec.from)} to {formatDay(rec.to)}. A package roughly agrees when the two are within {Math.round(TOLERANCE * 100)}% of each other or under {MIN_GAP} hours apart; beyond that it is listed as short on reports or over-reported. The two are entered separately, so a small difference is normal, and a report filed a few days late can make a recent week look short. Weeks run Monday to Sunday, and the first and last may cover only part of a week.
              {rec.unknownPackages > 0 ? ` ${rec.unknownPackages} ${plural(rec.unknownPackages, "deployment points", "deployments point")} at a work package that is not on the register and ${plural(rec.unknownPackages, "is", "are")} counted as not booked.` : ""}
              {rec.skipped > 0 ? ` ${rec.skipped} ${plural(rec.skipped, "record has", "records have")} no usable date and ${plural(rec.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
