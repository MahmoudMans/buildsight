import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { CommercialControl, PaymentCertificate, PaymentCertificateStatus } from "@/types/project";

export const TOLERANCE = 1;
export const RATE_TOLERANCE = 0.005;
export const MIN_RATED = 3;
export const MIN_GROUP = 3;
export const GOOD = 0.9;
export const WATCH = 0.7;
export const PAGE = 10;

export type Flag =
  | "periodReversed"
  | "periodOverlap"
  | "periodGap"
  | "netMismatch"
  | "paidMismatch"
  | "overpaid"
  | "certifiedAboveApplied"
  | "retentionOff"
  | "statusMismatch"
  | "dateOrder"
  | "duplicateRef";

export type Group = "periods" | "amounts" | "records";
export type Filter = "all" | "problem" | Group;

export const FLAG_ORDER: Flag[] = ["periodReversed", "periodOverlap", "periodGap", "netMismatch", "paidMismatch", "overpaid", "certifiedAboveApplied", "retentionOff", "statusMismatch", "dateOrder", "duplicateRef"];

export const GROUP_OF: Record<Flag, Group> = {
  periodReversed: "periods",
  periodOverlap: "periods",
  periodGap: "periods",
  netMismatch: "amounts",
  paidMismatch: "amounts",
  overpaid: "amounts",
  certifiedAboveApplied: "amounts",
  retentionOff: "amounts",
  statusMismatch: "records",
  dateOrder: "records",
  duplicateRef: "records",
};

export const GROUP_LABELS: Record<Group, string> = {
  periods: "Periods",
  amounts: "Amounts",
  records: "Status and dates",
};

export const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All certificates" },
  { key: "problem", label: "With a problem" },
  { key: "periods", label: "Periods" },
  { key: "amounts", label: "Amounts" },
  { key: "records", label: "Status and dates" },
];

export const CHECK_LABELS: Record<Flag, string> = {
  periodReversed: "Period dates missing or reversed",
  periodOverlap: "Period overlaps another certificate",
  periodGap: "Gap before the period",
  netMismatch: "Net is not certified less retention",
  paidMismatch: "Paid plus outstanding is not the net",
  overpaid: "Paid more than the net amount",
  certifiedAboveApplied: "Certified above the amount applied for",
  retentionOff: "Retention differs from the usual rate",
  statusMismatch: "Status disagrees with the amounts",
  dateOrder: "Dates in the wrong order",
  duplicateRef: "Reference used twice",
};

const CERTIFIED: ReadonlyArray<PaymentCertificateStatus> = ["CERTIFIED", "PARTIALLY_PAID", "PAID"];
const STATUS_ORDER: PaymentCertificateStatus[] = ["DRAFT", "SUBMITTED", "CERTIFIED", "PARTIALLY_PAID", "PAID", "REJECTED"];
const MONEY_FLAGS: ReadonlyArray<Flag> = ["netMismatch", "paidMismatch", "overpaid", "certifiedAboveApplied"];

export interface Row {
  key: string;
  reference: string;
  status: PaymentCertificateStatus;
  start: number | null;
  end: number | null;
  applied: number | null;
  application: number | null;
  certified: number | null;
  retention: number | null;
  retentionRate: number | null;
  net: number | null;
  paid: number | null;
  outstanding: number | null;
  netDiff: number | null;
  paidDiff: number | null;
  gapDays: number | null;
  overlapRef: string | null;
  overlapDays: number | null;
  statusNote: string | null;
  dateNote: string | null;
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
}

export interface Segment {
  kind: "period" | "overlap" | "gap";
  days: number;
  label: string;
}

export interface Coverage {
  from: number;
  to: number;
  span: number;
  covered: number;
  gapDays: number;
  doubleDays: number;
  segments: Segment[];
}

export interface Totals {
  applied: number;
  certified: number;
  retention: number;
  net: number;
  paid: number;
  outstanding: number;
  netGap: number;
  paidGap: number;
}

export interface Certificates {
  rows: Row[];
  checks: Check[];
  statuses: Grouping[];
  coverage: Coverage | null;
  totals: Totals;
  usualRate: number | null;
  live: number;
  voided: number;
  clean: number;
  cleanShare: number | null;
  withProblem: number;
  periodIssues: number;
  amountIssues: number;
  recordIssues: number;
  moneyWrong: number;
  moneyBase: number;
}

export type CertificateResult = { ok: true; data: Certificates } | { ok: false; reason: "noCertificates" | "allVoid" };

function before(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dayOrNull(value: string | null | undefined): number | null {
  const day = toDay(value);

  return Number.isFinite(day) ? day : null;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function rate(value: number): string {
  return `${Math.round(value * 1000) / 10}%`;
}

export function dayCount(count: number): string {
  return `${count} ${plural(count, "day", "days")}`;
}

export function eur(value: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

export function bandOf(share: number | null, base: number): "good" | "watch" | "bad" | null {
  if (share === null || base < MIN_GROUP) {
    return null;
  }

  return share >= GOOD ? "good" : share >= WATCH ? "watch" : "bad";
}

function lower(status: string): string {
  return status.replace(/_/g, " ").toLowerCase();
}

function usualRateOf(rates: number[]): number | null {
  if (rates.length < MIN_RATED) {
    return null;
  }

  const counts = new Map<number, number>();

  for (const value of rates) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  let best: { value: number; count: number } | null = null;

  for (const [value, count] of counts) {
    if (best === null || count > best.count || (count === best.count && value > best.value)) {
      best = { value, count };
    }
  }

  return best !== null && best.count / rates.length >= 0.5 ? best.value : null;
}

function statusNoteOf(c: PaymentCertificate, certified: number | null, certDay: number | null, paid: number | null, outstanding: number | null): string | null {
  const status = c.status;

  if (CERTIFIED.includes(status)) {
    if (certified === null) {
      return "Marked as certified but has no certified amount";
    }

    if (certDay === null) {
      return "Marked as certified but has no certified date";
    }
  }

  if (status === "PAID" && outstanding !== null && outstanding > TOLERANCE) {
    return `Marked as paid but ${eur(outstanding)} is still outstanding`;
  }

  if (status === "PARTIALLY_PAID" && paid !== null && paid <= 0) {
    return "Marked as partly paid but nothing is recorded as paid";
  }

  if (status === "PARTIALLY_PAID" && outstanding !== null && outstanding <= TOLERANCE) {
    return "Marked as partly paid but nothing is outstanding";
  }

  if ((status === "DRAFT" || status === "SUBMITTED" || status === "REJECTED") && paid !== null && paid > TOLERANCE) {
    return `Has ${eur(paid)} paid but is ${lower(status)}`;
  }

  if ((status === "DRAFT" || status === "SUBMITTED") && certDay !== null) {
    return `Has a certified date but is still ${lower(status)}`;
  }

  return null;
}

function dateNoteOf(app: number | null, dueCert: number | null, certDay: number | null, payDue: number | null, start: number | null): string | null {
  if (dueCert !== null && app !== null && dueCert < app) {
    return "Certification is due before it was applied for";
  }

  if (certDay !== null && app !== null && certDay < app) {
    return "Certified before it was applied for";
  }

  if (payDue !== null && certDay !== null && payDue < certDay) {
    return "Payment is due before it was certified";
  }

  if (app !== null && start !== null && app < start) {
    return "Applied for before its period started";
  }

  return null;
}

export function buildCertificates(data: CommercialControl): CertificateResult {
  const all: PaymentCertificate[] = data.paymentCertificates ?? [];

  if (all.length === 0) {
    return { ok: false, reason: "noCertificates" };
  }

  const live = all.filter((item) => item.status !== "VOID");
  const voided = all.length - live.length;

  if (live.length === 0) {
    return { ok: false, reason: "allVoid" };
  }

  const references = new Map<string, number>();

  for (const item of live) {
    const key = item.reference.trim().toLowerCase();

    references.set(key, (references.get(key) ?? 0) + 1);
  }

  const base = live.map((item) => {
    const start = dayOrNull(item.periodStart);
    const end = dayOrNull(item.periodEnd);
    const hasPeriod = start !== null && end !== null && end >= start;

    return {
      item,
      start: hasPeriod ? start : null,
      end: hasPeriod ? end : null,
      isCertified: CERTIFIED.includes(item.status),
      application: num(item.applicationAmount),
      certified: num(item.certifiedAmount),
      retention: num(item.retentionAmount),
      net: num(item.netCertifiedAmount),
      paid: num(item.amountPaid),
      outstanding: num(item.outstandingAmount),
      app: dayOrNull(item.applicationDate),
      dueCert: dayOrNull(item.certificationDueDate),
      certDay: dayOrNull(item.certifiedDate),
      payDue: dayOrNull(item.paymentDueDate),
    };
  });

  const ratedRates = base
    .filter((entry) => entry.isCertified && entry.certified !== null && entry.certified > 0)
    .map((entry) => Math.round(((entry.retention ?? 0) / (entry.certified as number)) * 1000) / 1000);
  const usual = usualRateOf(ratedRates);

  const spans = base
    .filter((entry) => entry.start !== null && entry.end !== null)
    .sort((a, b) => (a.start as number) - (b.start as number) || (a.end as number) - (b.end as number) || before(a.item.reference, b.item.reference) || before(a.item.id, b.item.id));

  const overlap = new Map<string, { ref: string; days: number }>();
  const gaps = new Map<string, number>();
  const segments: Segment[] = [];
  let cursor: number | null = null;
  let covered = 0;
  let doubleDays = 0;
  let gapTotal = 0;

  for (let i = 0; i < spans.length; i += 1) {
    const current = spans[i] as (typeof spans)[number];
    const start = current.start as number;
    const end = current.end as number;

    for (let j = 0; j < i; j += 1) {
      const other = spans[j] as (typeof spans)[number];

      if ((other.end as number) >= start) {
        const days = Math.min(end, other.end as number) - start + 1;

        if (!overlap.has(current.item.id)) {
          overlap.set(current.item.id, { ref: other.item.reference, days });
        }

        if (!overlap.has(other.item.id)) {
          overlap.set(other.item.id, { ref: current.item.reference, days });
        }
      }
    }

    if (cursor !== null && start > cursor + 1) {
      const gap = start - cursor - 1;

      gaps.set(current.item.id, gap);
      gapTotal += gap;
      segments.push({ kind: "gap", days: gap, label: `${dayCount(gap)} with no certificate, ${formatDay(cursor + 1)} to ${formatDay(start - 1)}` });
    }

    const visibleFrom = cursor === null ? start : Math.max(start, cursor + 1);
    const visible = end - visibleFrom + 1;
    const length = end - start + 1;

    covered += Math.max(0, visible);
    doubleDays += length - Math.max(0, visible);

    if (visible > 0) {
      segments.push({ kind: overlap.has(current.item.id) ? "overlap" : "period", days: visible, label: `${current.item.reference}, ${formatDay(start)} to ${formatDay(end)}` });
    }

    cursor = cursor === null ? end : Math.max(cursor, end);
  }

  const rows: Row[] = [];

  for (const entry of base) {
    const { item } = entry;
    const flags: Flag[] = [];
    const rowRate = entry.isCertified && entry.certified !== null && entry.certified > 0 ? Math.round(((entry.retention ?? 0) / entry.certified) * 1000) / 1000 : null;
    const netDiff = entry.isCertified && entry.certified !== null && entry.net !== null ? entry.net - (entry.certified - (entry.retention ?? 0)) : null;
    const paidDiff = entry.isCertified && entry.net !== null && entry.paid !== null && entry.outstanding !== null ? entry.paid + entry.outstanding - entry.net : null;
    const statusNote = statusNoteOf(item, entry.certified, entry.certDay, entry.paid, entry.outstanding);
    const dateNote = dateNoteOf(entry.app, entry.dueCert, entry.certDay, entry.payDue, entry.start);
    const over = overlap.get(item.id) ?? null;

    if (entry.start === null) {
      flags.push("periodReversed");
    }

    if (over !== null) {
      flags.push("periodOverlap");
    }

    if (gaps.has(item.id)) {
      flags.push("periodGap");
    }

    if (netDiff !== null && Math.abs(netDiff) > TOLERANCE) {
      flags.push("netMismatch");
    }

    if (paidDiff !== null && Math.abs(paidDiff) > TOLERANCE) {
      flags.push("paidMismatch");
    }

    if (entry.isCertified && entry.net !== null && entry.paid !== null && entry.paid > entry.net + TOLERANCE) {
      flags.push("overpaid");
    }

    if (entry.isCertified && entry.certified !== null && entry.application !== null && entry.certified > entry.application + TOLERANCE) {
      flags.push("certifiedAboveApplied");
    }

    if (usual !== null && rowRate !== null && Math.abs(rowRate - usual) > RATE_TOLERANCE) {
      flags.push("retentionOff");
    }

    if (statusNote !== null) {
      flags.push("statusMismatch");
    }

    if (dateNote !== null) {
      flags.push("dateOrder");
    }

    if ((references.get(item.reference.trim().toLowerCase()) ?? 0) > 1) {
      flags.push("duplicateRef");
    }

    const ordered = FLAG_ORDER.filter((flag) => flags.includes(flag));

    rows.push({
      key: item.id,
      reference: item.reference,
      status: item.status,
      start: entry.start,
      end: entry.end,
      applied: entry.app,
      application: entry.application,
      certified: entry.certified,
      retention: entry.retention,
      retentionRate: rowRate,
      net: entry.net,
      paid: entry.paid,
      outstanding: entry.outstanding,
      netDiff,
      paidDiff,
      gapDays: gaps.get(item.id) ?? null,
      overlapRef: over?.ref ?? null,
      overlapDays: over?.days ?? null,
      statusNote,
      dateNote,
      flags: ordered,
      serious: ordered.some((flag) => MONEY_FLAGS.includes(flag)),
    });
  }

  const startOf = (row: Row) => row.start ?? Number.POSITIVE_INFINITY;

  rows.sort((a, b) => Number(b.serious) - Number(a.serious) || b.flags.length - a.flags.length || (startOf(a) === startOf(b) ? 0 : startOf(a) < startOf(b) ? -1 : 1) || before(a.reference, b.reference) || before(a.key, b.key));

  const certifiedRows = rows.filter((row) => CERTIFIED.includes(row.status));
  const ratedRows = certifiedRows.filter((row) => row.retentionRate !== null);

  const baseOf = (flag: Flag): number => {
    if (flag === "retentionOff") {
      return usual === null ? 0 : ratedRows.length;
    }

    return GROUP_OF[flag] === "amounts" ? certifiedRows.length : rows.length;
  };

  const checks: Check[] = FLAG_ORDER.map((flag) => {
    const count = rows.filter((row) => row.flags.includes(flag)).length;
    const total = baseOf(flag);

    return { flag, label: CHECK_LABELS[flag], group: GROUP_OF[flag], count, base: total, share: total > 0 ? count / total : null };
  });

  const statuses: Grouping[] = STATUS_ORDER.filter((status) => rows.some((row) => row.status === status)).map((status) => {
    const part = rows.filter((row) => row.status === status);
    const clean = part.filter((row) => row.flags.length === 0).length;

    return { key: status, label: status === "PARTIALLY_PAID" ? "Partly paid" : `${status.charAt(0)}${status.slice(1).toLowerCase()}`, count: part.length, clean, cleanShare: part.length > 0 ? clean / part.length : null };
  });

  const sum = (pick: (row: Row) => number | null, from: Row[] = rows): number => from.reduce((total, row) => total + (pick(row) ?? 0), 0);
  const hasGroup = (row: Row, group: Group) => row.flags.some((flag) => GROUP_OF[flag] === group);
  const clean = rows.filter((row) => row.flags.length === 0).length;

  return {
    ok: true,
    data: {
      rows,
      checks,
      statuses,
      coverage:
        cursor === null || spans.length === 0
          ? null
          : {
              from: (spans[0] as (typeof spans)[number]).start as number,
              to: cursor,
              span: cursor - ((spans[0] as (typeof spans)[number]).start as number) + 1,
              covered,
              gapDays: gapTotal,
              doubleDays,
              segments,
            },
      totals: {
        applied: sum((row) => row.application),
        certified: sum((row) => row.certified),
        retention: sum((row) => row.retention),
        net: sum((row) => row.net),
        paid: sum((row) => row.paid),
        outstanding: sum((row) => row.outstanding),
        netGap: sum((row) => row.netDiff),
        paidGap: sum((row) => row.paidDiff),
      },
      usualRate: usual,
      live: rows.length,
      voided,
      clean,
      cleanShare: rows.length > 0 ? clean / rows.length : null,
      withProblem: rows.length - clean,
      periodIssues: rows.filter((row) => hasGroup(row, "periods")).length,
      amountIssues: rows.filter((row) => hasGroup(row, "amounts")).length,
      recordIssues: rows.filter((row) => hasGroup(row, "records")).length,
      moneyWrong: rows.filter((row) => row.serious).length,
      moneyBase: certifiedRows.length,
    },
  };
}

export function filterRows(rows: Row[], filter: Filter): Row[] {
  if (filter === "problem") {
    return rows.filter((row) => row.flags.length > 0);
  }

  if (filter === "periods" || filter === "amounts" || filter === "records") {
    return rows.filter((row) => row.flags.some((flag) => GROUP_OF[flag] === filter));
  }

  return rows;
}

function more(value: number, same: string, up: string, down: string): string {
  return `${eur(Math.abs(value))} ${value > 0 ? up : value < 0 ? down : same}`;
}

export function flagText(flag: Flag, row: Row, usual: number | null): string {
  if (flag === "periodReversed") {
    return "Period dates missing or reversed";
  }

  if (flag === "periodOverlap") {
    return `Period overlaps ${row.overlapRef ?? "another certificate"}${row.overlapDays !== null ? ` by ${dayCount(row.overlapDays)}` : ""}`;
  }

  if (flag === "periodGap") {
    return `${dayCount(row.gapDays ?? 0)} with no certificate before it`;
  }

  if (flag === "netMismatch") {
    return `Net is ${more(row.netDiff ?? 0, "equal to", "more than", "less than")} certified less retention`;
  }

  if (flag === "paidMismatch") {
    return `Paid plus outstanding is ${more(row.paidDiff ?? 0, "equal to", "more than", "less than")} the net`;
  }

  if (flag === "overpaid") {
    return `Paid ${eur(Math.max(0, (row.paid ?? 0) - (row.net ?? 0)))} more than the net amount`;
  }

  if (flag === "certifiedAboveApplied") {
    return `Certified ${eur(Math.max(0, (row.certified ?? 0) - (row.application ?? 0)))} above the amount applied for`;
  }

  if (flag === "retentionOff") {
    return `Retention is ${rate(row.retentionRate ?? 0)}${usual !== null ? ` where most hold ${rate(usual)}` : ""}`;
  }

  if (flag === "statusMismatch") {
    return row.statusNote ?? "Status disagrees with the amounts";
  }

  if (flag === "dateOrder") {
    return row.dateNote ?? "Dates in the wrong order";
  }

  return "Reference used by another certificate";
}

export function certificatesMarkdown(data: Certificates, shown: Row[], projectName: string, filterLabel: string | null): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Payment certificate checks: ${projectName}`, "");
  lines.push(`${data.live} ${plural(data.live, "certificate", "certificates")} checked${data.voided > 0 ? `; ${data.voided} void ${plural(data.voided, "certificate is", "certificates are")} left out` : ""}.`, "");
  lines.push(`- ${data.clean} of ${data.live} have nothing to fix (${pct(data.cleanShare)})`);
  lines.push(`- ${data.periodIssues} with a period problem, ${data.amountIssues} with an amount problem, ${data.recordIssues} with a status or date problem`);
  lines.push(`- ${data.moneyWrong} of ${data.moneyBase} certified ${plural(data.moneyBase, "certificate has", "certificates have")} amounts that do not add up`);

  if (data.coverage) {
    lines.push(`- Periods run from ${formatDay(data.coverage.from)} to ${formatDay(data.coverage.to)}: ${dayCount(data.coverage.gapDays)} with no certificate, ${dayCount(data.coverage.doubleDays)} covered twice`);
  }

  lines.push("");
  lines.push("| Check | Certificates | Out of |", "| --- | ---: | ---: |");

  for (const check of data.checks) {
    lines.push(`| ${check.label} | ${check.count} | ${check.base} |`);
  }

  lines.push("");

  if (shown.length > 0) {
    lines.push(filterLabel ? `Certificates (${filterLabel.toLowerCase()}):` : "Certificates:", "", "| Reference | Status | Period | Certified | Problems |", "| --- | --- | --- | ---: | --- |");

    for (const row of shown.slice(0, 25)) {
      const period = row.start !== null && row.end !== null ? `${formatDay(row.start)} to ${formatDay(row.end)}` : "—";

      lines.push(`| ${cell(trunc(row.reference, 24))} | ${lower(row.status)} | ${period} | ${row.certified !== null ? eur(row.certified) : "—"} | ${row.flags.map((flag) => flagText(flag, row, data.usualRate)).join(", ") || "—"} |`);
    }

    lines.push("");
  }

  lines.push(
    `Void certificates are not checked. Amounts are compared to the nearest ${eur(TOLERANCE)}. Net should equal the certified amount less retention, and paid plus outstanding should equal the net. A gap is any run of days between two certificate periods that no certificate covers. The usual retention rate is the one most certified certificates share (at least ${MIN_RATED} are needed and at least half must agree); retention is flagged when it differs from that by more than ${Math.round(RATE_TOLERANCE * 1000) / 10} percentage points.`,
    "",
  );

  return lines.join("\n");
}
