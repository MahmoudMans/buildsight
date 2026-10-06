import {
  MODULE_LABEL,
  compareOpenItems,
  formatDay,
  plural,
  trunc,
  type ModuleKey,
  type OpenItem,
} from "@/lib/openItems";

export const UNASSIGNED = "Unassigned";
export const SOON_DAYS = 7;

export interface OwnerLoad {
  key: string;
  name: string;
  assigned: boolean;
  items: OpenItem[];
  total: number;
  overdue: number;
  soon: number;
  later: number;
  undated: number;
  urgent: number;
  oldestLate: number;
  byModule: Array<{ module: ModuleKey; count: number }>;
}

function cleanName(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function buildLoads(items: OpenItem[], today: number): OwnerLoad[] {
  const groups = new Map<string, { name: string; items: OpenItem[] }>();

  for (const item of items) {
    const name = cleanName(item.owner);
    const key = name === "" ? "" : name.toLowerCase();
    const group = groups.get(key);

    if (group) {
      group.items.push(item);
    } else {
      groups.set(key, { name: name === "" ? UNASSIGNED : name, items: [item] });
    }
  }

  const loads: OwnerLoad[] = [];

  for (const [key, group] of groups) {
    const sorted = [...group.items].sort(compareOpenItems);
    const modules = new Map<ModuleKey, number>();

    let overdue = 0;
    let soon = 0;
    let later = 0;
    let undated = 0;
    let urgent = 0;
    let oldestLate = 0;

    for (const item of sorted) {
      modules.set(item.module, (modules.get(item.module) ?? 0) + 1);

      if (item.severity === "critical" || item.severity === "high") {
        urgent += 1;
      }

      if (!Number.isFinite(item.due)) {
        undated += 1;
        continue;
      }

      const days = item.due - today;

      if (days < 0) {
        overdue += 1;
        oldestLate = Math.max(oldestLate, -days);
      } else if (days <= SOON_DAYS) {
        soon += 1;
      } else {
        later += 1;
      }
    }

    loads.push({
      key: key === "" ? "__unassigned" : key,
      name: group.name,
      assigned: key !== "",
      items: sorted,
      total: sorted.length,
      overdue,
      soon,
      later,
      undated,
      urgent,
      oldestLate,
      byModule: [...modules.entries()]
        .map(([module, count]) => ({ module, count }))
        .sort((a, b) => b.count - a.count || MODULE_LABEL[a.module].localeCompare(MODULE_LABEL[b.module])),
    });
  }

  return loads;
}

function dueWords(due: number, today: number): string {
  if (!Number.isFinite(due)) {
    return "no due date";
  }

  const days = due - today;

  if (days < 0) {
    return `${-days} ${plural(-days, "day", "days")} late`;
  }

  if (days === 0) {
    return "due today";
  }

  return `due ${formatDay(due)}`;
}

export function chaseMessage(load: OwnerLoad, projectName: string, today: number, limit: number): string {
  const lines: string[] = [];

  if (load.assigned) {
    lines.push(`Hello ${load.name},`, "");

    lines.push(
      `You currently have ${load.total} open ${plural(load.total, "item", "items")} on ${projectName}` +
        (load.overdue > 0 ? `, ${load.overdue} of them overdue.` : "."),
      "",
    );
  } else {
    lines.push(
      `${load.total} open ${plural(load.total, "item", "items")} on ${projectName} ${plural(load.total, "has", "have")} no owner. Each needs a name against it.`,
      "",
    );
  }

  const groups: Array<{ label: string; test: (days: number) => boolean }> = [
    { label: "Overdue", test: (days) => days < 0 },
    { label: "Due in the next 7 days", test: (days) => days >= 0 && days <= SOON_DAYS },
    { label: "Due later", test: (days) => days > SOON_DAYS },
    { label: "No due date", test: (days) => !Number.isFinite(days) },
  ];

  let listed = 0;
  let skipped = 0;

  for (const group of groups) {
    const own = load.items
      .filter((item) => group.test(Number.isFinite(item.due) ? item.due - today : NaN))
      .sort((a, b) => (Number.isFinite(a.due) ? a.due : Infinity) - (Number.isFinite(b.due) ? b.due : Infinity));

    if (own.length === 0) {
      continue;
    }

    const room = Math.max(0, limit - listed);

    if (room === 0) {
      skipped += own.length;
      continue;
    }

    lines.push(`${group.label}:`);

    for (const item of own.slice(0, room)) {
      lines.push(`- ${item.reference} ${trunc(item.title, 80)} (${MODULE_LABEL[item.module]}, ${dueWords(item.due, today)})`);
    }

    listed += Math.min(room, own.length);
    skipped += Math.max(0, own.length - room);

    lines.push("");
  }

  if (skipped > 0) {
    lines.push(`And ${skipped} more ${plural(skipped, "item", "items")}.`, "");
  }

  lines.push(
    load.assigned
      ? "Could you confirm the status of each, or give me a new date where one has slipped? Thank you."
      : "Please say who will own each one and by when.",
  );

  return `${lines.join("\n").trimEnd()}\n`;
}
