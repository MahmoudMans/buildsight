import { formatDay, toDay, words, type ModuleKey, type Sources } from "@/lib/openItems";

export interface SearchRecord {
  id: string;
  module: ModuleKey;
  kind: string;
  reference: string;
  title: string;
  status: string;
  owner: string | null;
  day: number;
  dayLabel: string;
  flags: string[];
  closed: boolean;
  text: string;
  haystack: string;
}

export interface SearchHit {
  record: SearchRecord;
  score: number;
}

export interface SearchOptions {
  module: ModuleKey | "all";
  kind: string;
}

const SNIPPET_RADIUS = 60;
const FINISHED = /^(closed|void|done|completed|cancelled|resolved)$/i;
const CLOSED_PENALTY = 20;
const ALERT_BONUS = 6;
const ALERTING = /overdue|expired|blocked|missing/i;

type Draft = Omit<SearchRecord, "haystack" | "text" | "flags" | "closed"> & { text?: Array<string | null | undefined>; flags?: Array<string | false | null> };

function clean(parts: Array<string | null | undefined> | undefined): string {
  return (parts ?? [])
    .filter((part): part is string => typeof part === "string" && part.trim() !== "")
    .map((part) => part.replace(/\s+/g, " ").trim())
    .join(" · ");
}

function finish(draft: Draft): SearchRecord {
  const { text: parts, flags: rawFlags, ...rest } = draft;
  const flags = (rawFlags ?? []).filter((flag): flag is string => typeof flag === "string" && flag.toLowerCase() !== rest.status.toLowerCase());
  const text = clean(parts);

  return {
    ...rest,
    flags,
    closed: FINISHED.test(rest.status),
    text,
    haystack: [rest.reference, rest.title, rest.kind, rest.status, rest.owner ?? "", flags.join(" "), text].join(" ").toLowerCase(),
  };
}

function late(day: number, open: boolean, today: number): boolean {
  return open && Number.isFinite(day) && day < today;
}

export function buildSearchIndex(sources: Sources, today: number): SearchRecord[] {
  const out: SearchRecord[] = [];
  const add = (draft: Draft) => out.push(finish(draft));

  for (const meeting of sources.governance?.meetings ?? []) {
    const held = meeting.heldAt !== null;

    add({
      id: `meeting-${meeting.id}`,
      module: "governance",
      kind: "Meeting",
      reference: meeting.meetingNumber,
      title: meeting.title,
      status: words(meeting.status),
      owner: meeting.chairName,
      day: toDay(meeting.heldAt ?? meeting.scheduledAt),
      dayLabel: held ? "Held" : "Scheduled",
      text: [meeting.minutes, words(meeting.meetingType)],
      flags: [meeting.missingMinutes && "Minutes missing"],
    });
  }

  for (const decision of sources.governance?.decisions ?? []) {
    add({
      id: `decision-${decision.id}`,
      module: "governance",
      kind: "Decision",
      reference: decision.decisionNumber,
      title: decision.title,
      status: words(decision.status),
      owner: decision.ownerName,
      day: toDay(decision.dueDate),
      dayLabel: "Due",
      text: [decision.description, decision.rationale, words(decision.impactArea)],
      flags: [decision.overdue && "Overdue"],
    });
  }

  for (const action of sources.governance?.actions ?? []) {
    add({
      id: `gov-action-${action.id}`,
      module: "governance",
      kind: "Action",
      reference: action.actionNumber,
      title: action.title,
      status: words(action.status),
      owner: action.ownerName,
      day: toDay(action.dueDate),
      dayLabel: "Due",
      text: [action.description, action.blockerReason, words(action.priority)],
      flags: [action.overdue && "Overdue", action.status === "BLOCKED" && "Blocked"],
    });
  }

  for (const risk of sources.risk?.risks ?? []) {
    const open = risk.status === "OPEN" || risk.status === "MITIGATING";

    add({
      id: `risk-${risk.id}`,
      module: "risk",
      kind: "Risk",
      reference: risk.reference,
      title: risk.title,
      status: words(risk.status),
      owner: risk.ownerName,
      day: toDay(risk.mitigationDueDate),
      dayLabel: "Mitigation due",
      text: [risk.description, risk.mitigationPlan, words(risk.category), `${words(risk.exposureBand)} exposure`],
      flags: [late(toDay(risk.mitigationDueDate), open, today) && "Overdue"],
    });
  }

  for (const issue of sources.risk?.issues ?? []) {
    const open = issue.status === "OPEN" || issue.status === "IN_PROGRESS";

    add({
      id: `issue-${issue.id}`,
      module: "risk",
      kind: "Issue",
      reference: issue.reference,
      title: issue.title,
      status: words(issue.status),
      owner: issue.ownerName,
      day: toDay(issue.targetResolutionDate),
      dayLabel: "Target",
      text: [issue.description, words(issue.severity), issue.sourceRiskReference],
      flags: [late(toDay(issue.targetResolutionDate), open, today) && "Overdue"],
    });
  }

  for (const change of sources.risk?.changes ?? []) {
    add({
      id: `change-${change.id}`,
      module: "risk",
      kind: "Change event",
      reference: change.reference,
      title: change.title,
      status: words(change.status),
      owner: change.originator,
      day: toDay(change.requestedDate),
      dayLabel: "Requested",
      text: [change.description],
      flags: [],
    });
  }

  for (const delay of sources.risk?.delays ?? []) {
    add({
      id: `delay-${delay.id}`,
      module: "risk",
      kind: "Delay event",
      reference: delay.reference,
      title: delay.title,
      status: words(delay.status),
      owner: delay.ownerName,
      day: toDay(delay.startDate),
      dayLabel: "Started",
      text: [delay.description, words(delay.cause)],
      flags: [delay.compensable && "Compensable", delay.excusable && "Excusable"],
    });
  }

  for (const incident of sources.safety?.incidents ?? []) {
    add({
      id: `incident-${incident.id}`,
      module: "safety",
      kind: "Incident",
      reference: incident.reference,
      title: incident.title,
      status: words(incident.status),
      owner: null,
      day: toDay(incident.occurredDate),
      dayLabel: "Occurred",
      text: [
        incident.description,
        incident.location,
        incident.rootCause,
        incident.immediateAction,
        incident.investigationNotes,
        words(incident.incidentType),
        words(incident.severity),
      ],
      flags: [],
    });
  }

  for (const observation of sources.safety?.observations ?? []) {
    const due = toDay(observation.dueDate);

    add({
      id: `observation-${observation.id}`,
      module: "safety",
      kind: "Observation",
      reference: observation.reference,
      title: observation.title,
      status: words(observation.status),
      owner: observation.ownerName,
      day: Number.isFinite(due) ? due : toDay(observation.observedDate),
      dayLabel: Number.isFinite(due) ? "Due" : "Observed",
      text: [observation.description, observation.location, words(observation.hazardCategory), words(observation.severity), observation.observerName],
      flags: [observation.overdue && "Overdue"],
    });
  }

  for (const action of sources.safety?.actions ?? []) {
    add({
      id: `safety-action-${action.id}`,
      module: "safety",
      kind: "Safety action",
      reference: action.reference,
      title: action.title,
      status: words(action.status),
      owner: action.ownerName,
      day: toDay(action.dueDate),
      dayLabel: "Due",
      text: [action.actionDescription, action.verificationNotes, action.incidentReference, action.observationReference],
      flags: [action.overdue && "Overdue"],
    });
  }

  for (const permit of sources.safety?.permits ?? []) {
    add({
      id: `permit-${permit.id}`,
      module: "safety",
      kind: "Work permit",
      reference: permit.reference,
      title: permit.title,
      status: words(permit.status),
      owner: permit.receiverName,
      day: toDay(permit.validUntil),
      dayLabel: "Valid until",
      text: [permit.controls, permit.location, words(permit.permitType), permit.issuerName],
      flags: [permit.expired && "Expired"],
    });
  }

  for (const inspection of sources.quality?.inspections ?? []) {
    const done = toDay(inspection.actualDate);

    add({
      id: `inspection-${inspection.id}`,
      module: "quality",
      kind: "Inspection",
      reference: inspection.reference,
      title: inspection.title,
      status: words(inspection.status),
      owner: inspection.inspectorName,
      day: Number.isFinite(done) ? done : toDay(inspection.plannedDate),
      dayLabel: Number.isFinite(done) ? "Done" : "Planned",
      text: [inspection.notes, words(inspection.discipline), words(inspection.inspectionType), words(inspection.result)],
      flags: [],
    });
  }

  for (const ncr of sources.quality?.ncrs ?? []) {
    add({
      id: `ncr-${ncr.id}`,
      module: "quality",
      kind: "NCR",
      reference: ncr.reference,
      title: ncr.title,
      status: words(ncr.status),
      owner: ncr.ownerName,
      day: toDay(ncr.dueDate),
      dayLabel: "Due",
      text: [ncr.description, ncr.rootCause, ncr.correctiveAction, ncr.verificationNotes, words(ncr.category), words(ncr.severity), ncr.inspectionReference],
      flags: [ncr.overdue && "Overdue"],
    });
  }

  for (const punch of sources.quality?.punchItems ?? []) {
    add({
      id: `punch-${punch.id}`,
      module: "quality",
      kind: "Punch item",
      reference: punch.reference,
      title: punch.title,
      status: words(punch.status),
      owner: punch.ownerName,
      day: toDay(punch.dueDate),
      dayLabel: "Due",
      text: [punch.description, punch.location, punch.trade, words(punch.priority)],
      flags: [punch.overdue && "Overdue"],
    });
  }

  for (const item of sources.quality?.handoverItems ?? []) {
    add({
      id: `handover-${item.id}`,
      module: "quality",
      kind: "Handover item",
      reference: item.code,
      title: item.title,
      status: words(item.status),
      owner: item.ownerName,
      day: toDay(item.dueDate),
      dayLabel: "Due",
      text: [item.notes, words(item.category)],
      flags: [item.overdue && "Overdue"],
    });
  }

  for (const document of sources.documents?.documents ?? []) {
    add({
      id: `document-${document.id}`,
      module: "documents",
      kind: "Document",
      reference: document.documentNumber,
      title: document.title,
      status: document.latestRevisionStatus ? words(document.latestRevisionStatus) : "",
      owner: document.ownerName,
      day: NaN,
      dayLabel: "",
      text: [words(document.documentType), words(document.discipline), document.latestRevisionCode ? `Revision ${document.latestRevisionCode}` : null],
      flags: [],
    });
  }

  for (const rfi of sources.documents?.rfis ?? []) {
    add({
      id: `rfi-${rfi.id}`,
      module: "documents",
      kind: "RFI",
      reference: rfi.reference,
      title: rfi.subject,
      status: words(rfi.status),
      owner: rfi.assignedTo,
      day: toDay(rfi.dueDate),
      dayLabel: "Due",
      text: [rfi.question, rfi.response, rfi.raisedBy, words(rfi.priority)],
      flags: [rfi.overdue && "Overdue"],
    });
  }

  for (const transmittal of sources.documents?.transmittals ?? []) {
    add({
      id: `transmittal-${transmittal.id}`,
      module: "documents",
      kind: "Transmittal",
      reference: transmittal.reference,
      title: `Transmittal to ${transmittal.recipient}`,
      status: words(transmittal.status),
      owner: null,
      day: toDay(transmittal.transmittalDate),
      dayLabel: "Dated",
      text: [transmittal.purpose, transmittal.notes, transmittal.revisionReferences.join(" ")],
      flags: [],
    });
  }

  for (const order of sources.commercial?.changeOrders ?? []) {
    add({
      id: `change-order-${order.id}`,
      module: "commercial",
      kind: "Change order",
      reference: order.reference,
      title: order.title,
      status: words(order.status),
      owner: null,
      day: toDay(order.decisionDueDate),
      dayLabel: "Decision due",
      text: [order.description, order.sourceChangeReference],
      flags: [order.overdueDecision && "Overdue"],
    });
  }

  for (const claim of sources.commercial?.claims ?? []) {
    add({
      id: `claim-${claim.id}`,
      module: "commercial",
      kind: "Claim",
      reference: claim.reference,
      title: claim.title,
      status: words(claim.status),
      owner: null,
      day: toDay(claim.responseDueDate),
      dayLabel: "Response due",
      text: [claim.basis, words(claim.claimType)],
      flags: [claim.overdueResponse && "Overdue"],
    });
  }

  for (const certificate of sources.commercial?.paymentCertificates ?? []) {
    const payDue = toDay(certificate.paymentDueDate);

    add({
      id: `certificate-${certificate.id}`,
      module: "commercial",
      kind: "Payment certificate",
      reference: certificate.reference,
      title: `Certificate for ${formatDay(toDay(certificate.periodStart))} to ${formatDay(toDay(certificate.periodEnd))}`,
      status: words(certificate.status),
      owner: null,
      day: Number.isFinite(payDue) ? payDue : toDay(certificate.certificationDueDate),
      dayLabel: Number.isFinite(payDue) ? "Payment due" : "Certification due",
      text: [],
      flags: [certificate.overduePayment && "Payment overdue", certificate.overdueCertification && "Certification overdue"],
    });
  }

  for (const pack of sources.procurement?.packages ?? []) {
    add({
      id: `package-${pack.id}`,
      module: "procurement",
      kind: "Package",
      reference: pack.reference,
      title: pack.title,
      status: words(pack.status),
      owner: null,
      day: toDay(pack.requiredOnSiteDate),
      dayLabel: "Needed on site",
      text: [pack.description, pack.costCode, pack.costCodeName, pack.awardedSupplierName, pack.commitmentReference],
      flags: [],
    });
  }

  for (const bid of sources.procurement?.bids ?? []) {
    add({
      id: `bid-${bid.id}`,
      module: "procurement",
      kind: "Bid",
      reference: bid.packageReference,
      title: `Bid from ${bid.supplierName}`,
      status: words(bid.status),
      owner: null,
      day: toDay(bid.submittedDate),
      dayLabel: "Submitted",
      text: [bid.notes, bid.supplierCode],
      flags: [],
    });
  }

  for (const supplier of sources.procurement?.suppliers ?? []) {
    add({
      id: `supplier-${supplier.id}`,
      module: "procurement",
      kind: "Supplier",
      reference: supplier.code,
      title: supplier.name,
      status: words(supplier.qualificationStatus),
      owner: supplier.contactPerson,
      day: NaN,
      dayLabel: "",
      text: [supplier.trade, supplier.country, supplier.email, words(supplier.supplierType)],
      flags: [],
    });
  }

  for (const pack of sources.production?.workPackages ?? []) {
    add({
      id: `work-package-${pack.id}`,
      module: "production",
      kind: "Work package",
      reference: pack.code,
      title: pack.name,
      status: words(pack.status),
      owner: null,
      day: toDay(pack.plannedEndDate),
      dayLabel: "Planned finish",
      text: [pack.description, pack.blockReason, pack.unit],
      flags: [pack.status === "BLOCKED" && "Blocked"],
    });
  }

  for (const report of sources.production?.siteReports ?? []) {
    add({
      id: `site-report-${report.id}`,
      module: "production",
      kind: "Site report",
      reference: report.reference,
      title: `Site report for ${formatDay(toDay(report.reportDate))}`,
      status: words(report.status),
      owner: null,
      day: toDay(report.reportDate),
      dayLabel: "Reported",
      text: [report.generalNotes, words(report.weatherCondition)],
      flags: [],
    });
  }

  for (const milestone of sources.center?.milestones ?? []) {
    const forecast = toDay(milestone.forecastDate);

    add({
      id: `milestone-${milestone.id}`,
      module: "schedule",
      kind: "Milestone",
      reference: "",
      title: milestone.name,
      status: words(milestone.status),
      owner: null,
      day: forecast,
      dayLabel: "Forecast",
      text: [milestone.description],
      flags: [late(forecast, milestone.status !== "COMPLETED", today) && "Overdue", milestone.status === "BLOCKED" && "Blocked"],
    });
  }

  return out;
}

export function tokenize(query: string): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const raw of query.toLowerCase().split(/\s+/)) {
    const term = raw.replace(/^["']+|["']+$/g, "");

    if (term !== "" && !seen.has(term)) {
      seen.add(term);
      terms.push(term);
    }
  }

  return terms;
}

function scoreRecord(record: SearchRecord, terms: string[]): number {
  const reference = record.reference.toLowerCase();
  const title = record.title.toLowerCase();
  const owner = (record.owner ?? "").toLowerCase();
  const meta = `${record.kind} ${record.status} ${record.flags.join(" ")}`.toLowerCase();

  let total = 0;

  for (const term of terms) {
    if (!record.haystack.includes(term)) {
      return -1;
    }

    if (reference === term) {
      total += 100;
    } else if (reference.startsWith(term)) {
      total += 60;
    } else if (reference.includes(term)) {
      total += 40;
    } else if (title.split(/[^a-z0-9]+/).some((part) => part.startsWith(term))) {
      total += 30;
    } else if (title.includes(term)) {
      total += 20;
    } else if (owner.includes(term)) {
      total += 12;
    } else if (meta.includes(term)) {
      total += 8;
    } else {
      total += 5;
    }
  }

  return total;
}

export function runSearch(records: SearchRecord[], terms: string[], options: SearchOptions): SearchHit[] {
  const hits: SearchHit[] = [];

  for (const record of records) {
    if (options.module !== "all" && record.module !== options.module) {
      continue;
    }

    if (options.kind !== "all" && record.kind !== options.kind) {
      continue;
    }

    const score = terms.length === 0 ? 0 : scoreRecord(record, terms);

    if (score >= 0) {
      const alert = record.flags.some((flag) => ALERTING.test(flag));

      hits.push({ record, score: score - (record.closed ? CLOSED_PENALTY : 0) + (alert ? ALERT_BONUS : 0) });
    }
  }

  return hits.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    const aAlert = a.record.flags.some((flag) => ALERTING.test(flag));
    const bAlert = b.record.flags.some((flag) => ALERTING.test(flag));

    if (aAlert !== bAlert) {
      return aAlert ? -1 : 1;
    }

    if (a.record.closed !== b.record.closed) {
      return a.record.closed ? 1 : -1;
    }

    const aDay = Number.isFinite(a.record.day) ? a.record.day : Infinity;
    const bDay = Number.isFinite(b.record.day) ? b.record.day : Infinity;

    if (aDay !== bDay) {
      return aDay < bDay ? -1 : 1;
    }

    return a.record.reference.localeCompare(b.record.reference) || a.record.title.localeCompare(b.record.title);
  });
}

export function countByModule(records: SearchRecord[], terms: string[], kind: string): Map<ModuleKey, number> {
  const counts = new Map<ModuleKey, number>();

  for (const record of records) {
    if (kind !== "all" && record.kind !== kind) {
      continue;
    }

    if (terms.length > 0 && scoreRecord(record, terms) < 0) {
      continue;
    }

    counts.set(record.module, (counts.get(record.module) ?? 0) + 1);
  }

  return counts;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface Segment {
  text: string;
  hit: boolean;
}

export function highlight(text: string, terms: string[]): Segment[] {
  if (terms.length === 0 || text === "") {
    return [{ text, hit: false }];
  }

  const pattern = new RegExp(`(${[...terms].sort((a, b) => b.length - a.length).map(escapeRegex).join("|")})`, "gi");
  const segments: Segment[] = [];

  text.split(pattern).forEach((part, index) => {
    if (part !== "") {
      segments.push({ text: part, hit: index % 2 === 1 });
    }
  });

  return segments.length > 0 ? segments : [{ text, hit: false }];
}

export function snippetFor(record: SearchRecord, terms: string[]): string | null {
  if (terms.length === 0 || record.text === "") {
    return null;
  }

  const visible = `${record.reference} ${record.title}`.toLowerCase();
  const needle = terms.find((term) => !visible.includes(term) && record.text.toLowerCase().includes(term));

  if (!needle) {
    return null;
  }

  const at = record.text.toLowerCase().indexOf(needle);
  const from = Math.max(0, at - SNIPPET_RADIUS);
  const to = Math.min(record.text.length, at + needle.length + SNIPPET_RADIUS);

  return `${from > 0 ? "…" : ""}${record.text.slice(from, to).trim()}${to < record.text.length ? "…" : ""}`;
}
