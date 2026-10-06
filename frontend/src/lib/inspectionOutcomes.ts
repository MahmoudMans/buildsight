import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import { monthOf, monthShort } from "@/lib/safetyRates";
import type { NcrSeverity, NcrStatus, QualityControl, QualityDiscipline, QualityInspectionType } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 180;
export const PAGE = 10;

export type FollowFilter = "all" | "gaps";

export const FOLLOW_FILTERS: ReadonlyArray<{ key: FollowFilter; label: string }> = [
  { key: "all", label: "All failures" },
  { key: "gaps", label: "No follow-up" },
];

export const DISCIPLINE_LABEL: Record<QualityDiscipline, string> = {
  CIVIL: "Civil",
  STRUCTURAL: "Structural",
  ARCHITECTURAL: "Architectural",
  MEP: "MEP",
  HSE: "HSE",
  QUALITY: "Quality",
  GENERAL: "General",
};

export const TYPE_LABEL: Record<QualityInspectionType, string> = {
  INTERNAL: "Internal",
  CLIENT: "Client",
  CONSULTANT: "Consultant",
  REGULATORY: "Regulatory",
  TEST: "Test",
};

export const TYPE_ORDER: ReadonlyArray<QualityInspectionType> = ["INTERNAL", "CLIENT", "CONSULTANT", "REGULATORY", "TEST"];

const THIRD_PARTY: ReadonlyArray<QualityInspectionType> = ["CLIENT", "CONSULTANT", "REGULATORY"];

export const SEVERITY_LABEL: Record<NcrSeverity, string> = { MINOR: "minor", MAJOR: "major", CRITICAL: "critical" };

export type Outcome = "pass" | "obs" | "fail";

export interface Assessed {
  id: string;
  reference: string;
  title: string;
  discipline: QualityDiscipline;
  type: QualityInspectionType;
  thirdParty: boolean;
  date: number;
  outcome: Outcome;
  inspector: string | null;
}

export interface Tally {
  key: string;
  label: string;
  assessed: number;
  pass: number;
  obs: number;
  fail: number;
  failRate: number;
}

export interface MonthRow {
  month: number;
  label: string;
  assessed: number;
  pass: number;
  obs: number;
  fail: number;
}

export interface LinkedNcr {
  id: string;
  reference: string;
  severity: NcrSeverity;
  status: NcrStatus;
  open: boolean;
  after: number | null;
}

export type Recheck = "passed" | "failedAgain" | "held" | "planned" | "none";

export interface Follow {
  item: Assessed;
  ncrs: LinkedNcr[];
  recheck: Recheck;
  recheckRef: string | null;
  recheckDate: number | null;
  gap: boolean;
  daysSince: number;
}

export interface Rate {
  assessed: number;
  fail: number;
  rate: number | null;
}

export interface Outcomes {
  assessed: number;
  pass: number;
  obs: number;
  fail: number;
  passRate: number | null;
  cleanRate: number | null;
  failRate: number | null;
  thirdParty: Rate;
  inHouse: Rate;
  disciplines: Tally[];
  types: Tally[];
  months: MonthRow[];
  follow: Follow[];
  gaps: number;
  noNcr: number;
  openNcrs: number;
  from: number;
  to: number;
  windowDays: number;
  unassessed: number;
  skipped: number;
}

export type OutcomesResult = { ok: true; outcomes: Outcomes } | { ok: false; reason: "empty" };

function normaliseTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

function rate(fail: number, assessed: number): number | null {
  return assessed > 0 ? fail / assessed : null;
}

function tally(key: string, label: string, items: Assessed[]): Tally {
  const pass = items.filter((item) => item.outcome === "pass").length;
  const obs = items.filter((item) => item.outcome === "obs").length;
  const fail = items.filter((item) => item.outcome === "fail").length;

  return { key, label, assessed: items.length, pass, obs, fail, failRate: items.length > 0 ? fail / items.length : 0 };
}

export function buildOutcomes(data: QualityControl, today: number, windowDays: number): OutcomesResult {
  const from = today - windowDays + 1;
  const all = data.inspections ?? [];
  const assessed: Assessed[] = [];
  let skipped = 0;
  let unassessed = 0;
  let anyCompleted = false;

  for (const raw of all) {
    if (raw.status !== "COMPLETED") {
      continue;
    }

    anyCompleted = true;

    const actual = toDay(raw.actualDate);
    const planned = toDay(raw.plannedDate);
    const date = Number.isFinite(actual) ? actual : planned;

    if (!Number.isFinite(date)) {
      skipped += 1;
      continue;
    }

    if (date < from || date > today) {
      continue;
    }

    if (raw.result === "NOT_ASSESSED") {
      unassessed += 1;
      continue;
    }

    assessed.push({
      id: raw.id,
      reference: raw.reference,
      title: raw.title,
      discipline: raw.discipline,
      type: raw.inspectionType,
      thirdParty: THIRD_PARTY.includes(raw.inspectionType),
      date,
      outcome: raw.result === "FAIL" ? "fail" : raw.result === "PASS" ? "pass" : "obs",
      inspector: raw.inspectorName,
    });
  }

  if (!anyCompleted && skipped === 0) {
    return { ok: false, reason: "empty" };
  }

  const pass = assessed.filter((item) => item.outcome === "pass").length;
  const obs = assessed.filter((item) => item.outcome === "obs").length;
  const failed = assessed.filter((item) => item.outcome === "fail");
  const fail = failed.length;
  const third = assessed.filter((item) => item.thirdParty);
  const house = assessed.filter((item) => !item.thirdParty);

  const disciplines = [...new Set(assessed.map((item) => item.discipline))]
    .map((discipline) => tally(discipline, DISCIPLINE_LABEL[discipline], assessed.filter((item) => item.discipline === discipline)))
    .sort((a, b) => b.failRate - a.failRate || b.assessed - a.assessed || a.label.localeCompare(b.label));
  const types = TYPE_ORDER.filter((type) => assessed.some((item) => item.type === type)).map((type) => tally(type, TYPE_LABEL[type], assessed.filter((item) => item.type === type)));

  const months: MonthRow[] = [];

  for (let month = monthOf(from); month <= monthOf(today); month += 1) {
    const inMonth = assessed.filter((item) => monthOf(item.date) === month);

    months.push({
      month,
      label: monthShort(month),
      assessed: inMonth.length,
      pass: inMonth.filter((item) => item.outcome === "pass").length,
      obs: inMonth.filter((item) => item.outcome === "obs").length,
      fail: inMonth.filter((item) => item.outcome === "fail").length,
    });
  }

  const ncrs = (data.ncrs ?? []).filter((ncr) => ncr.status !== "VOID" && ncr.inspectionId !== null);
  const follow: Follow[] = failed.map((item) => {
    const linked: LinkedNcr[] = ncrs
      .filter((ncr) => ncr.inspectionId === item.id)
      .map((ncr) => {
        const raised = toDay(ncr.raisedDate);

        return {
          id: ncr.id,
          reference: ncr.reference,
          severity: ncr.severity,
          status: ncr.status,
          open: ncr.status !== "CLOSED",
          after: Number.isFinite(raised) ? raised - item.date : null,
        };
      })
      .sort((a, b) => a.reference.localeCompare(b.reference, undefined, { numeric: true }));

    const key = normaliseTitle(item.title);
    const later = all
      .filter((other) => other.id !== item.id && other.status !== "CANCELLED" && other.discipline === item.discipline && normaliseTitle(other.title) === key)
      .map((other) => {
        const actual = toDay(other.actualDate);
        const planned = toDay(other.plannedDate);

        return { other, date: Number.isFinite(actual) ? actual : planned };
      })
      .filter((entry) => Number.isFinite(entry.date) && entry.date > item.date)
      .sort((a, b) => b.date - a.date)[0];

    let recheck: Recheck = "none";

    if (later) {
      if (later.other.status === "COMPLETED") {
        recheck = later.other.result === "FAIL" ? "failedAgain" : later.other.result === "NOT_ASSESSED" ? "held" : "passed";
      } else {
        recheck = "planned";
      }
    }

    return {
      item,
      ncrs: linked,
      recheck,
      recheckRef: later ? later.other.reference : null,
      recheckDate: later ? later.date : null,
      gap: linked.length === 0 && recheck === "none",
      daysSince: today - item.date,
    };
  });

  follow.sort((a, b) => Number(b.gap) - Number(a.gap) || b.item.date - a.item.date || a.item.reference.localeCompare(b.item.reference, undefined, { numeric: true }));

  return {
    ok: true,
    outcomes: {
      assessed: assessed.length,
      pass,
      obs,
      fail,
      passRate: rate(pass + obs, assessed.length),
      cleanRate: rate(pass, assessed.length),
      failRate: rate(fail, assessed.length),
      thirdParty: { assessed: third.length, fail: third.filter((item) => item.outcome === "fail").length, rate: rate(third.filter((item) => item.outcome === "fail").length, third.length) },
      inHouse: { assessed: house.length, fail: house.filter((item) => item.outcome === "fail").length, rate: rate(house.filter((item) => item.outcome === "fail").length, house.length) },
      disciplines,
      types,
      months,
      follow,
      gaps: follow.filter((entry) => entry.gap).length,
      noNcr: follow.filter((entry) => entry.ncrs.length === 0).length,
      openNcrs: follow.reduce((sum, entry) => sum + entry.ncrs.filter((ncr) => ncr.open).length, 0),
      from,
      to: today,
      windowDays,
      unassessed,
      skipped,
    },
  };
}

export function filterFollow(list: Follow[], filter: FollowFilter): Follow[] {
  return filter === "gaps" ? list.filter((entry) => entry.gap) : list;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function recheckText(entry: Follow): string {
  const when = entry.recheckDate !== null ? formatDay(entry.recheckDate) : "";

  switch (entry.recheck) {
    case "passed":
      return `Re-inspected and passed, ${when}`;
    case "failedAgain":
      return `Re-inspected and failed again, ${when}`;
    case "held":
      return `Re-inspected without a result, ${when}`;
    case "planned":
      return `Re-inspection planned, ${when}`;
    default:
      return "No re-inspection found";
  }
}

export function ncrText(ncr: LinkedNcr): string {
  return `${ncr.reference}, ${SEVERITY_LABEL[ncr.severity]}, ${ncr.open ? "still open" : "closed"}`;
}

export function outcomesMarkdown(outcomes: Outcomes, list: Follow[], projectName: string, today: number, windowLabel: string): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Inspection outcomes: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Inspections held in the last ${windowLabel}, ${formatDay(outcomes.from)} to ${formatDay(outcomes.to)}.`, "");
  lines.push(`- ${outcomes.assessed} ${plural(outcomes.assessed, "inspection", "inspections")} with a result: ${outcomes.pass} passed, ${outcomes.obs} passed with observations, ${outcomes.fail} failed`);
  lines.push(`- ${pct(outcomes.passRate)} passed (${pct(outcomes.cleanRate)} with no observations), ${pct(outcomes.failRate)} failed`);
  lines.push(`- Third-party inspections failed ${pct(outcomes.thirdParty.rate)} of the time (${outcomes.thirdParty.fail} of ${outcomes.thirdParty.assessed}), in-house ones ${pct(outcomes.inHouse.rate)} (${outcomes.inHouse.fail} of ${outcomes.inHouse.assessed})`);
  lines.push(`- ${outcomes.gaps} of ${outcomes.fail} ${plural(outcomes.fail, "failure has", "failures have")} no NCR and no re-inspection`, "");

  if (outcomes.disciplines.length > 0) {
    lines.push("| Discipline | Inspected | Passed | Observations | Failed | Fail rate |", "| --- | ---: | ---: | ---: | ---: | ---: |");

    for (const row of outcomes.disciplines) {
      lines.push(`| ${row.label} | ${row.assessed} | ${row.pass} | ${row.obs} | ${row.fail} | ${pct(row.failRate)} |`);
    }

    lines.push("");
  }

  if (list.length > 0) {
    lines.push("| Date | Inspection | Discipline | Type | NCRs | Re-inspection |", "| --- | --- | --- | --- | --- | --- |");

    for (const entry of list) {
      lines.push(`| ${formatDay(entry.item.date)} | ${cell(entry.item.reference)} ${cell(trunc(entry.item.title, 45))} | ${DISCIPLINE_LABEL[entry.item.discipline]} | ${TYPE_LABEL[entry.item.type]} | ${entry.ncrs.length > 0 ? entry.ncrs.map((ncr) => cell(ncrText(ncr))).join("; ") : "none"} | ${recheckText(entry)} |`);
    }

    lines.push("");
  }

  lines.push(
    "An inspection counts once it is marked completed with a result of pass, pass with observations or fail, dated by the day it was held (the planned date if no actual date is recorded). A failure has follow-up when an NCR is linked to it, or when a later inspection with the same title and discipline has been held or planned. Third party means client, consultant or regulatory inspections; internal and test inspections are in-house. Completed inspections with no result and cancelled inspections are left out.",
    "",
  );

  return lines.join("\n");
}
