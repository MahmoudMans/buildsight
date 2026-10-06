import { MIN_SAMPLE, daysText, median, percentile, rateText, windowLabel } from "@/lib/closureSpeed";
import { formatDay, money, plural, toDay, trunc } from "@/lib/openItems";
import type { CommercialControl } from "@/types/project";

export const LIST_LIMIT = 8;

export type StreamKey = "changeOrders" | "claims" | "certification" | "payment";

export interface StreamInfo {
  key: StreamKey;
  label: string;
  decided: string;
  waiting: string;
  from: string;
  to: string;
}

export const STREAMS: ReadonlyArray<StreamInfo> = [
  { key: "changeOrders", label: "Change orders", decided: "decided", waiting: "awaiting a decision", from: "submitted", to: "decided" },
  { key: "claims", label: "Claims", decided: "decided", waiting: "awaiting a decision", from: "submitted", to: "decided" },
  { key: "certification", label: "Payment applications", decided: "certified", waiting: "awaiting certification", from: "applied for", to: "certified" },
  { key: "payment", label: "Certified payments", decided: "paid in full", waiting: "awaiting payment", from: "certified", to: "paid" },
];

export const STREAM_LABEL = Object.fromEntries(STREAMS.map((item) => [item.key, item.label])) as Record<StreamKey, string>;

export interface Case {
  id: string;
  stream: StreamKey;
  reference: string;
  title: string;
  amount: number;
  start: number;
  due: number | null;
  end: number | null;
  took: number | null;
  wait: number;
  late: number;
  done: boolean;
}

export interface StreamStats {
  key: StreamKey;
  label: string;
  done: Case[];
  pending: Case[];
  count: number;
  median: number | null;
  p90: number | null;
  dated: number;
  onTime: number;
  rate: number | null;
  lateCount: number;
  avgLate: number | null;
  pendingCount: number;
  overdueCount: number;
  waitingValue: number;
  overdueValue: number;
  oldestWait: number | null;
}

export interface Decisions {
  streams: StreamStats[];
  windowDays: number | null;
  scaleMax: number;
  pending: Case[];
  slowest: Case[];
  count: number;
  dated: number;
  onTime: number;
  rate: number | null;
  median: number | null;
  pendingCount: number;
  pendingValue: number;
  overdueCount: number;
  overdueValue: number;
  slowestStream: StreamStats | null;
  leastOnTime: StreamStats | null;
  skipped: number;
  undated: number;
}

export type DecisionResult = { ok: true; decisions: Decisions } | { ok: false; reason: "empty" };

function dayOrNull(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

function amountOf(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const SCALES = [7, 14, 30, 45, 60, 90, 120, 180, 240, 365, 545, 730, 1095];

export function niceScale(value: number): number {
  const found = SCALES.find((step) => step >= value);

  return found ?? Math.ceil(value / 365) * 365;
}

function periodTitle(periodEnd: string | null | undefined): string {
  const day = dayOrNull(periodEnd);

  return day === null ? "Payment certificate" : `Period ending ${formatDay(day)}`;
}

export function collectCases(data: CommercialControl, today: number): { cases: Case[]; skipped: number; undated: number } {
  const cases: Case[] = [];
  let skipped = 0;
  let undated = 0;

  const add = (item: Omit<Case, "took" | "wait" | "late">) => {
    const took = item.done && item.end !== null ? Math.max(0, item.end - item.start) : null;
    const wait = item.done ? 0 : Math.max(0, today - item.start);
    const late = item.done ? (item.due !== null && item.end !== null && item.end > item.due ? item.end - item.due : 0) : item.due !== null && item.due < today ? today - item.due : 0;

    cases.push({ ...item, took, wait, late });
  };

  for (const order of data.changeOrders ?? []) {
    if (order.status === "DRAFT" || order.status === "VOID") {
      continue;
    }

    const start = dayOrNull(order.submittedDate);
    const done = order.status === "APPROVED" || order.status === "REJECTED";
    const end = dayOrNull(order.decisionDate);

    if (start === null || (done && end === null)) {
      skipped += start === null ? 1 : 0;
      undated += start !== null ? 1 : 0;
      continue;
    }

    add({ id: `co-${order.id}`, stream: "changeOrders", reference: order.reference, title: order.title, amount: amountOf(order.submittedAmount), start, due: dayOrNull(order.decisionDueDate), end: done ? end : null, done });
  }

  for (const claim of data.claims ?? []) {
    if (claim.status === "DRAFT" || claim.status === "VOID") {
      continue;
    }

    const start = dayOrNull(claim.submittedDate);
    const done = claim.status === "APPROVED" || claim.status === "PARTIALLY_APPROVED" || claim.status === "REJECTED" || claim.status === "SETTLED";
    const end = dayOrNull(claim.decisionDate);

    if (start === null || (done && end === null)) {
      skipped += start === null ? 1 : 0;
      undated += start !== null ? 1 : 0;
      continue;
    }

    add({ id: `cl-${claim.id}`, stream: "claims", reference: claim.reference, title: claim.title, amount: amountOf(claim.claimedAmount), start, due: dayOrNull(claim.responseDueDate), end: done ? end : null, done });
  }

  for (const certificate of data.paymentCertificates ?? []) {
    if (certificate.status === "DRAFT" || certificate.status === "VOID" || certificate.status === "REJECTED") {
      continue;
    }

    const applied = dayOrNull(certificate.applicationDate);
    const certified = dayOrNull(certificate.certifiedDate);
    const isCertified = certificate.status !== "SUBMITTED";

    if (applied === null) {
      skipped += 1;
      continue;
    }

    if (isCertified && certified === null) {
      undated += 1;
      continue;
    }

    add({ id: `ap-${certificate.id}`, stream: "certification", reference: certificate.reference, title: periodTitle(certificate.periodEnd), amount: amountOf(certificate.applicationAmount), start: applied, due: dayOrNull(certificate.certificationDueDate), end: isCertified ? certified : null, done: isCertified });

    if (!isCertified || certified === null) {
      continue;
    }

    const outstanding = amountOf(certificate.outstandingAmount);
    const paidOff = outstanding <= 0.5;
    const paidOn = dayOrNull(certificate.lastPaymentDate);

    if (paidOff && paidOn === null) {
      undated += 1;
      continue;
    }

    add({ id: `pay-${certificate.id}`, stream: "payment", reference: certificate.reference, title: periodTitle(certificate.periodEnd), amount: paidOff ? amountOf(certificate.netCertifiedAmount) : outstanding, start: certified, due: dayOrNull(certificate.paymentDueDate), end: paidOff ? paidOn : null, done: paidOff });
  }

  return { cases, skipped, undated };
}

export function buildDecisions(data: CommercialControl, today: number, windowDays: number | null): DecisionResult {
  const { cases, skipped, undated } = collectCases(data, today);

  if (cases.length === 0 && skipped === 0 && undated === 0) {
    return { ok: false, reason: "empty" };
  }

  const since = windowDays === null ? -Infinity : today - windowDays;
  const streams: StreamStats[] = STREAMS.map((info) => {
    const mine = cases.filter((item) => item.stream === info.key);
    const done = mine.filter((item) => item.done && item.end !== null && item.end > since && item.end <= today);
    const pending = mine.filter((item) => !item.done);
    const dated = done.filter((item) => item.due !== null);
    const onTime = dated.filter((item) => (item.end as number) <= (item.due as number)).length;
    const lateDone = done.filter((item) => item.late > 0);
    const overdue = pending.filter((item) => item.late > 0);
    const took = done.map((item) => item.took as number);

    return {
      key: info.key,
      label: info.label,
      done,
      pending,
      count: done.length,
      median: median(took),
      p90: percentile(took, 0.9),
      dated: dated.length,
      onTime,
      rate: dated.length === 0 ? null : onTime / dated.length,
      lateCount: lateDone.length,
      avgLate: lateDone.length === 0 ? null : lateDone.reduce((sum, item) => sum + item.late, 0) / lateDone.length,
      pendingCount: pending.length,
      overdueCount: overdue.length,
      waitingValue: pending.reduce((sum, item) => sum + item.amount, 0),
      overdueValue: overdue.reduce((sum, item) => sum + item.amount, 0),
      oldestWait: pending.length === 0 ? null : Math.max(...pending.map((item) => item.wait)),
    };
  });

  const everyDone = streams.flatMap((stream) => stream.done);
  const everyPending = streams.flatMap((stream) => stream.pending);
  const dated = everyDone.filter((item) => item.due !== null);
  const onTime = dated.filter((item) => (item.end as number) <= (item.due as number)).length;
  const widest = Math.max(1, ...everyDone.map((item) => item.took as number), ...everyPending.map((item) => item.wait));
  const enough = streams.filter((stream) => stream.count >= MIN_SAMPLE && stream.median !== null);
  const rated = streams.filter((stream) => stream.dated >= MIN_SAMPLE && stream.rate !== null);

  return {
    ok: true,
    decisions: {
      streams,
      windowDays,
      scaleMax: niceScale(widest),
      pending: [...everyPending].sort((a, b) => b.late - a.late || b.wait - a.wait || b.amount - a.amount || a.reference.localeCompare(b.reference, undefined, { numeric: true })),
      slowest: [...everyDone].sort((a, b) => (b.took as number) - (a.took as number) || b.amount - a.amount).slice(0, LIST_LIMIT),
      count: everyDone.length,
      dated: dated.length,
      onTime,
      rate: dated.length === 0 ? null : onTime / dated.length,
      median: median(everyDone.map((item) => item.took as number)),
      pendingCount: everyPending.length,
      pendingValue: everyPending.reduce((sum, item) => sum + item.amount, 0),
      overdueCount: everyPending.filter((item) => item.late > 0).length,
      overdueValue: everyPending.filter((item) => item.late > 0).reduce((sum, item) => sum + item.amount, 0),
      slowestStream: [...enough].sort((a, b) => (b.median as number) - (a.median as number))[0] ?? null,
      leastOnTime: [...rated].sort((a, b) => (a.rate as number) - (b.rate as number))[0] ?? null,
      skipped,
      undated,
    },
  };
}

export function caseLine(item: Case): string {
  return `${item.reference} ${trunc(item.title, 50)}`;
}

export function decisionMarkdown(result: Decisions, projectName: string, today: number): string {
  const lines: string[] = [];
  const span = result.windowDays === null ? "everything decided to date" : `decisions made in the last ${windowLabel(result.windowDays).toLowerCase()}`;
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Decision times: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Waiting figures are as they stand today; turnaround figures cover ${span}.`, "");
  lines.push(
    `- Still waiting: ${result.pendingCount} (${money(result.pendingValue)}), of which ${result.overdueCount} past their due date (${money(result.overdueValue)})`,
    `- Decided in the period: ${result.count}, typically in ${daysText(result.median)}`,
    `- Decided by the due date: ${rateText(result.rate)}${result.dated > 0 ? ` of ${result.dated}` : ""}`,
    "",
  );

  lines.push("| Stream | Decided | Typical | 9 in 10 within | On time | Average days late | Waiting | Past due | Value waiting |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");

  for (const stream of result.streams) {
    lines.push(`| ${stream.label} | ${stream.count} | ${daysText(stream.median)} | ${daysText(stream.p90)} | ${rateText(stream.rate)} | ${daysText(stream.avgLate)} | ${stream.pendingCount} | ${stream.overdueCount} | ${money(stream.waitingValue)} |`);
  }

  lines.push("");

  const overdue = result.pending.filter((item) => item.late > 0).slice(0, LIST_LIMIT);

  if (overdue.length > 0) {
    lines.push("## Past their due date now", "");

    for (const item of overdue) {
      lines.push(`- ${cell(caseLine(item))} (${STREAM_LABEL[item.stream]}, ${money(item.amount)}): ${item.late} ${plural(item.late, "day", "days")} past due, waiting ${item.wait} ${plural(item.wait, "day", "days")}`);
    }

    lines.push("");
  }

  lines.push(
    "Turnaround runs in calendar days from the date submitted (or applied for, or certified) to the date it was decided (certified, paid in full). Decided by the due date means on or before the due date held in the system. A certificate counts as paid in full when nothing is outstanding and it has a last payment date. Drafts, void and rejected items are left out.",
    "",
  );

  if (result.undated > 0) {
    lines.push(`${result.undated} ${plural(result.undated, "item is", "items are")} missing a date needed to time ${plural(result.undated, "it", "them")} and ${plural(result.undated, "was", "were")} left out.`, "");
  }

  return lines.join("\n");
}
