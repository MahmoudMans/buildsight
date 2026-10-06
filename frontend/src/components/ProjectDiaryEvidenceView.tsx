"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProduction, getProjectRiskControl } from "@/lib/api";
import { DEFAULT_WINDOW, DOCUMENTED, EVIDENCE_LABEL, FILTERS, MIN_NOTE_CHARS, MIN_NOTE_WORDS, PAGE, WINDOWS, buildDiary, diaryMarkdown, filterRows, flagText, pct, type DelayRow, type Diary, type Evidence, type Filter, type Flag, type Row, type State } from "@/lib/diaryEvidence";
import { formatDay, plural, trunc, words } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { ProductionControl, ProjectDelayEvent } from "@/types/project";

import styles from "./ProjectDiaryEvidenceView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const CELL: Record<State, string | undefined> = {
  ok: styles.cOk,
  copied: styles.cCopied,
  thin: styles.cThin,
  missing: styles.cMissing,
};

const STATE_LABEL: Record<State, string> = {
  ok: "Original and useful",
  copied: "Copied from an earlier report",
  thin: "Too thin to be useful",
  missing: "No notes written",
};

const STATE_ORDER: State[] = ["ok", "copied", "thin", "missing"];

const STATE_FILL: Record<State, string | undefined> = {
  ok: styles.fillGood,
  copied: styles.fillCopied,
  thin: styles.fillWatch,
  missing: styles.fillBad,
};

const EVIDENCE_CHIP: Record<Evidence, string | undefined> = {
  none: styles.chipBad,
  noReports: styles.chipPlain,
  thin: styles.chipWatch,
  documented: styles.chipGood,
};

function chipOf(flag: Flag): string | undefined {
  if (flag === "noNotes" || flag === "unloggedDelay") {
    return styles.chipBad;
  }

  if (flag === "copied") {
    return styles.chipPlain;
  }

  return styles.chipWatch;
}

function StateLine({ state, count, total }: { state: State; count: number; total: number }) {
  const share = total > 0 ? count / total : null;

  return (
    <li className={styles.groupRow}>
      <span className={styles.what}>
        <strong>{STATE_LABEL[state]}</strong>
        <small>
          {count} {plural(count, "report", "reports")}
        </small>
      </span>

      <span aria-label={`${STATE_LABEL[state]}: ${pct(share)} of reports`} className={styles.track} role="img">
        {share !== null && count > 0 && <i className={cx(styles.fill, STATE_FILL[state])} style={{ width: `${share * 100}%` }} />}
      </span>

      <span className={styles.rateFig}>
        <b>{pct(share)}</b>
      </span>
    </li>
  );
}

function DelayLine({ row }: { row: DelayRow }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{trunc(row.title, 72)}</strong>
        <small>
          {row.reference}, {words(row.cause).toLowerCase()}, {words(row.status).toLowerCase()}
        </small>
        <small>
          {formatDay(row.start)} to {formatDay(row.end)}
        </small>
      </span>

      <span className={styles.records}>
        <span className={styles.record}>
          <b>Site reports in the period</b>
          <span>{row.reports > 0 ? `${row.reports} ${plural(row.reports, "report", "reports")}` : "none"}</span>
        </span>

        <span className={styles.record}>
          <b>Reports that mention a delay</b>
          <span>{row.reports > 0 ? `${row.mentions} of ${row.reports} (${pct(row.share)})` : "—"}</span>
        </span>
      </span>

      <span className={styles.verdict}>
        <em className={cx(styles.chip, EVIDENCE_CHIP[row.evidence])}>{EVIDENCE_LABEL[row.evidence]}</em>
      </span>
    </li>
  );
}

function ReportLine({ row }: { row: Row }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{formatDay(row.day)}</strong>
        <small>
          {row.reference}, {words(row.status).toLowerCase()}
        </small>
        <small>Weather: {words(row.condition).toLowerCase()}</small>
      </span>

      <span className={styles.records}>
        <span className={styles.record}>
          <b>Notes</b>
          {row.notes ? <span>{trunc(row.notes, 220)}</span> : <span className={styles.missing}>none written</span>}
          {row.weatherNote && <small className={styles.mismatch}>{row.weatherNote}</small>}
        </span>
      </span>

      <span className={styles.verdict}>
        {row.flags.length === 0 && <em className={cx(styles.chip, styles.chipGood)}>In order</em>}
        {row.flags.map((flag) => (
          <em className={cx(styles.chip, chipOf(flag))} key={flag}>
            {flagText(flag, row)}
          </em>
        ))}
      </span>
    </li>
  );
}

export function ProjectDiaryEvidenceView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [production, setProduction] = useState<ProductionControl | null>(null);
  const [events, setEvents] = useState<ProjectDelayEvent[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [delaysShown, setDelaysShown] = useState(6);
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

    Promise.allSettled([getProjectProduction(projectId), getProjectRiskControl(projectId)]).then(([prod, risk]) => {
      if (cancelled) {
        return;
      }

      if (prod.status !== "fulfilled") {
        setState("error");
        return;
      }

      setProduction(prod.value);
      setEvents(risk.status === "fulfilled" ? (risk.value.delays ?? []) : null);
      setState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const built = useMemo(() => (production ? buildDiary(production, events, today, windowDays) : null), [production, events, today, windowDays]);
  const diary: Diary | null = built && built.ok ? built.data : null;
  const projectName = production?.project?.name ?? "Project";
  const list = useMemo(() => (diary ? filterRows(diary.rows, filter) : []), [diary, filter]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";

  async function copySummary() {
    if (!diary) {
      return;
    }

    const ok = await copyText(diaryMarkdown(diary, list, projectName, windowLabel, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the site diary evidence as Markdown." : "Could not copy the site diary evidence.");
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

            <div className="eyebrow">SITE DIARY EVIDENCE</div>

            <h1>Does the site diary say what actually happened?</h1>

            <p className={styles.subtitle}>
              The notes in the daily site reports are the record that backs up a delay claim. This page reads them: which reports have no useful notes, which repeat an earlier report word for word, where the notes contradict the weather recorded, and whether each delay in the register shows up in the diary.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/weather-record`}>
              Weather record
            </Link>

            <Link className="secondary-link-button" href={`${base}/report-lag`}>
              Report lag
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the site reports…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the site reports. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No site report has been submitted yet, so there are no notes to read. Draft reports are not judged.</div>
          </section>
        )}

        {state === "ready" && diary && (
          <>
            <section aria-label="Site diary evidence summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>REPORTS</div>
                <div className={styles.kpiValue}>{diary.judged}</div>
                <div className={styles.kpiSub}>submitted in the last {windowLabel}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>GOOD NOTES</div>
                <div className={cx(styles.kpiValue, diary.originalShare !== null && diary.originalShare < 0.7 && styles.neg)}>{pct(diary.originalShare)}</div>
                <div className={styles.kpiSub}>{diary.judged > 0 ? `${diary.original} of ${diary.judged} original and useful` : "no report in this period"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COPIED</div>
                <div className={cx(styles.kpiValue, diary.copied > 0 && styles.neg)}>{diary.copied}</div>
                <div className={styles.kpiSub}>repeat an earlier report</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>UNLOGGED</div>
                <div className={cx(styles.kpiValue, diary.delaysKnown && diary.unlogged > 0 && styles.neg)}>{diary.delaysKnown ? diary.unlogged : "—"}</div>
                <div className={styles.kpiSub}>{diary.delaysKnown ? "mention a delay not in the register" : "delay register not read"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DELAYS BACKED</div>
                <div className={cx(styles.kpiValue, diary.delaysKnown && diary.notMentioned > 0 && styles.neg)}>{diary.delaysKnown ? diary.documented : "—"}</div>
                <div className={styles.kpiSub}>{diary.delaysKnown ? `of ${diary.delays.length} ${plural(diary.delays.length, "delay", "delays")} in this period` : "delay register not read"}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Reports from the last</span>

                <div aria-label="Period measured" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={windowDays === option.days}
                      className={cx(styles.segment, windowDays === option.days && styles.segmentOn)}
                      key={option.days}
                      onClick={() => {
                        setWindowDays(option.days);
                        setShown(PAGE);
                        setDelaysShown(6);
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
                <span className={styles.controlLabel}>Reports</span>

                <div aria-label="Which reports to list" className={styles.segmented} role="group">
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

            {!diary.delaysKnown && (
              <p className={styles.caution} role="note">
                The delay register could not be read, so the delay checks are left out. The notes checks below still apply.
              </p>
            )}

            {diary.rows.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No submitted site report falls in this period. Try a longer period.</div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">THE NOTES</div>
                      <h2>How the daily notes read</h2>
                    </div>

                    <span className={styles.muted}>
                      {diary.judged} {plural(diary.judged, "report", "reports")}, {diary.drafts > 0 ? `${diary.drafts} ${plural(diary.drafts, "draft", "drafts")} not judged` : "no drafts"}
                    </span>
                  </header>

                  <ul className={styles.rates}>
                    {STATE_ORDER.map((key) => (
                      <StateLine count={diary.rows.filter((row) => row.state === key).length} key={key} state={key} total={diary.judged} />
                    ))}
                  </ul>

                  <ul aria-label="Every report in the period, oldest first" className={styles.strip}>
                    {diary.strip.map((cell) => (
                      <li className={cx(styles.cell, CELL[cell.state])} key={cell.key} title={`${formatDay(cell.day)}: ${STATE_LABEL[cell.state].toLowerCase()}`} />
                    ))}
                  </ul>

                  <ul className={styles.legend}>
                    {STATE_ORDER.map((key) => (
                      <li key={key}>
                        <i className={cx(styles.swatch, CELL[key])} />
                        {STATE_LABEL[key]}
                      </li>
                    ))}
                  </ul>

                  <p className={styles.hint}>
                    Each square is one report, oldest first. Notes count as thin under {MIN_NOTE_CHARS} characters or {MIN_NOTE_WORDS} words, and as missing when empty or a placeholder such as &quot;normal day&quot;.
                  </p>
                </section>

                {diary.delaysKnown && (
                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">THE DELAYS</div>
                        <h2>What the diary says about each delay</h2>
                      </div>

                      <span className={styles.muted}>
                        {diary.delays.length} {plural(diary.delays.length, "delay", "delays")} in this period, worst evidence first
                      </span>
                    </header>

                    {diary.delays.length === 0 ? (
                      <p className={styles.quiet}>No delay event in the register overlaps this period.</p>
                    ) : (
                      <>
                        <ul className={styles.items}>
                          {diary.delays.slice(0, delaysShown).map((row) => (
                            <DelayLine key={row.key} row={row} />
                          ))}
                        </ul>

                        {diary.delays.length > delaysShown && (
                          <div className={styles.more}>
                            <button className={styles.moreButton} onClick={() => setDelaysShown((current) => current + 6)} type="button">
                              Show {Math.min(6, diary.delays.length - delaysShown)} more
                            </button>
                            <span className={styles.muted}>
                              {delaysShown} of {diary.delays.length} shown
                            </span>
                          </div>
                        )}
                      </>
                    )}

                    <p className={styles.hint}>
                      A delay is well documented when at least {Math.round(DOCUMENTED * 100)}% of the site reports in its span mention a delay. A delay with no report mentioning it is the one to worry about if it is ever claimed.
                    </p>
                  </section>
                )}

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">REPORT BY REPORT</div>
                      <h2>What each daily report says</h2>
                    </div>

                    <span className={styles.muted}>
                      {list.length} of {diary.rows.length} {plural(diary.rows.length, "report", "reports")}, most problems first
                    </span>
                  </header>

                  {list.length === 0 ? (
                    <p className={styles.quiet}>No report matches this selection.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {list.slice(0, shown).map((row) => (
                          <ReportLine key={row.key} row={row} />
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
              The checks read the wording of the notes only, so they are prompts to look and not findings. A report counts as a copy when its notes are word for word the same as an earlier report&apos;s, ignoring capitals and punctuation. A report mentions a delay when the notes use words such as &quot;delayed&quot;, &quot;waiting&quot;, &quot;stopped&quot; or &quot;stood down&quot;; phrases such as &quot;no delays&quot; are ignored. A delay runs from its start to its end date, or for its forecast days when no end date is set, up to today. A report that mentions a delay on a day outside every delay in the register is flagged as a possible unlogged delay. Notes that mention rain while the weather is recorded as clear, cloudy or extreme heat, or wind while it is recorded as clear, are flagged too.
              {diary.drafts > 0 ? ` ${diary.drafts} draft ${plural(diary.drafts, "report is", "reports are")} not judged.` : ""}
              {diary.future > 0 ? ` ${diary.future} ${plural(diary.future, "report is", "reports are")} dated in the future and ${plural(diary.future, "is", "are")} left out.` : ""}
              {diary.skipped > 0 ? ` ${diary.skipped} ${plural(diary.skipped, "report has", "reports have")} no usable date and ${plural(diary.skipped, "is", "are")} left out.` : ""}
              {diary.delaysKnown && diary.delaysFuture > 0 ? ` ${diary.delaysFuture} ${plural(diary.delaysFuture, "delay starts", "delays start")} in the future and ${plural(diary.delaysFuture, "is", "are")} not counted.` : ""}
              {diary.delaysKnown && diary.delaysSkipped > 0 ? ` ${diary.delaysSkipped} ${plural(diary.delaysSkipped, "delay has", "delays have")} no usable start date and ${plural(diary.delaysSkipped, "is", "are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
