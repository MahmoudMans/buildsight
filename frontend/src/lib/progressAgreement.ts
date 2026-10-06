import { plural, toDay, trunc } from "@/lib/openItems";
import type { ProductionControl, ScheduleActivity, ScheduleControl, WorkPackage } from "@/types/project";

export const PAGE = 10;
export const GAP_POINTS = 15;
export const DATE_DAYS = 7;

export type Flag = "programmeAhead" | "siteAhead" | "programmeDone" | "siteDone" | "startedProgramme" | "startedSite" | "startDates" | "finishDates";
export type Filter = "all" | "attention" | "programmeAhead" | "siteAhead" | "dates";
export type UnlinkedReason = "none" | "unknown" | "cancelled";

export const FLAG_ORDER: Flag[] = ["programmeAhead", "siteAhead", "programmeDone", "siteDone", "startedProgramme", "startedSite", "startDates", "finishDates"];

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All packages" },
  { key: "attention", label: "Needs a look" },
  { key: "programmeAhead", label: "Programme ahead" },
  { key: "siteAhead", label: "Site ahead" },
  { key: "dates", label: "Dates differ" },
];

export const REASON_LABEL: Record<UnlinkedReason, string> = {
  none: "No work package set",
  unknown: "Work package not found",
  cancelled: "Linked to a cancelled package",
};

export interface LinkedActivity {
  code: string;
  name: string;
  status: ScheduleActivity["status"];
  progress: number;
}

export interface Row {
  id: string;
  code: string;
  name: string;
  status: WorkPackage["status"];
  site: number;
  programme: number;
  gap: number;
  activities: LinkedActivity[];
  flags: Flag[];
  startDiff: number | null;
  finishDiff: number | null;
}

export interface UnlinkedActivity extends LinkedActivity {
  reason: UnlinkedReason;
  packageCode: string | null;
}

export interface UnlinkedPackage {
  id: string;
  code: string;
  name: string;
  status: WorkPackage["status"];
  completion: number;
}

export interface Agreement {
  rows: Row[];
  unlinkedActivities: UnlinkedActivity[];
  unlinkedPackages: UnlinkedPackage[];
  activityCount: number;
  linkedActivities: number;
  packageCount: number;
  agree: number;
  programmeAhead: number;
  siteAhead: number;
  dateDiff: number;
}

export type AgreementResult = { ok: true; data: Agreement } | { ok: false; reason: "noActivities" | "noPackages" };

const AHEAD: Flag[] = ["programmeAhead", "programmeDone", "startedProgramme"];
const BEHIND: Flag[] = ["siteAhead", "siteDone", "startedSite"];

function num(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function percent(value: unknown): number {
  return Math.min(100, Math.max(0, num(value)));
}

function before(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function flagText(flag: Flag, row: Row): string {
  if (flag === "programmeAhead") {
    return `Programme ahead by ${Math.abs(row.gap)} points`;
  }

  if (flag === "siteAhead") {
    return `Site ahead by ${Math.abs(row.gap)} points`;
  }

  if (flag === "programmeDone") {
    return "Activities all complete, package not";
  }

  if (flag === "siteDone") {
    return "Package complete, activities open";
  }

  if (flag === "startedProgramme") {
    return "Started on the programme, not on site";
  }

  if (flag === "startedSite") {
    return "Started on site, not on the programme";
  }

  if (flag === "startDates") {
    const days = Math.abs(row.startDiff ?? 0);

    return `Start dates ${days} ${plural(days, "day", "days")} apart`;
  }

  const days = Math.abs(row.finishDiff ?? 0);

  return `Finish dates ${days} ${plural(days, "day", "days")} apart`;
}

export function buildAgreement(schedule: ScheduleControl, production: ProductionControl): AgreementResult {
  const activities = schedule.activities ?? [];
  const allPackages = production.workPackages ?? [];
  const live = allPackages.filter((item) => item.status !== "CANCELLED");

  if (activities.length === 0) {
    return { ok: false, reason: "noActivities" };
  }

  if (live.length === 0) {
    return { ok: false, reason: "noPackages" };
  }

  const liveById = new Map(live.map((item) => [item.id, item]));
  const allById = new Map(allPackages.map((item) => [item.id, item]));
  const grouped = new Map<string, ScheduleActivity[]>();
  const unlinkedActivities: UnlinkedActivity[] = [];

  for (const activity of activities) {
    const id = activity.workPackageId;
    const progress = percent(activity.progressPercentage);
    const base = { code: activity.activityCode, name: activity.name, status: activity.status, progress };

    if (!id) {
      unlinkedActivities.push({ ...base, reason: "none", packageCode: null });
    } else if (liveById.has(id)) {
      grouped.set(id, [...(grouped.get(id) ?? []), activity]);
    } else {
      const known = allById.get(id);

      unlinkedActivities.push({ ...base, reason: known ? "cancelled" : "unknown", packageCode: known ? known.code : null });
    }
  }

  const rows: Row[] = [];
  const unlinkedPackages: UnlinkedPackage[] = [];

  for (const item of live) {
    const linked = grouped.get(item.id);

    if (!linked || linked.length === 0) {
      unlinkedPackages.push({ id: item.id, code: item.code, name: item.name, status: item.status, completion: percent(item.completionPercentage) });
      continue;
    }

    let weight = 0;
    let weighted = 0;

    for (const activity of linked) {
      const w = num(activity.originalDurationDays) > 0 ? num(activity.originalDurationDays) : 1;

      weight += w;
      weighted += w * percent(activity.progressPercentage);
    }

    const programme = Math.round(weighted / weight);
    const site = Math.round(percent(item.completionPercentage));
    const gap = programme - site;
    const allDone = linked.every((activity) => activity.status === "COMPLETED");
    const someStarted = linked.some((activity) => activity.status !== "NOT_STARTED" || percent(activity.progressPercentage) > 0);
    const flags = new Set<Flag>();

    if (gap >= GAP_POINTS) {
      flags.add("programmeAhead");
    }

    if (gap <= -GAP_POINTS) {
      flags.add("siteAhead");
    }

    if (allDone && item.status !== "COMPLETED") {
      flags.add("programmeDone");
    }

    if (item.status === "COMPLETED" && !allDone) {
      flags.add("siteDone");
    }

    if (item.status === "PLANNED" && someStarted) {
      flags.add("startedProgramme");
    }

    if (!someStarted && (item.status === "IN_PROGRESS" || item.status === "BLOCKED" || item.status === "COMPLETED") && site > 0) {
      flags.add("startedSite");
    }

    const packageStart = toDay(item.actualStartDate);
    const starts = linked.map((activity) => toDay(activity.actualStart)).filter((day) => Number.isFinite(day));
    const startDiff = Number.isFinite(packageStart) && starts.length > 0 ? Math.min(...starts) - packageStart : null;

    if (startDiff !== null && Math.abs(startDiff) >= DATE_DAYS) {
      flags.add("startDates");
    }

    const packageEnd = toDay(item.actualEndDate);
    const finishes = linked.map((activity) => toDay(activity.actualFinish)).filter((day) => Number.isFinite(day));
    const finishDiff = item.status === "COMPLETED" && allDone && Number.isFinite(packageEnd) && finishes.length > 0 ? Math.max(...finishes) - packageEnd : null;

    if (finishDiff !== null && Math.abs(finishDiff) >= DATE_DAYS) {
      flags.add("finishDates");
    }

    rows.push({
      id: item.id,
      code: item.code,
      name: item.name,
      status: item.status,
      site,
      programme,
      gap,
      activities: linked.map((activity) => ({ code: activity.activityCode, name: activity.name, status: activity.status, progress: percent(activity.progressPercentage) })),
      flags: FLAG_ORDER.filter((flag) => flags.has(flag)),
      startDiff,
      finishDiff,
    });
  }

  rows.sort((a, b) => Number(b.flags.length > 0) - Number(a.flags.length > 0) || (a.flags.length > 0 ? Math.abs(b.gap) - Math.abs(a.gap) || b.flags.length - a.flags.length : 0) || before(a.code, b.code));
  unlinkedActivities.sort((a, b) => b.progress - a.progress || before(a.code, b.code));
  unlinkedPackages.sort((a, b) => b.completion - a.completion || before(a.code, b.code));

  return {
    ok: true,
    data: {
      rows,
      unlinkedActivities,
      unlinkedPackages,
      activityCount: activities.length,
      linkedActivities: activities.length - unlinkedActivities.length,
      packageCount: live.length,
      agree: rows.filter((row) => row.flags.length === 0).length,
      programmeAhead: rows.filter((row) => row.flags.some((flag) => AHEAD.includes(flag))).length,
      siteAhead: rows.filter((row) => row.flags.some((flag) => BEHIND.includes(flag))).length,
      dateDiff: rows.filter((row) => row.flags.includes("startDates") || row.flags.includes("finishDates")).length,
    },
  };
}

export function filterRows(rows: Row[], filter: Filter): Row[] {
  if (filter === "attention") {
    return rows.filter((row) => row.flags.length > 0);
  }

  if (filter === "programmeAhead") {
    return rows.filter((row) => row.flags.some((flag) => AHEAD.includes(flag)));
  }

  if (filter === "siteAhead") {
    return rows.filter((row) => row.flags.some((flag) => BEHIND.includes(flag)));
  }

  if (filter === "dates") {
    return rows.filter((row) => row.flags.includes("startDates") || row.flags.includes("finishDates"));
  }

  return rows;
}

export function agreementMarkdown(data: Agreement, shown: Row[], projectName: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const linked = data.rows.length;

  lines.push(`# Programme vs site progress: ${projectName}`, "");
  lines.push(`${linked} ${plural(linked, "work package", "work packages")} compared with ${data.linkedActivities} linked schedule ${plural(data.linkedActivities, "activity", "activities")}.`, "");
  lines.push(`- Agree: ${data.agree} of ${linked}`);
  lines.push(`- Programme ahead of site: ${data.programmeAhead}`);
  lines.push(`- Site ahead of programme: ${data.siteAhead}`);
  lines.push(`- Start or finish dates differ: ${data.dateDiff}`);
  lines.push(`- Activities with no usable work package: ${data.unlinkedActivities.length} of ${data.activityCount}`);
  lines.push(`- Work packages with no programme activity: ${data.unlinkedPackages.length} of ${data.packageCount}`, "");

  if (shown.length > 0) {
    lines.push(filterLabel ? `Packages (${filterLabel.toLowerCase()}):` : "Packages:", "", "| Package | Programme | Site | Gap | Notes |", "| --- | ---: | ---: | ---: | --- |");

    for (const row of shown.slice(0, 25)) {
      const gap = row.gap > 0 ? `+${row.gap}` : row.gap < 0 ? `−${Math.abs(row.gap)}` : "0";

      lines.push(`| ${cell(trunc(`${row.code} ${row.name}`, 40))} | ${row.programme}% | ${row.site}% | ${gap} | ${row.flags.map((flag) => flagText(flag, row)).join("; ") || "—"} |`);
    }

    lines.push("");
  }

  if (data.unlinkedActivities.length > 0) {
    lines.push("Activities with no usable work package:", "");

    for (const item of data.unlinkedActivities.slice(0, 15)) {
      lines.push(`- ${cell(`${item.code} ${item.name}`)}, ${item.progress}% complete (${REASON_LABEL[item.reason].toLowerCase()})`);
    }

    lines.push("");
  }

  lines.push(
    `Programme progress is the average of the linked activities' progress weighted by their original duration. Site progress is the work package's completion percentage. A gap of ${GAP_POINTS} points or more, or start and finish dates ${DATE_DAYS} days or more apart, is flagged. Cancelled packages are left out.`,
    "",
  );

  return lines.join("\n");
}
