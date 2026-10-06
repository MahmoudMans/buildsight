import { formatDay, plural, toDay, trunc, words } from "@/lib/openItems";
import type { IssueSeverity, IssueStatus, ProjectIssue, ProjectRisk, RiskControl, RiskExposureBand, RiskStatus } from "@/types/project";

export const PAGE = 10;
export const MIN_GROUP = 3;
export const MARGIN = 0.05;

export type Filter = "all" | "late" | "open";
export type Verdict = "higher" | "same" | "lower";

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "late", label: "Mitigation already due" },
  { key: "open", label: "Issue still open" },
];

export const BANDS: ReadonlyArray<{ key: RiskExposureBand; label: string }> = [
  { key: "CRITICAL", label: "Critical" },
  { key: "HIGH", label: "High" },
  { key: "MODERATE", label: "Moderate" },
  { key: "LOW", label: "Low" },
];

const SEVERITY_RANK: Record<IssueSeverity, number> = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };

export const STATUS_LABEL: Record<RiskStatus, string> = {
  OPEN: "Open",
  MITIGATING: "Mitigating",
  ACCEPTED: "Accepted",
  CLOSED: "Closed",
};

export interface IssueItem {
  id: string;
  reference: string;
  title: string;
  severity: IssueSeverity;
  status: IssueStatus;
  raised: number | null;
  open: boolean;
}

export interface Materialised {
  id: string;
  reference: string;
  title: string;
  category: string;
  band: RiskExposureBand;
  owner: string | null;
  status: RiskStatus;
  registered: number | null;
  mitigationDue: number | null;
  issues: IssueItem[];
  firstIssue: number | null;
  lead: number | null;
  late: boolean | null;
  openIssues: number;
  worst: IssueSeverity;
  closedWithOpen: boolean;
}

export interface Rate {
  key: string;
  label: string;
  risks: number;
  materialised: number;
  rate: number | null;
}

export interface Calibration {
  high: Rate;
  low: Rate;
  verdict: Verdict | null;
}

export interface Materialisation {
  risks: number;
  openRisks: number;
  materialised: Materialised[];
  rate: number | null;
  linkedIssues: number;
  unforeseen: IssueItem[];
  unforeseenShare: number | null;
  dangling: number;
  late: number;
  lateKnown: number;
  lateShare: number | null;
  medianLead: number | null;
  openFromRisks: number;
  closedWithOpen: number;
  bands: Rate[];
  categories: Rate[];
  calibration: Calibration;
  skipped: number;
}

export type MaterialisationResult = { ok: true; data: Materialisation } | { ok: false; reason: "empty" };

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

function dayOf(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

function rate(key: string, label: string, risks: number, materialised: number): Rate {
  return { key, label, risks, materialised, rate: risks > 0 ? materialised / risks : null };
}

function itemOf(issue: ProjectIssue): IssueItem {
  return {
    id: issue.id,
    reference: issue.reference,
    title: issue.title,
    severity: issue.severity,
    status: issue.status,
    raised: dayOf(issue.createdAt),
    open: issue.status === "OPEN" || issue.status === "IN_PROGRESS",
  };
}

export function buildMaterialisation(data: RiskControl): MaterialisationResult {
  const risks = data.risks ?? [];
  const issues = data.issues ?? [];

  if (risks.length === 0 && issues.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const byId = new Map<string, ProjectRisk>(risks.map((risk) => [risk.id, risk]));
  const byReference = new Map<string, ProjectRisk>(risks.map((risk) => [risk.reference.trim().toLowerCase(), risk]));
  const grouped = new Map<string, IssueItem[]>();
  const unforeseen: IssueItem[] = [];
  let dangling = 0;
  let skipped = 0;

  for (const issue of issues) {
    if (!issue.id) {
      skipped += 1;
      continue;
    }

    let risk: ProjectRisk | undefined;

    if (issue.sourceRiskId) {
      risk = byId.get(issue.sourceRiskId);

      if (!risk) {
        dangling += 1;
        continue;
      }
    } else if (issue.sourceRiskReference) {
      risk = byReference.get(issue.sourceRiskReference.trim().toLowerCase());

      if (!risk) {
        dangling += 1;
        continue;
      }
    }

    if (!risk) {
      unforeseen.push(itemOf(issue));
      continue;
    }

    grouped.set(risk.id, [...(grouped.get(risk.id) ?? []), itemOf(issue)]);
  }

  const materialised: Materialised[] = [];

  for (const risk of risks) {
    const list = grouped.get(risk.id);

    if (!list || list.length === 0) {
      continue;
    }

    const raised = list.map((item) => item.raised).filter((day): day is number => day !== null);
    const firstIssue = raised.length > 0 ? Math.min(...raised) : null;
    const registered = dayOf(risk.createdAt);
    const due = dayOf(risk.mitigationDueDate);
    const openIssues = list.filter((item) => item.open).length;

    materialised.push({
      id: risk.id,
      reference: risk.reference,
      title: risk.title,
      category: risk.category,
      band: risk.exposureBand,
      owner: risk.ownerName,
      status: risk.status,
      registered,
      mitigationDue: due,
      issues: [...list].sort((a, b) => Number(b.open) - Number(a.open) || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || (b.raised ?? 0) - (a.raised ?? 0)),
      firstIssue,
      lead: firstIssue !== null && registered !== null ? Math.max(0, firstIssue - registered) : null,
      late: firstIssue !== null && due !== null ? firstIssue > due : null,
      openIssues,
      worst: list.reduce<IssueSeverity>((best, item) => (SEVERITY_RANK[item.severity] > SEVERITY_RANK[best] ? item.severity : best), "LOW"),
      closedWithOpen: risk.status === "CLOSED" && openIssues > 0,
    });
  }

  materialised.sort((a, b) => Number(b.openIssues > 0) - Number(a.openIssues > 0) || SEVERITY_RANK[b.worst] - SEVERITY_RANK[a.worst] || (b.firstIssue ?? 0) - (a.firstIssue ?? 0) || a.reference.localeCompare(b.reference, undefined, { numeric: true }));

  const materialisedIds = new Set(materialised.map((item) => item.id));
  const bands = BANDS.map((band) => {
    const inBand = risks.filter((risk) => risk.exposureBand === band.key);

    return rate(band.key, band.label, inBand.length, inBand.filter((risk) => materialisedIds.has(risk.id)).length);
  }).filter((row) => row.risks > 0);

  const categoryKeys = [...new Set(risks.map((risk) => risk.category))];
  const categories = categoryKeys
    .map((key) => {
      const inCategory = risks.filter((risk) => risk.category === key);

      return rate(key, words(key), inCategory.length, inCategory.filter((risk) => materialisedIds.has(risk.id)).length);
    })
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1) || b.risks - a.risks || a.label.localeCompare(b.label));

  const highRisks = risks.filter((risk) => risk.exposureBand === "CRITICAL" || risk.exposureBand === "HIGH");
  const lowRisks = risks.filter((risk) => risk.exposureBand === "MODERATE" || risk.exposureBand === "LOW");
  const high = rate("high", "Critical and high", highRisks.length, highRisks.filter((risk) => materialisedIds.has(risk.id)).length);
  const low = rate("low", "Moderate and low", lowRisks.length, lowRisks.filter((risk) => materialisedIds.has(risk.id)).length);
  let verdict: Verdict | null = null;

  if (materialised.length > 0 && high.risks >= MIN_GROUP && low.risks >= MIN_GROUP && high.rate !== null && low.rate !== null) {
    verdict = high.rate > low.rate + MARGIN ? "higher" : high.rate + MARGIN < low.rate ? "lower" : "same";
  }

  const linkedIssues = materialised.reduce((sum, item) => sum + item.issues.length, 0);
  const lateKnown = materialised.filter((item) => item.late !== null).length;
  const late = materialised.filter((item) => item.late === true).length;
  const totalIssues = linkedIssues + unforeseen.length;

  unforeseen.sort((a, b) => Number(b.open) - Number(a.open) || SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || (b.raised ?? 0) - (a.raised ?? 0));

  return {
    ok: true,
    data: {
      risks: risks.length,
      openRisks: risks.filter((risk) => risk.status !== "CLOSED").length,
      materialised,
      rate: risks.length > 0 ? materialised.length / risks.length : null,
      linkedIssues,
      unforeseen,
      unforeseenShare: totalIssues > 0 ? unforeseen.length / totalIssues : null,
      dangling,
      late,
      lateKnown,
      lateShare: lateKnown > 0 ? late / lateKnown : null,
      medianLead: median(materialised.map((item) => item.lead).filter((value): value is number => value !== null)),
      openFromRisks: materialised.reduce((sum, item) => sum + item.openIssues, 0),
      closedWithOpen: materialised.filter((item) => item.closedWithOpen).length,
      bands,
      categories,
      calibration: { high, low, verdict },
      skipped,
    },
  };
}

export function filterMaterialised(rows: Materialised[], filter: Filter): Materialised[] {
  if (filter === "late") {
    return rows.filter((row) => row.late === true);
  }

  if (filter === "open") {
    return rows.filter((row) => row.openIssues > 0);
  }

  return rows;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function daysText(value: number): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);

  return `${text} ${plural(value, "day", "days")}`;
}

export function severityLabel(value: IssueSeverity): string {
  return words(value);
}

export function verdictText(calibration: Calibration): string | null {
  const { high, low, verdict } = calibration;

  if (verdict === null || high.rate === null || low.rate === null) {
    return null;
  }

  if (verdict === "higher") {
    return `Critical and high risks turned into issues more often (${pct(high.rate)}) than moderate and low ones (${pct(low.rate)}), so the ratings are pointing at the right risks.`;
  }

  if (verdict === "lower") {
    return `Critical and high risks turned into issues less often (${pct(high.rate)}) than moderate and low ones (${pct(low.rate)}), so the ratings are not predicting which risks will happen.`;
  }

  return `Critical and high risks turned into issues about as often (${pct(high.rate)}) as moderate and low ones (${pct(low.rate)}), so the ratings are not separating the risks that happen from those that do not.`;
}

export function materialisationMarkdown(data: Materialisation, shown: Materialised[], projectName: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Risk materialisation: ${projectName}`, "");
  lines.push(`${data.materialised.length} of ${data.risks} registered ${plural(data.risks, "risk", "risks")} (${pct(data.rate)}) have turned into at least one issue, ${data.linkedIssues} ${plural(data.linkedIssues, "issue", "issues")} in all.`, "");
  lines.push(`- ${data.unforeseen.length} ${plural(data.unforeseen.length, "issue was", "issues were")} never linked to a risk (${pct(data.unforeseenShare)} of the issues raised)`);

  if (data.lateKnown > 0) {
    lines.push(`- ${data.late} of ${data.lateKnown} materialised risks had their first issue after the mitigation due date`);
  }

  if (data.medianLead !== null) {
    lines.push(`- Median ${daysText(data.medianLead)} from a risk being registered to its first issue`);
  }

  lines.push(`- ${data.openFromRisks} ${plural(data.openFromRisks, "issue from a registered risk is", "issues from registered risks are")} still open`);

  const verdict = verdictText(data.calibration);

  if (verdict) {
    lines.push(`- ${verdict}`);
  }

  lines.push("");

  if (data.categories.length > 0) {
    lines.push("| Category | Risks | Became issues | Rate |", "| --- | ---: | ---: | ---: |");

    for (const row of data.categories) {
      lines.push(`| ${cell(row.label)} | ${row.risks} | ${row.materialised} | ${pct(row.rate)} |`);
    }

    lines.push("");
  }

  if (shown.length > 0) {
    lines.push(`${filterLabel ? `Risks that became issues (${filterLabel.toLowerCase()}):` : "Risks that became issues:"}`, "", "| Risk | Rating | First issue | Mitigation due | Issues | Open |", "| --- | --- | --- | --- | ---: | ---: |");

    for (const row of shown.slice(0, 20)) {
      lines.push(`| ${cell(row.reference)} ${cell(trunc(row.title, 40))} | ${words(row.band)} | ${row.firstIssue !== null ? formatDay(row.firstIssue) : "—"} | ${row.mitigationDue !== null ? formatDay(row.mitigationDue) : "—"} | ${row.issues.length} | ${row.openIssues} |`);
    }

    lines.push("");
  }

  lines.push(
    `A risk has turned into an issue when an issue is linked to it, by its identifier or by its reference. The rate is the share of all registered risks, whatever their status, that have at least one linked issue. An issue with no linked risk was not foreseen on the register. The first issue is dated by when the issue record was created, and the time to it runs from when the risk record was created. A risk is shown as materialising after its mitigation was due when its first issue came after the mitigation due date. Critical and high risks are compared with moderate and low ones only when each group has ${MIN_GROUP} or more risks.${data.dangling > 0 ? ` ${data.dangling} ${plural(data.dangling, "issue points", "issues point")} at a risk that is not on the register and ${plural(data.dangling, "is", "are")} left out.` : ""}`,
    "",
  );

  return lines.join("\n");
}
