import { toDay, words } from "@/lib/openItems";
import type { DocumentControl, DocumentRevision, ProjectDocument } from "@/types/project";

export type DocStatus = "DRAFT" | "FOR_REVIEW" | "ISSUED" | "APPROVED" | "SUPERSEDED" | "NONE";

export const REVIEW_STALE_DAYS = 14;
export const DRAFT_STALE_DAYS = 30;
export const HEAVY_REVISIONS = 4;
export const MONTHS = 12;

export const STATUS_ORDER: ReadonlyArray<DocStatus> = ["APPROVED", "ISSUED", "FOR_REVIEW", "DRAFT", "SUPERSEDED", "NONE"];

export const STATUS_LABEL: Record<DocStatus, string> = {
  APPROVED: "Approved",
  ISSUED: "Issued",
  FOR_REVIEW: "In review",
  DRAFT: "Draft",
  SUPERSEDED: "Superseded",
  NONE: "No revision",
};

export interface DocRow {
  doc: ProjectDocument;
  revisions: DocumentRevision[];
  latest: DocumentRevision | null;
  status: DocStatus;
  revisionCount: number;
  age: number;
  ready: boolean;
}

export interface DisciplineRow {
  key: string;
  label: string;
  total: number;
  counts: Record<DocStatus, number>;
  readyPct: number;
}

export interface DuplicateGroup {
  hash: string;
  revisions: DocumentRevision[];
  documents: string[];
}

export interface MonthBucket {
  start: number;
  label: string;
  count: number;
}

export interface DocumentModel {
  rows: DocRow[];
  disciplines: DisciplineRow[];
  stuck: DocRow[];
  none: DocRow[];
  heavy: DocRow[];
  duplicates: DuplicateGroup[];
  unreadable: DocRow[];
  months: MonthBucket[];
  readyPct: number;
  review: number;
  drawings: number;
  textShare: number;
  totalBytes: number;
  averageRevisions: number;
  haveRevisions: boolean;
}

const KNOWN = new Set<string>(["DRAFT", "FOR_REVIEW", "ISSUED", "APPROVED", "SUPERSEDED"]);

function asStatus(value: string | null | undefined): DocStatus {
  const key = (value ?? "").trim().toUpperCase().replace(/\s+/g, "_");

  return KNOWN.has(key) ? (key as DocStatus) : "NONE";
}

function emptyCounts(): Record<DocStatus, number> {
  return { APPROVED: 0, ISSUED: 0, FOR_REVIEW: 0, DRAFT: 0, SUPERSEDED: 0, NONE: 0 };
}

function monthStart(day: number): number {
  const date = new Date(day * 86_400_000);

  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 86_400_000);
}

function monthsBack(day: number, count: number): number {
  const date = new Date(day * 86_400_000);

  return Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - count, 1) / 86_400_000);
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ACRONYMS = new Set(["MEP", "HSE"]);

function disciplineLabel(key: string): string {
  return ACRONYMS.has(key.trim().toUpperCase()) ? key.trim().toUpperCase() : words(key);
}

function monthLabel(day: number): string {
  const date = new Date(day * 86_400_000);
  const month = MONTH_NAMES[date.getUTCMonth()] ?? "";

  return date.getUTCMonth() === 0 ? `${month} ’${String(date.getUTCFullYear()).slice(2)}` : month;
}

export function buildDocuments(data: DocumentControl, today: number): DocumentModel {
  const documents = data.documents ?? [];
  const revisions = data.revisions ?? [];

  const byDocument = new Map<string, DocumentRevision[]>();

  for (const revision of revisions) {
    byDocument.set(revision.documentId, [...(byDocument.get(revision.documentId) ?? []), revision]);
  }

  const rows = documents.map((doc): DocRow => {
    const own = [...(byDocument.get(doc.id) ?? [])].sort(
      (a, b) => toDay(b.issuedDate) - toDay(a.issuedDate) || b.createdAt.localeCompare(a.createdAt),
    );

    const latest = own[0] ?? null;
    const status = latest ? asStatus(latest.revisionStatus) : asStatus(doc.latestRevisionStatus);
    const issued = latest ? toDay(latest.issuedDate) : NaN;

    return {
      doc,
      revisions: own,
      latest,
      status,
      revisionCount: Math.max(doc.revisionCount ?? 0, own.length),
      age: Number.isFinite(issued) ? today - issued : NaN,
      ready: status === "APPROVED" || status === "ISSUED",
    };
  });

  const bucket = new Map<string, DisciplineRow>();

  for (const row of rows) {
    const key = row.doc.discipline;

    const entry = bucket.get(key) ?? { key, label: disciplineLabel(key), total: 0, counts: emptyCounts(), readyPct: 0 };

    entry.total += 1;
    entry.counts[row.status] += 1;
    bucket.set(key, entry);
  }

  const disciplines = [...bucket.values()]
    .map((entry) => ({ ...entry, readyPct: entry.total > 0 ? ((entry.counts.APPROVED + entry.counts.ISSUED) / entry.total) * 100 : NaN }))
    .sort((a, b) => a.readyPct - b.readyPct || b.total - a.total || a.label.localeCompare(b.label));

  const haveRevisions = revisions.length > 0;

  const stuck = rows
    .filter((row) => Number.isFinite(row.age) && ((row.status === "FOR_REVIEW" && row.age > REVIEW_STALE_DAYS) || (row.status === "DRAFT" && row.age > DRAFT_STALE_DAYS)))
    .sort((a, b) => b.age - a.age || a.doc.documentNumber.localeCompare(b.doc.documentNumber));

  const none = rows.filter((row) => row.status === "NONE" && row.revisionCount === 0).sort((a, b) => a.doc.documentNumber.localeCompare(b.doc.documentNumber));

  const heavy = rows
    .filter((row) => row.revisionCount >= HEAVY_REVISIONS)
    .sort((a, b) => b.revisionCount - a.revisionCount || a.doc.documentNumber.localeCompare(b.doc.documentNumber));

  const hashes = new Map<string, DocumentRevision[]>();

  for (const revision of revisions) {
    if (revision.sha256 && revision.sha256.trim() !== "") {
      hashes.set(revision.sha256, [...(hashes.get(revision.sha256) ?? []), revision]);
    }
  }

  const duplicates = [...hashes.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([hash, list]) => ({
      hash,
      revisions: list,
      documents: [...new Set(list.map((item) => item.documentNumber))].sort(),
    }))
    .sort((a, b) => b.revisions.length - a.revisions.length || a.hash.localeCompare(b.hash));

  const unreadable = rows
    .filter((row) => row.latest !== null && row.latest.extractedCharacterCount === 0)
    .sort((a, b) => a.doc.documentNumber.localeCompare(b.doc.documentNumber));

  const first = monthStart(today);
  const months: MonthBucket[] = Array.from({ length: MONTHS }, (_, index) => {
    const start = monthsBack(first, MONTHS - 1 - index);

    return { start, label: monthLabel(start), count: 0 };
  });

  for (const revision of revisions) {
    const day = toDay(revision.issuedDate);

    if (!Number.isFinite(day)) {
      continue;
    }

    const start = monthStart(day);
    const hit = months.find((item) => item.start === start);

    if (hit) {
      hit.count += 1;
    }
  }

  const readyCount = rows.filter((row) => row.ready).length;
  const withText = revisions.filter((item) => item.extractedCharacterCount > 0).length;

  return {
    rows,
    disciplines,
    stuck,
    none,
    heavy,
    duplicates,
    unreadable,
    months,
    readyPct: rows.length > 0 ? (readyCount / rows.length) * 100 : NaN,
    review: rows.filter((row) => row.status === "FOR_REVIEW").length,
    drawings: rows.filter((row) => row.doc.documentType === "DRAWING").length,
    textShare: revisions.length > 0 ? (withText / revisions.length) * 100 : NaN,
    totalBytes: revisions.reduce((sum, item) => sum + (Number.isFinite(item.fileSize) ? item.fileSize : 0), 0),
    averageRevisions: rows.length > 0 ? rows.reduce((sum, row) => sum + row.revisionCount, 0) / rows.length : NaN,
    haveRevisions,
  };
}

export function fileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let index = 0;

  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }

  return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}
