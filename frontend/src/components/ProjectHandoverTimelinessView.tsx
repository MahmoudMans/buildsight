"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectQuality } from "@/lib/api";
import { DEFAULT_WINDOW, FILTERS, GOOD, MIN_GROUP, PAGE, SOON_DAYS, WATCH, WINDOWS, bandOf, buildHandover, categoryLabel, dayCount, filterRows, flagText, handoverMarkdown, pct, type Bucket, type Filter, type Flag, type Group, type Handover, type Row } from "@/lib/handoverTimeliness";
import { formatDay, plural, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { QualityControl } from "@/types/project";

import styles from "./ProjectHandoverTimelinessView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const FILL: Record<"good" | "watch" | "bad", string | undefined> = {
  good: styles.fillGood,
  watch: styles.fillWatch,
  bad: styles.fillBad,
};

const BUCKET_FILL: Array<string | undefined> = [styles.fillGood, styles.fillWatch, styles.fillBad, styles.fillBad, styles.fillBad];

function chipOf(flag: Flag): string | undefined {
  if (flag === "missing" || flag === "rejected" || flag === "late") {
    return styles.chipBad;
  }

  if (flag === "noOwner") {
    return styles.chipWatch;
  }

  return styles.chipPlain;
}

function BucketLine({ bucket, index }: { bucket: Bucket; index: number }) {
  return (
    <li className={styles.groupRow}>
      <span className={styles.what}>
        <strong>{bucket.label}</strong>
        <small>
          {bucket.count} {plural(bucket.count, "item", "items")}
        </small>
      </span>

      <span aria-label={`${bucket.label}: ${pct(bucket.share)} of judged items`} className={styles.track} role="img">
        {bucket.share !== null && bucket.count > 0 && <i className={cx(styles.fill, BUCKET_FILL[index])} style={{ width: `${bucket.share * 100}%` }} />}
      </span>

      <span className={styles.rateFig}>
        <b>{pct(bucket.share)}</b>
      </span>
    </li>
  );
}

function BarLine({ label, share, base, text }: { label: string; share: number | null; base: number; text: string }) {
  const band = bandOf(share, base);

  return (
    <span className={styles.barLine} title={text}>
      <em>{label}</em>
      <span className={styles.track}>{share !== null && <i className={cx(styles.fill, band ? FILL[band] : styles.fillQuiet)} style={{ width: `${share * 100}%` }} />}</span>
      <b>{pct(share)}</b>
    </span>
  );
}

function GroupLine({ group }: { group: Group }) {
  return (
    <li className={styles.grp}>
      <span className={styles.what}>
        <strong>{group.label}</strong>
        <small>
          {group.count} {plural(group.count, "item", "items")}
        </small>
      </span>

      <span className={styles.bars}>
        <BarLine base={group.judged} label="On time" share={group.onTimeShare} text={`${group.onTime} of ${group.judged} judged items received by the due date`} />
        <BarLine base={group.judged} label="Delivered" share={group.deliveredShare} text={`${group.delivered} of ${group.judged} judged items received at all`} />
      </span>
    </li>
  );
}

function receivedNote(row: Row): string | null {
  if (row.received === null) {
    return null;
  }

  if (row.lateDays !== null) {
    return `${dayCount(row.lateDays)} late`;
  }

  if (row.outcome !== "onTime") {
    return null;
  }

  return row.received < row.due ? `${dayCount(row.due - row.received)} early` : "on the day";
}

function ItemLine({ row }: { row: Row }) {
  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{trunc(row.title, 72)}</strong>
        <small>
          {row.code}, {categoryLabel(row.category)}
        </small>
        <small>{row.owner ? `Owner: ${row.owner}` : "No owner named"}</small>
      </span>

      <span className={styles.records}>
        <span className={styles.record}>
          <b>Due</b>
          <span>{formatDay(row.due)}</span>
        </span>

        <span className={styles.record}>
          <b>Received</b>
          {row.received !== null ? (
            <>
              <span>{formatDay(row.received)}</span>
              {receivedNote(row) && <small>{receivedNote(row)}</small>}
            </>
          ) : (
            <span className={row.outcome === "missing" ? styles.missing : styles.pending}>{row.outcome === "missing" ? "not received" : "no date recorded"}</span>
          )}
        </span>

        <span className={styles.record}>
          <b>Approved</b>
          {row.approved !== null ? (
            <>
              <span>{formatDay(row.approved)}</span>
              {row.approvalDays !== null && <small>{dayCount(row.approvalDays)} after receipt</small>}
            </>
          ) : (
            <span className={styles.pending}>{row.status === "APPROVED" ? "no date recorded" : row.status === "REJECTED" ? "rejected" : "not approved yet"}</span>
          )}
        </span>
      </span>

      <span className={styles.verdict}>
        {row.flags.length === 0 && <em className={cx(styles.chip, styles.chipGood)}>In order</em>}
        {row.flags.map((flag) => (
          <em className={cx(styles.chip, chipOf(flag))} key={flag}>
            {flagText(flag, row)}
          </em>
        ))}
      </span>
    </li>
  );
}

function refs(list: string[]): string {
  return `${list.slice(0, 4).join(", ")}${list.length > 4 ? ` and ${list.length - 4} more` : ""}`;
}

export function ProjectHandoverTimelinessView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<QualityControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [ownersShown, setOwnersShown] = useState(6);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(() => {
    const now = new Date();

    return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86_400_000);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectQuality(projectId)
      .then((value) => {
        if (!cancelled) {
          setData(value);
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const built = useMemo(() => (data ? buildHandover(data, today, windowDays) : null), [data, today, windowDays]);
  const hv: Handover | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (hv ? filterRows(hv.rows, filter) : []), [hv, filter]);
  const windowLabel = WINDOWS.find((option) => option.days === windowDays)?.label ?? `${windowDays} days`;
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";

  async function copySummary() {
    if (!hv) {
      return;
    }

    const ok = await copyText(handoverMarkdown(hv, list, projectName, windowLabel, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the handover timeliness as Markdown." : "Could not copy the handover timeliness.");
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

            <div className="eyebrow">HANDOVER TIMELINESS</div>

            <h1>Are handover documents arriving by their due dates?</h1>

            <p className={styles.subtitle}>
              Handover packs are cheap to chase early and painful to chase at the end. This page looks at the items that have already fallen due, and shows which arrived on time, which came late, which never arrived, which were rejected, and where the recorded dates do not add up.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/closeout-board`}>
              Closeout board
            </Link>

            <Link className="secondary-link-button" href={`${base}/quality-board`}>
              Quality board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the handover items…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the quality data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No handover item is listed as required yet, so there is nothing to check. Items marked not required are not counted.</div>
          </section>
        )}

        {state === "ready" && hv && (
          <>
            <section aria-label="Handover timeliness summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>DUE ITEMS</div>
                <div className={styles.kpiValue}>{hv.due}</div>
                <div className={styles.kpiSub}>fell due in the last {windowLabel}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ON TIME</div>
                <div className={cx(styles.kpiValue, hv.onTimeShare !== null && hv.onTimeShare < WATCH && styles.neg)}>{pct(hv.onTimeShare)}</div>
                <div className={styles.kpiSub}>{hv.judged > 0 ? `${hv.onTime} of ${hv.judged} received by the due date` : "nothing could be judged"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LATE</div>
                <div className={cx(styles.kpiValue, hv.late > 0 && styles.neg)}>{hv.late}</div>
                <div className={styles.kpiSub}>{hv.lateMedian !== null ? `median ${dayCount(hv.lateMedian)} late` : "none delivered late"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>STILL MISSING</div>
                <div className={cx(styles.kpiValue, hv.missing > 0 && styles.neg)}>{hv.missing}</div>
                <div className={styles.kpiSub}>due, and not received</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>REJECTED</div>
                <div className={cx(styles.kpiValue, hv.rejected > 0 && styles.neg)}>{hv.rejected}</div>
                <div className={styles.kpiSub}>sent back for rework</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Due in the last</span>

                <div aria-label="Period measured" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={windowDays === option.days}
                      className={cx(styles.segment, windowDays === option.days && styles.segmentOn)}
                      key={option.days}
                      onClick={() => {
                        setWindowDays(option.days);
                        setShown(PAGE);
                        setOwnersShown(6);
                        setMessage(null);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.controlLabel}>Items</span>

                <div aria-label="Which items to list" className={styles.segmented} role="group">
                  {FILTERS.map((option) => (
                    <button
                      aria-pressed={filter === option.key}
                      className={cx(styles.segment, filter === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setFilter(option.key);
                        setShown(PAGE);
                        setMessage(null);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.actions}>
                <button className={styles.linkButton} onClick={copySummary} type="button">
                  Copy as Markdown
                </button>
              </div>
            </section>

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            {hv.dueSoon.length > 0 && (
              <p className={styles.caution} role="note">
                {hv.dueSoon.length} {plural(hv.dueSoon.length, "handover item falls", "handover items fall")} due within {SOON_DAYS} days and {plural(hv.dueSoon.length, "has", "have")} not been received: {refs(hv.dueSoon)}.
              </p>
            )}

            {hv.staleOutside.length > 0 && (
              <p className={styles.caution} role="note">
                {hv.staleOutside.length} older {plural(hv.staleOutside.length, "item", "items")} that fell due before this period {plural(hv.staleOutside.length, "was", "were")} never received: {refs(hv.staleOutside)}. {plural(hv.staleOutside.length, "It is", "They are")} not counted below.
              </p>
            )}

            {hv.rows.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No handover item fell due in this period. Try a longer period.</div>
              </section>
            ) : (
              <>
                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">HOW LATE</div>
                      <h2>When the items that fell due arrived</h2>
                    </div>

                    <span className={styles.muted}>{hv.judged > 0 ? `${hv.judged} judged${hv.lateMedian !== null ? `, late ones median ${dayCount(hv.lateMedian)}` : ""}` : "nothing could be judged"}</span>
                  </header>

                  <ul className={styles.rates}>
                    {hv.buckets.map((bucket, index) => (
                      <BucketLine bucket={bucket} index={index} key={bucket.label} />
                    ))}
                  </ul>

                  <p className={styles.hint}>
                    {hv.approvalMedian !== null ? `Approval took a median of ${dayCount(hv.approvalMedian)} from receipt (${hv.approved} approved ${plural(hv.approved, "item", "items")} measured). ` : "No approved item has both dates, so approval time cannot be measured. "}
                    {hv.unclear > 0 ? `${hv.unclear} ${plural(hv.unclear, "item is", "items are")} left out of the bars because the received date is missing or in the future.` : ""}
                  </p>
                </section>

                <div className={styles.twoCol}>
                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY CATEGORY</div>
                        <h2>Which kinds of document are late</h2>
                      </div>
                    </header>

                    <ul className={styles.rates}>
                      {hv.categories.map((group) => (
                        <GroupLine group={group} key={group.key} />
                      ))}
                    </ul>

                    <p className={styles.hint}>
                      On time is the share received by the due date. Delivered is the share received at all. Green is {Math.round(GOOD * 100)}% or more, amber {Math.round(WATCH * 100)}% or more, red below that. Bars with fewer than {MIN_GROUP} judged items behind them are not coloured.
                    </p>
                  </section>

                  <section className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BY OWNER</div>
                        <h2>Who the late items sit with</h2>
                      </div>

                      <span className={styles.muted}>
                        {hv.owners.length} {plural(hv.owners.length, "owner", "owners")}
                      </span>
                    </header>

                    <ul className={styles.rates}>
                      {hv.owners.slice(0, ownersShown).map((group) => (
                        <GroupLine group={group} key={group.key} />
                      ))}
                    </ul>

                    {hv.owners.length > ownersShown && (
                      <div className={styles.more}>
                        <button className={styles.moreButton} onClick={() => setOwnersShown((current) => current + 6)} type="button">
                          Show {Math.min(6, hv.owners.length - ownersShown)} more
                        </button>
                        <span className={styles.muted}>
                          {ownersShown} of {hv.owners.length} shown
                        </span>
                      </div>
                    )}
                  </section>
                </div>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">ITEM BY ITEM</div>
                      <h2>What happened to each handover item</h2>
                    </div>

                    <span className={styles.muted}>
                      {list.length} of {hv.rows.length} {plural(hv.rows.length, "item", "items")}, worst first
                    </span>
                  </header>

                  {list.length === 0 ? (
                    <p className={styles.quiet}>No item matches this selection.</p>
                  ) : (
                    <>
                      <ul className={styles.items}>
                        {list.slice(0, shown).map((row) => (
                          <ItemLine key={row.key} row={row} />
                        ))}
                      </ul>

                      {list.length > shown && (
                        <div className={styles.more}>
                          <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                            Show {Math.min(PAGE, list.length - shown)} more
                          </button>
                          <span className={styles.muted}>
                            {shown} of {list.length} shown
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </section>
              </>
            )}

            <p className={styles.note}>
              Only items that fell due before today are judged; items due today or later are not, and the ones due soon are listed above instead. An item is on time when its received date is on or before the due date. An item with no received date, and no sign that it was sent (a submitted or approved status, or an approval date), counts as still missing. An item that looks sent but has no usable received date cannot be judged, and is flagged. An item is rejected when its status says so. Items marked not required are left out.
              {hv.notRequired > 0 ? ` ${hv.notRequired} ${plural(hv.notRequired, "item is", "items are")} marked not required.` : ""}
              {hv.skipped > 0 ? ` ${hv.skipped} ${plural(hv.skipped, "item has", "items have")} no usable due date and ${plural(hv.skipped, "is", "are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
