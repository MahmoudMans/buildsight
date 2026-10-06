"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSafety } from "@/lib/api";
import { formatDay, plural, trunc, words } from "@/lib/openItems";
import { DEFAULT_WINDOW, FILTERS, GOOD, LONG_DAYS, MIN_GROUP, MIN_TEXT, PAGE, WATCH, WINDOWS, bandOf, buildDiscipline, dayCount, disciplineMarkdown, filterRows, flagText, pct, typeLabel, type Discipline, type Filter, type Flag, type Group, type Row } from "@/lib/permitDiscipline";
import { copyText } from "@/lib/textExport";
import type { SafetyControl } from "@/types/project";

import styles from "./ProjectPermitDisciplineView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const FILL: Record<"good" | "watch" | "bad", string | undefined> = {
  good: styles.fillGood,
  watch: styles.fillWatch,
  bad: styles.fillBad,
};

function chipOf(flag: Flag): string | undefined {
  if (flag === "closedLate" || flag === "openPast") {
    return styles.chipBad;
  }

  if (flag === "longLived" || flag === "closedBeforeStart" || flag === "noCloseDate") {
    return styles.chipPlain;
  }

  return styles.chipWatch;
}

function GroupLine({ group }: { group: Group }) {
  const band = bandOf(group);

  return (
    <li className={styles.groupRow}>
      <span className={styles.what}>
        <strong>{group.label}</strong>
        <small>
          {group.count} {plural(group.count, "permit", "permits")}
        </small>
      </span>

      <span aria-label={`${group.label}: ${pct(group.share)} of permits fully in order`} className={styles.track} role="img">
        {group.share !== null && <i className={cx(styles.fill, band ? FILL[band] : styles.fillQuiet)} style={{ width: `${group.share * 100}%` }} />}
      </span>

      <span className={styles.rateFig}>
        <b>{pct(group.share)}</b>
        <small>
          {group.clean} of {group.count} in order
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

function validity(row: Row): string {
  return `Valid ${formatDay(row.from)} to ${formatDay(row.until)} (${dayCount(row.validDays)})`;
}

function PermitLine({ row }: { row: Row }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{trunc(row.title, 72)}</strong>
        <small>
          {row.reference}, {typeLabel(row.type).toLowerCase()}, {words(row.status).toLowerCase()}
        </small>
        <small>{validity(row)}</small>
        {row.closed !== null && <small>Closed {formatDay(row.closed)}</small>}
      </span>

      <span className={styles.records}>
        <RecordLine label="Controls" text={row.type === "GENERAL" && !row.controls ? "none expected for general work" : row.controls} />
        <RecordLine label="Issuer" text={row.issuer} />
        <RecordLine label="Receiver" text={row.receiver} />
        <RecordLine label="Location" text={row.location} />
      </span>

      <span className={styles.verdict}>
        {row.clean && row.flags.length === 0 && <em className={cx(styles.chip, styles.chipGood)}>In order</em>}
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

export function ProjectPermitDisciplineView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<SafetyControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [receiversShown, setReceiversShown] = useState(6);
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

  const built = useMemo(() => (data ? buildDiscipline(data, today, windowDays) : null), [data, today, windowDays]);
  const discipline: Discipline | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (discipline ? filterRows(discipline.rows, filter) : []), [discipline, filter]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const seriousRows = discipline ? discipline.rows.filter((row) => row.serious) : [];

  async function copySummary() {
    if (!discipline) {
      return;
    }

    const ok = await copyText(disciplineMarkdown(discipline, list, projectName, windowLabel, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the permit discipline as Markdown." : "Could not copy the permit discipline.");
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

            <div className="eyebrow">PERMIT DISCIPLINE</div>

            <h1>Are work permits run and closed properly?</h1>

            <p className={styles.subtitle}>
              A permit to work is only a control if it ends when it should and says what protects the people doing the job. This page looks back at the permits issued, and shows which were closed late, are still open after they expired, or were issued without controls, an issuer, a receiver or a location.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/permit-overlaps`}>
              Permit overlaps
            </Link>

            <Link className="secondary-link-button" href={`${base}/safety-board`}>
              Safety board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the work permits…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the safety data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No permit has been issued yet, so there is nothing to look back on. Draft and cancelled permits are not counted.</div>
          </section>
        )}

        {state === "ready" && discipline && (
          <>
            <section aria-label="Permit discipline summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>PERMITS</div>
                <div className={styles.kpiValue}>{discipline.permits}</div>
                <div className={styles.kpiSub}>started in the last {windowLabel}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CLOSED ON TIME</div>
                <div className={cx(styles.kpiValue, discipline.onTimeShare !== null && discipline.onTimeShare < WATCH && styles.neg)}>{pct(discipline.onTimeShare)}</div>
                <div className={styles.kpiSub}>{discipline.measured > 0 ? `${discipline.onTime} of ${discipline.measured} closed permits` : "no permit closed in this period"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CLOSED LATE</div>
                <div className={cx(styles.kpiValue, discipline.late > 0 && styles.neg)}>{discipline.late}</div>
                <div className={styles.kpiSub}>closed after the permit expired</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN PAST END</div>
                <div className={cx(styles.kpiValue, discipline.openPast > 0 && styles.neg)}>{discipline.openPast}</div>
                <div className={styles.kpiSub}>active or suspended after expiry</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO CONTROLS</div>
                <div className={cx(styles.kpiValue, discipline.noControls > 0 && styles.neg)}>{discipline.noControls}</div>
                <div className={styles.kpiSub}>of {discipline.highRisk} high-risk permits</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Started in the last</span>

                <div aria-label="Period measured" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={windowDays === option.days}
                      className={cx(styles.segment, windowDays === option.days && styles.segmentOn)}
                      key={option.days}
                      onClick={() => {
                        setWindowDays(option.days);
                        setShown(PAGE);
                        setReceiversShown(6);
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
                <span className={styles.controlLabel}>Permits</span>

                <div aria-label="Which permits to list" className={styles.segmented} role="group">
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

            {discipline.liveNoControls.length > 0 && (
              <p className={styles.caution} role="note">
                {discipline.liveNoControls.length} active high-risk {plural(discipline.liveNoControls.length, "permit has", "permits have")} no controls recorded right now: {refs(discipline.liveNoControls)}.
              </p>
            )}

            {seriousRows.length > 0 && (
              <p className={styles.caution} role="note">
                {seriousRows.length} {plural(seriousRows.length, "permit was", "permits were")} closed late or {plural(seriousRows.length, "is", "are")} still open past {plural(seriousRows.length, "its", "their")} expiry date: {refs(seriousRows.map((row) => row.reference))}.
              </p>
            )}

            {discipline.staleOutside.length > 0 && (
              <p className={styles.caution} role="note">
                {discipline.staleOutside.length} older {plural(discipline.staleOutside.length, "permit is", "permits are")} also still open past expiry: {refs(discipline.staleOutside)}. {plural(discipline.staleOutside.length, "It started", "They started")} before this period, so {plural(discipline.staleOutside.length, "it is", "they are")} not counted below.
              </p>
            )}

            {discipline.rows.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No permit started in this period. Try a longer period.</div>
              </section>
            ) : (
              <>
                <div className={styles.twoCol}>
                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY PERMIT TYPE</div>
                        <h2>Which kinds are run properly</h2>
                      </div>
                    </header>

                    <ul className={styles.rates}>
                      {discipline.types.map((group) => (
                        <GroupLine group={group} key={group.key} />
                      ))}
                    </ul>

                    <p className={styles.hint}>
                      Green is {Math.round(GOOD * 100)}% or more fully in order, amber {Math.round(WATCH * 100)}% or more, red below that. Groups of fewer than {MIN_GROUP} permits are not coloured.
                    </p>
                  </section>

                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY RECEIVER</div>
                        <h2>Who holds permits properly</h2>
                      </div>

                      <span className={styles.muted}>
                        {discipline.receivers.length} {plural(discipline.receivers.length, "name", "names")}
                      </span>
                    </header>

                    <ul className={styles.rates}>
                      {discipline.receivers.slice(0, receiversShown).map((group) => (
                        <GroupLine group={group} key={group.key} />
                      ))}
                    </ul>

                    {discipline.receivers.length > receiversShown && (
                      <div className={styles.more}>
                        <button className={styles.moreButton} onClick={() => setReceiversShown((current) => current + 6)} type="button">
                          Show {Math.min(6, discipline.receivers.length - receiversShown)} more
                        </button>
                        <span className={styles.muted}>
                          {receiversShown} of {discipline.receivers.length} shown
                        </span>
                      </div>
                    )}
                  </section>
                </div>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">PERMIT BY PERMIT</div>
                      <h2>How each permit was run</h2>
                    </div>

                    <span className={styles.muted}>
                      {list.length} of {discipline.rows.length} {plural(discipline.rows.length, "permit", "permits")}, most serious first
                    </span>
                  </header>

                  {list.length === 0 ? (
                    <p className={styles.quiet}>No permit matches this selection.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {list.slice(0, shown).map((row) => (
                          <PermitLine key={row.key} row={row} />
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
              Permits are counted in the period they started; drafts and cancelled permits are left out. A permit is in order when it was closed on or before its expiry date (or is still within it) and has an issuer, a receiver and a location recorded, plus controls for every type except general work. A field left empty, or holding only a placeholder such as &quot;n/a&quot; or &quot;ok&quot; (controls under {MIN_TEXT} characters), counts as not recorded. A permit valid for more than {LONG_DAYS} days is marked as long but is not counted against it. A closed permit with no close date, or one closed before it started, cannot be judged on timing and is flagged.
              {discipline.future > 0 ? ` ${discipline.future} ${plural(discipline.future, "permit starts", "permits start")} in the future and ${plural(discipline.future, "is", "are")} left out.` : ""}
              {discipline.skipped > 0 ? ` ${discipline.skipped} ${plural(discipline.skipped, "permit has", "permits have")} no usable dates and ${plural(discipline.skipped, "is", "are")} left out.` : ""}
              {discipline.drafts + discipline.cancelled > 0 ? ` ${discipline.drafts} draft and ${discipline.cancelled} cancelled ${plural(discipline.drafts + discipline.cancelled, "permit is", "permits are")} not counted.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
