"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import { MODULES, MODULE_LABEL, formatDay, loadSources, plural, projectOf, startOfToday, type ModuleKey, type Sources } from "@/lib/openItems";
import {
  HISTORY_LIMIT,
  SPARK_MIN_POINTS,
  STATUS_LABEL,
  clampTarget,
  defaultSettings,
  goalText,
  historyKey,
  historySpan,
  parseDraft,
  parseHistory,
  parseSettings,
  rangeHint,
  readMetrics,
  readStore,
  recordSnapshot,
  rowsOf,
  seriesOf,
  serialiseHistory,
  serialiseSettings,
  storageKey,
  tally,
  targetsMarkdown,
  trendOf,
  unitText,
  valueText,
  valuesOf,
  writeStore,
  type MetricDef,
  type MetricKey,
  type Row,
  type SeriesPoint,
  type Settings,
  type Snapshot,
  type Status,
} from "@/lib/targets";
import { copyText } from "@/lib/textExport";
import type { ScheduleControl } from "@/types/project";

import styles from "./ProjectTargetsView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const CARD: Record<Status, string | undefined> = { met: styles.stMet, near: styles.stNear, missed: styles.stMissed, none: styles.stNone };
const PILL: Record<Status, string | undefined> = { met: styles.pillMet, near: styles.pillNear, missed: styles.pillMissed, none: styles.pillNone };
const DOT: Record<Status, string | undefined> = { met: styles.dotMet, near: styles.dotNear, missed: styles.dotMissed, none: styles.dotNone };

function Spark({ def, series, status, target }: { def: MetricDef; series: SeriesPoint[]; status: Status; target: number }) {
  const width = 132;
  const height = 38;
  const pad = 5;
  const values = series.map((point) => point.value);
  const low = Math.min(...values, target);
  const high = Math.max(...values, target);
  const span = high - low || 1;
  const x = (index: number) => pad + (index / Math.max(1, series.length - 1)) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - low) / span) * (height - pad * 2);
  const last = series[series.length - 1] as SeriesPoint;
  const points = series.map((point, index) => `${x(index).toFixed(1)},${y(point.value).toFixed(1)}`).join(" ");
  const recent = series.slice(-6).map((point) => `${formatDay(point.day)} ${valueText(def, point.value)}`).join(", ");

  return (
    <svg aria-label={`Trend of ${def.label}, ${series.length} recordings. Latest: ${recent}. Target ${valueText(def, target)}.`} className={styles.spark} role="img" viewBox={`0 0 ${width} ${height}`}>
      <line className={styles.sparkTarget} x1={pad} x2={width - pad} y1={y(target)} y2={y(target)} />
      <polyline className={styles.sparkLine} points={points} />
      <circle className={cx(styles.sparkDot, DOT[status])} cx={x(series.length - 1)} cy={y(last.value)} r={3} />
    </svg>
  );
}

function Card({
  draft,
  history,
  onDraft,
  onStep,
  onUntrack,
  row,
}: {
  draft: string | undefined;
  history: Snapshot[];
  onDraft: (def: MetricDef, text: string) => void;
  onStep: (def: MetricDef, direction: 1 | -1) => void;
  onUntrack: (key: MetricKey) => void;
  row: Row;
}) {
  const { def, reading, setting, status } = row;
  const series = seriesOf(history, def.key);
  const trend = trendOf(def, series);
  const shown = draft ?? String(setting.target);
  const invalid = draft !== undefined && parseDraft(def, draft) === null;
  const inputId = `target-${def.key}`;

  return (
    <article className={cx(styles.card, CARD[status])}>
      <header className={styles.cardHead}>
        <h3>{def.label}</h3>
        <span className={cx(styles.pill, PILL[status])}>{STATUS_LABEL[status]}</span>
      </header>

      <div className={styles.cardValue}>{valueText(def, reading.value)}</div>

      {reading.why && <p className={styles.cardWhy}>{reading.why}</p>}
      {reading.partial && <p className={styles.cardPartial}>{reading.partial}</p>}

      <div className={styles.targetRow}>
        <label htmlFor={inputId}>Target: {goalText(def)}</label>

        <div className={styles.stepper}>
          <button aria-label={`Lower the target for ${def.label}`} className={styles.stepButton} onClick={() => onStep(def, -1)} type="button">
            −
          </button>

          <input aria-invalid={invalid} className={cx(styles.targetInput, invalid && styles.inputBad)} id={inputId} inputMode="decimal" onChange={(event) => onDraft(def, event.target.value)} type="text" value={shown} />

          <button aria-label={`Raise the target for ${def.label}`} className={styles.stepButton} onClick={() => onStep(def, 1)} type="button">
            +
          </button>
        </div>

        {unitText(def) !== "" && <span className={styles.unit}>{unitText(def)}</span>}
      </div>

      {invalid && (
        <p className={styles.fieldHint} role="alert">
          {rangeHint(def)}
        </p>
      )}

      <div className={styles.trendRow}>
        {series.length >= SPARK_MIN_POINTS ? (
          <>
            <Spark def={def} series={series} status={status} target={setting.target} />
            {trend && <span className={cx(styles.trendText, trend.tone === "better" && styles.better, trend.tone === "worse" && styles.worse)}>{trend.text}</span>}
          </>
        ) : (
          <span className={styles.quietLine}>A trend line appears once this page has been opened on two different days.</span>
        )}
      </div>

      <p className={styles.about}>{def.about}</p>

      <button className={styles.linkButton} onClick={() => onUntrack(def.key)} type="button">
        Stop tracking
      </button>
    </article>
  );
}

export function ProjectTargetsView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [schedule, setSchedule] = useState<ScheduleControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [drafts, setDrafts] = useState<Partial<Record<MetricKey, string>>>({});
  const [blocked, setBlocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    Promise.allSettled([loadSources(projectId), getProjectSchedule(projectId)]).then(([loaded, plan]) => {
      if (cancelled) {
        return;
      }

      if (loaded.status === "fulfilled") {
        setSources(loaded.value.sources);
        setFailed(loaded.value.failed);
      }

      if (plan.status === "fulfilled") {
        setSchedule(plan.value);
      }

      const noSources = loaded.status === "rejected" || loaded.value.failed.length >= MODULES.length;

      setState(noSources && plan.status === "rejected" ? "error" : "ready");
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      return undefined;
    }

    const load = () => {
      setSettings(parseSettings(readStore(storageKey(projectId))));
      setHistory(parseHistory(readStore(historyKey(projectId))));
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === storageKey(projectId) || event.key === historyKey(projectId)) {
        load();
      }
    };

    load();
    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, [projectId]);

  const readings = useMemo(() => (state === "ready" ? readMetrics({ sources, failed, schedule }, today) : []), [state, sources, failed, schedule, today]);
  const values = useMemo(() => valuesOf(readings), [readings]);
  const rows = useMemo(() => rowsOf(readings, settings), [readings, settings]);
  const tracked = rows.filter((row) => row.setting.tracked);
  const untracked = rows.filter((row) => !row.setting.tracked);
  const counts = tally(rows);
  const span = historySpan(history);
  const projectName = (sources ? projectOf(sources)?.name : null) ?? schedule?.project?.name ?? "Project";

  useEffect(() => {
    if (!projectId || Object.keys(values).length === 0) {
      return;
    }

    const next = recordSnapshot(parseHistory(readStore(historyKey(projectId))), today, values);

    if (!writeStore(historyKey(projectId), serialiseHistory(next))) {
      setBlocked(true);
    }

    setHistory(next);
  }, [projectId, today, values]);

  function save(next: Settings) {
    if (!projectId) {
      return;
    }

    setSettings(next);
    setMessage(null);

    if (!writeStore(storageKey(projectId), serialiseSettings(next))) {
      setBlocked(true);
    }
  }

  function setTarget(def: MetricDef, target: number) {
    save({ ...settings, [def.key]: { ...settings[def.key], target } });
  }

  function onDraft(def: MetricDef, text: string) {
    setDrafts((current) => ({ ...current, [def.key]: text }));

    const parsed = parseDraft(def, text);

    if (parsed !== null) {
      setTarget(def, parsed);
    }
  }

  function onStep(def: MetricDef, direction: 1 | -1) {
    const draft = drafts[def.key];
    const current = (draft === undefined ? null : parseDraft(def, draft)) ?? settings[def.key].target;

    setDrafts((existing) => {
      const rest = { ...existing };

      delete rest[def.key];

      return rest;
    });
    setTarget(def, clampTarget(def, Math.round((current + direction * def.step) * 100) / 100));
  }

  function setTracked(key: MetricKey, on: boolean) {
    save({ ...settings, [key]: { ...settings[key], tracked: on } });
  }

  function resetTargets() {
    if (!projectId) {
      return;
    }

    setSettings(defaultSettings());
    setDrafts({});
    writeStore(storageKey(projectId), null);
    setMessage("Targets are back to their starting values.");
  }

  function clearHistory() {
    if (!projectId) {
      return;
    }

    writeStore(historyKey(projectId), null);

    const next = recordSnapshot([], today, values);

    if (Object.keys(values).length > 0 && !writeStore(historyKey(projectId), serialiseHistory(next))) {
      setBlocked(true);
    }

    setHistory(next);
    setMessage("Recorded history cleared. Today’s values were recorded again.");
  }

  async function copySummary() {
    const ok = await copyText(targetsMarkdown(rows, history, projectName, today));

    setMessage(ok ? "Copied the targets as Markdown." : "Could not copy the targets.");
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

            <div className="eyebrow">TARGETS</div>

            <h1>Are we hitting our targets?</h1>

            <p className={styles.subtitle}>
              Set a level you want to hold for each measure and see at a glance which ones are met, close or missed. Each day you open this page its values are recorded, so a trend line builds up over time.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/closure-speed`}>
              Closure speed
            </Link>

            <Link className="secondary-link-button" href={`${base}/progress-curve`}>
              Progress curve
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the project figures…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the project data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && (
          <>
            {blocked && (
              <div className="offline-banner">
                <div>
                  <strong>This browser is not letting the page save anything, so targets and history will be lost when you leave.</strong>
                </div>
              </div>
            )}

            {(failed.length > 0 || sources === null || schedule === null) && (
              <p className={styles.partialBanner} role="status">
                {sources === null ? "The open-item data could not be loaded. " : failed.length > 0 ? `Could not read ${failed.map((key) => MODULE_LABEL[key] ?? key).join(", ")}, so the measures built on it may be understated. ` : ""}
                {schedule === null ? "The schedule could not be loaded. " : ""}
                Affected measures are marked below and are left out of the history.
              </p>
            )}

            <section aria-label="Targets summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>MET</div>
                <div className={styles.kpiValue}>{counts.met}</div>
                <div className={styles.kpiSub}>of {tracked.length} tracked {plural(tracked.length, "measure", "measures")}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CLOSE</div>
                <div className={cx(styles.kpiValue, counts.near > 0 && styles.warn)}>{counts.near}</div>
                <div className={styles.kpiSub}>just outside the target</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MISSED</div>
                <div className={cx(styles.kpiValue, counts.missed > 0 && styles.neg)}>{counts.missed}</div>
                <div className={styles.kpiSub}>clearly outside the target</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO DATA</div>
                <div className={styles.kpiValue}>{counts.none}</div>
                <div className={styles.kpiSub}>cannot be measured yet</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.controlGroup}>
                <button className={styles.linkButton} onClick={resetTargets} type="button">
                  Reset targets
                </button>

                <button className={styles.linkButton} onClick={clearHistory} type="button">
                  Clear recorded history
                </button>
              </div>

              <button className={styles.linkButton} onClick={copySummary} type="button">
                Copy as Markdown
              </button>
            </section>

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            {tracked.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No measure is being tracked. Turn some back on below.</div>
              </section>
            ) : (
              <section aria-label="Targets" className={styles.cards}>
                {tracked.map((row) => (
                  <Card draft={drafts[row.def.key]} history={history} key={row.def.key} onDraft={onDraft} onStep={onStep} onUntrack={(key) => setTracked(key, false)} row={row} />
                ))}
              </section>
            )}

            {untracked.length > 0 && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">NOT TRACKED</div>
                    <h2>Measures you have switched off</h2>
                  </div>
                </header>

                <ul className={styles.offList}>
                  {untracked.map((row) => (
                    <li key={row.def.key}>
                      <span>
                        <strong>{row.def.label}</strong>
                        <small>{row.def.about}</small>
                      </span>

                      <button className={styles.moreButton} onClick={() => setTracked(row.def.key, true)} type="button">
                        Track
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">HISTORY</div>
                  <h2>Where the trend lines come from</h2>
                </div>

                <span className={styles.muted}>
                  {span.days} {plural(span.days, "day", "days")} recorded
                </span>
              </header>

              <p className={styles.quiet}>
                {span.days === 0
                  ? "Nothing has been recorded in this browser yet."
                  : `Values were recorded on ${span.days} ${plural(span.days, "day", "days")} between ${formatDay(span.from as number)} and ${formatDay(span.to as number)}. Days when this page was not opened are missing, so a line can jump between two points far apart in time.`}{" "}
                Up to {HISTORY_LIMIT} days are kept.
              </p>
            </section>

            <p className={styles.note}>
              Targets and history are stored only in this browser, for this project: they are not shared with your team and do not follow you to another device or browser. A measure is “close” when it is on the wrong side of its target by no more than a quarter of the target, with a small minimum margin for low targets. Closure figures cover the last 180 days. Measures that depend on data that could not be read are marked and are not recorded in the history.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
