"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProduction } from "@/lib/api";
import { BAND_LABEL, EARLY, FILTERS, OVER, PAGE, SCOPES, buildBurn, burnMarkdown, filterRows, forecastText, hoursText, inScope, overrunText, pct, ratio, signedHours, type Band, type Burn, type Filter, type Row, type Scope } from "@/lib/labourBurn";
import { plural, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { ProductionControl } from "@/types/project";

import styles from "./ProjectLabourBurnView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const MAX_SCALE = 2;

const CHIP: Record<Band, string | undefined> = {
  over: styles.chipBad,
  watch: styles.chipWatch,
  ok: styles.chipGood,
  unknown: styles.chipPlain,
};

const BAR: Record<Band, string | undefined> = {
  over: styles.usedOver,
  watch: styles.usedWatch,
  ok: styles.usedOk,
  unknown: styles.usedOk,
};

const OUTLOOK: ReadonlyArray<{ band: Band; label: string; style: string | undefined }> = [
  { band: "over", label: "Heading well over", style: styles.outOver },
  { band: "watch", label: "Slightly over", style: styles.outWatch },
  { band: "ok", label: "Within the hours", style: styles.outOk },
  { band: "unknown", label: "Too early to say", style: styles.outUnknown },
];

function share(value: number, scale: number): string {
  return `${Math.min(100, Math.max(0, (value / scale) * 100))}%`;
}

function PackageLine({ row, scale }: { row: Row; scale: number }) {
  const forecastShare = row.forecast !== null ? row.forecast / row.planned : null;
  const tickAt = `${(1 / scale) * 100}%`;

  return (
    <li className={styles.row}>
      <span className={styles.what}>
        <strong>{row.code || "No code"}</strong> {trunc(row.name || "Unnamed package", 60)}
        {row.blocked && <> <em className={styles.tag}>Blocked</em></>}
        <small>
          {row.completed ? `Complete, ${pct(row.usedShare)} of the planned hours used` : `${pct(row.usedShare)} of the hours used at ${Math.round(row.progress)}% complete`}
        </small>
      </span>

      <span
        aria-label={`${row.code}: ${hoursText(row.used)} of ${hoursText(row.planned)} planned hours used, ${Math.round(row.progress)} percent complete${row.forecast !== null ? `, forecast ${hoursText(row.forecast)} hours` : ""}`}
        className={styles.bars}
        role="img"
      >
        <span className={styles.barLine}>
          <span className={styles.track}>
            <i className={cx(styles.fill, BAR[row.band])} style={{ width: share(row.usedShare, scale) }} />

            {forecastShare !== null && row.mode !== "final" && forecastShare > row.usedShare && (
              <i
                className={cx(styles.fill, styles.forecast)}
                style={{ left: share(row.usedShare, scale), width: share(Math.min(forecastShare, scale) - Math.min(row.usedShare, scale), scale) }}
                title={`Forecast ${hoursText(row.forecast ?? 0)} h`}
              />
            )}

            <i className={styles.planTick} style={{ left: tickAt }} title="The planned hours" />
          </span>
          <b>
            {hoursText(row.used)} of {hoursText(row.planned)} h
          </b>
        </span>

        <span className={styles.barLine}>
          <span className={styles.track}>
            <i className={cx(styles.fill, styles.done)} style={{ width: share(row.progress / 100, scale) }} />
            <i className={styles.planTick} style={{ left: tickAt }} />
          </span>
          <b>{Math.round(row.progress)}% complete</b>
        </span>
      </span>

      <span className={styles.verdict}>
        <em className={cx(styles.chip, CHIP[row.band])}>{row.mode === "final" ? (row.band === "ok" ? "Finished within" : "Finished over") : BAND_LABEL[row.band]}</em>
        <small>{forecastText(row)}</small>
        {overrunText(row) && <small>{overrunText(row)}</small>}
      </span>
    </li>
  );
}

function Glance({ burn, scope }: { burn: Burn; scope: Scope }) {
  const totals = scope === "open" ? burn.open : burn.all;
  const top = Math.max(1, totals.planned, totals.used, totals.earned, totals.projected);
  const items = [
    { key: "planned", label: "Planned", hint: "the labour budget of these packages", value: totals.planned, style: styles.gPlanned },
    { key: "earned", label: "Earned", hint: "planned hours multiplied by the percentage complete", value: totals.earned, style: styles.gEarned },
    { key: "used", label: "Used", hint: "booked to the packages so far", value: totals.used, style: styles.gUsed },
    { key: "projected", label: "Projected", hint: `${signedHours(totals.overrun)} against the plan`, value: totals.projected, style: totals.overrun > 0 ? styles.gOver : styles.gUsed },
  ];

  return (
    <ul className={styles.glance}>
      {items.map((item) => (
        <li className={styles.glanceRow} key={item.key}>
          <span>
            <strong>{item.label}</strong>
            <small>{item.hint}</small>
          </span>

          <span aria-hidden="true" className={styles.track}>
            <i className={cx(styles.fill, item.style)} style={{ width: share(item.value, top) }} />
          </span>

          <b>{hoursText(item.value)} h</b>
        </li>
      ))}
    </ul>
  );
}

export function ProjectLabourBurnView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ProductionControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [scope, setScope] = useState<Scope>("open");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectProduction(projectId)
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

  const built = useMemo(() => (data ? buildBurn(data) : null), [data]);
  const burn = built && built.ok ? built.burn : null;
  const projectName = data?.project?.name ?? "Project";
  const totals = burn ? (scope === "open" ? burn.open : burn.all) : null;
  const scoped = useMemo(() => (burn ? inScope(burn.rows, scope) : []), [burn, scope]);
  const list = useMemo(() => filterRows(scoped, filter), [scoped, filter]);
  const scale = useMemo(() => Math.min(MAX_SCALE, Math.max(1, ...scoped.map((row) => Math.max(row.usedShare, row.forecast !== null ? row.forecast / row.planned : 0)))), [scoped]);
  const capped = scoped.some((row) => row.usedShare > MAX_SCALE || (row.forecast !== null && row.forecast / row.planned > MAX_SCALE));
  const unknownPlanned = scoped.filter((row) => row.band === "unknown").reduce((sum, row) => sum + row.planned, 0);
  const unknownShare = totals && totals.planned > 0 ? unknownPlanned / totals.planned : 0;
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";

  async function copySummary() {
    if (!burn || !totals) {
      return;
    }

    const ok = await copyText(burnMarkdown(list, totals, projectName, scope, { noBudget: burn.noBudget, notStarted: burn.notStarted, filter: filter === "all" ? undefined : filterLabel }));

    setMessage(ok ? "Copied the labour burn as Markdown." : "Could not copy the labour burn.");
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

            <div className="eyebrow">LABOUR BURN</div>

            <h1>Which work packages are burning through their labour hours?</h1>

            <p className={styles.subtitle}>
              Every package has a labour budget, some hours booked against it and a percentage complete. Setting how much of the hours has gone against how much of the work is done shows the packages heading for an overrun while there is still time to act.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/production-board`}>
              Production board
            </Link>

            <Link className="secondary-link-button" href={`${base}/labour-reconciliation`}>
              Labour reconciliation
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the work packages…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the work packages. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No work packages are on the register yet, so there are no labour hours to compare.</div>
          </section>
        )}

        {state === "ready" && burn && burn.rows.length === 0 && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>
              No work package with a labour budget has started yet, so there is nothing to compare.
              {burn.noBudget > 0 ? ` ${burn.noBudget} ${plural(burn.noBudget, "package has", "packages have")} no planned hours.` : ""}
              {burn.notStarted > 0 ? ` ${burn.notStarted} ${plural(burn.notStarted, "package has", "packages have")} not started.` : ""}
            </div>
          </section>
        )}

        {state === "ready" && burn && totals && burn.rows.length > 0 && (
          <>
            <section aria-label="Labour budget burn summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>HOURS USED</div>
                <div className={styles.kpiValue}>{hoursText(totals.used)} h</div>
                <div className={styles.kpiSub}>{totals.planned > 0 ? `of ${hoursText(totals.planned)} h planned (${pct(totals.used / totals.planned)})` : "no packages in view"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>EARNED</div>
                <div className={styles.kpiValue}>{hoursText(totals.earned)} h</div>
                <div className={styles.kpiSub}>planned hours times % complete</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>EFFICIENCY</div>
                <div className={cx(styles.kpiValue, totals.efficiency !== null && totals.efficiency < 1 / OVER && styles.neg)}>{ratio(totals.efficiency)}</div>
                <div className={styles.kpiSub}>{totals.efficiency === null ? "no hours logged yet" : totals.efficiency < 1 ? "spending more than the progress is worth" : "progress is worth what is spent"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PROJECTED</div>
                <div className={cx(styles.kpiValue, totals.overrun > 0 && styles.neg, totals.overrun < 0 && styles.pos)}>{hoursText(totals.projected)} h</div>
                <div className={styles.kpiSub}>
                  {signedHours(totals.overrun)} against {hoursText(totals.planned)} h planned
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>HEADING OVER</div>
                <div className={cx(styles.kpiValue, totals.over > 0 && styles.neg)}>{totals.over}</div>
                <div className={styles.kpiSub}>
                  {totals.watch} slightly over, {totals.unknown} too early to say
                </div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Packages</span>

                <div aria-label="Which packages to include" className={styles.segmented} role="group">
                  {SCOPES.map((option) => (
                    <button
                      aria-pressed={scope === option.key}
                      className={cx(styles.segment, scope === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setScope(option.key);
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
                <span className={styles.controlLabel}>Show</span>

                <div aria-label="Which outlook to list" className={styles.segmented} role="group">
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

            {totals.exhausted > 0 && (
              <p className={styles.caution} role="note">
                {totals.exhausted} {plural(totals.exhausted, "package has", "packages have")} already used all of {plural(totals.exhausted, "its", "their")} planned hours without being finished, so every further hour is over the plan.
              </p>
            )}

            {unknownShare > 0.25 && (
              <p className={styles.caution} role="note">
                {pct(unknownShare)} of the planned hours sit in packages that are too early to forecast. The projected total assumes they finish on plan, so it may understate the overrun.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">THE BUDGET AT A GLANCE</div>
                  <h2>Planned, earned, used and projected hours</h2>
                </div>

                <span className={styles.muted}>
                  {totals.packages} {plural(totals.packages, "package", "packages")}
                </span>
              </header>

              {totals.packages === 0 ? <p className={styles.quiet}>Every package with a labour budget is complete, so none is open.</p> : <Glance burn={burn} scope={scope} />}

              {totals.packages > 0 && (
                <>
                  <div className={styles.outlookHead}>Planned hours by outlook</div>

                  <span
                    aria-label={OUTLOOK.map((item) => `${item.label}: ${hoursText(scoped.filter((row) => row.band === item.band).reduce((sum, row) => sum + row.planned, 0))} planned hours`).join(", ")}
                    className={styles.outlook}
                    role="img"
                  >
                    {OUTLOOK.map((item) => {
                      const hours = scoped.filter((row) => row.band === item.band).reduce((sum, row) => sum + row.planned, 0);

                      return hours > 0 ? <i className={item.style} key={item.band} style={{ flexGrow: hours }} title={`${item.label}: ${hoursText(hours)} planned hours`} /> : null;
                    })}
                  </span>

                  <ul className={styles.legend}>
                    {OUTLOOK.map((item) => {
                      const rows = scoped.filter((row) => row.band === item.band);

                      return (
                        <li key={item.band}>
                          <i className={cx(styles.swatch, item.style)} />
                          {item.label}: {rows.length} {plural(rows.length, "package", "packages")}, {hoursText(rows.reduce((sum, row) => sum + row.planned, 0))} h planned
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY WORK PACKAGE</div>
                  <h2>Which packages will overrun their labour hours</h2>
                </div>

                <span className={styles.muted}>
                  {list.length} of {scoped.length} {plural(scoped.length, "package", "packages")}, biggest projected overrun first
                </span>
              </header>

              {list.length === 0 ? (
                <p className={styles.quiet}>{scoped.length === 0 ? "Every package with a labour budget is complete, so none is open." : "No package matches this selection."}</p>
              ) : (
                <>
                  <ul className={styles.rows}>
                    {list.slice(0, shown).map((row) => (
                      <PackageLine key={row.id} row={row} scale={scale} />
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
                  <i className={cx(styles.swatch, styles.usedOk)} />
                  Hours used
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.forecastKey)} />
                  Forecast to finish
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.done)} />
                  Work complete
                </li>
                <li>
                  <i className={styles.legendTick} />
                  The planned hours
                </li>
              </ul>

              {capped && <p className={styles.hint}>Bars stop at {MAX_SCALE * 100}% of the planned hours, so a package further over than that is drawn to the edge.</p>}
            </section>

            <p className={styles.note}>
              Used hours are the labour hours booked to the package. Earned hours are the planned hours multiplied by the percentage complete, and efficiency is earned divided by used, so below 1.00 means more hours are being spent than the progress is worth. The forecast divides the hours used by the share complete, which assumes the rest of the work goes at the same rate as so far; it is only given once a package is {EARLY}% complete, because an early rate says little about the rest. A forecast more than {Math.round((OVER - 1) * 100)}% above the plan is heading well over, anything above the plan is slightly over, and a package that has already used its planned hours without finishing is shown as over before it can be forecast. For the projected total, a package that is too early to forecast is assumed to finish on its plan. A finished package counts at the hours it actually used.
              {burn.noBudget > 0 ? ` ${burn.noBudget} ${plural(burn.noBudget, "package has", "packages have")} no planned hours and ${plural(burn.noBudget, "is", "are")} left out.` : ""}
              {burn.notStarted > 0 ? ` ${burn.notStarted} ${plural(burn.notStarted, "package has", "packages have")} not started and ${plural(burn.notStarted, "is", "are")} left out.` : ""}
              {burn.cancelled > 0 ? ` ${burn.cancelled} cancelled ${plural(burn.cancelled, "package is", "packages are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
