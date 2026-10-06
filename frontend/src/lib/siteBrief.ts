import { buildOpenItems, formatDay, plural, toDay, words, type OpenItem, type Sources } from "@/lib/openItems";

export const LIST_LIMIT = 8;
export const UNSAFE_WINDOW_DAYS = 14;
export const HORIZONS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 1, label: "Tomorrow" },
  { days: 3, label: "3 days" },
  { days: 7, label: "A week" },
];

export type SectionKey = "permits" | "inspections" | "meetings" | "blocked" | "progress" | "deliveries" | "due" | "overdue";

export interface BriefItem {
  id: string;
  text: string;
  meta: string;
  flag: string | null;
  alert: boolean;
}

export interface BriefSection {
  key: SectionKey;
  title: string;
  hint: string;
  items: BriefItem[];
  total: number;
  empty: string;
  missing: boolean;
}

export interface Talk {
  label: string;
  count: number;
}

export interface SafetyFigures {
  sinceIncident: number | null;
  sinceLostTime: number | null;
  lastIncident: string | null;
  permitsInForce: number;
  openActions: number;
  overdueActions: number;
  unsafe: number;
  talks: Talk[];
}

export interface LatestReport {
  reference: string;
  day: number;
  daysAgo: number;
  weather: string;
  labor: number;
  equipment: number;
  notes: string | null;
}

export interface Brief {
  today: number;
  horizon: number;
  sections: BriefSection[];
  safety: SafetyFigures;
  report: LatestReport | null;
}

function tidy(value: string): string {
  return words(value).replace(/\b(ppe|hse|mep)\b/gi, (match) => match.toUpperCase());
}

function clock(value: string): string {
  return value.length >= 16 ? value.slice(11, 16) : "";
}

function when(day: number, today: number): string {
  const gap = day - today;

  if (gap === 0) {
    return "today";
  }

  if (gap === 1) {
    return "tomorrow";
  }

  if (gap < 0) {
    return `${-gap} ${plural(-gap, "day", "days")} overdue`;
  }

  return `in ${gap} days`;
}

function section(key: SectionKey, title: string, hint: string, empty: string, items: BriefItem[], missing: boolean): BriefSection {
  return { key, title, hint, items: items.slice(0, LIST_LIMIT), total: items.length, empty, missing };
}

const DUE_KINDS_SKIPPED = new Set(["Work permit", "Inspection", "Meeting", "Blocked work package", "Package award", "Milestone"]);

function fromOpen(item: OpenItem, today: number): BriefItem {
  return {
    id: item.id,
    text: `${item.reference} ${item.title}`.trim(),
    meta: `${item.kind}${item.owner ? ` · ${item.owner}` : ""}${Number.isFinite(item.due) ? ` · ${when(item.due, today)}` : ""}`,
    flag: item.severity === "critical" ? "Critical" : item.severity === "high" ? "High" : null,
    alert: item.severity === "critical" || item.severity === "high",
  };
}

export function buildBrief(sources: Sources, failed: string[], today: number, horizon: number): Brief {
  const lost = new Set(failed);
  const end = today + horizon;
  const safety = sources.safety;
  const quality = sources.quality;
  const production = sources.production;
  const procurement = sources.procurement;
  const governance = sources.governance;

  const permits: Array<{ rank: number; item: BriefItem }> = [];
  let inForce = 0;

  for (const permit of safety?.permits ?? []) {
    const from = toDay(permit.validFrom);
    const until = toDay(permit.validUntil);
    const label = `${permit.reference} ${tidy(permit.permitType)}: ${permit.title}`;
    const meta = [permit.location, permit.receiverName ? `receiver ${permit.receiverName}` : null].filter(Boolean).join(" · ");

    if (permit.status === "ACTIVE" && Number.isFinite(until) && until < today) {
      permits.push({ rank: 0, item: { id: permit.id, text: label, meta: `${meta ? `${meta} · ` : ""}ended ${formatDay(until)}`, flag: "Expired, still open", alert: true } });
    } else if (permit.status === "ACTIVE" && Number.isFinite(from) && from <= today) {
      inForce += 1;

      const closing = Number.isFinite(until) && until <= today;

      permits.push({
        rank: closing ? 1 : 2,
        item: { id: permit.id, text: label, meta: `${meta ? `${meta} · ` : ""}until ${formatDay(until)}`, flag: closing ? "Expires today" : null, alert: closing },
      });
    } else if ((permit.status === "ACTIVE" || permit.status === "DRAFT") && Number.isFinite(from) && from > today && from <= end) {
      permits.push({ rank: 3, item: { id: permit.id, text: label, meta: `${meta ? `${meta} · ` : ""}from ${formatDay(from)}`, flag: `Starts ${when(from, today)}`, alert: false } });
    }
  }

  permits.sort((a, b) => a.rank - b.rank);

  const inspections: Array<{ rank: number; day: number; item: BriefItem }> = [];

  for (const inspection of quality?.inspections ?? []) {
    if (inspection.status !== "PLANNED" && inspection.status !== "IN_PROGRESS") {
      continue;
    }

    const day = toDay(inspection.plannedDate);

    if (!Number.isFinite(day) || day > end) {
      continue;
    }

    const late = day < today;

    inspections.push({
      rank: late ? 1 : 0,
      day,
      item: {
        id: inspection.id,
        text: `${inspection.reference} ${inspection.title}`,
        meta: `${tidy(inspection.discipline)}${inspection.inspectorName ? ` · ${inspection.inspectorName}` : ""} · ${words(inspection.status).toLowerCase()}`,
        flag: when(day, today),
        alert: late,
      },
    });
  }

  inspections.sort((a, b) => a.rank - b.rank || (a.rank === 0 ? a.day - b.day : b.day - a.day));

  const meetings = (governance?.meetings ?? [])
    .filter((meeting) => meeting.status === "PLANNED" && toDay(meeting.scheduledAt) >= today && toDay(meeting.scheduledAt) <= end)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
    .map(
      (meeting): BriefItem => ({
        id: meeting.id,
        text: `${meeting.meetingNumber} ${meeting.title}`,
        meta: `${tidy(meeting.meetingType)}${clock(meeting.scheduledAt) ? ` · ${clock(meeting.scheduledAt)}` : ""}${meeting.chairName ? ` · chair ${meeting.chairName}` : ""}`,
        flag: when(toDay(meeting.scheduledAt), today),
        alert: false,
      }),
    );

  const packages = production?.workPackages ?? [];

  const blocked = packages
    .filter((item) => item.status === "BLOCKED")
    .map(
      (item): BriefItem => ({
        id: item.id,
        text: `${item.code} ${item.name}`,
        meta: item.blockReason ? `Blocked: ${item.blockReason}` : "Blocked, no reason recorded",
        flag: "Blocked",
        alert: true,
      }),
    );

  const progress = packages
    .filter((item) => item.status === "IN_PROGRESS")
    .map((item) => ({ item, gap: (item.expectedProgressPercentage ?? 0) - (item.completionPercentage ?? 0) }))
    .sort((a, b) => b.gap - a.gap)
    .map(
      ({ item, gap }): BriefItem => ({
        id: item.id,
        text: `${item.code} ${item.name}`,
        meta: `${Math.round(item.completionPercentage)}% done, plan says ${Math.round(item.expectedProgressPercentage)}%`,
        flag: gap >= 10 ? `${Math.round(gap)} points behind` : null,
        alert: gap >= 10,
      }),
    );

  const deliveries = (procurement?.packages ?? [])
    .filter((item) => item.status === "AWARDED" || item.status === "EVALUATION" || item.status === "TENDERING")
    .map((item) => ({ item, day: toDay(item.requiredOnSiteDate) }))
    .filter(({ day }) => Number.isFinite(day) && day <= today + Math.max(horizon, 7))
    .sort((a, b) => a.day - b.day)
    .map(
      ({ item, day }): BriefItem => ({
        id: item.id,
        text: `${item.reference} ${item.title}`,
        meta: `${item.awardedSupplierName ?? "Not yet awarded"} · needed ${formatDay(day)} · ${words(item.status).toLowerCase()}`,
        flag: when(day, today),
        alert: day < today || item.status !== "AWARDED",
      }),
    );

  const open = buildOpenItems(sources, today).filter((item) => !DUE_KINDS_SKIPPED.has(item.kind));

  const due = open
    .filter((item) => Number.isFinite(item.due) && item.due >= today && item.due <= end)
    .sort((a, b) => a.due - b.due || a.reference.localeCompare(b.reference))
    .map((item) => fromOpen(item, today));

  const overdue = open
    .filter((item) => Number.isFinite(item.due) && item.due < today && (item.severity === "critical" || item.severity === "high"))
    .sort((a, b) => (b.severity === "critical" ? 1 : 0) - (a.severity === "critical" ? 1 : 0) || a.due - b.due)
    .map((item) => fromOpen(item, today));

  const incidents = (safety?.incidents ?? []).filter((item) => item.status !== "VOID");

  const lastOf = (list: typeof incidents) =>
    list.reduce((best, item) => {
      const day = toDay(item.occurredDate);

      return Number.isFinite(day) && day > best ? day : best;
    }, -Infinity);

  const lastAny = lastOf(incidents.filter((item) => item.incidentType !== "NEAR_MISS"));
  const lastLostTime = lastOf(incidents.filter((item) => item.incidentType === "LOST_TIME_INJURY"));

  const tally = new Map<string, number>();
  let unsafe = 0;

  for (const observation of safety?.observations ?? []) {
    const day = toDay(observation.observedDate);

    if ((observation.observationType === "UNSAFE_ACT" || observation.observationType === "UNSAFE_CONDITION") && Number.isFinite(day) && day > today - UNSAFE_WINDOW_DAYS && day <= today) {
      unsafe += 1;
      tally.set(tidy(observation.hazardCategory), (tally.get(tidy(observation.hazardCategory)) ?? 0) + 1);
    }
  }

  const talks = [...tally.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 3);

  const openActions = (safety?.actions ?? []).filter((item) => item.status !== "CLOSED" && item.status !== "VOID");

  const reports = (production?.siteReports ?? [])
    .filter((item) => toDay(item.reportDate) <= today)
    .sort((a, b) => toDay(b.reportDate) - toDay(a.reportDate));

  const latest = reports[0];

  return {
    today,
    horizon,
    sections: [
      section("permits", "Permits to work", "In force today, closing, or starting soon.", "No permits in force or due to start.", permits.map((entry) => entry.item), lost.has("safety")),
      section("inspections", "Inspections", "Planned in the window, then any that slipped.", "No inspections are due.", inspections.map((entry) => entry.item), lost.has("quality")),
      section("meetings", "Meetings", "Planned meetings in the window.", "No meetings are planned.", meetings, lost.has("governance")),
      section("blocked", "Blocked work", "Cannot proceed until the reason is cleared.", "No work package is blocked.", blocked, lost.has("production")),
      section("progress", "Work in progress", "Furthest behind plan first.", "No work package is in progress.", progress, lost.has("production")),
      section("deliveries", "Needed on site", "Packages whose required-on-site date is close.", "Nothing is due on site soon.", deliveries, lost.has("procurement")),
      section("due", "Due in the window", "Actions, RFIs, issues and similar that fall due.", "Nothing falls due in this window.", due, false),
      section("overdue", "Overdue and serious", "High or critical items already past their date.", "No serious item is overdue.", overdue, false),
    ],
    safety: {
      sinceIncident: Number.isFinite(lastAny) ? today - lastAny : null,
      sinceLostTime: Number.isFinite(lastLostTime) ? today - lastLostTime : null,
      lastIncident: Number.isFinite(lastAny) ? formatDay(lastAny) : null,
      permitsInForce: inForce,
      openActions: openActions.length,
      overdueActions: openActions.filter((item) => item.overdue).length,
      unsafe,
      talks,
    },
    report: latest
      ? {
          reference: latest.reference,
          day: toDay(latest.reportDate),
          daysAgo: today - toDay(latest.reportDate),
          weather: words(latest.weatherCondition),
          labor: latest.totalLaborHours,
          equipment: latest.totalEquipmentHours,
          notes: latest.generalNotes,
        }
      : null,
  };
}

export function longDate(day: number): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(day * 86_400_000));
}

export function briefText(brief: Brief, projectName: string): string {
  const lines: string[] = [`SITE BRIEF: ${projectName}`, longDate(brief.today), ""];
  const safety = brief.safety;

  lines.push("SAFETY");
  lines.push(`- Days since last incident: ${safety.sinceIncident === null ? "none recorded" : safety.sinceIncident}`);
  lines.push(`- Days since last lost-time injury: ${safety.sinceLostTime === null ? "none recorded" : safety.sinceLostTime}`);
  lines.push(`- Permits in force: ${safety.permitsInForce}`);
  lines.push(`- Open safety actions: ${safety.openActions}${safety.overdueActions > 0 ? ` (${safety.overdueActions} overdue)` : ""}`);

  if (safety.talks.length > 0) {
    lines.push(`- Toolbox talk, unsafe observations in the last ${UNSAFE_WINDOW_DAYS} days: ${safety.talks.map((talk) => `${talk.label} (${talk.count})`).join(", ")}`);
  }

  if (brief.report) {
    lines.push("", `LATEST SITE REPORT (${longDate(brief.report.day)})`);
    lines.push(`- Weather: ${brief.report.weather}`);
    lines.push(`- Labour hours: ${Math.round(brief.report.labor)}, equipment hours: ${Math.round(brief.report.equipment)}`);

    if (brief.report.notes) {
      lines.push(`- Notes: ${brief.report.notes}`);
    }
  }

  for (const part of brief.sections) {
    if (part.items.length === 0) {
      continue;
    }

    lines.push("", `${part.title.toUpperCase()}${part.total > part.items.length ? ` (${part.total})` : ""}`);

    for (const item of part.items) {
      lines.push(`- ${item.text}${item.flag ? ` [${item.flag}]` : ""}${item.meta ? ` (${item.meta})` : ""}`);
    }

    if (part.total > part.items.length) {
      lines.push(`- and ${part.total - part.items.length} more`);
    }
  }

  return `${lines.join("\n")}\n`;
}
