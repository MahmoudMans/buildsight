"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProduction, getProjectResources } from "@/lib/api";
import { formatDay, plural, trunc } from "@/lib/openItems";
import { DAY_ROWS, DEFAULT_WINDOW, MIN_GAP, PACKAGE_FILTERS, PAGE, RECORD_FILTERS, TOLERANCE, VERDICT_LABEL, WINDOWS, buildPlant, filterPackages, filterRecords, flagText, gapText, hoursText, oneDecimal, pct, plantMarkdown, type DayRow, type Flag, type PackageFilter, type PackageRow, type Plant, type RecordFilter, type RecordRow, type Verdict } from "@/lib/plantReconciliation";
import { copyText } from "@/lib/textExport";
import type { ProductionControl, ResourceControl } from "@/types/project";

import styles from "./ProjectPlantReconciliationView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

interface Loaded {
  resources: ResourceControl;
  production: ProductionControl;
}

const CHIP: Record<Verdict, string | undefined> = {
  matches: styles.chipGood,
  loggedMore: styles.chipWatch,
  reportedMore: styles.chipWatch,
  loggedOnly: styles.chipBad,
  reportedOnly: styles.chipBad,
};

function flagChip(flag: Flag): string | undefined {
  return flag === "overDay" || flag === "negative" || flag === "overAvailable" || flag === "duplicate" ? styles.chipBad : styles.chipWatch;
}

function PackageLine({ item, top }: { item: PackageRow; top: number }) {
  return (
    <li className={styles.row}>
      <span className={styles.what}>
        <strong>{item.code || "No code"}</strong> {trunc(item.name || "Unnamed package", 60)}
        <small>{item.items.length > 0 ? `plant: ${item.items.slice(0, 4).join(", ")}${item.items.length > 4 ? ` and ${item.items.length - 4} more` : ""}` : "no plant logged against it"}</small>
      </span>

      <span aria-label={`${item.code}: ${hoursText(item.logged)} hours logged, ${hoursText(item.reported)} hours reported`} className={styles.bars} role="img">
        <span className={styles.barLine}>
          <span className={styles.track}>
            <i className={styles.barLogged} style={{ width: `${(item.logged / top) * 100}%` }} />
          </span>
          <b>{hoursText(item.logged)} h</b>
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

function Cell({ label, value, odd }: { label: string; value: string; odd?: boolean }) {
  return (
    <span className={cx(styles.cell, odd && styles.cellOdd)}>
      <b>{label}</b>
      {value}
    </span>
  );
}

function RecordLine({ row }: { row: RecordRow }) {
  const negative = row.flags.includes("negative");

  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{row.code}</strong> {row.description ? trunc(row.description, 40) : ""}
        <small>
          {formatDay(row.day)}, {row.packageCode ? `booked to ${row.packageCode}` : "no work package on the register"}
        </small>
      </span>

      <span className={styles.hours}>
        <Cell label="Available" value={`${oneDecimal(row.available)} h`} />
        <Cell label="Operating" odd={negative || row.flags.includes("overAvailable")} value={`${oneDecimal(row.operating)} h`} />
        <Cell label="Idle" value={`${oneDecimal(row.idle)} h`} />
        <Cell label="Downtime" value={`${oneDecimal(row.downtime)} h`} />
        <Cell label="Utilisation" odd={row.flags.includes("utilisationOff")} value={`${oneDecimal(row.utilisation)}%`} />
      </span>

      <span className={styles.flags}>
        {row.flags.map((flag) => (
          <em className={cx(styles.chip, flagChip(flag))} key={flag}>
            {flagText(flag, row)}
          </em>
        ))}
      </span>
    </li>
  );
}

function DayList({ rows, shown, onMore, empty }: { rows: DayRow[]; shown: number; onMore: () => void; empty: string }) {
  if (rows.length === 0) {
    return <p className={styles.quiet}>{empty}</p>;
  }

  return (
    <>
      <ul className={styles.days}>
        {rows.slice(0, shown).map((row) => (
          <li className={styles.dayRow} key={row.day}>
            <span className={styles.what}>
              <strong>{formatDay(row.day)}</strong>
              <small>
                {row.items.slice(0, 4).join(", ")}
                {row.items.length > 4 ? ` and ${row.items.length - 4} more` : ""}
              </small>
            </span>

            <b className={styles.dayHours}>{hoursText(row.hours)} h</b>
          </li>
        ))}
      </ul>

      {rows.length > shown && (
        <div className={styles.more}>
          <button className={styles.moreButton} onClick={onMore} type="button">
            Show {Math.min(DAY_ROWS, rows.length - shown)} more
          </button>
          <span className={styles.muted}>
            {shown} of {rows.length} shown
          </span>
        </div>
      )}
    </>
  );
}

export function ProjectPlantReconciliationView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<Loaded | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [failed, setFailed] = useState<string[]>([]);
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [packageFilter, setPackageFilter] = useState<PackageFilter>("all");
  const [recordFilter, setRecordFilter] = useState<RecordFilter>("all");
  const [shown, setShown] = useState(PAGE);
  const [unreportedShown, setUnreportedShown] = useState(DAY_ROWS);
  const [unloggedShown, setUnloggedShown] = useState(DAY_ROWS);
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

    Promise.allSettled([getProjectResources(projectId), getProjectProduction(projectId)]).then(([resources, production]) => {
      if (cancelled) {
        return;
      }

      if (resources.status !== "fulfilled" || production.status !== "fulfilled") {
        setFailed([resources.status !== "fulfilled" ? "equipment usage log" : "", production.status !== "fulfilled" ? "site reports" : ""].filter(Boolean));
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

  const built = useMemo(() => (data ? buildPlant(data.resources, data.production, today, windowDays) : null), [data, today, windowDays]);
  const plant: Plant | null = built && built.ok ? built.plant : null;
  const projectName = data?.resources.project?.name ?? data?.production.project?.name ?? "Project";
  const packageList = useMemo(() => (plant ? filterPackages(plant.packages, packageFilter) : []), [plant, packageFilter]);
  const recordList = useMemo(() => (plant ? filterRecords(plant.flagged, recordFilter) : []), [plant, recordFilter]);
  const top = useMemo(() => Math.max(1, ...(plant ? plant.packages.map((item) => Math.max(item.logged, item.reported)) : [1])), [plant]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;

  async function copySummary() {
    if (!plant) {
      return;
    }

    const ok = await copyText(plantMarkdown(plant, packageList, recordList, projectName, windowLabel));

    setMessage(ok ? "Copied the plant reconciliation as Markdown." : "Could not copy the plant reconciliation.");
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

            <div className="eyebrow">PLANT RECONCILIATION</div>

            <h1>Does the equipment log match the plant hours the site reports record?</h1>

            <p className={styles.subtitle}>
              The usage log says how many hours each machine ran; site reports book equipment hours against work packages. Set side by side, work package by work package, the gaps show plant being paid for without the output being recorded, or output recorded against machines nobody logged. The log itself is checked for hours that cannot be right.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/idle-plant`}>
              Idle plant
            </Link>

            <Link className="secondary-link-button" href={`${base}/labour-reconciliation`}>
              Labour reconciliation
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the usage log and site reports…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the {failed.join(" or ")}. Both are needed to compare them, so check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No plant hours are logged or reported yet, so there is nothing to reconcile.</div>
          </section>
        )}

        {state === "ready" && plant && (
          <>
            <section aria-label="Plant reconciliation summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>PLANT LOGGED</div>
                <div className={styles.kpiValue}>{hoursText(plant.logged)} h</div>
                <div className={styles.kpiSub}>operating, last {windowLabel}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>REPORTED</div>
                <div className={styles.kpiValue}>{hoursText(plant.reported)} h</div>
                <div className={styles.kpiSub}>{plant.coverage === null ? "no plant logged" : `${pct(plant.coverage)} of the hours logged`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DISAGREE</div>
                <div className={cx(styles.kpiValue, plant.disagree > 0 && styles.neg)}>{plant.disagree}</div>
                <div className={styles.kpiSub}>
                  {plant.under} more logged, {plant.over} more reported
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LOG PROBLEMS</div>
                <div className={cx(styles.kpiValue, plant.problems > 0 && styles.neg)}>{plant.problems}</div>
                <div className={styles.kpiSub}>
                  of {plant.records} plant {plural(plant.records, "record", "records")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>UNREPORTED</div>
                <div className={cx(styles.kpiValue, plant.unreportedDays.length > 0 && styles.neg)}>{plant.unreportedDays.length}</div>
                <div className={styles.kpiSub}>{plural(plant.unreportedDays.length, "day", "days")} with plant, no report</div>
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
                        setUnreportedShown(DAY_ROWS);
                        setUnloggedShown(DAY_ROWS);
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
                  {PACKAGE_FILTERS.map((option) => (
                    <button
                      aria-pressed={packageFilter === option.key}
                      className={cx(styles.segment, packageFilter === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setPackageFilter(option.key);
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

            {plant.unassignedShare !== null && plant.unassignedShare > 0.25 && (
              <p className={styles.caution} role="note">
                {pct(plant.unassignedShare)} of the plant hours logged are not booked to a work package on the register, so the package comparison below covers only {hoursText(plant.assigned)} of the {hoursText(plant.logged)} hours logged.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY WORK PACKAGE</div>
                  <h2>Where the log and the site reports disagree most</h2>
                </div>

                <span className={styles.muted}>
                  {packageList.length} of {plant.packages.length} {plural(plant.packages.length, "package", "packages")}, biggest gap first
                </span>
              </header>

              {packageList.length === 0 ? (
                <p className={styles.quiet}>{plant.packages.length === 0 ? "No plant hours are logged or reported against any work package in this period." : "Every package roughly agrees in this period."}</p>
              ) : (
                <ul className={styles.rows}>
                  {packageList.map((item) => (
                    <PackageLine item={item} key={item.id} top={top} />
                  ))}
                </ul>
              )}

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.barLogged)} />
                  Operating hours in the usage log
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.barReported)} />
                  Equipment hours on site reports
                </li>
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">THE USAGE LOG ITSELF</div>
                  <h2>Records that do not stand up</h2>
                </div>

                <span className={styles.muted}>
                  {recordList.length} of {plant.problems} flagged, {plant.records} in the period
                </span>
              </header>

              <ul className={styles.checks}>
                {plant.checks.map((check) => (
                  <li className={cx(styles.check, check.count === 0 && styles.checkNone)} key={check.flag}>
                    <span>{check.label}</span>
                    <b>{check.count}</b>
                  </li>
                ))}
              </ul>

              <div className={styles.inlineControls}>
                <div className={styles.field}>
                  <span className={styles.controlLabel}>Log records</span>

                  <div aria-label="Which log records to list" className={styles.segmented} role="group">
                    {RECORD_FILTERS.map((option) => (
                      <button
                        aria-pressed={recordFilter === option.key}
                        className={cx(styles.segment, recordFilter === option.key && styles.segmentOn)}
                        key={option.key}
                        onClick={() => {
                          setRecordFilter(option.key);
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
              </div>

              {recordList.length === 0 ? (
                <p className={styles.quiet}>{plant.problems === 0 ? "No plant record has a problem in this period." : "No record matches this selection."}</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {recordList.slice(0, shown).map((row) => (
                      <RecordLine key={row.key} row={row} />
                    ))}
                  </ul>

                  {recordList.length > shown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, recordList.length - shown)} more
                      </button>
                      <span className={styles.muted}>
                        {shown} of {recordList.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">NO SITE REPORT</div>
                    <h2>Plant logged, nothing reported</h2>
                  </div>

                  <span className={styles.muted}>
                    {plant.unreportedDays.length} {plural(plant.unreportedDays.length, "day", "days")}
                  </span>
                </header>

                <DayList empty="Every day with plant logged has a submitted or approved site report." onMore={() => setUnreportedShown((current) => current + DAY_ROWS)} rows={plant.unreportedDays} shown={unreportedShown} />
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">NO USAGE LOG</div>
                    <h2>Reported, nothing logged</h2>
                  </div>

                  <span className={styles.muted}>
                    {plant.unloggedDays.length} {plural(plant.unloggedDays.length, "day", "days")}
                  </span>
                </header>

                <DayList empty="Every day with equipment hours reported has a usage record." onMore={() => setUnloggedShown((current) => current + DAY_ROWS)} rows={plant.unloggedDays} shown={unloggedShown} />
              </section>
            </div>

            <p className={styles.note}>
              Logged hours are the operating hours in the equipment usage log; reported hours are the equipment hours booked against work packages on submitted and approved site reports. Both are limited to the period above, and the two are entered separately, so some difference is normal. A package roughly agrees when the two are within {Math.round(TOLERANCE * 100)}% of each other or under {MIN_GAP} hours apart. A usage record is flagged when its operating, idle and downtime hours do not add up to the hours available, its utilisation differs from operating over available hours by more than 2 points, it shows more than 24 hours or negative hours, the same equipment is logged twice on one day, or it points to equipment or a work package that is not on the register. Usage with no work package, or one that is not on the register, counts as not booked. A day counts as reported when a submitted or approved site report exists for it.
              {plant.drafts > 0 ? ` ${plant.drafts} draft report ${plural(plant.drafts, "line", "lines")} with equipment hours ${plural(plant.drafts, "is", "are")} left out.` : ""}
              {plant.future > 0 ? ` ${plant.future} usage ${plural(plant.future, "record is", "records are")} dated in the future and ${plural(plant.future, "is", "are")} left out.` : ""}
              {plant.skipped > 0 ? ` ${plant.skipped} ${plural(plant.skipped, "record has", "records have")} no usable date and ${plural(plant.skipped, "is", "are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
