import { formatDay, plural, toDay, words, type ModuleKey, type Sources } from "@/lib/openItems";

export type DimensionKey = "ncrCategory" | "ncrCause" | "snagTrade" | "inspectionFails" | "incidentType" | "hazard" | "delayCause" | "changeOriginator";

export type Area = "Quality" | "Safety" | "Delivery";

export interface Measure {
  key: string;
  label: string;
  unit: string;
  hint: string;
}

export interface Dimension {
  key: DimensionKey;
  area: Area;
  label: string;
  title: string;
  module: ModuleKey;
  measures: ReadonlyArray<Measure>;
  openFilter: boolean;
  noun: string;
}

const COUNT: Measure = { key: "count", label: "Number of records", unit: "records", hint: "Every record counts once." };

export const DIMENSIONS: ReadonlyArray<Dimension> = [
  {
    key: "ncrCategory",
    area: "Quality",
    label: "NCR categories",
    title: "Non-conformances by category",
    module: "quality",
    measures: [COUNT, { key: "severity", label: "Weighted by severity", unit: "points", hint: "Minor counts 1, major 3 and critical 5." }],
    openFilter: true,
    noun: "non-conformances",
  },
  {
    key: "ncrCause",
    area: "Quality",
    label: "NCR root causes",
    title: "Non-conformances by root cause",
    module: "quality",
    measures: [COUNT],
    openFilter: true,
    noun: "non-conformances",
  },
  {
    key: "snagTrade",
    area: "Quality",
    label: "Snags by trade",
    title: "Snags by trade",
    module: "quality",
    measures: [COUNT, { key: "late", label: "Days overdue", unit: "days", hint: "Days past the due date for open snags that are late." }],
    openFilter: true,
    noun: "snags",
  },
  {
    key: "inspectionFails",
    area: "Quality",
    label: "Failed inspections",
    title: "Failed inspections by discipline",
    module: "quality",
    measures: [COUNT],
    openFilter: false,
    noun: "failed inspections",
  },
  {
    key: "incidentType",
    area: "Safety",
    label: "Incident types",
    title: "Incidents by type",
    module: "safety",
    measures: [COUNT, { key: "lost", label: "Lost-time days", unit: "days", hint: "Working days lost to injury." }],
    openFilter: true,
    noun: "incidents",
  },
  {
    key: "hazard",
    area: "Safety",
    label: "Unsafe hazards",
    title: "Unsafe acts and conditions by hazard",
    module: "safety",
    measures: [COUNT, { key: "severity", label: "Weighted by severity", unit: "points", hint: "Low counts 1, medium 2, high 4 and critical 8." }],
    openFilter: true,
    noun: "unsafe observations",
  },
  {
    key: "delayCause",
    area: "Delivery",
    label: "Delay causes",
    title: "Delay events by cause",
    module: "risk",
    measures: [
      { key: "days", label: "Forecast delay days", unit: "days", hint: "The delay each event is expected to cause." },
      { key: "count", label: "Number of records", unit: "records", hint: "Every record counts once." },
    ],
    openFilter: true,
    noun: "delay events",
  },
  {
    key: "changeOriginator",
    area: "Delivery",
    label: "Change originators",
    title: "Change requests by originator",
    module: "risk",
    measures: [
      { key: "cost", label: "Cost increase", unit: "cost", hint: "Cost impact of requests that add cost. Savings are left out." },
      { key: "count", label: "Number of records", unit: "records", hint: "Every record counts once." },
      { key: "days", label: "Schedule days added", unit: "days", hint: "Schedule impact of requests that add time." },
    ],
    openFilter: true,
    noun: "change requests",
  },
];

export const AREAS: ReadonlyArray<Area> = ["Quality", "Safety", "Delivery"];

export const WINDOWS: ReadonlyArray<{ days: number | null; label: string }> = [
  { days: null, label: "All time" },
  { days: 365, label: "12 months" },
  { days: 180, label: "6 months" },
  { days: 90, label: "90 days" },
  { days: 30, label: "30 days" },
];

export const TOP_BARS = 10;
export const VITAL_SHARE = 0.8;
export const RECORD_LIMIT = 8;

export interface Rec {
  id: string;
  reference: string;
  title: string;
  meta: string;
  day: number;
  value: number;
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  count: number;
  share: number;
  cumulative: number;
  vital: boolean;
  merged: number;
  unknown: boolean;
  records: Rec[];
}

export interface Pareto {
  dimension: Dimension;
  measure: Measure;
  bars: Bar[];
  total: number;
  records: number;
  vitalBars: number;
  vitalShare: number;
  categories: number;
  concentrated: boolean;
  available: boolean;
}

interface Raw {
  bucket: string;
  rec: Rec;
  values: Record<string, number>;
  open: boolean;
}

const UNKNOWN = new Set(["not recorded", "no trade"]);

const SEVERITY_NCR: Record<string, number> = { MINOR: 1, MAJOR: 3, CRITICAL: 5 };
const SEVERITY_SAFETY: Record<string, number> = { LOW: 1, MEDIUM: 2, HIGH: 4, CRITICAL: 8 };

function grouped(value: number): string {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function squash(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

function tidy(value: string): string {
  return words(value).replace(/\b(ppe|hse|mep)\b/gi, (match) => match.toUpperCase());
}

function sentence(text: string): string {
  const clean = squash(text).replace(/[\s.;,:-]+$/, "");

  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function gatherRaw(sources: Sources, failed: string[], key: DimensionKey, today: number): Raw[] | null {
  const lost = new Set(failed);
  const out: Raw[] = [];
  const dimension = DIMENSIONS.find((item) => item.key === key);

  if (!dimension || lost.has(dimension.module)) {
    return null;
  }

  if (key === "ncrCategory" || key === "ncrCause") {
    if (!sources.quality) {
      return null;
    }

    for (const ncr of sources.quality.ncrs ?? []) {
      if (ncr.status === "VOID") {
        continue;
      }

      const cause = ncr.rootCause ? sentence(ncr.rootCause) : "";

      out.push({
        bucket: key === "ncrCategory" ? tidy(ncr.category) : cause || "Not recorded",
        rec: {
          id: ncr.id,
          reference: ncr.reference,
          title: ncr.title,
          meta: `${tidy(ncr.category)} · ${words(ncr.severity)} · ${words(ncr.status)}`,
          day: toDay(ncr.raisedDate),
          value: 1,
        },
        values: { count: 1, severity: SEVERITY_NCR[ncr.severity] ?? 1 },
        open: ncr.status !== "CLOSED",
      });
    }

    return out;
  }

  if (key === "snagTrade") {
    if (!sources.quality) {
      return null;
    }

    for (const punch of sources.quality.punchItems ?? []) {
      if (punch.status === "VOID") {
        continue;
      }

      const due = toDay(punch.dueDate);
      const open = punch.status !== "CLOSED";
      const late = open && Number.isFinite(due) && due < today ? today - due : 0;

      out.push({
        bucket: punch.trade ? squash(punch.trade) : "No trade",
        rec: {
          id: punch.id,
          reference: punch.reference,
          title: punch.title,
          meta: [punch.location, `${words(punch.priority)} priority`, words(punch.status)].filter(Boolean).join(" · "),
          day: toDay(punch.raisedDate),
          value: 1,
        },
        values: { count: 1, late },
        open,
      });
    }

    return out;
  }

  if (key === "inspectionFails") {
    if (!sources.quality) {
      return null;
    }

    for (const inspection of sources.quality.inspections ?? []) {
      if (inspection.result !== "FAIL") {
        continue;
      }

      out.push({
        bucket: tidy(inspection.discipline),
        rec: {
          id: inspection.id,
          reference: inspection.reference,
          title: inspection.title,
          meta: `${tidy(inspection.inspectionType)} · ${tidy(inspection.discipline)}`,
          day: toDay(inspection.actualDate ?? inspection.plannedDate),
          value: 1,
        },
        values: { count: 1 },
        open: true,
      });
    }

    return out;
  }

  if (key === "incidentType") {
    if (!sources.safety) {
      return null;
    }

    for (const incident of sources.safety.incidents ?? []) {
      if (incident.status === "VOID") {
        continue;
      }

      out.push({
        bucket: words(incident.incidentType),
        rec: {
          id: incident.id,
          reference: incident.reference,
          title: incident.title,
          meta: [incident.location, words(incident.severity), incident.lostTimeDays > 0 ? `${incident.lostTimeDays} days lost` : null].filter(Boolean).join(" · "),
          day: toDay(incident.occurredDate),
          value: 1,
        },
        values: { count: 1, lost: Math.max(0, incident.lostTimeDays || 0) },
        open: incident.status !== "CLOSED",
      });
    }

    return out;
  }

  if (key === "hazard") {
    if (!sources.safety) {
      return null;
    }

    for (const observation of sources.safety.observations ?? []) {
      if (observation.status === "VOID" || (observation.observationType !== "UNSAFE_ACT" && observation.observationType !== "UNSAFE_CONDITION")) {
        continue;
      }

      out.push({
        bucket: tidy(observation.hazardCategory),
        rec: {
          id: observation.id,
          reference: observation.reference,
          title: observation.title,
          meta: [observation.location, words(observation.observationType), words(observation.severity)].filter(Boolean).join(" · "),
          day: toDay(observation.observedDate),
          value: 1,
        },
        values: { count: 1, severity: SEVERITY_SAFETY[observation.severity] ?? 1 },
        open: observation.status !== "CLOSED",
      });
    }

    return out;
  }

  if (key === "delayCause") {
    if (!sources.risk) {
      return null;
    }

    for (const delay of sources.risk.delays ?? []) {
      out.push({
        bucket: tidy(delay.cause),
        rec: {
          id: delay.id,
          reference: delay.reference,
          title: delay.title,
          meta: [`${delay.forecastDelayDays} days`, delay.excusable ? "excusable" : "not excusable", delay.compensable ? "compensable" : null, words(delay.status)].filter(Boolean).join(" · "),
          day: toDay(delay.startDate),
          value: 1,
        },
        values: { count: 1, days: Math.max(0, delay.forecastDelayDays || 0) },
        open: delay.status !== "RESOLVED",
      });
    }

    return out;
  }

  if (!sources.risk) {
    return null;
  }

  for (const change of sources.risk.changes ?? []) {
    out.push({
      bucket: change.originator ? squash(change.originator) : "Not recorded",
      rec: {
        id: change.id,
        reference: change.reference,
        title: change.title,
        meta: [words(change.status), change.costImpact !== 0 ? `${change.costImpact > 0 ? "+" : "−"}${grouped(Math.abs(change.costImpact))}` : null, change.scheduleImpactDays !== 0 ? `${change.scheduleImpactDays > 0 ? "+" : ""}${change.scheduleImpactDays} d` : null]
          .filter(Boolean)
          .join(" · "),
        day: toDay(change.requestedDate),
        value: 1,
      },
      values: { count: 1, cost: Math.max(0, change.costImpact || 0), days: Math.max(0, change.scheduleImpactDays || 0) },
      open: change.status === "DRAFT" || change.status === "UNDER_REVIEW",
    });
  }

  return out;
}

export function buildPareto(sources: Sources, failed: string[], today: number, key: DimensionKey, measureKey: string, windowDays: number | null, openOnly: boolean): Pareto {
  const dimension = (DIMENSIONS.find((item) => item.key === key) ?? DIMENSIONS[0]) as Dimension;
  const measure = (dimension.measures.find((item) => item.key === measureKey) ?? dimension.measures[0]) as Measure;
  const raw = gatherRaw(sources, failed, dimension.key, today);

  if (raw === null) {
    return { dimension, measure, bars: [], total: 0, records: 0, vitalBars: 0, vitalShare: 0, categories: 0, concentrated: false, available: false };
  }

  const since = windowDays === null ? -Infinity : today - windowDays;
  const groups = new Map<string, { labels: Map<string, number>; value: number; count: number; records: Rec[] }>();
  let records = 0;

  for (const entry of raw) {
    if (openOnly && dimension.openFilter && !entry.open) {
      continue;
    }

    if (windowDays !== null && !(Number.isFinite(entry.rec.day) && entry.rec.day >= since && entry.rec.day <= today)) {
      continue;
    }

    const value = entry.values[measure.key] ?? 0;
    const id = entry.bucket.toLowerCase();
    const group = groups.get(id) ?? { labels: new Map<string, number>(), value: 0, count: 0, records: [] };

    group.labels.set(entry.bucket, (group.labels.get(entry.bucket) ?? 0) + 1);
    group.value += value;
    group.count += 1;
    group.records.push({ ...entry.rec, value });
    groups.set(id, group);
    records += 1;
  }

  const rows = [...groups.entries()]
    .map(([id, group]) => {
      const label = [...group.labels.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? id;

      return { key: id, label, value: group.value, count: group.count, records: group.records };
    })
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || b.count - a.count || a.label.localeCompare(b.label));

  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const keep = rows.length === TOP_BARS + 1 ? TOP_BARS + 1 : TOP_BARS;
  const head = rows.slice(0, keep);
  const tail = rows.slice(keep);
  const bars: Bar[] = head.map((row) => ({ ...row, share: 0, cumulative: 0, vital: false, merged: 1, unknown: UNKNOWN.has(row.key) }));

  if (tail.length > 0) {
    bars.push({
      key: "__rest",
      label: `${tail.length} other ${plural(tail.length, "category", "categories")}`,
      value: tail.reduce((sum, row) => sum + row.value, 0),
      count: tail.reduce((sum, row) => sum + row.count, 0),
      share: 0,
      cumulative: 0,
      vital: false,
      merged: tail.length,
      unknown: false,
      records: tail.flatMap((row) => row.records),
    });
  }

  let running = 0;
  let vitalBars = 0;
  let reached = false;

  for (const bar of bars) {
    running += bar.value;
    bar.share = total > 0 ? bar.value / total : 0;
    bar.cumulative = total > 0 ? running / total : 0;

    if (!reached && bar.merged === 1) {
      bar.vital = true;
      vitalBars += 1;
    }

    if (bar.cumulative >= VITAL_SHARE) {
      reached = true;
    }
  }

  const vital = bars.filter((bar) => bar.vital);
  const vitalShare = vital.length > 0 ? (vital[vital.length - 1] as Bar).cumulative : 0;

  for (const bar of bars) {
    bar.records.sort((a, b) => b.value - a.value || (Number.isFinite(b.day) ? b.day : 0) - (Number.isFinite(a.day) ? a.day : 0));
  }

  return { dimension, measure, bars, total, records, vitalBars, vitalShare, categories: rows.length, concentrated: vitalShare >= VITAL_SHARE && vitalBars <= Math.max(1, Math.floor(rows.length * 0.6)), available: true };
}

export function formatValue(value: number, measure: Measure): string {
  if (measure.unit === "cost") {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
  }

  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function paretoMarkdown(result: Pareto, projectName: string, today: number, windowLabel: string, openOnly: boolean): string {
  const lines: string[] = [];

  lines.push(`# ${result.dimension.title}: ${projectName}`, "");
  lines.push(
    `As of ${formatDay(today)}. Measured as ${result.measure.label.toLowerCase()}, ${windowLabel.toLowerCase()}${openOnly && result.dimension.openFilter ? ", open items only" : ""}. ${result.records} ${plural(result.records, "record", "records")}.`,
    "",
  );

  if (result.bars.length === 0) {
    lines.push("Nothing to rank for this selection.", "");

    return lines.join("\n");
  }

  lines.push(
    result.concentrated
      ? `${result.vitalBars} of ${result.categories} ${plural(result.categories, "category", "categories")} account for ${percent(result.vitalShare)} of the total.`
      : `No small group dominates: the leading ${result.vitalBars} ${plural(result.vitalBars, "category", "categories")} make up ${percent(result.vitalShare)} of the total.`,
    "",
  );
  lines.push(`| Category | ${result.measure.label} | Share | Cumulative | Records |`);
  lines.push("| --- | ---: | ---: | ---: | ---: |");

  for (const bar of result.bars) {
    lines.push(`| ${bar.vital ? "**" : ""}${bar.label.replace(/\|/g, "/")}${bar.vital ? "**" : ""} | ${formatValue(bar.value, result.measure)} | ${percent(bar.share)} | ${percent(bar.cumulative)} | ${bar.count} |`);
  }

  lines.push("", "Bold rows are the vital few, the leading categories that together reach 80% of the total.", "");

  return lines.join("\n");
}

export function availableModules(failed: string[]): Set<ModuleKey> {
  const lost = new Set(failed);

  return new Set<ModuleKey>((["quality", "safety", "risk"] as ModuleKey[]).filter((key) => !lost.has(key)));
}
