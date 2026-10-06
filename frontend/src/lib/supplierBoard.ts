import { money, plural, toDay, words } from "@/lib/openItems";
import type { ProcurementBid, ProcurementControl, ProcurementPackage, Supplier, SupplierPerformanceEvaluation } from "@/types/project";

export type Band = "good" | "fair" | "weak" | "none";
export type DimKey = "quality" | "delivery" | "safety" | "commercial";

export const GOOD_FROM = 75;
export const FAIR_FROM = 60;
export const DECLINE_POINTS = 8;
export const CONCENTRATION_WARN = 0.4;
export const CONCENTRATION_HIGH = 0.6;

export const DIMENSIONS: ReadonlyArray<{ key: DimKey; label: string }> = [
  { key: "quality", label: "Quality" },
  { key: "delivery", label: "Delivery" },
  { key: "safety", label: "Safety" },
  { key: "commercial", label: "Commercial" },
];

export interface Warning {
  key: "qualification" | "unevaluated" | "low" | "declining" | "concentration";
  text: string;
  severe: boolean;
}

export interface HistoryPoint {
  day: number;
  value: number;
}

export interface SupplierRow {
  supplier: Supplier;
  evaluations: SupplierPerformanceEvaluation[];
  average: number;
  latest: number;
  trend: number;
  dims: Record<DimKey, number>;
  weakest: { key: DimKey; label: string; value: number } | null;
  history: HistoryPoint[];
  bids: ProcurementBid[];
  won: number;
  liveBids: number;
  awards: ProcurementPackage[];
  awardedValue: number;
  share: number;
  warnings: Warning[];
  band: Band;
}

export interface SupplierModel {
  rows: SupplierRow[];
  scale: number;
  totalAwarded: number;
}

export function bandOf(score: number): Band {
  if (!Number.isFinite(score)) {
    return "none";
  }

  return score >= GOOD_FROM ? "good" : score >= FAIR_FROM ? "fair" : "weak";
}

function scaleOf(values: number[]): number {
  const top = Math.max(0, ...values.filter(Number.isFinite));

  return top <= 5 ? 5 : top <= 10 ? 10 : 100;
}

function mean(values: number[]): number {
  return values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
}

const LIVE_PACKAGE = new Set(["TENDERING", "EVALUATION"]);

export function buildSuppliers(data: ProcurementControl): SupplierModel {
  const evaluations = data.evaluations ?? [];
  const suppliers = data.suppliers ?? [];
  const packages = data.packages ?? [];
  const allBids = data.bids ?? [];

  const scale = scaleOf(evaluations.flatMap((item) => [item.overallScore, item.qualityScore, item.deliveryScore, item.safetyScore, item.commercialScore]));
  const pct = (value: number) => (value / scale) * 100;

  const packageById = new Map(packages.map((item) => [item.id, item]));

  const totalAwarded = packages.reduce((sum, item) => sum + (item.awardedSupplierId ? (item.awardedValue ?? 0) : 0), 0);

  const rows = suppliers.map((supplier): SupplierRow => {
    const own = evaluations
      .filter((item) => item.supplierId === supplier.id)
      .sort((a, b) => toDay(a.evaluationDate) - toDay(b.evaluationDate) || a.createdAt.localeCompare(b.createdAt));

    const overall = own.map((item) => pct(item.overallScore));
    const average = mean(overall);
    const latest = overall.length > 0 ? (overall[overall.length - 1] ?? NaN) : NaN;
    const previous = overall.length > 1 ? (overall[overall.length - 2] ?? NaN) : NaN;
    const trend = Number.isFinite(latest) && Number.isFinite(previous) ? latest - previous : NaN;

    const dims: Record<DimKey, number> = {
      quality: mean(own.map((item) => pct(item.qualityScore))),
      delivery: mean(own.map((item) => pct(item.deliveryScore))),
      safety: mean(own.map((item) => pct(item.safetyScore))),
      commercial: mean(own.map((item) => pct(item.commercialScore))),
    };

    let weakest: SupplierRow["weakest"] = null;

    for (const dimension of DIMENSIONS) {
      const value = dims[dimension.key];

      if (Number.isFinite(value) && (weakest === null || value < weakest.value)) {
        weakest = { key: dimension.key, label: dimension.label, value };
      }
    }

    const bids = allBids.filter((item) => item.supplierId === supplier.id);
    const awards = packages.filter((item) => item.awardedSupplierId === supplier.id);
    const awardedValue = awards.reduce((sum, item) => sum + (item.awardedValue ?? 0), 0);
    const share = totalAwarded > 0 ? awardedValue / totalAwarded : 0;

    const liveBids = bids.filter((bid) => {
      const pack = packageById.get(bid.procurementPackageId);

      return pack !== undefined && LIVE_PACKAGE.has(pack.status) && bid.status !== "REJECTED";
    }).length;

    const warnings: Warning[] = [];

    if (supplier.qualificationStatus !== "QUALIFIED" && (awards.length > 0 || liveBids > 0)) {
      const severe = supplier.qualificationStatus !== "CONDITIONAL";
      const exposure = awards.length > 0 ? `holds ${awards.length} ${plural(awards.length, "award", "awards")}` : `has ${liveBids} live ${plural(liveBids, "bid", "bids")}`;

      warnings.push({
        key: "qualification",
        text: `${words(supplier.qualificationStatus)} but ${exposure}`,
        severe,
      });
    }

    if (awards.length > 0 && own.length === 0) {
      warnings.push({
        key: "unevaluated",
        text: `Awarded ${awards.length} ${plural(awards.length, "package", "packages")} but never evaluated`,
        severe: false,
      });
    }

    if (Number.isFinite(average) && average < FAIR_FROM) {
      warnings.push({ key: "low", text: `Average score ${Math.round(average)}% is below ${FAIR_FROM}%`, severe: true });
    }

    if (Number.isFinite(trend) && trend <= -DECLINE_POINTS) {
      warnings.push({ key: "declining", text: `Latest evaluation is ${Math.round(-trend)} points below the one before`, severe: false });
    }

    if (share >= CONCENTRATION_WARN) {
      warnings.push({
        key: "concentration",
        text: `Holds ${Math.round(share * 100)}% of awarded value`,
        severe: share >= CONCENTRATION_HIGH,
      });
    }

    return {
      supplier,
      evaluations: own,
      average,
      latest,
      trend,
      dims,
      weakest,
      history: own.map((item) => ({ day: toDay(item.evaluationDate), value: pct(item.overallScore) })).filter((point) => Number.isFinite(point.day)),
      bids,
      won: bids.filter((bid) => bid.status === "SELECTED").length,
      liveBids,
      awards,
      awardedValue,
      share,
      warnings,
      band: bandOf(average),
    };
  });

  return { rows, scale, totalAwarded };
}

export function awardLine(row: SupplierRow): string {
  if (row.awards.length === 0) {
    return "No awards";
  }

  return `${money(row.awardedValue)} · ${row.awards.length} ${plural(row.awards.length, "package", "packages")}`;
}
