import { plural, toDay, trunc, words } from "@/lib/openItems";
import type { ProjectRisk, RiskCategory, RiskControl, RiskExposureBand, RiskStatus } from "@/types/project";

export const MIN_PLAN = 10;
export const MIN_GROUP = 3;
export const STALE_DAYS = 60;
export const GOOD = 0.9;
export const WATCH = 0.7;
export const PAGE = 10;

export type Flag =
  | "scoreMismatch"
  | "outOfScale"
  | "residualAboveInherent"
  | "bandOutOfOrder"
  | "residualNotReduced"
  | "noOwner"
  | "noPlan"
  | "noDueDate"
  | "planOverdue"
  | "acceptedHigh"
  | "stale"
  | "duplicateRef";

export type Group = "scoring" | "gaps" | "review";
export type Filter = "all" | "problem" | Group;

export const FLAG_ORDER: Flag[] = ["scoreMismatch", "outOfScale", "residualAboveInherent", "bandOutOfOrder", "residualNotReduced", "noOwner", "noPlan", "noDueDate", "planOverdue", "acceptedHigh", "stale", "duplicateRef"];

export const GROUP_OF: Record<Flag, Group> = {
  scoreMismatch: "scoring",
  outOfScale: "scoring",
  residualAboveInherent: "scoring",
  bandOutOfOrder: "scoring",
  residualNotReduced: "scoring",
  noOwner: "gaps",
  noPlan: "gaps",
  noDueDate: "gaps",
  planOverdue: "gaps",
  acceptedHigh: "review",
  stale: "review",
  duplicateRef: "review",
};

export const GROUP_LABELS: Record<Group, string> = {
  scoring: "Scoring",
  gaps: "Owner and plan",
  review: "Review",
};

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All live risks" },
  { key: "problem", label: "With a problem" },
  { key: "scoring", label: "Scoring" },
  { key: "gaps", label: "Owner and plan" },
  { key: "review", label: "Review" },
];

export const CHECK_LABELS: Record<Flag, string> = {
  scoreMismatch: "Score is not probability × impact",
  outOfScale: "A rating outside 1 to 5",
  residualAboveInherent: "Residual higher than inherent",
  bandOutOfOrder: "Band out of line with other risks",
  residualNotReduced: "Mitigating, but residual not reduced",
  noOwner: "No owner",
  noPlan: "No mitigation plan",
  noDueDate: "No mitigation due date",
  planOverdue: "Mitigation past its due date",
  acceptedHigh: "Accepted at high exposure",
  stale: `Not changed for over ${STALE_DAYS} days`,
  duplicateRef: "Reference used twice",
};

const PLACEHOLDER = /^(n\/?a|none|nil|ok|okay|done|tbd|unknown|-+|\.+|x+)$/i;
const BAND_RANK: Record<RiskExposureBand, number> = { LOW: 0, MODERATE: 1, HIGH: 2, CRITICAL: 3 };

export interface Row {
  key: string;
  reference: string;
  title: string;
  category: RiskCategory;
  owner: string | null;
  status: RiskStatus;
  band: RiskExposureBand;
  probability: number;
  impact: number;
  inherent: number;
  residualProbability: number;
  residualImpact: number;
  residual: number;
  plan: string | null;
  due: number | null;
  overdueDays: number | null;
  staleDays: number | null;
  flags: Flag[];
  serious: boolean;
}

export interface Check {
  flag: Flag;
  label: string;
  group: Group;
  count: number;
  base: number;
  share: number | null;
}

export interface Grouping {
  key: string;
  label: string;
  count: number;
  clean: number;
  cleanShare: number | null;
  active: number;
  onPlan: number;
  onPlanShare: number | null;
}

export interface Register {
  rows: Row[];
  checks: Check[];
  owners: Grouping[];
  categories: Grouping[];
  live: number;
  closed: number;
  active: number;
  clean: number;
  cleanShare: number | null;
  withProblem: number;
  scoreIssues: number;
  gaps: number;
  overdue: number;
  serious: number;
  seriousBase: number;
}

export type RegisterResult = { ok: true; data: Register } | { ok: false; reason: "noRisks" | "allClosed" };

function before(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function dayCount(count: number): string {
  return `${count} ${plural(count, "day", "days")}`;
}

export function bandOf(share: number | null, base: number): "good" | "watch" | "bad" | null {
  if (share === null || base < MIN_GROUP) {
    return null;
  }

  return share >= GOOD ? "good" : share >= WATCH ? "watch" : "bad";
}

export function planRecorded(value: string | null | undefined): boolean {
  const text = (value ?? "").trim();

  return text.length >= MIN_PLAN && !PLACEHOLDER.test(text);
}

function ownerOf(value: string | null | undefined): string | null {
  const text = (value ?? "").trim();

  return text.length > 0 ? text : null;
}

function isActive(status: RiskStatus): boolean {
  return status === "OPEN" || status === "MITIGATING";
}

function inScale(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function outliers(items: Array<{ id: string; reference: string; score: number; rank: number }>): Set<string> {
  const flagged = new Set<string>();
  let remaining = items.filter((item) => Number.isFinite(item.score) && Number.isFinite(item.rank));

  for (;;) {
    let worst: { id: string; reference: string; count: number } | null = null;

    for (const item of remaining) {
      const count = remaining.filter((other) => (other.score < item.score && other.rank > item.rank) || (other.score > item.score && other.rank < item.rank)).length;

      if (count > 0 && (worst === null || count > worst.count || (count === worst.count && before(item.reference, worst.reference) < 0))) {
        worst = { id: item.id, reference: item.reference, count };
      }
    }

    if (worst === null) {
      return flagged;
    }

    flagged.add(worst.id);
    const gone = worst.id;
    remaining = remaining.filter((item) => item.id !== gone);
  }
}

function groupOf(key: string, label: string, rows: Row[]): Grouping {
  const clean = rows.filter((row) => row.flags.length === 0).length;
  const active = rows.filter((row) => isActive(row.status));
  const onPlan = active.filter((row) => !row.flags.some((flag) => flag === "noPlan" || flag === "noDueDate" || flag === "planOverdue")).length;

  return {
    key,
    label,
    count: rows.length,
    clean,
    cleanShare: rows.length > 0 ? clean / rows.length : null,
    active: active.length,
    onPlan,
    onPlanShare: active.length > 0 ? onPlan / active.length : null,
  };
}

export function buildRegister(data: RiskControl, today: number): RegisterResult {
  const all: ProjectRisk[] = data.risks ?? [];

  if (all.length === 0) {
    return { ok: false, reason: "noRisks" };
  }

  const live = all.filter((risk) => risk.status !== "CLOSED");
  const closed = all.length - live.length;

  if (live.length === 0) {
    return { ok: false, reason: "allClosed" };
  }

  const references = new Map<string, number>();

  for (const risk of all) {
    const key = risk.reference.trim().toLowerCase();

    references.set(key, (references.get(key) ?? 0) + 1);
  }

  const flaggedBands = outliers(live.map((risk) => ({ id: risk.id, reference: risk.reference, score: risk.residualScore, rank: BAND_RANK[risk.exposureBand] ?? Number.NaN })));
  const rows: Row[] = [];

  for (const risk of live) {
    const active = isActive(risk.status);
    const owner = ownerOf(risk.ownerName);
    const plan = planRecorded(risk.mitigationPlan) ? (risk.mitigationPlan ?? "").trim() : null;
    const dueDay = toDay(risk.mitigationDueDate);
    const updatedDay = toDay(risk.updatedAt);
    const hasDue = Number.isFinite(dueDay);
    const hasUpdated = Number.isFinite(updatedDay);
    const flags: Flag[] = [];
    const ratings = [risk.probability, risk.impact, risk.residualProbability, risk.residualImpact];
    const scoresKnown = Number.isFinite(risk.inherentScore) && Number.isFinite(risk.residualScore);

    if (ratings.every((value) => Number.isFinite(value)) && scoresKnown && (risk.inherentScore !== risk.probability * risk.impact || risk.residualScore !== risk.residualProbability * risk.residualImpact)) {
      flags.push("scoreMismatch");
    }

    if (ratings.some((value) => !inScale(value))) {
      flags.push("outOfScale");
    }

    if (scoresKnown && risk.residualScore > risk.inherentScore) {
      flags.push("residualAboveInherent");
    }

    if (flaggedBands.has(risk.id)) {
      flags.push("bandOutOfOrder");
    }

    if (risk.status === "MITIGATING" && scoresKnown && risk.residualScore === risk.inherentScore) {
      flags.push("residualNotReduced");
    }

    if (owner === null) {
      flags.push("noOwner");
    }

    if (active && plan === null) {
      flags.push("noPlan");
    }

    if (active && !hasDue) {
      flags.push("noDueDate");
    }

    if (active && hasDue && dueDay < today) {
      flags.push("planOverdue");
    }

    if (risk.status === "ACCEPTED" && (risk.exposureBand === "HIGH" || risk.exposureBand === "CRITICAL")) {
      flags.push("acceptedHigh");
    }

    if (hasUpdated && today - updatedDay > STALE_DAYS) {
      flags.push("stale");
    }

    if ((references.get(risk.reference.trim().toLowerCase()) ?? 0) > 1) {
      flags.push("duplicateRef");
    }

    const ordered = FLAG_ORDER.filter((flag) => flags.includes(flag));

    rows.push({
      key: risk.id,
      reference: risk.reference,
      title: risk.title,
      category: risk.category,
      owner,
      status: risk.status,
      band: risk.exposureBand,
      probability: risk.probability,
      impact: risk.impact,
      inherent: risk.inherentScore,
      residualProbability: risk.residualProbability,
      residualImpact: risk.residualImpact,
      residual: risk.residualScore,
      plan,
      due: hasDue ? dueDay : null,
      overdueDays: active && hasDue && dueDay < today ? today - dueDay : null,
      staleDays: hasUpdated && today - updatedDay > STALE_DAYS ? today - updatedDay : null,
      flags: ordered,
      serious: (risk.exposureBand === "HIGH" || risk.exposureBand === "CRITICAL") && ordered.length > 0,
    });
  }

  const score = (row: Row) => (Number.isFinite(row.residual) ? row.residual : 0);

  rows.sort((a, b) => Number(b.serious) - Number(a.serious) || b.flags.length - a.flags.length || score(b) - score(a) || before(a.reference, b.reference) || before(a.key, b.key));

  const baseOf = (flag: Flag): number => {
    if (flag === "noPlan" || flag === "noDueDate" || flag === "planOverdue") {
      return rows.filter((row) => isActive(row.status)).length;
    }

    if (flag === "residualNotReduced") {
      return rows.filter((row) => row.status === "MITIGATING").length;
    }

    if (flag === "acceptedHigh") {
      return rows.filter((row) => row.status === "ACCEPTED").length;
    }

    return rows.length;
  };

  const checks: Check[] = FLAG_ORDER.map((flag) => {
    const count = rows.filter((row) => row.flags.includes(flag)).length;
    const base = baseOf(flag);

    return { flag, label: CHECK_LABELS[flag], group: GROUP_OF[flag], count, base, share: base > 0 ? count / base : null };
  });

  const clean = rows.filter((row) => row.flags.length === 0).length;
  const ownerKeys = [...new Set(rows.map((row) => row.owner ?? ""))];
  const categoryKeys = [...new Set(rows.map((row) => row.category))];
  const high = rows.filter((row) => row.band === "HIGH" || row.band === "CRITICAL");

  return {
    ok: true,
    data: {
      rows,
      checks,
      owners: ownerKeys.map((key) => groupOf(key, key === "" ? "No owner" : key, rows.filter((row) => (row.owner ?? "") === key))).sort((a, b) => b.count - a.count || before(a.label, b.label)),
      categories: categoryKeys.map((key) => groupOf(key, words(key), rows.filter((row) => row.category === key))).sort((a, b) => b.count - a.count || before(a.label, b.label)),
      live: rows.length,
      closed,
      active: rows.filter((row) => isActive(row.status)).length,
      clean,
      cleanShare: rows.length > 0 ? clean / rows.length : null,
      withProblem: rows.length - clean,
      scoreIssues: rows.filter((row) => row.flags.some((flag) => GROUP_OF[flag] === "scoring")).length,
      gaps: rows.filter((row) => row.flags.some((flag) => flag === "noOwner" || flag === "noPlan" || flag === "noDueDate")).length,
      overdue: rows.filter((row) => row.flags.includes("planOverdue")).length,
      serious: rows.filter((row) => row.serious).length,
      seriousBase: high.length,
    },
  };
}

export function filterRows(rows: Row[], filter: Filter): Row[] {
  if (filter === "problem") {
    return rows.filter((row) => row.flags.length > 0);
  }

  if (filter === "scoring" || filter === "gaps" || filter === "review") {
    return rows.filter((row) => row.flags.some((flag) => GROUP_OF[flag] === filter));
  }

  return rows;
}

export function flagText(flag: Flag, row: Row): string {
  if (flag === "scoreMismatch") {
    return "Score is not probability × impact";
  }

  if (flag === "outOfScale") {
    return "A rating is outside 1 to 5";
  }

  if (flag === "residualAboveInherent") {
    return "Residual score is higher than inherent";
  }

  if (flag === "bandOutOfOrder") {
    return "Band is out of line with other risks";
  }

  if (flag === "residualNotReduced") {
    return "Being mitigated, residual not reduced";
  }

  if (flag === "noOwner") {
    return "No owner";
  }

  if (flag === "noPlan") {
    return "No mitigation plan";
  }

  if (flag === "noDueDate") {
    return "No mitigation due date";
  }

  if (flag === "planOverdue") {
    return `Mitigation overdue by ${dayCount(row.overdueDays ?? 0)}`;
  }

  if (flag === "acceptedHigh") {
    return `Accepted at ${words(row.band).toLowerCase()} exposure`;
  }

  if (flag === "stale") {
    return `Not changed for ${dayCount(row.staleDays ?? 0)}`;
  }

  return "Reference used by another risk";
}

export function registerMarkdown(data: Register, shown: Row[], projectName: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Risk register checks: ${projectName}`, "");
  lines.push(`${data.live} live ${plural(data.live, "risk", "risks")} checked (open, mitigating or accepted); ${data.closed} closed ${plural(data.closed, "risk is", "risks are")} left out.`, "");
  lines.push(`- ${data.clean} of ${data.live} have nothing to fix (${pct(data.cleanShare)})`);
  lines.push(`- ${data.scoreIssues} with a scoring problem, ${data.gaps} missing an owner, plan or due date, ${data.overdue} with mitigation past its due date`);
  lines.push(`- ${data.serious} of ${data.seriousBase} high or critical ${plural(data.seriousBase, "risk has", "risks have")} at least one problem`, "");

  lines.push("| Check | Risks | Out of |", "| --- | ---: | ---: |");

  for (const check of data.checks) {
    lines.push(`| ${check.label} | ${check.count} | ${check.base} |`);
  }

  lines.push("");

  if (shown.length > 0) {
    lines.push(filterLabel ? `Risks (${filterLabel.toLowerCase()}):` : "Risks:", "", "| Reference | Risk | Band | Residual | Problems |", "| --- | --- | --- | ---: | --- |");

    for (const row of shown.slice(0, 25)) {
      lines.push(`| ${cell(row.reference)} | ${cell(trunc(row.title, 40))} | ${words(row.band)} | ${Number.isFinite(row.residual) ? row.residual : "—"} | ${row.flags.map((flag) => flagText(flag, row)).join(", ") || "—"} |`);
    }

    lines.push("");
  }

  lines.push(
    `Closed risks are not checked. A mitigation plan counts as recorded when it has at least ${MIN_PLAN} characters and is not a placeholder such as "n/a". Plan and due date checks apply to open and mitigating risks. A risk counts as not changed after ${STALE_DAYS} days without an edit. A band is flagged as out of line when it ranks against the residual scores of other risks on the register (a higher score in a lower band); the fewest risks needed to explain the clash are flagged.`,
    "",
  );

  return lines.join("\n");
}
