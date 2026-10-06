"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectRiskControl } from "@/lib/api";
import { FILTERS, GOOD, LONG_OPEN_DAYS, MIN_GROUP, NOT_STARTED_DAYS, PAGE, WATCH, ageingMarkdown, bandOf, buildAgeing, dayCount, filterRows, flagText, pct, type Ageing, type Bucket, type Filter, type Flag, type Group, type Row } from "@/lib/issueAgeing";
import { formatDay, plural, trunc, words } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { RiskControl } from "@/types/project";

import styles from "./ProjectIssueAgeingView.module.css";

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
  if (flag === "overdue" || flag === "notStarted") {
    return styles.chipBad;
  }

  if (flag === "longOpen") {
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
          {bucket.count} {plural(bucket.count, "issue", "issues")}
        </small>
      </span>

      <span aria-label={`${bucket.label}: ${pct(bucket.share)} of open issues`} className={styles.track} role="img">
        {bucket.share !== null && bucket.count > 0 && <i className={cx(styles.fill, BUCKET_FILL[index])} style={{ width: `${bucket.share * 100}%` }} />}
      </span>

      <span className={styles.rateFig}>
        <b>{pct(bucket.share)}</b>
        <small>{bucket.count > 0 ? `${bucket.overdue} past target` : "none"}</small>
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
          {group.count} {plural(group.count, "issue", "issues")}
        </small>
      </span>

      <span className={styles.bars}>
        <BarLine base={group.withTarget} label="In time" share={group.onTimeShare} text={`${group.onTime} of ${group.withTarget} issues with a target date are not past it`} />
        <BarLine base={group.count} label="Started" share={group.startedShare} text={`${group.started} of ${group.count} issues are in progress`} />
      </span>
    </li>
  );
}

function IssueLine({ row }: { row: Row }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{trunc(row.title, 72)}</strong>
        <small>
          {row.reference}, {words(row.severity).toLowerCase()}
          {row.sourceRisk ? `, from ${row.sourceRisk}` : ""}
        </small>
        <small>{row.owner ? `Owner: ${row.owner}` : "No owner named"}</small>
      </span>

      <span className={styles.records}>
        <span className={styles.record}>
          <b>Raised</b>
          {row.raised !== null ? (
            <>
              <span>{formatDay(row.raised)}</span>
              <small>{dayCount(row.age ?? 0)} ago</small>
            </>
          ) : (
            <span className={styles.pending}>no date recorded</span>
          )}
        </span>

        <span className={styles.record}>
          <b>Target</b>
          {row.target !== null ? (
            <>
              <span>{formatDay(row.target)}</span>
              {row.overdueDays !== null ? <small>{dayCount(row.overdueDays)} past</small> : <small>{row.dueIn === 0 ? "due today" : `in ${dayCount(row.dueIn ?? 0)}`}</small>}
            </>
          ) : (
            <span className={styles.missing}>no date recorded</span>
          )}
        </span>

        <span className={styles.record}>
          <b>Status</b>
          <span>{words(row.status)}</span>
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

function refs(list: string[]): string {
  return `${list.slice(0, 4).join(", ")}${list.length > 4 ? ` and ${list.length - 4} more` : ""}`;
}

export function ProjectIssueAgeingView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<RiskControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [ownersShown, setOwnersShown] = useState(6);
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

    getProjectRiskControl(projectId)
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

  const built = useMemo(() => (data ? buildAgeing(data, today) : null), [data, today]);
  const ageing: Ageing | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (ageing ? filterRows(ageing.rows, filter) : []), [ageing, filter]);
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const seriousRows = ageing ? ageing.rows.filter((row) => row.serious) : [];

  async function copySummary() {
    if (!ageing) {
      return;
    }

    const ok = await copyText(ageingMarkdown(ageing, list, projectName, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the issue ageing as Markdown." : "Could not copy the issue ageing.");
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

            <div className="eyebrow">ISSUE AGEING</div>

            <h1>How long have issues been waiting, and who holds them?</h1>

            <p className={styles.subtitle}>
              An issue is a problem that has already happened. This page looks at the ones still open: how old they are, which are past their target date, which nobody has started, and which have no owner or a target date that cannot be right.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/risk-board`}>
              Risk board
            </Link>

            <Link className="secondary-link-button" href={`${base}/risk-materialisation`}>
              Risk materialisation
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the issues…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the risk data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "allClosed" ? "Every issue is resolved or closed, so nothing is open." : "No issue has been logged yet, so there is nothing to age."}</div>
          </section>
        )}

        {state === "ready" && ageing && (
          <>
            <section aria-label="Issue ageing summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OPEN ISSUES</div>
                <div className={styles.kpiValue}>{ageing.open}</div>
                <div className={styles.kpiSub}>{ageing.closed > 0 ? `${ageing.closed} resolved or closed not counted` : "open or in progress"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PAST TARGET</div>
                <div className={cx(styles.kpiValue, ageing.overdue > 0 && styles.neg)}>{ageing.overdue}</div>
                <div className={styles.kpiSub}>{ageing.overdueMedian !== null ? `median ${dayCount(ageing.overdueMedian)} past` : "none past target"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MEDIAN AGE</div>
                <div className={styles.kpiValue}>{ageing.ageMedian !== null ? ageing.ageMedian : "—"}</div>
                <div className={styles.kpiSub}>{ageing.oldest !== null ? `days open, oldest ${ageing.oldest}` : "no raised dates"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NOT STARTED</div>
                <div className={cx(styles.kpiValue, ageing.notStarted > 0 && styles.neg)}>{ageing.notStarted}</div>
                <div className={styles.kpiSub}>still open after {NOT_STARTED_DAYS} days</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO OWNER</div>
                <div className={cx(styles.kpiValue, ageing.noOwner > 0 && styles.neg)}>{ageing.noOwner}</div>
                <div className={styles.kpiSub}>{ageing.noTarget > 0 ? `${ageing.noTarget} with no target date` : "every issue has a target"}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Issues</span>

                <div aria-label="Which issues to list" className={styles.segmented} role="group">
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
                {seriousRows.length} of {ageing.seriousBase} critical or high {plural(ageing.seriousBase, "issue is", "issues are")} past target, not started or without an owner: {refs(seriousRows.map((row) => row.reference))}.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">HOW OLD</div>
                  <h2>How long the open issues have been open</h2>
                </div>

                <span className={styles.muted}>{ageing.ageMedian !== null ? `median ${dayCount(ageing.ageMedian)}` : "no raised dates to measure"}</span>
              </header>

              <ul className={styles.rates}>
                {ageing.buckets.map((bucket, index) => (
                  <BucketLine bucket={bucket} index={index} key={bucket.label} />
                ))}
              </ul>

              <p className={styles.hint}>
                Age is the days since the issue was created.{ageing.longOpen > 0 ? ` ${ageing.longOpen} ${plural(ageing.longOpen, "issue has", "issues have")} been open for more than ${LONG_OPEN_DAYS} days.` : ""}
                {ageing.undated > 0 ? ` ${ageing.undated} ${plural(ageing.undated, "issue has", "issues have")} no usable created date and ${plural(ageing.undated, "is", "are")} left out of the bars.` : ""}
              </p>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY SEVERITY</div>
                    <h2>Are the serious ones moving</h2>
                  </div>
                </header>

                <ul className={styles.rates}>
                  {ageing.severities.map((group) => (
                    <GroupLine group={group} key={group.key} />
                  ))}
                </ul>

                <p className={styles.hint}>
                  In time is the share not past their target date. Started is the share in progress rather than still open. Green is {Math.round(GOOD * 100)}% or more, amber {Math.round(WATCH * 100)}% or more, red below that. Bars with fewer than {MIN_GROUP} issues behind them are not coloured.
                </p>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY OWNER</div>
                    <h2>Who is holding the issues</h2>
                  </div>

                  <span className={styles.muted}>
                    {ageing.owners.length} {plural(ageing.owners.length, "owner", "owners")}
                  </span>
                </header>

                <ul className={styles.rates}>
                  {ageing.owners.slice(0, ownersShown).map((group) => (
                    <GroupLine group={group} key={group.key} />
                  ))}
                </ul>

                {ageing.owners.length > ownersShown && (
                  <div className={styles.more}>
                    <button className={styles.moreButton} onClick={() => setOwnersShown((current) => current + 6)} type="button">
                      Show {Math.min(6, ageing.owners.length - ownersShown)} more
                    </button>
                    <span className={styles.muted}>
                      {ownersShown} of {ageing.owners.length} shown
                    </span>
                  </div>
                )}
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">ISSUE BY ISSUE</div>
                  <h2>What each open issue needs</h2>
                </div>

                <span className={styles.muted}>
                  {list.length} of {ageing.rows.length} {plural(ageing.rows.length, "issue", "issues")}, most serious first
                </span>
              </header>

              {list.length === 0 ? (
                <p className={styles.quiet}>No issue matches this selection.</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {list.slice(0, shown).map((row) => (
                      <IssueLine key={row.key} row={row} />
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

            <p className={styles.note}>
              Only issues that are open or in progress are counted. An issue is past target when its target date is before today. An issue still marked open, not in progress, after {NOT_STARTED_DAYS} days counts as not started. A target date set before the issue was raised, or missing, is flagged because it cannot be judged. Resolved and closed issues carry no resolution date, so how quickly they were closed cannot be measured here.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
