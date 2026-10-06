import { snapshotOf, stableDetail, stamp, type Snap } from "@/lib/changeTracker";
import { DAY_MS, MODULE_LABEL, SEVERITY_LABEL, compareOpenItems, formatDay, plural, trunc, type ModuleKey, type OpenItem, type Severity } from "@/lib/openItems";

export const WATCH_PREFIX = "buildsight.watch.";
export const MAX_PINS = 100;
export const RESULT_LIMIT = 10;
export const NOTE_LIMIT = 240;

const SEVERITIES: ReadonlyArray<string> = ["critical", "high", "medium", "low"];
const MODULE_KEYS: ReadonlyArray<string> = ["governance", "risk", "safety", "quality", "documents", "commercial", "procurement", "production", "schedule"];

export interface Pin {
  id: string;
  snap: Snap;
  at: number;
  note: string;
}

export interface WatchStore {
  v: 1;
  pins: Pin[];
}

export type PinState = "open" | "changed" | "gone" | "unknown";

export interface PinView {
  pin: Pin;
  state: PinState;
  item: OpenItem | null;
  notes: string[];
  overdue: boolean;
  became: boolean;
  days: number | null;
}

export type Loaded = { state: "none" } | { state: "blocked" } | { state: "ready"; store: WatchStore };

export type SortKey = "attention" | "due" | "pinned";

export const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "attention", label: "Needs attention" },
  { key: "due", label: "Due date" },
  { key: "pinned", label: "Newest pinned" },
];

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
    SEVERITIES.includes(snap.s) &&
    typeof snap.x === "string" &&
    (snap.o === null || typeof snap.o === "string")
  );
}

export function parseStore(text: string | null): WatchStore | null {
  if (!text) {
    return null;
  }

  try {
    const raw: unknown = JSON.parse(text);

    if (typeof raw !== "object" || raw === null) {
      return null;
    }

    const data = raw as Record<string, unknown>;

    if (data.v !== 1 || !Array.isArray(data.pins)) {
      return null;
    }

    const pins: Pin[] = [];
    const seen = new Set<string>();

    for (const entry of data.pins as unknown[]) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }

      const pin = entry as Record<string, unknown>;

      if (typeof pin.id !== "string" || seen.has(pin.id) || typeof pin.at !== "number" || !validSnap(pin.snap)) {
        continue;
      }

      seen.add(pin.id);
      pins.push({ id: pin.id, snap: pin.snap, at: pin.at, note: typeof pin.note === "string" ? pin.note.slice(0, NOTE_LIMIT) : "" });
    }

    return { v: 1, pins: pins.slice(0, MAX_PINS) };
  } catch {
    return null;
  }
}

export function readStore(projectId: string): Loaded {
  try {
    const store = parseStore(window.localStorage.getItem(`${WATCH_PREFIX}${projectId}`));

    return store ? { state: "ready", store } : { state: "none" };
  } catch {
    return { state: "blocked" };
  }
}

export function writeStore(projectId: string, store: WatchStore): boolean {
  try {
    if (store.pins.length === 0) {
      window.localStorage.removeItem(`${WATCH_PREFIX}${projectId}`);
    } else {
      window.localStorage.setItem(`${WATCH_PREFIX}${projectId}`, JSON.stringify(store));
    }

    return true;
  } catch {
    return false;
  }
}

export function pinItem(store: WatchStore, item: OpenItem, now: number): WatchStore {
  if (store.pins.some((pin) => pin.id === item.id) || store.pins.length >= MAX_PINS) {
    return store;
  }

  const snap = snapshotOf([item])[item.id];

  if (!snap) {
    return store;
  }

  return { v: 1, pins: [{ id: item.id, snap, at: now, note: "" }, ...store.pins] };
}

export function unpin(store: WatchStore, id: string): WatchStore {
  return { v: 1, pins: store.pins.filter((pin) => pin.id !== id) };
}

export function setNote(store: WatchStore, id: string, note: string): WatchStore {
  return { v: 1, pins: store.pins.map((pin) => (pin.id === id ? { ...pin, note: note.slice(0, NOTE_LIMIT) } : pin)) };
}

function dayText(value: number | null): string {
  return value === null ? "no date" : formatDay(value);
}

function finite(value: number): number | null {
  return Number.isFinite(value) ? value : null;
}

export function evaluate(store: WatchStore, items: OpenItem[], failed: string[], today: number): PinView[] {
  const lost = new Set(failed);
  const current = new Map(items.map((item) => [item.id, item]));

  return store.pins.map((pin) => {
    const item = current.get(pin.id) ?? null;

    if (!item) {
      return { pin, state: lost.has(pin.snap.m) ? "unknown" : "gone", item: null, notes: [], overdue: false, became: false, days: null } satisfies PinView;
    }

    const notes: string[] = [];
    const before = pin.snap;
    const due = finite(item.due);
    const pinDay = Math.floor(pin.at / DAY_MS);

    if (due !== before.d) {
      if (due !== null && before.d !== null) {
        const shift = due - before.d;

        notes.push(`Due date moved ${Math.abs(shift)} ${plural(Math.abs(shift), "day", "days")} ${shift > 0 ? "later" : "earlier"}, from ${dayText(before.d)} to ${dayText(due)}`);
      } else {
        notes.push(`Due date changed from ${dayText(before.d)} to ${dayText(due)}`);
      }
    }

    if (item.severity !== before.s) {
      const rank = (value: Severity) => SEVERITIES.length - SEVERITIES.indexOf(value);

      notes.push(`Priority ${rank(item.severity) > rank(before.s) ? "raised" : "lowered"} from ${SEVERITY_LABEL[before.s]} to ${SEVERITY_LABEL[item.severity]}`);
    }

    if ((item.owner ?? "") !== (before.o ?? "")) {
      notes.push(before.o === null ? `Now owned by ${item.owner ?? "nobody"}` : item.owner === null ? `Owner ${before.o} removed` : `Owner changed from ${before.o} to ${item.owner}`);
    }

    const detail = trunc(stableDetail(item.detail), 160);

    if (detail !== before.x) {
      notes.push(`Status now “${detail || "no detail"}”`);
    }

    const overdue = due !== null && due < today;
    const became = overdue && before.d !== null && before.d >= pinDay;

    return { pin, state: notes.length > 0 || became ? "changed" : "open", item, notes, overdue, became, days: due === null ? null : due - today } satisfies PinView;
  });
}

export function sortViews(views: PinView[], key: SortKey): PinView[] {
  const list = [...views];
  const rank = (view: PinView) => (view.state === "gone" ? 3 : view.state === "unknown" ? 2 : 0);
  const dueOf = (view: PinView) => (view.days === null ? Infinity : view.days);

  if (key === "pinned") {
    return list.sort((a, b) => b.pin.at - a.pin.at);
  }

  if (key === "due") {
    return list.sort((a, b) => rank(a) - rank(b) || dueOf(a) - dueOf(b) || a.pin.snap.r.localeCompare(b.pin.snap.r));
  }

  const urgency = (view: PinView) => (view.overdue ? 0 : view.state === "changed" ? 1 : 2);

  return list.sort((a, b) => rank(a) - rank(b) || urgency(a) - urgency(b) || (a.item && b.item ? compareOpenItems(a.item, b.item) : dueOf(a) - dueOf(b)));
}

export function searchItems(items: OpenItem[], query: string, module: ModuleKey | "all", pinned: Set<string>, limit: number): { results: OpenItem[]; total: number } {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);

  const matches = items.filter((item) => {
    if (pinned.has(item.id) || (module !== "all" && item.module !== module)) {
      return false;
    }

    if (terms.length === 0) {
      return true;
    }

    const haystack = `${item.reference} ${item.title} ${item.owner ?? ""} ${item.kind} ${MODULE_LABEL[item.module]} ${item.detail}`.toLowerCase();

    return terms.every((term) => haystack.includes(term));
  });

  const exact = (item: OpenItem) => (terms.length > 0 && item.reference.toLowerCase().startsWith(terms[0] as string) ? 0 : 1);

  matches.sort((a, b) => exact(a) - exact(b) || compareOpenItems(a, b));

  return { results: matches.slice(0, limit), total: matches.length };
}

export function dueLabel(days: number | null): string {
  if (days === null) {
    return "No due date";
  }

  if (days < 0) {
    return `${-days} ${plural(-days, "day", "days")} late`;
  }

  if (days === 0) {
    return "Due today";
  }

  if (days === 1) {
    return "Due tomorrow";
  }

  return `Due in ${days} days`;
}

export function stateLabel(view: PinView): string {
  if (view.state === "gone") {
    return "No longer open";
  }

  if (view.state === "unknown") {
    return "Could not check";
  }

  if (view.overdue) {
    return view.days === null ? "Overdue" : `${-view.days} ${plural(-view.days, "day", "days")} overdue`;
  }

  return view.state === "changed" ? "Changed" : "On track";
}

export function watchMarkdown(views: PinView[], projectName: string, today: number): string {
  const lines: string[] = [];
  const open = views.filter((view) => view.state === "open" || view.state === "changed").length;

  lines.push(`# Watchlist: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. ${views.length} ${plural(views.length, "item", "items")} watched, ${open} still open.`, "");

  if (views.length === 0) {
    lines.push("Nothing is being watched.", "");

    return lines.join("\n");
  }

  lines.push("| Reference | Item | Area | Due | Status | Owner | Note |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- |");

  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  for (const view of views) {
    const snap = view.pin.snap;
    const item = view.item;
    const due = item ? (Number.isFinite(item.due) ? formatDay(item.due) : "No date") : snap.d === null ? "No date" : formatDay(snap.d);
    const status = [stateLabel(view), ...view.notes].join("; ");

    lines.push(`| ${cell(snap.r)} | ${cell(item ? item.title : snap.t)} | ${MODULE_LABEL[snap.m]} | ${due} | ${cell(status)} | ${cell(item ? (item.owner ?? "—") : (snap.o ?? "—"))} | ${cell(view.pin.note)} |`);
  }

  lines.push("", `Pinned items are kept in this browser only. Oldest pin ${stamp(Math.min(...views.map((view) => view.pin.at)))}.`, "");

  return lines.join("\n");
}
