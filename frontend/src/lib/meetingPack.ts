import {
  MODULE_LABEL,
  MODULE_PATH,
  SEVERITY_LABEL,
  buildEvents,
  buildOpenItems,
  compareOpenItems,
  formatDay,
  money,
  plural,
  toDay,
  trunc,
  words,
  type OpenItem,
  type Severity,
  type Sources,
} from "@/lib/openItems";

export type SectionKey = "position" | "late" | "decisions" | "blocked" | "week" | "risks" | "watch" | "lookahead";

export interface PackFact {
  label: string;
  value: string;
}

export interface PackLine {
  ref: string;
  title: string;
  owner: string;
  due: string;
  note: string;
  severity: Severity | null;
  path: string;
}

export interface PackSection {
  key: SectionKey;
  title: string;
  hint: string;
  facts: PackFact[];
  lines: PackLine[];
  total: number;
}

export interface PackMeta {
  title: string;
  project: string;
  date: string;
  chair: string;
  attendees: string;
  notes: string;
}

export const SECTION_DEFS: ReadonlyArray<{ key: SectionKey; title: string; hint: string }> = [
  { key: "position", title: "Where the project stands", hint: "Health, progress, forecast finish and the item counts." },
  { key: "late", title: "Overdue and needs chasing", hint: "Everything past its due date, most serious first." },
  { key: "decisions", title: "Decisions needed", hint: "Proposed decisions, change decisions, change orders, claims and awards waiting on someone." },
  { key: "blocked", title: "Blocked", hint: "Actions and work packages that cannot move." },
  { key: "week", title: "Due before the next meeting", hint: "Due from today to seven days ahead." },
  { key: "risks", title: "Top risks", hint: "Open risks with the highest residual score." },
  { key: "watch", title: "Safety and quality watch", hint: "Critical and high open safety and quality items." },
  { key: "lookahead", title: "Look ahead", hint: "Planned meetings and milestones in the next 30 days." },
];

const DECISION_KINDS = new Set(["Decision", "Change decision", "Change order decision", "Claim response", "Package award", "Certification"]);
const LOOKAHEAD_DAYS = 30;
const WEEK_DAYS = 7;

function lineOf(item: OpenItem, note: string): PackLine {
  return {
    ref: item.kind === "Milestone" ? "Milestone" : item.reference,
    title: item.title,
    owner: item.owner?.trim() || "Unassigned",
    due: Number.isFinite(item.due) ? formatDay(item.due) : "No date",
    note,
    severity: item.severity,
    path: MODULE_PATH[item.module],
  };
}

function lateText(item: OpenItem, today: number): string {
  const days = today - item.due;

  return `${days} ${plural(days, "day", "days")} late · ${MODULE_LABEL[item.module]}`;
}

function section(key: SectionKey, facts: PackFact[], lines: PackLine[], total: number): PackSection {
  const def = SECTION_DEFS.find((item) => item.key === key);

  return { key, title: def?.title ?? key, hint: def?.hint ?? "", facts, lines, total };
}

export function buildPack(sources: Sources, today: number, limit: number): Record<SectionKey, PackSection> {
  const all = buildOpenItems(sources, today).sort(compareOpenItems);
  const events = buildEvents(sources);
  const dated = (item: OpenItem) => Number.isFinite(item.due);

  const late = all.filter((item) => dated(item) && item.due < today);
  const decisions = all.filter((item) => DECISION_KINDS.has(item.kind));
  const blocked = all.filter((item) => item.kind === "Blocked work package" || item.detail.startsWith("Blocked"));
  const week = all.filter((item) => dated(item) && item.due >= today && item.due <= today + WEEK_DAYS);
  const watch = all.filter((item) => (item.module === "safety" || item.module === "quality") && (item.severity === "critical" || item.severity === "high"));
  const ahead = events
    .filter((item) => dated(item) && item.due >= today && item.due <= today + LOOKAHEAD_DAYS)
    .sort((a, b) => a.due - b.due || a.reference.localeCompare(b.reference));

  const risks = (sources.risk?.risks ?? [])
    .filter((risk) => risk.status === "OPEN" || risk.status === "MITIGATING")
    .sort((a, b) => b.residualScore - a.residualScore || b.inherentScore - a.inherentScore);

  const facts: PackFact[] = [];
  const health = sources.center?.health;
  const project = sources.center?.project;
  const report = sources.governance?.executiveReport;

  if (health && Number.isFinite(health.score)) {
    facts.push({ label: "Health score", value: `${Math.round(health.score)} · ${words(String(health.healthBand))}` });

    if (Number.isFinite(health.actualProgressPercentage) && Number.isFinite(health.expectedProgressPercentage)) {
      facts.push({
        label: "Progress",
        value: `${health.actualProgressPercentage.toFixed(1)}% done against ${health.expectedProgressPercentage.toFixed(1)}% expected`,
      });
    }

    if (Number.isFinite(health.scheduleVarianceDays)) {
      const days = Math.round(health.scheduleVarianceDays);

      facts.push({ label: "Schedule variance", value: `${days > 0 ? "+" : days < 0 ? "−" : ""}${Math.abs(days)} ${plural(Math.abs(days), "day", "days")}` });
    }

    facts.push({ label: "Milestones", value: `${health.overdueMilestones} overdue · ${health.blockedMilestones} blocked` });
  }

  if (project) {
    facts.push({ label: "Forecast finish", value: `${formatDay(toDay(project.forecastEndDate))} (planned ${formatDay(toDay(project.plannedEndDate))})` });
  }

  if (report && typeof report.reportDate === "string") {
    if (Number.isFinite(report.cpi) && Number.isFinite(report.spi)) {
      facts.push({ label: "CPI and SPI", value: `${report.cpi.toFixed(2)} and ${report.spi.toFixed(2)}` });
    }

    if (Number.isFinite(report.expectedForecastCost)) {
      facts.push({ label: "Forecast cost", value: money(report.expectedForecastCost) });
    }
  }

  facts.push({
    label: "Open items",
    value: `${late.length} overdue · ${week.length} due this week · ${blocked.length} blocked · ${decisions.length} waiting for a decision`,
  });

  const riskSeverity = (band: string): Severity => (band === "CRITICAL" ? "critical" : band === "HIGH" ? "high" : band === "MODERATE" ? "medium" : "low");

  return {
    position: section("position", facts, [], 0),
    late: section("late", [], late.slice(0, limit).map((item) => lineOf(item, lateText(item, today))), late.length),
    decisions: section(
      "decisions",
      [],
      decisions.slice(0, limit).map((item) => lineOf(item, trunc(item.detail, 110))),
      decisions.length,
    ),
    blocked: section("blocked", [], blocked.slice(0, limit).map((item) => lineOf(item, trunc(item.detail, 110))), blocked.length),
    week: section(
      "week",
      [],
      week.slice(0, limit).map((item) => lineOf(item, `${item.kind} · ${MODULE_LABEL[item.module]}`)),
      week.length,
    ),
    risks: section(
      "risks",
      [],
      risks.slice(0, limit).map((risk) => ({
        ref: risk.reference,
        title: risk.title,
        owner: risk.ownerName?.trim() || "Unassigned",
        due: formatDay(toDay(risk.mitigationDueDate)),
        note: `${words(String(risk.exposureBand))} exposure · residual score ${risk.residualScore}`,
        severity: riskSeverity(String(risk.exposureBand)),
        path: MODULE_PATH.risk,
      })),
      risks.length,
    ),
    watch: section("watch", [], watch.slice(0, limit).map((item) => lineOf(item, `${item.kind} · ${trunc(item.detail, 90)}`)), watch.length),
    lookahead: section("lookahead", [], ahead.slice(0, limit).map((item) => lineOf(item, item.detail)), ahead.length),
  };
}

function cell(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

export function packToMarkdown(meta: PackMeta, sections: ReadonlyArray<PackSection>, stamp: string): string {
  const out: string[] = [];

  out.push(`# ${meta.title} · ${meta.project}`);
  out.push("");
  out.push(`**Date:** ${meta.date}`);

  if (meta.chair.trim()) {
    out.push(`**Chair:** ${meta.chair.trim()}`);
  }

  if (meta.attendees.trim()) {
    out.push(`**Attendees:** ${meta.attendees.trim()}`);
  }

  if (meta.notes.trim()) {
    out.push("");
    out.push(meta.notes.trim());
  }

  sections.forEach((item, index) => {
    out.push("");
    out.push(`## ${index + 1}. ${item.title}${item.key === "position" ? "" : ` (${item.total})`}`);
    out.push("");

    if (item.key === "position") {
      for (const fact of item.facts) {
        out.push(`- **${fact.label}:** ${fact.value}`);
      }

      return;
    }

    if (item.lines.length === 0) {
      out.push("Nothing to report.");

      return;
    }

    out.push("| Ref | Item | Owner | Due | Note |");
    out.push("| --- | --- | --- | --- | --- |");

    for (const line of item.lines) {
      const severity = line.severity ? ` (${SEVERITY_LABEL[line.severity].toLowerCase()})` : "";

      out.push(`| ${cell(line.ref)} | ${cell(line.title)}${severity} | ${cell(line.owner)} | ${cell(line.due)} | ${cell(line.note)} |`);
    }

    if (item.total > item.lines.length) {
      out.push("");
      out.push(`_Showing ${item.lines.length} of ${item.total}. The rest are in the action inbox._`);
    }
  });

  out.push("");
  out.push(`## ${sections.length + 1}. Actions from this meeting`);
  out.push("");
  out.push("- [ ] ");
  out.push("- [ ] ");
  out.push("- [ ] ");
  out.push("");
  out.push(`## ${sections.length + 2}. Any other business`);
  out.push("");
  out.push("");
  out.push(`_Prepared by BuildSight on ${stamp}._`);

  return `${out.join("\n")}\n`;
}
