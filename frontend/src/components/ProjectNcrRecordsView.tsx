"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectQuality } from "@/lib/api";
import { DEFAULT_WINDOW, FILTERS, FLAG_LABEL, GOOD, MIN_GROUP, MIN_TEXT, PAGE, WATCH, WINDOWS, bandOf, buildRecords, categoryLabel, filterRows, flagsOf, pct, recordsMarkdown, severityLabel, type Closed, type Filter, type Flag, type Group, type Records } from "@/lib/ncrRecords";
import { formatDay, plural, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { QualityControl } from "@/types/project";

import styles from "./ProjectNcrRecordsView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const FILL: Record<"good" | "watch" | "bad", string | undefined> = {
  good: styles.fillGood,
  watch: styles.fillWatch,
  bad: styles.fillBad,
};

function chipOf(flag: Flag, row: Closed): string | undefined {
  if (flag === "noCloseDate" || flag === "closedBeforeRaised") {
    return styles.chipPlain;
  }

  return row.serious ? styles.chipBad : styles.chipWatch;
}

function GroupLine({ group }: { group: Group }) {
  const band = bandOf(group);

  return (
    <li className={styles.groupRow}>
      <span className={styles.what}>
        <strong>{group.label}</strong>
        <small>
          {group.closed} closed
        </small>
      </span>

      <span aria-label={`${group.label}: ${pct(group.share)} of closed NCRs fully recorded`} className={styles.track} role="img">
        {group.share !== null && <i className={cx(styles.fill, band ? FILL[band] : styles.fillQuiet)} style={{ width: `${group.share * 100}%` }} />}
      </span>

      <span className={styles.rateFig}>
        <b>{pct(group.share)}</b>
        <small>
          {group.complete} of {group.closed} complete
        </small>
      </span>
    </li>
  );
}

function RecordLine({ label, text }: { label: string; text: string | null }) {
  return (
    <span className={styles.record}>
      <b>{label}</b>
      {text ? <span>{trunc(text, 90)}</span> : <span className={styles.missing}>not recorded</span>}
    </span>
  );
}

function ClosedLine({ row }: { row: Closed }) {
  const flags = flagsOf(row);

  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{trunc(row.title, 72)}</strong>
        <small>
          {row.reference}, {categoryLabel(row.category).toLowerCase()}, {severityLabel(row.severity).toLowerCase()}
        </small>
        <small>
          Closed {formatDay(row.closedDay)}
          {row.daysOpen !== null ? `, after ${row.daysOpen} ${plural(row.daysOpen, "day", "days")}` : ""}
        </small>
        <small>{row.owner ? `Owner ${row.owner}` : "No owner recorded"}</small>
      </span>

      <span className={styles.records}>
        <RecordLine label="Root cause" text={row.rootCause} />
        <RecordLine label="Corrective action" text={row.action} />
        <RecordLine label="Verification" text={row.verification} />
      </span>

      <span className={styles.verdict}>
        {row.complete && <em className={cx(styles.chip, styles.chipGood)}>Complete record</em>}
        {flags.map((flag) => (
          <em className={cx(styles.chip, chipOf(flag, row))} key={flag}>
            {FLAG_LABEL[flag]}
          </em>
        ))}
      </span>
    </li>
  );
}

export function ProjectNcrRecordsView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<QualityControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [ownersShown, setOwnersShown] = useState(8);
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

    getProjectQuality(projectId)
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

  const built = useMemo(() => (data ? buildRecords(data, today, windowDays) : null), [data, today, windowDays]);
  const records: Records | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (records ? filterRows(records.rows, filter) : []), [records, filter]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const seriousRows = records ? records.rows.filter((row) => row.serious) : [];

  async function copySummary() {
    if (!records) {
      return;
    }

    const ok = await copyText(recordsMarkdown(records, list, projectName, windowLabel, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the NCR closure records as Markdown." : "Could not copy the NCR closure records.");
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

            <div className="eyebrow">NCR CLOSURE RECORDS</div>

            <h1>Were closed NCRs closed properly?</h1>

            <p className={styles.subtitle}>
              Closing a non-conformance report should leave a record: what caused the defect, what was done about it, and who checked that it worked. This page looks at each closed NCR and shows which of those three were never written down.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/quality-board`}>
              Quality board
            </Link>

            <Link className="secondary-link-button" href={`${base}/pareto`}>
              Pareto analysis
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the non-conformance reports…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the non-conformance reports. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "noNcrs" ? "No non-conformance reports have been recorded yet, so there are no closure records to look at." : "No non-conformance report has been closed yet, so there are no closure records to look at."}</div>
          </section>
        )}

        {state === "ready" && records && (
          <>
            <section aria-label="NCR closure summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>CLOSED</div>
                <div className={styles.kpiValue}>{records.closed}</div>
                <div className={styles.kpiSub}>
                  {records.seriousBase} critical or major in the last {windowLabel}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COMPLETE</div>
                <div className={cx(styles.kpiValue, records.completeShare !== null && records.completeShare < WATCH && styles.neg)}>{pct(records.completeShare)}</div>
                <div className={styles.kpiSub}>{records.closed > 0 ? `${records.complete} of ${records.closed} have all three records` : "no NCR closed in this period"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO ROOT CAUSE</div>
                <div className={cx(styles.kpiValue, records.noRoot > 0 && styles.neg)}>{records.noRoot}</div>
                <div className={styles.kpiSub}>{records.closed > 0 ? `${pct(records.noRoot / records.closed)} of closed NCRs` : "—"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>UNVERIFIED</div>
                <div className={cx(styles.kpiValue, records.noVerification > 0 && styles.neg)}>{records.noVerification}</div>
                <div className={styles.kpiSub}>closed with no verification notes</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SERIOUS GAPS</div>
                <div className={cx(styles.kpiValue, records.serious > 0 && styles.neg)}>{records.serious}</div>
                <div className={styles.kpiSub}>of {records.seriousBase} critical or major closed with a gap</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Closed in the last</span>

                <div aria-label="Period measured" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={windowDays === option.days}
                      className={cx(styles.segment, windowDays === option.days && styles.segmentOn)}
                      key={option.days}
                      onClick={() => {
                        setWindowDays(option.days);
                        setShown(PAGE);
                        setOwnersShown(8);
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
                <span className={styles.controlLabel}>NCRs</span>

                <div aria-label="Which NCRs to list" className={styles.segmented} role="group">
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
                {seriousRows.length} critical or major {plural(seriousRows.length, "NCR was", "NCRs were")} closed with a gap in {plural(seriousRows.length, "its", "their")} records: {seriousRows.slice(0, 4).map((row) => row.reference).join(", ")}
                {seriousRows.length > 4 ? ` and ${seriousRows.length - 4} more` : ""}.
              </p>
            )}

            {records.readyIncomplete.length > 0 && (
              <p className={styles.caution} role="note">
                {records.readyIncomplete.length} {plural(records.readyIncomplete.length, "NCR is", "NCRs are")} ready for verification with no corrective action recorded: {records.readyIncomplete.slice(0, 4).join(", ")}
                {records.readyIncomplete.length > 4 ? ` and ${records.readyIncomplete.length - 4} more` : ""}.
              </p>
            )}

            {records.rows.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No NCR was closed in this period. Try a longer period.</div>
              </section>
            ) : (
              <>
                <div className={styles.twoCol}>
                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY SEVERITY</div>
                        <h2>Are the serious ones documented</h2>
                      </div>
                    </header>

                    <ul className={styles.rates}>
                      {records.severities.map((group) => (
                        <GroupLine group={group} key={group.key} />
                      ))}
                    </ul>
                  </section>

                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY CATEGORY</div>
                        <h2>Which kinds of defect</h2>
                      </div>
                    </header>

                    <ul className={styles.rates}>
                      {records.categories.map((group) => (
                        <GroupLine group={group} key={group.key} />
                      ))}
                    </ul>

                    <p className={styles.hint}>
                      Green is {Math.round(GOOD * 100)}% or more complete, amber {Math.round(WATCH * 100)}% or more, red below that. Groups of fewer than {MIN_GROUP} NCRs are not coloured.
                    </p>
                  </section>
                </div>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">BY OWNER</div>
                      <h2>Who closes NCRs with the paperwork</h2>
                    </div>

                    <span className={styles.muted}>
                      {records.owners.length} {plural(records.owners.length, "owner", "owners")}, most closed first
                    </span>
                  </header>

                  <ul className={styles.rates}>
                    {records.owners.slice(0, ownersShown).map((group) => (
                      <GroupLine group={group} key={group.key} />
                    ))}
                  </ul>

                  {records.owners.length > ownersShown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setOwnersShown((current) => current + 8)} type="button">
                        Show {Math.min(8, records.owners.length - ownersShown)} more
                      </button>
                      <span className={styles.muted}>
                        {ownersShown} of {records.owners.length} shown
                      </span>
                    </div>
                  )}
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">NCR BY NCR</div>
                      <h2>What was written down when each one closed</h2>
                    </div>

                    <span className={styles.muted}>
                      {list.length} of {records.rows.length} {plural(records.rows.length, "NCR", "NCRs")}, weakest records first
                    </span>
                  </header>

                  {list.length === 0 ? (
                    <p className={styles.quiet}>No closed NCR matches this selection.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {list.slice(0, shown).map((row) => (
                          <ClosedLine key={row.key} row={row} />
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
              An NCR is counted in the period it was closed. A closed NCR is complete when it has a root cause, a corrective action and verification notes. A field left empty, or holding only a placeholder such as &quot;n/a&quot; or &quot;ok&quot; (anything under {MIN_TEXT} characters, or a word such as none, done or tbd), counts as not recorded, and the page does not judge whether what was written is adequate. A closed NCR with no close date is placed by the date it was last updated, and one closed before it was raised is flagged. Voided NCRs are left out.
              {records.voided > 0 ? ` ${records.voided} voided ${plural(records.voided, "NCR is", "NCRs are")} left out.` : ""}
              {records.skipped > 0 ? ` ${records.skipped} closed ${plural(records.skipped, "NCR has", "NCRs have")} no usable date and ${plural(records.skipped, "is", "are")} left out.` : ""}
              {records.future > 0 ? ` ${records.future} closed ${plural(records.future, "NCR is", "NCRs are")} dated in the future and ${plural(records.future, "is", "are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
