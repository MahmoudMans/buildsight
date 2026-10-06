import { formatDay, plural, toDay, trunc } from "@/lib/openItems";
import type { DocumentControl, DocumentDiscipline, DocumentRevisionStatus } from "@/types/project";

export const WINDOWS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: "3 months" },
  { days: 180, label: "6 months" },
  { days: 365, label: "12 months" },
];

export const DEFAULT_WINDOW = 90;
export const GRACE = 7;
export const PAGE = 10;

export type Show = "action" | "all";

export const SHOWS: ReadonlyArray<{ key: Show; label: string }> = [
  { key: "action", label: "Not sent" },
  { key: "all", label: "All revisions" },
];

export const DISCIPLINE_LABEL: Record<DocumentDiscipline, string> = {
  ARCHITECTURAL: "Architectural",
  STRUCTURAL: "Structural",
  CIVIL: "Civil",
  MEP: "MEP",
  COMMERCIAL: "Commercial",
  PLANNING: "Planning",
  HSE: "HSE",
  QUALITY: "Quality",
  GENERAL: "General",
};

export type State = "sent" | "drafted" | "unsent";

export interface DraftRef {
  reference: string;
  recipient: string;
  age: number;
}

export interface Rev {
  id: string;
  number: string;
  title: string;
  code: string;
  status: DocumentRevisionStatus;
  discipline: DocumentDiscipline | null;
  issued: number;
  age: number;
  state: State;
  late: boolean;
  sentOn: number | null;
  sentTo: string[];
  drafts: DraftRef[];
}

export interface Draft {
  id: string;
  reference: string;
  recipient: string;
  purpose: string;
  date: number;
  age: number;
  revisions: number;
  stale: boolean;
  empty: boolean;
}

export interface Recipient {
  key: string;
  name: string;
  transmittals: number;
  revisions: number;
  last: number;
  purposes: string[];
}

export interface DisciplineRow {
  key: string;
  label: string;
  total: number;
  sent: number;
  drafted: number;
  unsent: number;
}

export interface Coverage {
  revs: Rev[];
  total: number;
  sent: number;
  drafted: number;
  unsent: number;
  late: number;
  sentRate: number | null;
  disciplines: DisciplineRow[];
  drafts: Draft[];
  staleDrafts: number;
  issuedTransmittals: number;
  avgIssueDays: number | null;
  slowest: number | null;
  recipients: Recipient[];
  emptyTransmittals: number;
  dangling: number;
  from: number;
  to: number;
  windowDays: number;
  skipped: number;
}

export type CoverageResult = { ok: true; coverage: Coverage } | { ok: false; reason: "empty" };

const SENDABLE: ReadonlyArray<DocumentRevisionStatus> = ["ISSUED", "APPROVED"];

function recipientKey(name: string | null | undefined): string {
  return (name ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

export function buildCoverage(data: DocumentControl, today: number, windowDays: number): CoverageResult {
  const revisions = data.revisions ?? [];
  const transmittals = data.transmittals ?? [];

  if (revisions.length === 0 && transmittals.length === 0) {
    return { ok: false, reason: "empty" };
  }

  const from = today - windowDays + 1;
  const documents = new Map((data.documents ?? []).map((doc) => [doc.id, doc]));
  const known = new Set(revisions.map((rev) => rev.id));
  let skipped = 0;

  const issuedOn = new Map<string, Array<{ recipient: string; on: number }>>();
  const draftedIn = new Map<string, DraftRef[]>();
  const drafts: Draft[] = [];
  const dangling = new Set<string>();
  const recipients = new Map<string, Recipient & { ids: Set<string> }>();
  const latencies: number[] = [];
  let issuedTransmittals = 0;
  let emptyTransmittals = 0;

  for (const raw of transmittals) {
    const dated = toDay(raw.transmittalDate);
    const issuedDay = toDay(raw.issuedDate);
    const date = Number.isFinite(dated) ? dated : raw.status === "ISSUED" ? issuedDay : Number.NaN;

    if (!Number.isFinite(date)) {
      skipped += 1;
      continue;
    }

    const ids = [...new Set(raw.revisionIds ?? [])];
    const recipient = (raw.recipient ?? "").trim() || "No recipient";
    const effective = raw.status === "ISSUED" ? (Number.isFinite(issuedDay) ? issuedDay : date) : date;

    if (raw.status === "DRAFT") {
      const age = Math.max(0, today - date);

      drafts.push({ id: raw.id, reference: raw.reference, recipient, purpose: raw.purpose, date, age, revisions: ids.length, stale: age > GRACE, empty: ids.length === 0 });

      for (const id of ids) {
        const list = draftedIn.get(id) ?? [];

        list.push({ reference: raw.reference, recipient, age });
        draftedIn.set(id, list);
      }

      continue;
    }

    for (const id of ids) {
      const list = issuedOn.get(id) ?? [];

      list.push({ recipient, on: effective });
      issuedOn.set(id, list);
    }

    if (date < from || date > today) {
      continue;
    }

    issuedTransmittals += 1;

    if (ids.length === 0) {
      emptyTransmittals += 1;
    }

    for (const id of ids) {
      if (!known.has(id)) {
        dangling.add(id);
      }
    }

    if (Number.isFinite(issuedDay)) {
      latencies.push(Math.max(0, issuedDay - date));
    }

    const key = recipientKey(recipient);
    const entry = recipients.get(key) ?? { key, name: recipient, transmittals: 0, revisions: 0, last: effective, purposes: [], ids: new Set<string>() };

    entry.transmittals += 1;
    entry.last = Math.max(entry.last, effective);

    for (const id of ids) {
      entry.ids.add(id);
    }

    const purpose = (raw.purpose ?? "").trim();

    if (purpose !== "" && !entry.purposes.some((item) => item.toLowerCase() === purpose.toLowerCase())) {
      entry.purposes.push(purpose);
    }

    recipients.set(key, entry);
  }

  const revs: Rev[] = [];

  for (const raw of revisions) {
    if (!SENDABLE.includes(raw.revisionStatus)) {
      continue;
    }

    const issued = toDay(raw.issuedDate);

    if (!Number.isFinite(issued)) {
      skipped += 1;
      continue;
    }

    if (issued < from || issued > today) {
      continue;
    }

    const sentList = (issuedOn.get(raw.id) ?? []).sort((a, b) => a.on - b.on);
    const draftList = draftedIn.get(raw.id) ?? [];
    const state: State = sentList.length > 0 ? "sent" : draftList.length > 0 ? "drafted" : "unsent";
    const age = today - issued;
    const doc = documents.get(raw.documentId);

    revs.push({
      id: raw.id,
      number: raw.documentNumber,
      title: raw.documentTitle,
      code: raw.revisionCode,
      status: raw.revisionStatus,
      discipline: doc ? doc.discipline : null,
      issued,
      age,
      state,
      late: state !== "sent" && age > GRACE,
      sentOn: sentList[0]?.on ?? null,
      sentTo: [...new Map(sentList.map((item) => [recipientKey(item.recipient), item.recipient] as const)).values()],
      drafts: draftList,
    });
  }

  const weight: Record<State, number> = { unsent: 0, drafted: 1, sent: 2 };

  revs.sort((a, b) => weight[a.state] - weight[b.state] || b.age - a.age || a.number.localeCompare(b.number, undefined, { numeric: true }));
  drafts.sort((a, b) => b.age - a.age || a.reference.localeCompare(b.reference, undefined, { numeric: true }));

  const byDiscipline = new Map<string, DisciplineRow>();

  for (const rev of revs) {
    const key = rev.discipline ?? "UNKNOWN";
    const row = byDiscipline.get(key) ?? { key, label: rev.discipline ? DISCIPLINE_LABEL[rev.discipline] : "Document not found", total: 0, sent: 0, drafted: 0, unsent: 0 };

    row.total += 1;
    row[rev.state] += 1;
    byDiscipline.set(key, row);
  }

  const sent = revs.filter((rev) => rev.state === "sent").length;
  const drafted = revs.filter((rev) => rev.state === "drafted").length;
  const unsent = revs.filter((rev) => rev.state === "unsent").length;

  return {
    ok: true,
    coverage: {
      revs,
      total: revs.length,
      sent,
      drafted,
      unsent,
      late: revs.filter((rev) => rev.late).length,
      sentRate: revs.length > 0 ? sent / revs.length : null,
      disciplines: [...byDiscipline.values()].sort((a, b) => b.unsent + b.drafted - (a.unsent + a.drafted) || b.total - a.total || Number(a.key === "UNKNOWN") - Number(b.key === "UNKNOWN") || a.label.localeCompare(b.label)),
      drafts,
      staleDrafts: drafts.filter((draft) => draft.stale).length,
      issuedTransmittals,
      avgIssueDays: latencies.length > 0 ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length : null,
      slowest: latencies.length > 0 ? Math.max(...latencies) : null,
      recipients: [...recipients.values()]
        .map(({ ids, ...rest }) => ({ ...rest, revisions: ids.size }))
        .sort((a, b) => b.transmittals - a.transmittals || b.last - a.last || a.name.localeCompare(b.name)),
      emptyTransmittals,
      dangling: dangling.size,
      from,
      to: today,
      windowDays,
      skipped,
    },
  };
}

export function filterRevs(list: Rev[], show: Show): Rev[] {
  return show === "action" ? list.filter((rev) => rev.state !== "sent") : list;
}

export function pct(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function daysText(count: number): string {
  return `${count} ${plural(count, "day", "days")}`;
}

export function whereText(rev: Rev): string {
  if (rev.state === "sent") {
    return `Sent to ${rev.sentTo.join(", ")}${rev.sentOn !== null ? ` on ${formatDay(rev.sentOn)}` : ""}`;
  }

  if (rev.state === "drafted") {
    const first = rev.drafts[0];

    return first ? `In draft ${first.reference} for ${first.recipient}, not issued` : "In a draft transmittal, not issued";
  }

  return "Not on any transmittal";
}

export function coverageMarkdown(coverage: Coverage, list: Rev[], projectName: string, today: number, windowLabel: string): string {
  const lines: string[] = [];
  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  lines.push(`# Transmittal coverage: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Revisions issued in the last ${windowLabel}, ${formatDay(coverage.from)} to ${formatDay(coverage.to)}.`, "");
  lines.push(`- ${coverage.total} issued or approved ${plural(coverage.total, "revision", "revisions")}: ${coverage.sent} sent on an issued transmittal (${pct(coverage.sentRate)}), ${coverage.drafted} only in a draft transmittal, ${coverage.unsent} on no transmittal`);
  lines.push(`- ${coverage.late} ${plural(coverage.late, "revision has", "revisions have")} waited more than ${GRACE} days without being sent`);
  lines.push(`- ${coverage.drafts.length} draft ${plural(coverage.drafts.length, "transmittal", "transmittals")}, ${coverage.staleDrafts} older than ${GRACE} days`);

  if (coverage.avgIssueDays !== null) {
    lines.push(`- Transmittals take ${coverage.avgIssueDays.toFixed(1)} days on average from being dated to being issued, the slowest ${daysText(coverage.slowest ?? 0)}`);
  }

  lines.push("");

  if (list.length > 0) {
    lines.push("| Document | Revision | Status | Issued | Age | Where it stands |", "| --- | --- | --- | --- | ---: | --- |");

    for (const rev of list) {
      lines.push(`| ${cell(rev.number)} ${cell(trunc(rev.title, 45))} | ${cell(rev.code)} | ${rev.status === "APPROVED" ? "Approved" : "Issued"} | ${formatDay(rev.issued)} | ${daysText(rev.age)} | ${cell(whereText(rev))} |`);
    }

    lines.push("");
  }

  lines.push(
    `A revision is counted when its status is issued or approved and it was issued in the period; drafts, revisions in review and superseded revisions are left out. It is sent when it appears on a transmittal with the issued status, and only drafted when it appears on draft transmittals alone. A revision waiting more than ${GRACE} days is shown as late. Recipients are matched on the name as typed, ignoring case.`,
    "",
  );

  return lines.join("\n");
}
