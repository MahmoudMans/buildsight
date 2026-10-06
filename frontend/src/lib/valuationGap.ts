import { formatDay, money, plural, toDay, trunc } from "@/lib/openItems";
import type { CommercialChangeOrder, CommercialClaim, CommercialClaimType, CommercialControl } from "@/types/project";

export const PAGE = 10;
export const FULL = 0.995;
export const HELD_TOLERANCE = 0.01;

export type Kind = "change" | "claim";
export type Scope = "all" | Kind;
export type Outcome = "full" | "cut" | "rejected";
export type VsAssessed = "held" | "above" | "below";

export const SCOPES: ReadonlyArray<{ key: Scope; label: string }> = [
  { key: "all", label: "Both" },
  { key: "change", label: "Change orders" },
  { key: "claim", label: "Claims" },
];

export const OUTCOME_LABEL: Record<Outcome, string> = {
  full: "Approved in full",
  cut: "Cut back",
  rejected: "Rejected",
};

export const ASSESSED_LABEL: Record<VsAssessed, string> = {
  held: "Decided at the assessment",
  above: "Decided above the assessment",
  below: "Decided below the assessment",
};

const CLAIM_LABEL: Record<CommercialClaimType, string> = {
  EXTENSION_OF_TIME: "Extension of time",
  LOSS_AND_EXPENSE: "Loss and expense",
  VARIATION: "Variation claims",
  DISRUPTION: "Disruption",
  DELAY: "Delay",
  OTHER: "Other claims",
};

const GROUP_ORDER = ["Change orders", "Extension of time", "Loss and expense", "Variation claims", "Disruption", "Delay", "Other claims"];

export interface Item {
  id: string;
  kind: Kind;
  reference: string;
  title: string;
  group: string;
  asked: number;
  assessed: number | null;
  decided: number | null;
  askedDays: number;
  decidedDays: number;
  stage: "open" | "decided";
  moneyless: boolean;
  submitted: number | null;
  decidedDate: number | null;
  overdue: boolean;
  waiting: number | null;
  outcome: Outcome | null;
  vsAssessed: VsAssessed | null;
}

export interface OpenTotals {
  count: number;
  asked: number;
  assessedCount: number;
  assessed: number;
  assessedAsked: number;
  unassessedCount: number;
  unassessedAsked: number;
  oldestWaiting: number | null;
  overdue: number;
}

export interface DecidedTotals {
  count: number;
  asked: number;
  decided: number;
  recovery: number | null;
  withAssessment: number;
  assessedAsked: number;
  assessed: number;
  assessedDecided: number;
  held: number;
  above: number;
  below: number;
  full: number;
  cut: number;
  rejected: number;
  claimedDays: number;
  awardedDays: number;
}

export interface Group {
  label: string;
  openCount: number;
  openAsked: number;
  openAssessed: number;
  decidedCount: number;
  moneyCount: number;
  decidedAsked: number;
  decided: number;
  recovery: number | null;
  claimedDays: number;
  awardedDays: number;
}

export interface Gap {
  items: Item[];
  open: Item[];
  decided: Item[];
  openTotals: OpenTotals;
  decidedTotals: DecidedTotals;
  groups: Group[];
  drafts: number;
  draftAsked: number;
  missing: number;
  skipped: number;
}

export type GapResult = { ok: true; gap: Gap } | { ok: false; reason: "empty" };

function amount(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function dayOf(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

function stageOfChange(status: CommercialChangeOrder["status"]): "open" | "decided" | "draft" | "void" {
  if (status === "DRAFT") {
    return "draft";
  }

  if (status === "VOID") {
    return "void";
  }

  return status === "APPROVED" || status === "REJECTED" ? "decided" : "open";
}

function stageOfClaim(status: CommercialClaim["status"]): "open" | "decided" | "draft" | "void" {
  if (status === "DRAFT") {
    return "draft";
  }

  if (status === "VOID") {
    return "void";
  }

  return status === "SUBMITTED" || status === "UNDER_REVIEW" ? "open" : "decided";
}

function judge(asked: number, assessed: number | null, decided: number | null): { outcome: Outcome | null; vs: VsAssessed | null } {
  if (decided === null) {
    return { outcome: null, vs: null };
  }

  const outcome: Outcome = decided <= 0 ? "rejected" : decided >= asked * FULL ? "full" : "cut";
  let vs: VsAssessed | null = null;

  if (assessed !== null) {
    const margin = assessed * HELD_TOLERANCE;

    vs = Math.abs(decided - assessed) <= margin ? "held" : decided > assessed ? "above" : "below";
  }

  return { outcome, vs };
}

export function buildGap(data: CommercialControl, today: number, scope: Scope): GapResult {
  const changeOrders = data.changeOrders ?? [];
  const claims = data.claims ?? [];

  if (changeOrders.length === 0 && claims.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const items: Item[] = [];
  let drafts = 0;
  let draftAsked = 0;
  let missing = 0;
  let skipped = 0;

  if (scope !== "claim") {
    for (const order of changeOrders) {
      const stage = stageOfChange(order.status);
      const asked = amount(order.submittedAmount);

      if (stage === "void") {
        continue;
      }

      if (asked === null || asked <= 0) {
        skipped += 1;
        continue;
      }

      if (stage === "draft") {
        drafts += 1;
        draftAsked += asked;
        continue;
      }

      const assessed = amount(order.assessedAmount);
      const decided = stage === "decided" ? (order.status === "REJECTED" ? (amount(order.approvedAmount) ?? 0) : amount(order.approvedAmount)) : null;

      if (stage === "decided" && decided === null) {
        missing += 1;
        continue;
      }

      const submitted = dayOf(order.submittedDate);
      const judged = judge(asked, assessed, decided);

      items.push({
        id: order.id,
        kind: "change",
        reference: order.reference,
        title: order.title,
        group: "Change orders",
        asked,
        assessed,
        decided,
        askedDays: 0,
        decidedDays: 0,
        stage,
        moneyless: false,
        submitted,
        decidedDate: dayOf(order.decisionDate),
        overdue: stage === "open" && order.overdueDecision,
        waiting: stage === "open" && submitted !== null ? Math.max(0, today - submitted) : null,
        outcome: judged.outcome,
        vsAssessed: judged.vs,
      });
    }
  }

  if (scope !== "change") {
    for (const claim of claims) {
      const stage = stageOfClaim(claim.status);
      const asked = amount(claim.claimedAmount) ?? 0;
      const askedDays = Math.max(0, Number.isFinite(claim.claimedDays) ? claim.claimedDays : 0);
      const decidedDays = Math.max(0, Number.isFinite(claim.awardedDays) ? claim.awardedDays : 0);

      if (stage === "void") {
        continue;
      }

      if (asked <= 0 && askedDays <= 0) {
        skipped += 1;
        continue;
      }

      if (stage === "draft") {
        drafts += 1;
        draftAsked += asked;
        continue;
      }

      const moneyless = asked <= 0;
      const assessed = moneyless ? null : amount(claim.assessedAmount);
      let decided: number | null = null;

      if (stage === "decided" && !moneyless) {
        decided = claim.status === "REJECTED" ? (amount(claim.awardedAmount) ?? 0) : amount(claim.awardedAmount);

        if (decided === null) {
          missing += 1;
        }
      }

      const submitted = dayOf(claim.submittedDate);
      const judged = judge(asked, assessed, decided);

      items.push({
        id: claim.id,
        kind: "claim",
        reference: claim.reference,
        title: claim.title,
        group: CLAIM_LABEL[claim.claimType] ?? "Other claims",
        asked,
        assessed,
        decided,
        askedDays,
        decidedDays,
        stage,
        moneyless,
        submitted,
        decidedDate: dayOf(claim.decisionDate),
        overdue: stage === "open" && claim.overdueResponse,
        waiting: stage === "open" && submitted !== null ? Math.max(0, today - submitted) : null,
        outcome: judged.outcome,
        vsAssessed: judged.vs,
      });
    }
  }

  const open = items.filter((item) => item.stage === "open" && !item.moneyless).sort((a, b) => b.asked - a.asked || a.reference.localeCompare(b.reference, undefined, { numeric: true }));
  const openDaysOnly = items.filter((item) => item.stage === "open" && item.moneyless);
  const decidedAll = items.filter((item) => item.stage === "decided");
  const decidedMoney = decidedAll.filter((item) => item.decided !== null);
  const decided = [...decidedAll].sort((a, b) => (b.decidedDate ?? 0) - (a.decidedDate ?? 0) || a.reference.localeCompare(b.reference, undefined, { numeric: true }));
  const withAssessment = decidedMoney.filter((item) => item.assessed !== null);
  const sum = (list: Item[], pick: (item: Item) => number) => list.reduce((total, item) => total + pick(item), 0);
  const assessedOpen = open.filter((item) => item.assessed !== null);
  const unassessedOpen = open.filter((item) => item.assessed === null);
  const waits = [...open, ...openDaysOnly].map((item) => item.waiting).filter((value): value is number => value !== null);
  const decidedAsked = sum(decidedMoney, (item) => item.asked);
  const decidedSum = sum(decidedMoney, (item) => item.decided ?? 0);

  const openTotals: OpenTotals = {
    count: open.length,
    asked: sum(open, (item) => item.asked),
    assessedCount: assessedOpen.length,
    assessed: sum(assessedOpen, (item) => item.assessed ?? 0),
    assessedAsked: sum(assessedOpen, (item) => item.asked),
    unassessedCount: unassessedOpen.length,
    unassessedAsked: sum(unassessedOpen, (item) => item.asked),
    oldestWaiting: waits.length > 0 ? Math.max(...waits) : null,
    overdue: [...open, ...openDaysOnly].filter((item) => item.overdue).length,
  };

  const decidedTotals: DecidedTotals = {
    count: decidedMoney.length,
    asked: decidedAsked,
    decided: decidedSum,
    recovery: decidedAsked > 0 ? decidedSum / decidedAsked : null,
    withAssessment: withAssessment.length,
    assessedAsked: sum(withAssessment, (item) => item.asked),
    assessed: sum(withAssessment, (item) => item.assessed ?? 0),
    assessedDecided: sum(withAssessment, (item) => item.decided ?? 0),
    held: withAssessment.filter((item) => item.vsAssessed === "held").length,
    above: withAssessment.filter((item) => item.vsAssessed === "above").length,
    below: withAssessment.filter((item) => item.vsAssessed === "below").length,
    full: decidedMoney.filter((item) => item.outcome === "full").length,
    cut: decidedMoney.filter((item) => item.outcome === "cut").length,
    rejected: decidedMoney.filter((item) => item.outcome === "rejected").length,
    claimedDays: sum(decidedAll, (item) => item.askedDays),
    awardedDays: sum(decidedAll, (item) => item.decidedDays),
  };

  const groups: Group[] = [];

  for (const label of GROUP_ORDER) {
    const inGroup = items.filter((item) => item.group === label);

    if (inGroup.length === 0) {
      continue;
    }

    const groupOpenAll = inGroup.filter((item) => item.stage === "open");
    const groupOpen = groupOpenAll.filter((item) => !item.moneyless);
    const groupDecidedAll = inGroup.filter((item) => item.stage === "decided");
    const groupDecided = groupDecidedAll.filter((item) => item.decided !== null);
    const askedHere = sum(groupDecided, (item) => item.asked);
    const decidedHere = sum(groupDecided, (item) => item.decided ?? 0);

    groups.push({
      label,
      openCount: groupOpenAll.length,
      openAsked: sum(groupOpen, (item) => item.asked),
      openAssessed: sum(groupOpen.filter((item) => item.assessed !== null), (item) => item.assessed ?? 0),
      decidedCount: groupDecidedAll.length,
      moneyCount: groupDecided.length,
      decidedAsked: askedHere,
      decided: decidedHere,
      recovery: askedHere > 0 ? decidedHere / askedHere : null,
      claimedDays: sum(inGroup.filter((item) => item.stage === "decided"), (item) => item.askedDays),
      awardedDays: sum(inGroup.filter((item) => item.stage === "decided"), (item) => item.decidedDays),
    });
  }

  return {
    ok: true,
    gap: {
      items,
      open: [...open, ...openDaysOnly.sort((a, b) => (b.waiting ?? 0) - (a.waiting ?? 0) || a.reference.localeCompare(b.reference, undefined, { numeric: true }))],
      decided,
      openTotals,
      decidedTotals,
      groups,
      drafts,
      draftAsked,
      missing,
      skipped,
    },
  };
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function daysText(value: number): string {
  return `${value} ${plural(value, "day", "days")}`;
}

export function cash(value: number): string {
  return Math.abs(value) < 0.5 ? "€0" : money(value);
}

export function moneyOrDash(value: number | null): string {
  return value === null ? "—" : cash(value);
}

export function outcomeText(item: Item): string {
  if (item.moneyless) {
    return item.decidedDays <= 0 ? "No time awarded" : item.decidedDays >= item.askedDays ? "All the time awarded" : `${daysText(item.decidedDays)} of ${daysText(item.askedDays)} awarded`;
  }

  if (item.decided === null) {
    return "Amount not recorded";
  }

  if (item.outcome === "rejected") {
    return "Rejected";
  }

  if (item.outcome === "full") {
    return "Approved in full";
  }

  return `${pct(item.decided / item.asked)} of the ask`;
}

export function gapMarkdown(gap: Gap, projectName: string, today: number, scope: Scope): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();
  const open = gap.openTotals;
  const done = gap.decidedTotals;
  const scopeText = scope === "all" ? "change orders and claims" : scope === "change" ? "change orders" : "claims";

  lines.push(`# Valuation gap: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Submitted ${scopeText}, from the amount asked to the assessment and the decision.`, "");
  lines.push(`- Waiting for a decision: ${open.count} ${plural(open.count, "item", "items")} asking ${cash(open.asked)}; ${open.assessedCount} assessed at ${cash(open.assessed)} against ${cash(open.assessedAsked)} asked, ${open.unassessedCount} not yet assessed (${cash(open.unassessedAsked)})`);
  lines.push(`- Decided: ${done.count} ${plural(done.count, "item", "items")}, ${cash(done.decided)} of ${cash(done.asked)} asked (${pct(done.recovery)})`);

  if (done.withAssessment > 0) {
    lines.push(`- Of ${done.withAssessment} decided with an assessment: ${done.held} at it, ${done.above} above, ${done.below} below`);
  }

  if (done.claimedDays > 0) {
    lines.push(`- Time: ${daysText(done.awardedDays)} awarded of ${daysText(done.claimedDays)} claimed`);
  }

  lines.push("");

  if (gap.open.length > 0) {
    lines.push("Waiting for a decision:", "", "| Item | Asked | Assessed | Waiting |", "| --- | ---: | ---: | ---: |");

    for (const item of gap.open.slice(0, 15)) {
      lines.push(`| ${cell(item.reference)} ${cell(trunc(item.title, 40))} | ${item.moneyless ? `${daysText(item.askedDays)} of time` : cash(item.asked)} | ${moneyOrDash(item.assessed)} | ${item.waiting !== null ? daysText(item.waiting) : "—"} |`);
    }

    lines.push("");
  }

  const decidedRows = gap.decided.filter((item) => item.decided !== null).slice(0, 15);

  if (decidedRows.length > 0) {
    lines.push("Decided:", "", "| Item | Asked | Assessed | Decided | Outcome |", "| --- | ---: | ---: | ---: | --- |");

    for (const item of decidedRows) {
      lines.push(`| ${cell(item.reference)} ${cell(trunc(item.title, 40))} | ${cash(item.asked)} | ${moneyOrDash(item.assessed)} | ${moneyOrDash(item.decided)} | ${outcomeText(item)} |`);
    }

    lines.push("");
  }

  lines.push(
    `Asked is the amount submitted on a change order or claimed on a claim. Assessed is the amount the assessor has valued it at, which may come before the decision. Decided is the amount approved or awarded, and nothing for a rejection. Recovery is the amount decided as a share of the amount asked. An item is decided at its assessment when the two are within ${Math.round(HELD_TOLERANCE * 100)}% of each other. Approved in full means ${Math.round(FULL * 1000) / 10}% or more of the ask. Draft and void items are left out, and claims for time only have no amount, so they appear in the time totals alone.${gap.drafts > 0 ? ` ${gap.drafts} draft ${plural(gap.drafts, "item", "items")} (${cash(gap.draftAsked)}) ${plural(gap.drafts, "is", "are")} not yet submitted.` : ""}${gap.missing > 0 ? ` ${gap.missing} decided ${plural(gap.missing, "item has", "items have")} no decided amount recorded and ${plural(gap.missing, "is", "are")} left out of the money totals.` : ""}`,
    "",
  );

  return lines.join("\n");
}
