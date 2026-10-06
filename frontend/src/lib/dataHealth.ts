import { MODULE_PATH, toDay, type ModuleKey, type Sources } from "@/lib/openItems";

export type Weight = 1 | 2 | 3;

export interface Gap {
  ref: string;
  title: string;
  note: string;
  path: string;
}

export interface CheckResult {
  key: string;
  module: ModuleKey;
  label: string;
  why: string;
  weight: Weight;
  population: number;
  gaps: Gap[];
}

export const PROGRESS_STALE_DAYS = 14;
export const REPORT_STALE_DAYS = 30;
export const CHANGE_STALE_DAYS = 30;
export const NCR_STALE_DAYS = 14;
export const INCIDENT_STALE_DAYS = 7;

function blank(value: string | null | undefined): boolean {
  return !value || !value.trim();
}

function ago(today: number, day: number): number {
  return Number.isFinite(day) ? today - day : NaN;
}

export function runChecks(sources: Sources, today: number): CheckResult[] {
  const results: CheckResult[] = [];

  function add(
    key: string,
    module: ModuleKey,
    label: string,
    why: string,
    weight: Weight,
    population: number,
    gaps: Gap[],
  ) {
    results.push({ key, module, label, why, weight, population, gaps });
  }

  function gap(module: ModuleKey, ref: string, title: string, note: string): Gap {
    return { ref, title, note, path: MODULE_PATH[module] };
  }

  const governance = sources.governance;

  if (governance) {
    const openActions = governance.actions.filter((item) => item.status !== "DONE" && item.status !== "VOID");
    const blocked = openActions.filter((item) => item.status === "BLOCKED");
    const proposed = governance.decisions.filter((item) => item.status === "PROPOSED");
    const held = governance.meetings.filter((item) => item.status === "HELD");
    const planned = governance.meetings.filter((item) => item.status === "PLANNED");

    add(
      "gov-action-owner",
      "governance",
      "Open actions without an owner",
      "An action nobody owns is one nobody chases.",
      3,
      openActions.length,
      openActions.filter((item) => blank(item.ownerName)).map((item) => gap("governance", item.actionNumber, item.title, "No owner")),
    );

    add(
      "gov-blocked-reason",
      "governance",
      "Blocked actions without a reason",
      "Without the blocker written down, nobody knows what has to be unblocked.",
      2,
      blocked.length,
      blocked.filter((item) => blank(item.blockerReason)).map((item) => gap("governance", item.actionNumber, item.title, "Blocked, no reason")),
    );

    add(
      "gov-decision-owner",
      "governance",
      "Proposed decisions without an owner",
      "A decision with no owner has nobody pushing it to a close.",
      2,
      proposed.length,
      proposed.filter((item) => blank(item.ownerName)).map((item) => gap("governance", item.decisionNumber, item.title, "No owner")),
    );

    add(
      "gov-decision-due",
      "governance",
      "Proposed decisions without a due date",
      "With no date, a decision cannot show up as late.",
      1,
      proposed.length,
      proposed.filter((item) => blank(item.dueDate)).map((item) => gap("governance", item.decisionNumber, item.title, "No due date")),
    );

    add(
      "gov-minutes",
      "governance",
      "Held meetings without minutes",
      "Decisions and actions from a meeting are lost if the minutes are never written.",
      2,
      held.length,
      held.filter((item) => item.missingMinutes).map((item) => gap("governance", item.meetingNumber, item.title, "Held, no minutes")),
    );

    add(
      "gov-meeting-stale",
      "governance",
      "Planned meetings whose date has passed",
      "Mark the meeting as held or move it, so the schedule shows what really happened.",
      1,
      planned.length,
      planned
        .filter((item) => toDay(item.scheduledAt) < today)
        .map((item) => gap("governance", item.meetingNumber, item.title, `Planned for ${item.scheduledAt.slice(0, 10)}`)),
    );

    const lastReport = governance.reportHistory
      .map((item) => toDay(item.reportDate))
      .filter((day) => Number.isFinite(day))
      .sort((a, b) => b - a)[0];
    const reportAge = lastReport === undefined ? NaN : today - lastReport;

    add(
      "gov-report",
      "governance",
      `Executive report saved in the last ${REPORT_STALE_DAYS} days`,
      "Saved reports are what the since-last-report page compares against.",
      1,
      1,
      lastReport === undefined
        ? [gap("governance", "Executive report", "No report has ever been saved", "Save a snapshot")]
        : reportAge > REPORT_STALE_DAYS
          ? [gap("governance", "Executive report", `Last saved ${reportAge} days ago`, "Save a new snapshot")]
          : [],
    );
  }

  const risk = sources.risk;

  if (risk) {
    const openRisks = risk.risks.filter((item) => item.status === "OPEN" || item.status === "MITIGATING");
    const openIssues = risk.issues.filter((item) => item.status === "OPEN" || item.status === "IN_PROGRESS");
    const waiting = risk.changes.filter((item) => item.status === "DRAFT" || item.status === "UNDER_REVIEW");
    const live = risk.changes.filter((item) => item.status !== "REJECTED");

    add(
      "risk-owner",
      "risk",
      "Open risks without an owner",
      "Every open risk needs someone accountable for its mitigation.",
      3,
      openRisks.length,
      openRisks.filter((item) => blank(item.ownerName)).map((item) => gap("risk", item.reference, item.title, "No owner")),
    );

    add(
      "risk-plan",
      "risk",
      "Open risks without a mitigation plan",
      "A risk with no plan is only a worry on a list.",
      3,
      openRisks.length,
      openRisks.filter((item) => blank(item.mitigationPlan)).map((item) => gap("risk", item.reference, item.title, "No mitigation plan")),
    );

    add(
      "risk-issue-owner",
      "risk",
      "Open issues without an owner",
      "An issue that has already happened needs someone resolving it.",
      3,
      openIssues.length,
      openIssues.filter((item) => blank(item.ownerName)).map((item) => gap("risk", item.reference, item.title, "No owner")),
    );

    add(
      "risk-change-stale",
      "risk",
      `Change events waiting more than ${CHANGE_STALE_DAYS} days`,
      "Unanswered changes hold up work and weaken any later claim.",
      2,
      waiting.length,
      waiting
        .filter((item) => ago(today, toDay(item.requestedDate)) > CHANGE_STALE_DAYS)
        .map((item) => gap("risk", item.reference, item.title, `Waiting ${ago(today, toDay(item.requestedDate))} days`)),
    );

    add(
      "risk-change-impact",
      "risk",
      "Change events with no cost or time impact",
      "A change with no figures cannot be priced or claimed.",
      1,
      live.length,
      live
        .filter((item) => item.costImpact === 0 && item.scheduleImpactDays === 0)
        .map((item) => gap("risk", item.reference, item.title, "No cost or time impact entered")),
    );
  }

  const quality = sources.quality;

  if (quality) {
    const openNcrs = quality.ncrs.filter((item) => item.status !== "CLOSED" && item.status !== "VOID");
    const openPunch = quality.punchItems.filter((item) => item.status !== "CLOSED" && item.status !== "VOID");
    const plannedInspections = quality.inspections.filter((item) => item.status === "PLANNED");

    add(
      "quality-ncr-owner",
      "quality",
      "Open NCRs without an owner",
      "Non-conformances need a named person to correct them.",
      3,
      openNcrs.length,
      openNcrs.filter((item) => blank(item.ownerName)).map((item) => gap("quality", item.reference, item.title, "No owner")),
    );

    add(
      "quality-ncr-action",
      "quality",
      `NCRs older than ${NCR_STALE_DAYS} days with no corrective action`,
      "An old NCR with no corrective action is not moving.",
      2,
      openNcrs.length,
      openNcrs
        .filter((item) => ago(today, toDay(item.raisedDate)) > NCR_STALE_DAYS && blank(item.correctiveAction))
        .map((item) => gap("quality", item.reference, item.title, `Raised ${ago(today, toDay(item.raisedDate))} days ago`)),
    );

    add(
      "quality-punch-owner",
      "quality",
      "Open punch items without an owner",
      "Punch items without an owner are what delays handover.",
      2,
      openPunch.length,
      openPunch.filter((item) => blank(item.ownerName)).map((item) => gap("quality", item.reference, item.title, "No owner")),
    );

    add(
      "quality-inspection-stale",
      "quality",
      "Planned inspections whose date has passed",
      "Record the result or move the date so the inspection plan stays honest.",
      2,
      plannedInspections.length,
      plannedInspections
        .filter((item) => toDay(item.plannedDate) < today)
        .map((item) => gap("quality", item.reference, item.title, `Planned for ${item.plannedDate.slice(0, 10)}`)),
    );
  }

  const safety = sources.safety;

  if (safety) {
    const active = safety.permits.filter((item) => item.status === "ACTIVE");
    const openActions = safety.actions.filter((item) => item.status !== "CLOSED" && item.status !== "VOID");
    const incidents = safety.incidents.filter((item) => item.status !== "CLOSED" && item.status !== "VOID");

    add(
      "safety-permit-expired",
      "safety",
      "Active permits that have already expired",
      "Work under an expired permit is work without cover.",
      3,
      active.length,
      active
        .filter((item) => item.expired || toDay(item.validUntil) < today)
        .map((item) => gap("safety", item.reference, item.title, `Valid until ${item.validUntil.slice(0, 10)}`)),
    );

    add(
      "safety-action-owner",
      "safety",
      "Open safety actions without an owner",
      "Safety actions with no owner are the ones that stay open.",
      3,
      openActions.length,
      openActions.filter((item) => blank(item.ownerName)).map((item) => gap("safety", item.reference, item.title, "No owner")),
    );

    add(
      "safety-incident-cause",
      "safety",
      `Open incidents older than ${INCIDENT_STALE_DAYS} days with no root cause`,
      "Without a root cause the same incident can happen again.",
      2,
      incidents.length,
      incidents
        .filter((item) => ago(today, toDay(item.reportedDate)) > INCIDENT_STALE_DAYS && blank(item.rootCause))
        .map((item) => gap("safety", item.reference, item.title, `Reported ${ago(today, toDay(item.reportedDate))} days ago`)),
    );
  }

  const documents = sources.documents;

  if (documents) {
    const openRfis = documents.rfis.filter((item) => item.status === "OPEN");

    add(
      "docs-rfi-assignee",
      "documents",
      "Open RFIs without an assignee",
      "An RFI nobody is assigned to will not get answered.",
      2,
      openRfis.length,
      openRfis.filter((item) => blank(item.assignedTo)).map((item) => gap("documents", item.reference, item.subject, "No assignee")),
    );
  }

  const commercial = sources.commercial;

  if (commercial) {
    const pendingOrders = commercial.changeOrders.filter((item) => item.status === "SUBMITTED" || item.status === "UNDER_REVIEW");
    const pendingClaims = commercial.claims.filter((item) => item.status === "SUBMITTED" || item.status === "UNDER_REVIEW");
    const payable = commercial.paymentCertificates.filter(
      (item) => (item.status === "CERTIFIED" || item.status === "PARTIALLY_PAID") && item.outstandingAmount > 0,
    );

    add(
      "com-order-due",
      "commercial",
      "Change orders with the client but no decision date",
      "Without a date, a slow client decision never shows as late.",
      2,
      pendingOrders.length,
      pendingOrders.filter((item) => blank(item.decisionDueDate)).map((item) => gap("commercial", item.reference, item.title, "No decision date")),
    );

    add(
      "com-claim-due",
      "commercial",
      "Claims with the client but no response date",
      "Contract response periods only help if the date is on record.",
      2,
      pendingClaims.length,
      pendingClaims.filter((item) => blank(item.responseDueDate)).map((item) => gap("commercial", item.reference, item.title, "No response date")),
    );

    add(
      "com-payment-due",
      "commercial",
      "Certified payments with no payment due date",
      "A certified amount with no due date cannot be chased.",
      2,
      payable.length,
      payable.filter((item) => blank(item.paymentDueDate)).map((item) => gap("commercial", item.reference, `Certificate ${item.periodStart.slice(0, 10)} to ${item.periodEnd.slice(0, 10)}`, "No payment due date")),
    );
  }

  const procurement = sources.procurement;

  if (procurement) {
    const tendering = procurement.packages.filter((item) => item.status === "PLANNING" || item.status === "TENDERING" || item.status === "EVALUATION");
    const awarded = procurement.packages.filter((item) => item.status === "AWARDED");

    add(
      "proc-award-late",
      "procurement",
      "Packages still open after their award due date",
      "Either the award has happened and the status is stale, or the package is late.",
      2,
      tendering.length,
      tendering
        .filter((item) => toDay(item.awardDueDate) < today)
        .map((item) => gap("procurement", item.reference, item.title, `Award was due ${item.awardDueDate.slice(0, 10)}`)),
    );

    add(
      "proc-commitment",
      "procurement",
      "Awarded packages with no commitment",
      "Until a commitment exists, the award is not in the cost forecast.",
      2,
      awarded.length,
      awarded.filter((item) => blank(item.commitmentId)).map((item) => gap("procurement", item.reference, item.title, "Awarded, no commitment")),
    );
  }

  const production = sources.production;

  if (production) {
    const blocked = production.workPackages.filter((item) => item.status === "BLOCKED");
    const unfinished = production.workPackages.filter((item) => item.status === "PLANNED" || item.status === "IN_PROGRESS" || item.status === "BLOCKED");

    add(
      "prod-block-reason",
      "production",
      "Blocked work packages without a reason",
      "Nobody can clear a block that was never explained.",
      2,
      blocked.length,
      blocked.filter((item) => blank(item.blockReason)).map((item) => gap("production", item.code, item.name, "Blocked, no reason")),
    );

    add(
      "prod-past-end",
      "production",
      "Unfinished work packages past their planned finish",
      "Update the status or the dates so production figures stay meaningful.",
      2,
      unfinished.length,
      unfinished
        .filter((item) => toDay(item.plannedEndDate) < today)
        .map((item) => gap("production", item.code, item.name, `Planned to finish ${item.plannedEndDate.slice(0, 10)}`)),
    );
  }

  const center = sources.center;

  if (center) {
    const open = center.milestones.filter((item) => item.status !== "COMPLETED");
    const lastUpdate = center.progressUpdates
      .map((item) => toDay(item.updateDate))
      .filter((day) => Number.isFinite(day))
      .sort((a, b) => b - a)[0];
    const age = lastUpdate === undefined ? NaN : today - lastUpdate;

    add(
      "sched-milestone-stale",
      "schedule",
      "Milestones past their forecast date and not completed",
      "Complete the milestone or move its forecast, so the schedule is not showing the past as the future.",
      2,
      open.length,
      open
        .filter((item) => toDay(item.forecastDate) < today)
        .map((item) => gap("schedule", "Milestone", item.name, `Forecast ${item.forecastDate.slice(0, 10)}`)),
    );

    add(
      "sched-progress",
      "schedule",
      `Progress updated in the last ${PROGRESS_STALE_DAYS} days`,
      "Every progress figure on the dashboards is only as fresh as the last update.",
      3,
      1,
      lastUpdate === undefined
        ? [gap("schedule", "Progress", "No progress update recorded", "Record a progress update")]
        : age > PROGRESS_STALE_DAYS
          ? [gap("schedule", "Progress", `Last update was ${age} days ago`, "Record a progress update")]
          : [],
    );
  }

  return results;
}

export function passRate(result: CheckResult): number {
  return result.population > 0 ? Math.max(0, 1 - result.gaps.length / result.population) : NaN;
}

export function scoreOf(results: ReadonlyArray<CheckResult>): number {
  let weighted = 0;
  let weights = 0;

  for (const result of results) {
    const rate = passRate(result);

    if (Number.isFinite(rate)) {
      weighted += rate * result.weight;
      weights += result.weight;
    }
  }

  return weights > 0 ? (weighted / weights) * 100 : NaN;
}
