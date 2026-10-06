"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProduction, getProjectSchedule } from "@/lib/api";
import { plural, trunc } from "@/lib/openItems";
import { DATE_DAYS, FILTERS, GAP_POINTS, PAGE, REASON_LABEL, agreementMarkdown, buildAgreement, filterRows, flagText, type Agreement, type Filter, type Flag, type Row, type UnlinkedActivity, type UnlinkedPackage } from "@/lib/progressAgreement";
import { copyText } from "@/lib/textExport";
import type { ProductionControl, ScheduleActivity, ScheduleControl, WorkPackage } from "@/types/project";

import styles from "./ProjectProgressAgreementView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const PACKAGE_STATUS: Record<WorkPackage["status"], string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const ACTIVITY_STATUS: Record<ScheduleActivity["status"], string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};

const FLAG_CLASS: Record<Flag, string | undefined> = {
  programmeAhead: styles.chipBad,
  siteAhead: styles.chipBad,
  programmeDone: styles.chipWatch,
  siteDone: styles.chipWatch,
  startedProgramme: styles.chipWatch,
  startedSite: styles.chipWatch,
  startDates: styles.chipPlain,
  finishDates: styles.chipPlain,
};

function gapLine(row: Row): string {
  if (row.gap === 0) {
    return "Programme and site show the same progress";
  }

  return row.gap > 0 ? `Programme is ${row.gap} ${plural(row.gap, "point", "points")} ahead of site` : `Site is ${Math.abs(row.gap)} ${plural(Math.abs(row.gap), "point", "points")} ahead of programme`;
}

function Bar({ label, value, tone }: { label: string; value: number; tone: string | undefined }) {
  return (
    <span className={styles.bar}>
      <b>{label}</b>
      <span aria-label={`${label}: ${value}% complete`} className={styles.track} role="img">
        <i className={cx(styles.fill, tone)} style={{ width: `${value}%` }} />
      </span>
      <span className={styles.figure}>{value}%</span>
    </span>
  );
}

function PackageLine({ row }: { row: Row }) {
  const shown = row.activities.slice(0, 3);

  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>
          {row.code} {row.name}
        </strong>
        <small>
          {PACKAGE_STATUS[row.status]}, {row.activities.length} {plural(row.activities.length, "activity", "activities")}
        </small>
        <small>
          {shown.map((activity) => `${activity.code} ${activity.progress}%`).join(", ")}
          {row.activities.length > shown.length ? ` and ${row.activities.length - shown.length} more` : ""}
        </small>
      </span>

      <span className={styles.bars}>
        <Bar label="Programme" tone={styles.fillProgramme} value={row.programme} />
        <Bar label="Site" tone={styles.fillSite} value={row.site} />
        <small>{gapLine(row)}</small>
      </span>

      <span className={styles.verdict}>
        {row.flags.length === 0 && <em className={cx(styles.chip, styles.chipGood)}>Agree</em>}
        {row.flags.map((flag) => (
          <em className={cx(styles.chip, FLAG_CLASS[flag])} key={flag}>
            {flagText(flag, row)}
          </em>
        ))}
      </span>
    </li>
  );
}

function ActivityLine({ item }: { item: UnlinkedActivity }) {
  return (
    <li className={styles.loose}>
      <span className={styles.what}>
        <strong>
          {item.code} {trunc(item.name, 44)}
        </strong>
        <small>
          {ACTIVITY_STATUS[item.status]}, {item.progress}% complete
        </small>
      </span>

      <em className={cx(styles.chip, item.reason === "none" ? styles.chipWatch : styles.chipBad)}>{item.reason === "cancelled" && item.packageCode ? `Cancelled package ${item.packageCode}` : REASON_LABEL[item.reason]}</em>
    </li>
  );
}

function PackageOnlyLine({ item }: { item: UnlinkedPackage }) {
  return (
    <li className={styles.loose}>
      <span className={styles.what}>
        <strong>
          {item.code} {trunc(item.name, 44)}
        </strong>
        <small>
          {PACKAGE_STATUS[item.status]}, {item.completion}% complete on site
        </small>
      </span>

      <em className={cx(styles.chip, item.completion > 0 ? styles.chipWatch : styles.chipPlain)}>{item.completion > 0 ? "Progress, no activity" : "No activity"}</em>
    </li>
  );
}

export function ProjectProgressAgreementView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [schedule, setSchedule] = useState<ScheduleControl | null>(null);
  const [production, setProduction] = useState<ProductionControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [looseActivities, setLooseActivities] = useState(6);
  const [loosePackages, setLoosePackages] = useState(6);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    Promise.all([getProjectSchedule(projectId), getProjectProduction(projectId)])
      .then(([scheduleValue, productionValue]) => {
        if (!cancelled) {
          setSchedule(scheduleValue);
          setProduction(productionValue);
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

  const built = useMemo(() => (schedule && production ? buildAgreement(schedule, production) : null), [schedule, production]);
  const agreement: Agreement | null = built && built.ok ? built.data : null;
  const projectName = production?.project?.name ?? schedule?.project?.name ?? "Project";
  const list = useMemo(() => (agreement ? filterRows(agreement.rows, filter) : []), [agreement, filter]);
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";

  async function copySummary() {
    if (!agreement) {
      return;
    }

    const ok = await copyText(agreementMarkdown(agreement, list, projectName, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the progress comparison as Markdown." : "Could not copy the progress comparison.");
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

            <div className="eyebrow">PROGRAMME VS SITE PROGRESS</div>

            <h1>Do the programme and the site agree on how far along we are?</h1>

            <p className={styles.subtitle}>
              The schedule says how complete each activity is, and each work package carries its own completion figure from the site. This page matches the two through the work package set on each activity and shows where they tell different stories.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/schedule-health`}>
              Schedule health
            </Link>

            <Link className="secondary-link-button" href={`${base}/production-board`}>
              Production board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Comparing the programme with site progress…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the schedule and production data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "noActivities" ? "No schedule activities have been recorded yet, so there is no programme to compare with site progress." : "There are no work packages yet, so there is no site progress to compare with the programme."}</div>
          </section>
        )}

        {state === "ready" && agreement && (
          <>
            <section aria-label="Progress comparison summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>LINKED</div>
                <div className={styles.kpiValue}>{agreement.rows.length}</div>
                <div className={styles.kpiSub}>
                  of {agreement.packageCount} {plural(agreement.packageCount, "package has", "packages have")} a programme activity
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AGREE</div>
                <div className={styles.kpiValue}>{agreement.agree}</div>
                <div className={styles.kpiSub}>of {agreement.rows.length} with nothing flagged</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PROG. AHEAD</div>
                <div className={cx(styles.kpiValue, agreement.programmeAhead > 0 && styles.neg)}>{agreement.programmeAhead}</div>
                <div className={styles.kpiSub}>programme shows more done than site</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SITE AHEAD</div>
                <div className={cx(styles.kpiValue, agreement.siteAhead > 0 && styles.neg)}>{agreement.siteAhead}</div>
                <div className={styles.kpiSub}>site shows more done than programme</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NOT LINKED</div>
                <div className={cx(styles.kpiValue, agreement.unlinkedActivities.length > 0 && styles.neg)}>{agreement.unlinkedActivities.length}</div>
                <div className={styles.kpiSub}>
                  of {agreement.activityCount} activities, and {agreement.unlinkedPackages.length} {plural(agreement.unlinkedPackages.length, "package", "packages")} with none
                </div>
              </article>
            </section>

            {agreement.rows.length > 0 && (
              <section className={styles.controls}>
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
            )}

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PACKAGE BY PACKAGE</div>
                  <h2>Programme progress against site progress</h2>
                </div>

                {agreement.rows.length > 0 && (
                  <span className={styles.muted}>
                    {list.length} of {agreement.rows.length} {plural(agreement.rows.length, "package", "packages")}, flagged first
                  </span>
                )}
              </header>

              {agreement.rows.length === 0 ? (
                <p className={styles.quiet}>No schedule activity is linked to a work package, so the two cannot be compared. Set the work package on each activity to see them side by side.</p>
              ) : list.length === 0 ? (
                <p className={styles.quiet}>No package matches this selection.</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {list.slice(0, shown).map((row) => (
                      <PackageLine key={row.id} row={row} />
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

            {agreement.unlinkedActivities.length + agreement.unlinkedPackages.length === 0 ? (
              <p className={styles.quiet}>Every activity is linked to a work package and every work package has an activity.</p>
            ) : (
              <div className={styles.twoCol}>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">ACTIVITIES</div>
                      <h2>Left out of the comparison</h2>
                    </div>

                    <span className={styles.muted}>
                      {agreement.unlinkedActivities.length} of {agreement.activityCount}
                    </span>
                  </header>

                  {agreement.unlinkedActivities.length === 0 ? (
                    <p className={styles.quiet}>Every activity is linked to a work package.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {agreement.unlinkedActivities.slice(0, looseActivities).map((item) => (
                          <ActivityLine item={item} key={item.code} />
                        ))}
                      </ul>

                      {agreement.unlinkedActivities.length > looseActivities && (
                        <div className={styles.more}>
                          <button className={styles.moreButton} onClick={() => setLooseActivities((current) => current + 6)} type="button">
                            Show {Math.min(6, agreement.unlinkedActivities.length - looseActivities)} more
                          </button>
                          <span className={styles.muted}>
                            {looseActivities} of {agreement.unlinkedActivities.length} shown
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">WORK PACKAGES</div>
                      <h2>With no programme activity</h2>
                    </div>

                    <span className={styles.muted}>
                      {agreement.unlinkedPackages.length} of {agreement.packageCount}
                    </span>
                  </header>

                  {agreement.unlinkedPackages.length === 0 ? (
                    <p className={styles.quiet}>Every work package has a programme activity.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {agreement.unlinkedPackages.slice(0, loosePackages).map((item) => (
                          <PackageOnlyLine item={item} key={item.id} />
                        ))}
                      </ul>

                      {agreement.unlinkedPackages.length > loosePackages && (
                        <div className={styles.more}>
                          <button className={styles.moreButton} onClick={() => setLoosePackages((current) => current + 6)} type="button">
                            Show {Math.min(6, agreement.unlinkedPackages.length - loosePackages)} more
                          </button>
                          <span className={styles.muted}>
                            {loosePackages} of {agreement.unlinkedPackages.length} shown
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </div>
            )}

            <p className={styles.note}>
              Programme progress is the average of a package&apos;s linked activities, weighted by their original duration (activities with no duration count equally). Site progress is the work package&apos;s completion percentage. A gap of {GAP_POINTS} points or more is flagged, as are packages whose status disagrees with their activities (all activities done but the package open, the package complete with activities still open, work started on only one side), and start or finish dates {DATE_DAYS} or more days apart. Finish dates are compared only when both sides are complete. Activities set to a cancelled or unknown package, or to none, and cancelled packages are left out of the comparison.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
