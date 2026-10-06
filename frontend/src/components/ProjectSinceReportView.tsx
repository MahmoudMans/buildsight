"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { captureExecutiveReportSnapshot, getProjectGovernance } from "@/lib/api";
import type { ExecutiveReport, ExecutiveReportSnapshot } from "@/types/project";

import styles from "./ProjectSinceReportView.module.css";

const DAY_MS = 86_400_000;
const LINE_LIMIT = 8;
const TREND_LIMIT = 12;

type Direction = "up" | "down" | "none";
type Verdict = "better" | "worse" | "same" | "moved" | "unknown";

interface Reading {
  key: string;
  day: number;
  created: number;
  progress: number;
  schedule: number;
  predictive: number;
  governance: number;
  cpi: number;
  spi: number;
  forecastCost: number;
  finishDay: number;
  openActions: number;
  overdueActions: number;
  blockedActions: number;
  pendingDecisions: number;
  overdueDecisions: number;
  noMinutes: number;
  scheduleRisk: string;
  predictiveRisk: string;
  governanceRisk: string;
  summary: string;
  attention: AttentionLine[];
}

interface AttentionLine {
  text: string;
  keys: string[];
}

interface Measure {
  key: string;
  group: string;
  label: string;
  direction: Direction;
  eps: number;
  relative?: boolean;
  get: (reading: Reading) => number;
  show: (value: number) => string;
  change: (diff: number) => string;
}

interface Row {
  measure: Measure;
  then: number;
  now: number;
  diff: number;
  verdict: Verdict;
}

const RISK_RANK: Record<string, number> = { ON_TRACK: 0, WATCH: 1, AT_RISK: 2 };
const RISK_LABEL: Record<string, string> = { ON_TRACK: "On track", WATCH: "Watch", AT_RISK: "At risk" };

const VERDICT_LABEL: Record<Verdict, string> = {
  better: "Better",
  worse: "Worse",
  same: "Unchanged",
  moved: "Changed",
  unknown: "No data",
};

const GOOD = "#2f6f55";
const BAD = "#b5493e";
const NEUTRAL = "#7a847f";
const LINE = "#50605a";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function toDay(value: string | null | undefined): number {
  if (!value) {
    return NaN;
  }

  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS);
}

function formatDay(day: number): string {
  if (!Number.isFinite(day)) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(day * DAY_MS));
}

function num(value: number, digits = 0): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function signed(value: number, digits = 0): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const rounded = Number(Math.abs(value).toFixed(digits));

  if (rounded === 0) {
    return num(0, digits);
  }

  return `${value > 0 ? "+" : "−"}${num(rounded, digits)}`;
}

function money(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function signedMoney(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (Math.abs(value) < 1) {
    return money(0);
  }

  return `${value > 0 ? "+" : "−"}${money(Math.abs(value))}`;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function trunc(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : NaN;
}

function riskLabel(value: string): string {
  if (!value) {
    return "—";
  }

  const known = RISK_LABEL[value];

  if (known) {
    return known;
  }

  const text = value.replace(/_/g, " ").toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function riskClass(value: string): string | undefined {
  const rank = RISK_RANK[value];

  if (rank === undefined) {
    return styles.riskNone;
  }

  return rank === 0 ? styles.riskGood : rank === 1 ? styles.riskWatch : styles.riskBad;
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function textMatches(a: string, b: string): boolean {
  const x = normalise(a);
  const y = normalise(b);

  if (!x || !y) {
    return false;
  }

  if (x === y) {
    return true;
  }

  const short = x.length <= y.length ? x : y;
  const long = x.length <= y.length ? y : x;

  if (short.length >= 12 && long.includes(short)) {
    return true;
  }

  return short.length >= 6 && /\d/.test(short) && long.includes(short);
}

function lineMatches(line: AttentionLine, others: ReadonlyArray<AttentionLine>): boolean {
  return others.some((other) => line.keys.some((a) => other.keys.some((b) => textMatches(a, b))));
}

function parseAttention(raw: string | null | undefined): AttentionLine[] {
  if (!raw || !raw.trim()) {
    return [];
  }

  const text = raw.trim();
  const lines: AttentionLine[] = [];

  if (text.startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(text);

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (typeof item === "string") {
            lines.push({ text: item, keys: [item] });
          } else if (item && typeof item === "object") {
            const record = item as Record<string, unknown>;
            const title = typeof record.title === "string" ? record.title : "";
            const reference = typeof record.reference === "string" ? record.reference : "";
            const shown = title || reference;

            if (shown) {
              lines.push({ text: shown, keys: [title, reference, `${reference} ${title}`].filter(Boolean) });
            }
          }
        }

        return lines;
      }
    } catch {
      // Not JSON after all, so fall through to plain text.
    }
  }

  let parts = text.split(/\r?\n/);

  if (parts.length === 1 && text.includes("; ")) {
    parts = text.split("; ");
  }

  for (const part of parts) {
    const cleaned = part.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim();

    if (cleaned) {
      lines.push({ text: cleaned, keys: [cleaned] });
    }
  }

  return lines;
}

function fromReport(report: ExecutiveReport | null | undefined): Reading | null {
  if (!report || typeof report.reportDate !== "string") {
    return null;
  }

  const day = toDay(report.reportDate);

  if (!Number.isFinite(day)) {
    return null;
  }

  const items = Array.isArray(report.attentionItems) ? report.attentionItems : [];

  return {
    key: "now",
    day,
    created: Infinity,
    progress: finite(report.physicalProgressPercentage),
    schedule: finite(report.scheduleScore),
    predictive: finite(report.predictiveScore),
    governance: finite(report.governanceScore),
    cpi: finite(report.cpi),
    spi: finite(report.spi),
    forecastCost: finite(report.expectedForecastCost),
    finishDay: toDay(report.expectedForecastFinishDate),
    openActions: finite(report.openActions),
    overdueActions: finite(report.overdueActions),
    blockedActions: finite(report.blockedActions),
    pendingDecisions: finite(report.pendingDecisions),
    overdueDecisions: finite(report.overdueDecisions),
    noMinutes: finite(report.meetingsWithoutMinutes),
    scheduleRisk: report.scheduleRisk ?? "",
    predictiveRisk: report.predictiveRisk ?? "",
    governanceRisk: report.governanceRisk ?? "",
    summary: report.executiveSummary ?? "",
    attention: items.map((item) => ({
      text: item.title,
      keys: [item.title, item.reference, `${item.reference} ${item.title}`].filter(Boolean),
    })),
  };
}

function fromSnapshot(snapshot: ExecutiveReportSnapshot): Reading | null {
  const day = Number.isFinite(toDay(snapshot.reportDate)) ? toDay(snapshot.reportDate) : toDay(snapshot.createdAt);

  if (!Number.isFinite(day)) {
    return null;
  }

  const created = Date.parse(snapshot.createdAt);

  return {
    key: snapshot.id,
    day,
    created: Number.isFinite(created) ? created : 0,
    progress: finite(snapshot.physicalProgressPercentage),
    schedule: finite(snapshot.scheduleScore),
    predictive: finite(snapshot.predictiveScore),
    governance: finite(snapshot.governanceScore),
    cpi: finite(snapshot.cpi),
    spi: finite(snapshot.spi),
    forecastCost: finite(snapshot.expectedForecastCost),
    finishDay: toDay(snapshot.expectedForecastFinishDate),
    openActions: finite(snapshot.openActions),
    overdueActions: finite(snapshot.overdueActions),
    blockedActions: finite(snapshot.blockedActions),
    pendingDecisions: finite(snapshot.pendingDecisions),
    overdueDecisions: finite(snapshot.overdueDecisions),
    noMinutes: finite(snapshot.meetingsWithoutMinutes),
    scheduleRisk: snapshot.scheduleRisk ?? "",
    predictiveRisk: snapshot.predictiveRisk ?? "",
    governanceRisk: snapshot.governanceRisk ?? "",
    summary: snapshot.executiveSummary ?? "",
    attention: parseAttention(snapshot.attentionItems).map((line) => ({ ...line, text: trunc(line.text, 160) })),
  };
}

const PROGRESS = "Progress and schedule";
const COST = "Cost";
const GOVERNANCE = "Governance";

const MEASURES: Measure[] = [
  {
    key: "progress",
    group: PROGRESS,
    label: "Physical progress",
    direction: "up",
    eps: 0.05,
    get: (r) => r.progress,
    show: (v) => `${num(v, 1)}%`,
    change: (d) => `${signed(d, 1)} pts`,
  },
  {
    key: "schedule",
    group: PROGRESS,
    label: "Schedule score",
    direction: "up",
    eps: 0.5,
    get: (r) => r.schedule,
    show: (v) => num(v),
    change: (d) => signed(d),
  },
  {
    key: "predictive",
    group: PROGRESS,
    label: "Predictive score",
    direction: "up",
    eps: 0.5,
    get: (r) => r.predictive,
    show: (v) => num(v),
    change: (d) => signed(d),
  },
  {
    key: "spi",
    group: PROGRESS,
    label: "SPI",
    direction: "up",
    eps: 0.005,
    get: (r) => r.spi,
    show: (v) => num(v, 2),
    change: (d) => signed(d, 2),
  },
  {
    key: "finish",
    group: PROGRESS,
    label: "Forecast finish",
    direction: "down",
    eps: 0.5,
    get: (r) => r.finishDay,
    show: (v) => formatDay(v),
    change: (d) => `${signed(d)} d`,
  },
  {
    key: "cpi",
    group: COST,
    label: "CPI",
    direction: "up",
    eps: 0.005,
    get: (r) => r.cpi,
    show: (v) => num(v, 2),
    change: (d) => signed(d, 2),
  },
  {
    key: "cost",
    group: COST,
    label: "Forecast cost",
    direction: "down",
    eps: 0.0005,
    relative: true,
    get: (r) => r.forecastCost,
    show: (v) => money(v),
    change: (d) => signedMoney(d),
  },
  {
    key: "governance",
    group: GOVERNANCE,
    label: "Governance score",
    direction: "up",
    eps: 0.5,
    get: (r) => r.governance,
    show: (v) => num(v),
    change: (d) => signed(d),
  },
  {
    key: "open",
    group: GOVERNANCE,
    label: "Open actions",
    direction: "none",
    eps: 0.5,
    get: (r) => r.openActions,
    show: (v) => num(v),
    change: (d) => signed(d),
  },
  {
    key: "overdue",
    group: GOVERNANCE,
    label: "Overdue actions",
    direction: "down",
    eps: 0.5,
    get: (r) => r.overdueActions,
    show: (v) => num(v),
    change: (d) => signed(d),
  },
  {
    key: "blocked",
    group: GOVERNANCE,
    label: "Blocked actions",
    direction: "down",
    eps: 0.5,
    get: (r) => r.blockedActions,
    show: (v) => num(v),
    change: (d) => signed(d),
  },
  {
    key: "pending",
    group: GOVERNANCE,
    label: "Decisions waiting",
    direction: "none",
    eps: 0.5,
    get: (r) => r.pendingDecisions,
    show: (v) => num(v),
    change: (d) => signed(d),
  },
  {
    key: "overdueDecisions",
    group: GOVERNANCE,
    label: "Overdue decisions",
    direction: "down",
    eps: 0.5,
    get: (r) => r.overdueDecisions,
    show: (v) => num(v),
    change: (d) => signed(d),
  },
  {
    key: "minutes",
    group: GOVERNANCE,
    label: "Meetings without minutes",
    direction: "down",
    eps: 0.5,
    get: (r) => r.noMinutes,
    show: (v) => num(v),
    change: (d) => signed(d),
  },
];

const GROUPS = [PROGRESS, COST, GOVERNANCE];

const TREND_KEYS = ["progress", "schedule", "predictive", "governance", "cpi", "spi", "cost", "overdue"];

function judge(measure: Measure, then: number, now: number): Verdict {
  if (!Number.isFinite(then) || !Number.isFinite(now)) {
    return "unknown";
  }

  const diff = now - then;
  const limit = measure.relative ? measure.eps * Math.max(Math.abs(then), Math.abs(now), 1) : measure.eps;

  if (Math.abs(diff) < limit) {
    return "same";
  }

  if (measure.direction === "none") {
    return "moved";
  }

  const improved = measure.direction === "up" ? diff > 0 : diff < 0;

  return improved ? "better" : "worse";
}

function verdictClass(verdict: Verdict): string | undefined {
  switch (verdict) {
    case "better":
      return styles.riskGood;
    case "worse":
      return styles.riskBad;
    default:
      return styles.verdictFlat;
  }
}

function verdictColor(verdict: Verdict): string {
  return verdict === "better" ? GOOD : verdict === "worse" ? BAD : NEUTRAL;
}

interface TrendPoint {
  key: string;
  day: number;
  value: number;
}

function Spark({ label, points, baseKey, color }: { label: string; points: TrendPoint[]; baseKey: string; color: string }) {
  const width = 200;
  const height = 56;
  const pad = 7;

  const days = points.map((point) => point.day);
  const values = points.map((point) => point.value);
  const minDay = Math.min(...days);
  const maxDay = Math.max(...days);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  const x = (point: TrendPoint, index: number): number => {
    if (maxDay === minDay) {
      return pad + (index / Math.max(1, points.length - 1)) * (width - pad * 2);
    }

    return pad + ((point.day - minDay) / (maxDay - minDay)) * (width - pad * 2);
  };

  const y = (value: number): number => {
    if (maxValue === minValue) {
      return height / 2;
    }

    return height - pad - ((value - minValue) / (maxValue - minValue)) * (height - pad * 2);
  };

  const path = points.map((point, index) => `${index === 0 ? "M" : "L"}${x(point, index).toFixed(1)} ${y(point.value).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const lastIndex = points.length - 1;

  return (
    <svg
      aria-label={`${label} across ${points.length} reports`}
      className={styles.sparkSvg}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${width} ${height}`}
    >
      <path d={path} fill="none" stroke={LINE} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />

      {points.map((point, index) =>
        point.key === baseKey ? (
          <circle cx={x(point, index)} cy={y(point.value)} fill="#ffffff" key={point.key} r="4" stroke={LINE} strokeWidth="1.6" />
        ) : null,
      )}

      {last && <circle cx={x(last, lastIndex)} cy={y(last.value)} fill={color} r="3.6" />}
    </svg>
  );
}

export function ProjectSinceReportView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [report, setReport] = useState<ExecutiveReport | null>(null);
  const [history, setHistory] = useState<ExecutiveReportSnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [baselineKey, setBaselineKey] = useState<string | null>(null);
  const [changesOnly, setChangesOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectGovernance(projectId)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setReport(result.executiveReport ?? null);
        setHistory(Array.isArray(result.reportHistory) ? result.reportHistory : []);
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        setFailed(true);
        setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  async function saveSnapshot() {
    if (!projectId || saving) {
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      const saved = await captureExecutiveReportSnapshot(projectId);

      setHistory((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setMessage("Snapshot saved. It is now one of the reports you can compare with.");
    } catch (error) {
      setMessage(error instanceof Error ? `Could not save a snapshot: ${error.message}` : "Could not save a snapshot.");
    } finally {
      setSaving(false);
    }
  }

  const now = useMemo(() => fromReport(report), [report]);

  const snapshots = useMemo(() => {
    const readings: Reading[] = [];

    for (const snapshot of history) {
      const reading = fromSnapshot(snapshot);

      if (reading) {
        readings.push(reading);
      }
    }

    return readings.sort((a, b) => b.day - a.day || b.created - a.created);
  }, [history]);

  const baseline = snapshots.find((item) => item.key === baselineKey) ?? snapshots[0] ?? null;

  const rows = useMemo<Row[]>(() => {
    if (!now || !baseline) {
      return [];
    }

    return MEASURES.map((measure) => {
      const then = measure.get(baseline);
      const current = measure.get(now);

      return {
        measure,
        then,
        now: current,
        diff: current - then,
        verdict: judge(measure, then, current),
      };
    });
  }, [now, baseline]);

  const counts = useMemo(() => {
    const result = { better: [] as string[], worse: [] as string[], same: 0, moved: 0 };

    for (const row of rows) {
      if (row.verdict === "better") {
        result.better.push(row.measure.label);
      } else if (row.verdict === "worse") {
        result.worse.push(row.measure.label);
      } else if (row.verdict === "same") {
        result.same += 1;
      } else if (row.verdict === "moved") {
        result.moved += 1;
      }
    }

    return result;
  }, [rows]);

  const bands = useMemo(() => {
    if (!now || !baseline) {
      return [];
    }

    return [
      { label: "Schedule risk", then: baseline.scheduleRisk, now: now.scheduleRisk },
      { label: "Predictive risk", then: baseline.predictiveRisk, now: now.predictiveRisk },
      { label: "Governance risk", then: baseline.governanceRisk, now: now.governanceRisk },
    ].map((band) => {
      const before = RISK_RANK[band.then];
      const after = RISK_RANK[band.now];
      const verdict: Verdict =
        before === undefined || after === undefined ? (band.then === band.now ? "same" : "unknown") : after < before ? "better" : after > before ? "worse" : "same";

      return { ...band, verdict };
    });
  }, [now, baseline]);

  const bandsChanged = bands.filter((band) => band.then !== band.now).length;

  const trends = useMemo(() => {
    if (!now || !baseline) {
      return [];
    }

    const ordered = [...snapshots].sort((a, b) => a.day - b.day || a.created - b.created);
    const kept = ordered.slice(-TREND_LIMIT);

    if (baseline && !kept.some((item) => item.key === baseline.key)) {
      kept.unshift(baseline);
    }

    const all = [...kept, now];

    return TREND_KEYS.map((key) => {
      const measure = MEASURES.find((item) => item.key === key) as Measure;
      const points: TrendPoint[] = all
        .map((reading) => ({ key: reading.key, day: reading.day, value: measure.get(reading) }))
        .filter((point) => Number.isFinite(point.value));
      const row = rows.find((item) => item.measure.key === key);

      return { measure, points, row };
    });
  }, [now, baseline, snapshots, rows]);

  const visibleRows = changesOnly ? rows.filter((row) => row.verdict !== "same") : rows;
  const failedLoad = loaded && failed;
  const canCompare = loaded && !failed && now !== null && baseline !== null;
  const daysSince = now && baseline ? Math.max(0, now.day - baseline.day) : 0;
  const costRow = rows.find((row) => row.measure.key === "cost");
  const finishRow = rows.find((row) => row.measure.key === "finish");

  const saveButton = (
    <button className={styles.linkButton} disabled={saving} onClick={saveSnapshot} type="button">
      {saving ? "Saving…" : "Save a snapshot now"}
    </button>
  );

  function listFor(lines: AttentionLine[], others: AttentionLine[], mode: "then" | "now") {
    if (lines.length === 0) {
      return <p className={styles.muted}>No attention items were recorded in this report.</p>;
    }

    return (
      <>
        <ul className={styles.lines}>
          {lines.slice(0, LINE_LIMIT).map((line, index) => {
            const stillThere = lineMatches(line, others);
            const tag = stillThere ? "Still there" : mode === "now" ? "New" : "Cleared";
            const tagClass = stillThere ? styles.tagSame : mode === "now" ? styles.tagNew : styles.tagGone;

            return (
              <li className={styles.line} key={`${line.text}-${index}`}>
                <span className={cx(styles.tag, tagClass)}>{tag}</span>
                <span>{line.text}</span>
              </li>
            );
          })}
        </ul>

        {lines.length > LINE_LIMIT && <p className={styles.hint}>+{lines.length - LINE_LIMIT} more not shown.</p>}
      </>
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

            <div className="eyebrow">SINCE LAST REPORT</div>

            <h1>What has changed since the last report</h1>

            <p className={styles.subtitle}>
              The live executive report set against a saved snapshot: which measures improved, which slipped, and whether the problems
              the report raised are still there.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/governance`}>
            Open governance control
          </Link>
        </header>

        {!loaded && <div className={styles.loading}>Loading the executive report…</div>}

        {failedLoad && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the executive report. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {loaded && !failed && snapshots.length === 0 && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>
              No executive report has been saved for this project yet, so there is nothing to compare the live report with. Save a
              snapshot now and every later visit will show what has moved since.
            </div>

            <div className={styles.emptyAction}>
              {saveButton}
              {message && (
                <span className={styles.headNote} role="status">
                  {message}
                </span>
              )}
            </div>
          </section>
        )}

        {loaded && !failed && snapshots.length > 0 && !now && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>
              The live executive report is not available, so there is nothing to set the saved reports against.
            </div>
          </section>
        )}

        {canCompare && now && baseline && (
          <>
            <section aria-label="Change since the saved report" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>SINCE THE REPORT</div>
                <div className={styles.kpiValue}>
                  {daysSince} {plural(daysSince, "day", "days")}
                </div>
                <div className={styles.kpiSub}>Saved report of {formatDay(baseline.day)}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>BETTER</div>
                <div className={cx(styles.kpiValue, counts.better.length > 0 && styles.pos)}>{counts.better.length}</div>
                <div className={styles.kpiSub}>
                  {counts.better.length > 0 ? trunc(counts.better.slice(0, 2).join(", "), 44) : "nothing has improved"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WORSE</div>
                <div className={cx(styles.kpiValue, counts.worse.length > 0 && styles.neg)}>{counts.worse.length}</div>
                <div className={styles.kpiSub}>
                  {counts.worse.length > 0 ? trunc(counts.worse.slice(0, 2).join(", "), 44) : "nothing has slipped"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST COST</div>
                <div className={cx(styles.kpiValue, costRow?.verdict === "worse" && styles.neg, costRow?.verdict === "better" && styles.pos)}>
                  {signedMoney(costRow ? costRow.diff : NaN)}
                </div>
                <div className={styles.kpiSub}>now {money(now.forecastCost)}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST FINISH</div>
                <div className={cx(styles.kpiValue, finishRow?.verdict === "worse" && styles.neg, finishRow?.verdict === "better" && styles.pos)}>
                  {finishRow && Number.isFinite(finishRow.diff) ? `${signed(finishRow.diff)} d` : "—"}
                </div>
                <div className={styles.kpiSub}>now {formatDay(now.finishDay)}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>RISK BANDS CHANGED</div>
                <div className={styles.kpiValue}>{bandsChanged}</div>
                <div className={styles.kpiSub}>of {bands.length} bands</div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">MEASURES</div>
                  <h2>What moved</h2>
                </div>

                <div className={styles.controls}>
                  <select
                    aria-label="Report to compare with"
                    className={styles.select}
                    onChange={(event) => setBaselineKey(event.target.value)}
                    value={baseline.key}
                  >
                    {snapshots.map((item, index) => (
                      <option key={item.key} value={item.key}>
                        {formatDay(item.day)} · {Number.isFinite(item.progress) ? `${num(item.progress, 0)}% complete` : "no progress"}
                        {index === 0 ? " (latest)" : ""}
                      </option>
                    ))}
                  </select>

                  <div aria-label="Which measures to show" className={styles.segmented} role="group">
                    <button
                      aria-pressed={!changesOnly}
                      className={cx(styles.segment, !changesOnly && styles.segmentOn)}
                      onClick={() => setChangesOnly(false)}
                      type="button"
                    >
                      All {rows.length}
                    </button>

                    <button
                      aria-pressed={changesOnly}
                      className={cx(styles.segment, changesOnly && styles.segmentOn)}
                      onClick={() => setChangesOnly(true)}
                      type="button"
                    >
                      Changes only {rows.length - counts.same}
                    </button>
                  </div>

                  {saveButton}
                </div>
              </header>

              {message && (
                <p className={styles.statusLine} role="status">
                  {message}
                </p>
              )}

              {visibleRows.length === 0 ? (
                <div className={styles.emptySmall}>Nothing has changed since this report.</div>
              ) : (
                <>
                  <div className={styles.tableWrap}>
                    <table className={cx(styles.table, styles.compact, styles.sinceTable)}>
                      <thead>
                        <tr>
                          <th>MEASURE</th>
                          <th className={styles.num}>THEN</th>
                          <th className={styles.num}>NOW</th>
                          <th className={styles.num}>CHANGE</th>
                          <th>VERDICT</th>
                        </tr>
                      </thead>

                      <tbody>
                        {GROUPS.map((group) => {
                          const groupRows = visibleRows.filter((row) => row.measure.group === group);

                          if (groupRows.length === 0) {
                            return null;
                          }

                          return [
                            <tr className={styles.groupRow} key={`${group}-head`}>
                              <td colSpan={5}>{group.toUpperCase()}</td>
                            </tr>,
                            ...groupRows.map((row) => (
                              <tr key={row.measure.key}>
                                <td>
                                  <strong>{row.measure.label}</strong>
                                </td>
                                <td className={styles.num}>{Number.isFinite(row.then) ? row.measure.show(row.then) : "—"}</td>
                                <td className={styles.num}>{Number.isFinite(row.now) ? row.measure.show(row.now) : "—"}</td>
                                <td
                                  className={cx(
                                    styles.num,
                                    row.verdict === "better" && styles.pos,
                                    row.verdict === "worse" && styles.neg,
                                    row.verdict === "same" && styles.muted,
                                  )}
                                >
                                  {row.verdict === "same" || row.verdict === "unknown" ? "—" : row.measure.change(row.diff)}
                                </td>
                                <td>
                                  <span className={cx(styles.pill, verdictClass(row.verdict))}>{VERDICT_LABEL[row.verdict]}</span>
                                </td>
                              </tr>
                            )),
                          ];
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">RISK BANDS</div>
                  <h2>Did any band change?</h2>
                </div>
              </header>

              <div className={styles.bands}>
                {bands.map((band) => (
                  <article className={styles.band} key={band.label}>
                    <div className={styles.bandLabel}>{band.label.toUpperCase()}</div>

                    <div className={styles.bandFlow}>
                      <span className={cx(styles.pill, riskClass(band.then))}>{riskLabel(band.then)}</span>
                      <span aria-hidden="true" className={styles.arrow}>
                        →
                      </span>
                      <span className={cx(styles.pill, riskClass(band.now))}>{riskLabel(band.now)}</span>
                    </div>

                    <div
                      className={cx(
                        styles.bandVerdict,
                        band.verdict === "better" && styles.pos,
                        band.verdict === "worse" && styles.neg,
                        (band.verdict === "same" || band.verdict === "unknown") && styles.muted,
                      )}
                    >
                      {band.verdict === "better"
                        ? "Improved"
                        : band.verdict === "worse"
                          ? "Got worse"
                          : band.then === band.now
                            ? "No change"
                            : "Changed"}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">TREND</div>
                  <h2>Across every saved report</h2>
                </div>

                <p className={styles.headNote}>
                  {Math.min(snapshots.length, TREND_LIMIT)} saved {plural(Math.min(snapshots.length, TREND_LIMIT), "report", "reports")} and
                  the live one. The ringed dot is the report you compare with.
                </p>
              </header>

              <div className={styles.sparks}>
                {trends.map(({ measure, points, row }) => (
                  <article className={styles.spark} key={measure.key}>
                    <div className={styles.sparkTop}>
                      <span className={styles.sparkLabel}>{measure.label}</span>
                      <span className={styles.sparkValue}>{Number.isFinite(measure.get(now)) ? measure.show(measure.get(now)) : "—"}</span>
                    </div>

                    {points.length >= 2 ? (
                      <Spark
                        baseKey={baseline.key}
                        color={verdictColor(row?.verdict ?? "same")}
                        label={measure.label}
                        points={points}
                      />
                    ) : (
                      <div className={styles.sparkEmpty}>Not enough reports to draw a trend.</div>
                    )}

                    <div
                      className={cx(
                        styles.sparkDelta,
                        row?.verdict === "better" && styles.pos,
                        row?.verdict === "worse" && styles.neg,
                        (!row || row.verdict === "same" || row.verdict === "unknown") && styles.sparkFlat,
                      )}
                    >
                      {row && row.verdict !== "same" && row.verdict !== "unknown"
                        ? `${measure.change(row.diff)} since ${formatDay(baseline.day)}`
                        : `No change since ${formatDay(baseline.day)}`}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">THEN</div>
                    <h2>Report of {formatDay(baseline.day)}</h2>
                  </div>
                </header>

                {baseline.summary ? <p className={styles.reportText}>{baseline.summary}</p> : <p className={styles.muted}>No summary text was saved.</p>}

                <h3 className={styles.subhead}>Needed attention then</h3>
                {listFor(baseline.attention, now.attention, "then")}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">NOW</div>
                    <h2>Live report of {formatDay(now.day)}</h2>
                  </div>
                </header>

                {now.summary ? <p className={styles.reportText}>{now.summary}</p> : <p className={styles.muted}>The live report has no summary text.</p>}

                <h3 className={styles.subhead}>Needs attention now</h3>
                {listFor(now.attention, baseline.attention, "now")}
              </section>
            </div>

            <p className={styles.note}>
              Each measure is compared with the saved report you choose. Scores, progress, CPI and SPI count as better when they go up;
              forecast cost, forecast finish, overdue and blocked actions, overdue decisions and meetings without minutes count as better
              when they go down. Open actions and decisions waiting are shown without a verdict. Differences smaller than half a point,
              0.005 on CPI and SPI, or 0.05% on forecast cost count as unchanged. Attention items are matched by their wording, so an item
              that has been reworded shows as cleared and new.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
