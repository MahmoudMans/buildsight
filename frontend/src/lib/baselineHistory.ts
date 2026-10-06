import { formatDay, money, plural, toDay, trunc } from "@/lib/openItems";
import type { ControlBaselineStatus, PeriodControl } from "@/types/project";

export const QUICK_DAYS = 30;
export const PAD = 9;
export const MERGE = 5;

export type VersionFlag = "noReason" | "noReference" | "quick";

export const FLAG_LABEL: Record<VersionFlag, string> = {
  noReason: "No reason recorded",
  noReference: "No change reference",
  quick: `Replaced within ${QUICK_DAYS} days`,
};

export const STATUS_LABEL: Record<ControlBaselineStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  SUPERSEDED: "Superseded",
};

export interface LeftBehind {
  periodCode: string;
  end: number;
  cost: number;
  finish: number;
}

export interface Version {
  id: string;
  code: string;
  title: string;
  status: ControlBaselineStatus;
  reason: string | null;
  reference: string | null;
  position: number;
  original: boolean;
  current: boolean;
  start: number | null;
  replaced: number | null;
  lifeDays: number | null;
  costTarget: number;
  finishTarget: number;
  costShift: number | null;
  finishShift: number | null;
  left: LeftBehind | null;
  flags: VersionFlag[];
}

export interface Gap {
  cost: number | null;
  finish: number | null;
}

export interface History {
  versions: Version[];
  original: Version;
  current: Version;
  resets: number;
  costReset: number;
  costResetPct: number | null;
  finishReset: number;
  forecastCost: number | null;
  forecastFinish: number | null;
  overCurrent: Gap;
  overOriginal: Gap;
  lastReset: number | null;
  sinceReset: number | null;
  noReason: Version[];
  quick: Version[];
  drafts: number;
  skipped: number;
  unknownSnapshots: number;
  skippedSnapshots: number;
}

export type HistoryResult = { ok: true; data: History } | { ok: false; reason: "noBaselines" };

export type MarkKind = "original" | "baseline" | "current" | "forecast";

export interface MarkEntry {
  label: string;
  value: string;
  kind: MarkKind;
}

export interface Mark {
  pos: number;
  side: "above" | "below";
  entries: MarkEntry[];
}

export interface Ladder {
  marks: Mark[];
  reset: { left: number; width: number } | null;
  over: { left: number; width: number; beyond: boolean } | null;
}

export interface LadderPoint {
  label: string;
  value: number;
  text: string;
  kind: MarkKind;
}

function clean(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();

  return text.length > 0 ? text : null;
}

export function buildHistory(data: PeriodControl, today: number): HistoryResult {
  const baselines = data.baselines ?? [];
  const drafts = baselines.filter((item) => item.status === "DRAFT").length;
  let skipped = 0;

  const usable = baselines
    .filter((item) => item.status !== "DRAFT")
    .filter((item) => {
      const good = typeof item.costTarget === "number" && Number.isFinite(item.costTarget) && Number.isFinite(toDay(item.finishTarget));

      if (!good) {
        skipped += 1;
      }

      return good;
    })
    .sort((a, b) => {
      const byData = (Number.isFinite(toDay(a.sourceDataDate)) ? toDay(a.sourceDataDate) : 0) - (Number.isFinite(toDay(b.sourceDataDate)) ? toDay(b.sourceDataDate) : 0);
      const byApproval = (Number.isFinite(toDay(a.approvedAt)) ? toDay(a.approvedAt) : 0) - (Number.isFinite(toDay(b.approvedAt)) ? toDay(b.approvedAt) : 0);

      return byData || byApproval || a.versionCode.localeCompare(b.versionCode);
    });

  if (usable.length === 0) {
    return { ok: false, reason: "noBaselines" };
  }

  const ids = new Set(usable.map((item) => item.id));
  const allIds = new Set(baselines.map((item) => item.id));
  const lastSnapshot = new Map<string, LeftBehind>();
  let unknownSnapshots = 0;
  let skippedSnapshots = 0;

  for (const snapshot of data.snapshots ?? []) {
    if (!allIds.has(snapshot.baselineVersionId)) {
      unknownSnapshots += 1;
      continue;
    }

    const end = toDay(snapshot.periodEndDate);

    if (!ids.has(snapshot.baselineVersionId)) {
      continue;
    }

    if (!Number.isFinite(end) || typeof snapshot.costVarianceToBaseline !== "number" || !Number.isFinite(snapshot.costVarianceToBaseline) || typeof snapshot.finishVarianceDays !== "number" || !Number.isFinite(snapshot.finishVarianceDays)) {
      skippedSnapshots += 1;
      continue;
    }

    const before = lastSnapshot.get(snapshot.baselineVersionId);

    if (!before || end > before.end) {
      lastSnapshot.set(snapshot.baselineVersionId, { periodCode: snapshot.periodCode, end, cost: snapshot.costVarianceToBaseline, finish: snapshot.finishVarianceDays });
    }
  }

  const startOf = (item: (typeof usable)[number]): number | null => {
    const approved = toDay(item.approvedAt);
    const source = toDay(item.sourceDataDate);

    return Number.isFinite(approved) ? approved : Number.isFinite(source) ? source : null;
  };

  const versions: Version[] = usable.map((item, index) => {
    const previous = usable[index - 1];
    const next = usable[index + 1];
    const start = startOf(item);
    const isCurrent = index === usable.length - 1;
    const superseded = toDay(item.supersededAt);
    const nextStart = next ? startOf(next) : null;
    const replaced = isCurrent ? null : Number.isFinite(superseded) ? superseded : nextStart;
    const end = isCurrent ? today : replaced;
    const lifeDays = start !== null && end !== null ? Math.max(0, end - start) : null;
    const reason = clean(item.reason);
    const reference = clean(item.changeReference);
    const flags: VersionFlag[] = [];

    if (index > 0 && !reason) {
      flags.push("noReason");
    } else if (index > 0 && !reference) {
      flags.push("noReference");
    }

    if (!isCurrent && lifeDays !== null && lifeDays < QUICK_DAYS) {
      flags.push("quick");
    }

    return {
      id: item.id,
      code: item.versionCode,
      title: item.title,
      status: item.status,
      reason,
      reference,
      position: index,
      original: index === 0,
      current: isCurrent,
      start,
      replaced,
      lifeDays,
      costTarget: item.costTarget,
      finishTarget: toDay(item.finishTarget),
      costShift: previous ? item.costTarget - previous.costTarget : null,
      finishShift: previous ? toDay(item.finishTarget) - toDay(previous.finishTarget) : null,
      left: lastSnapshot.get(item.id) ?? null,
      flags,
    };
  });

  const original = versions[0] as Version;
  const current = versions[versions.length - 1] as Version;
  const forecastCostRaw = data.intelligence?.currentExpectedForecastCost;
  const forecastCost = typeof forecastCostRaw === "number" && Number.isFinite(forecastCostRaw) ? forecastCostRaw : null;
  const finishRaw = toDay(data.intelligence?.currentExpectedForecastFinishDate);
  const forecastFinish = Number.isFinite(finishRaw) ? finishRaw : null;
  const gap = (version: Version): Gap => ({
    cost: forecastCost === null ? null : forecastCost - version.costTarget,
    finish: forecastFinish === null ? null : forecastFinish - version.finishTarget,
  });

  return {
    ok: true,
    data: {
      versions,
      original,
      current,
      resets: versions.length - 1,
      costReset: current.costTarget - original.costTarget,
      costResetPct: original.costTarget > 0 ? (current.costTarget - original.costTarget) / original.costTarget : null,
      finishReset: current.finishTarget - original.finishTarget,
      forecastCost,
      forecastFinish,
      overCurrent: gap(current),
      overOriginal: gap(original),
      lastReset: versions.length > 1 ? current.start : null,
      sinceReset: versions.length > 1 && current.start !== null ? Math.max(0, today - current.start) : null,
      noReason: versions.filter((version) => version.flags.includes("noReason")),
      quick: versions.filter((version) => version.flags.includes("quick")),
      drafts,
      skipped,
      unknownSnapshots,
      skippedSnapshots,
    },
  };
}

export function buildLadder(points: LadderPoint[]): Ladder {
  if (points.length === 0) {
    return { marks: [], reset: null, over: null };
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const posOf = (value: number) => (max === min ? 50 : PAD + (100 - 2 * PAD) * ((value - min) / (max - min)));
  const sorted = points.map((point) => ({ point, pos: posOf(point.value) })).sort((a, b) => a.pos - b.pos);
  const groups: Array<{ pos: number; entries: MarkEntry[] }> = [];

  for (const item of sorted) {
    const entry: MarkEntry = { label: item.point.label, value: item.point.text, kind: item.point.kind };
    const last = groups[groups.length - 1];

    if (last && item.pos - last.pos < MERGE) {
      last.entries.push(entry);
    } else {
      groups.push({ pos: item.pos, entries: [entry] });
    }
  }

  const original = points.find((point) => point.kind === "original");
  const current = points.find((point) => point.kind === "current");
  const forecast = points.find((point) => point.kind === "forecast");
  const reset = original && current ? { left: Math.min(posOf(original.value), posOf(current.value)), width: Math.abs(posOf(current.value) - posOf(original.value)) } : null;
  const over = current && forecast ? { left: Math.min(posOf(current.value), posOf(forecast.value)), width: Math.abs(posOf(forecast.value) - posOf(current.value)), beyond: forecast.value > current.value } : null;

  return {
    marks: groups.map((group, index) => ({ pos: group.pos, side: index % 2 === 0 ? "below" : "above", entries: group.entries })),
    reset: reset && reset.width > 0 ? reset : null,
    over: over && over.width > 0 ? over : null,
  };
}

export function costLadder(data: History): Ladder {
  const points: LadderPoint[] = data.versions.map((version) => ({
    label: version.code,
    value: version.costTarget,
    text: cash(version.costTarget),
    kind: version.original && !version.current ? "original" : version.current ? "current" : "baseline",
  }));

  if (data.forecastCost !== null) {
    points.push({ label: "Forecast", value: data.forecastCost, text: cash(data.forecastCost), kind: "forecast" });
  }

  return buildLadder(points);
}

export function finishLadder(data: History): Ladder {
  const points: LadderPoint[] = data.versions.map((version) => ({
    label: version.code,
    value: version.finishTarget,
    text: formatDay(version.finishTarget),
    kind: version.original && !version.current ? "original" : version.current ? "current" : "baseline",
  }));

  if (data.forecastFinish !== null) {
    points.push({ label: "Forecast", value: data.forecastFinish, text: formatDay(data.forecastFinish), kind: "forecast" });
  }

  return buildLadder(points);
}

export function cash(value: number): string {
  return Math.abs(value) < 0.5 ? "€0" : money(value);
}

export function signedCash(value: number | null): string {
  if (value === null) {
    return "—";
  }

  if (Math.abs(value) < 0.5) {
    return "€0";
  }

  return `${value > 0 ? "+" : "−"}${money(Math.abs(value))}`;
}

export function signedDays(value: number | null): string {
  if (value === null) {
    return "—";
  }

  if (value === 0) {
    return "0 days";
  }

  return `${value > 0 ? "+" : "−"}${Math.abs(value)} ${Math.abs(value) === 1 ? "day" : "days"}`;
}

export function signedPct(value: number | null): string {
  if (value === null) {
    return "—";
  }

  const rounded = Math.round(value * 1000) / 10;

  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(1)}%`;
}

export function lifeText(version: Version): string {
  if (version.lifeDays === null) {
    return "dates not recorded";
  }

  const days = `${version.lifeDays} ${plural(version.lifeDays, "day", "days")}`;

  return version.current ? `in force for ${days}` : `in force for ${days}, then replaced`;
}

export function historyMarkdown(data: History, projectName: string): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Baseline history: ${projectName}`, "");
  lines.push(`${data.versions.length} approved ${plural(data.versions.length, "baseline", "baselines")}, ${data.resets} ${plural(data.resets, "reset", "resets")} since ${data.original.code}. The cost target moved ${signedCash(data.costReset)}${data.costResetPct !== null ? ` (${signedPct(data.costResetPct)})` : ""} and the finish target ${signedDays(data.finishReset)}.`, "");

  if (data.forecastCost !== null || data.forecastFinish !== null) {
    lines.push(`- Against the current baseline (${data.current.code}) the forecast is ${signedCash(data.overCurrent.cost)} on cost and ${signedDays(data.overCurrent.finish)} on finish`);
    lines.push(`- Against the original baseline (${data.original.code}) it would be ${signedCash(data.overOriginal.cost)} on cost and ${signedDays(data.overOriginal.finish)} on finish`, "");
  }

  lines.push("| Version | Status | Cost target | Against previous | Finish target | Against previous | Left behind | Reason |", "| --- | --- | ---: | ---: | --- | ---: | --- | --- |");

  for (const version of data.versions) {
    const left = version.left ? `${signedCash(version.left.cost)}, ${signedDays(version.left.finish)} at ${cell(version.left.periodCode)}` : "—";

    lines.push(`| ${cell(version.code)} | ${STATUS_LABEL[version.status]} | ${cash(version.costTarget)} | ${version.costShift === null ? "—" : signedCash(version.costShift)} | ${formatDay(version.finishTarget)} | ${version.finishShift === null ? "—" : signedDays(version.finishShift)} | ${left} | ${cell(trunc(version.reason ?? "", 60)) || "—"} |`);
  }

  lines.push("");

  if (data.noReason.length > 0) {
    lines.push(`No reason is recorded for ${data.noReason.map((version) => version.code).join(", ")}.`, "");
  }

  lines.push(
    "Versions are in the order their data dates were set. Drafts are not counted. Left behind is the cost and finish variance recorded at the last period end under that version, which can be some weeks before it was replaced. Against the original baseline means the forecast measured against the first baseline's targets.",
    "",
  );

  return lines.join("\n");
}
