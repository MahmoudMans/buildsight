"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectRiskControl } from "@/lib/api";
import { formatDay, plural, trunc, words } from "@/lib/openItems";
import { FILTERS, GOOD, GROUP_LABELS, GROUP_OF, MIN_GROUP, MIN_PLAN, PAGE, STALE_DAYS, WATCH, bandOf, dayCount, filterRows, flagText, pct, registerMarkdown, buildRegister, type Check, type Filter, type Flag, type Grouping, type Register, type Row } from "@/lib/riskRegisterChecks";
import { copyText } from "@/lib/textExport";
import type { RiskControl } from "@/types/project";

import styles from "./ProjectRiskRegisterChecksView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const FILL: Record<"good" | "watch" | "bad", string | undefined> = {
  good: styles.fillGood,
  watch: styles.fillWatch,
  bad: styles.fillBad,
};

function chipOf(flag: Flag): string | undefined {
  if (GROUP_OF[flag] === "gaps") {
    return styles.chipBad;
  }

  if (GROUP_OF[flag] === "scoring" || flag === "acceptedHigh") {
    return styles.chipWatch;
  }

  return styles.chipPlain;
}

function CheckLine({ check }: { check: Check }) {
  const fill = check.share === null || check.share === 0 ? null : check.share <= 0.2 ? styles.fillWatch : styles.fillBad;

  return (
    <li className={cx(styles.groupRow, styles.checkRow)}>
      <span className={styles.what}>
        <strong>{check.label}</strong>
        <small>{GROUP_LABELS[check.group]}</small>
      </span>

      <span aria-label={`${check.label}: ${check.count} of ${check.base} risks`} className={styles.track} role="img">
        {fill && check.share !== null && <i className={cx(styles.fill, fill)} style={{ width: `${Math.min(1, check.share) * 100}%` }} />}
      </span>

      <span className={styles.rateFig}>
        <b>{check.base > 0 ? check.count : "—"}</b>
        <small>{check.base > 0 ? `of ${check.base} ${plural(check.base, "risk", "risks")}` : "none to check"}</small>
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

function GroupLine({ group }: { group: Grouping }) {
  return (
    <li className={styles.grp}>
      <span className={styles.what}>
        <strong>{group.label}</strong>
        <small>
          {group.count} {plural(group.count, "risk", "risks")}
        </small>
      </span>

      <span className={styles.bars}>
        <BarLine base={group.count} label="Clean" share={group.cleanShare} text={`${group.clean} of ${group.count} risks have nothing to fix`} />
        <BarLine base={group.active} label="On plan" share={group.onPlanShare} text={`${group.onPlan} of ${group.active} open or mitigating risks have a plan and a due date that has not passed`} />
      </span>
    </li>
  );
}

function RiskLine({ row }: { row: Row }) {
  const active = row.status === "OPEN" || row.status === "MITIGATING";

  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{trunc(row.title, 72)}</strong>
        <small>
          {row.reference}, {words(row.category).toLowerCase()}, {words(row.status).toLowerCase()}
        </small>
        <small>{row.owner ? `Owner: ${row.owner}` : "No owner named"}</small>
      </span>

      <span className={styles.records}>
        <span className={styles.record}>
          <b>Exposure</b>
          <span>{words(row.band)}</span>
          <small>
            residual {Number.isFinite(row.residual) ? row.residual : "—"}, inherent {Number.isFinite(row.inherent) ? row.inherent : "—"}
          </small>
        </span>

        <span className={styles.record}>
          <b>Plan</b>
          {row.plan ? <span>{trunc(row.plan, 90)}</span> : <span className={active ? styles.missing : styles.pending}>{active ? "not recorded" : "not needed for this status"}</span>}
        </span>

        <span className={styles.record}>
          <b>Due date</b>
          {row.due !== null ? (
            <>
              <span>{formatDay(row.due)}</span>
              {row.overdueDays !== null && <small>{dayCount(row.overdueDays)} overdue</small>}
            </>
          ) : (
            <span className={active ? styles.missing : styles.pending}>{active ? "no date recorded" : "—"}</span>
          )}
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

export function ProjectRiskRegisterChecksView() {
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

  const built = useMemo(() => (data ? buildRegister(data, today) : null), [data, today]);
  const reg: Register | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (reg ? filterRows(reg.rows, filter) : []), [reg, filter]);
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const seriousRows = reg ? reg.rows.filter((row) => row.serious) : [];

  async function copySummary() {
    if (!reg) {
      return;
    }

    const ok = await copyText(registerMarkdown(reg, list, projectName, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the risk register checks as Markdown." : "Could not copy the risk register checks.");
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

            <div className="eyebrow">RISK REGISTER CHECKS</div>

            <h1>Can the risk register be trusted?</h1>

            <p className={styles.subtitle}>
              A register is only useful if its numbers hold together and someone is acting on each line. This page checks every live risk for scores that do not add up, bands that do not match the scores, missing owners and plans, mitigations past their date, and entries nobody has touched for a long time.
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

        {state === "loading" && <div className={styles.loading}>Reading the risk register…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the risk data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "allClosed" ? "Every risk on the register is closed, so there is nothing live to check." : "No risk has been logged yet, so there is nothing to check."}</div>
          </section>
        )}

        {state === "ready" && reg && (
          <>
            <section aria-label="Risk register checks summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>LIVE RISKS</div>
                <div className={styles.kpiValue}>{reg.live}</div>
                <div className={styles.kpiSub}>open, mitigating or accepted</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CLEAN</div>
                <div className={cx(styles.kpiValue, reg.cleanShare !== null && reg.cleanShare < WATCH && styles.neg)}>{pct(reg.cleanShare)}</div>
                <div className={styles.kpiSub}>
                  {reg.clean} of {reg.live} have nothing to fix
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SCORE ISSUES</div>
                <div className={cx(styles.kpiValue, reg.scoreIssues > 0 && styles.neg)}>{reg.scoreIssues}</div>
                <div className={styles.kpiSub}>inconsistent scores or bands</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>GAPS TO FILL</div>
                <div className={cx(styles.kpiValue, reg.gaps > 0 && styles.neg)}>{reg.gaps}</div>
                <div className={styles.kpiSub}>no owner, plan or due date</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVERDUE</div>
                <div className={cx(styles.kpiValue, reg.overdue > 0 && styles.neg)}>{reg.overdue}</div>
                <div className={styles.kpiSub}>mitigation past its due date</div>
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

            {seriousRows.length > 0 && (
              <p className={styles.caution} role="note">
                {seriousRows.length} of {reg.seriousBase} high or critical {plural(reg.seriousBase, "risk has", "risks have")} at least one problem: {refs(seriousRows.map((row) => row.reference))}.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">CHECK BY CHECK</div>
                  <h2>What is wrong with the register</h2>
                </div>

                <span className={styles.muted}>
                  {reg.withProblem} of {reg.live} {plural(reg.live, "risk", "risks")} with at least one problem
                </span>
              </header>

              <ul className={styles.rates}>
                {reg.checks.map((check) => (
                  <CheckLine check={check} key={check.flag} />
                ))}
              </ul>

              <p className={styles.hint}>
                Plan and due date checks count open and mitigating risks only. The mitigation check counts risks being mitigated, and the acceptance check counts accepted risks. Closed risks are not checked.
              </p>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY OWNER</div>
                    <h2>Who keeps a clean register</h2>
                  </div>

                  <span className={styles.muted}>
                    {reg.owners.length} {plural(reg.owners.length, "owner", "owners")}
                  </span>
                </header>

                <ul className={styles.rates}>
                  {reg.owners.slice(0, ownersShown).map((group) => (
                    <GroupLine group={group} key={group.key} />
                  ))}
                </ul>

                {reg.owners.length > ownersShown && (
                  <div className={styles.more}>
                    <button className={styles.moreButton} onClick={() => setOwnersShown((current) => current + 6)} type="button">
                      Show {Math.min(6, reg.owners.length - ownersShown)} more
                    </button>
                    <span className={styles.muted}>
                      {ownersShown} of {reg.owners.length} shown
                    </span>
                  </div>
                )}

                <p className={styles.hint}>
                  Clean is the share of risks with nothing to fix. On plan is the share of open or mitigating risks with a plan and a due date that has not passed. Green is {Math.round(GOOD * 100)}% or more, amber {Math.round(WATCH * 100)}% or more, red below that. Bars with fewer than {MIN_GROUP} risks behind them are not coloured.
                </p>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY CATEGORY</div>
                    <h2>Which kinds of risk are well kept</h2>
                  </div>

                  <span className={styles.muted}>
                    {reg.categories.length} {plural(reg.categories.length, "category", "categories")}
                  </span>
                </header>

                <ul className={styles.rates}>
                  {reg.categories.map((group) => (
                    <GroupLine group={group} key={group.key} />
                  ))}
                </ul>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">RISK BY RISK</div>
                  <h2>What to fix on each live risk</h2>
                </div>

                <span className={styles.muted}>
                  {list.length} of {reg.rows.length} {plural(reg.rows.length, "risk", "risks")}, most serious first
                </span>
              </header>

              {list.length === 0 ? (
                <p className={styles.quiet}>No risk matches this selection.</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {list.slice(0, shown).map((row) => (
                      <RiskLine key={row.key} row={row} />
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
              Closed risks are not checked
              {reg.closed > 0 ? ` (${reg.closed} ${plural(reg.closed, "risk is", "risks are")} closed)` : ""}. A mitigation plan counts as recorded when it has at least {MIN_PLAN} characters and is not a placeholder such as &quot;n/a&quot;. A risk counts as not changed after {STALE_DAYS} days without an edit. A band is flagged as out of line when a risk with a higher residual score sits in a lower band than another risk (or the reverse); the fewest risks needed to explain the clash are flagged, so one wrong band does not flag every neighbour. The checks compare the register with itself: they cannot tell whether a score is right, only whether it is consistent.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
