"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import { formatDay, plural, startOfToday } from "@/lib/openItems";
import { HIGH_FLOAT_DAYS, OFFENDER_LIMIT, buildHealth, healthMarkdown, type CheckKey, type CheckStatus } from "@/lib/scheduleHealth";
import { copyText } from "@/lib/textExport";
import type { ScheduleControl } from "@/types/project";

import styles from "./ProjectScheduleHealthView.module.css";

type Filter = "all" | "fail" | "warn" | "pass";

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "fail", label: "Failing" },
  { key: "warn", label: "Watch" },
  { key: "pass", label: "Passing" },
];

const STATUS_LABEL: Record<CheckStatus, string> = { pass: "Pass", warn: "Watch", fail: "Fail", na: "n/a" };

const STATUS_CLASS: Record<CheckStatus, string | undefined> = {
  pass: styles.pillPass,
  warn: styles.pillWarn,
  fail: styles.pillFail,
  na: styles.pillNa,
};

const TONE_CLASS: Record<string, string | undefined> = {
  bad: styles.toneBad,
  warn: styles.toneWarn,
  good: styles.toneGood,
  plain: styles.tonePlain,
};

const TYPE_LABEL: Record<string, string> = {
  FS: "Finish to start",
  SS: "Start to start",
  FF: "Finish to finish",
  SF: "Start to finish",
};

const TYPE_CLASS: Record<string, string | undefined> = {
  FS: styles.typeFS,
  SS: styles.typeSS,
  FF: styles.typeFF,
  SF: styles.typeSF,
};

const VERDICT: Record<string, string> = {
  healthy: "Healthy",
  attention: "Needs attention",
  weak: "Weak",
  none: "No checks apply",
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

export function ProjectScheduleHealthView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<CheckKey[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectSchedule(projectId)
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

  const health = useMemo(() => (data ? buildHealth(data, today) : null), [data, today]);
  const empty = state === "ready" && data !== null && (data.activities ?? []).length === 0;
  const projectName = data?.project?.name ?? "Project";

  const shown = useMemo(() => (health ? health.checks.filter((check) => filter === "all" || check.status === filter) : []), [health, filter]);

  const counts = useMemo(() => {
    const tally: Record<Filter, number> = { all: 0, fail: 0, warn: 0, pass: 0 };

    for (const check of health?.checks ?? []) {
      tally.all += 1;

      if (check.status === "fail" || check.status === "warn" || check.status === "pass") {
        tally[check.status] += 1;
      }
    }

    return tally;
  }, [health]);

  const biggestFloat = Math.max(1, ...(health?.floatProfile ?? []).map((item) => item.count));
  const linkTotal = (health?.types ?? []).reduce((sum, item) => sum + item.count, 0);

  function toggle(key: CheckKey) {
    setOpen((list) => (list.includes(key) ? list.filter((item) => item !== key) : [...list, key]));
  }

  async function copyReport() {
    if (!health) {
      return;
    }

    const ok = await copyText(healthMarkdown(health, projectName, today));

    setMessage(ok ? "Copied the report as Markdown." : "Could not copy the report.");
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

            <div className="eyebrow">SCHEDULE QUALITY</div>

            <h1>Can the schedule be trusted?</h1>

            <p className={styles.subtitle}>
              A forecast is only as good as the logic behind it. These checks look for the usual weaknesses that make a schedule look
              healthier than it is: loose ends, hidden lags, negative float and stale updates.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/lookahead`}>
              Lookahead board
            </Link>

            <Link className="secondary-link-button" href={`${base}/finish-simulation`}>
              Finish confidence
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the schedule…</div>}

        {state === "failed" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the schedule. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {empty && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>The schedule has no activities yet, so there is nothing to check.</div>
          </section>
        )}

        {state === "ready" && health && !empty && (
          <>
            {health.links === 0 && (
              <p className={styles.warnNote} role="note">
                <strong>The activities have no logic links.</strong> Checks on links are skipped, and every activity counts as loose until
                predecessors are added on the schedule page.
              </p>
            )}

            <section aria-label="Schedule health summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>CHECKS PASSED</div>
                <div className={styles.kpiValue}>
                  {health.passed}
                  <span className={styles.of}> / {health.applicable}</span>
                </div>
                <div className={styles.kpiSub}>{VERDICT[health.verdict]}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FAILING</div>
                <div className={cx(styles.kpiValue, health.failed > 0 && styles.neg)}>{health.failed}</div>
                <div className={styles.kpiSub}>{health.warned} more to watch</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>UNFINISHED</div>
                <div className={styles.kpiValue}>{health.live}</div>
                <div className={styles.kpiSub}>{plural(health.live, "activity", "activities")} checked</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LOGIC DENSITY</div>
                <div className={styles.kpiValue}>{health.density.toFixed(1)}</div>
                <div className={styles.kpiSub}>links per activity ({health.links} in all)</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LAST UPDATED</div>
                <div className={cx(styles.kpiValue, health.staleDays > 14 && styles.neg)}>{formatDay(health.dataDay)}</div>
                <div className={styles.kpiSub}>
                  {Math.max(0, health.staleDays)} {plural(Math.max(0, health.staleDays), "day", "days")} old
                </div>
              </article>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">FLOAT</div>
                    <h2>How much slack is left</h2>
                  </div>
                </header>

                <ul className={styles.profile}>
                  {health.floatProfile.map((bucket) => (
                    <li key={bucket.key}>
                      <span className={styles.profileLabel}>{bucket.label}</span>

                      <span aria-hidden="true" className={styles.profileBar}>
                        <span className={cx(styles.profileFill, TONE_CLASS[bucket.tone])} style={{ width: `${(bucket.count / biggestFloat) * 100}%` }} />
                      </span>

                      <span className={styles.profileCount}>{bucket.count}</span>
                    </li>
                  ))}
                </ul>

                <p className={styles.hint}>Unfinished activities only. Zero or negative float means no room for delay.</p>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">LOGIC</div>
                    <h2>What the links look like</h2>
                  </div>
                </header>

                {linkTotal === 0 ? (
                  <div className={styles.emptySmall}>No links between unfinished activities.</div>
                ) : (
                  <>
                    <div aria-hidden="true" className={styles.typeBar}>
                      {health.types.map((item) =>
                        item.count > 0 ? <span className={TYPE_CLASS[item.type]} key={item.type} style={{ flexGrow: item.count }} title={`${TYPE_LABEL[item.type]}: ${item.count}`} /> : null,
                      )}
                    </div>

                    <ul className={styles.legend}>
                      {health.types.map((item) => (
                        <li key={item.type}>
                          <span className={cx(styles.swatch, TYPE_CLASS[item.type])} />
                          {TYPE_LABEL[item.type]} · {item.count} ({Math.round((item.count / linkTotal) * 100)}%)
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <p className={styles.hint}>Finish to start is the easiest logic to follow and defend.</p>
              </section>
            </div>

            <section className={styles.controls}>
              <div aria-label="Filter checks" className={styles.segmented} role="group">
                {FILTERS.map((option) => (
                  <button
                    aria-pressed={filter === option.key}
                    className={cx(styles.segment, filter === option.key && styles.segmentOn)}
                    key={option.key}
                    onClick={() => setFilter(option.key)}
                    type="button"
                  >
                    {option.label} <span>{counts[option.key]}</span>
                  </button>
                ))}
              </div>

              <button className={styles.linkButton} onClick={copyReport} type="button">
                Copy report
              </button>
            </section>

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            {shown.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No check is in that group.</div>
              </section>
            ) : (
              <ul className={styles.checks}>
                {shown.map((check) => {
                  const expanded = open.includes(check.key);

                  return (
                    <li className={styles.check} key={check.key}>
                      <div className={styles.checkRow}>
                        <span className={cx(styles.pill, STATUS_CLASS[check.status])}>{STATUS_LABEL[check.status]}</span>

                        <span className={styles.checkMain}>
                          <strong className={styles.checkTitle}>{check.title}</strong>
                          <span className={styles.checkWhy}>{check.why}</span>
                        </span>

                        <span className={styles.checkResult}>
                          <strong>{check.status === "na" ? "Not applicable" : check.display}</strong>
                          <small>Limit: {check.limit.toLowerCase()}</small>
                        </span>
                      </div>

                      {check.total > 0 && check.status !== "pass" && (
                        <>
                          <button aria-expanded={expanded} className={styles.toggle} onClick={() => toggle(check.key)} type="button">
                            {expanded ? "Hide the activities" : `Show what is behind this (${check.total})`}
                          </button>

                          {expanded && (
                            <>
                              <ul className={styles.offenders}>
                                {check.offenders.map((item) => (
                                  <li key={item.id}>
                                    <span className={styles.offenderMain}>
                                      {item.code && <strong>{item.code}</strong>} {item.name}
                                    </span>
                                    <span className={styles.offenderNote}>{item.note}</span>
                                  </li>
                                ))}
                              </ul>

                              {check.total > OFFENDER_LIMIT && <p className={styles.moreLine}>and {check.total - OFFENDER_LIMIT} more.</p>}
                            </>
                          )}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <p className={styles.note}>
              These follow the spirit of the well-known 14-point schedule assessment, adapted to what BuildSight records. Limits are 5% for
              most ratios (loose ends, lags, high float, long durations, missed work), 90% finish-to-start, no negative lags and no negative
              float. Float and duration limits are {HIGH_FLOAT_DAYS} days. Watch is a milder band, and checks with nothing to measure are
              left out of the score. A passing check does not prove the schedule is right, only that it avoids the common faults.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
