"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectDocuments } from "@/lib/api";
import { DEFAULT_WINDOW, GRACE, PAGE, SHOWS, WINDOWS, buildCoverage, coverageMarkdown, daysText, filterRevs, pct, whereText, type Coverage, type Rev, type Show } from "@/lib/transmittalCoverage";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { DocumentControl } from "@/types/project";

import styles from "./ProjectTransmittalCoverageView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function RevRow({ rev }: { rev: Rev }) {
  return (
    <li className={cx(styles.row, rev.late && styles.rowLate)}>
      <span>
        <strong>{rev.number}</strong>
        <small>
          rev {rev.code}, {rev.status === "APPROVED" ? "approved" : "issued"} {formatDay(rev.issued)}
        </small>
      </span>

      <span className={styles.what}>
        {trunc(rev.title, 70)}
        <small>{whereText(rev)}</small>
      </span>

      <span className={styles.when}>
        {rev.state === "sent" ? (
          <em className={cx(styles.chip, styles.chipGood)}>Sent</em>
        ) : (
          <em className={cx(styles.chip, rev.late ? styles.chipBad : styles.chipWatch)}>
            {rev.state === "drafted" ? "In draft" : "Not sent"}, {daysText(rev.age)}
          </em>
        )}
      </span>
    </li>
  );
}

function DisciplineBars({ coverage }: { coverage: Coverage }) {
  return (
    <ul className={styles.breakdown}>
      {coverage.disciplines.map((row) => (
        <li className={styles.breakRow} key={row.key}>
          <strong>{row.label}</strong>

          <span aria-label={`${row.label}: ${row.sent} sent, ${row.drafted} in draft transmittals, ${row.unsent} on no transmittal`} className={styles.split} role="img">
            {row.sent > 0 && <i className={styles.splitGood} style={{ flexGrow: row.sent }} title={`${row.sent} sent`} />}
            {row.drafted > 0 && <i className={styles.splitWatch} style={{ flexGrow: row.drafted }} title={`${row.drafted} only in a draft transmittal`} />}
            {row.unsent > 0 && <i className={styles.splitBad} style={{ flexGrow: row.unsent }} title={`${row.unsent} on no transmittal`} />}
          </span>

          <span className={styles.breakNum}>
            <b className={cx(row.unsent + row.drafted > 0 && styles.neg)}>{row.sent} of {row.total}</b>
            <small>sent</small>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function ProjectTransmittalCoverageView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<DocumentControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [show, setShow] = useState<Show>("action");
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectDocuments(projectId)
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

  const built = useMemo(() => (data ? buildCoverage(data, today, windowDays) : null), [data, today, windowDays]);
  const coverage = built && built.ok ? built.coverage : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (coverage ? filterRevs(coverage.revs, show) : []), [coverage, show]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const waiting = coverage ? coverage.drafted + coverage.unsent : 0;
  const oldestDraft = coverage?.drafts[0] ?? null;

  async function copySummary() {
    if (!coverage) {
      return;
    }

    const ok = await copyText(coverageMarkdown(coverage, list, projectName, today, windowLabel));

    setMessage(ok ? "Copied the coverage as Markdown." : "Could not copy the coverage.");
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

            <div className="eyebrow">TRANSMITTAL COVERAGE</div>

            <h1>Have the revisions we issued actually been sent to anyone?</h1>

            <p className={styles.subtitle}>
              A drawing marked issued in the register has not reached the site or the client until a transmittal records it going out. This sets every issued and approved revision against the transmittals, and lists the ones with no trace of being sent.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/rfi-board`}>
              RFI and document board
            </Link>

            <Link className="secondary-link-button" href={`${base}/document-board`}>
              Document board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the document register and transmittals…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the document data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No document revisions or transmittals are recorded yet, so there is nothing to compare.</div>
          </section>
        )}

        {state === "ready" && coverage && (
          <>
            <section aria-label="Transmittal coverage summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>REVISIONS ISSUED</div>
                <div className={styles.kpiValue}>{coverage.total}</div>
                <div className={styles.kpiSub}>issued or approved, in the last {windowLabel}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SENT</div>
                <div className={cx(styles.kpiValue, coverage.sentRate !== null && coverage.sentRate < 0.8 && styles.neg, coverage.sentRate === 1 && styles.pos)}>{pct(coverage.sentRate)}</div>
                <div className={styles.kpiSub}>{coverage.sent} on an issued transmittal</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NOT SENT</div>
                <div className={cx(styles.kpiValue, coverage.late > 0 && styles.neg)}>{waiting}</div>
                <div className={styles.kpiSub}>
                  {coverage.late} waiting more than {GRACE} days
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DRAFT TRANSMITTALS</div>
                <div className={cx(styles.kpiValue, coverage.staleDrafts > 0 && styles.neg)}>{coverage.drafts.length}</div>
                <div className={styles.kpiSub}>{coverage.drafts.length === 0 ? "none waiting to go out" : oldestDraft && oldestDraft.age > 0 ? `oldest ${daysText(oldestDraft.age)} old` : "none older than a day"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TIME TO ISSUE</div>
                <div className={styles.kpiValue}>{coverage.avgIssueDays === null ? "—" : `${coverage.avgIssueDays.toFixed(1)} d`}</div>
                <div className={styles.kpiSub}>{coverage.slowest === null ? "no issued transmittals" : `average, slowest ${daysText(coverage.slowest)}`}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Issued in the last</span>

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
                <span className={styles.controlLabel}>List</span>

                <div aria-label="Which revisions to list" className={styles.segmented} role="group">
                  {SHOWS.map((option) => (
                    <button
                      aria-pressed={show === option.key}
                      className={cx(styles.segment, show === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setShow(option.key);
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

            {coverage.dangling > 0 && (
              <p className={styles.caution} role="note">
                {coverage.dangling} {plural(coverage.dangling, "revision listed on a transmittal is", "revisions listed on transmittals are")} not in the document register, so {plural(coverage.dangling, "it cannot", "they cannot")} be matched to a document.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">REVISIONS</div>
                  <h2>{show === "action" ? "Issued, but with no transmittal out" : "Every issued revision and where it went"}</h2>
                </div>

                <span className={styles.muted}>
                  {list.length} of {coverage.total} {plural(coverage.total, "revision", "revisions")}, oldest unsent first
                </span>
              </header>

              {list.length === 0 ? (
                <p className={styles.quiet}>{coverage.total === 0 ? `No revision was issued or approved in the last ${windowLabel}.` : "Every issued revision in this period is on an issued transmittal."}</p>
              ) : (
                <>
                  <ul className={styles.rows}>
                    {list.slice(0, shown).map((rev) => (
                      <RevRow key={rev.id} rev={rev} />
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

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY DISCIPLINE</div>
                    <h2>Where the gaps are</h2>
                  </div>
                </header>

                {coverage.disciplines.length === 0 ? <p className={styles.quiet}>No revisions in this period.</p> : <DisciplineBars coverage={coverage} />}

                <ul className={styles.legend}>
                  <li>
                    <i className={cx(styles.swatch, styles.splitGood)} />
                    Sent
                  </li>
                  <li>
                    <i className={cx(styles.swatch, styles.splitWatch)} />
                    Only in a draft
                  </li>
                  <li>
                    <i className={cx(styles.swatch, styles.splitBad)} />
                    On no transmittal
                  </li>
                </ul>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">WAITING TO GO OUT</div>
                    <h2>Draft transmittals</h2>
                  </div>

                  <span className={styles.muted}>{coverage.drafts.length}</span>
                </header>

                {coverage.drafts.length === 0 ? (
                  <p className={styles.quiet}>No transmittal is sitting in draft.</p>
                ) : (
                  <ul className={styles.drafts}>
                    {coverage.drafts.slice(0, 8).map((draft) => (
                      <li className={styles.draftRow} key={draft.id}>
                        <span>
                          <strong>{draft.reference}</strong>
                          <small>
                            {draft.recipient}
                            {draft.purpose ? `, ${draft.purpose.toLowerCase()}` : ""}
                          </small>
                        </span>

                        <span className={styles.draftNum}>
                          <em className={cx(styles.chip, draft.stale ? styles.chipBad : styles.chipPlain)}>{daysText(draft.age)} old</em>
                          <small>{draft.empty ? "no revisions on it" : `${draft.revisions} ${plural(draft.revisions, "revision", "revisions")}`}</small>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                {coverage.drafts.length > 8 && <p className={styles.keyNote}>{coverage.drafts.length - 8} more, newer, not shown.</p>}
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">RECIPIENTS</div>
                  <h2>Who the issued transmittals went to</h2>
                </div>

                <span className={styles.muted}>
                  {coverage.issuedTransmittals} issued {plural(coverage.issuedTransmittals, "transmittal", "transmittals")}
                </span>
              </header>

              {coverage.recipients.length === 0 ? (
                <p className={styles.quiet}>No transmittal was issued in this period.</p>
              ) : (
                <ul className={styles.recipients}>
                  {coverage.recipients.map((recipient) => (
                    <li className={styles.recipientRow} key={recipient.key}>
                      <strong>{recipient.name}</strong>

                      <span>
                        {recipient.transmittals} {plural(recipient.transmittals, "transmittal", "transmittals")}, {recipient.revisions} {plural(recipient.revisions, "revision", "revisions")}
                        <small>last issued {formatDay(recipient.last)}</small>
                      </span>

                      <span className={styles.purposes}>{recipient.purposes.length > 0 ? recipient.purposes.join(", ") : "no purpose recorded"}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className={styles.note}>
              A revision is counted when its status is issued or approved and it was issued in the period; drafts, revisions still in review and superseded revisions are left out. It is sent when it appears on a transmittal with the issued status, whenever that transmittal was issued, and drafted when it appears on draft transmittals alone. One waiting more than {GRACE} days is shown in red. Recipients are matched on the name as typed, ignoring case and spacing, and draft transmittals are listed whatever their date.
              {coverage.emptyTransmittals > 0 ? ` ${coverage.emptyTransmittals} issued ${plural(coverage.emptyTransmittals, "transmittal has", "transmittals have")} no revisions on ${plural(coverage.emptyTransmittals, "it", "them")}.` : ""}
              {coverage.skipped > 0 ? ` ${coverage.skipped} ${plural(coverage.skipped, "record has", "records have")} no usable date and ${plural(coverage.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
