"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { HORIZONS, UNSAFE_WINDOW_DAYS, briefText, buildBrief, longDate, type BriefSection, type SectionKey } from "@/lib/siteBrief";
import { MODULE_LABEL, loadSources, plural, projectOf, startOfToday, type ModuleKey, type Sources } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";

import styles from "./ProjectSiteBriefView.module.css";

const SOURCE_COUNT = 9;

const PRINT_RULES = "@media print{.sidebar{display:none!important}.app-shell{display:block!important}.main{margin:0!important;max-width:none!important;padding:0!important}}";

const ORDER: ReadonlyArray<SectionKey> = ["permits", "blocked", "inspections", "deliveries", "meetings", "due", "progress", "overdue"];

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function counter(value: number | null): string {
  return value === null ? "—" : String(value);
}

export function ProjectSiteBriefView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [horizon, setHorizon] = useState(3);
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

  const brief = useMemo(() => (sources ? buildBrief(sources, failed, today, horizon) : null), [sources, failed, today, horizon]);
  const project = sources ? projectOf(sources) : null;
  const projectName = project?.name ?? "Project";

  const sections = useMemo(() => {
    if (!brief) {
      return [] as BriefSection[];
    }

    return ORDER.map((key) => brief.sections.find((item) => item.key === key)).filter((item): item is BriefSection => item !== undefined);
  }, [brief]);

  async function copyBrief() {
    if (!brief) {
      return;
    }

    const ok = await copyText(briefText(brief, projectName));

    setMessage(ok ? "Copied the brief as plain text, ready to paste into a message." : "Could not copy the brief.");
  }

  const loaded = sources !== null && brief !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;
  const window_ = HORIZONS.find((item) => item.days === horizon)?.label.toLowerCase() ?? `${horizon} days`;

  return (
    <div className="app-shell">
      <style>{PRINT_RULES}</style>

      <BuildSightSidebar />

      <main className="main">
        <header className={cx(styles.header, styles.noPrint)}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">SITE BRIEF</div>

            <h1>What is happening on site today?</h1>

            <p className={styles.subtitle}>
              A one-page briefing for the morning huddle: what is in force, what is blocked, what is due and what to talk about. Print it
              or copy it as text for the site group.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/safety-board`}>
              Safety board
            </Link>

            <Link className="secondary-link-button" href={`${base}/production-board`}>
              Production board
            </Link>
          </div>
        </header>

        {!loaded && <div className={cx(styles.loading, styles.noPrint)}>Gathering today&apos;s records…</div>}

        {failedAll && (
          <div className={cx("offline-banner", styles.noPrint)}>
            <div>
              <strong>Could not load any project data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {loaded && !failedAll && failed.length > 0 && (
          <div className={cx("offline-banner", styles.noPrint)}>
            <div>
              <strong>Could not load {failed.map((key) => MODULE_LABEL[key].toLowerCase()).join(", ")}.</strong>
              <span> Those parts of the brief are marked.</span>
            </div>
          </div>
        )}

        {loaded && !failedAll && brief && (
          <>
            <section className={cx(styles.controls, styles.noPrint)}>
              <div aria-label="Look ahead" className={styles.segmented} role="group">
                <span className={styles.controlLabel}>Look ahead</span>

                {HORIZONS.map((option) => (
                  <button
                    aria-pressed={horizon === option.days}
                    className={cx(styles.segment, horizon === option.days && styles.segmentOn)}
                    key={option.days}
                    onClick={() => setHorizon(option.days)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className={styles.actions}>
                <button className={styles.actionButton} onClick={() => window.print()} type="button">
                  Print
                </button>

                <button className={styles.linkButton} onClick={copyBrief} type="button">
                  Copy as text
                </button>
              </div>
            </section>

            {message && (
              <p className={cx(styles.statusLine, styles.noPrint)} role="status">
                {message}
              </p>
            )}

            <article className={styles.sheet}>
              <header className={styles.sheetHead}>
                <div>
                  <div className="eyebrow">DAILY SITE BRIEF</div>
                  <h2>{projectName}</h2>
                </div>

                <div className={styles.sheetDate}>
                  <strong>{longDate(brief.today)}</strong>
                  <span>Looking ahead {window_}</span>
                </div>
              </header>

              <section aria-label="Safety first" className={styles.safety}>
                <div className={styles.safetyTiles}>
                  <div className={cx(styles.tile, styles.tileDark)}>
                    <span className={styles.tileValue}>{counter(brief.safety.sinceIncident)}</span>
                    <span className={styles.tileLabel}>days since last incident</span>
                    <span className={styles.tileSub}>{brief.safety.lastIncident ? `last on ${brief.safety.lastIncident}` : "none recorded"}</span>
                  </div>

                  <div className={styles.tile}>
                    <span className={styles.tileValue}>{counter(brief.safety.sinceLostTime)}</span>
                    <span className={styles.tileLabel}>days since lost-time injury</span>
                    <span className={styles.tileSub}>{brief.safety.sinceLostTime === null ? "none recorded" : "keep it going"}</span>
                  </div>

                  <div className={styles.tile}>
                    <span className={styles.tileValue}>{brief.safety.permitsInForce}</span>
                    <span className={styles.tileLabel}>{plural(brief.safety.permitsInForce, "permit", "permits")} in force</span>
                    <span className={styles.tileSub}>check each before work starts</span>
                  </div>

                  <div className={styles.tile}>
                    <span className={cx(styles.tileValue, brief.safety.overdueActions > 0 && styles.neg)}>{brief.safety.openActions}</span>
                    <span className={styles.tileLabel}>open safety {plural(brief.safety.openActions, "action", "actions")}</span>
                    <span className={cx(styles.tileSub, brief.safety.overdueActions > 0 && styles.neg)}>{brief.safety.overdueActions} overdue</span>
                  </div>
                </div>

                <p className={styles.talk}>
                  <strong>Toolbox talk:</strong>{" "}
                  {brief.safety.talks.length > 0
                    ? `${brief.safety.unsafe} unsafe ${plural(brief.safety.unsafe, "observation", "observations")} in the last ${UNSAFE_WINDOW_DAYS} days. Most were ${brief.safety.talks.map((talk) => `${talk.label} (${talk.count})`).join(", ")}.`
                    : `No unsafe acts or conditions were logged in the last ${UNSAFE_WINDOW_DAYS} days. Pick a topic from the permits in force.`}
                </p>
              </section>

              {brief.report && (
                <section aria-label="Latest site report" className={styles.report}>
                  <strong>
                    Site report {brief.report.reference}
                    {brief.report.daysAgo === 0 ? " today" : brief.report.daysAgo === 1 ? " yesterday" : `, ${brief.report.daysAgo} days ago`}
                  </strong>
                  <span>
                    {brief.report.weather} · {Math.round(brief.report.labor)} labour hours · {Math.round(brief.report.equipment)} equipment hours
                  </span>
                  {brief.report.notes && <span className={styles.reportNotes}>{brief.report.notes}</span>}
                </section>
              )}

              <div className={styles.sections}>
                {sections.map((part) => (
                  <section className={cx(styles.part, part.key === "blocked" && part.total > 0 && styles.partAlert)} key={part.key}>
                    <header className={styles.partHead}>
                      <h3>{part.title}</h3>
                      <span className={styles.count}>{part.missing ? "not loaded" : part.total}</span>
                    </header>

                    <p className={styles.partHint}>{part.hint}</p>

                    {part.missing ? (
                      <div className={styles.partEmpty}>This part could not be loaded.</div>
                    ) : part.items.length === 0 ? (
                      <div className={styles.partEmpty}>{part.empty}</div>
                    ) : (
                      <ul className={styles.items}>
                        {part.items.map((item) => (
                          <li key={item.id}>
                            <span className={styles.itemText}>
                              {item.text}
                              {item.flag && <em className={cx(styles.flag, item.alert && styles.flagAlert)}>{item.flag}</em>}
                            </span>

                            {item.meta && <span className={styles.itemMeta}>{item.meta}</span>}
                          </li>
                        ))}
                      </ul>
                    )}

                    {part.total > part.items.length && <p className={styles.more}>and {part.total - part.items.length} more.</p>}
                  </section>
                ))}
              </div>
            </article>

            <p className={cx(styles.note, styles.noPrint)}>
              Built from the live records each time you open it. Days since last incident ignore near misses. Permits in force are those marked
              active whose dates cover today. Work in progress is ordered by how far each package is behind the plan&apos;s expected progress.
              Toolbox topics count unsafe acts and conditions logged in the last {UNSAFE_WINDOW_DAYS} days by hazard type.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
