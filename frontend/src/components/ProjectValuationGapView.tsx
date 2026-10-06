"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectCommercial } from "@/lib/api";
import { ASSESSED_LABEL, HELD_TOLERANCE, OUTCOME_LABEL, PAGE, SCOPES, buildGap, cash, daysText, gapMarkdown, moneyOrDash, outcomeText, pct, type Gap, type Group, type Item, type Outcome, type Scope } from "@/lib/valuationGap";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { CommercialControl } from "@/types/project";

import styles from "./ProjectValuationGapView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const CHIP: Record<Outcome, string | undefined> = {
  full: styles.chipGood,
  cut: styles.chipWatch,
  rejected: styles.chipBad,
};

function width(value: number, top: number): string {
  return `${top > 0 ? Math.min(100, Math.max(0, (value / top) * 100)) : 0}%`;
}

function Steps({ gap }: { gap: Gap }) {
  const done = gap.decidedTotals;
  const top = Math.max(1, done.assessedAsked);
  const rows = [
    { key: "asked", label: "Asked", hint: "what was submitted or claimed", value: done.assessedAsked, share: null as number | null, style: styles.stepAsked },
    { key: "assessed", label: "Assessed", hint: "what the assessor valued it at", value: done.assessed, share: done.assessedAsked > 0 ? done.assessed / done.assessedAsked : null, style: styles.stepAssessed },
    { key: "decided", label: "Decided", hint: "what was approved or awarded", value: done.assessedDecided, share: done.assessedAsked > 0 ? done.assessedDecided / done.assessedAsked : null, style: styles.stepDecided },
  ];

  return (
    <ul className={styles.steps}>
      {rows.map((row) => (
        <li className={styles.stepRow} key={row.key}>
          <span>
            <strong>{row.label}</strong>
            <small>{row.hint}</small>
          </span>

          <span aria-hidden="true" className={styles.track}>
            <i className={cx(styles.fill, row.style)} style={{ width: width(row.value, top) }} />
          </span>

          <b>
            {cash(row.value)}
            {row.share !== null && <small>{pct(row.share)} of the ask</small>}
          </b>
        </li>
      ))}
    </ul>
  );
}

function SplitBar({ label, parts }: { label: string; parts: Array<{ key: string; label: string; count: number; style: string | undefined }> }) {
  const total = parts.reduce((sum, part) => sum + part.count, 0);

  return (
    <div className={styles.splitBlock}>
      <div className={styles.splitHead}>{label}</div>

      <span aria-label={`${label}: ${parts.map((part) => `${part.count} ${part.label.toLowerCase()}`).join(", ")}`} className={styles.split} role="img">
        {parts.map((part) => (part.count > 0 ? <i className={part.style} key={part.key} style={{ flexGrow: part.count }} title={`${part.label}: ${part.count}`} /> : null))}
      </span>

      <ul className={styles.legend}>
        {parts.map((part) => (
          <li key={part.key}>
            <i className={cx(styles.swatch, part.style)} />
            {part.label}: {part.count}
            {total > 0 ? ` (${Math.round((part.count / total) * 100)}%)` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GroupLine({ group, top }: { group: Group; top: number }) {
  const timeOnly = group.moneyCount === 0 && group.claimedDays > 0;

  return (
    <li className={styles.groupRow}>
      <span className={styles.what}>
        <strong>{group.label}</strong>
        <small>
          {group.decidedCount} decided, {group.openCount} waiting
        </small>
      </span>

      <span
        aria-label={`${group.label}: ${cash(group.decided)} decided of ${cash(group.decidedAsked)} asked`}
        className={styles.track}
        role="img"
      >
        {!timeOnly && group.moneyCount > 0 && (
          <>
            <i className={cx(styles.fill, styles.groupAsked)} style={{ width: width(group.decidedAsked, top) }} />
            <i className={cx(styles.fill, styles.groupDecided)} style={{ width: width(group.decided, top) }} />
          </>
        )}
      </span>

      <span className={styles.cell}>
        {timeOnly ? (
          <>
            {daysText(group.awardedDays)} awarded
            <small>of {daysText(group.claimedDays)} claimed</small>
          </>
        ) : group.moneyCount === 0 ? (
          <>
            {group.decidedCount === 0 ? "Nothing decided yet" : "Amount not recorded"}
            <small>{group.decidedCount === 0 ? "no recovery to measure" : "decided, but no amount is on record"}</small>
          </>
        ) : (
          <>
            {cash(group.decided)} of {cash(group.decidedAsked)}
            <small>
              {pct(group.recovery)} recovered{group.claimedDays > 0 ? `, ${daysText(group.awardedDays)} awarded of ${daysText(group.claimedDays)}` : ""}
            </small>
          </>
        )}
      </span>
    </li>
  );
}

function OpenLine({ item }: { item: Item }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{item.reference}</strong> {trunc(item.title, 60)}
        <small>
          {item.group}
          {item.waiting !== null ? `, waiting ${daysText(item.waiting)}` : ""}
          {item.submitted !== null ? ` since ${formatDay(item.submitted)}` : ""}
        </small>
      </span>

      {item.moneyless ? (
        <span className={styles.figs}>
          <span>
            <b>Time claimed</b>
            {daysText(item.askedDays)}
          </span>
        </span>
      ) : (
        <span className={styles.figs}>
          <span>
            <b>Asked</b>
            {cash(item.asked)}
          </span>
          <span>
            <b>Assessed</b>
            {item.assessed !== null ? cash(item.assessed) : "Not yet"}
            {item.assessed !== null && <small>{pct(item.assessed / item.asked)} of the ask</small>}
          </span>
        </span>
      )}

      <span className={styles.verdict}>{item.overdue ? <em className={cx(styles.chip, styles.chipBad)}>Past its date</em> : null}</span>
    </li>
  );
}

function DecidedLine({ item }: { item: Item }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{item.reference}</strong> {trunc(item.title, 60)}
        <small>
          {item.group}
          {item.decidedDate !== null ? `, decided ${formatDay(item.decidedDate)}` : ""}
        </small>
      </span>

      {item.moneyless ? (
        <span className={styles.figs}>
          <span>
            <b>Time claimed</b>
            {daysText(item.askedDays)}
          </span>
          <span>
            <b>Awarded</b>
            {daysText(item.decidedDays)}
          </span>
        </span>
      ) : (
        <span className={styles.figs}>
          <span>
            <b>Asked</b>
            {cash(item.asked)}
          </span>
          <span>
            <b>Assessed</b>
            {moneyOrDash(item.assessed)}
          </span>
          <span>
            <b>Decided</b>
            {moneyOrDash(item.decided)}
          </span>
        </span>
      )}

      <span className={styles.verdict}>
        <em className={cx(styles.chip, item.outcome ? CHIP[item.outcome] : styles.chipPlain)}>{outcomeText(item)}</em>
        {item.vsAssessed && <small>{ASSESSED_LABEL[item.vsAssessed].replace("Decided ", "").replace("the assessment", "assessment")}</small>}
      </span>
    </li>
  );
}

export function ProjectValuationGapView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<CommercialControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [scope, setScope] = useState<Scope>("all");
  const [openShown, setOpenShown] = useState(PAGE);
  const [decidedShown, setDecidedShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectCommercial(projectId)
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

  const built = useMemo(() => (data ? buildGap(data, today, scope) : null), [data, today, scope]);
  const gap = built && built.ok ? built.gap : null;
  const projectName = data?.project?.name ?? "Project";
  const open = gap?.openTotals;
  const done = gap?.decidedTotals;
  const groupTop = gap ? Math.max(1, ...gap.groups.map((group) => group.decidedAsked)) : 1;
  const scopeLabel = scope === "all" ? "change orders and claims" : scope === "change" ? "change orders" : "claims";

  async function copySummary() {
    if (!gap) {
      return;
    }

    const ok = await copyText(gapMarkdown(gap, projectName, today, scope));

    setMessage(ok ? "Copied the valuation gap as Markdown." : "Could not copy the valuation gap.");
  }

  function pickScope(value: Scope) {
    setScope(value);
    setOpenShown(PAGE);
    setDecidedShown(PAGE);
    setMessage(null);
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

            <div className="eyebrow">VALUATION GAP</div>

            <h1>How much of what we ask for is valued, and how much is agreed?</h1>

            <p className={styles.subtitle}>
              Change orders and claims are assessed before they are decided. Setting what was asked against what was assessed and what was finally agreed shows how much of the open value is realistically still to come, and whether the assessment is a reliable guide to the decision.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/commercial-board`}>
              Commercial board
            </Link>

            <Link className="secondary-link-button" href={`${base}/cash-position`}>
              Cash position
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the change orders and claims…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the change orders and claims. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No change orders or claims have been recorded yet, so there is no valuation to compare.</div>
          </section>
        )}

        {state === "ready" && gap && open && done && (
          <>
            <section aria-label="Valuation gap summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OPEN ASK</div>
                <div className={styles.kpiValue}>{cash(open.asked)}</div>
                <div className={styles.kpiSub}>
                  {open.count} {plural(open.count, "item", "items")} waiting for a decision
                  {open.oldestWaiting !== null ? `, oldest ${daysText(open.oldestWaiting)}` : ""}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ASSESSED</div>
                <div className={styles.kpiValue}>{cash(open.assessed)}</div>
                <div className={styles.kpiSub}>{open.assessedCount > 0 ? `${open.assessedCount} of ${open.count} assessed, ${pct(open.assessedAsked > 0 ? open.assessed / open.assessedAsked : null)} of the ${cash(open.assessedAsked)} they ask` : "none of the open items is assessed yet"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NOT ASSESSED</div>
                <div className={cx(styles.kpiValue, open.unassessedCount > 0 && styles.neg)}>{cash(open.unassessedAsked)}</div>
                <div className={styles.kpiSub}>
                  {open.unassessedCount} {plural(open.unassessedCount, "item", "items")} with no assessment
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>RECOVERED</div>
                <div className={cx(styles.kpiValue, done.recovery !== null && done.recovery < 0.5 && styles.neg)}>{pct(done.recovery)}</div>
                <div className={styles.kpiSub}>{done.count > 0 ? `${cash(done.decided)} of ${cash(done.asked)} asked, on ${done.count} decided` : "nothing has been decided yet"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AT ASSESSMENT</div>
                <div className={styles.kpiValue}>{done.withAssessment > 0 ? pct(done.held / done.withAssessment) : "—"}</div>
                <div className={styles.kpiSub}>{done.withAssessment > 0 ? `${done.held} of ${done.withAssessment} decided at the assessment` : "no decided item had an assessment"}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Show</span>

                <div aria-label="Which items to include" className={styles.segmented} role="group">
                  {SCOPES.map((option) => (
                    <button aria-pressed={scope === option.key} className={cx(styles.segment, scope === option.key && styles.segmentOn)} key={option.key} onClick={() => pickScope(option.key)} type="button">
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

            {open.overdue > 0 && (
              <p className={styles.caution} role="note">
                {open.overdue} open {plural(open.overdue, "item is", "items are")} past {plural(open.overdue, "its", "their")} decision or response date.
              </p>
            )}

            {gap.items.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>
                  Nothing has been submitted yet, so there is nothing to value.
                  {gap.drafts > 0 ? ` ${gap.drafts} draft ${plural(gap.drafts, "item is", "items are")} waiting to be submitted.` : ""}
                </div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">FROM ASKED TO DECIDED</div>
                      <h2>How decided {scopeLabel} moved from the ask</h2>
                    </div>

                    <span className={styles.muted}>
                      {done.withAssessment} of {done.count} decided with an assessment
                    </span>
                  </header>

                  {done.withAssessment === 0 ? <p className={styles.quiet}>{done.count === 0 ? "Nothing has been decided yet." : "None of the decided items had an assessment, so there is no valuation to follow through."}</p> : <Steps gap={gap} />}

                  {done.count > 0 && (
                    <div className={styles.splits}>
                      <SplitBar
                        label="How the decisions came out"
                        parts={[
                          { key: "full", label: OUTCOME_LABEL.full, count: done.full, style: styles.sGood },
                          { key: "cut", label: OUTCOME_LABEL.cut, count: done.cut, style: styles.sWatch },
                          { key: "rejected", label: OUTCOME_LABEL.rejected, count: done.rejected, style: styles.sBad },
                        ]}
                      />

                      {done.withAssessment > 0 && (
                        <SplitBar
                          label="Against the assessment"
                          parts={[
                            { key: "held", label: ASSESSED_LABEL.held, count: done.held, style: styles.sGood },
                            { key: "above", label: ASSESSED_LABEL.above, count: done.above, style: styles.sInfo },
                            { key: "below", label: ASSESSED_LABEL.below, count: done.below, style: styles.sWatch },
                          ]}
                        />
                      )}
                    </div>
                  )}

                  {done.claimedDays > 0 && (
                    <p className={styles.hint}>
                      Time: {daysText(done.awardedDays)} awarded of {daysText(done.claimedDays)} claimed on decided claims ({pct(done.awardedDays / done.claimedDays)}).
                    </p>
                  )}
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">BY TYPE</div>
                      <h2>Where the recovery is strong and where it is not</h2>
                    </div>

                    <span className={styles.muted}>decided items only</span>
                  </header>

                  <ul className={styles.groups}>
                    {gap.groups.map((group) => (
                      <GroupLine group={group} key={group.label} top={groupTop} />
                    ))}
                  </ul>

                  <ul className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.keyAsked)} />
                      Asked
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.keyDecided)} />
                      Decided
                    </li>
                  </ul>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">WAITING FOR A DECISION</div>
                      <h2>What is still open, and what has been assessed</h2>
                    </div>

                    <span className={styles.muted}>
                      {gap.open.length} {plural(gap.open.length, "item", "items")}, largest ask first
                    </span>
                  </header>

                  {gap.open.length === 0 ? (
                    <p className={styles.quiet}>Every submitted item has been decided.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {gap.open.slice(0, openShown).map((item) => (
                          <OpenLine item={item} key={item.id} />
                        ))}
                      </ul>

                      {gap.open.length > openShown && (
                        <div className={styles.more}>
                          <button className={styles.moreButton} onClick={() => setOpenShown((current) => current + PAGE)} type="button">
                            Show {Math.min(PAGE, gap.open.length - openShown)} more
                          </button>
                          <span className={styles.muted}>
                            {openShown} of {gap.open.length} shown
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">DECIDED</div>
                      <h2>How each decided item came out</h2>
                    </div>

                    <span className={styles.muted}>
                      {gap.decided.length} {plural(gap.decided.length, "item", "items")}, latest first
                    </span>
                  </header>

                  {gap.decided.length === 0 ? (
                    <p className={styles.quiet}>Nothing has been decided yet.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {gap.decided.slice(0, decidedShown).map((item) => (
                          <DecidedLine item={item} key={item.id} />
                        ))}
                      </ul>

                      {gap.decided.length > decidedShown && (
                        <div className={styles.more}>
                          <button className={styles.moreButton} onClick={() => setDecidedShown((current) => current + PAGE)} type="button">
                            Show {Math.min(PAGE, gap.decided.length - decidedShown)} more
                          </button>
                          <span className={styles.muted}>
                            {decidedShown} of {gap.decided.length} shown
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </section>

                <p className={styles.note}>
                  Asked is the amount submitted on a change order or claimed on a claim. Assessed is the amount the assessor has valued it at, which may be recorded before the decision. Decided is the amount approved or awarded, and nothing for a rejection. Recovery is the amount decided as a share of the amount asked. An item is decided at its assessment when the two are within {Math.round(HELD_TOLERANCE * 100)}% of each other. The asked, assessed and decided bars use only decided items that had an assessment, so the three are comparable. Draft and void items are left out, and claims for time only have no amount, so they appear in the time totals and the lists but not in the money totals.
                  {gap.drafts > 0 ? ` ${gap.drafts} draft ${plural(gap.drafts, "item", "items")} (${cash(gap.draftAsked)}) ${plural(gap.drafts, "is", "are")} not yet submitted.` : ""}
                  {gap.missing > 0 ? ` ${gap.missing} decided ${plural(gap.missing, "item has", "items have")} no decided amount recorded and ${plural(gap.missing, "is", "are")} left out of the money totals.` : ""}
                  {gap.skipped > 0 ? ` ${gap.skipped} ${plural(gap.skipped, "item has", "items have")} no amount and no time claimed and ${plural(gap.skipped, "was", "were")} left out.` : ""}
                </p>
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
