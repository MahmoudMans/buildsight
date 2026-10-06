"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSafety } from "@/lib/api";
import { DEFAULT_WINDOW, FILTERS, GOOD, MIN_GROUP, MIN_TEXT, OPEN_LONG, PAGE, REPORT_DAYS, WATCH, WINDOWS, bandOf, buildInvestigations, dayCount, filterRows, flagText, investigationsMarkdown, pct, typeLabel, type Bucket, type Flag, type Filter, type Group, type Investigations, type Row } from "@/lib/incidentInvestigations";
import { formatDay, plural, trunc, words } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { SafetyControl } from "@/types/project";

import styles from "./ProjectIncidentInvestigationsView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const FILL: Record<"good" | "watch" | "bad", string | undefined> = {
  good: styles.fillGood,
  watch: styles.fillWatch,
  bad: styles.fillBad,
};

const BUCKET_FILL: Array<string | undefined> = [styles.fillGood, styles.fillGood, styles.fillWatch, styles.fillBad, styles.fillBad];

function chipOf(flag: Flag): string | undefined {
  if (flag === "reportedLate" || flag === "openLong") {
    return styles.chipBad;
  }

  if (flag === "closedBeforeReported" || flag === "reportedBeforeOccurred" || flag === "noCloseDate") {
    return styles.chipPlain;
  }

  return styles.chipWatch;
}

function BucketLine({ bucket, index }: { bucket: Bucket; index: number }) {
  return (
    <li className={styles.groupRow}>
      <span className={styles.what}>
        <strong>{bucket.label}</strong>
        <small>
          {bucket.count} {plural(bucket.count, "incident", "incidents")}
        </small>
      </span>

      <span aria-label={`${bucket.label}: ${pct(bucket.share)} of incidents`} className={styles.track} role="img">
        {bucket.share !== null && bucket.count > 0 && <i className={cx(styles.fill, BUCKET_FILL[index])} style={{ width: `${bucket.share * 100}%` }} />}
      </span>

      <span className={styles.rateFig}>
        <b>{pct(bucket.share)}</b>
      </span>
    </li>
  );
}

function BarLine({ label, share, base, text }: { label: string; share: number | null; base: number; text: string }) {
  const band = bandOf(share, base);

  return (
    <span className={styles.barLine} title={text}>
      <em>{label}</em>
      <span className={styles.track}>{share !== null && <i className={cx(styles.fill, band ? FILL[band] : styles.fillQuiet)} style={{ width: `${share * 100}%` }} />}</span>
      <b>{pct(share)}</b>
    </span>
  );
}

function GroupLine({ group }: { group: Group }) {
  return (
    <li className={styles.grp}>
      <span className={styles.what}>
        <strong>{group.label}</strong>
        <small>
          {group.count} {plural(group.count, "incident", "incidents")}
        </small>
      </span>

      <span className={styles.bars}>
        <BarLine base={group.measured} label="In a day" share={group.onTimeShare} text={`${group.onTime} of ${group.measured} reported within a day`} />
        <BarLine base={group.closed} label="Complete" share={group.completeShare} text={`${group.complete} of ${group.closed} closed incidents have all three records`} />
      </span>
    </li>
  );
}

function RecordLine({ label, text, open }: { label: string; text: string | null; open: boolean }) {
  return (
    <span className={styles.record}>
      <b>{label}</b>
      {text ? <span>{trunc(text, 90)}</span> : <span className={open ? styles.pending : styles.missing}>{open ? "not recorded yet" : "not recorded"}</span>}
    </span>
  );
}

function IncidentLine({ row }: { row: Row }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{trunc(row.title, 72)}</strong>
        <small>
          {row.reference}, {typeLabel(row.type).toLowerCase()}, {words(row.severity).toLowerCase()}
        </small>
        <small>
          Happened {formatDay(row.occurred)}
          {row.reported !== null ? `, reported ${formatDay(row.reported)}` : ", no report date"}
        </small>
        <small>
          {row.isClosed
            ? row.closed !== null
              ? `Closed ${formatDay(row.closed)}${row.closedDays !== null ? ` (${dayCount(row.closedDays)} after the report)` : ""}`
              : "Closed, no close date recorded"
            : `${words(row.status)}, open ${dayCount(row.openDays ?? 0)}`}
        </small>
      </span>

      <span className={styles.records}>
        <RecordLine label="Immediate action" open={!row.isClosed} text={row.immediate} />
        <RecordLine label="Root cause" open={!row.isClosed} text={row.rootCause} />
        <RecordLine label="Investigation" open={!row.isClosed} text={row.investigation} />
      </span>

      <span className={styles.verdict}>
        {row.flags.length === 0 && <em className={cx(styles.chip, row.isClosed ? styles.chipGood : styles.chipPlain)}>{row.isClosed ? "In order" : "Open"}</em>}
        {row.flags.map((flag) => (
          <em className={cx(styles.chip, chipOf(flag))} key={flag}>
            {flagText(flag, row)}
          </em>
        ))}
      </span>
    </li>
  );
}

function refs(list: string[]): string {
  return `${list.slice(0, 4).join(", ")}${list.length > 4 ? ` and ${list.length - 4} more` : ""}`;
}

export function ProjectIncidentInvestigationsView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<SafetyControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [typesShown, setTypesShown] = useState(6);
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

    getProjectSafety(projectId)
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

  const built = useMemo(() => (data ? buildInvestigations(data, today, windowDays) : null), [data, today, windowDays]);
  const inv: Investigations | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (inv ? filterRows(inv.rows, filter) : []), [inv, filter]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const seriousRows = inv ? inv.rows.filter((row) => row.serious) : [];

  async function copySummary() {
    if (!inv) {
      return;
    }

    const ok = await copyText(investigationsMarkdown(inv, list, projectName, windowLabel, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the incident investigations as Markdown." : "Could not copy the incident investigations.");
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

            <div className="eyebrow">INCIDENT INVESTIGATIONS</div>

            <h1>Are incidents reported promptly and investigated properly?</h1>

            <p className={styles.subtitle}>
              An incident only teaches the site something if it is reported quickly and followed through. This page looks back at the incidents that happened, and shows how long each took to be reported, which are still open, and which were closed without an immediate action, a root cause or investigation notes.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/safety-board`}>
              Safety board
            </Link>

            <Link className="secondary-link-button" href={`${base}/safety-follow-up`}>
              Safety follow-up
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the incidents…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the safety data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No incident has been logged yet, so there is nothing to look back on. Voided incidents are not counted.</div>
          </section>
        )}

        {state === "ready" && inv && (
          <>
            <section aria-label="Incident investigations summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>INCIDENTS</div>
                <div className={styles.kpiValue}>{inv.incidents}</div>
                <div className={styles.kpiSub}>happened in the last {windowLabel}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>IN A DAY</div>
                <div className={cx(styles.kpiValue, inv.onTimeShare !== null && inv.onTimeShare < WATCH && styles.neg)}>{pct(inv.onTimeShare)}</div>
                <div className={styles.kpiSub}>{inv.measured > 0 ? `${inv.onTime} of ${inv.measured} reported within a day` : "no incident in this period"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LATE REPORTS</div>
                <div className={cx(styles.kpiValue, inv.late > 0 && styles.neg)}>{inv.late}</div>
                <div className={styles.kpiSub}>reported over a day after</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FULL RECORDS</div>
                <div className={cx(styles.kpiValue, inv.completeShare !== null && inv.completeShare < WATCH && styles.neg)}>{pct(inv.completeShare)}</div>
                <div className={styles.kpiSub}>{inv.closed > 0 ? `${inv.complete} of ${inv.closed} closed incidents` : "no incident closed yet"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN {OPEN_LONG}+ DAYS</div>
                <div className={cx(styles.kpiValue, inv.openLong > 0 && styles.neg)}>{inv.openLong}</div>
                <div className={styles.kpiSub}>of {inv.open} not yet closed</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Happened in the last</span>

                <div aria-label="Period measured" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={windowDays === option.days}
                      className={cx(styles.segment, windowDays === option.days && styles.segmentOn)}
                      key={option.days}
                      onClick={() => {
                        setWindowDays(option.days);
                        setShown(PAGE);
                        setTypesShown(6);
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
                <span className={styles.controlLabel}>Incidents</span>

                <div aria-label="Which incidents to list" className={styles.segmented} role="group">
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

            {seriousRows.length > 0 && (
              <p className={styles.caution} role="note">
                {seriousRows.length} critical or high {plural(seriousRows.length, "incident was", "incidents were")} reported late or closed with a gap: {refs(seriousRows.map((row) => row.reference))}.
              </p>
            )}

            {inv.staleOutside.length > 0 && (
              <p className={styles.caution} role="note">
                {inv.staleOutside.length} older {plural(inv.staleOutside.length, "incident is", "incidents are")} also still open after more than {OPEN_LONG} days: {refs(inv.staleOutside)}. {plural(inv.staleOutside.length, "It happened", "They happened")} before this period, so {plural(inv.staleOutside.length, "it is", "they are")} not counted below.
              </p>
            )}

            {inv.rows.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No incident happened in this period. Try a longer period.</div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">HOW SOON</div>
                      <h2>Time from the incident to the report</h2>
                    </div>

                    <span className={styles.muted}>{inv.lagMedian !== null ? `median ${dayCount(inv.lagMedian)}, ${inv.measured} measured` : "no report dates to measure"}</span>
                  </header>

                  <ul className={styles.rates}>
                    {inv.buckets.map((bucket, index) => (
                      <BucketLine bucket={bucket} index={index} key={bucket.label} />
                    ))}
                  </ul>

                  <p className={styles.hint}>
                    A report within {REPORT_DAYS} {plural(REPORT_DAYS, "day", "days")} counts as prompt. An incident with no usable report date, or reported before it happened, cannot be measured and is left out of these bars.
                  </p>
                </section>

                <div className={styles.twoCol}>
                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY SEVERITY</div>
                        <h2>Which severities are followed through</h2>
                      </div>
                    </header>

                    <ul className={styles.rates}>
                      {inv.severities.map((group) => (
                        <GroupLine group={group} key={group.key} />
                      ))}
                    </ul>

                    <p className={styles.hint}>
                      Green is {Math.round(GOOD * 100)}% or more, amber {Math.round(WATCH * 100)}% or more, red below that. Bars with fewer than {MIN_GROUP} incidents behind them are not coloured.
                    </p>
                  </section>

                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY TYPE</div>
                        <h2>Which kinds are followed through</h2>
                      </div>

                      <span className={styles.muted}>
                        {inv.types.length} {plural(inv.types.length, "type", "types")}
                      </span>
                    </header>

                    <ul className={styles.rates}>
                      {inv.types.slice(0, typesShown).map((group) => (
                        <GroupLine group={group} key={group.key} />
                      ))}
                    </ul>

                    {inv.types.length > typesShown && (
                      <div className={styles.more}>
                        <button className={styles.moreButton} onClick={() => setTypesShown((current) => current + 6)} type="button">
                          Show {Math.min(6, inv.types.length - typesShown)} more
                        </button>
                        <span className={styles.muted}>
                          {typesShown} of {inv.types.length} shown
                        </span>
                      </div>
                    )}
                  </section>
                </div>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">INCIDENT BY INCIDENT</div>
                      <h2>How each incident was handled</h2>
                    </div>

                    <span className={styles.muted}>
                      {list.length} of {inv.rows.length} {plural(inv.rows.length, "incident", "incidents")}, most serious first
                    </span>
                  </header>

                  {list.length === 0 ? (
                    <p className={styles.quiet}>No incident matches this selection.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {list.slice(0, shown).map((row) => (
                          <IncidentLine key={row.key} row={row} />
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
              Incidents are counted in the period they happened; voided incidents are left out. The delay is the days from the incident to the date it was reported. A closed incident is complete when it has an immediate action, a root cause and investigation notes. A field left empty, or holding only a placeholder such as &quot;n/a&quot; or &quot;ok&quot; (fewer than {MIN_TEXT} characters), counts as not recorded; incidents still open are not expected to have them yet. An incident not yet closed is marked as long open after {OPEN_LONG} days. A closed incident with no close date, or closed before it was reported, is flagged because its handling time cannot be judged.
              {inv.future > 0 ? ` ${inv.future} ${plural(inv.future, "incident is", "incidents are")} dated in the future and ${plural(inv.future, "is", "are")} left out.` : ""}
              {inv.skipped > 0 ? ` ${inv.skipped} ${plural(inv.skipped, "incident has", "incidents have")} no usable date and ${plural(inv.skipped, "is", "are")} left out.` : ""}
              {inv.voided > 0 ? ` ${inv.voided} voided ${plural(inv.voided, "incident is", "incidents are")} not counted.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
