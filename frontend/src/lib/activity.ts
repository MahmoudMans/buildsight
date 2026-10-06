import { MODULE_LABEL, formatDay, plural, toDay, words, type ModuleKey, type Sources } from "@/lib/openItems";

export type Tone = "good" | "bad" | "plain";

export interface ActivityEvent {
  id: string;
  day: number;
  module: ModuleKey;
  kind: string;
  reference: string;
  title: string;
  what: string;
  who: string | null;
  tone: Tone;
}

export function buildActivity(sources: Sources, today: number): ActivityEvent[] {
  const events: ActivityEvent[] = [];

  const add = (
    key: string,
    value: string | null | undefined,
    module: ModuleKey,
    kind: string,
    reference: string,
    title: string,
    what: string,
    who: string | null,
    tone: Tone,
  ) => {
    const day = toDay(value);

    if (!Number.isFinite(day) || day > today) {
      return;
    }

    events.push({ id: `${key}-${what}`, day, module, kind, reference, title, what, who, tone });
  };

  for (const meeting of sources.governance?.meetings ?? []) {
    add(`meeting-${meeting.id}`, meeting.heldAt, "governance", "Meeting", meeting.meetingNumber, meeting.title, "Held", meeting.chairName, "plain");
  }

  for (const decision of sources.governance?.decisions ?? []) {
    const proposed = decision.status === "PROPOSED";

    add(
      `decision-${decision.id}`,
      decision.decisionDate,
      "governance",
      "Decision",
      decision.decisionNumber,
      decision.title,
      proposed ? "Proposed" : words(decision.status),
      decision.ownerName,
      "plain",
    );
  }

  for (const action of sources.governance?.actions ?? []) {
    add(`gov-action-${action.id}`, action.completedAt, "governance", "Action", action.actionNumber, action.title, "Completed", action.ownerName, "good");
  }

  for (const risk of sources.risk?.risks ?? []) {
    add(`risk-${risk.id}`, risk.createdAt, "risk", "Risk", risk.reference, risk.title, "Logged", risk.ownerName, "plain");
  }

  for (const issue of sources.risk?.issues ?? []) {
    add(`issue-${issue.id}`, issue.createdAt, "risk", "Issue", issue.reference, issue.title, "Logged", issue.ownerName, "bad");
  }

  for (const change of sources.risk?.changes ?? []) {
    add(`change-${change.id}`, change.requestedDate, "risk", "Change event", change.reference, change.title, "Requested", change.originator, "plain");
    add(`change-${change.id}`, change.decisionDate, "risk", "Change event", change.reference, change.title, words(change.status), change.originator, "plain");
  }

  for (const delay of sources.risk?.delays ?? []) {
    add(`delay-${delay.id}`, delay.startDate, "risk", "Delay event", delay.reference, delay.title, "Delay started", delay.ownerName, "bad");
    add(`delay-${delay.id}`, delay.endDate, "risk", "Delay event", delay.reference, delay.title, "Delay ended", delay.ownerName, "good");
  }

  for (const incident of sources.safety?.incidents ?? []) {
    add(`incident-${incident.id}`, incident.occurredDate, "safety", "Incident", incident.reference, incident.title, "Occurred", null, "bad");
    add(`incident-${incident.id}`, incident.closedDate, "safety", "Incident", incident.reference, incident.title, "Closed", null, "good");
  }

  for (const observation of sources.safety?.observations ?? []) {
    add(`observation-${observation.id}`, observation.observedDate, "safety", "Observation", observation.reference, observation.title, "Observed", observation.observerName, "plain");
    add(`observation-${observation.id}`, observation.closedDate, "safety", "Observation", observation.reference, observation.title, "Closed", observation.ownerName, "good");
  }

  for (const action of sources.safety?.actions ?? []) {
    add(`safety-action-${action.id}`, action.closedDate, "safety", "Safety action", action.reference, action.title, "Closed", action.ownerName, "good");
  }

  for (const permit of sources.safety?.permits ?? []) {
    add(`permit-${permit.id}`, permit.validFrom, "safety", "Work permit", permit.reference, permit.title, "Permit issued", permit.issuerName, "plain");
    add(`permit-${permit.id}`, permit.closedDate, "safety", "Work permit", permit.reference, permit.title, "Closed", permit.receiverName, "good");
  }

  for (const inspection of sources.quality?.inspections ?? []) {
    add(`inspection-${inspection.id}`, inspection.actualDate, "quality", "Inspection", inspection.reference, inspection.title, `Inspected: ${words(inspection.result)}`, inspection.inspectorName, "plain");
  }

  for (const ncr of sources.quality?.ncrs ?? []) {
    add(`ncr-${ncr.id}`, ncr.raisedDate, "quality", "NCR", ncr.reference, ncr.title, "Raised", ncr.ownerName, "bad");
    add(`ncr-${ncr.id}`, ncr.closedDate, "quality", "NCR", ncr.reference, ncr.title, "Closed", ncr.ownerName, "good");
  }

  for (const punch of sources.quality?.punchItems ?? []) {
    add(`punch-${punch.id}`, punch.raisedDate, "quality", "Punch item", punch.reference, punch.title, "Raised", punch.ownerName, "plain");
    add(`punch-${punch.id}`, punch.closedDate, "quality", "Punch item", punch.reference, punch.title, "Closed", punch.ownerName, "good");
  }

  for (const item of sources.quality?.handoverItems ?? []) {
    add(`handover-${item.id}`, item.receivedDate, "quality", "Handover item", item.code, item.title, "Received", item.ownerName, "plain");
    add(`handover-${item.id}`, item.approvedDate, "quality", "Handover item", item.code, item.title, "Approved", item.ownerName, "good");
  }

  for (const rfi of sources.documents?.rfis ?? []) {
    add(`rfi-${rfi.id}`, rfi.raisedDate, "documents", "RFI", rfi.reference, rfi.subject, "Raised", rfi.raisedBy, "plain");
    add(`rfi-${rfi.id}`, rfi.respondedDate, "documents", "RFI", rfi.reference, rfi.subject, "Answered", rfi.assignedTo, "good");
  }

  for (const transmittal of sources.documents?.transmittals ?? []) {
    add(`transmittal-${transmittal.id}`, transmittal.issuedDate, "documents", "Transmittal", transmittal.reference, `To ${transmittal.recipient}`, "Transmittal issued", null, "plain");
  }

  for (const revision of sources.documents?.revisions ?? []) {
    add(
      `revision-${revision.id}`,
      revision.issuedDate,
      "documents",
      "Revision",
      revision.documentNumber,
      `${revision.documentTitle} (rev ${revision.revisionCode})`,
      `Revision ${words(revision.revisionStatus).toLowerCase()}`,
      null,
      "plain",
    );
  }

  for (const order of sources.commercial?.changeOrders ?? []) {
    add(`change-order-${order.id}`, order.submittedDate, "commercial", "Change order", order.reference, order.title, "Submitted", null, "plain");
    add(`change-order-${order.id}`, order.decisionDate, "commercial", "Change order", order.reference, order.title, `Decided: ${words(order.status)}`, null, "plain");
  }

  for (const claim of sources.commercial?.claims ?? []) {
    add(`claim-${claim.id}`, claim.submittedDate, "commercial", "Claim", claim.reference, claim.title, "Submitted", null, "plain");
    add(`claim-${claim.id}`, claim.decisionDate, "commercial", "Claim", claim.reference, claim.title, `Decided: ${words(claim.status)}`, null, "plain");
  }

  for (const certificate of sources.commercial?.paymentCertificates ?? []) {
    const title = `Certificate for ${formatDay(toDay(certificate.periodStart))} to ${formatDay(toDay(certificate.periodEnd))}`;

    add(`certificate-${certificate.id}`, certificate.applicationDate, "commercial", "Payment certificate", certificate.reference, title, "Applied", null, "plain");
    add(`certificate-${certificate.id}`, certificate.certifiedDate, "commercial", "Payment certificate", certificate.reference, title, "Certified", null, "good");
    add(`certificate-${certificate.id}`, certificate.lastPaymentDate, "commercial", "Payment certificate", certificate.reference, title, "Payment received", null, "good");
  }

  for (const pack of sources.procurement?.packages ?? []) {
    add(`package-${pack.id}`, pack.actualIssueDate, "procurement", "Package", pack.reference, pack.title, "Issued to tender", null, "plain");
    add(`package-${pack.id}`, pack.awardDate, "procurement", "Package", pack.reference, pack.title, "Awarded", pack.awardedSupplierName, "good");
  }

  for (const bid of sources.procurement?.bids ?? []) {
    add(`bid-${bid.id}`, bid.submittedDate, "procurement", "Bid", bid.packageReference, `Bid from ${bid.supplierName}`, "Received", null, "plain");
  }

  for (const report of sources.production?.siteReports ?? []) {
    add(`site-report-${report.id}`, report.reportDate, "production", "Site report", report.reference, `Site report for ${formatDay(toDay(report.reportDate))}`, "Reported", null, "plain");
  }

  for (const pack of sources.production?.workPackages ?? []) {
    add(`work-package-${pack.id}`, pack.actualStartDate, "production", "Work package", pack.code, pack.name, "Started", null, "plain");
    add(`work-package-${pack.id}`, pack.actualEndDate, "production", "Work package", pack.code, pack.name, "Finished", null, "good");
  }

  for (const milestone of sources.center?.milestones ?? []) {
    add(`milestone-${milestone.id}`, milestone.actualDate, "schedule", "Milestone", "", milestone.name, "Reached", null, "good");
  }

  for (const update of sources.center?.progressUpdates ?? []) {
    add(
      `progress-${update.id}`,
      update.updateDate,
      "schedule",
      "Progress update",
      "",
      update.note && update.note.trim() !== "" ? update.note.trim() : "Progress recorded",
      `Progress ${Math.round(update.progressPercentage)}%`,
      null,
      "plain",
    );
  }

  return events.sort((a, b) => b.day - a.day || a.module.localeCompare(b.module) || a.reference.localeCompare(b.reference));
}

export function dayName(day: number): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(day * 86_400_000));
}

export function ago(days: number): string {
  if (days <= 0) {
    return "today";
  }

  return days === 1 ? "yesterday" : `${days} days ago`;
}

export function digestMarkdown(
  events: ActivityEvent[],
  projectName: string,
  today: number,
  windowDays: number,
  perModule: number,
): string {
  const lines = [`# Activity digest · ${projectName} · ${formatDay(today)}`, ""];

  lines.push(`Last ${windowDays} ${plural(windowDays, "day", "days")}: ${events.length} ${plural(events.length, "event", "events")}.`, "");

  const groups = new Map<ModuleKey, ActivityEvent[]>();

  for (const event of events) {
    groups.set(event.module, [...(groups.get(event.module) ?? []), event]);
  }

  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || MODULE_LABEL[a[0]].localeCompare(MODULE_LABEL[b[0]]));

  for (const [module, list] of ordered) {
    lines.push(`## ${MODULE_LABEL[module]} (${list.length})`, "");

    for (const event of list.slice(0, perModule)) {
      const ref = event.reference !== "" ? `${event.reference} ` : "";

      lines.push(`- ${formatDay(event.day)} · ${event.what}: ${ref}${event.title}`);
    }

    if (list.length > perModule) {
      lines.push(`- and ${list.length - perModule} more`);
    }

    lines.push("");
  }

  if (ordered.length === 0) {
    lines.push("No recorded activity.");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
