import { buildDocuments } from "@/lib/documentBoard";
import { MODULE_LABEL, MODULE_PATH, formatDay, money, plural, projectOf, toDay, words, type ModuleKey, type Sources } from "@/lib/openItems";

export type GateState = "clear" | "open" | "late" | "none" | "unknown";
export type GateKey = "works" | "milestones" | "snags" | "defects" | "inspections" | "handover" | "documents" | "rfis" | "safety" | "commercial" | "management";
export type GroupKey = "works" | "quality" | "information" | "safety" | "commercial" | "management";

export const PACE_DAYS = 28;
export const BLOCKER_LIMIT = 8;

export const GROUP_LABEL: Record<GroupKey, string> = {
  works: "Works",
  quality: "Quality",
  information: "Information",
  safety: "Safety",
  commercial: "Commercial",
  management: "Management",
};

export interface Blocker {
  id: string;
  reference: string;
  title: string;
  owner: string | null;
  due: number;
  overdue: boolean;
  detail: string;
}

export interface Pace {
  closed: number;
  perWeek: number;
  clearBy: number | null;
}

export interface Gate {
  key: GateKey;
  title: string;
  question: string;
  group: GroupKey;
  module: ModuleKey;
  path: string;
  total: number;
  done: number;
  ratio: number;
  blockers: Blocker[];
  overdue: number;
  state: GateState;
  pace: Pace | null;
  figure: string;
  note: string | null;
}

export interface Closeout {
  gates: Gate[];
  clear: number;
  applicable: number;
  readiness: number;
  open: number;
  overdue: number;
  planned: number;
  daysLeft: number;
  estimate: number | null;
  slowest: Gate | null;
  stalled: Gate[];
}

interface GateInput {
  key: GateKey;
  title: string;
  question: string;
  group: GroupKey;
  module: ModuleKey;
  needs: ModuleKey[];
  total: number;
  done: number;
  unit: string;
  blockers: Blocker[];
  closedDates?: Array<string | null | undefined>;
  notes?: string[];
}

function blocker(id: string, reference: string, title: string, owner: string | null | undefined, due: string | null | undefined, detail: string, today: number, forceLate = false): Blocker {
  const day = toDay(due);

  return {
    id,
    reference,
    title,
    owner: owner ?? null,
    due: day,
    overdue: forceLate || (Number.isFinite(day) && day < today),
    detail,
  };
}

function order(list: Blocker[]): Blocker[] {
  return [...list].sort((a, b) => {
    if (a.overdue !== b.overdue) {
      return a.overdue ? -1 : 1;
    }

    const left = Number.isFinite(a.due) ? a.due : Infinity;
    const right = Number.isFinite(b.due) ? b.due : Infinity;

    return left - right || a.reference.localeCompare(b.reference);
  });
}

function paceOf(closedDates: Array<string | null | undefined>, open: number, today: number): Pace {
  const closed = closedDates.filter((value) => {
    const day = toDay(value);

    return Number.isFinite(day) && day > today - PACE_DAYS && day <= today;
  }).length;

  return {
    closed,
    perWeek: closed / (PACE_DAYS / 7),
    clearBy: closed > 0 && open > 0 ? today + Math.ceil(open / (closed / PACE_DAYS)) : null,
  };
}

export function buildCloseout(sources: Sources, failed: ModuleKey[], today: number): Closeout {
  const lost = new Set<ModuleKey>(failed);
  const inputs: GateInput[] = [];

  const production = sources.production;
  const packages = (production?.workPackages ?? []).filter((item) => item.status !== "CANCELLED");

  inputs.push({
    key: "works",
    title: "Works complete",
    question: "Is every work package finished?",
    group: "works",
    module: "production",
    needs: ["production"],
    total: packages.length,
    done: packages.filter((item) => item.status === "COMPLETED").length,
    unit: "work packages complete",
    blockers: packages
      .filter((item) => item.status !== "COMPLETED")
      .map((item) => blocker(item.id, item.code, item.name, null, item.plannedEndDate, `${Math.round(item.completionPercentage)}% complete · ${words(item.status)}`, today)),
  });

  const milestones = sources.center?.milestones ?? [];

  inputs.push({
    key: "milestones",
    title: "Milestones reached",
    question: "Have all contract milestones been achieved?",
    group: "works",
    module: "schedule",
    needs: ["schedule"],
    total: milestones.length,
    done: milestones.filter((item) => item.status === "COMPLETED").length,
    unit: "milestones reached",
    blockers: milestones
      .filter((item) => item.status !== "COMPLETED")
      .map((item) =>
        blocker(
          item.id,
          "",
          item.name,
          null,
          Number.isFinite(toDay(item.forecastDate)) ? item.forecastDate : item.plannedDate,
          `Planned ${formatDay(toDay(item.plannedDate))} · forecast ${formatDay(toDay(item.forecastDate))}${item.status === "BLOCKED" ? " · blocked" : ""}`,
          today,
        ),
      ),
  });

  const quality = sources.quality;
  const punch = (quality?.punchItems ?? []).filter((item) => item.status !== "VOID");
  const punchOpen = punch.filter((item) => item.status !== "CLOSED");

  inputs.push({
    key: "snags",
    title: "Snagging list",
    question: "Are all punch items closed?",
    group: "quality",
    module: "quality",
    needs: ["quality"],
    total: punch.length,
    done: punch.length - punchOpen.length,
    unit: "snags closed",
    blockers: punchOpen.map((item) => blocker(item.id, item.reference, item.title, item.ownerName, item.dueDate, `${words(item.priority)} priority · ${words(item.status)}${item.location ? ` · ${item.location}` : ""}`, today, item.overdue)),
    closedDates: punch.filter((item) => item.status === "CLOSED").map((item) => item.closedDate),
  });

  const ncrs = (quality?.ncrs ?? []).filter((item) => item.status !== "VOID");
  const ncrOpen = ncrs.filter((item) => item.status !== "CLOSED");

  inputs.push({
    key: "defects",
    title: "Non-conformances",
    question: "Are all NCRs closed out?",
    group: "quality",
    module: "quality",
    needs: ["quality"],
    total: ncrs.length,
    done: ncrs.length - ncrOpen.length,
    unit: "NCRs closed",
    blockers: ncrOpen.map((item) => blocker(item.id, item.reference, item.title, item.ownerName, item.dueDate, `${words(item.severity)} · ${words(item.status)}`, today, item.overdue)),
    closedDates: ncrs.filter((item) => item.status === "CLOSED").map((item) => item.closedDate),
  });

  const inspections = (quality?.inspections ?? []).filter((item) => item.status !== "CANCELLED");
  const inspectionOpen = inspections.filter((item) => item.status !== "COMPLETED");
  const failedInspections = inspections.filter((item) => item.status === "COMPLETED" && item.result === "FAIL").length;

  inputs.push({
    key: "inspections",
    title: "Inspections and tests",
    question: "Have all planned inspections been carried out?",
    group: "quality",
    module: "quality",
    needs: ["quality"],
    total: inspections.length,
    done: inspections.length - inspectionOpen.length,
    unit: "inspections completed",
    blockers: inspectionOpen.map((item) => blocker(item.id, item.reference, item.title, item.inspectorName, item.plannedDate, `${words(item.discipline)} · ${words(item.status)}`, today)),
    notes: failedInspections > 0 ? [`${failedInspections} completed ${plural(failedInspections, "inspection", "inspections")} recorded a fail. Check each was re-inspected.`] : [],
  });

  const handover = (quality?.handoverItems ?? []).filter((item) => item.status !== "NOT_REQUIRED");
  const handoverOpen = handover.filter((item) => item.status !== "APPROVED");

  inputs.push({
    key: "handover",
    title: "Handover pack",
    question: "Are the O&M manuals, as-builts and certificates approved?",
    group: "quality",
    module: "quality",
    needs: ["quality"],
    total: handover.length,
    done: handover.length - handoverOpen.length,
    unit: "handover items approved",
    blockers: handoverOpen.map((item) => blocker(item.id, item.code, item.title, item.ownerName, item.dueDate, `${words(item.category)} · ${words(item.status)}`, today, item.overdue)),
    closedDates: handover.filter((item) => item.status === "APPROVED").map((item) => item.approvedDate),
  });

  const documents = sources.documents;
  const board = documents ? buildDocuments(documents, today) : null;
  const relevant = (board?.rows ?? []).filter((row) => row.status !== "SUPERSEDED");
  const stuckIds = new Set((board?.stuck ?? []).map((row) => row.doc.id));
  const documentOpen = relevant.filter((row) => !row.ready);

  inputs.push({
    key: "documents",
    title: "Document status",
    question: "Is every document at an approved or issued revision?",
    group: "information",
    module: "documents",
    needs: ["documents"],
    total: relevant.length,
    done: relevant.length - documentOpen.length,
    unit: "documents current",
    blockers: documentOpen.map((row) =>
      blocker(
        row.doc.id,
        row.doc.documentNumber,
        row.doc.title,
        row.doc.ownerName,
        null,
        row.status === "NONE" ? "No revision filed" : `${words(row.status)}${Number.isFinite(row.age) ? ` for ${row.age} ${plural(row.age, "day", "days")}` : ""}`,
        today,
        stuckIds.has(row.doc.id),
      ),
    ),
  });

  const rfis = (documents?.rfis ?? []).filter((item) => item.status !== "VOID");
  const rfiOpen = rfis.filter((item) => item.status === "OPEN");

  inputs.push({
    key: "rfis",
    title: "Requests for information",
    question: "Has every RFI been answered?",
    group: "information",
    module: "documents",
    needs: ["documents"],
    total: rfis.length,
    done: rfis.length - rfiOpen.length,
    unit: "RFIs answered",
    blockers: rfiOpen.map((item) => blocker(item.id, item.reference, item.subject, item.assignedTo, item.dueDate, `${words(item.priority)} priority`, today, item.overdue)),
    closedDates: rfis.filter((item) => item.status !== "OPEN").map((item) => item.respondedDate),
  });

  const safety = sources.safety;
  const actions = (safety?.actions ?? []).filter((item) => item.status !== "VOID");
  const permits = (safety?.permits ?? []).filter((item) => item.status !== "CANCELLED");
  const incidents = (safety?.incidents ?? []).filter((item) => item.status !== "VOID");
  const actionOpen = actions.filter((item) => item.status !== "CLOSED");
  const permitOpen = permits.filter((item) => item.status !== "CLOSED");
  const incidentOpen = incidents.filter((item) => item.status !== "CLOSED");

  inputs.push({
    key: "safety",
    title: "Safety close-out",
    question: "Are actions done, permits closed and incidents investigated?",
    group: "safety",
    module: "safety",
    needs: ["safety"],
    total: actions.length + permits.length + incidents.length,
    done: actions.length - actionOpen.length + (permits.length - permitOpen.length) + (incidents.length - incidentOpen.length),
    unit: "safety records closed",
    blockers: [
      ...actionOpen.map((item) => blocker(item.id, item.reference, item.title, item.ownerName, item.dueDate, `Safety action · ${words(item.status)}`, today, item.overdue)),
      ...permitOpen.map((item) => blocker(item.id, item.reference, item.title, item.issuerName, item.validUntil, `Permit still ${words(item.status).toLowerCase()}`, today, item.expired && item.status === "ACTIVE")),
      ...incidentOpen.map((item) => blocker(item.id, item.reference, item.title, null, null, `Incident · ${words(item.status)}`, today)),
    ],
    closedDates: [
      ...actions.filter((item) => item.status === "CLOSED").map((item) => item.closedDate),
      ...permits.filter((item) => item.status === "CLOSED").map((item) => item.closedDate),
      ...incidents.filter((item) => item.status === "CLOSED").map((item) => item.closedDate),
    ],
  });

  const commercial = sources.commercial;
  const orders = (commercial?.changeOrders ?? []).filter((item) => item.status !== "VOID");
  const claims = (commercial?.claims ?? []).filter((item) => item.status !== "VOID");
  const certificates = (commercial?.paymentCertificates ?? []).filter((item) => item.status !== "VOID" && item.status !== "REJECTED");
  const orderOpen = orders.filter((item) => item.status !== "APPROVED" && item.status !== "REJECTED");
  const claimOpen = claims.filter((item) => !["APPROVED", "REJECTED", "SETTLED"].includes(item.status));
  const certificateOpen = certificates.filter((item) => item.status !== "PAID");
  const outstanding = certificateOpen.reduce((sum, item) => sum + Math.max(0, item.outstandingAmount ?? 0), 0);

  inputs.push({
    key: "commercial",
    title: "Commercial settlement",
    question: "Are change orders, claims and payments settled?",
    group: "commercial",
    module: "commercial",
    needs: ["commercial"],
    total: orders.length + claims.length + certificates.length,
    done: orders.length - orderOpen.length + (claims.length - claimOpen.length) + (certificates.length - certificateOpen.length),
    unit: "commercial items settled",
    blockers: [
      ...orderOpen.map((item) => blocker(item.id, item.reference, item.title, null, item.decisionDueDate, `Change order · ${words(item.status)}`, today, item.overdueDecision)),
      ...claimOpen.map((item) => blocker(item.id, item.reference, item.title, null, item.responseDueDate, `Claim · ${words(item.status)}`, today, item.overdueResponse)),
      ...certificateOpen.map((item) =>
        blocker(
          item.id,
          item.reference,
          `Payment certificate for ${formatDay(toDay(item.periodEnd))}`,
          null,
          item.paymentDueDate ?? item.certificationDueDate,
          `${words(item.status)}${item.outstandingAmount > 0 ? ` · ${money(item.outstandingAmount)} outstanding` : ""}`,
          today,
          item.overduePayment || item.overdueCertification,
        ),
      ),
    ],
    notes: outstanding > 0 ? [`${money(outstanding)} is still outstanding on payment certificates.`] : [],
  });

  const governance = sources.governance;
  const risk = sources.risk;
  const meetingActions = (governance?.actions ?? []).filter((item) => item.status !== "VOID");
  const decisions = (governance?.decisions ?? []).filter((item) => item.status !== "SUPERSEDED" && item.status !== "REJECTED");
  const issues = risk?.issues ?? [];
  const changes = risk?.changes ?? [];
  const actionsOpen = meetingActions.filter((item) => item.status !== "DONE");
  const decisionsOpen = decisions.filter((item) => item.status === "PROPOSED");
  const issuesOpen = issues.filter((item) => item.status === "OPEN" || item.status === "IN_PROGRESS");
  const changesOpen = changes.filter((item) => item.status === "DRAFT" || item.status === "UNDER_REVIEW");

  inputs.push({
    key: "management",
    title: "Actions, issues and changes",
    question: "Are meeting actions, decisions, issues and change events resolved?",
    group: "management",
    module: "governance",
    needs: ["governance", "risk"],
    total: meetingActions.length + decisions.length + issues.length + changes.length,
    done:
      meetingActions.length - actionsOpen.length + (decisions.length - decisionsOpen.length) + (issues.length - issuesOpen.length) + (changes.length - changesOpen.length),
    unit: "items resolved",
    blockers: [
      ...actionsOpen.map((item) => blocker(item.id, item.actionNumber, item.title, item.ownerName, item.dueDate, `Action · ${words(item.status)}`, today, item.overdue)),
      ...decisionsOpen.map((item) => blocker(item.id, item.decisionNumber, item.title, item.ownerName, item.dueDate, "Decision awaiting approval", today, item.overdue)),
      ...issuesOpen.map((item) => blocker(item.id, item.reference, item.title, item.ownerName, item.targetResolutionDate, `${words(item.severity)} severity issue`, today)),
      ...changesOpen.map((item) => blocker(item.id, item.reference, item.title, item.originator, null, `Change event · ${words(item.status)}`, today)),
    ],
  });

  const gates = inputs.map((input): Gate => {
    const missing = input.needs.filter((module) => lost.has(module));
    const everything = missing.length === input.needs.length;
    const blockers = order(input.blockers);
    const overdue = blockers.filter((item) => item.overdue).length;

    const state: GateState = everything ? "unknown" : input.total === 0 ? "none" : blockers.length === 0 ? "clear" : overdue > 0 ? "late" : "open";

    const notes = [...(input.notes ?? [])];

    if (!everything && missing.length > 0) {
      notes.push(`Some data did not load (${missing.map((module) => MODULE_LABEL[module].toLowerCase()).join(", ")}), so this gate may be incomplete.`);
    }

    const pace = input.closedDates && state !== "unknown" && state !== "none" ? paceOf(input.closedDates, blockers.length, today) : null;

    return {
      key: input.key,
      title: input.title,
      question: input.question,
      group: input.group,
      module: input.module,
      path: MODULE_PATH[input.module],
      total: input.total,
      done: input.done,
      ratio: input.total > 0 ? input.done / input.total : NaN,
      blockers,
      overdue,
      state,
      pace,
      figure: input.total > 0 ? `${input.done} of ${input.total} ${input.unit}` : "Nothing recorded yet",
      note: notes.length > 0 ? notes.join(" ") : null,
    };
  });

  const counted = gates.filter((gate) => gate.state === "clear" || gate.state === "open" || gate.state === "late");
  const ratios = counted.map((gate) => gate.ratio).filter(Number.isFinite);
  const project = projectOf(sources);
  const planned = toDay(project?.plannedEndDate);

  const timed = counted.filter((gate) => gate.pace !== null && gate.blockers.length > 0);
  const estimated = timed.filter((gate) => gate.pace?.clearBy !== null && gate.pace?.clearBy !== undefined);
  const slowest = estimated.reduce<Gate | null>((worst, gate) => (worst === null || (gate.pace?.clearBy ?? 0) > (worst.pace?.clearBy ?? 0) ? gate : worst), null);

  return {
    gates,
    clear: counted.filter((gate) => gate.state === "clear").length,
    applicable: counted.length,
    readiness: ratios.length > 0 ? (ratios.reduce((sum, value) => sum + value, 0) / ratios.length) * 100 : NaN,
    open: counted.reduce((sum, gate) => sum + gate.blockers.length, 0),
    overdue: counted.reduce((sum, gate) => sum + gate.overdue, 0),
    planned,
    daysLeft: Number.isFinite(planned) ? planned - today : NaN,
    estimate: slowest?.pace?.clearBy ?? null,
    slowest,
    stalled: timed.filter((gate) => gate.pace?.clearBy === null || gate.pace?.clearBy === undefined),
  };
}

export function paceLine(gate: Gate): string | null {
  if (!gate.pace || gate.blockers.length === 0) {
    return null;
  }

  if (gate.pace.closed === 0) {
    return `Nothing closed in the last ${PACE_DAYS / 7} weeks`;
  }

  const weekly = gate.pace.perWeek >= 10 ? Math.round(gate.pace.perWeek) : Math.round(gate.pace.perWeek * 10) / 10;

  return `Closing about ${weekly} a week${gate.pace.clearBy !== null ? ` · clear around ${formatDay(gate.pace.clearBy)}` : ""}`;
}

export function closeoutMarkdown(data: Closeout, projectName: string, today: number): string {
  const lines: string[] = [`# Closeout readiness: ${projectName}`, ""];

  lines.push(`As of ${formatDay(today)}: ${data.clear} of ${data.applicable} gates clear, ${data.open} ${plural(data.open, "item", "items")} open, ${data.overdue} overdue.`);

  if (Number.isFinite(data.planned)) {
    lines.push(`Planned completion ${formatDay(data.planned)} (${data.daysLeft >= 0 ? `${data.daysLeft} days left` : `${-data.daysLeft} days past`}).`);
  }

  if (data.estimate !== null && data.slowest) {
    lines.push(`At the recent closing pace the slowest gate (${data.slowest.title}) clears around ${formatDay(data.estimate)}.`);
  }

  lines.push("");

  for (const gate of data.gates) {
    const mark = gate.state === "clear" ? "[x]" : "[ ]";

    lines.push(`- ${mark} **${gate.title}**: ${gate.state === "unknown" ? "could not load" : gate.figure}${gate.overdue > 0 ? `, ${gate.overdue} overdue` : ""}`);

    for (const item of gate.blockers.slice(0, 5)) {
      const due = Number.isFinite(item.due) ? `, due ${formatDay(item.due)}${item.overdue ? " (overdue)" : ""}` : item.overdue ? " (overdue)" : "";

      lines.push(`  - ${[item.reference, item.title].filter(Boolean).join(" ")}${item.owner ? ` (${item.owner})` : ""}${due}`);
    }

    if (gate.blockers.length > 5) {
      lines.push(`  - and ${gate.blockers.length - 5} more`);
    }
  }

  return `${lines.join("\n")}\n`;
}
