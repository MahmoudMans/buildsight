import { MODULE_LABEL, SEVERITY_LABEL, compareOpenItems, formatDay, plural, trunc, type ModuleKey, type OpenItem, type Severity } from "@/lib/openItems";

export const STORAGE_PREFIX = "buildsight.visit.";
export const LIST_PREVIEW = 12;

const SEVERITIES: ReadonlyArray<Severity> = ["critical", "high", "medium", "low"];
const MODULE_KEYS: ReadonlyArray<string> = ["governance", "risk", "safety", "quality", "documents", "commercial", "procurement", "production", "schedule"];

export interface Snap {
  m: ModuleKey;
  k: string;
  r: string;
  t: string;
  d: number | null;
  s: Severity;
  x: string;
  o: string | null;
}

export interface Store {
  v: 1;
  savedAt: number;
  day: number;
  items: Record<string, Snap>;
}

export interface GoneItem extends Snap {
  id: string;
}

export interface ChangedItem {
  item: OpenItem;
  before: Snap;
  notes: string[];
}

export interface Diff {
  fresh: OpenItem[];
  late: OpenItem[];
  changed: ChangedItem[];
  gone: GoneItem[];
  held: number;
}

export type Loaded = { state: "none" } | { state: "blocked" } | { state: "ready"; store: Store };

export function stableDetail(detail: string): string {
  return detail
    .replace(/\s*·\s*waiting \d+ days?/i, "")
    .replace(/expired while still active/i, "valid until")
    .replace(/\s+/g, " ")
    .trim();
}

function dayOrNull(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

export function snapshotOf(items: OpenItem[]): Record<string, Snap> {
  const result: Record<string, Snap> = {};

  for (const item of items) {
    result[item.id] = {
      m: item.module,
      k: item.kind,
      r: item.reference,
      t: trunc(item.title, 140),
      d: dayOrNull(item.due),
      s: item.severity,
      x: trunc(stableDetail(item.detail), 160),
      o: item.owner,
    };
  }

  return result;
}

function sameDay(a: number, b: number | null): boolean {
  return (Number.isFinite(a) ? a : null) === b;
}

function dayText(value: number | null): string {
  return value === null ? "no date" : formatDay(value);
}

export function compare(items: OpenItem[], store: Store, failed: string[], today: number): Diff {
  const lost = new Set(failed);
  const present = new Set(items.map((item) => item.id));
  const fresh: OpenItem[] = [];
  const late: OpenItem[] = [];
  const changed: ChangedItem[] = [];
  const gone: GoneItem[] = [];
  let held = 0;

  for (const item of items) {
    const before = store.items[item.id];

    if (!before) {
      fresh.push(item);
      continue;
    }

    const notes: string[] = [];
    const detail = trunc(stableDetail(item.detail), 160);

    if (detail !== before.x) {
      notes.push(`${before.x || "No detail"} → ${stableDetail(item.detail) || "No detail"}`);
    }

    if ((item.owner ?? "") !== (before.o ?? "")) {
      notes.push(`Owner: ${before.o ?? "nobody"} → ${item.owner ?? "nobody"}`);
    }

    if (!sameDay(item.due, before.d)) {
      notes.push(`Due: ${dayText(before.d)} → ${dayText(dayOrNull(item.due))}`);
    }

    if (item.severity !== before.s) {
      notes.push(`Severity: ${SEVERITY_LABEL[before.s]} → ${SEVERITY_LABEL[item.severity]}`);
    }

    if (notes.length > 0) {
      changed.push({ item, before, notes });
    }

    const wasLate = before.d !== null && before.d < store.day;

    if (Number.isFinite(item.due) && item.due < today && !wasLate) {
      late.push(item);
    }
  }

  for (const [id, snap] of Object.entries(store.items)) {
    if (present.has(id)) {
      continue;
    }

    if (lost.has(snap.m)) {
      held += 1;
      continue;
    }

    gone.push({ id, ...snap });
  }

  fresh.sort(compareOpenItems);
  late.sort(compareOpenItems);
  changed.sort((a, b) => compareOpenItems(a.item, b.item));
  gone.sort((a, b) => a.m.localeCompare(b.m) || a.r.localeCompare(b.r));

  return { fresh, late, changed, gone, held };
}

export function merge(items: OpenItem[], previous: Store | null, failed: string[], today: number, now: number): Store {
  const lost = new Set(failed);
  const kept: Record<string, Snap> = {};

  if (previous) {
    for (const [id, snap] of Object.entries(previous.items)) {
      if (lost.has(snap.m)) {
        kept[id] = snap;
      }
    }
  }

  return { v: 1, savedAt: now, day: today, items: { ...kept, ...snapshotOf(items) } };
}

function validSnap(value: unknown): value is Snap {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const snap = value as Record<string, unknown>;

  return (
    typeof snap.m === "string" &&
    MODULE_KEYS.includes(snap.m) &&
    typeof snap.k === "string" &&
    typeof snap.r === "string" &&
    typeof snap.t === "string" &&
    (snap.d === null || typeof snap.d === "number") &&
    typeof snap.s === "string" &&
    SEVERITIES.includes(snap.s as Severity) &&
    typeof snap.x === "string" &&
    (snap.o === null || typeof snap.o === "string")
  );
}

export function parseStore(text: string | null): Store | null {
  if (!text) {
    return null;
  }

  try {
    const raw: unknown = JSON.parse(text);

    if (typeof raw !== "object" || raw === null) {
      return null;
    }

    const data = raw as Record<string, unknown>;

    if (data.v !== 1 || typeof data.savedAt !== "number" || typeof data.day !== "number" || typeof data.items !== "object" || data.items === null) {
      return null;
    }

    const items: Record<string, Snap> = {};

    for (const [id, snap] of Object.entries(data.items as Record<string, unknown>)) {
      if (validSnap(snap)) {
        items[id] = snap;
      }
    }

    return { v: 1, savedAt: data.savedAt, day: data.day, items };
  } catch {
    return null;
  }
}

export function readStore(projectId: string): Loaded {
  try {
    const store = parseStore(window.localStorage.getItem(`${STORAGE_PREFIX}${projectId}`));

    return store ? { state: "ready", store } : { state: "none" };
  } catch {
    return { state: "blocked" };
  }
}

export function writeStore(projectId: string, store: Store): boolean {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(store));

    return true;
  } catch {
    return false;
  }
}

export function stamp(ms: number): string {
  const date = new Date(ms);

  if (Number.isNaN(date.getTime())) {
    return "an earlier visit";
  }

  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", hour: "2-digit", minute: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function totalChanges(diff: Diff): number {
  return diff.fresh.length + diff.late.length + diff.changed.length + diff.gone.length;
}

export function changesMarkdown(diff: Diff, projectName: string, savedAt: number, today: number, open: number): string {
  const lines: string[] = [];

  lines.push(`# Changes since last visit: ${projectName}`, "");
  lines.push(`Compared with the snapshot saved on ${stamp(savedAt)}. Report date ${formatDay(today)}. ${open} ${plural(open, "item is", "items are")} open now.`, "");

  if (totalChanges(diff) === 0) {
    lines.push("Nothing has changed since then.", "");

    return lines.join("\n");
  }

  const entry = (item: OpenItem) =>
    `- ${MODULE_LABEL[item.module]} · ${item.reference} ${item.title}${Number.isFinite(item.due) ? ` (due ${formatDay(item.due)})` : ""}${item.owner ? `, ${item.owner}` : ""}`;

  if (diff.fresh.length > 0) {
    lines.push(`## New (${diff.fresh.length})`, "", ...diff.fresh.map(entry), "");
  }

  if (diff.late.length > 0) {
    lines.push(`## Newly overdue (${diff.late.length})`, "", ...diff.late.map(entry), "");
  }

  if (diff.changed.length > 0) {
    lines.push(`## Changed (${diff.changed.length})`, "");

    for (const change of diff.changed) {
      lines.push(entry(change.item), ...change.notes.map((note) => `  - ${note}`));
    }

    lines.push("");
  }

  if (diff.gone.length > 0) {
    lines.push(`## No longer open (${diff.gone.length})`, "", ...diff.gone.map((item) => `- ${MODULE_LABEL[item.m]} · ${item.r} ${item.t}`), "");
  }

  if (diff.held > 0) {
    lines.push(`${diff.held} ${plural(diff.held, "item was", "items were")} left out because its module could not be loaded.`, "");
  }

  return lines.join("\n");
}
