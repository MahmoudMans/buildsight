import { formatDay, money, plural, toDay } from "@/lib/openItems";
import type { EvmSnapshot, ForecastControl } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 90;
export const BIG_FINISH = 7;
export const BIG_COST = 0.01;
export const STALE_AFTER = 30;
export const MIN_SPAN = 7;
export const PAGE = 10;

export interface Snap {
  id: string;
  date: number;
  bac: number;
  eac: number;
  finish: number | null;
  slip: number | null;
  cpi: number | null;
  spi: number | null;
  score: number | null;
}

export interface Step {
  from: Snap;
  to: Snap;
  gap: number;
  dEac: number;
  dFinish: number | null;
  bigCost: boolean;
  bigFinish: boolean;
}

export interface Tally {
  worse: number;
  better: number;
  flat: number;
}

export interface Drift {
  snaps: Snap[];
  window: Snap[];
  steps: Step[];
  base: Snap;
  last: Snap;
  coversWindow: boolean;
  span: number;
  dEac: number;
  dEacShare: number | null;
  dFinish: number | null;
  eacPerMonth: number | null;
  finishPerMonth: number | null;
  cost: Tally;
  finish: Tally;
  bigMoves: number;
  largestCost: Step | null;
  largestFinish: Step | null;
  vac: number;
  vacShare: number | null;
  sinceLast: number;
  stale: boolean;
  collapsed: number;
  skipped: number;
}

export type DriftResult = { ok: true; drift: Drift } | { ok: false; reason: "empty" };

function finite(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function snapOf(raw: EvmSnapshot): Snap | null {
  const date = toDay(raw.dataDate);
  const eac = finite(raw.estimateAtCompletion);

  if (!Number.isFinite(date) || eac === null) {
    return null;
  }

  const finish = toDay(raw.forecastFinishDate);

  return {
    id: raw.id,
    date,
    bac: finite(raw.bac) ?? 0,
    eac,
    finish: Number.isFinite(finish) ? finish : null,
    slip: finite(raw.scheduleVarianceDays),
    cpi: finite(raw.cpi),
    spi: finite(raw.spi),
    score: finite(raw.predictiveScore),
  };
}

export function buildDrift(data: ForecastControl, today: number, windowDays: number): DriftResult {
  const raws = data.history ?? [];
  const byDate = new Map<number, { snap: Snap; created: string }>();
  let skipped = 0;
  let collapsed = 0;

  for (const raw of raws) {
    const snap = snapOf(raw);

    if (snap === null) {
      skipped += 1;
      continue;
    }

    const existing = byDate.get(snap.date);

    if (existing) {
      collapsed += 1;

      if ((raw.createdAt ?? "") >= existing.created) {
        byDate.set(snap.date, { snap, created: raw.createdAt ?? "" });
      }

      continue;
    }

    byDate.set(snap.date, { snap, created: raw.createdAt ?? "" });
  }

  const snaps = [...byDate.values()].map((item) => item.snap).sort((a, b) => a.date - b.date);

  if (snaps.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const last = snaps[snaps.length - 1] as Snap;
  const cut = last.date - windowDays;
  const before = snaps.filter((snap) => snap.date <= cut);
  const base = before.length > 0 ? (before[before.length - 1] as Snap) : (snaps[0] as Snap);
  const window = snaps.filter((snap) => snap.date >= base.date);
  const steps: Step[] = [];

  for (let index = 1; index < window.length; index += 1) {
    const from = window[index - 1] as Snap;
    const to = window[index] as Snap;
    const dEac = to.eac - from.eac;
    const dFinish = from.finish !== null && to.finish !== null ? to.finish - from.finish : null;
    const reference = to.bac > 0 ? to.bac : from.bac;

    steps.push({
      from,
      to,
      gap: to.date - from.date,
      dEac,
      dFinish,
      bigCost: reference > 0 && Math.abs(dEac) / reference >= BIG_COST,
      bigFinish: dFinish !== null && Math.abs(dFinish) >= BIG_FINISH,
    });
  }

  const span = last.date - base.date;
  const dEac = last.eac - base.eac;
  const dFinish = base.finish !== null && last.finish !== null ? last.finish - base.finish : null;
  const perMonth = (value: number) => (span >= MIN_SPAN ? (value / span) * 30 : null);
  const cost: Tally = { worse: 0, better: 0, flat: 0 };
  const finish: Tally = { worse: 0, better: 0, flat: 0 };

  for (const step of steps) {
    if (step.dEac > 0) {
      cost.worse += 1;
    } else if (step.dEac < 0) {
      cost.better += 1;
    } else {
      cost.flat += 1;
    }

    if (step.dFinish !== null) {
      if (step.dFinish > 0) {
        finish.worse += 1;
      } else if (step.dFinish < 0) {
        finish.better += 1;
      } else {
        finish.flat += 1;
      }
    }
  }

  const largest = (pick: (step: Step) => number | null): Step | null => {
    let best: Step | null = null;
    let bestSize = 0;

    for (const step of steps) {
      const size = Math.abs(pick(step) ?? 0);

      if (size > bestSize) {
        best = step;
        bestSize = size;
      }
    }

    return best;
  };

  const vac = last.bac - last.eac;
  const sinceLast = Math.max(0, today - last.date);

  return {
    ok: true,
    drift: {
      snaps,
      window,
      steps,
      base,
      last,
      coversWindow: before.length > 0,
      span,
      dEac,
      dEacShare: base.eac !== 0 ? dEac / base.eac : null,
      dFinish,
      eacPerMonth: perMonth(dEac),
      finishPerMonth: dFinish !== null ? perMonth(dFinish) : null,
      cost,
      finish,
      bigMoves: steps.filter((step) => step.bigCost || step.bigFinish).length,
      largestCost: largest((step) => step.dEac),
      largestFinish: largest((step) => step.dFinish),
      vac,
      vacShare: last.bac > 0 ? vac / last.bac : null,
      sinceLast,
      stale: sinceLast > STALE_AFTER,
      collapsed,
      skipped,
    },
  };
}

export function signedMoney(value: number): string {
  if (Math.abs(value) < 0.5) {
    return "€0";
  }

  return `${value > 0 ? "+" : "−"}${money(Math.abs(value))}`;
}

export function signedPct(value: number | null): string {
  if (value === null) {
    return "—";
  }

  const rounded = Math.round(value * 1000) / 10;

  return `${rounded > 0 ? "+" : rounded < 0 ? "−" : ""}${Math.abs(rounded).toFixed(1)}%`;
}

export function shortDay(day: number): string {
  return formatDay(day).replace(/(\d{2})(\d{2})$/, "$2");
}

export function daysText(count: number): string {
  return `${count} ${plural(count, "day", "days")}`;
}

export function finishText(value: number | null): string {
  if (value === null) {
    return "no change recorded";
  }

  if (value === 0) {
    return "no change";
  }

  return `${daysText(Math.abs(value))} ${value > 0 ? "later" : "earlier"}`;
}

export function signedDays(value: number | null): string {
  if (value === null) {
    return "—";
  }

  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)} d`;
}

export function ratio(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

export function tallyText(tally: Tally, worse: string, better: string): string {
  const parts: string[] = [];

  if (tally.worse > 0) {
    parts.push(`${worse} ${tally.worse} ${plural(tally.worse, "time", "times")}`);
  }

  if (tally.better > 0) {
    parts.push(`${better} ${tally.better} ${plural(tally.better, "time", "times")}`);
  }

  if (tally.flat > 0) {
    parts.push(`unchanged ${tally.flat} ${plural(tally.flat, "time", "times")}`);
  }

  return parts.length > 0 ? parts.join(", ") : "no updates to compare";
}

export function driftMarkdown(drift: Drift, projectName: string, today: number): string {
  const lines: string[] = [];

  lines.push(`# Forecast drift: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Forecast snapshots from ${formatDay(drift.base.date)} to ${formatDay(drift.last.date)} (${drift.steps.length} ${plural(drift.steps.length, "update", "updates")}).`, "");
  lines.push(`- Estimate at completion ${money(drift.last.eac)}, ${signedMoney(drift.dEac)} (${signedPct(drift.dEacShare)}) since ${formatDay(drift.base.date)}`);
  const finishNow = drift.last.finish !== null ? formatDay(drift.last.finish) : "not recorded";
  const finishMove = drift.dFinish === null ? "change not known" : drift.dFinish === 0 ? `unchanged since ${formatDay(drift.base.date)}` : `${finishText(drift.dFinish)} than on ${formatDay(drift.base.date)}`;

  lines.push(`- Forecast finish ${finishNow}, ${finishMove}`);
  lines.push(`- Cost estimate: ${tallyText(drift.cost, "raised", "lowered")}`);
  lines.push(`- Finish date: ${tallyText(drift.finish, "pushed later", "pulled earlier")}`);
  lines.push(`- ${drift.bigMoves} large ${plural(drift.bigMoves, "move", "moves")} (finish by ${BIG_FINISH} days or more, or cost by ${Math.round(BIG_COST * 100)}% of budget or more)`, "");

  if (drift.steps.length > 0) {
    lines.push("| Snapshot | Estimate at completion | Change | Forecast finish | Change | CPI | SPI |", "| --- | ---: | ---: | --- | ---: | ---: | ---: |");

    for (const step of [...drift.steps].reverse()) {
      lines.push(`| ${formatDay(step.to.date)} | ${money(step.to.eac)} | ${signedMoney(step.dEac)} | ${step.to.finish !== null ? formatDay(step.to.finish) : "—"} | ${signedDays(step.dFinish)} | ${ratio(step.to.cpi)} | ${ratio(step.to.spi)} |`);
    }

    lines.push("");
  }

  lines.push(
    `Each snapshot is a saved forecast. A change compares a snapshot with the one before it; the movement since the start of the period compares the latest snapshot with the one at or before ${drift.coversWindow ? "the start of the period" : "the first snapshot on record, because the history does not go back that far"}. Later and higher are the unfavourable directions. A large move is a finish date shifting by ${BIG_FINISH} days or more, or the cost estimate shifting by ${Math.round(BIG_COST * 100)}% of the budget or more, in one update.`,
    "",
  );

  return lines.join("\n");
}
