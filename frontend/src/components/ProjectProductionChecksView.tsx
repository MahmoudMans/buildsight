"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProduction } from "@/lib/api";
import { formatDay, plural } from "@/lib/openItems";
import { ENTRY_FLAGS, ENTRY_FLAG_LABEL, MAX_SHIFT, MEASURE_LABEL, MEASURE_VERDICT_LABEL, PACKAGE_FILTERS, PAGE, RATE_FACTOR, TOL_REL, buildChecks, checksMarkdown, filterEntries, filterPackages, fmt, signed, type Checks, type EntryFlag, type EntryRow, type MeasureRow, type PackageFilter, type PackageRow } from "@/lib/productionChecks";
import { copyText } from "@/lib/textExport";
import type { ProductionControl, WorkPackage } from "@/types/project";

import styles from "./ProjectProductionChecksView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const STATUS_LABEL: Record<WorkPackage["status"], string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const GAP_CLASS: Record<MeasureRow["verdict"], string | undefined> = {
  agrees: styles.gapGood,
  draftOnly: styles.gapWatch,
  above: styles.gapBad,
  below: styles.gapBad,
};

const SEVERE: ReadonlySet<EntryFlag> = new Set<EntryFlag>(["negative", "unknownPackage"]);

function MeasureLine({ row, unit }: { row: MeasureRow; unit: string }) {
  const label = row.measure === "quantity" ? `Quantity${unit ? `, ${unit}` : ""}` : MEASURE_LABEL[row.measure];

  if (row.stated === 0 && row.fromEntries === 0 && row.fromAll === 0) {
    return (
      <li className={styles.measure}>
        <b>{label}</b>
        <span className={styles.muted}>none recorded</span>
      </li>
    );
  }

  return (
    <li className={styles.measure}>
      <b>{label}</b>
      <span className={styles.total}>total {fmt(row.stated)}</span>
      <span className={styles.entries}>entries {fmt(row.fromEntries)}</span>
      <i className={cx(styles.gap, GAP_CLASS[row.verdict])} title={row.verdict === "draftOnly" ? `${MEASURE_VERDICT_LABEL[row.verdict]}: ${fmt(row.fromAll)} with drafts` : MEASURE_VERDICT_LABEL[row.verdict]}>
        {row.verdict === "agrees" ? "agrees" : row.verdict === "draftOnly" ? "drafts only" : signed(row.gap)}
      </i>
    </li>
  );
}

function PackageLine({ row }: { row: PackageRow }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>
          {row.code} {row.name}
        </strong>
        <small>
          {STATUS_LABEL[row.status]}, {row.entries} {plural(row.entries, "entry", "entries")}
          {row.draftEntries > 0 ? `, ${row.draftEntries} more in draft reports` : ""}
        </small>
      </span>

      <ul className={styles.measures}>
        {row.measures.map((measure) => (
          <MeasureLine key={measure.measure} row={measure} unit={row.unit} />
        ))}
      </ul>

      <span className={styles.verdict}>
        {row.verdict === "agrees" && <em className={cx(styles.chip, styles.chipGood)}>All agree</em>}
        {row.verdict === "draftOnly" && <em className={cx(styles.chip, styles.chipWatch)}>Agrees only with drafts</em>}
        {row.verdict === "disagrees" &&
          (["above", "below"] as const)
            .filter((verdict) => row.measures.some((measure) => measure.verdict === verdict))
            .map((verdict) => (
              <em className={cx(styles.chip, styles.chipBad)} key={verdict}>
                {MEASURE_VERDICT_LABEL[verdict]}
              </em>
            ))}
      </span>
    </li>
  );
}

function EntryLine({ row }: { row: EntryRow }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{row.packageCode ? `${row.packageCode} ${row.packageName ?? ""}` : "Unknown package"}</strong>
        <small>
          {row.reference}, {formatDay(row.day)}
          {row.draft ? ", draft report" : ""}
        </small>
      </span>

      <span className={styles.figures}>
        <span>
          <b>Quantity</b> {fmt(row.quantity)} {row.unit}
        </span>
        <span>
          <b>Labour</b> {fmt(row.labour)} h, crew of {row.crew}
        </span>
        <span>
          <b>Equipment</b> {fmt(row.equipment)} h
        </span>
      </span>

      <span className={styles.verdict}>
        {row.flags.map((flag) => (
          <em className={cx(styles.chip, SEVERE.has(flag) ? styles.chipBad : styles.chipWatch)} key={flag}>
            {ENTRY_FLAG_LABEL[flag]}
          </em>
        ))}
      </span>
    </li>
  );
}

export function ProjectProductionChecksView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ProductionControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [packageFilter, setPackageFilter] = useState<PackageFilter>("all");
  const [flag, setFlag] = useState<EntryFlag | "all">("all");
  const [packagesShown, setPackagesShown] = useState(PAGE);
  const [entriesShown, setEntriesShown] = useState(PAGE);
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

  const built = useMemo(() => (data ? buildChecks(data) : null), [data]);
  const checks: Checks | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const packageList = useMemo(() => (checks ? filterPackages(checks.packages, packageFilter) : []), [checks, packageFilter]);
  const entryList = useMemo(() => (checks ? filterEntries(checks.flagged, flag) : []), [checks, flag]);
  const flagOptions = checks ? ENTRY_FLAGS.filter((item) => (checks.flagCounts[item] ?? 0) > 0) : [];
  const draftOnlyCodes = checks ? checks.packages.filter((row) => row.verdict === "draftOnly").map((row) => row.code) : [];

  async function copySummary() {
    if (!checks) {
      return;
    }

    const ok = await copyText(checksMarkdown(checks, entryList, projectName, flag === "all" ? null : ENTRY_FLAG_LABEL[flag]));

    setMessage(ok ? "Copied the production reconciliation as Markdown." : "Could not copy the production reconciliation.");
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

            <div className="eyebrow">PRODUCTION RECONCILIATION</div>

            <h1>Do the daily entries add up to the package totals?</h1>

            <p className={styles.subtitle}>
              Each work package carries running totals of quantity, labour hours and equipment hours, and each site report carries the daily entries behind them. This page adds the entries up, compares them with the totals, and flags single entries that look wrong on their own.
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

        {state === "loading" && <div className={styles.loading}>Adding up the daily production entries…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the production data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>
              {built.reason === "noPackages" ? "There are no work packages yet, so there are no totals to check." : "No daily production entries have been recorded yet, so the work package totals have nothing to be checked against."}
            </div>
          </section>
        )}

        {state === "ready" && checks && (
          <>
            <section aria-label="Production reconciliation summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>PACKAGES</div>
                <div className={styles.kpiValue}>{checks.packages.length}</div>
                <div className={styles.kpiSub}>{checks.unused + checks.cancelled > 0 ? `${checks.unused + checks.cancelled} cancelled or unused left out` : "none left out"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AGREE</div>
                <div className={styles.kpiValue}>{checks.agree}</div>
                <div className={styles.kpiSub}>of {checks.packages.length} match on all three measures</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DISAGREE</div>
                <div className={cx(styles.kpiValue, checks.disagree > 0 && styles.neg)}>{checks.disagree}</div>
                <div className={styles.kpiSub}>{checks.draftOnly > 0 ? `plus ${checks.draftOnly} that match only with drafts` : "total differs from the entries"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ENTRIES</div>
                <div className={styles.kpiValue}>{checks.entryCount}</div>
                <div className={styles.kpiSub}>
                  from {checks.reportCount} site {plural(checks.reportCount, "report", "reports")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FLAGGED</div>
                <div className={cx(styles.kpiValue, checks.flagged.length > 0 && styles.neg)}>{checks.flagged.length}</div>
                <div className={styles.kpiSub}>{checks.entryCount > 0 ? `${Math.round((checks.flagged.length / checks.entryCount) * 100)}% of entries` : "—"}</div>
              </article>
            </section>

            <section className={styles.controls}>
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
                        setPackagesShown(PAGE);
                        setMessage(null);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {flagOptions.length > 0 && (
                <div className={styles.field}>
                  <span className={styles.controlLabel}>Entry check</span>

                  <div aria-label="Which flagged entries to list" className={styles.segmented} role="group">
                    <button
                      aria-pressed={flag === "all"}
                      className={cx(styles.segment, flag === "all" && styles.segmentOn)}
                      onClick={() => {
                        setFlag("all");
                        setEntriesShown(PAGE);
                        setMessage(null);
                      }}
                      type="button"
                    >
                      All flagged
                    </button>

                    {flagOptions.map((option) => (
                      <button
                        aria-pressed={flag === option}
                        className={cx(styles.segment, flag === option && styles.segmentOn)}
                        key={option}
                        onClick={() => {
                          setFlag(option);
                          setEntriesShown(PAGE);
                          setMessage(null);
                        }}
                        type="button"
                      >
                        {ENTRY_FLAG_LABEL[option]} ({checks.flagCounts[option]})
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

            {draftOnlyCodes.length > 0 && (
              <p className={styles.caution} role="note">
                {draftOnlyCodes.length} {plural(draftOnlyCodes.length, "package total matches", "package totals match")} the entries only when draft site reports are counted: {draftOnlyCodes.slice(0, 4).join(", ")}
                {draftOnlyCodes.length > 4 ? ` and ${draftOnlyCodes.length - 4} more` : ""}. A total that includes drafts changes when a draft is edited or deleted.
              </p>
            )}

            {checks.noReport > 0 && (
              <p className={styles.caution} role="note">
                {checks.noReport} {plural(checks.noReport, "entry points", "entries point")} to a site report that is not in the data and {plural(checks.noReport, "is", "are")} counted as submitted.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PACKAGE TOTALS</div>
                  <h2>Do the totals match the entries</h2>
                </div>

                <span className={styles.muted}>
                  {packageList.length} of {checks.packages.length} {plural(checks.packages.length, "package", "packages")}, furthest apart first
                </span>
              </header>

              {packageList.length === 0 ? (
                <p className={styles.quiet}>Every package total matches its entries.</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {packageList.slice(0, packagesShown).map((row) => (
                      <PackageLine key={row.id} row={row} />
                    ))}
                  </ul>

                  {packageList.length > packagesShown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setPackagesShown((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, packageList.length - packagesShown)} more
                      </button>
                      <span className={styles.muted}>
                        {packagesShown} of {packageList.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">ENTRY CHECKS</div>
                  <h2>Entries that look wrong on their own</h2>
                </div>

                <span className={styles.muted}>
                  {entryList.length} of {checks.entryCount} {plural(checks.entryCount, "entry", "entries")}, most flags first
                </span>
              </header>

              {checks.flagged.length === 0 ? (
                <p className={styles.quiet}>None of the {checks.entryCount} entries trips a check.</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {entryList.slice(0, entriesShown).map((row) => (
                      <EntryLine key={row.key} row={row} />
                    ))}
                  </ul>

                  {entryList.length > entriesShown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setEntriesShown((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, entryList.length - entriesShown)} more
                      </button>
                      <span className={styles.muted}>
                        {entriesShown} of {entryList.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>

            <p className={styles.note}>
              Package totals are compared with the entries from submitted and approved site reports; a total that only matches once draft reports are added is shown separately. Totals within {Math.round(TOL_REL * 100)}% of each other count as agreeing. Entry flags mark records worth a second look, not proven errors: output with no hours, hours with no crew, more than {MAX_SHIFT} hours per worker in a day, an output rate more than {RATE_FACTOR} times above or below the package&apos;s usual rate (packages with at least 5 entries), a second entry for the same package and day, a unit that differs from the package, an entry date that differs from its report, an entry outside the package&apos;s actual dates, entries on a planned or cancelled package, negative figures, and entries for a package that no longer exists. Cancelled packages and packages with no output are left out of the table.
              {checks.skipped > 0 ? ` ${checks.skipped} ${plural(checks.skipped, "entry has", "entries have")} no usable date and ${plural(checks.skipped, "is", "are")} left out of the entry checks.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
