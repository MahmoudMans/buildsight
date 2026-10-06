"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  MODULE_LABEL,
  MODULE_PATH,
  SEVERITY_LABEL,
  buildOpenItems,
  formatDay,
  loadSources,
  plural,
  projectOf,
  startOfToday,
  type ModuleKey,
  type Severity,
  type Sources,
} from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import { SOON_DAYS, UNASSIGNED, buildLoads, chaseMessage, type OwnerLoad } from "@/lib/workload";

import styles from "./ProjectWorkloadView.module.css";

const SOURCE_COUNT = 9;
const ITEM_LIMIT = 8;
const COPY_LIMIT = 12;

type SortKey = "open" | "late" | "name";

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "open", label: "Most open" },
  { key: "late", label: "Most overdue" },
  { key: "name", label: "Name" },
];

const SEVERITY_CLASS: Record<Severity, string | undefined> = {
  critical: styles.sevCritical,
  high: styles.sevHigh,
  medium: styles.sevMedium,
  low: styles.sevLow,
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function dueText(days: number): string {
  if (!Number.isFinite(days)) {
    return "No due date";
  }

  if (days < 0) {
    return `${-days} ${plural(-days, "day", "days")} late`;
  }

  if (days === 0) {
    return "Due today";
  }

  if (days === 1) {
    return "Due tomorrow";
  }

  return `Due in ${days} days`;
}

function share(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%";
}

export function ProjectWorkloadView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [sort, setSort] = useState<SortKey>("open");
  const [picked, setPicked] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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

  const project = useMemo(() => (sources ? projectOf(sources) : null), [sources]);
  const items = useMemo(() => (sources ? buildOpenItems(sources, today) : []), [sources, today]);
  const loads = useMemo(() => buildLoads(items, today), [items, today]);

  const people = useMemo(() => loads.filter((load) => load.assigned), [loads]);
  const unassigned = useMemo(() => loads.find((load) => !load.assigned) ?? null, [loads]);

  const ordered = useMemo(() => {
    const sorted = [...people].sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name);
      }

      if (sort === "late") {
        return b.overdue - a.overdue || b.total - a.total || a.name.localeCompare(b.name);
      }

      return b.total - a.total || b.overdue - a.overdue || a.name.localeCompare(b.name);
    });

    return unassigned ? [unassigned, ...sorted] : sorted;
  }, [people, unassigned, sort]);

  const total = items.length;
  const overdue = loads.reduce((sum, load) => sum + load.overdue, 0);
  const soon = loads.reduce((sum, load) => sum + load.soon, 0);
  const lateOwners = people.filter((load) => load.overdue > 0).length;
  const widest = Math.max(1, ...ordered.map((load) => load.total));

  const heaviest = useMemo(() => [...people].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))[0] ?? null, [people]);

  const topThree = useMemo(() => {
    const held = [...people].sort((a, b) => b.total - a.total).slice(0, 3);

    return { count: held.length, total: held.reduce((sum, load) => sum + load.total, 0) };
  }, [people]);

  const selected: OwnerLoad | null = useMemo(() => {
    if (ordered.length === 0) {
      return null;
    }

    return ordered.find((load) => load.key === picked) ?? ordered[0] ?? null;
  }, [ordered, picked]);

  function choose(key: string) {
    setPicked(key);
    setExpanded(false);
    setMessage(null);
  }

  async function copyChase() {
    if (!selected) {
      return;
    }

    const ok = await copyText(chaseMessage(selected, project?.name ?? "the project", today, COPY_LIMIT));

    setMessage(ok ? `Copied a message for ${selected.assigned ? selected.name : "the unowned items"}.` : "Could not copy the message.");
  }

  const loaded = sources !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;
  const nothing = loaded && !failedAll && total === 0;

  const rows = selected ? (expanded ? selected.items : selected.items.slice(0, ITEM_LIMIT)) : [];

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">WORKLOAD</div>

            <h1>Who is carrying what</h1>

            <p className={styles.subtitle}>
              Every open action, risk, RFI, NCR, claim and the like, grouped by the person it is assigned to. Use it to spot overloaded
              people, items nobody owns, and who to chase this week.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/inbox`}>
            Open action inbox
          </Link>
        </header>

        {!loaded && <div className={styles.loading}>Gathering open items…</div>}

        {failedAll && (
          <div className="offline-banner">
            <div>
              <strong>Could not load any project data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {loaded && !failedAll && failed.length > 0 && (
          <div className="offline-banner">
            <div>
              <strong>Could not load {failed.map((key) => MODULE_LABEL[key].toLowerCase()).join(", ")}.</strong>
              <span> Their items are missing from the totals below.</span>
            </div>
          </div>
        )}

        {nothing && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No open items found. Nothing is waiting on anyone right now.</div>
          </section>
        )}

        {loaded && !failedAll && !nothing && (
          <>
            <section aria-label="Workload summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OPEN ITEMS</div>
                <div className={styles.kpiValue}>{total}</div>
                <div className={styles.kpiSub}>
                  across {people.length} {plural(people.length, "person", "people")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVERDUE</div>
                <div className={cx(styles.kpiValue, overdue > 0 && styles.neg)}>{overdue}</div>
                <div className={styles.kpiSub}>
                  {overdue > 0 ? `held by ${lateOwners} ${plural(lateOwners, "person", "people")}` : "nothing late"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DUE IN {SOON_DAYS} DAYS</div>
                <div className={styles.kpiValue}>{soon}</div>
                <div className={styles.kpiSub}>coming up</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO OWNER</div>
                <div className={cx(styles.kpiValue, unassigned && styles.neg)}>{unassigned ? unassigned.total : 0}</div>
                <div className={styles.kpiSub}>{unassigned ? `${share(unassigned.total, total)} of open items` : "every item has an owner"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MOST LOADED</div>
                <div className={cx(styles.kpiValue, styles.kpiName)}>{heaviest ? heaviest.name : "—"}</div>
                <div className={styles.kpiSub}>{heaviest ? `${heaviest.total} ${plural(heaviest.total, "item", "items")} · ${share(heaviest.total, total)}` : "nobody named yet"}</div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY PERSON</div>
                  <h2>Open items per owner</h2>
                </div>

                <div aria-label="Sort people" className={styles.segmented} role="group">
                  {SORTS.map((option) => (
                    <button
                      aria-pressed={sort === option.key}
                      className={cx(styles.segment, sort === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => setSort(option.key)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </header>

              {topThree.count >= 3 && people.length > 3 && (
                <p className={styles.lead}>
                  The three most loaded people hold {share(topThree.total, total)} of all open items.
                </p>
              )}

              <ul aria-label="People" className={styles.legend} role="presentation">
                <li>
                  <span className={cx(styles.swatch, styles.stageLate)} />
                  Overdue
                </li>
                <li>
                  <span className={cx(styles.swatch, styles.stageSoon)} />
                  Due in {SOON_DAYS} days
                </li>
                <li>
                  <span className={cx(styles.swatch, styles.stageLater)} />
                  Later
                </li>
                <li>
                  <span className={cx(styles.swatch, styles.stageNone)} />
                  No date
                </li>
              </ul>

              <ul className={styles.people}>
                {ordered.map((load) => (
                  <li key={load.key}>
                    <button
                      aria-pressed={selected?.key === load.key}
                      className={cx(styles.person, selected?.key === load.key && styles.personOn, !load.assigned && styles.personNone)}
                      onClick={() => choose(load.key)}
                      type="button"
                    >
                      <span className={styles.personName}>
                        <strong>{load.name}</strong>
                        <small>
                          {load.byModule
                            .slice(0, 3)
                            .map((entry) => `${MODULE_LABEL[entry.module]} ${entry.count}`)
                            .join(" · ")}
                          {load.byModule.length > 3 ? ` · +${load.byModule.length - 3}` : ""}
                        </small>
                      </span>

                      <span aria-hidden="true" className={styles.stack} style={{ width: `${Math.max(6, (load.total / widest) * 100)}%` }}>
                        {load.overdue > 0 && <span className={styles.stageLate} style={{ flexGrow: load.overdue }} />}
                        {load.soon > 0 && <span className={styles.stageSoon} style={{ flexGrow: load.soon }} />}
                        {load.later > 0 && <span className={styles.stageLater} style={{ flexGrow: load.later }} />}
                        {load.undated > 0 && <span className={styles.stageNone} style={{ flexGrow: load.undated }} />}
                      </span>

                      <span className={styles.personFigures}>
                        <strong>{load.total}</strong> open
                        {load.overdue > 0 && <em className={styles.lateTag}>{load.overdue} late</em>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {selected && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">{selected.assigned ? "SELECTED PERSON" : "NEEDS AN OWNER"}</div>
                    <h2>{selected.assigned ? selected.name : UNASSIGNED}</h2>
                  </div>

                  <div className={styles.controls}>
                    <button className={styles.linkButton} onClick={copyChase} type="button">
                      {selected.assigned ? "Copy chase message" : "Copy owner request"}
                    </button>
                  </div>
                </header>

                <ul className={styles.facts2}>
                  <li>
                    <strong>{selected.total}</strong> open
                  </li>
                  <li className={selected.overdue > 0 ? styles.neg : undefined}>
                    <strong>{selected.overdue}</strong> overdue
                  </li>
                  <li>
                    <strong>{selected.soon}</strong> due in {SOON_DAYS} days
                  </li>
                  <li>
                    <strong>{selected.urgent}</strong> high or critical
                  </li>
                  {selected.oldestLate > 0 && (
                    <li className={styles.neg}>
                      oldest <strong>{selected.oldestLate}</strong> {plural(selected.oldestLate, "day", "days")} late
                    </li>
                  )}
                </ul>

                {message && (
                  <p className={styles.statusLine} role="status">
                    {message}
                  </p>
                )}

                <ul className={styles.items}>
                  {rows.map((item) => {
                    const days = item.due - today;

                    return (
                      <li className={item.severity === "critical" && days < 0 ? styles.itemAlert : undefined} key={item.id}>
                        <div className={styles.itemTop}>
                          <span className={cx(styles.sev, SEVERITY_CLASS[item.severity])}>{SEVERITY_LABEL[item.severity]}</span>
                          <span className={styles.itemTitle}>{item.title}</span>
                          <span className={cx(styles.due, days < 0 && styles.dueLate, days >= 0 && days <= SOON_DAYS && styles.dueSoon)}>
                            {dueText(days)}
                          </span>
                          <Link className={styles.itemLink} href={`${base}/${MODULE_PATH[item.module]}`}>
                            Open →
                          </Link>
                        </div>

                        <div className={styles.itemMeta}>
                          <span>
                            {MODULE_LABEL[item.module]} · {item.kind} · {item.reference}
                          </span>
                          <span>{Number.isFinite(item.due) ? formatDay(item.due) : "No date"}</span>
                        </div>

                        <div className={styles.itemDetail}>{item.detail}</div>
                      </li>
                    );
                  })}
                </ul>

                {selected.items.length > ITEM_LIMIT && (
                  <button className={cx(styles.linkButton, styles.moreButton)} onClick={() => setExpanded((open) => !open)} type="button">
                    {expanded ? `Show first ${ITEM_LIMIT}` : `Show all ${selected.items.length}`}
                  </button>
                )}
              </section>
            )}

            <p className={styles.note}>
              Uses the same open items as the action inbox: open governance actions and proposed decisions, risk mitigations, issues and
              change requests, safety actions and permits, NCRs, punch items, RFIs, change orders, claims, certificates, unawarded
              packages and blocked work packages. Names are matched ignoring capital letters and extra spaces, so “A. Karim” and
              “a. karim” count as one person. Items with no owner field filled in appear under “{UNASSIGNED}”.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
