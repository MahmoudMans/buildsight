import { formatDay, plural, toDay } from "@/lib/openItems";
import { linkMap, modelDay, type Prepared } from "@/lib/slipExplorer";
import type { ScheduleActivity, ScheduleDependencyType } from "@/types/project";

export const NODE_W = 172;
export const NODE_H = 54;
export const GAP_X = 60;
export const GAP_Y = 14;
export const PAD = 20;
export const DRAW_LIMIT = 450;
export const SWEEPS = 6;
const EPS = 0.05;

export type Direction = "both" | "up" | "down";

export interface MapOptions {
  showDone: boolean;
  focus: string | null;
  direction: Direction;
  criticalOnly: boolean;
}

export interface MapNode {
  id: string;
  index: number;
  code: string;
  name: string;
  status: ScheduleActivity["status"];
  done: boolean;
  started: boolean;
  slack: number | null;
  critical: boolean;
  start: number | null;
  finish: number | null;
  level: number;
  row: number;
  x: number;
  y: number;
}

export interface MapEdge {
  key: string;
  from: string;
  to: string;
  type: ScheduleDependencyType;
  lag: number;
  driving: boolean;
  spare: number | null;
  d: string;
}

export interface LogicMap {
  nodes: MapNode[];
  edges: MapEdge[];
  levels: number;
  width: number;
  height: number;
  tooMany: boolean;
  total: number;
  hiddenDone: number;
}

export interface Wiring {
  predecessors: Array<{ id: string; code: string; name: string; type: ScheduleDependencyType; lag: number; driving: boolean; spare: number | null }>;
  successors: Array<{ id: string; code: string; name: string; type: ScheduleDependencyType; lag: number; driving: boolean; spare: number | null }>;
}

function walk(start: number, step: (index: number) => number[], keep: Set<number>): Set<number> {
  const seen = new Set<number>([start]);
  const stack = [start];

  while (stack.length > 0) {
    const current = stack.pop() as number;

    for (const next of step(current)) {
      if (keep.has(next) && !seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }

  return seen;
}

export function buildLogicMap(prepared: Prepared, options: MapOptions): LogicMap {
  const { net } = prepared;
  const relations = linkMap(prepared);
  const everyone = net.activities.map((_, index) => index);
  const hiddenDone = net.done.filter(Boolean).length;
  let keep = new Set<number>(everyone.filter((index) => options.showDone || !net.done[index]));
  const total = keep.size;
  const focus = options.focus !== null ? net.position.get(options.focus) : undefined;

  if (focus !== undefined && keep.has(focus)) {
    const upstream = options.direction === "down" ? new Set<number>([focus]) : walk(focus, (index) => (net.preds[index] ?? []).map((link) => link.other), keep);
    const downstream = options.direction === "up" ? new Set<number>([focus]) : walk(focus, (index) => (net.succs[index] ?? []).map((link) => link.other), keep);

    keep = new Set<number>([...upstream, ...downstream]);
  }

  const slackOf = (index: number): number | null => (net.done[index] ? null : (prepared.slack[index] ?? 0));
  const isCritical = (index: number): boolean => {
    const value = slackOf(index);

    return value !== null && value <= EPS;
  };

  if (options.criticalOnly) {
    keep = new Set<number>([...keep].filter((index) => isCritical(index) || index === focus));
  }

  const tooMany = keep.size > DRAW_LIMIT;

  if (tooMany || keep.size === 0) {
    return { nodes: [], edges: [], levels: 0, width: 0, height: 0, tooMany, total, hiddenDone };
  }

  const level = new Map<number, number>();

  for (const index of net.order) {
    if (!keep.has(index)) {
      continue;
    }

    let depth = 0;

    for (const link of net.preds[index] ?? []) {
      if (keep.has(link.other)) {
        depth = Math.max(depth, (level.get(link.other) ?? 0) + 1);
      }
    }

    level.set(index, depth);
  }

  const levels = Math.max(0, ...level.values()) + 1;
  const columns: number[][] = Array.from({ length: levels }, () => []);

  const initial = [...keep].sort((a, b) => {
    const left = net.activities[a] as ScheduleActivity;
    const right = net.activities[b] as ScheduleActivity;

    return left.activityCode.localeCompare(right.activityCode, undefined, { numeric: true });
  });

  for (const index of initial) {
    columns[level.get(index) ?? 0]?.push(index);
  }

  const order = new Map<number, number>();

  const renumber = () => {
    for (const column of columns) {
      column.forEach((index, position) => order.set(index, position));
    }
  };

  renumber();

  const average = (index: number, towards: "preds" | "succs"): number => {
    const list = (towards === "preds" ? net.preds[index] : net.succs[index]) ?? [];
    const values = list.filter((link) => keep.has(link.other)).map((link) => order.get(link.other) ?? 0);

    return values.length === 0 ? (order.get(index) ?? 0) : values.reduce((sum, value) => sum + value, 0) / values.length;
  };

  for (let sweep = 0; sweep < SWEEPS; sweep += 1) {
    const forward = sweep % 2 === 0;
    const sequence = forward ? columns.map((_, position) => position).slice(1) : columns.map((_, position) => position).slice(0, -1).reverse();

    for (const position of sequence) {
      const column = columns[position] as number[];
      const scored = column.map((index) => ({ index, score: average(index, forward ? "preds" : "succs") }));

      scored.sort((a, b) => a.score - b.score || (order.get(a.index) ?? 0) - (order.get(b.index) ?? 0));
      columns[position] = scored.map((item) => item.index);

      (columns[position] as number[]).forEach((index, slot) => order.set(index, slot));
    }
  }

  const nodes: MapNode[] = [];
  const byId = new Map<string, MapNode>();
  let tallest = 0;

  columns.forEach((column, columnIndex) => {
    tallest = Math.max(tallest, column.length);

    column.forEach((index, row) => {
      const item = net.activities[index] as ScheduleActivity;
      const done = net.done[index] === true;
      const start = done ? toDay(item.actualStart ?? item.currentStart) : modelDay(prepared, prepared.base.start[index] ?? 0);
      const finish = done ? toDay(item.actualFinish ?? item.currentFinish) : modelDay(prepared, prepared.base.finish[index] ?? 0);
      const slack = slackOf(index);

      const node: MapNode = {
        id: item.id,
        index,
        code: item.activityCode,
        name: item.name,
        status: item.status,
        done,
        started: net.started[index] === true,
        slack,
        critical: isCritical(index),
        start: Number.isFinite(start) ? start : null,
        finish: Number.isFinite(finish) ? finish : null,
        level: columnIndex,
        row,
        x: PAD + columnIndex * (NODE_W + GAP_X),
        y: PAD + row * (NODE_H + GAP_Y),
      };

      nodes.push(node);
      byId.set(node.id, node);
    });
  });

  const edges: MapEdge[] = [];

  for (const from of keep) {
    for (const link of net.succs[from] ?? []) {
      if (!keep.has(link.other)) {
        continue;
      }

      const source = byId.get((net.activities[from] as ScheduleActivity).id);
      const target = byId.get((net.activities[link.other] as ScheduleActivity).id);

      if (!source || !target) {
        continue;
      }

      const info = relations.get(`${from}>${link.other}>${link.type}`) ?? { spare: null, driving: false };
      const x1 = source.x + NODE_W;
      const y1 = source.y + NODE_H / 2;
      const x2 = target.x;
      const y2 = target.y + NODE_H / 2;
      const reach = Math.max(24, Math.min(120, Math.abs(x2 - x1) / 2));

      edges.push({
        key: `${source.id}>${target.id}>${link.type}`,
        from: source.id,
        to: target.id,
        type: link.type,
        lag: link.lag,
        driving: info.driving,
        spare: info.spare,
        d: `M${x1},${y1} C${x1 + reach},${y1} ${x2 - reach},${y2} ${x2},${y2}`,
      });
    }
  }

  return {
    nodes,
    edges,
    levels,
    width: PAD * 2 + levels * NODE_W + (levels - 1) * GAP_X,
    height: PAD * 2 + tallest * NODE_H + Math.max(0, tallest - 1) * GAP_Y,
    tooMany: false,
    total,
    hiddenDone,
  };
}

export function wiringOf(prepared: Prepared, id: string): Wiring | null {
  const { net } = prepared;
  const index = net.position.get(id);

  if (index === undefined) {
    return null;
  }

  const relations = linkMap(prepared);
  const describe = (other: number, type: ScheduleDependencyType, lag: number, key: string) => {
    const item = net.activities[other] as ScheduleActivity;
    const info = relations.get(key) ?? { spare: null, driving: false };

    return { id: item.id, code: item.activityCode, name: item.name, type, lag, driving: info.driving, spare: info.spare };
  };

  return {
    predecessors: (net.preds[index] ?? []).map((link) => describe(link.other, link.type, link.lag, `${link.other}>${index}>${link.type}`)),
    successors: (net.succs[index] ?? []).map((link) => describe(link.other, link.type, link.lag, `${index}>${link.other}>${link.type}`)),
  };
}

export function chainOf(map: LogicMap, id: string): { ids: Set<string>; edges: Set<string> } {
  const up = new Map<string, MapEdge[]>();
  const down = new Map<string, MapEdge[]>();

  const add = (table: Map<string, MapEdge[]>, key: string, edge: MapEdge) => {
    const list = table.get(key);

    if (list) {
      list.push(edge);
    } else {
      table.set(key, [edge]);
    }
  };

  for (const edge of map.edges) {
    add(up, edge.to, edge);
    add(down, edge.from, edge);
  }

  const ids = new Set<string>([id]);
  const edges = new Set<string>();

  for (const [lookup, pick] of [
    [up, (edge: MapEdge) => edge.from],
    [down, (edge: MapEdge) => edge.to],
  ] as const) {
    const stack = [id];
    const seen = new Set<string>([id]);

    while (stack.length > 0) {
      const current = stack.pop() as string;

      for (const edge of lookup.get(current) ?? []) {
        edges.add(edge.key);

        const next = pick(edge);

        ids.add(next);

        if (!seen.has(next)) {
          seen.add(next);
          stack.push(next);
        }
      }
    }
  }

  return { ids, edges };
}

export function datesText(node: MapNode): string {
  if (node.start === null || node.finish === null) {
    return "No dates";
  }

  const short = (day: number) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(day * 86_400_000));

  return node.done ? `done ${short(node.finish)}` : `${short(node.start)} – ${short(node.finish)}`;
}

export function floatText(value: number | null): string {
  if (value === null) {
    return "—";
  }

  const rounded = Math.round(value * 10) / 10;

  return `${rounded} ${plural(rounded, "day", "days")}`;
}

export function dayLabel(day: number | null): string {
  return day === null ? "No date" : formatDay(day);
}

export function mapFailText(reason: "empty" | "invalid" | "no-links" | "cycle" | "complete", detail: string | null): string {
  switch (reason) {
    case "empty":
      return "The schedule has no activities yet, so there is no logic to draw.";
    case "complete":
      return "Every activity is complete, so there is no open work left to connect.";
    case "no-links":
      return "The activities have no logic links, so there is nothing to draw. Add predecessor links on the schedule page.";
    case "invalid":
      return detail ? `The schedule network is not valid: ${detail}.` : "The schedule network is not valid, so it cannot be drawn.";
    default:
      return `The schedule logic contains a loop${detail ? ` (${detail})` : ""}. Remove the circular links to draw the map.`;
  }
}

function esc(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function cut(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function svgMarkup(map: LogicMap, title: string): string {
  const top = 34;
  const width = Math.max(map.width, 320);
  const height = map.height + top;
  const lines: string[] = [];

  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="Helvetica, Arial, sans-serif">`);
  lines.push(`<rect width="${width}" height="${height}" fill="#ffffff"/>`);
  lines.push(`<text x="${PAD}" y="22" font-size="14" font-weight="700" fill="#19201e">${esc(title)}</text>`);
  lines.push(
    '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#9aa5a0"/></marker><marker id="r" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#c4574a"/></marker></defs>',
  );
  lines.push(`<g transform="translate(0,${top})">`);

  for (const edge of map.edges) {
    const color = edge.driving ? "#c4574a" : "#9aa5a0";

    lines.push(
      `<path d="${edge.d}" fill="none" stroke="${color}" stroke-width="${edge.driving ? 2 : 1.2}"${edge.type === "FS" ? "" : ' stroke-dasharray="5 4"'} marker-end="url(#${edge.driving ? "r" : "a"})"/>`,
    );
  }

  for (const node of map.nodes) {
    const stroke = node.critical ? "#c4574a" : node.status === "IN_PROGRESS" ? "#7fa8c9" : node.status === "ON_HOLD" ? "#d9a23a" : "#cfd5d0";
    const fill = node.done ? "#f1f3f0" : node.status === "IN_PROGRESS" ? "#eef5fb" : node.status === "ON_HOLD" ? "#fbf3e4" : "#ffffff";
    const ink = node.done ? "#7a847f" : "#19201e";

    lines.push(`<g transform="translate(${node.x},${node.y})">`);
    lines.push(`<rect width="${NODE_W}" height="${NODE_H}" rx="8" fill="${fill}" stroke="${stroke}" stroke-width="${node.critical ? 2 : 1}"/>`);
    lines.push(`<text x="10" y="18" font-size="12" font-weight="700" fill="${ink}">${esc(node.code)}</text>`);

    if (node.slack !== null) {
      lines.push(`<text x="${NODE_W - 10}" y="18" font-size="10" text-anchor="end" fill="#66706b">float ${Math.round(node.slack * 10) / 10}</text>`);
    }

    lines.push(`<text x="10" y="33" font-size="11" fill="${ink}">${esc(cut(node.name, 26))}</text>`);
    lines.push(`<text x="10" y="47" font-size="10" fill="#66706b">${esc(datesText(node))}</text>`);
    lines.push("</g>");
  }

  lines.push("</g>", "</svg>");

  return lines.join("\n");
}
