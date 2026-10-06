import { formatDay, plural, toDay, words, type Sources } from "@/lib/openItems";

export type GroupBy = "area" | "exact";
export type SortKey = "score" | "snags" | "permits" | "incidents" | "unsafe" | "name";
export type RecordKind = "snag" | "permit" | "incident" | "observation";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "6 months" },
];

export const DEFAULT_WINDOW = 90;
export const NO_LOCATION = "__none";
export const LIST_LIMIT = 8;

export interface HotRecord {
  id: string;
  kind: RecordKind;
  reference: string;
  title: string;
  meta: string;
  flag: string | null;
  alert: boolean;
  day: number;
}

export interface Hotspot {
  key: string;
  label: string;
  places: string[];
  snags: number;
  overdue: number;
  permits: number;
  expired: number;
  incidents: number;
  unsafe: number;
  score: number;
  records: HotRecord[];
}

export interface Available {
  snags: boolean;
  permits: boolean;
  incidents: boolean;
  unsafe: boolean;
}

export interface Totals {
  snags: number;
  overdue: number;
  permits: number;
  expired: number;
  incidents: number;
  unsafe: number;
}

export interface Hotspots {
  rows: Hotspot[];
  none: Hotspot | null;
  available: Available;
  max: { snags: number; permits: number; incidents: number; unsafe: number };
  totals: Totals;
  located: number;
  unlocated: number;
  groupBy: GroupBy;
  windowDays: number;
}

const LEVEL_SUFFIX = /[\s,;:/-]+(?:level|lvl|floor|fl|l|lv|storey|story)\.?\s*-?\s*\d+[a-z]?\b.*$/i;

function squash(text: string): string {
  return text.trim().replace(/\s+/g, " ");
}

export function normalise(text: string): string {
  return squash(text).toLowerCase();
}

export function areaOf(location: string): string {
  const text = squash(location);
  const cut = text.replace(LEVEL_SUFFIX, "").trim();

  return cut || text;
}

function hazard(value: string): string {
  return words(value).replace(/\b(ppe|hse|mep)\b/gi, (match) => match.toUpperCase());
}

const RANK: Record<RecordKind, number> = { permit: 0, incident: 1, observation: 2, snag: 3 };

function stamp(day: number): number {
  return Number.isFinite(day) ? day : 0;
}

interface Bucket {
  key: string;
  spellings: Map<string, number>;
  places: Set<string>;
  spot: Hotspot;
}

function blank(key: string, label: string): Hotspot {
  return { key, label, places: [], snags: 0, overdue: 0, permits: 0, expired: 0, incidents: 0, unsafe: 0, score: 0, records: [] };
}

export function buildHotspots(sources: Sources, failed: string[], today: number, groupBy: GroupBy, windowDays: number): Hotspots {
  const lost = new Set(failed);
  const quality = sources.quality;
  const safety = sources.safety;
  const available: Available = {
    snags: quality !== null && !lost.has("quality"),
    permits: safety !== null && !lost.has("safety"),
    incidents: safety !== null && !lost.has("safety"),
    unsafe: safety !== null && !lost.has("safety"),
  };

  const buckets = new Map<string, Bucket>();
  const none = blank(NO_LOCATION, "Not recorded");

  function target(location: string | null | undefined): Hotspot {
    const raw = squash(location ?? "");

    if (!raw) {
      return none;
    }

    const label = groupBy === "area" ? areaOf(raw) : raw;
    const key = normalise(label);
    let bucket = buckets.get(key);

    if (!bucket) {
      bucket = { key, spellings: new Map(), places: new Set(), spot: blank(key, label) };
      buckets.set(key, bucket);
    }

    bucket.spellings.set(label, (bucket.spellings.get(label) ?? 0) + 1);
    bucket.places.add(raw);

    return bucket.spot;
  }

  const since = today - windowDays;

  if (available.snags && quality) {
    for (const item of quality.punchItems ?? []) {
      if (item.status === "CLOSED" || item.status === "VOID") {
        continue;
      }

      const spot = target(item.location);
      const due = toDay(item.dueDate);
      const late = Number.isFinite(due) && due < today;

      spot.snags += 1;

      if (late) {
        spot.overdue += 1;
      }

      spot.records.push({
        id: `snag-${item.id}`,
        kind: "snag",
        reference: item.reference,
        title: item.title,
        meta: [item.trade, `${words(item.priority)} priority`, Number.isFinite(due) ? `due ${formatDay(due)}` : null].filter(Boolean).join(" · "),
        flag: late ? `${today - due} ${plural(today - due, "day", "days")} overdue` : null,
        alert: late,
        day: due,
      });
    }
  }

  if (available.permits && safety) {
    for (const permit of safety.permits ?? []) {
      if (permit.status !== "ACTIVE") {
        continue;
      }

      const from = toDay(permit.validFrom);
      const until = toDay(permit.validUntil);
      const ended = Number.isFinite(until) && until < today;
      const live = !ended && Number.isFinite(from) && from <= today;

      if (!ended && !live) {
        continue;
      }

      const spot = target(permit.location);

      if (ended) {
        spot.expired += 1;
      } else {
        spot.permits += 1;
      }

      spot.records.push({
        id: `permit-${permit.id}`,
        kind: "permit",
        reference: permit.reference,
        title: permit.title,
        meta: [hazard(permit.permitType), permit.receiverName ? `receiver ${permit.receiverName}` : null, Number.isFinite(until) ? `until ${formatDay(until)}` : null]
          .filter(Boolean)
          .join(" · "),
        flag: ended ? "Expired, still open" : null,
        alert: ended,
        day: until,
      });
    }
  }

  if (available.incidents && safety) {
    for (const incident of safety.incidents ?? []) {
      const day = toDay(incident.occurredDate);

      if (incident.status === "VOID" || !Number.isFinite(day) || day < since || day > today) {
        continue;
      }

      const spot = target(incident.location);
      const injury = incident.incidentType === "FIRST_AID" || incident.incidentType === "MEDICAL_TREATMENT" || incident.incidentType === "LOST_TIME_INJURY";

      spot.incidents += 1;

      spot.records.push({
        id: `incident-${incident.id}`,
        kind: "incident",
        reference: incident.reference,
        title: incident.title,
        meta: `${words(incident.incidentType)} · ${words(incident.severity)} · ${formatDay(day)}`,
        flag: injury ? "Injury" : null,
        alert: injury,
        day,
      });
    }
  }

  if (available.unsafe && safety) {
    for (const observation of safety.observations ?? []) {
      const day = toDay(observation.observedDate);
      const unsafe = observation.observationType === "UNSAFE_ACT" || observation.observationType === "UNSAFE_CONDITION";

      if (!unsafe || observation.status === "VOID" || !Number.isFinite(day) || day < since || day > today) {
        continue;
      }

      const spot = target(observation.location);
      const open = observation.status !== "CLOSED";
      const due = toDay(observation.dueDate);
      const late = open && Number.isFinite(due) && due < today;

      spot.unsafe += 1;

      spot.records.push({
        id: `observation-${observation.id}`,
        kind: "observation",
        reference: observation.reference,
        title: observation.title,
        meta: `${hazard(observation.hazardCategory)} · ${words(observation.observationType)} · ${formatDay(day)}`,
        flag: late ? "Action overdue" : null,
        alert: late,
        day,
      });
    }
  }

  const rows: Hotspot[] = [];

  for (const bucket of buckets.values()) {
    const ranked = [...bucket.spellings.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    const best = ranked[0];

    bucket.spot.label = best ? best[0] : bucket.spot.label;
    bucket.spot.places = [...bucket.places].sort((a, b) => a.localeCompare(b));
    rows.push(bucket.spot);
  }

  for (const spot of [...rows, none]) {
    spot.score = spot.snags + spot.overdue + 3 * spot.expired + 3 * spot.incidents + spot.unsafe;
    spot.records.sort((a, b) => Number(b.alert) - Number(a.alert) || RANK[a.kind] - RANK[b.kind] || (a.kind === "snag" ? stamp(a.day) - stamp(b.day) : stamp(b.day) - stamp(a.day)));
  }

  rows.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label));

  const totals: Totals = { snags: 0, overdue: 0, permits: 0, expired: 0, incidents: 0, unsafe: 0 };
  const max = { snags: 0, permits: 0, incidents: 0, unsafe: 0 };

  for (const spot of rows) {
    max.snags = Math.max(max.snags, spot.snags);
    max.permits = Math.max(max.permits, spot.permits + spot.expired);
    max.incidents = Math.max(max.incidents, spot.incidents);
    max.unsafe = Math.max(max.unsafe, spot.unsafe);
  }

  for (const spot of [...rows, none]) {
    totals.snags += spot.snags;
    totals.overdue += spot.overdue;
    totals.permits += spot.permits;
    totals.expired += spot.expired;
    totals.incidents += spot.incidents;
    totals.unsafe += spot.unsafe;
  }

  return {
    rows,
    none: none.records.length > 0 ? none : null,
    available,
    max,
    totals,
    located: rows.reduce((sum, spot) => sum + spot.records.length, 0),
    unlocated: none.records.length,
    groupBy,
    windowDays,
  };
}

export function sortHotspots(rows: Hotspot[], key: SortKey): Hotspot[] {
  const value = (spot: Hotspot): number =>
    key === "snags" ? spot.snags : key === "permits" ? spot.permits + spot.expired : key === "incidents" ? spot.incidents : key === "unsafe" ? spot.unsafe : spot.score;

  return [...rows].sort((a, b) => (key === "name" ? a.label.localeCompare(b.label) : value(b) - value(a) || b.score - a.score || a.label.localeCompare(b.label)));
}

function cell(available: boolean, value: number): string {
  return available ? String(value) : "n/a";
}

export function hotspotsMarkdown(result: Hotspots, projectName: string, today: number): string {
  const window = WINDOWS.find((item) => item.days === result.windowDays)?.label ?? `${result.windowDays} days`;
  const lines: string[] = [];
  const { available } = result;

  lines.push(`# Site hotspots: ${projectName}`, "");
  lines.push(
    `As of ${formatDay(today)}. Grouped by ${result.groupBy === "area" ? "area, with the level left off" : "exact location"}. Incidents and unsafe observations cover the last ${window}.`,
    "",
  );

  if (result.rows.length === 0 && !result.none) {
    lines.push("No records carry a location yet.", "");

    return lines.join("\n");
  }

  lines.push("| Location | Open snags | Overdue | Permits in force | Expired | Incidents | Unsafe observations | Score |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const spot of [...result.rows, ...(result.none ? [result.none] : [])]) {
    lines.push(
      `| ${spot.label.replace(/\|/g, "/")} | ${cell(available.snags, spot.snags)} | ${cell(available.snags, spot.overdue)} | ${cell(available.permits, spot.permits)} | ${cell(available.permits, spot.expired)} | ${cell(available.incidents, spot.incidents)} | ${cell(available.unsafe, spot.unsafe)} | ${spot.score} |`,
    );
  }

  lines.push("", "Score is open snags, plus overdue snags, plus three for each expired permit and each incident, plus unsafe observations. It ranks where to look first and is not a risk model.", "");

  if (result.unlocated > 0) {
    lines.push(`${result.unlocated} ${plural(result.unlocated, "record has", "records have")} no location, so ${plural(result.unlocated, "it is", "they are")} listed under Not recorded.`, "");
  }

  for (const spot of result.rows.slice(0, 3)) {
    if (spot.score === 0) {
      continue;
    }

    lines.push(`## ${spot.label}`, "");

    for (const record of spot.records.slice(0, LIST_LIMIT)) {
      lines.push(`- ${record.reference} ${record.title}${record.flag ? ` (${record.flag})` : ""}${record.meta ? `: ${record.meta}` : ""}`);
    }

    if (spot.records.length > LIST_LIMIT) {
      lines.push(`- and ${spot.records.length - LIST_LIMIT} more`);
    }

    lines.push("");
  }

  return lines.join("\n");
}
