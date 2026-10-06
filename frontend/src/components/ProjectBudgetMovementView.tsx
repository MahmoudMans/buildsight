"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectCostControl } from "@/lib/api";
import { FILTERS, GROWN, PAGE, buildMovement, cash, exact, filterLines, movementMarkdown, pct, signedCash, signedExact, signedPct, type Filter, type Line, type Movement, type Step } from "@/lib/budgetMovement";
import { plural, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { CostControl } from "@/types/project";

import styles from "./ProjectBudgetMovementView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const STEP_FILL: Record<Step["kind"], string | undefined> = {
  total: styles.fillTotal,
  up: styles.fillUp,
  down: styles.fillDown,
};

const CAP = 0.5;

function StepLine({ step, scale }: { step: Step; scale: number }) {
  const left = (step.from / scale) * 100;
  const width = Math.max(0.6, ((step.to - step.from) / scale) * 100);
  const label = step.kind === "total" ? cash(step.value) : signedCash(step.value);

  return (
    <li className={styles.stepRow}>
      <span className={styles.stepName}>{step.label}</span>

      <span aria-label={`${step.label}: ${label}`} className={styles.stepTrack} role="img">
        <i className={cx(styles.stepFill, STEP_FILL[step.kind])} style={{ left: `${left}%`, width: `${width}%` }} />
      </span>

      <b className={styles.stepValue}>{label}</b>
    </li>
  );
}

function Diverge({ line }: { line: Line }) {
  const share = line.growth === null ? (line.added ? CAP : 0) : Math.max(-CAP, Math.min(CAP, line.growth));
  const width = (Math.abs(share) / CAP) * 50;

  return (
    <span aria-hidden="true" className={styles.diverge}>
      <i
        className={cx(styles.divergeFill, share >= 0 ? styles.fillUp : styles.fillDown)}
        style={share >= 0 ? { left: "50%", width: `${width}%` } : { left: `${50 - width}%`, width: `${width}%` }}
      />
      <i className={styles.axis} />
    </span>
  );
}

function growthText(line: Line): string {
  if (line.added) {
    return "new line";
  }

  if (line.growth === null) {
    return "no original budget";
  }

  return `${signedPct(line.growth)} on the original`;
}

function BudgetLine({ line }: { line: Line }) {
  const changed = Math.abs(line.changes) > 1;

  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{line.code}</strong> {trunc(line.name, 48)}
        <Diverge line={line} />
        <small>{changed ? growthText(line) : "no approved changes"}</small>
      </span>

      <span className={styles.figs}>
        <span>
          <b>Original</b>
          {exact(line.original)}
        </span>
        <span>
          <b>Changes</b>
          {changed ? signedExact(line.changes) : "€0"}
        </span>
        <span>
          <b>Revised</b>
          {exact(line.revised)}
        </span>
        <span>
          <b>Forecast</b>
          {exact(line.forecast)}
        </span>
      </span>

      <span className={styles.verdict}>
        {line.added && <em className={cx(styles.chip, styles.chipPlain)}>New line</em>}
        {line.removed && <em className={cx(styles.chip, styles.chipPlain)}>Taken out</em>}
        {line.unbudgeted && <em className={cx(styles.chip, styles.chipBad)}>Forecast, no budget</em>}
        {line.over && !line.unbudgeted && <em className={cx(styles.chip, styles.chipWatch)}>Forecast over</em>}
        {!line.over && <em className={cx(styles.chip, styles.chipGood)}>Within plan</em>}
        {line.mismatch && <em className={cx(styles.chip, styles.chipBad)}>Does not add up</em>}
        {line.over && <small>{signedExact(line.forecastGap)} on the revised budget</small>}
        {!line.over && line.forecastGap < -1 && <small>{exact(-line.forecastGap)} under the revised budget</small>}
        {line.mismatch && <small>revised differs from original plus changes by {signedExact(line.off)}</small>}
      </span>
    </li>
  );
}

export function ProjectBudgetMovementView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<CostControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectCostControl(projectId)
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

  const built = useMemo(() => (data ? buildMovement(data) : null), [data]);
  const move: Movement | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (move ? filterLines(move.lines, filter) : []), [move, filter]);
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const steps = move ? move.steps.filter((step) => step.key !== "increases" && step.key !== "reductions" ? true : Math.abs(step.value) > 1) : [];

  async function copySummary() {
    if (!move) {
      return;
    }

    const ok = await copyText(movementMarkdown(move, list, projectName, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the budget movement as Markdown." : "Could not copy the budget movement.");
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

            <div className="eyebrow">BUDGET MOVEMENT</div>

            <h1>How far has the budget moved from the original plan?</h1>

            <p className={styles.subtitle}>
              The cost plan rarely stays where it started. Following each budget line from its original amount through the approved changes to the revised plan, and then to the forecast, shows where the money was added, how concentrated the growth is, and which lines still forecast above what they now have.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/spend-board`}>
              Spend board
            </Link>

            <Link className="secondary-link-button" href={`${base}/cost-breakdown`}>
              Cost breakdown
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the budget lines…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the budget lines. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No budget lines have been recorded yet, so there is no plan to follow.</div>
          </section>
        )}

        {state === "ready" && move && (
          <>
            <section aria-label="Budget movement summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>ORIGINAL PLAN</div>
                <div className={styles.kpiValue}>{cash(move.original)}</div>
                <div className={styles.kpiSub}>
                  {move.lines.length} budget {plural(move.lines.length, "line", "lines")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CHANGES</div>
                <div className={cx(styles.kpiValue, move.original > 0 && move.changes / move.original >= GROWN && styles.neg)}>{signedCash(move.changes)}</div>
                <div className={styles.kpiSub}>{move.original > 0 ? `${signedPct(move.changes / move.original)} on the original plan` : "no original plan to compare with"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>REVISED PLAN</div>
                <div className={cx(styles.kpiValue, move.overApproved > 0 && styles.neg)}>{cash(move.revised)}</div>
                <div className={styles.kpiSub}>{move.approved === null ? "after approved changes" : move.overApproved > 0 ? `${cash(move.overApproved)} above the approved budget of ${cash(move.approved)}` : `within the approved budget of ${cash(move.approved)}`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST</div>
                <div className={cx(styles.kpiValue, move.forecastGap > 1 && styles.neg)}>{cash(move.forecast)}</div>
                <div className={styles.kpiSub}>{signedCash(move.forecastGap)} against the revised plan</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LINES CHANGED</div>
                <div className={styles.kpiValue}>{move.changed}</div>
                <div className={styles.kpiSub}>{move.top3Share !== null ? `of ${move.lines.length}, the top 3 increases are ${pct(move.top3Share)} of the money added` : `of ${move.lines.length}, nothing was added`}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Lines</span>

                <div aria-label="Which budget lines to list" className={styles.segmented} role="group">
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

            {move.overApproved > 0 && move.approved !== null && (
              <p className={styles.caution} role="note">
                The revised cost plan is {cash(move.overApproved)} above the approved project budget of {cash(move.approved)}.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">FROM ORIGINAL TO FORECAST</div>
                  <h2>How the plan moved</h2>
                </div>

                <span className={styles.muted}>
                  {cash(move.increases)} added, {cash(move.reductions)} taken out
                </span>
              </header>

              <ul className={styles.steps}>
                {steps.map((step) => (
                  <StepLine key={step.key} scale={move.scale} step={step} />
                ))}
              </ul>

              {move.checks.map((check) => (
                <p className={styles.hint} key={check.label}>
                  The cost control summary gives {check.label.toLowerCase()} as {cash(check.summary)}, but the budget lines add up to {cash(check.lines)}.
                </p>
              ))}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BUDGET LINES</div>
                  <h2>Which lines moved the most</h2>
                </div>

                <span className={styles.muted}>
                  {list.length} of {move.lines.length} {plural(move.lines.length, "line", "lines")}, {filter === "over" ? "largest overrun first" : "largest change first"}
                </span>
              </header>

              {list.length === 0 ? (
                <p className={styles.quiet}>{filter === "all" ? "There are no budget lines to show." : "No budget line matches this selection."}</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {list.slice(0, shown).map((line) => (
                      <BudgetLine key={line.id} line={line} />
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
              The original plan is each line&apos;s original budget and the changes are the approved changes recorded against it, so a line&apos;s growth is its changes divided by its original budget; the bars on each line show that growth up to 50% either way. A line with no original budget that now has one is a new line. The forecast against plan is the forecast cost less the revised budget, and a line forecasting spend with no revised budget is shown as having no budget. A line whose revised budget is not its original plus its changes is flagged, and the difference appears in the bridge as a separate step. Grown means 10% or more above the original budget, or a new line.
              {move.emptyLines > 0 ? ` ${move.emptyLines} ${plural(move.emptyLines, "line has", "lines have")} nothing in any column and ${plural(move.emptyLines, "is", "are")} left out.` : ""}
              {move.skipped > 0 ? ` ${move.skipped} ${plural(move.skipped, "line has", "lines have")} an unusable amount and ${plural(move.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
