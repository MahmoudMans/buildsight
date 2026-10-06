import { STREAMS, type StreamKey } from "@/lib/backlog";
import { MIN_SAMPLE, collectRecords, daysText, median, rateText, windowLabel, type Rec } from "@/lib/closureSpeed";
import { formatDay, plural, trunc, type Sources } from "@/lib/openItems";

export const GOOD_RATE = 0.85;
export const FAIR_RATE = 0.6;
export const LIST_LIMIT = 6;

export type Rating = "dependable" | "mixed" | "late" | "unrated";
export type SortKey = "overdue" | "rate" | "closed" | "name";

export const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "overdue", label: "Overdue now" },
  { key: "rate", label: "Lowest record" },
  { key: "closed", label: "Most closed" },
  { key: "name", label: "Name" },
];

export const RATING_LABEL: Record<Rating, string> = {
  dependable: "Dependable",
  mixed: "Mixed",
  late: "Often late",
  unrated: "Too few to rate",
};

export interface StreamSplit {
  stream: StreamKey;
  label: string;
  color: string;
  closed: number;
  dated: number;
  onTime: number;
  open: number;
  overdue: number;
}

export type Tagged = Rec & { stream: StreamKey };

export interface OwnerStats {
  key: string;
  name: string;
  closed: number;
  dated: number;
  onTime: number;
  late: number;
  rate: number | null;
  fell: number;
  record: number | null;
  median: number | null;
  avgLate: number | null;
  openNow: number;
  overdueNow: number;
  worstOverdue: number | null;
  rating: Rating;
  streams: StreamSplit[];
  overdueItems: Tagged[];
  overdueTotal: number;
  slowest: Array<Tagged & { took: number }>;
}

export interface Reliability {
  owners: OwnerStats[];
  windowDays: number | null;
  closed: number;
  dated: number;
  onTime: number;
  rate: number | null;
  fell: number;
  record: number | null;
  rated: number;
  dependable: number;
  mixed: number;
  late: number;
  overdueNow: number;
  openNow: number;
  noOwnerClosed: number;
  noOwnerOpen: number;
  unavailable: string[];
}

function clean(value: string | null): string {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function rate(onTime: number, dated: number): number | null {
  return dated === 0 ? null : onTime / dated;
}

export function rating(fell: number, share: number | null): Rating {
  if (share === null || fell < MIN_SAMPLE) {
    return "unrated";
  }

  return share >= GOOD_RATE ? "dependable" : share >= FAIR_RATE ? "mixed" : "late";
}

interface Bucket {
  name: string;
  closed: Tagged[];
  open: Tagged[];
}

export function buildReliability(sources: Sources, failed: string[], today: number, windowDays: number | null): Reliability {
  const raw = collectRecords(sources, failed, today);
  const since = windowDays === null ? -Infinity : today - windowDays;
  const buckets = new Map<string, Bucket>();
  let noOwnerClosed = 0;
  let noOwnerOpen = 0;

  const bucketFor = (owner: string | null): Bucket | null => {
    const name = clean(owner);

    if (name === "") {
      return null;
    }

    const key = name.toLowerCase();
    const found = buckets.get(key);

    if (found) {
      return found;
    }

    const fresh: Bucket = { name, closed: [], open: [] };

    buckets.set(key, fresh);

    return fresh;
  };

  for (const info of STREAMS) {
    const data = raw.get(info.key);

    if (!data) {
      continue;
    }

    for (const record of data.records) {
      if ((record.closed as number) <= since) {
        continue;
      }

      const bucket = bucketFor(record.owner);

      if (bucket) {
        bucket.closed.push({ ...record, stream: info.key });
      } else {
        noOwnerClosed += 1;
      }
    }

    for (const record of data.open) {
      const bucket = bucketFor(record.owner);

      if (bucket) {
        bucket.open.push({ ...record, stream: info.key });
      } else {
        noOwnerOpen += 1;
      }
    }
  }

  const owners: OwnerStats[] = [];

  for (const [key, bucket] of buckets) {
    const withDue = bucket.closed.filter((item) => item.due !== null);
    const lateOnes = withDue.filter((item) => (item.closed as number) > (item.due as number));
    const lateDays = lateOnes.map((item) => (item.closed as number) - (item.due as number));
    const overdue = bucket.open.filter((item) => item.due !== null && item.due < today).sort((a, b) => (a.due as number) - (b.due as number));
    const share = rate(withDue.length - lateOnes.length, withDue.length);

    const streams: StreamSplit[] = STREAMS.map((info) => {
      const closedHere = bucket.closed.filter((item) => item.stream === info.key);
      const datedHere = closedHere.filter((item) => item.due !== null);
      const openHere = bucket.open.filter((item) => item.stream === info.key);

      return {
        stream: info.key,
        label: info.label,
        color: info.color,
        closed: closedHere.length,
        dated: datedHere.length,
        onTime: datedHere.filter((item) => (item.closed as number) <= (item.due as number)).length,
        open: openHere.length,
        overdue: openHere.filter((item) => item.due !== null && item.due < today).length,
      };
    }).filter((row) => row.closed > 0 || row.open > 0);

    owners.push({
      key,
      name: bucket.name,
      closed: bucket.closed.length,
      dated: withDue.length,
      onTime: withDue.length - lateOnes.length,
      late: lateOnes.length,
      rate: share,
      fell: withDue.length + overdue.length,
      record: rate(withDue.length - lateOnes.length, withDue.length + overdue.length),
      median: median(bucket.closed.map((item) => (item.closed as number) - item.raised)),
      avgLate: lateDays.length === 0 ? null : lateDays.reduce((sum, value) => sum + value, 0) / lateDays.length,
      openNow: bucket.open.length,
      overdueNow: overdue.length,
      worstOverdue: overdue.length === 0 ? null : today - (overdue[0]?.due as number),
      rating: rating(withDue.length + overdue.length, rate(withDue.length - lateOnes.length, withDue.length + overdue.length)),
      streams,
      overdueItems: overdue.slice(0, LIST_LIMIT),
      overdueTotal: overdue.length,
      slowest: bucket.closed
        .map((item) => ({ ...item, took: (item.closed as number) - item.raised }))
        .sort((a, b) => b.took - a.took || a.reference.localeCompare(b.reference, undefined, { numeric: true }))
        .slice(0, LIST_LIMIT),
    });
  }

  const everyone = owners.filter((owner) => owner.closed > 0 || owner.openNow > 0);
  const dated = everyone.reduce((sum, owner) => sum + owner.dated, 0);
  const onTime = everyone.reduce((sum, owner) => sum + owner.onTime, 0);
  const fell = everyone.reduce((sum, owner) => sum + owner.fell, 0);
  const unavailable = STREAMS.filter((info) => !raw.has(info.key)).map((info) => info.label);

  return {
    owners: sortOwners(everyone, "overdue"),
    windowDays,
    closed: everyone.reduce((sum, owner) => sum + owner.closed, 0),
    dated,
    onTime,
    rate: rate(onTime, dated),
    fell,
    record: rate(onTime, fell),
    rated: everyone.filter((owner) => owner.rating !== "unrated").length,
    dependable: everyone.filter((owner) => owner.rating === "dependable").length,
    mixed: everyone.filter((owner) => owner.rating === "mixed").length,
    late: everyone.filter((owner) => owner.rating === "late").length,
    overdueNow: everyone.reduce((sum, owner) => sum + owner.overdueNow, 0),
    openNow: everyone.reduce((sum, owner) => sum + owner.openNow, 0),
    noOwnerClosed,
    noOwnerOpen,
    unavailable,
  };
}

export function sortOwners(owners: OwnerStats[], key: SortKey): OwnerStats[] {
  const list = [...owners];
  const byName = (a: OwnerStats, b: OwnerStats) => a.name.localeCompare(b.name, undefined, { numeric: true });
  const rateOf = (owner: OwnerStats) => (owner.rating === "unrated" ? Infinity : (owner.record as number));

  if (key === "name") {
    return list.sort(byName);
  }

  if (key === "closed") {
    return list.sort((a, b) => b.closed - a.closed || byName(a, b));
  }

  if (key === "rate") {
    return list.sort((a, b) => rateOf(a) - rateOf(b) || b.fell - a.fell || byName(a, b));
  }

  return list.sort((a, b) => b.overdueNow - a.overdueNow || (b.worstOverdue ?? -1) - (a.worstOverdue ?? -1) || rateOf(a) - rateOf(b) || byName(a, b));
}

export function ratingText(owner: OwnerStats): string {
  if (owner.rating === "unrated") {
    return owner.fell === 0 ? "Nothing has fallen due yet" : `Only ${owner.fell} ${plural(owner.fell, "item has", "items have")} fallen due`;
  }

  return `${rateText(owner.record)} on time across ${owner.fell} ${plural(owner.fell, "item", "items")} that fell due`;
}

export function reliabilityMarkdown(result: Reliability, owners: OwnerStats[], projectName: string, today: number): string {
  const lines: string[] = [];
  const span = result.windowDays === null ? "every item closed to date" : `items closed in the last ${windowLabel(result.windowDays).toLowerCase()}`;

  lines.push(`# Owner reliability: ${projectName}`, "");
  lines.push(`As of ${formatDay(today)}. Based on ${span}. On time means closed on or before the item's own due date.`, "");
  lines.push(
    `- Owners: ${owners.length}`,
    `- Closed: ${result.closed}`,
    `- On-time record: ${rateText(result.record)}${result.fell > 0 ? ` of ${result.fell} items that fell due` : ""}`,
    `- Closed on or before the due date: ${rateText(result.rate)}${result.dated > 0 ? ` of ${result.dated}` : ""}`,
    `- Open and past due now: ${result.overdueNow} of ${result.openNow}`,
    "",
  );

  if (owners.length === 0) {
    lines.push("No owner has closed or holds any items.", "");

    return lines.join("\n");
  }

  lines.push("| Owner | On-time record | Closed | Closed on time | Typical days | Avg days late | Open | Overdue | Worst overdue | Rating |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");

  const cell = (text: string) => text.replace(/\|/g, "/").replace(/\s+/g, " ").trim();

  for (const owner of owners) {
    lines.push(
      `| ${cell(owner.name)} | ${rateText(owner.record)}${owner.fell > 0 ? ` (${owner.onTime}/${owner.fell})` : ""} | ${owner.closed} | ${rateText(owner.rate)}${owner.dated > 0 ? ` (${owner.onTime}/${owner.dated})` : ""} | ${daysText(owner.median)} | ${daysText(owner.avgLate)} | ${owner.openNow} | ${owner.overdueNow} | ${owner.worstOverdue === null ? "—" : `${owner.worstOverdue} d`} | ${RATING_LABEL[owner.rating]} |`,
    );
  }

  lines.push("");

  const chase = owners.filter((owner) => owner.overdueNow > 0).slice(0, 5);

  if (chase.length > 0) {
    lines.push("## Overdue items by owner", "");

    for (const owner of chase) {
      lines.push(`**${cell(owner.name)}** (${owner.overdueNow} overdue)`);

      for (const item of owner.overdueItems) {
        lines.push(`- ${cell(item.reference)} ${cell(trunc(item.title, 70))}, ${today - (item.due as number)} days past due`);
      }

      lines.push("");
    }
  }

  lines.push(
    `On-time record counts every item that fell due: items closed with a due date, plus items still open past their due date. Closed on or before the due date is on time; closed late or still overdue is not. Dependable is ${Math.round(GOOD_RATE * 100)}% or more, mixed ${Math.round(FAIR_RATE * 100)}% to ${Math.round(GOOD_RATE * 100) - 1}%, often late below that. An owner needs at least ${MIN_SAMPLE} items that fell due to be rated. Due dates are set by the project, so read this as a prompt for a conversation, not a verdict.`,
    "",
  );

  if (result.noOwnerClosed > 0 || result.noOwnerOpen > 0) {
    lines.push(`Left out because they have no owner: ${result.noOwnerClosed} closed and ${result.noOwnerOpen} open.`, "");
  }

  return lines.join("\n");
}
