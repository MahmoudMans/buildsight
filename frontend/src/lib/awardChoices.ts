import { money, plural, trunc } from "@/lib/openItems";
import type { ProcurementControl } from "@/types/project";

export const PAGE = 10;
export const TOLERANCE = 1;
export const SCORE_TOLERANCE = 0.5;
export const NEGOTIATED = 0.005;

export type Outcome = "lowest" | "justified" | "unjustified" | "single" | "unmatched" | "noBids";
export type Filter = "all" | "above" | "unjustified" | "thin";

export const OUTCOME_LABEL: Record<Outcome, string> = {
  lowest: "Lowest bid won",
  justified: "Higher price, better score",
  unjustified: "Higher price, no better score",
  single: "Only one bid",
  unmatched: "Winner has no bid on record",
  noBids: "No bids on record",
};

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All awards" },
  { key: "above", label: "Above the lowest bid" },
  { key: "unjustified", label: "No better score" },
  { key: "thin", label: "Little competition" },
];

const PRIORITY: Record<Outcome, number> = { unjustified: 0, justified: 1, unmatched: 2, noBids: 3, single: 4, lowest: 5 };

export interface BidPoint {
  id: string;
  supplier: string;
  amount: number;
  score: number;
  selected: boolean;
  cheapest: boolean;
}

export interface Award {
  id: string;
  reference: string;
  title: string;
  costCode: string;
  supplier: string | null;
  awarded: number | null;
  value: number;
  bids: BidPoint[];
  lowest: number | null;
  highest: number | null;
  lowestSupplier: string | null;
  lowestScore: number | null;
  selectedAmount: number | null;
  selectedScore: number | null;
  premium: number;
  premiumShare: number | null;
  spread: number | null;
  outcome: Outcome;
  negotiated: number | null;
  negotiatedFlag: boolean;
}

export interface Totals {
  awards: number;
  value: number;
  compared: number;
  lowest: number;
  justified: number;
  unjustified: number;
  single: number;
  unmatched: number;
  noBids: number;
  above: number;
  wonLowestShare: number | null;
  premium: number;
  unjustifiedPremium: number;
  medianSpread: number | null;
  negotiatedNet: number;
  negotiatedFlagged: number;
  negotiatedUp: number;
}

export interface Choices {
  awards: Award[];
  totals: Totals;
  rejectedBids: number;
  skippedBids: number;
  noSupplier: number;
}

export type ChoicesResult = { ok: true; data: Choices } | { ok: false; reason: "empty" };

function amountOf(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function median(values: number[]): number | null {
  if (values.length === 0) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function buildChoices(data: ProcurementControl): ChoicesResult {
  const packages = data.packages ?? [];
  const bids = data.bids ?? [];
  const awards: Award[] = [];
  let rejectedBids = 0;
  let skippedBids = 0;
  let noSupplier = 0;

  for (const bid of bids) {
    const amount = amountOf(bid.bidAmount);

    if (amount === null || amount <= 0) {
      skippedBids += 1;
    } else if (bid.status === "REJECTED") {
      rejectedBids += 1;
    }
  }

  for (const pack of packages) {
    if (pack.status === "CANCELLED") {
      continue;
    }

    if (!pack.awardedSupplierId) {
      if (pack.status === "AWARDED" || pack.status === "CLOSED") {
        noSupplier += 1;
      }

      continue;
    }

    const field = bids
      .filter((bid) => bid.procurementPackageId === pack.id && bid.status !== "REJECTED")
      .map((bid) => ({ bid, amount: amountOf(bid.bidAmount) }))
      .filter((item): item is { bid: (typeof bids)[number]; amount: number } => item.amount !== null && item.amount > 0)
      .sort((a, b) => a.amount - b.amount);

    const mine = field.filter((item) => item.bid.supplierId === pack.awardedSupplierId);
    const chosen = mine.find((item) => item.bid.status === "SELECTED") ?? mine[0] ?? null;
    const lowest = field.length > 0 ? (field[0] as { amount: number }).amount : null;
    const highest = field.length > 0 ? (field[field.length - 1] as { amount: number }).amount : null;
    const cheapest = lowest === null ? [] : field.filter((item) => item.amount <= lowest + TOLERANCE);
    const cheapestBid = cheapest.reduce<(typeof field)[number] | null>((best, item) => (best === null || item.bid.combinedScore > best.bid.combinedScore ? item : best), null);
    const awarded = amountOf(pack.awardedValue);
    let outcome: Outcome;

    if (field.length === 0) {
      outcome = "noBids";
    } else if (!chosen) {
      outcome = "unmatched";
    } else if (field.length === 1) {
      outcome = "single";
    } else if (chosen.amount <= (lowest as number) + TOLERANCE) {
      outcome = "lowest";
    } else {
      outcome = chosen.bid.combinedScore > (cheapestBid as { bid: { combinedScore: number } }).bid.combinedScore + SCORE_TOLERANCE ? "justified" : "unjustified";
    }

    const premium = chosen && lowest !== null && field.length > 1 ? Math.max(0, chosen.amount - lowest) : 0;
    const negotiated = chosen && awarded !== null ? awarded - chosen.amount : null;

    awards.push({
      id: pack.id,
      reference: pack.reference,
      title: pack.title,
      costCode: pack.costCode,
      supplier: pack.awardedSupplierName ?? chosen?.bid.supplierName ?? null,
      awarded,
      value: awarded ?? chosen?.amount ?? 0,
      bids: field.map((item) => ({
        id: item.bid.id,
        supplier: item.bid.supplierName,
        amount: item.amount,
        score: item.bid.combinedScore,
        selected: chosen !== null && item.bid.id === chosen.bid.id,
        cheapest: item.amount <= (lowest as number) + TOLERANCE,
      })),
      lowest,
      highest,
      lowestSupplier: cheapestBid ? cheapestBid.bid.supplierName : null,
      lowestScore: cheapestBid ? cheapestBid.bid.combinedScore : null,
      selectedAmount: chosen ? chosen.amount : null,
      selectedScore: chosen ? chosen.bid.combinedScore : null,
      premium,
      premiumShare: premium > 0 && lowest !== null && lowest > 0 ? premium / lowest : null,
      spread: field.length > 1 && lowest !== null && highest !== null && lowest > 0 ? (highest - lowest) / lowest : null,
      outcome,
      negotiated,
      negotiatedFlag: negotiated !== null && chosen !== null && Math.abs(negotiated) / chosen.amount >= NEGOTIATED && Math.abs(negotiated) > TOLERANCE,
    });
  }

  if (awards.length === 0) {
    return { ok: false, reason: "empty" };
  }

  awards.sort((a, b) => PRIORITY[a.outcome] - PRIORITY[b.outcome] || b.premium - a.premium || b.value - a.value || a.reference.localeCompare(b.reference, undefined, { numeric: true }));

  const count = (outcome: Outcome) => awards.filter((award) => award.outcome === outcome).length;
  const comparedAwards = awards.filter((award) => award.outcome === "lowest" || award.outcome === "justified" || award.outcome === "unjustified");
  const above = awards.filter((award) => award.outcome === "justified" || award.outcome === "unjustified");
  const flagged = awards.filter((award) => award.negotiatedFlag);

  return {
    ok: true,
    data: {
      awards,
      totals: {
        awards: awards.length,
        value: awards.reduce((sum, award) => sum + award.value, 0),
        compared: comparedAwards.length,
        lowest: count("lowest"),
        justified: count("justified"),
        unjustified: count("unjustified"),
        single: count("single"),
        unmatched: count("unmatched"),
        noBids: count("noBids"),
        above: above.length,
        wonLowestShare: comparedAwards.length > 0 ? count("lowest") / comparedAwards.length : null,
        premium: above.reduce((sum, award) => sum + award.premium, 0),
        unjustifiedPremium: awards.filter((award) => award.outcome === "unjustified").reduce((sum, award) => sum + award.premium, 0),
        medianSpread: median(comparedAwards.map((award) => award.spread).filter((value): value is number => value !== null)),
        negotiatedNet: awards.reduce((sum, award) => sum + (award.negotiated ?? 0), 0),
        negotiatedFlagged: flagged.length,
        negotiatedUp: flagged.filter((award) => (award.negotiated ?? 0) > 0).length,
      },
      rejectedBids,
      skippedBids,
      noSupplier,
    },
  };
}

export function filterAwards(awards: Award[], filter: Filter): Award[] {
  if (filter === "above") {
    return awards.filter((award) => award.outcome === "justified" || award.outcome === "unjustified").sort((a, b) => b.premium - a.premium || b.value - a.value);
  }

  if (filter === "unjustified") {
    return awards.filter((award) => award.outcome === "unjustified").sort((a, b) => b.premium - a.premium || b.value - a.value);
  }

  if (filter === "thin") {
    return awards.filter((award) => award.outcome === "single" || award.outcome === "unmatched" || award.outcome === "noBids").sort((a, b) => b.value - a.value || a.reference.localeCompare(b.reference, undefined, { numeric: true }));
  }

  return awards;
}

export function cash(value: number): string {
  return Math.abs(value) < 0.5 ? "€0" : money(value);
}

export function exact(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Math.round(value));
}

export function signedExact(value: number): string {
  if (Math.abs(value) < 0.5) {
    return "€0";
  }

  return `${value > 0 ? "+" : "−"}${exact(Math.abs(value))}`;
}

export function signedCash(value: number): string {
  if (Math.abs(value) < 0.5) {
    return "€0";
  }

  return `${value > 0 ? "+" : "−"}${money(Math.abs(value))}`;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function pctOne(value: number | null): string {
  return value === null ? "—" : `${(Math.round(value * 1000) / 10).toFixed(1)}%`;
}

export function choicesMarkdown(data: Choices, shown: Award[], projectName: string, filterLabel: string | null): string {
  const t = data.totals;
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Award choices: ${projectName}`, "");
  lines.push(`${t.awards} ${plural(t.awards, "package has", "packages have")} been awarded, ${cash(t.value)} in all.`, "");
  lines.push(`- ${t.lowest} of ${t.compared} awards with competing bids went to the lowest bidder (${pct(t.wonLowestShare)})`);
  lines.push(`- ${t.above} ${plural(t.above, "award was", "awards were")} made above the lowest bid, ${cash(t.premium)} more than the cheapest bids; ${cash(t.unjustifiedPremium)} of that went to ${t.unjustified} ${plural(t.unjustified, "supplier", "suppliers")} who did not score better than the cheapest bidder`);
  lines.push(`- ${t.single} ${plural(t.single, "award was", "awards were")} made on a single bid, ${t.unmatched + t.noBids} with no bid from the winner on record`);

  if (t.medianSpread !== null) {
    lines.push(`- Median gap from the lowest to the highest bid: ${pctOne(t.medianSpread)}`);
  }

  lines.push("");

  if (shown.length > 0) {
    lines.push(`${filterLabel ? `Awards (${filterLabel.toLowerCase()}):` : "Awards:"}`, "", "| Package | Winner | Bids | Lowest bid | Winning bid | Above lowest | Outcome |", "| --- | --- | ---: | ---: | ---: | ---: | --- |");

    for (const award of shown.slice(0, 25)) {
      lines.push(`| ${cell(award.reference)} ${cell(trunc(award.title, 36))} | ${cell(trunc(award.supplier ?? "—", 28))} | ${award.bids.length} | ${award.lowest === null ? "—" : exact(award.lowest)} | ${award.selectedAmount === null ? "—" : exact(award.selectedAmount)} | ${award.premium > 0 ? signedExact(award.premium) : "—"} | ${OUTCOME_LABEL[award.outcome]} |`);
    }

    lines.push("");
  }

  lines.push(
    `An award is a package with a winning supplier that is not cancelled. The field is the bids on the package that are not marked rejected, and the lowest bid is the cheapest of them. The winner's bid is the one from the awarded supplier. A higher price counts as justified when the winner's combined score is better than that of the lowest bidder by more than ${SCORE_TOLERANCE} points. The premium is the winner's bid less the lowest bid. A gap between the awarded value and the winner's bid, such as a negotiated price, is not part of the premium.${data.rejectedBids > 0 ? ` ${data.rejectedBids} rejected ${plural(data.rejectedBids, "bid is", "bids are")} not counted.` : ""}`,
    "",
  );

  return lines.join("\n");
}
