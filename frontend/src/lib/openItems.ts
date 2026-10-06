import {
  getProjectCommandCenter,
  getProjectCommercial,
  getProjectDocuments,
  getProjectGovernance,
  getProjectProcurement,
  getProjectProduction,
  getProjectQuality,
  getProjectRiskControl,
  getProjectSafety,
} from "@/lib/api";
import type {
  CommercialControl,
  DocumentControl,
  GovernanceControl,
  Project,
  ProcurementControl,
  ProductionControl,
  ProjectCommandCenter,
  QualityControl,
  RiskControl,
  SafetyControl,
} from "@/types/project";

export const DAY_MS = 86_400_000;
const STALE_CHANGE_DAYS = 30;

export type ModuleKey =
  | "governance"
  | "risk"
  | "safety"
  | "quality"
  | "documents"
  | "commercial"
  | "procurement"
  | "production"
  | "schedule";

export type Severity = "critical" | "high" | "medium" | "low";

export interface Sources {
  center: ProjectCommandCenter | null;
  governance: GovernanceControl | null;
  risk: RiskControl | null;
  safety: SafetyControl | null;
  quality: QualityControl | null;
  documents: DocumentControl | null;
  commercial: CommercialControl | null;
  procurement: ProcurementControl | null;
  production: ProductionControl | null;
}

export interface OpenItem {
  id: string;
  module: ModuleKey;
  kind: string;
  reference: string;
  title: string;
  owner: string | null;
  due: number;
  severity: Severity;
  detail: string;
}


export const MODULES: ReadonlyArray<{ key: ModuleKey; label: string; path: string }> = [
  { key: "governance", label: "Governance", path: "governance" },
  { key: "risk", label: "Risk", path: "risk-control" },
  { key: "safety", label: "Safety", path: "safety" },
  { key: "quality", label: "Quality", path: "quality" },
  { key: "documents", label: "Documents", path: "documents" },
  { key: "commercial", label: "Commercial", path: "commercial" },
  { key: "procurement", label: "Procurement", path: "procurement" },
  { key: "production", label: "Production", path: "production" },
  { key: "schedule", label: "Schedule", path: "schedule" },
];

export const MODULE_LABEL = Object.fromEntries(MODULES.map((item) => [item.key, item.label])) as Record<ModuleKey, string>;
export const MODULE_PATH = Object.fromEntries(MODULES.map((item) => [item.key, item.path])) as Record<ModuleKey, string>;

export const SEVERITY_RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};


export function startOfToday(): number {
  const now = new Date();

  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

export function toDay(value: string | null | undefined): number {
  if (!value) {
    return NaN;
  }

  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS);
}

export function formatDay(day: number): string {
  if (!Number.isFinite(day)) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(day * DAY_MS));
}

export function isoDay(day: number): string {
  return Number.isFinite(day) ? new Date(day * DAY_MS).toISOString().slice(0, 10) : "";
}

function num(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function signed(value: number): string {
  if (value === 0) {
    return "0";
  }

  return value > 0 ? `+${num(value)}` : `\u2212${num(Math.abs(value))}`;
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

export function trunc(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function words(value: string): string {
  const text = value.replace(/_/g, " ").toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function level(value: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"): Severity {
  return value === "CRITICAL" ? "critical" : value === "HIGH" ? "high" : value === "MEDIUM" ? "medium" : "low";
}

function atLeast(current: Severity, floor: Severity): Severity {
  return SEVERITY_RANK[current] >= SEVERITY_RANK[floor] ? current : floor;
}

export function buildOpenItems(sources: Sources, today: number): OpenItem[] {
  const items: OpenItem[] = [];

  for (const action of sources.governance?.actions ?? []) {
    if (action.status === "DONE" || action.status === "VOID") {
      continue;
    }

    const blocked = action.status === "BLOCKED";

    items.push({
      id: `gov-action-${action.id}`,
      module: "governance",
      kind: "Action",
      reference: action.actionNumber,
      title: action.title,
      owner: action.ownerName,
      due: toDay(action.dueDate),
      severity: blocked ? atLeast(level(action.priority), "high") : level(action.priority),
      detail: blocked ? `Blocked: ${action.blockerReason ?? "no reason recorded"}` : words(action.status),
    });
  }

  for (const decision of sources.governance?.decisions ?? []) {
    if (decision.status !== "PROPOSED") {
      continue;
    }

    items.push({
      id: `gov-decision-${decision.id}`,
      module: "governance",
      kind: "Decision",
      reference: decision.decisionNumber,
      title: decision.title,
      owner: decision.ownerName,
      due: toDay(decision.dueDate),
      severity: "medium",
      detail: `Proposed ${formatDay(toDay(decision.decisionDate))} · ${words(decision.impactArea)} impact`,
    });
  }

  for (const risk of sources.risk?.risks ?? []) {
    if (risk.status !== "OPEN" && risk.status !== "MITIGATING") {
      continue;
    }

    items.push({
      id: `risk-${risk.id}`,
      module: "risk",
      kind: "Mitigation",
      reference: risk.reference,
      title: risk.title,
      owner: risk.ownerName,
      due: toDay(risk.mitigationDueDate),
      severity: risk.exposureBand === "CRITICAL" ? "critical" : risk.exposureBand === "HIGH" ? "high" : risk.exposureBand === "MODERATE" ? "medium" : "low",
      detail: risk.mitigationPlan ? trunc(risk.mitigationPlan, 110) : "No mitigation plan recorded",
    });
  }

  for (const issue of sources.risk?.issues ?? []) {
    if (issue.status !== "OPEN" && issue.status !== "IN_PROGRESS") {
      continue;
    }

    items.push({
      id: `issue-${issue.id}`,
      module: "risk",
      kind: "Issue",
      reference: issue.reference,
      title: issue.title,
      owner: issue.ownerName,
      due: toDay(issue.targetResolutionDate),
      severity: level(issue.severity),
      detail: words(issue.status),
    });
  }

  for (const change of sources.risk?.changes ?? []) {
    if (change.status !== "DRAFT" && change.status !== "UNDER_REVIEW") {
      continue;
    }

    const waiting = Math.max(0, today - toDay(change.requestedDate));

    items.push({
      id: `change-${change.id}`,
      module: "risk",
      kind: "Change decision",
      reference: change.reference,
      title: change.title,
      owner: change.originator,
      due: NaN,
      severity: waiting > STALE_CHANGE_DAYS ? "high" : "medium",
      detail: `${words(change.status)} · waiting ${waiting} ${plural(waiting, "day", "days")} · ${money(change.costImpact)} · ${signed(change.scheduleImpactDays)} d`,
    });
  }

  for (const action of sources.safety?.actions ?? []) {
    if (action.status === "CLOSED" || action.status === "VOID") {
      continue;
    }

    const verifying = action.status === "READY_FOR_VERIFICATION";

    items.push({
      id: `safety-action-${action.id}`,
      module: "safety",
      kind: "Safety action",
      reference: action.reference,
      title: action.title,
      owner: action.ownerName,
      due: toDay(action.dueDate),
      severity: verifying ? "medium" : "high",
      detail: verifying ? "Ready for verification" : words(action.status),
    });
  }

  for (const permit of sources.safety?.permits ?? []) {
    if (permit.status !== "ACTIVE") {
      continue;
    }

    items.push({
      id: `permit-${permit.id}`,
      module: "safety",
      kind: "Work permit",
      reference: permit.reference,
      title: permit.title,
      owner: permit.receiverName ?? permit.issuerName,
      due: toDay(permit.validUntil),
      severity: permit.expired ? "critical" : "medium",
      detail: `${words(permit.permitType)} permit · ${permit.expired ? "expired while still active" : "valid until"} ${formatDay(toDay(permit.validUntil))}${permit.location ? ` · ${permit.location}` : ""}`,
    });
  }

  for (const ncr of sources.quality?.ncrs ?? []) {
    if (ncr.status === "CLOSED" || ncr.status === "VOID") {
      continue;
    }

    items.push({
      id: `ncr-${ncr.id}`,
      module: "quality",
      kind: "NCR",
      reference: ncr.reference,
      title: ncr.title,
      owner: ncr.ownerName,
      due: toDay(ncr.dueDate),
      severity: ncr.severity === "CRITICAL" ? "critical" : ncr.severity === "MAJOR" ? "high" : "medium",
      detail: `${words(ncr.category)} · ${words(ncr.status)}`,
    });
  }

  for (const punch of sources.quality?.punchItems ?? []) {
    if (punch.status === "CLOSED" || punch.status === "VOID") {
      continue;
    }

    items.push({
      id: `punch-${punch.id}`,
      module: "quality",
      kind: "Punch item",
      reference: punch.reference,
      title: punch.title,
      owner: punch.ownerName,
      due: toDay(punch.dueDate),
      severity: level(punch.priority),
      detail: [punch.location, punch.trade, words(punch.status)].filter(Boolean).join(" · "),
    });
  }

  for (const inspection of sources.quality?.inspections ?? []) {
    if (inspection.status !== "PLANNED" && inspection.status !== "IN_PROGRESS") {
      continue;
    }

    items.push({
      id: `inspection-${inspection.id}`,
      module: "quality",
      kind: "Inspection",
      reference: inspection.reference,
      title: inspection.title,
      owner: inspection.inspectorName,
      due: toDay(inspection.plannedDate),
      severity: "medium",
      detail: `${words(inspection.inspectionType)} · ${words(inspection.discipline)}`,
    });
  }

  for (const rfi of sources.documents?.rfis ?? []) {
    if (rfi.status !== "OPEN") {
      continue;
    }

    items.push({
      id: `rfi-${rfi.id}`,
      module: "documents",
      kind: "RFI",
      reference: rfi.reference,
      title: rfi.subject,
      owner: rfi.assignedTo,
      due: toDay(rfi.dueDate),
      severity: level(rfi.priority),
      detail: `Raised ${formatDay(toDay(rfi.raisedDate))}${rfi.raisedBy ? ` by ${rfi.raisedBy}` : ""}`,
    });
  }

  for (const order of sources.commercial?.changeOrders ?? []) {
    if (order.status !== "SUBMITTED" && order.status !== "UNDER_REVIEW") {
      continue;
    }

    items.push({
      id: `change-order-${order.id}`,
      module: "commercial",
      kind: "Change order decision",
      reference: order.reference,
      title: order.title,
      owner: null,
      due: toDay(order.decisionDueDate),
      severity: "high",
      detail: `${money(order.submittedAmount)} submitted · ${words(order.status)}`,
    });
  }

  for (const claim of sources.commercial?.claims ?? []) {
    if (claim.status !== "SUBMITTED" && claim.status !== "UNDER_REVIEW") {
      continue;
    }

    items.push({
      id: `claim-${claim.id}`,
      module: "commercial",
      kind: "Claim response",
      reference: claim.reference,
      title: claim.title,
      owner: null,
      due: toDay(claim.responseDueDate),
      severity: "high",
      detail: `${money(claim.claimedAmount)} · ${claim.claimedDays} ${plural(claim.claimedDays, "day", "days")} claimed`,
    });
  }

  for (const certificate of sources.commercial?.paymentCertificates ?? []) {
    if (certificate.status === "SUBMITTED") {
      items.push({
        id: `certification-${certificate.id}`,
        module: "commercial",
        kind: "Certification",
        reference: certificate.reference,
        title: `Certificate for ${formatDay(toDay(certificate.periodStart))} to ${formatDay(toDay(certificate.periodEnd))}`,
        owner: null,
        due: toDay(certificate.certificationDueDate),
        severity: "medium",
        detail: `${money(certificate.applicationAmount)} applied for`,
      });
    } else if ((certificate.status === "CERTIFIED" || certificate.status === "PARTIALLY_PAID") && certificate.outstandingAmount > 0) {
      items.push({
        id: `payment-${certificate.id}`,
        module: "commercial",
        kind: "Payment",
        reference: certificate.reference,
        title: `Payment for ${formatDay(toDay(certificate.periodStart))} to ${formatDay(toDay(certificate.periodEnd))}`,
        owner: null,
        due: toDay(certificate.paymentDueDate),
        severity: "high",
        detail: `${money(certificate.outstandingAmount)} outstanding`,
      });
    }
  }

  for (const pack of sources.procurement?.packages ?? []) {
    if (pack.status !== "PLANNING" && pack.status !== "TENDERING" && pack.status !== "EVALUATION") {
      continue;
    }

    const lands = toDay(pack.forecastAwardDate);
    const needed = toDay(pack.requiredOnSiteDate);

    items.push({
      id: `package-${pack.id}`,
      module: "procurement",
      kind: "Package award",
      reference: pack.reference,
      title: pack.title,
      owner: null,
      due: toDay(pack.awardDueDate),
      severity: lands > needed ? "high" : "medium",
      detail: `${words(pack.status)} · forecast award ${formatDay(lands)} · needed on site ${formatDay(needed)}`,
    });
  }

  for (const work of sources.production?.workPackages ?? []) {
    if (work.status !== "BLOCKED") {
      continue;
    }

    items.push({
      id: `blocked-${work.id}`,
      module: "production",
      kind: "Blocked work package",
      reference: work.code,
      title: work.name,
      owner: null,
      due: NaN,
      severity: "high",
      detail: work.blockReason ? `Blocked: ${work.blockReason}` : "Blocked, no reason recorded",
    });
  }

  return items;
}

export function compareOpenItems(a: OpenItem, b: OpenItem): number {
  const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];

  if (bySeverity !== 0) {
    return bySeverity;
  }

  const aDue = Number.isFinite(a.due) ? a.due : Infinity;
  const bDue = Number.isFinite(b.due) ? b.due : Infinity;

  if (aDue !== bDue) {
    return aDue < bDue ? -1 : 1;
  }

  return a.reference.localeCompare(b.reference);
}


export function buildEvents(sources: Sources): OpenItem[] {
  const events: OpenItem[] = [];

  for (const meeting of sources.governance?.meetings ?? []) {
    if (meeting.status !== "PLANNED") {
      continue;
    }

    const time = meeting.scheduledAt.length >= 16 ? meeting.scheduledAt.slice(11, 16) : "";

    events.push({
      id: `meeting-${meeting.id}`,
      module: "governance",
      kind: "Meeting",
      reference: meeting.meetingNumber,
      title: meeting.title,
      owner: meeting.chairName,
      due: toDay(meeting.scheduledAt),
      severity: "low",
      detail: `${words(meeting.meetingType)} meeting${time ? ` at ${time}` : ""}`,
    });
  }

  for (const milestone of sources.center?.milestones ?? []) {
    if (milestone.status === "COMPLETED") {
      continue;
    }

    const planned = toDay(milestone.plannedDate);
    const forecast = toDay(milestone.forecastDate);
    const blocked = milestone.status === "BLOCKED";

    events.push({
      id: `milestone-${milestone.id}`,
      module: "schedule",
      kind: "Milestone",
      reference: "Milestone",
      title: milestone.name,
      owner: null,
      due: Number.isFinite(forecast) ? forecast : planned,
      severity: blocked ? "high" : forecast > planned ? "medium" : "low",
      detail: `Planned ${formatDay(planned)} \u00b7 forecast ${formatDay(forecast)}${blocked ? " \u00b7 blocked" : ""}`,
    });
  }

  return events;
}

export interface LoadedSources {
  sources: Sources;
  failed: ModuleKey[];
}

export async function loadSources(projectId: string): Promise<LoadedSources> {
  const results = await Promise.allSettled([
    getProjectGovernance(projectId),
    getProjectRiskControl(projectId),
    getProjectSafety(projectId),
    getProjectQuality(projectId),
    getProjectDocuments(projectId),
    getProjectCommercial(projectId),
    getProjectProcurement(projectId),
    getProjectProduction(projectId),
    getProjectCommandCenter(projectId),
  ]);

  const failed: ModuleKey[] = [];

  const take = <T,>(result: PromiseSettledResult<T>, key: ModuleKey): T | null => {
    if (result.status === "fulfilled") {
      return result.value;
    }

    failed.push(key);

    return null;
  };

  const sources: Sources = {
    governance: take(results[0], "governance"),
    risk: take(results[1], "risk"),
    safety: take(results[2], "safety"),
    quality: take(results[3], "quality"),
    documents: take(results[4], "documents"),
    commercial: take(results[5], "commercial"),
    procurement: take(results[6], "procurement"),
    production: take(results[7], "production"),
    center: take(results[8], "schedule"),
  };

  return { sources, failed };
}

export function projectOf(sources: Sources): Project | null {
  return (
    sources.center?.project ??
    sources.governance?.project ??
    sources.risk?.project ??
    sources.safety?.project ??
    sources.quality?.project ??
    sources.documents?.project ??
    sources.commercial?.project ??
    sources.procurement?.project ??
    sources.production?.project ??
    null
  );
}
