"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectRiskControl } from "@/lib/api";
import { formatDay, plural, trunc, words } from "@/lib/openItems";
import { FILTERS, MIN_GROUP, PAGE, STATUS_LABEL, buildMaterialisation, filterMaterialised, materialisationMarkdown, pct, severityLabel, verdictText, type Filter, type IssueItem, type Materialised, type Rate } from "@/lib/riskMaterialisation";
import { copyText } from "@/lib/textExport";
import type { IssueSeverity, RiskControl } from "@/types/project";

import styles from "./ProjectRiskMaterialisationView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const SEVERITY_CHIP: Record<IssueSeverity, string | undefined> = {
  CRITICAL: styles.chipBad,
  HIGH: styles.chipBad,
  MEDIUM: styles.chipWatch,
  LOW: styles.chipPlain,
};

const ISSUE_SHOWN = 3;

function RateLine({ row }: { row: Rate }) {
  return (
    <li className={styles.rateRow}>
      <span className={styles.rateName}>{row.label}</span>

      <span aria-label={`${row.label}: ${row.materialised} of ${row.risks} risks became issues`} className={styles.track} role="img">
        <i className={styles.fill} style={{ width: `${(row.rate ?? 0) * 100}%` }} />
      </span>

      <span className={styles.rateFig}>
        <b>{pct(row.rate)}</b>
        <small>
          {row.materialised} of {row.risks}
        </small>
      </span>
    </li>
  );
}

function IssueLine({ issue }: { issue: IssueItem }) {
  return (
    <li className={styles.issueLine}>
      <span className={styles.issueText}>
        <strong>{issue.reference}</strong> {trunc(issue.title, 90)}
        <small>
          {words(issue.status)}
          {issue.raised !== null ? `, raised ${formatDay(issue.raised)}` : ""}
        </small>
      </span>

      <em className={cx(styles.chip, SEVERITY_CHIP[issue.severity])}>{severityLabel(issue.severity)}</em>
    </li>
  );
}

function RiskLine({ row }: { row: Materialised }) {
  const hidden = row.issues.length - ISSUE_SHOWN;

  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{row.reference}</strong> {trunc(row.title, 60)}
        <small>
          {words(row.category)} risk rated {words(row.band).toLowerCase()}, {STATUS_LABEL[row.status].toLowerCase()}
          {row.owner ? `, ${row.owner}` : ""}
        </small>
        <small>
          {row.registered !== null ? `Registered ${formatDay(row.registered)}` : "Registration date not recorded"}
          {row.mitigationDue !== null ? `, mitigation due ${formatDay(row.mitigationDue)}` : ", no mitigation date"}
        </small>
      </span>

      <ul className={styles.issueList}>
        {row.issues.slice(0, ISSUE_SHOWN).map((issue) => (
          <IssueLine issue={issue} key={issue.id} />
        ))}

        {hidden > 0 && (
          <li className={styles.issueMore}>
            and {hidden} more {plural(hidden, "issue", "issues")}
          </li>
        )}
      </ul>

      <span className={styles.verdict}>
        {row.late === true && <em className={cx(styles.chip, styles.chipWatch)}>After due date</em>}
        {row.late === false && <em className={cx(styles.chip, styles.chipPlain)}>Before due date</em>}
        {row.closedWithOpen && <em className={cx(styles.chip, styles.chipBad)}>Closed risk, open issue</em>}
        {row.openIssues === 0 && <em className={cx(styles.chip, styles.chipGood)}>All issues closed</em>}
        {row.lead !== null && (
          <small>
            {row.lead} {plural(row.lead, "day", "days")} to first issue
          </small>
        )}
      </span>
    </li>
  );
}

function UnforeseenLine({ issue }: { issue: IssueItem }) {
  return (
    <li className={styles.plainItem}>
      <span className={styles.what}>
        <strong>{issue.reference}</strong> {trunc(issue.title, 70)}
        <small>
          {words(issue.status)}
          {issue.raised !== null ? `, raised ${formatDay(issue.raised)}` : ""}
        </small>
      </span>

      <em className={cx(styles.chip, SEVERITY_CHIP[issue.severity])}>{severityLabel(issue.severity)}</em>
    </li>
  );
}

export function ProjectRiskMaterialisationView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<RiskControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [shownUnforeseen, setShownUnforeseen] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

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

  const built = useMemo(() => (data ? buildMaterialisation(data) : null), [data]);
  const result = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (result ? filterMaterialised(result.materialised, filter) : []), [result, filter]);
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const verdict = result ? verdictText(result.calibration) : null;

  async function copySummary() {
    if (!result) {
      return;
    }

    const ok = await copyText(materialisationMarkdown(result, list, projectName, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the risk materialisation as Markdown." : "Could not copy the risk materialisation.");
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

            <div className="eyebrow">RISK MATERIALISATION</div>

            <h1>Which registered risks turned into real problems?</h1>

            <p className={styles.subtitle}>
              A risk register earns its keep when it points at the problems that later arrive. Following each issue back to the risk it came from shows which risks actually happened, whether the ratings picked the right ones, and which problems the register never saw.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/risk-board`}>
              Risk board
            </Link>

            <Link className="secondary-link-button" href={`${base}/risk-matrix`}>
              Risk matrix
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the risks and issues…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the risks and issues. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No risks or issues have been recorded yet, so there is nothing to follow.</div>
          </section>
        )}

        {state === "ready" && result && (
          <>
            <section aria-label="Risk materialisation summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>BECAME ISSUES</div>
                <div className={styles.kpiValue}>{result.materialised.length}</div>
                <div className={styles.kpiSub}>
                  of {result.risks} registered {plural(result.risks, "risk", "risks")} ({pct(result.rate)})
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NOT FORESEEN</div>
                <div className={cx(styles.kpiValue, result.unforeseenShare !== null && result.unforeseenShare > 0.5 && styles.neg)}>{result.unforeseen.length}</div>
                <div className={styles.kpiSub}>{result.unforeseenShare !== null ? `${pct(result.unforeseenShare)} of issues had no risk on the register` : "no issues raised"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>STILL OPEN</div>
                <div className={cx(styles.kpiValue, result.closedWithOpen > 0 && styles.neg)}>{result.openFromRisks}</div>
                <div className={styles.kpiSub}>
                  {result.openFromRisks === 1 ? "issue" : "issues"} from registered risks
                  {result.closedWithOpen > 0 ? `, ${result.closedWithOpen} on a closed risk` : ""}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AFTER DUE DATE</div>
                <div className={cx(styles.kpiValue, result.lateShare !== null && result.lateShare > 0.5 && styles.neg)}>{pct(result.lateShare)}</div>
                <div className={styles.kpiSub}>{result.lateKnown > 0 ? `${result.late} of ${result.lateKnown} hit after the mitigation was due` : "no mitigation dates to compare"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TIME TO ISSUE</div>
                <div className={styles.kpiValue}>{result.medianLead === null ? "—" : Math.round(result.medianLead)}</div>
                <div className={styles.kpiSub}>{result.medianLead === null ? "no risk has turned into an issue" : `${Math.round(result.medianLead) === 1 ? "day" : "days"}, median from registering to first issue`}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Risks</span>

                <div aria-label="Which risks to list" className={styles.segmented} role="group">
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

            {result.closedWithOpen > 0 && (
              <p className={styles.caution} role="note">
                {result.closedWithOpen} {plural(result.closedWithOpen, "risk is", "risks are")} marked closed but still {plural(result.closedWithOpen, "has", "have")} an open issue linked to {plural(result.closedWithOpen, "it", "them")}.
              </p>
            )}

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY RATING</div>
                    <h2>Do higher-rated risks happen more often?</h2>
                  </div>
                </header>

                {result.bands.length === 0 ? (
                  <p className={styles.quiet}>There are no risks on the register.</p>
                ) : (
                  <>
                    <ul className={styles.rates}>
                      {result.bands.map((row) => (
                        <RateLine key={row.key} row={row} />
                      ))}
                    </ul>

                    <p className={styles.hint}>{verdict ?? (result.materialised.length === 0 ? "No risk has turned into an issue yet, so the ratings cannot be compared with what happened." : `A comparison needs at least ${MIN_GROUP} risks in both the critical and high group and the moderate and low group.`)}</p>
                  </>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY CATEGORY</div>
                    <h2>Where the risks turn into issues</h2>
                  </div>
                </header>

                {result.categories.length === 0 ? <p className={styles.quiet}>There are no risks on the register.</p> : (
                  <ul className={styles.rates}>
                    {result.categories.map((row) => (
                      <RateLine key={row.key} row={row} />
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">RISKS THAT BECAME ISSUES</div>
                  <h2>What happened to the risks that were realised</h2>
                </div>

                <span className={styles.muted}>
                  {list.length} of {result.materialised.length} {plural(result.materialised.length, "risk", "risks")}, open issues first
                </span>
              </header>

              {list.length === 0 ? (
                <p className={styles.quiet}>{result.materialised.length === 0 ? "No issue is linked to a registered risk yet." : "No risk matches this selection."}</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {list.slice(0, shown).map((row) => (
                      <RiskLine key={row.id} row={row} />
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

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">NOT ON THE REGISTER</div>
                  <h2>Problems the register did not see coming</h2>
                </div>

                <span className={styles.muted}>
                  {result.unforeseen.length} {plural(result.unforeseen.length, "issue", "issues")} with no source risk, open ones first
                </span>
              </header>

              {result.unforeseen.length === 0 ? (
                <p className={styles.quiet}>Every issue raised is linked to a registered risk.</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {result.unforeseen.slice(0, shownUnforeseen).map((issue) => (
                      <UnforeseenLine issue={issue} key={issue.id} />
                    ))}
                  </ul>

                  {result.unforeseen.length > shownUnforeseen && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setShownUnforeseen((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, result.unforeseen.length - shownUnforeseen)} more
                      </button>
                      <span className={styles.muted}>
                        {shownUnforeseen} of {result.unforeseen.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>

            <p className={styles.note}>
              A risk has turned into an issue when an issue is linked to it, by its identifier or by its reference, so these figures are only as good as the habit of recording a source risk when an issue is raised; an issue raised without one counts as not foreseen. The rate is the share of all registered risks, whatever their status, that have at least one linked issue. The first issue is dated by when the issue record was created, and the time to it runs from when the risk record was created. A risk is shown as hitting after its mitigation was due when its first issue came after the mitigation due date. Critical and high risks are compared with moderate and low ones only when each group has {MIN_GROUP} or more risks.
              {result.dangling > 0 ? ` ${result.dangling} ${plural(result.dangling, "issue points", "issues point")} at a risk that is not on the register and ${plural(result.dangling, "is", "are")} left out.` : ""}
              {result.skipped > 0 ? ` ${result.skipped} ${plural(result.skipped, "issue has", "issues have")} no identifier and ${plural(result.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
