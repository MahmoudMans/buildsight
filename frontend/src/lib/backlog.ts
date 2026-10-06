import { formatDay, plural, toDay, type ModuleKey, type Sources } from "@/lib/openItems";

export type StreamKey = "snags" | "ncrs" | "rfis" | "observations" | "safetyActions" | "actions";

export interface StreamInfo {
  key: StreamKey;
  label: string;
  module: ModuleKey;
  color: string;
}

export const STREAMS: ReadonlyArray<StreamInfo> = [
  { key: "snags", label: "Snags", module: "quality", color: "#d9823a" },
  { key: "ncrs", label: "Non-conformances", module: "quality", color: "#b5493e" },
  { key: "rfis", label: "RFIs", module: "documents", color: "#3b7fb0" },
  { key: "observations", label: "Safety observations", module: "safety", color: "#d1a13a" },
  { key: "safetyActions", label: "Safety actions", module: "safety", color: "#7b6cb8" },
  { key: "actions", label: "Meeting actions", module: "governance", color: "#3f8a68" },
];

export const SPANS: ReadonlyArray<{ weeks: number; label: string }> = [
  { weeks: 8, label: "8 weeks" },
  { weeks: 13, label: "3 months" },
  { weeks: 26, label: "6 months" },
];

export const DEFAULT_SPAN = 13;

interface Entry {
  raised: number;
  closed: number | null;
}

export interface Point {
  day: number;
  total: number;
  by: Record<StreamKey, number>;
}

export interface Flow {
  from: number;
  to: number;
  raised: number;
  closed: number;
}

export interface StreamRow {
  key: StreamKey;
  label: string;
  color: string;
  available: boolean;
  openNow: number;
  openThen: number;
  change: number;
  raised: number;
  closed: number;
  pace: number;
  weeksToClear: number | null;
  verdict: "shrinking" | "growing" | "steady" | "clear" | "none";
}

export interface Backlog {
  points: Point[];
  flows: Flow[];
  rows: StreamRow[];
  startDay: number;
  endDay: number;
  weeks: number;
  openNow: number;
  openThen: number;
  raised: number;
  closed: number;
  pace: number;
  weeksToClear: number | null;
  verdict: StreamRow["verdict"];
  estimated: number;
  skipped: number;
  peak: Point | null;
}

const EMPTY: Record<StreamKey, number> = { snags: 0, ncrs: 0, rfis: 0, observations: 0, safetyActions: 0, actions: 0 };

function empty(): Record<StreamKey, number> {
  return { ...EMPTY };
}

function firstValid(...days: number[]): number | null {
  for (const day of days) {
    if (Number.isFinite(day)) {
      return day;
    }
  }

  return null;
}

export function buildBacklog(sources: Sources, failed: string[], today: number, weeks: number): Backlog {
  const lost = new Set(failed);
  const entries = new Map<StreamKey, Entry[]>();
  const available = new Set<StreamKey>();
  let estimated = 0;
  let skipped = 0;

  function take(key: StreamKey, raised: number, closing: boolean, closedOn: number, fallback: number) {
    if (!Number.isFinite(raised)) {
      skipped += 1;

      return;
    }

    let closed: number | null = null;

    if (closing) {
      const known = firstValid(closedOn);

      if (known === null) {
        estimated += 1;
      }

      closed = firstValid(closedOn, fallback) ?? raised;
    }

    const list = entries.get(key) ?? [];

    list.push({ raised: Math.min(raised, today), closed: closed === null ? null : Math.min(Math.max(closed, raised), today) });
    entries.set(key, list);
  }

  if (sources.quality && !lost.has("quality")) {
    available.add("snags");
    available.add("ncrs");

    for (const item of sources.quality.punchItems ?? []) {
      take("snags", toDay(item.raisedDate), item.status === "CLOSED" || item.status === "VOID", toDay(item.closedDate), toDay(item.updatedAt));
    }

    for (const item of sources.quality.ncrs ?? []) {
      take("ncrs", toDay(item.raisedDate), item.status === "CLOSED" || item.status === "VOID", toDay(item.closedDate), toDay(item.updatedAt));
    }
  }

  if (sources.documents && !lost.has("documents")) {
    available.add("rfis");

    for (const item of sources.documents.rfis ?? []) {
      take("rfis", toDay(item.raisedDate), item.status !== "OPEN", toDay(item.respondedDate), toDay(item.updatedAt));
    }
  }

  if (sources.safety && !lost.has("safety")) {
    available.add("observations");
    available.add("safetyActions");

    for (const item of sources.safety.observations ?? []) {
      take("observations", toDay(item.observedDate), item.status === "CLOSED" || item.status === "VOID", toDay(item.closedDate), toDay(item.updatedAt));
    }

    for (const item of sources.safety.actions ?? []) {
      take("safetyActions", toDay(item.createdAt), item.status === "CLOSED" || item.status === "VOID", toDay(item.closedDate), toDay(item.updatedAt));
    }
  }

  if (sources.governance && !lost.has("governance")) {
    available.add("actions");

    for (const item of sources.governance.actions ?? []) {
      take("actions", toDay(item.createdAt), item.status === "DONE" || item.status === "VOID", toDay(item.completedAt), toDay(item.updatedAt));
    }
  }

  const span = Math.max(1, Math.round(weeks));
  const endDay = today;
  const startDay = today - span * 7;
  const points: Point[] = [];

  for (let step = 0; step <= span; step += 1) {
    const day = startDay + step * 7;
    const by = empty();

    for (const info of STREAMS) {
      let count = 0;

      for (const entry of entries.get(info.key) ?? []) {
        if (entry.raised <= day && (entry.closed === null || entry.closed > day)) {
          count += 1;
        }
      }

      by[info.key] = count;
    }

    points.push({ day, by, total: STREAMS.reduce((sum, info) => sum + by[info.key], 0) });
  }

  const flows: Flow[] = [];

  for (let step = 1; step <= span; step += 1) {
    const from = startDay + (step - 1) * 7;
    const to = startDay + step * 7;
    let raised = 0;
    let closed = 0;

    for (const list of entries.values()) {
      for (const entry of list) {
        if (entry.raised > from && entry.raised <= to) {
          raised += 1;
        }

        if (entry.closed !== null && entry.closed > from && entry.closed <= to) {
          closed += 1;
        }
      }
    }

    flows.push({ from, to, raised, closed });
  }

  const first = points[0] as Point;
  const last = points[points.length - 1] as Point;

  function verdictOf(open: number, pace: number, ever: number): StreamRow["verdict"] {
    if (ever === 0) {
      return "none";
    }

    if (open === 0) {
      return "clear";
    }

    if (pace > 0.05) {
      return "shrinking";
    }

    if (pace < -0.05) {
      return "growing";
    }

    return "steady";
  }

  const rows: StreamRow[] = STREAMS.map((info) => {
    const list = entries.get(info.key) ?? [];
    const raised = list.filter((entry) => entry.raised > startDay).length;
    const closed = list.filter((entry) => entry.closed !== null && entry.closed > startDay).length;
    const pace = (closed - raised) / span;
    const openNow = last.by[info.key];
    const ok = available.has(info.key);

    return {
      key: info.key,
      label: info.label,
      color: info.color,
      available: ok,
      openNow,
      openThen: first.by[info.key],
      change: openNow - first.by[info.key],
      raised,
      closed,
      pace,
      weeksToClear: pace > 0.05 && openNow > 0 ? openNow / pace : null,
      verdict: ok ? verdictOf(openNow, pace, list.length) : "none",
    };
  });

  const live = rows.filter((row) => row.available);
  const raised = live.reduce((sum, row) => sum + row.raised, 0);
  const closed = live.reduce((sum, row) => sum + row.closed, 0);
  const pace = (closed - raised) / span;
  const openNow = last.total;
  const everything = live.reduce((sum, row) => sum + (entries.get(row.key)?.length ?? 0), 0);

  let peak: Point | null = null;

  for (const point of points) {
    if (!peak || point.total > peak.total) {
      peak = point;
    }
  }

  return {
    points,
    flows,
    rows,
    startDay,
    endDay,
    weeks: span,
    openNow,
    openThen: first.total,
    raised,
    closed,
    pace,
    weeksToClear: pace > 0.05 && openNow > 0 ? openNow / pace : null,
    verdict: verdictOf(openNow, pace, everything),
    estimated,
    skipped,
    peak,
  };
}

export function clearText(weeks: number | null, verdict: StreamRow["verdict"]): string {
  if (verdict === "clear") {
    return "Nothing open";
  }

  if (verdict === "none") {
    return "No records";
  }

  if (weeks === null) {
    return verdict === "growing" ? "Growing" : "Not shrinking";
  }

  if (weeks < 1) {
    return "Under a week";
  }

  const rounded = Math.round(weeks);

  if (rounded > 104) {
    return "Over 2 years";
  }

  return `About ${rounded} ${plural(rounded, "week", "weeks")}`;
}

export function paceText(pace: number): string {
  return Math.abs(pace) < 0.05 ? "0.0" : `${pace > 0 ? "+" : "−"}${Math.abs(pace).toFixed(1)}`;
}

export function signed(value: number): string {
  return value > 0 ? `+${value}` : value < 0 ? `−${Math.abs(value)}` : "0";
}

export function backlogMarkdown(result: Backlog, projectName: string, today: number): string {
  const lines: string[] = [];
  const unit = result.weeks === 13 ? "3 months" : `${result.weeks} weeks`;

  lines.push(`# Backlog trend: ${projectName}`, "");
  lines.push(
    `As of ${formatDay(today)}. Open items across snags, non-conformances, RFIs, safety observations, safety actions and meeting actions, looking back ${unit}.`,
    "",
  );
  lines.push(
    `- Open now: ${result.openNow} (${signed(result.openNow - result.openThen)} over the period)`,
    `- Raised: ${result.raised}, closed: ${result.closed}`,
    `- Clearing at the current pace: ${clearText(result.weeksToClear, result.verdict)}`,
    "",
  );
  lines.push("| Stream | Open now | Change | Raised | Closed | Net per week | Clearing at this pace |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | --- |");

  for (const row of result.rows) {
    if (!row.available) {
      lines.push(`| ${row.label} | n/a | n/a | n/a | n/a | n/a | not loaded |`);
      continue;
    }

    lines.push(`| ${row.label} | ${row.openNow} | ${signed(row.change)} | ${row.raised} | ${row.closed} | ${paceText(row.pace)} | ${clearText(row.weeksToClear, row.verdict)} |`);
  }

  lines.push("", "Net per week is items closed minus items raised, so a positive figure means the backlog is shrinking.", "");

  if (result.estimated > 0) {
    lines.push(`${result.estimated} closed ${plural(result.estimated, "item has", "items have")} no closing date, so the last update date was used.`, "");
  }

  return lines.join("\n");
}
