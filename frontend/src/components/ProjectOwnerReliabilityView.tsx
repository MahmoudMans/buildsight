"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { MIN_SAMPLE, WINDOWS, DEFAULT_WINDOW, daysText, rateText } from "@/lib/closureSpeed";
import { MODULE_LABEL, formatDay, loadSources, plural, projectOf, startOfToday, trunc, type ModuleKey, type Sources } from "@/lib/openItems";
import {
  FAIR_RATE,
  GOOD_RATE,
  RATING_LABEL,
  SORTS,
  buildReliability,
  ratingText,
  reliabilityMarkdown,
  sortOwners,
  type OwnerStats,
  type Rating,
  type Reliability,
  type SortKey,
  type Tagged,
} from "@/lib/ownerReliability";
import { STREAMS } from "@/lib/backlog";
import { copyText } from "@/lib/textExport";

import styles from "./ProjectOwnerReliabilityView.module.css";

const SOURCE_COUNT = 9;
const STREAM_LABEL = Object.fromEntries(STREAMS.map((info) => [info.key, info.label]));

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function rateClass(rate: number | null): string | undefined {
  if (rate === null) {
    return undefined;
  }

  return rate >= GOOD_RATE ? styles.rateGood : rate >= FAIR_RATE ? styles.rateWatch : styles.rateBad;
}

const RATING_CLASS: Record<Rating, string | undefined> = {
  dependable: styles.ratingGood,
  mixed: styles.ratingMixed,
  late: styles.ratingBad,
  unrated: styles.ratingNone,
};

function RatingPill({ rating }: { rating: Rating }) {
  return <span className={cx(styles.rating, RATING_CLASS[rating])}>{RATING_LABEL[rating]}</span>;
}

function RecordCell({ owner }: { owner: OwnerStats }) {
  if (owner.record === null) {
    return <span className={styles.missing}>—</span>;
  }

  return (
    <span className={styles.rateCell}>
      <span aria-hidden="true" className={styles.rateTrack}>
        <i className={cx(styles.rateFill, owner.rating === "unrated" ? styles.rateNone : rateClass(owner.record))} style={{ width: `${Math.round(owner.record * 100)}%` }} />
      </span>
      <span className={owner.rating === "unrated" ? undefined : rateClass(owner.record)}>{rateText(owner.record)}</span>
      <small className={styles.of}>of {owner.fell}</small>
    </span>
  );
}

function Records({ empty, items, kind, now }: { empty: string; items: Array<Tagged & { took?: number }>; kind: "closed" | "open"; now: number }) {
  if (items.length === 0) {
    return <p className={styles.quiet}>{empty}</p>;
  }

  return (
    <ul className={styles.records}>
      {items.map((item) => {
        const days = kind === "open" ? now - (item.due as number) : (item.took ?? 0);
        const late = kind === "closed" && item.due !== null && (item.closed ?? 0) > item.due;

        return (
          <li key={`${item.stream}-${item.id}`}>
            <div className={styles.recTop}>
              <strong>{item.reference}</strong>
              <span>{trunc(item.title, 52)}</span>
            </div>

            <div className={styles.recMeta}>
              <span className={styles.recDays}>{kind === "open" ? `${days} ${plural(days, "day", "days")} past due` : `${days} ${plural(days, "day", "days")} to close`}</span>
              <span>{STREAM_LABEL[item.stream]}</span>
              <span>raised {formatDay(item.raised)}</span>
              {late && item.due !== null && <em className={styles.lateTag}>{(item.closed ?? 0) - item.due} d late</em>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ProjectOwnerReliabilityView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [windowKey, setWindowKey] = useState(DEFAULT_WINDOW);
  const [sort, setSort] = useState<SortKey>("overdue");
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    loadSources(projectId).then((result) => {
      if (cancelled) {
        return;
      }

      setSources(result.sources);
      setFailed(result.failed);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const windowDays = WINDOWS.find((item) => item.key === windowKey)?.days ?? null;
  const result: Reliability | null = useMemo(() => (sources ? buildReliability(sources, failed, today, windowDays) : null), [sources, failed, today, windowDays]);
  const owners = useMemo(() => (result ? sortOwners(result.owners, sort) : []), [result, sort]);
  const project = sources ? projectOf(sources) : null;
  const projectName = project?.name ?? "Project";

  const loaded = sources !== null && result !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;
  const needed = failed.filter((key): key is ModuleKey => key === "quality" || key === "documents" || key === "safety" || key === "governance");
  const empty = loaded && !failedAll && owners.length === 0;
  const active = owners.find((owner) => owner.key === picked) ?? owners[0] ?? null;
  const span = windowDays === null ? "so far" : `in the last ${(WINDOWS.find((item) => item.key === windowKey)?.label ?? "").toLowerCase()}`;

  async function copySummary() {
    if (!result) {
      return;
    }

    const ok = await copyText(reliabilityMarkdown(result, owners, projectName, today));

    setMessage(ok ? "Copied the figures as Markdown." : "Could not copy the figures.");
  }

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">OWNER RELIABILITY</div>

            <h1>Who delivers on time?</h1>

            <p className={styles.subtitle}>
              For each person or company named as an owner, how often their items were closed by the due date, how long they typically take and how many they are still holding past due. It is a prompt for a conversation, not a league table.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/workload`}>
              Who is carrying what
            </Link>

            <Link className="secondary-link-button" href={`${base}/closure-speed`}>
              Closure speed
            </Link>
          </div>
        </header>

        {!loaded && <div className={styles.loading}>Working out each owner’s record…</div>}

        {failedAll && (
          <div className="offline-banner">
            <div>
              <strong>Could not load any project data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {loaded && !failedAll && needed.length > 0 && (
          <div className="offline-banner">
            <div>
              <strong>Could not load {needed.map((key) => MODULE_LABEL[key].toLowerCase()).join(", ")}.</strong>
              <span> Items that come from {needed.length > 1 ? "them" : "it"} are left out of every figure.</span>
            </div>
          </div>
        )}

        {empty && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>
              No closed or open item names an owner{windowDays === null ? "" : ` ${span}`}, so there is nothing to compare.
              {result && (result.noOwnerClosed > 0 || result.noOwnerOpen > 0) ? ` ${result.noOwnerClosed} closed and ${result.noOwnerOpen} open ${plural(result.noOwnerClosed + result.noOwnerOpen, "item has", "items have")} no owner.` : ""}
            </div>
          </section>
        )}

        {loaded && !failedAll && result && !empty && active && (
          <>
            <section aria-label="Owner summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OWNERS</div>
                <div className={styles.kpiValue}>{owners.length}</div>
                <div className={styles.kpiSub}>{result.rated} with enough history to rate</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ON-TIME RECORD</div>
                <div className={cx(styles.kpiValue, result.record !== null && result.record >= GOOD_RATE && styles.pos, result.record !== null && result.record < FAIR_RATE && styles.neg)}>{rateText(result.record)}</div>
                <div className={styles.kpiSub}>{result.fell > 0 ? `of ${result.fell} items that fell due` : "nothing has fallen due"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CLOSED ON TIME</div>
                <div className={styles.kpiValue}>{rateText(result.rate)}</div>
                <div className={styles.kpiSub}>{result.dated > 0 ? `of ${result.dated} closed ${span}` : "no closed items with a due date"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PAST DUE NOW</div>
                <div className={cx(styles.kpiValue, result.overdueNow > 0 && styles.neg)}>{result.overdueNow}</div>
                <div className={styles.kpiSub}>of {result.openNow} still open</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OFTEN LATE</div>
                <div className={cx(styles.kpiValue, result.late > 0 && styles.neg)}>{result.late}</div>
                <div className={styles.kpiSub}>
                  {result.dependable} dependable, {result.mixed} mixed
                </div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.controlGroup}>
                <div aria-label="Closed within" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button aria-pressed={windowKey === option.key} className={cx(styles.segment, windowKey === option.key && styles.segmentOn)} key={option.key} onClick={() => setWindowKey(option.key)} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>

                <div aria-label="Sort owners by" className={styles.segmented} role="group">
                  {SORTS.map((option) => (
                    <button aria-pressed={sort === option.key} className={cx(styles.segment, sort === option.key && styles.segmentOn)} key={option.key} onClick={() => setSort(option.key)} type="button">
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className={styles.linkButton} onClick={copySummary} type="button">
                Copy as Markdown
              </button>
            </section>

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY OWNER</div>
                  <h2>Record against the due dates</h2>
                </div>

                <span className={styles.muted}>{result.windowDays === null ? "Everything closed to date" : `Closed ${span}`}</span>
              </header>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Owner</th>
                      <th scope="col">On-time record</th>
                      <th className={styles.num} scope="col">
                        Closed
                      </th>
                      <th className={styles.num} scope="col">
                        Closed on time
                      </th>
                      <th className={styles.num} scope="col">
                        Typical
                      </th>
                      <th className={styles.num} scope="col">
                        Open
                      </th>
                      <th className={styles.num} scope="col">
                        Past due now
                      </th>
                      <th className={styles.num} scope="col">
                        Worst overdue
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {owners.map((owner) => (
                      <tr className={cx(owner.key === active.key && styles.rowOn)} key={owner.key}>
                        <th scope="row">
                          <button aria-pressed={owner.key === active.key} className={styles.rowButton} onClick={() => setPicked(owner.key)} type="button">
                            <span className={styles.ownerName}>{owner.name}</span>
                            <RatingPill rating={owner.rating} />
                          </button>
                        </th>

                        <td>
                          <RecordCell owner={owner} />
                        </td>
                        <td className={styles.num}>{owner.closed}</td>
                        <td className={styles.num}>
                          {owner.rate === null ? <span className={styles.missing}>—</span> : rateText(owner.rate)}
                          {owner.dated > 0 && (
                            <small className={styles.of}>
                              {" "}
                              {owner.onTime}/{owner.dated}
                            </small>
                          )}
                        </td>
                        <td className={styles.num}>{daysText(owner.median)}</td>
                        <td className={styles.num}>{owner.openNow}</td>
                        <td className={cx(styles.num, owner.overdueNow > 0 && styles.neg)}>{owner.overdueNow}</td>
                        <td className={styles.num}>{owner.worstOverdue === null ? <span className={styles.missing}>—</span> : `${owner.worstOverdue} d`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className={styles.scrollHint}>Swipe the table sideways for the rest of the columns.</p>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">CLOSE UP</div>
                  <h2>{active.name}</h2>
                </div>

                <RatingPill rating={active.rating} />
              </header>

              <p className={styles.quiet}>
                {ratingText(active)}.
                {active.rating === "unrated" ? ` An owner needs at least ${MIN_SAMPLE} items that have fallen due before a rating is shown.` : ""}
                {active.avgLate !== null ? ` When they were late, it was by ${daysText(active.avgLate)} on average.` : ""}
              </p>

              <div className={styles.tableWrap}>
                <table className={cx(styles.table, styles.splitTable)}>
                  <thead>
                    <tr>
                      <th scope="col">Kind of item</th>
                      <th className={styles.num} scope="col">
                        Closed
                      </th>
                      <th className={styles.num} scope="col">
                        On time
                      </th>
                      <th className={styles.num} scope="col">
                        Open
                      </th>
                      <th className={styles.num} scope="col">
                        Past due now
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {active.streams.map((row) => (
                      <tr key={row.stream}>
                        <th scope="row">
                          <span className={styles.streamName}>
                            <span aria-hidden="true" className={styles.dot} style={{ "--dot": row.color } as CSSProperties} />
                            {row.label}
                          </span>
                        </th>
                        <td className={styles.num}>{row.closed}</td>
                        <td className={styles.num}>{row.dated === 0 ? <span className={styles.missing}>—</span> : `${row.onTime} of ${row.dated}`}</td>
                        <td className={styles.num}>{row.open}</td>
                        <td className={cx(styles.num, row.overdue > 0 && styles.neg)}>{row.overdue}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={cx(styles.twoCol, styles.lists)}>
                <div>
                  <h3 className={styles.subhead}>Past due now{active.overdueTotal > 0 ? ` (${active.overdueTotal})` : ""}</h3>
                  <Records empty="Nothing this owner holds is past its due date." items={active.overdueItems} kind="open" now={today} />
                  {active.overdueTotal > active.overdueItems.length && <p className={styles.quiet}>and {active.overdueTotal - active.overdueItems.length} more, longest overdue first above.</p>}
                </div>

                <div>
                  <h3 className={styles.subhead}>Slowest to close</h3>
                  <Records empty={windowDays === null ? "Nothing has been closed yet." : `Nothing closed ${span}.`} items={active.slowest} kind="closed" now={today} />
                </div>
              </div>
            </section>

            <p className={styles.note}>
              <strong>On-time record</strong> counts every item that fell due: items closed with a due date, plus items still open past their due date. Closed on or before the due date is on time; closed late, or still overdue, is not. It is rated dependable at {Math.round(GOOD_RATE * 100)}% or more, mixed from {Math.round(FAIR_RATE * 100)}% and often late below that, and only once {MIN_SAMPLE} items have fallen due. <strong>Closed on time</strong> looks only at closed items, so it flatters anyone who closes the easy ones and sits on the rest.
              Items are counted in the period in which they were closed; open items are always counted as they stand today. Due dates are set by the project, not the owner, and an owner who is waiting on someone else will look slow here.
              {result.noOwnerClosed + result.noOwnerOpen > 0 ? ` ${result.noOwnerClosed} closed and ${result.noOwnerOpen} open ${plural(result.noOwnerClosed + result.noOwnerOpen, "item has", "items have")} no owner and ${plural(result.noOwnerClosed + result.noOwnerOpen, "is", "are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
