"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectDocuments } from "@/lib/api";
import {
  DRAFT_STALE_DAYS,
  HEAVY_REVISIONS,
  REVIEW_STALE_DAYS,
  STATUS_LABEL,
  STATUS_ORDER,
  buildDocuments,
  fileSize,
  type DocRow,
  type DocStatus,
} from "@/lib/documentBoard";
import { plural, startOfToday, words } from "@/lib/openItems";
import type { DocumentControl } from "@/types/project";

import styles from "./ProjectDocumentBoardView.module.css";

type TabKey = "stuck" | "none" | "heavy" | "duplicates" | "text";

const LIST_LIMIT = 12;

const STATUS_CLASS: Record<DocStatus, string | undefined> = {
  APPROVED: styles.stApproved,
  ISSUED: styles.stIssued,
  FOR_REVIEW: styles.stReview,
  DRAFT: styles.stDraft,
  SUPERSEDED: styles.stSuperseded,
  NONE: styles.stNone,
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function percent(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

export function ProjectDocumentBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [data, setData] = useState<DocumentControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [tab, setTab] = useState<TabKey | null>(null);
  const [expanded, setExpanded] = useState(false);

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
          setState("failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => (data ? buildDocuments(data, today) : null), [data, today]);

  const tabs = useMemo(
    () =>
      model
        ? ([
            { key: "stuck", label: "Stuck in review", count: model.stuck.length },
            { key: "none", label: "No revision", count: model.none.length },
            { key: "heavy", label: "Heavy rework", count: model.heavy.length },
            { key: "duplicates", label: "Duplicate files", count: model.duplicates.length },
            { key: "text", label: "No readable text", count: model.unreadable.length },
          ] as const)
        : [],
    [model],
  );

  const activeKey: TabKey = tab ?? tabs.find((item) => item.count > 0)?.key ?? "stuck";
  const topMonth = Math.max(1, ...(model?.months ?? []).map((item) => item.count));
  const widest = Math.max(1, ...(model?.disciplines ?? []).map((item) => item.total));

  const empty = state === "ready" && model !== null && model.rows.length === 0;

  function renderRows(list: DocRow[], note: (row: DocRow) => string) {
    const rows = expanded ? list : list.slice(0, LIST_LIMIT);

    return (
      <>
        <ul className={styles.attention}>
          {rows.map((row) => (
            <li key={row.doc.id}>
              <span className={styles.attMain}>
                <strong>{row.doc.documentNumber}</strong>
                <span>{row.doc.title}</span>
              </span>

              <span className={cx(styles.statePill, STATUS_CLASS[row.status])}>{STATUS_LABEL[row.status]}</span>

              <span className={styles.attNote}>{note(row)}</span>
            </li>
          ))}
        </ul>

        {list.length > LIST_LIMIT && (
          <button className={cx(styles.linkButton, styles.moreButton)} onClick={() => setExpanded((open) => !open)} type="button">
            {expanded ? `Show first ${LIST_LIMIT}` : `Show all ${list.length}`}
          </button>
        )}
      </>
    );
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

            <div className="eyebrow">DOCUMENT CONTROL</div>

            <h1>Is the paperwork under control?</h1>

            <p className={styles.subtitle}>
              Where every document stands, which ones are stuck waiting for review, which keep being reworked, and which files are copies
              of each other or cannot be searched.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/documents`}>
              Open documents
            </Link>

            <Link className="secondary-link-button" href={`${base}/rfi-board`}>
              RFI board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Loading documents…</div>}

        {state === "failed" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the documents. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {empty && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No documents are registered yet. Add some on the documents page and they will appear here.</div>
          </section>
        )}

        {state === "ready" && model && model.rows.length > 0 && (
          <>
            <section aria-label="Document summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>DOCUMENTS</div>
                <div className={styles.kpiValue}>{model.rows.length}</div>
                <div className={styles.kpiSub}>
                  {model.drawings} {plural(model.drawings, "drawing", "drawings")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CURRENT</div>
                <div className={cx(styles.kpiValue, model.readyPct >= 80 && styles.pos, model.readyPct < 50 && styles.neg)}>{percent(model.readyPct)}</div>
                <div className={styles.kpiSub}>latest revision approved or issued</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>IN REVIEW</div>
                <div className={styles.kpiValue}>{model.review}</div>
                <div className={styles.kpiSub}>
                  {model.haveRevisions
                    ? `${model.stuck.filter((row) => row.status === "FOR_REVIEW").length} waiting over ${REVIEW_STALE_DAYS} days`
                    : "ages need revision dates"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>HEAVY REWORK</div>
                <div className={cx(styles.kpiValue, model.heavy.length > 0 && styles.neg)}>{model.heavy.length}</div>
                <div className={styles.kpiSub}>
                  {HEAVY_REVISIONS}+ revisions · avg {Number.isFinite(model.averageRevisions) ? model.averageRevisions.toFixed(1) : "—"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SEARCHABLE</div>
                <div className={styles.kpiValue}>{percent(model.textShare)}</div>
                <div className={styles.kpiSub}>{model.haveRevisions ? "revisions with readable text" : "no revision files loaded"}</div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY DISCIPLINE</div>
                  <h2>Where each discipline stands</h2>
                </div>
              </header>

              <ul className={styles.legend}>
                {STATUS_ORDER.filter((status) => model.disciplines.some((row) => row.counts[status] > 0)).map((status) => (
                  <li key={status}>
                    <span className={cx(styles.swatch, STATUS_CLASS[status])} />
                    {STATUS_LABEL[status]}
                  </li>
                ))}
              </ul>

              <ul className={styles.disciplines}>
                {model.disciplines.map((row) => (
                  <li key={row.key}>
                    <span className={styles.discName}>
                      <strong>{row.label}</strong>
                      <small>
                        {row.total} {plural(row.total, "document", "documents")}
                      </small>
                    </span>

                    <span aria-hidden="true" className={styles.stack} style={{ width: `${Math.max(8, (row.total / widest) * 100)}%` }}>
                      {STATUS_ORDER.map((status) =>
                        row.counts[status] > 0 ? <span className={STATUS_CLASS[status]} key={status} style={{ flexGrow: row.counts[status] }} title={`${STATUS_LABEL[status]}: ${row.counts[status]}`} /> : null,
                      )}
                    </span>

                    <span className={cx(styles.discReady, row.readyPct < 50 && styles.neg)}>
                      <strong>{percent(row.readyPct)}</strong>
                      <small>current</small>
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WHAT TO CHASE</div>
                  <h2>Documents that need attention</h2>
                </div>
              </header>

              <div aria-label="Kind of problem" className={styles.tabs} role="group">
                {tabs.map((item) => (
                  <button
                    aria-pressed={activeKey === item.key}
                    className={cx(styles.tab, activeKey === item.key && styles.tabOn)}
                    key={item.key}
                    onClick={() => {
                      setTab(item.key);
                      setExpanded(false);
                    }}
                    type="button"
                  >
                    {item.label} <span>{item.count}</span>
                  </button>
                ))}
              </div>

              {activeKey === "stuck" &&
                (model.stuck.length === 0 ? (
                  <div className={styles.emptySmall}>
                    {model.haveRevisions
                      ? `Nothing is stuck. No revision has waited in review for more than ${REVIEW_STALE_DAYS} days or sat in draft for more than ${DRAFT_STALE_DAYS}.`
                      : "Revision files are not loaded, so review ages cannot be worked out."}
                  </div>
                ) : (
                  <>
                    <p className={styles.hint}>
                      In review for more than {REVIEW_STALE_DAYS} days, or in draft for more than {DRAFT_STALE_DAYS}, counted from the latest revision&apos;s issue date.
                    </p>
                    {renderRows(model.stuck, (row) => `${row.age} days · rev ${row.latest?.revisionCode ?? "—"}`)}
                  </>
                ))}

              {activeKey === "none" &&
                (model.none.length === 0 ? (
                  <div className={styles.emptySmall}>Every registered document has at least one revision.</div>
                ) : (
                  <>
                    <p className={styles.hint}>Registered but nothing has been filed against them.</p>
                    {renderRows(model.none, (row) => `${words(row.doc.documentType)} · ${words(row.doc.discipline)}`)}
                  </>
                ))}

              {activeKey === "heavy" &&
                (model.heavy.length === 0 ? (
                  <div className={styles.emptySmall}>No document has been revised {HEAVY_REVISIONS} or more times.</div>
                ) : (
                  <>
                    <p className={styles.hint}>Documents revised {HEAVY_REVISIONS} or more times usually point to unclear scope or late design changes.</p>
                    {renderRows(model.heavy, (row) => `${row.revisionCount} revisions · latest ${row.doc.latestRevisionCode ?? row.latest?.revisionCode ?? "—"}`)}
                  </>
                ))}

              {activeKey === "duplicates" &&
                (model.duplicates.length === 0 ? (
                  <div className={styles.emptySmall}>
                    {model.haveRevisions ? "No two revisions share an identical file." : "Revision files are not loaded, so duplicates cannot be checked."}
                  </div>
                ) : (
                  <>
                    <p className={styles.hint}>The same file filed more than once, often a revision that was uploaded without being changed.</p>

                    <ul className={styles.attention}>
                      {(expanded ? model.duplicates : model.duplicates.slice(0, LIST_LIMIT)).map((group) => (
                        <li key={group.hash}>
                          <span className={styles.attMain}>
                            <strong>{group.revisions[0]?.fileName ?? "File"}</strong>
                            <span>{group.revisions.map((item) => `${item.documentNumber} rev ${item.revisionCode}`).join(", ")}</span>
                          </span>

                          <span className={cx(styles.statePill, styles.stReview)}>{group.revisions.length} copies</span>

                          <span className={styles.attNote}>
                            {group.documents.length} {plural(group.documents.length, "document", "documents")}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {model.duplicates.length > LIST_LIMIT && (
                      <button className={cx(styles.linkButton, styles.moreButton)} onClick={() => setExpanded((open) => !open)} type="button">
                        {expanded ? `Show first ${LIST_LIMIT}` : `Show all ${model.duplicates.length}`}
                      </button>
                    )}
                  </>
                ))}

              {activeKey === "text" &&
                (model.unreadable.length === 0 ? (
                  <div className={styles.emptySmall}>
                    {model.haveRevisions ? "Every latest revision has readable text, so the copilot can search it." : "Revision files are not loaded, so text coverage cannot be checked."}
                  </div>
                ) : (
                  <>
                    <p className={styles.hint}>The latest revision has no extractable text, as with a scanned image. The AI copilot cannot read these.</p>
                    {renderRows(model.unreadable, (row) => row.latest?.fileName ?? "")}
                  </>
                ))}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">ISSUE RATE</div>
                  <h2>Revisions issued per month</h2>
                </div>

                <span className={styles.muted}>{model.haveRevisions ? `${fileSize(model.totalBytes)} on file` : ""}</span>
              </header>

              {!model.haveRevisions ? (
                <div className={styles.emptySmall}>No revision files are loaded, so there is no issue history to chart.</div>
              ) : (
                <ol className={styles.months}>
                  {model.months.map((month) => (
                    <li key={month.start} title={`${month.label}: ${month.count}`}>
                      <span className={styles.monthCount}>{month.count}</span>

                      <span className={styles.monthBar}>
                        <span className={styles.monthFill} style={{ height: `${Math.max(month.count > 0 ? 4 : 0, (month.count / topMonth) * 100)}%` }} />
                      </span>

                      <span className={styles.monthLabel}>{month.label}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>

            <p className={styles.note}>
              The latest revision of each document decides its status, and “current” means that revision is approved or issued. Review and
              draft ages count from the revision&apos;s issue date. Duplicates are found by comparing each file&apos;s checksum, so two
              different names for the same file still match. Text coverage counts revisions where text could be read from the file.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
