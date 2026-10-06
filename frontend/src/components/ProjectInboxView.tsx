"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  getProjectCommercial,
  getProjectDocuments,
  getProjectGovernance,
  getProjectProcurement,
  getProjectProduction,
  getProjectQuality,
  getProjectRiskControl,
  getProjectSafety,
} from "@/lib/api";
import {
  type CsvDelimiter,
  downloadCsv,
  preferredDelimiter,
  rememberDelimiter,
  safeFileName,
  toCsv,
  todayStamp,
} from "@/lib/csvExport";
import type {
  CommercialControl,
  DocumentControl,
  GovernanceControl,
  Project,
  ProcurementControl,
  ProductionControl,
  QualityControl,
  RiskControl,
  SafetyControl,
} from "@/types/project";

import styles from "./ProjectInboxView.module.css";

const DAY_MS = 86_400_000;
const LIST_LIMIT = 10;
const OWNER_LIMIT = 8;
const STALE_CHANGE_DAYS = 30;
const SOON_DAYS = 14;
const UNASSIGNED = "Unassigned";

type ModuleKey =
  | "governance"
  | "risk"
  | "safety"
  | "quality"
  | "documents"
  | "commercial"
  | "procurement"
  | "production";

type Severity = "critical" | "high" | "medium" | "low";
type WindowKey = "7" | "14" | "30" | "all";
type BucketKey = "overdue" | "week" | "fortnight" | "month" | "later" | "undated";

interface Sources {
  governance: GovernanceControl | null;
  risk: RiskControl | null;
  safety: SafetyControl | null;
  quality: QualityControl | null;
  documents: DocumentControl | null;
  commercial: CommercialControl | null;
  procurement: ProcurementControl | null;
  production: ProductionControl | null;
}

interface InboxItem {
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

const MODULES: ReadonlyArray<{ key: ModuleKey; label: string; path: string }> = [
  { key: "governance", label: "Governance", path: "governance" },
  { key: "risk", label: "Risk", path: "risk-control" },
  { key: "safety", label: "Safety", path: "safety" },
  { key: "quality", label: "Quality", path: "quality" },
  { key: "documents", label: "Documents", path: "documents" },
  { key: "commercial", label: "Commercial", path: "commercial" },
  { key: "procurement", label: "Procurement", path: "procurement" },
  { key: "production", label: "Production", path: "production" },
];

const MODULE_LABEL = Object.fromEntries(MODULES.map((item) => [item.key, item.label])) as Record<ModuleKey, string>;
const MODULE_PATH = Object.fromEntries(MODULES.map((item) => [item.key, item.path])) as Record<ModuleKey, string>;

const SEVERITY_RANK: Record<Severity, number> = { critical: 3, high: 2, medium: 1, low: 0 };

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const SEVERITY_CLASS: Record<Severity, string | undefined> = {
  critical: styles.sevCritical,
  high: styles.sevHigh,
  medium: styles.sevMedium,
  low: styles.sevLow,
};

const BUCKETS: ReadonlyArray<{ key: BucketKey; label: string; test: (days: number) => boolean }> = [
  { key: "overdue", label: "Overdue", test: (days) => days < 0 },
  { key: "week", label: "Due in the next 7 days", test: (days) => days >= 0 && days <= 7 },
  { key: "fortnight", label: "Due in 8 to 14 days", test: (days) => days >= 8 && days <= 14 },
  { key: "month", label: "Due in 15 to 30 days", test: (days) => days >= 15 && days <= 30 },
  { key: "later", label: "Due in more than 30 days", test: (days) => days > 30 },
];

const WINDOWS: ReadonlyArray<{ key: WindowKey; label: string; days: number }> = [
  { key: "7", label: "7 days", days: 7 },
  { key: "14", label: "14 days", days: 14 },
  { key: "30", label: "30 days", days: 30 },
  { key: "all", label: "Everything", days: Infinity },
];

const STAGE_COLOR = {
  overdue: "#b5493e",
  soon: "#dcb85e",
  later: "#9cc9b2",
  undated: "#c3c9c5",
} as const;

const STAGE_LABEL = {
  overdue: "Overdue",
  soon: `Due within ${SOON_DAYS} days`,
  later: "Due later",
  undated: "No due date",
} as const;

const SOURCE_LABEL: Record<ModuleKey, string> = {
  governance: "governance",
  risk: "risk",
  safety: "safety",
  quality: "quality",
  documents: "documents",
  commercial: "commercial",
  procurement: "procurement",
  production: "production",
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function startOfToday(): number {
  const now = new Date();

  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

function toDay(value: string | null | undefined): number {
  if (!value) {
    return NaN;
  }

  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS);
}

function formatDay(day: number): string {
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

function isoDay(day: number): string {
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

  return value > 0 ? `+${num(value)}` : `−${num(Math.abs(value))}`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function trunc(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function words(value: string): string {
  const text = value.replace(/_/g, " ").toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function level(value: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"): Severity {
  return value === "CRITICAL" ? "critical" : value === "HIGH" ? "high" : value === "MEDIUM" ? "medium" : "low";
}

function atLeast(current: Severity, floor: Severity): Severity {
  return SEVERITY_RANK[current] >= SEVERITY_RANK[floor] ? current : floor;
}

function ownerKey(item: InboxItem): string {
  return item.owner?.trim() || UNASSIGNED;
}

function dueText(days: number): string {
  if (!Number.isFinite(days)) {
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

function stageOf(days: number): keyof typeof STAGE_COLOR {
  if (!Number.isFinite(days)) {
    return "undated";
  }

  return days < 0 ? "overdue" : days <= SOON_DAYS ? "soon" : "later";
}

function buildItems(sources: Sources, today: number): InboxItem[] {
  const items: InboxItem[] = [];

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

function compareItems(a: InboxItem, b: InboxItem): number {
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

export function ProjectInboxView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [moduleFilter, setModuleFilter] = useState<ModuleKey | "all">("all");
  const [windowKey, setWindowKey] = useState<WindowKey>("14");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Partial<Record<BucketKey, boolean>>>({});
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    setDelimiter(preferredDelimiter());
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    Promise.allSettled([
      getProjectGovernance(projectId),
      getProjectRiskControl(projectId),
      getProjectSafety(projectId),
      getProjectQuality(projectId),
      getProjectDocuments(projectId),
      getProjectCommercial(projectId),
      getProjectProcurement(projectId),
      getProjectProduction(projectId),
    ]).then((results) => {
      if (cancelled) {
        return;
      }

      const missing: ModuleKey[] = [];

      const take = <T,>(result: PromiseSettledResult<T>, key: ModuleKey): T | null => {
        if (result.status === "fulfilled") {
          return result.value;
        }

        missing.push(key);

        return null;
      };

      setSources({
        governance: take(results[0], "governance"),
        risk: take(results[1], "risk"),
        safety: take(results[2], "safety"),
        quality: take(results[3], "quality"),
        documents: take(results[4], "documents"),
        commercial: take(results[5], "commercial"),
        procurement: take(results[6], "procurement"),
        production: take(results[7], "production"),
      });
      setFailed(missing);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const project: Project | null = useMemo(() => {
    if (!sources) {
      return null;
    }

    return (
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
  }, [sources]);

  const all = useMemo(() => (sources ? buildItems(sources, today).sort(compareItems) : []), [sources, today]);

  const overview = useMemo(() => {
    const days = (item: InboxItem) => item.due - today;
    const overdue = all.filter((item) => Number.isFinite(item.due) && days(item) < 0);
    const week = all.filter((item) => Number.isFinite(item.due) && days(item) >= 0 && days(item) <= 7);
    const undated = all.filter((item) => !Number.isFinite(item.due));
    const urgent = all.filter(
      (item) =>
        (item.severity === "critical" || item.severity === "high") &&
        (!Number.isFinite(item.due) || days(item) <= SOON_DAYS),
    );
    const oldest = overdue.reduce((max, item) => Math.max(max, today - item.due), 0);

    const moduleRows = MODULES.map((module) => {
      const items = all.filter((item) => item.module === module.key);
      const counts = { overdue: 0, soon: 0, later: 0, undated: 0 };

      for (const item of items) {
        counts[stageOf(days(item))] += 1;
      }

      return { module, total: items.length, counts };
    })
      .filter((row) => row.total > 0)
      .sort((a, b) => b.counts.overdue - a.counts.overdue || b.total - a.total);

    const ownerMap = new Map<string, { owner: string; total: number; counts: { overdue: number; soon: number; later: number; undated: number } }>();

    for (const item of all) {
      const key = ownerKey(item);
      const found = ownerMap.get(key) ?? { owner: key, total: 0, counts: { overdue: 0, soon: 0, later: 0, undated: 0 } };

      found.total += 1;
      found.counts[stageOf(days(item))] += 1;
      ownerMap.set(key, found);
    }

    const owners = [...ownerMap.values()].sort(
      (a, b) => b.counts.overdue - a.counts.overdue || b.total - a.total || a.owner.localeCompare(b.owner),
    );

    return {
      overdue: overdue.length,
      week: week.length,
      undated: undated.length,
      urgent: urgent.length,
      oldest,
      moduleRows,
      moduleMax: Math.max(1, ...moduleRows.map((row) => row.total)),
      owners,
      ownerMax: Math.max(1, ...owners.slice(0, OWNER_LIMIT).map((row) => row.total)),
      busiest: owners.find((row) => row.counts.overdue > 0) ?? null,
    };
  }, [all, today]);

  const scoped = useMemo(() => {
    const windowDays = WINDOWS.find((item) => item.key === windowKey)?.days ?? Infinity;
    const needle = query.trim().toLowerCase();

    return all.filter((item) => {
      if (Number.isFinite(item.due) && item.due - today > windowDays) {
        return false;
      }

      if (ownerFilter !== "all" && ownerKey(item) !== ownerFilter) {
        return false;
      }

      if (needle) {
        const haystack = `${item.reference} ${item.title} ${item.owner ?? ""} ${item.kind} ${item.detail} ${MODULE_LABEL[item.module]}`.toLowerCase();

        return haystack.includes(needle);
      }

      return true;
    });
  }, [all, ownerFilter, query, today, windowKey]);

  const visible = useMemo(
    () => (moduleFilter === "all" ? scoped : scoped.filter((item) => item.module === moduleFilter)),
    [scoped, moduleFilter],
  );

  const grouped = useMemo(() => {
    const groups: Array<{ key: BucketKey; label: string; items: InboxItem[] }> = BUCKETS.map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      items: visible.filter((item) => Number.isFinite(item.due) && bucket.test(item.due - today)),
    }));

    groups.push({
      key: "undated",
      label: "Waiting, no due date",
      items: visible.filter((item) => !Number.isFinite(item.due)),
    });

    return groups.filter((group) => group.items.length > 0);
  }, [visible, today]);

  const downloadVisible = () => {
    const rows = visible.map((item) => ({
      Area: MODULE_LABEL[item.module],
      Type: item.kind,
      Reference: item.reference,
      Title: item.title,
      Owner: item.owner ?? "",
      "Due date": isoDay(item.due),
      "Days from today": Number.isFinite(item.due) ? item.due - today : "",
      Severity: SEVERITY_LABEL[item.severity],
      Detail: item.detail,
    }));

    const columns = ["Area", "Type", "Reference", "Title", "Owner", "Due date", "Days from today", "Severity", "Detail"];
    const name = safeFileName(`${project?.code ?? "project"}-action-inbox-${todayStamp()}`);

    downloadCsv(`${name}.csv`, toCsv(rows, columns, delimiter));
  };

  const changeDelimiter = (value: string) => {
    const next: CsvDelimiter = value === ";" ? ";" : ",";

    setDelimiter(next);
    rememberDelimiter(next);
  };

  const countFor = (key: ModuleKey) => scoped.filter((item) => item.module === key).length;
  const nothingToDo = sources !== null && all.length === 0;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">ACTION INBOX</div>

            <h1>What needs doing next</h1>

            <p className={styles.subtitle}>
              {project ? `${project.code} · ${project.name}. ` : ""}
              Every open action, mitigation, RFI, NCR and decision across the project registers, in one list.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/export`}>
            Open data export
          </Link>
        </header>

        {!sources && <div className={styles.loading}>Loading the project registers…</div>}

        {sources && failed.length > 0 && (
          <div className="offline-banner">
            <div>
              <strong>
                {failed.length === MODULES.length
                  ? "Could not load project data. Check that the backend is running."
                  : `Could not load ${failed.map((key) => SOURCE_LABEL[key]).join(", ")}.`}
              </strong>
              {failed.length < MODULES.length && <span> Items from those registers are missing from this list.</span>}
            </div>
          </div>
        )}

        {nothingToDo && failed.length < MODULES.length && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>Nothing is open. Every register is up to date.</div>
          </section>
        )}

        {sources && all.length > 0 && (
          <>
            <section aria-label="Inbox summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OVERDUE</div>
                <div className={styles.kpiValue}>{overview.overdue}</div>
                <div className={styles.kpiSub}>
                  {overview.overdue > 0 ? `oldest is ${overview.oldest} ${plural(overview.oldest, "day", "days")} late` : "nothing is late"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DUE THIS WEEK</div>
                <div className={styles.kpiValue}>{overview.week}</div>
                <div className={styles.kpiSub}>in the next 7 days</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CRITICAL OR HIGH</div>
                <div className={cx(styles.kpiValue, overview.urgent > 0 && styles.neg)}>{overview.urgent}</div>
                <div className={styles.kpiSub}>late, due within {SOON_DAYS} days, or undated</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WAITING, NO DATE</div>
                <div className={styles.kpiValue}>{overview.undated}</div>
                <div className={styles.kpiSub}>blocked work and open change decisions</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MOST OVERDUE</div>
                <div className={cx(styles.kpiValue, overview.busiest && styles.neg)}>
                  {overview.busiest ? overview.busiest.counts.overdue : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {overview.busiest ? trunc(overview.busiest.owner, 26) : "nobody is behind"}
                </div>
              </article>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY AREA</div>
                    <h2>Where the open items sit</h2>
                  </div>

                  <span className={styles.muted}>
                    {all.length} open {plural(all.length, "item", "items")}
                  </span>
                </header>

                <ul className={styles.ageing}>
                  {overview.moduleRows.map((row) => (
                    <li key={row.module.key}>
                      <div className={styles.ageingTop}>
                        <span className={row.counts.overdue > 0 ? styles.neg : undefined}>{row.module.label}</span>
                        <strong>
                          {row.total}
                          <small>{row.counts.overdue > 0 ? `${row.counts.overdue} overdue` : "none overdue"}</small>
                        </strong>
                      </div>

                      <div
                        aria-label={`${row.module.label}: ${row.counts.overdue} overdue, ${row.counts.soon} due soon, ${row.counts.later} due later, ${row.counts.undated} without a date`}
                        className={styles.stackTrack}
                        role="img"
                      >
                        <div className={styles.stack} style={{ width: `${percent(row.total, overview.moduleMax)}%` }}>
                          {(Object.keys(STAGE_COLOR) as Array<keyof typeof STAGE_COLOR>)
                            .filter((stage) => row.counts[stage] > 0)
                            .map((stage) => (
                              <i
                                key={stage}
                                style={{ background: STAGE_COLOR[stage], flexGrow: row.counts[stage] }}
                                title={`${row.counts[stage]} ${STAGE_LABEL[stage].toLowerCase()}`}
                              />
                            ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                <ul aria-label="Colour legend" className={styles.legend}>
                  {(Object.keys(STAGE_COLOR) as Array<keyof typeof STAGE_COLOR>).map((stage) => (
                    <li key={stage}>
                      <i className={styles.swatch} style={{ background: STAGE_COLOR[stage] }} />
                      {STAGE_LABEL[stage]}
                    </li>
                  ))}
                </ul>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY OWNER</div>
                    <h2>Who is holding them</h2>
                  </div>

                  <span className={styles.muted}>
                    {overview.owners.length} {plural(overview.owners.length, "owner", "owners")}
                  </span>
                </header>

                <ul className={styles.ageing}>
                  {overview.owners.slice(0, OWNER_LIMIT).map((row) => (
                    <li key={row.owner}>
                      <div className={styles.ageingTop}>
                        <button
                          className={styles.ownerButton}
                          onClick={() => setOwnerFilter(ownerFilter === row.owner ? "all" : row.owner)}
                          title={ownerFilter === row.owner ? "Show everyone again" : `Show only ${row.owner}`}
                          type="button"
                        >
                          <span className={row.counts.overdue > 0 ? styles.neg : undefined}>{trunc(row.owner, 30)}</span>
                        </button>
                        <strong>
                          {row.total}
                          <small>{row.counts.overdue > 0 ? `${row.counts.overdue} overdue` : "none overdue"}</small>
                        </strong>
                      </div>

                      <div
                        aria-label={`${row.owner}: ${row.counts.overdue} overdue, ${row.counts.soon} due soon, ${row.counts.later} due later, ${row.counts.undated} without a date`}
                        className={styles.stackTrack}
                        role="img"
                      >
                        <div className={styles.stack} style={{ width: `${percent(row.total, overview.ownerMax)}%` }}>
                          {(Object.keys(STAGE_COLOR) as Array<keyof typeof STAGE_COLOR>)
                            .filter((stage) => row.counts[stage] > 0)
                            .map((stage) => (
                              <i
                                key={stage}
                                style={{ background: STAGE_COLOR[stage], flexGrow: row.counts[stage] }}
                                title={`${row.counts[stage]} ${STAGE_LABEL[stage].toLowerCase()}`}
                              />
                            ))}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {overview.owners.length > OWNER_LIMIT && (
                  <p className={styles.hint}>
                    Showing the {OWNER_LIMIT} owners with the most overdue items. Use the owner filter below for the rest.
                  </p>
                )}
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">THE LIST</div>
                  <h2>Open items, most urgent first</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>
                    {visible.length} shown
                  </span>

                  <select
                    aria-label="CSV separator"
                    className={styles.select}
                    onChange={(event) => changeDelimiter(event.target.value)}
                    value={delimiter}
                  >
                    <option value=",">Comma separated</option>
                    <option value=";">Semicolon separated</option>
                  </select>

                  <button className={styles.linkButton} disabled={visible.length === 0} onClick={downloadVisible} type="button">
                    Download CSV
                  </button>
                </div>
              </header>

              <div className={styles.filters}>
                <div aria-label="Filter by area" className={styles.segmented} role="group">
                  <button
                    aria-pressed={moduleFilter === "all"}
                    className={cx(styles.segment, moduleFilter === "all" && styles.segmentOn)}
                    onClick={() => setModuleFilter("all")}
                    type="button"
                  >
                    All {scoped.length}
                  </button>

                  {MODULES.filter((module) => countFor(module.key) > 0 || moduleFilter === module.key).map((module) => (
                    <button
                      aria-pressed={moduleFilter === module.key}
                      className={cx(styles.segment, moduleFilter === module.key && styles.segmentOn)}
                      key={module.key}
                      onClick={() => setModuleFilter(module.key)}
                      type="button"
                    >
                      {module.label} {countFor(module.key)}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.filters}>
                <div aria-label="How far ahead to look" className={styles.segmented} role="group">
                  {WINDOWS.map((item) => (
                    <button
                      aria-pressed={windowKey === item.key}
                      className={cx(styles.segment, windowKey === item.key && styles.segmentOn)}
                      key={item.key}
                      onClick={() => setWindowKey(item.key)}
                      type="button"
                    >
                      {item.key === "all" ? item.label : `Next ${item.label}`}
                    </button>
                  ))}
                </div>

                <select
                  aria-label="Filter by owner"
                  className={styles.select}
                  onChange={(event) => setOwnerFilter(event.target.value)}
                  value={ownerFilter}
                >
                  <option value="all">All owners</option>
                  {overview.owners.map((row) => (
                    <option key={row.owner} value={row.owner}>
                      {row.owner} ({row.total})
                    </option>
                  ))}
                </select>

                <input
                  aria-label="Search the list"
                  className={styles.search}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search reference, title or owner"
                  type="search"
                  value={query}
                />
              </div>

              <p className={styles.lead}>
                Overdue items and items with no date are always shown. The window only limits what is due later.
              </p>

              {grouped.length === 0 ? (
                <div className={styles.emptySmall}>Nothing matches these filters.</div>
              ) : (
                grouped.map((group) => {
                  const open = expanded[group.key] === true;
                  const rows = open ? group.items : group.items.slice(0, LIST_LIMIT);

                  return (
                    <div className={styles.bucket} key={group.key}>
                      <div className={styles.bucketHead}>
                        <h3 className={group.key === "overdue" ? styles.neg : undefined}>
                          {group.label} <span>{group.items.length}</span>
                        </h3>

                        {group.items.length > LIST_LIMIT && (
                          <button
                            className={styles.linkButton}
                            onClick={() => setExpanded((value) => ({ ...value, [group.key]: !open }))}
                            type="button"
                          >
                            {open ? `Show first ${LIST_LIMIT}` : `Show all ${group.items.length}`}
                          </button>
                        )}
                      </div>

                      <ul className={styles.items}>
                        {rows.map((item) => {
                          const days = item.due - today;

                          return (
                            <li className={item.severity === "critical" && days < 0 ? styles.itemAlert : undefined} key={item.id}>
                              <div className={styles.itemTop}>
                                <span className={cx(styles.sev, SEVERITY_CLASS[item.severity])}>{SEVERITY_LABEL[item.severity]}</span>
                                <span className={styles.itemTitle}>{item.title}</span>
                                <span
                                  className={cx(
                                    styles.due,
                                    days < 0 && styles.dueLate,
                                    days >= 0 && days <= 7 && styles.dueSoon,
                                  )}
                                >
                                  {dueText(days)}
                                </span>
                                <Link className={styles.itemLink} href={`${base}/${MODULE_PATH[item.module]}`}>
                                  Open →
                                </Link>
                              </div>

                              <div className={styles.itemMeta}>
                                <span>
                                  {MODULE_LABEL[item.module]} · {item.kind} · {item.reference}
                                </span>
                                <span>
                                  {item.owner ?? UNASSIGNED}
                                  {Number.isFinite(item.due) ? ` · ${formatDay(item.due)}` : ""}
                                </span>
                              </div>

                              <div className={styles.itemDetail}>{item.detail}</div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })
              )}
            </section>

            <p className={styles.note}>
              Lists open governance actions and proposed decisions, risk mitigations, issues and change requests waiting for a decision,
              open safety actions and active work permits, open NCRs, punch items and planned inspections, open RFIs, submitted change
              orders, claims and certificates, unpaid certificates, unawarded procurement packages and blocked work packages.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
