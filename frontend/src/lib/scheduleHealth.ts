import { formatDay, plural, toDay, words } from "@/lib/openItems";
import type { ScheduleActivity, ScheduleControl, ScheduleDependencyType } from "@/types/project";

export type CheckStatus = "pass" | "warn" | "fail" | "na";
export type CheckKey =
  | "network"
  | "currency"
  | "openEnds"
  | "leads"
  | "lags"
  | "types"
  | "negativeFloat"
  | "highFloat"
  | "highDuration"
  | "missed"
  | "consistency"
  | "constraintsLate"
  | "constrainedCritical";

export const HIGH_FLOAT_DAYS = 44;
export const HIGH_DURATION_DAYS = 44;
export const STALE_WARN_DAYS = 7;
export const STALE_FAIL_DAYS = 14;
export const OFFENDER_LIMIT = 10;

export interface Offender {
  id: string;
  code: string;
  name: string;
  note: string;
}

export interface Check {
  key: CheckKey;
  title: string;
  why: string;
  status: CheckStatus;
  display: string;
  limit: string;
  share: number;
  offenders: Offender[];
  total: number;
}

export interface FloatBucket {
  key: string;
  label: string;
  count: number;
  tone: "bad" | "warn" | "good" | "plain";
}

export interface TypeShare {
  type: ScheduleDependencyType;
  count: number;
}

export interface Health {
  checks: Check[];
  passed: number;
  warned: number;
  failed: number;
  applicable: number;
  verdict: "healthy" | "attention" | "weak" | "none";
  live: number;
  links: number;
  density: number;
  dataDay: number;
  staleDays: number;
  floatProfile: FloatBucket[];
  types: TypeShare[];
}

function grade(share: number, passUpTo: number, warnUpTo: number): CheckStatus {
  return share <= passUpTo ? "pass" : share <= warnUpTo ? "warn" : "fail";
}

function pct(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

function offender(item: ScheduleActivity, note: string): Offender {
  return { id: `${item.id}-${note}`, code: item.activityCode, name: item.name, note };
}

function make(
  key: CheckKey,
  title: string,
  why: string,
  limit: string,
  status: CheckStatus,
  display: string,
  share: number,
  offenders: Offender[],
): Check {
  return { key, title, why, status, display, limit, share, offenders: offenders.slice(0, OFFENDER_LIMIT), total: offenders.length };
}

export function buildHealth(data: ScheduleControl, today: number): Health {
  const activities = data.activities ?? [];
  const dependencies = data.dependencies ?? [];
  const constraints = (data.constraints ?? []).filter((item) => item.status === "OPEN");
  const intelligence = data.intelligence;

  const byId = new Map(activities.map((item) => [item.id, item]));
  const live = activities.filter((item) => item.status !== "COMPLETED");
  const liveIds = new Set(live.map((item) => item.id));
  const dataDay = (() => {
    const day = toDay(intelligence?.dataDate);

    return Number.isFinite(day) ? day : today;
  })();

  const links = dependencies.filter((item) => byId.has(item.predecessorActivityId) && byId.has(item.successorActivityId));
  const touching = links.filter((item) => liveIds.has(item.predecessorActivityId) || liveIds.has(item.successorActivityId));

  const hasPred = new Set(links.map((item) => item.successorActivityId));
  const hasSucc = new Set(links.map((item) => item.predecessorActivityId));
  const total = live.length;
  const checks: Check[] = [];

  const valid = intelligence?.networkValid !== false;

  checks.push(
    make(
      "network",
      "Network is valid",
      "The scheduling engine must be able to calculate dates. A loop in the logic stops it.",
      "No errors",
      valid ? "pass" : "fail",
      valid ? "Valid" : "Invalid",
      valid ? 0 : 1,
      valid ? [] : [{ id: "network", code: "", name: intelligence?.networkError ?? "The network could not be calculated", note: "Error" }],
    ),
  );

  const stale = today - dataDay;

  checks.push(
    make(
      "currency",
      "Schedule is up to date",
      "Dates and floats are only as current as the last update. An old data date means the forecast is stale.",
      `${STALE_WARN_DAYS} days or less`,
      stale <= STALE_WARN_DAYS ? "pass" : stale <= STALE_FAIL_DAYS ? "warn" : "fail",
      `${Math.max(0, stale)} ${plural(Math.max(0, stale), "day", "days")} old`,
      Math.max(0, stale) / 30,
      stale > STALE_WARN_DAYS ? [{ id: "stale", code: "", name: `Data date is ${formatDay(dataDay)}`, note: "Update the schedule" }] : [],
    ),
  );

  const openEnds: Offender[] = [];

  for (const item of live) {
    const noPred = !hasPred.has(item.id);
    const noSucc = !hasSucc.has(item.id);

    if (noPred || noSucc) {
      openEnds.push(offender(item, noPred && noSucc ? "No predecessor or successor" : noPred ? "No predecessor" : "No successor"));
    }
  }

  const openShare = total > 0 ? openEnds.length / total : 0;

  checks.push(
    make(
      "openEnds",
      "Activities are linked in",
      "An activity with no predecessor or no successor can slip without moving anything else, so the forecast hides the delay.",
      "5% or less",
      total === 0 ? "na" : grade(openShare, 0.05, 0.1),
      `${pct(openShare)} (${openEnds.length} of ${total})`,
      openShare,
      openEnds,
    ),
  );

  const leads = touching.filter((item) => item.lagDays < 0);

  checks.push(
    make(
      "leads",
      "No negative lags",
      "A lead lets a successor start before its predecessor allows. It distorts the critical path and is easy to abuse.",
      "None",
      links.length === 0 ? "na" : leads.length === 0 ? "pass" : "fail",
      leads.length === 0 ? "None" : `${leads.length} ${plural(leads.length, "link", "links")}`,
      links.length > 0 ? leads.length / links.length : 0,
      leads.map((item) => ({ id: item.id, code: item.successorCode, name: `After ${item.predecessorCode}`, note: `${item.dependencyType} ${item.lagDays} d` })),
    ),
  );

  const lagged = touching.filter((item) => item.lagDays > 0);
  const laggedShare = touching.length > 0 ? lagged.length / touching.length : 0;

  checks.push(
    make(
      "lags",
      "Few positive lags",
      "Lags hide work or waiting that should be its own activity with an owner and a duration.",
      "5% or less of links",
      touching.length === 0 ? "na" : grade(laggedShare, 0.05, 0.1),
      `${pct(laggedShare)} (${lagged.length} of ${touching.length})`,
      laggedShare,
      lagged.map((item) => ({ id: item.id, code: item.successorCode, name: `After ${item.predecessorCode}`, note: `${item.dependencyType} +${item.lagDays} d` })),
    ),
  );

  const finishToStart = touching.filter((item) => item.dependencyType === "FS");
  const fsShare = touching.length > 0 ? finishToStart.length / touching.length : 1;
  const others = touching.filter((item) => item.dependencyType !== "FS");

  checks.push(
    make(
      "types",
      "Mostly finish-to-start",
      "Finish-to-start is the clearest logic. Many start-to-start or finish-to-finish links make the path harder to reason about.",
      "90% or more",
      touching.length === 0 ? "na" : fsShare >= 0.9 ? "pass" : fsShare >= 0.8 ? "warn" : "fail",
      `${pct(fsShare)} (${finishToStart.length} of ${touching.length})`,
      1 - fsShare,
      others.map((item) => ({ id: item.id, code: item.successorCode, name: `After ${item.predecessorCode}`, note: `${item.dependencyType}${item.lagDays !== 0 ? ` ${item.lagDays > 0 ? "+" : ""}${item.lagDays} d` : ""}` })),
    ),
  );

  const negative = live.filter((item) => item.totalFloatDays < 0).sort((a, b) => a.totalFloatDays - b.totalFloatDays);
  const negativeShare = total > 0 ? negative.length / total : 0;

  checks.push(
    make(
      "negativeFloat",
      "No negative float",
      "Negative float means the plan already misses a required date. It needs recovery or an agreed change to the target.",
      "None",
      total === 0 ? "na" : negative.length === 0 ? "pass" : negativeShare <= 0.05 ? "warn" : "fail",
      negative.length === 0 ? "None" : `${negative.length} ${plural(negative.length, "activity", "activities")}`,
      negativeShare,
      negative.map((item) => offender(item, `${item.totalFloatDays} d float`)),
    ),
  );

  const highFloat = live.filter((item) => item.totalFloatDays > HIGH_FLOAT_DAYS).sort((a, b) => b.totalFloatDays - a.totalFloatDays);
  const highFloatShare = total > 0 ? highFloat.length / total : 0;

  checks.push(
    make(
      "highFloat",
      "Float is believable",
      `More than ${HIGH_FLOAT_DAYS} days of float usually means a missing successor, so the activity is not really constrained.`,
      "5% or less",
      total === 0 ? "na" : grade(highFloatShare, 0.05, 0.1),
      `${pct(highFloatShare)} (${highFloat.length} of ${total})`,
      highFloatShare,
      highFloat.map((item) => offender(item, `${item.totalFloatDays} d float`)),
    ),
  );

  const long = live.filter((item) => item.originalDurationDays > HIGH_DURATION_DAYS).sort((a, b) => b.originalDurationDays - a.originalDurationDays);
  const longShare = total > 0 ? long.length / total : 0;

  checks.push(
    make(
      "highDuration",
      "Durations are short enough to track",
      `An activity longer than ${HIGH_DURATION_DAYS} days is hard to measure. Splitting it shows progress and slippage sooner.`,
      "5% or less",
      total === 0 ? "na" : grade(longShare, 0.05, 0.1),
      `${pct(longShare)} (${long.length} of ${total})`,
      longShare,
      long.map((item) => offender(item, `${item.originalDurationDays} d duration`)),
    ),
  );

  const due = activities.filter((item) => toDay(item.currentFinish) <= dataDay);
  const missed = due.filter((item) => item.status !== "COMPLETED").sort((a, b) => toDay(a.currentFinish) - toDay(b.currentFinish));
  const missedShare = due.length > 0 ? missed.length / due.length : 0;

  checks.push(
    make(
      "missed",
      "Planned work is being finished",
      "Activities whose finish date has passed but are not complete show whether the crew is keeping up with the plan.",
      "5% or less of due work",
      due.length === 0 ? "na" : grade(missedShare, 0.05, 0.1),
      `${pct(missedShare)} (${missed.length} of ${due.length})`,
      missedShare,
      missed.map((item) => offender(item, `finish was ${formatDay(toDay(item.currentFinish))}`)),
    ),
  );

  const overdueConstraints = constraints.filter((item) => item.overdue || toDay(item.dueDate) < today);

  checks.push(
    make(
      "constraintsLate",
      "Constraints are cleared on time",
      "Open constraints past their due date are the usual reason planned starts do not happen.",
      "None overdue",
      constraints.length === 0 ? "pass" : overdueConstraints.length === 0 ? "pass" : overdueConstraints.length / constraints.length <= 0.2 ? "warn" : "fail",
      constraints.length === 0 ? "No open constraints" : `${overdueConstraints.length} of ${constraints.length} overdue`,
      constraints.length > 0 ? overdueConstraints.length / constraints.length : 0,
      overdueConstraints.map((item) => ({ id: item.id, code: item.activityCode, name: item.title, note: `due ${formatDay(toDay(item.dueDate))}` })),
    ),
  );

  const criticalIds = new Set(live.filter((item) => item.critical || item.nearCritical).map((item) => item.id));
  const onCritical = constraints.filter((item) => criticalIds.has(item.activityId));

  checks.push(
    make(
      "constrainedCritical",
      "Critical work is unconstrained",
      "An open constraint on a critical or near-critical activity puts the finish date directly at risk.",
      "None",
      onCritical.length === 0 ? "pass" : onCritical.length <= 2 ? "warn" : "fail",
      onCritical.length === 0 ? "None" : `${onCritical.length} ${plural(onCritical.length, "constraint", "constraints")}`,
      constraints.length > 0 ? onCritical.length / constraints.length : 0,
      onCritical.map((item) => ({ id: item.id, code: item.activityCode, name: item.title, note: `${words(item.constraintType)} · due ${formatDay(toDay(item.dueDate))}` })),
    ),
  );

  const odd: Offender[] = [];

  for (const item of activities) {
    if (item.status === "IN_PROGRESS" && item.progressPercentage <= 0) {
      odd.push(offender(item, "In progress at 0%"));
    } else if (item.status === "COMPLETED" && item.progressPercentage < 100) {
      odd.push(offender(item, `Complete at ${Math.round(item.progressPercentage)}%`));
    } else if (item.status === "NOT_STARTED" && (item.progressPercentage > 0 || item.actualStart !== null)) {
      odd.push(offender(item, "Not started but has progress"));
    }
  }

  const oddShare = activities.length > 0 ? odd.length / activities.length : 0;

  checks.push(
    make(
      "consistency",
      "Status matches progress",
      "Conflicting status and percent complete mean the update was rushed, so forecast dates cannot be trusted.",
      "None",
      activities.length === 0 ? "na" : odd.length === 0 ? "pass" : oddShare <= 0.05 ? "warn" : "fail",
      odd.length === 0 ? "Consistent" : `${odd.length} ${plural(odd.length, "activity", "activities")}`,
      oddShare,
      odd,
    ),
  );

  const floatBuckets: FloatBucket[] = [
    { key: "neg", label: "Negative", count: 0, tone: "bad" },
    { key: "zero", label: "None (0)", count: 0, tone: "bad" },
    { key: "small", label: "1 to 5 days", count: 0, tone: "warn" },
    { key: "mid", label: "6 to 15 days", count: 0, tone: "good" },
    { key: "wide", label: `16 to ${HIGH_FLOAT_DAYS} days`, count: 0, tone: "good" },
    { key: "huge", label: `Over ${HIGH_FLOAT_DAYS} days`, count: 0, tone: "plain" },
  ];

  for (const item of live) {
    const value = item.totalFloatDays;
    const slot = value < 0 ? 0 : value === 0 ? 1 : value <= 5 ? 2 : value <= 15 ? 3 : value <= HIGH_FLOAT_DAYS ? 4 : 5;
    const bucket = floatBuckets[slot];

    if (bucket) {
      bucket.count += 1;
    }
  }

  const types = (["FS", "SS", "FF", "SF"] as const).map((type) => ({ type, count: touching.filter((item) => item.dependencyType === type).length }));
  const applicable = checks.filter((item) => item.status !== "na");
  const passed = applicable.filter((item) => item.status === "pass").length;
  const failed = applicable.filter((item) => item.status === "fail").length;
  const warned = applicable.filter((item) => item.status === "warn").length;
  const ratio = applicable.length > 0 ? passed / applicable.length : NaN;

  return {
    checks,
    passed,
    warned,
    failed,
    applicable: applicable.length,
    verdict: !Number.isFinite(ratio) ? "none" : ratio >= 0.8 && failed === 0 ? "healthy" : ratio >= 0.5 ? "attention" : "weak",
    live: total,
    links: touching.length,
    density: total > 0 ? touching.length / total : 0,
    dataDay,
    staleDays: stale,
    floatProfile: floatBuckets,
    types,
  };
}

export function healthMarkdown(health: Health, projectName: string, today: number): string {
  const lines: string[] = [`# Schedule health: ${projectName}`, ""];

  lines.push(`As of ${formatDay(today)} (schedule data date ${formatDay(health.dataDay)}): ${health.passed} of ${health.applicable} checks pass, ${health.warned} to watch, ${health.failed} fail.`, "");

  for (const check of health.checks) {
    if (check.status === "na") {
      continue;
    }

    const mark = check.status === "pass" ? "PASS" : check.status === "warn" ? "WATCH" : "FAIL";

    lines.push(`- ${mark} **${check.title}**: ${check.display} (limit ${check.limit.toLowerCase()})`);

    for (const item of check.offenders.slice(0, 4)) {
      lines.push(`  - ${[item.code, item.name].filter(Boolean).join(" ")}: ${item.note}`);
    }

    if (check.total > 4) {
      lines.push(`  - and ${check.total - 4} more`);
    }
  }

  return `${lines.join("\n")}\n`;
}
