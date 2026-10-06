"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { type CheckResult, type Gap, type Weight, passRate, runChecks, scoreOf } from "@/lib/dataHealth";
import { MODULES, MODULE_LABEL, MODULE_PATH, formatDay, loadSources, plural, projectOf, startOfToday, toDay, type ModuleKey, type Sources } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";

import styles from "./ProjectDataHealthView.module.css";

const EXAMPLE_LIMIT = 8;
const COPY_LIMIT = 10;
const SOURCE_COUNT = 9;

type Show = "gaps" | "all";
type Tone = "good" | "watch" | "weak" | "none";

const IMPACT_LABEL: Record<Weight, string> = { 3: "High impact", 2: "Medium impact", 1: "Low impact" };

const IMPACT_CLASS: Record<Weight, string | undefined> = {
  3: styles.sevCritical,
  2: styles.sevMedium,
  1: styles.sevLow,
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function toneOf(score: number): Tone {
  if (!Number.isFinite(score)) {
    return "none";
  }

  return score >= 90 ? "good" : score >= 75 ? "watch" : "weak";
}

const TONE_LABEL: Record<Tone, string> = {
  good: "Clean",
  watch: "Fair",
  weak: "Needs work",
  none: "Nothing to check",
};

const BAR_CLASS: Record<Tone, string | undefined> = {
  good: styles.toneGood,
  watch: styles.toneWatch,
  weak: styles.toneBad,
  none: styles.toneNone,
};

const VALUE_CLASS: Record<Tone, string | undefined> = {
  good: styles.pos,
  watch: undefined,
  weak: styles.neg,
  none: undefined,
};

function percent(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

export function ProjectDataHealthView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [moduleFilter, setModuleFilter] = useState<ModuleKey | "all">("all");
  const [show, setShow] = useState<Show>("gaps");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    loadSources(projectId).then((result) => {
      if (cancelled) {
        return;
      }

      setSources(result.sources);
      setFailed(result.failed);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const project = useMemo(() => (sources ? projectOf(sources) : null), [sources]);
  const results = useMemo(() => (sources ? runChecks(sources, today) : []), [sources, today]);
  const applicable = useMemo(() => results.filter((item) => item.population > 0), [results]);

  const overall = scoreOf(applicable);
  const gapTotal = applicable.reduce((sum, item) => sum + item.gaps.length, 0);
  const failing = applicable.filter((item) => item.gaps.length > 0);
  const highGaps = applicable.filter((item) => item.weight === 3).reduce((sum, item) => sum + item.gaps.length, 0);

  const moduleRows = useMemo(
    () =>
      MODULES.map((item) => {
        const own = applicable.filter((result) => result.module === item.key);
        const score = scoreOf(own);

        return {
          key: item.key,
          label: item.label,
          score,
          tone: toneOf(score),
          gaps: own.reduce((sum, result) => sum + result.gaps.length, 0),
          checks: own.length,
          failedToLoad: failed.includes(item.key),
        };
      }).sort((a, b) => {
        const aScore = Number.isFinite(a.score) ? a.score : Infinity;
        const bScore = Number.isFinite(b.score) ? b.score : Infinity;

        return aScore - bScore || a.label.localeCompare(b.label);
      }),
    [applicable, failed],
  );

  const weakest = moduleRows.find((row) => Number.isFinite(row.score)) ?? null;

  const lastProgress = useMemo(() => {
    const days = (sources?.center?.progressUpdates ?? []).map((item) => toDay(item.updateDate)).filter((day) => Number.isFinite(day));

    return days.length > 0 ? Math.max(...days) : NaN;
  }, [sources]);

  const listed = useMemo(() => {
    const scoped = results.filter((item) => moduleFilter === "all" || item.module === moduleFilter);
    const visible = show === "gaps" ? scoped.filter((item) => item.gaps.length > 0) : scoped.filter((item) => item.population > 0);

    return [...visible].sort(
      (a, b) =>
        Number(b.gaps.length > 0) - Number(a.gaps.length > 0) ||
        b.weight - a.weight ||
        b.gaps.length - a.gaps.length ||
        a.label.localeCompare(b.label),
    );
  }, [results, moduleFilter, show]);

  async function copyFixList() {
    const lines: string[] = [`# Data fixes · ${project?.name ?? "Project"} · ${formatDay(today)}`, ""];

    for (const row of moduleRows) {
      const own = failing.filter((item) => item.module === row.key);

      if (own.length === 0) {
        continue;
      }

      lines.push(`## ${row.label}`, "");

      for (const item of own.sort((a, b) => b.weight - a.weight || b.gaps.length - a.gaps.length)) {
        const refs = item.gaps.slice(0, COPY_LIMIT).map((entry) => entry.ref);
        const more = item.gaps.length > COPY_LIMIT ? ` and ${item.gaps.length - COPY_LIMIT} more` : "";

        lines.push(`- [ ] **${item.label}** (${item.gaps.length} of ${item.population}): ${refs.join(", ")}${more}`);
      }

      lines.push("");
    }

    if (lines.length <= 2) {
      lines.push("Nothing to fix.");
    }

    const ok = await copyText(`${lines.join("\n").trimEnd()}\n`);

    setMessage(ok ? "Copied the fix list as a Markdown checklist." : "Could not copy the list.");
  }

  const loaded = sources !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;
  const nothing = loaded && !failedAll && applicable.length === 0;
  const overallTone = toneOf(overall);

  function renderExamples(gaps: Gap[], module: ModuleKey) {
    return (
      <>
        <ul className={styles.examples}>
          {gaps.slice(0, EXAMPLE_LIMIT).map((entry, index) => (
            <li key={`${entry.ref}-${index}`}>
              <Link className={styles.refLink} href={`${base}/${entry.path}`}>
                {entry.ref}
              </Link>

              <span className={styles.exampleTitle}>{entry.title}</span>
              <span className={styles.exampleNote}>{entry.note}</span>
            </li>
          ))}
        </ul>

        {gaps.length > EXAMPLE_LIMIT && (
          <p className={styles.hint}>
            +{gaps.length - EXAMPLE_LIMIT} more.{" "}
            <Link className={styles.inlineLink} href={`${base}/${MODULE_PATH[module]}`}>
              Open {MODULE_LABEL[module].toLowerCase()}
            </Link>
          </p>
        )}
      </>
    );
  }

  function renderCheck(item: CheckResult, index: number) {
    const rate = passRate(item);
    const tone = toneOf(rate * 100);
    const clean = item.gaps.length === 0;

    const summary = (
      <>
        <span className={cx(styles.sev, IMPACT_CLASS[item.weight])}>{IMPACT_LABEL[item.weight]}</span>

        <span className={styles.checkMain}>
          <strong>{item.label}</strong>
          <small>{MODULE_LABEL[item.module]}</small>
        </span>

        <span className={styles.checkFigure}>
          {clean ? (
            <span className={styles.cleanTag}>Clean</span>
          ) : (
            <>
              <strong>{item.gaps.length}</strong> of {item.population}
            </>
          )}
        </span>

        <span aria-hidden="true" className={styles.miniTrack}>
          <span className={cx(styles.miniFill, BAR_CLASS[tone])} style={{ width: `${Math.max(2, Math.round(rate * 100))}%` }} />
        </span>
      </>
    );

    if (clean) {
      return (
        <li className={cx(styles.check, styles.checkClean)} key={item.key}>
          <div className={styles.checkSummary}>{summary}</div>
        </li>
      );
    }

    return (
      <li className={styles.check} key={item.key}>
        <details open={index === 0}>
          <summary className={styles.checkSummary}>{summary}</summary>

          <div className={styles.checkBody}>
            <p className={styles.why}>{item.why}</p>
            {renderExamples(item.gaps, item.module)}
          </div>
        </details>
      </li>
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

            <div className="eyebrow">DATA HYGIENE</div>

            <h1>Is the project data fit to trust?</h1>

            <p className={styles.subtitle}>
              Every dashboard is only as good as the records behind it. This page looks for the gaps that quietly weaken them: missing
              owners, missing dates, stale statuses and notes that were never written.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/map`}>
            Open project map
          </Link>
        </header>

        {!loaded && <div className={styles.loading}>Checking the records…</div>}

        {failedAll && (
          <div className="offline-banner">
            <div>
              <strong>Could not load any project data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {loaded && !failedAll && failed.length > 0 && (
          <div className="offline-banner">
            <div>
              <strong>Could not load {failed.map((key) => MODULE_LABEL[key].toLowerCase()).join(", ")}.</strong>
              <span> Those modules are not checked, and the score covers the rest.</span>
            </div>
          </div>
        )}

        {nothing && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No records are loaded yet, so there is nothing to check. Add actions, risks, RFIs and the like and come back.</div>
          </section>
        )}

        {loaded && !failedAll && !nothing && (
          <>
            <section aria-label="Data hygiene summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>DATA HEALTH</div>
                <div className={styles.kpiValue}>{percent(overall)}</div>
                <div className={styles.kpiSub}>{TONE_LABEL[overallTone]}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>GAPS FOUND</div>
                <div className={cx(styles.kpiValue, gapTotal > 0 && styles.neg)}>{gapTotal}</div>
                <div className={styles.kpiSub}>
                  in {failing.length} of {applicable.length} {plural(applicable.length, "check", "checks")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>HIGH-IMPACT GAPS</div>
                <div className={cx(styles.kpiValue, highGaps > 0 && styles.neg)}>{highGaps}</div>
                <div className={styles.kpiSub}>owners, plans and permits</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WEAKEST MODULE</div>
                <div className={cx(styles.kpiValue, weakest && VALUE_CLASS[weakest.tone])}>{weakest ? percent(weakest.score) : "—"}</div>
                <div className={styles.kpiSub}>{weakest ? weakest.label : "nothing scored"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PROGRESS UPDATED</div>
                <div className={styles.kpiValue}>{Number.isFinite(lastProgress) ? `${Math.max(0, today - lastProgress)} d ago` : "—"}</div>
                <div className={styles.kpiSub}>
                  {Number.isFinite(lastProgress) ? formatDay(lastProgress) : sources?.center ? "no update recorded" : "schedule not loaded"}
                </div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY MODULE</div>
                  <h2>Where the gaps are</h2>
                </div>

                {moduleFilter !== "all" && (
                  <button className={styles.linkButton} onClick={() => setModuleFilter("all")} type="button">
                    Show every module
                  </button>
                )}
              </header>

              <ul className={styles.modules}>
                {moduleRows.map((row) => {
                  const unavailable = row.failedToLoad || !Number.isFinite(row.score);

                  return (
                    <li key={row.key}>
                      <button
                        aria-pressed={moduleFilter === row.key}
                        className={cx(styles.moduleRow, moduleFilter === row.key && styles.moduleOn)}
                        disabled={unavailable}
                        onClick={() => setModuleFilter(moduleFilter === row.key ? "all" : row.key)}
                        type="button"
                      >
                        <span className={styles.moduleName}>{row.label}</span>

                        <span aria-hidden="true" className={styles.track}>
                          <span className={cx(styles.fill, BAR_CLASS[row.tone])} style={{ width: `${unavailable ? 0 : Math.max(2, row.score)}%` }} />
                        </span>

                        <span className={styles.moduleScore}>
                          {row.failedToLoad ? "Not loaded" : Number.isFinite(row.score) ? percent(row.score) : "No records"}
                        </span>

                        <span className={styles.moduleGaps}>
                          {unavailable ? "" : `${row.gaps} ${plural(row.gaps, "gap", "gaps")}`}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WHAT TO FIX</div>
                  <h2>{moduleFilter === "all" ? "Checks, worst first" : `${MODULE_LABEL[moduleFilter]} checks`}</h2>
                </div>

                <div className={styles.controls}>
                  <div aria-label="Which checks to show" className={styles.segmented} role="group">
                    <button
                      aria-pressed={show === "gaps"}
                      className={cx(styles.segment, show === "gaps" && styles.segmentOn)}
                      onClick={() => setShow("gaps")}
                      type="button"
                    >
                      With gaps {failing.length}
                    </button>

                    <button
                      aria-pressed={show === "all"}
                      className={cx(styles.segment, show === "all" && styles.segmentOn)}
                      onClick={() => setShow("all")}
                      type="button"
                    >
                      All checks {applicable.length}
                    </button>
                  </div>

                  <button className={styles.linkButton} disabled={failing.length === 0} onClick={copyFixList} type="button">
                    Copy fix list
                  </button>
                </div>
              </header>

              {message && (
                <p className={styles.statusLine} role="status">
                  {message}
                </p>
              )}

              {listed.length === 0 ? (
                <div className={styles.emptySmall}>
                  {show === "gaps" ? "No gaps found. Every check on these records passes." : "No checks apply to this module yet."}
                </div>
              ) : (
                <ul className={styles.checks}>{listed.map(renderCheck)}</ul>
              )}
            </section>

            <p className={styles.note}>
              Each check looks at the open records of one kind and counts how many have a gap. Data health is the share of records that
              pass, weighted by impact (high counts three times a low one), and a module scores the same way over its own checks.
              90% and above is clean, 75% to 89% is fair, and below that needs work. A check with no records to look at is left out
              rather than counted as a pass. These checks find missing information, not wrong information.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
