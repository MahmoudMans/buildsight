"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  LIST_PREVIEW,
  changesMarkdown,
  compare,
  merge,
  readStore,
  stamp,
  totalChanges,
  writeStore,
  type GoneItem,
  type Store,
} from "@/lib/changeTracker";
import {
  MODULES,
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
  type OpenItem,
  type Severity,
  type Sources,
} from "@/lib/openItems";
import { copyText } from "@/lib/textExport";

import styles from "./ProjectWhatsNewView.module.css";

const SOURCE_COUNT = 9;

type SectionKey = "fresh" | "late" | "changed" | "gone";
type Mode = "loading" | "first" | "compare" | "blocked";

const SEV_CLASS: Record<Severity, string | undefined> = {
  critical: styles.sevCritical,
  high: styles.sevHigh,
  medium: styles.sevMedium,
  low: styles.sevLow,
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

export function ProjectWhatsNewView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);
  const started = useRef(false);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [mode, setMode] = useState<Mode>("loading");
  const [store, setStore] = useState<Store | null>(null);
  const [filter, setFilter] = useState<ModuleKey | "all">("all");
  const [shown, setShown] = useState<Record<SectionKey, boolean>>({ fresh: false, late: false, changed: false, gone: false });
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

  const items = useMemo(() => (sources ? buildOpenItems(sources, today) : []), [sources, today]);
  const failedAll = sources !== null && failed.length >= SOURCE_COUNT;

  useEffect(() => {
    if (!sources || !projectId || started.current) {
      return;
    }

    started.current = true;

    if (failed.length >= SOURCE_COUNT) {
      setMode("compare");

      return;
    }

    const saved = readStore(projectId);

    if (saved.state === "blocked") {
      setMode("blocked");

      return;
    }

    if (saved.state === "ready") {
      setStore(saved.store);
      setMode("compare");

      return;
    }

    const baseline = merge(items, null, failed, today, Date.now());

    if (writeStore(projectId, baseline)) {
      setStore(baseline);
      setMode("first");
    } else {
      setMode("blocked");
    }
  }, [sources, projectId, failed, items, today]);

  const diff = useMemo(() => (store && mode === "compare" ? compare(items, store, failed, today) : null), [store, mode, items, failed, today]);
  const project = sources ? projectOf(sources) : null;
  const projectName = project?.name ?? "Project";

  const counts = useMemo(() => {
    const tally = new Map<ModuleKey, number>();

    if (!diff) {
      return tally;
    }

    const add = (key: ModuleKey) => tally.set(key, (tally.get(key) ?? 0) + 1);

    diff.fresh.forEach((item) => add(item.module));
    diff.late.forEach((item) => add(item.module));
    diff.changed.forEach((change) => add(change.item.module));
    diff.gone.forEach((item) => add(item.m));

    return tally;
  }, [diff]);

  const chips = MODULES.filter((module) => (counts.get(module.key) ?? 0) > 0);
  const active: ModuleKey | "all" = filter !== "all" && (counts.get(filter) ?? 0) === 0 ? "all" : filter;
  const keep = (key: ModuleKey) => active === "all" || active === key;

  const fresh = diff ? diff.fresh.filter((item) => keep(item.module)) : [];
  const late = diff ? diff.late.filter((item) => keep(item.module)) : [];
  const changed = diff ? diff.changed.filter((change) => keep(change.item.module)) : [];
  const gone = diff ? diff.gone.filter((item) => keep(item.m)) : [];

  const perModule = useMemo(() => {
    const tally = new Map<ModuleKey, number>();

    for (const item of items) {
      tally.set(item.module, (tally.get(item.module) ?? 0) + 1);
    }

    return MODULES.filter((module) => (tally.get(module.key) ?? 0) > 0).map((module) => ({ ...module, count: tally.get(module.key) ?? 0 }));
  }, [items]);

  function markSeen() {
    if (!projectId) {
      return;
    }

    const next = merge(items, store, failed, today, Date.now());

    if (writeStore(projectId, next)) {
      setStore(next);
      setFilter("all");
      setMessage("Marked as seen. From now on this page shows what changes after this moment.");
    } else {
      setMessage("This browser would not save the new starting point.");
    }
  }

  async function copyChanges() {
    if (!diff || !store) {
      return;
    }

    const ok = await copyText(changesMarkdown(diff, projectName, store.savedAt, today, items.length));

    setMessage(ok ? "Copied the changes as Markdown." : "Could not copy the changes.");
  }

  function flip(key: SectionKey) {
    setShown((value) => ({ ...value, [key]: !value[key] }));
  }

  function dueText(item: OpenItem): ReactNode {
    if (!Number.isFinite(item.due)) {
      return "No due date";
    }

    const gap = today - item.due;

    return gap > 0 ? (
      <span className={styles.bad}>
        Due {formatDay(item.due)} · {gap} {plural(gap, "day", "days")} overdue
      </span>
    ) : (
      `Due ${formatDay(item.due)}`
    );
  }

  function itemRow(item: OpenItem, notes?: string[]) {
    return (
      <li className={styles.item} key={item.id}>
        <div className={styles.rowTop}>
          <Link className={styles.moduleTag} href={`${base}/${MODULE_PATH[item.module]}`}>
            {MODULE_LABEL[item.module]}
          </Link>

          <span className={cx(styles.sev, SEV_CLASS[item.severity])}>{SEVERITY_LABEL[item.severity]}</span>

          <span className={styles.kind}>{item.kind}</span>
        </div>

        <div className={styles.rowMain}>
          <strong>{item.reference}</strong> {item.title}
        </div>

        <div className={styles.rowMeta}>
          {item.detail && <span>{item.detail}</span>}
          <span>{item.owner ?? "No owner"}</span>
          <span>{dueText(item)}</span>
        </div>

        {notes && notes.length > 0 && (
          <ul className={styles.notes}>
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  function goneRow(item: GoneItem) {
    return (
      <li className={styles.item} key={item.id}>
        <div className={styles.rowTop}>
          <span className={styles.moduleTagPlain}>{MODULE_LABEL[item.m]}</span>
          <span className={styles.kind}>{item.k}</span>
        </div>

        <div className={styles.rowMain}>
          <strong>{item.r}</strong> {item.t}
        </div>

        <div className={styles.rowMeta}>
          {item.x && <span>Was: {item.x}</span>}
          <span>{item.o ?? "No owner"}</span>
          <span>{item.d === null ? "No due date" : `Was due ${formatDay(item.d)}`}</span>
        </div>
      </li>
    );
  }

  function section<T>(key: SectionKey, title: string, hint: string, list: T[], render: (entry: T) => ReactNode, accent: string | undefined) {
    if (list.length === 0) {
      return null;
    }

    const all = shown[key];
    const visible = all ? list : list.slice(0, LIST_PREVIEW);

    return (
      <section className={cx(styles.panel, accent)} key={key}>
        <header className={styles.panelHead}>
          <div>
            <div className="eyebrow">{title.toUpperCase()}</div>
            <h2>
              {list.length} {hint}
            </h2>
          </div>
        </header>

        <ul className={styles.list}>{visible.map((entry) => render(entry))}</ul>

        {list.length > LIST_PREVIEW && (
          <button aria-expanded={all} className={styles.linkButton} onClick={() => flip(key)} type="button">
            {all ? "Show fewer" : `Show all ${list.length}`}
          </button>
        )}
      </section>
    );
  }

  const loaded = sources !== null;
  const everything = diff ? totalChanges(diff) : 0;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">SINCE YOU LAST LOOKED</div>

            <h1>What has moved since my last visit?</h1>

            <p className={styles.subtitle}>
              New items, items that changed hands or dates, work that closed and what slipped overdue, compared with a snapshot this browser
              saved the last time you marked everything as seen.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/inbox`}>
              Open items inbox
            </Link>

            <Link className="secondary-link-button" href={`${base}/activity`}>
              Activity feed
            </Link>
          </div>
        </header>

        {!loaded && <div className={styles.loading}>Reading the open items…</div>}

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
              <span> Items from {failed.length > 1 ? "those modules" : "that module"} are left out of the comparison and stay as they were at your last visit.</span>
            </div>
          </div>
        )}

        {loaded && !failedAll && mode === "blocked" && (
          <section className={styles.panel}>
            <header className={styles.panelHead}>
              <div>
                <div className="eyebrow">NOTHING TO COMPARE</div>
                <h2>This browser will not keep a snapshot</h2>
              </div>
            </header>

            <p className={styles.plain}>
              The page saves its comparison point in your browser, and storage looks switched off here, which usually means a private window or
              blocked site data. {items.length} {plural(items.length, "item is", "items are")} open right now. Open this page in a normal window to
              start tracking changes.
            </p>
          </section>
        )}

        {loaded && !failedAll && mode === "first" && (
          <section className={styles.panel}>
            <header className={styles.panelHead}>
              <div>
                <div className="eyebrow">FIRST VISIT</div>
                <h2>Starting point saved</h2>
              </div>
            </header>

            <p className={styles.plain}>
              This is the first time this browser has opened this page for the project, so there is nothing to compare yet. A snapshot of the{" "}
              {items.length} open {plural(items.length, "item", "items")} was saved just now. Come back later and this page shows what is new,
              changed, closed or newly overdue since then.
            </p>

            <ul className={styles.mods}>
              {perModule.map((module) => (
                <li key={module.key}>
                  <span>{module.label}</span>
                  <strong>{module.count}</strong>
                </li>
              ))}
            </ul>
          </section>
        )}

        {loaded && !failedAll && mode === "compare" && diff && store && (
          <>
            <section aria-label="Changes summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>NEW</div>
                <div className={styles.kpiValue}>{diff.fresh.length}</div>
                <div className={styles.kpiSub}>{plural(diff.fresh.length, "item", "items")} raised since</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NEWLY OVERDUE</div>
                <div className={cx(styles.kpiValue, diff.late.length > 0 && styles.neg)}>{diff.late.length}</div>
                <div className={styles.kpiSub}>passed their due date</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CHANGED</div>
                <div className={styles.kpiValue}>{diff.changed.length}</div>
                <div className={styles.kpiSub}>owner, date, status or severity</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO LONGER OPEN</div>
                <div className={cx(styles.kpiValue, diff.gone.length > 0 && styles.pos)}>{diff.gone.length}</div>
                <div className={styles.kpiSub}>closed or removed</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN NOW</div>
                <div className={styles.kpiValue}>{items.length}</div>
                <div className={styles.kpiSub}>across {perModule.length} {plural(perModule.length, "module", "modules")}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <p className={styles.since}>
                Comparing with the snapshot from <strong>{stamp(store.savedAt)}</strong>.
              </p>

              <div className={styles.actions}>
                {everything > 0 && (
                  <button className={styles.linkButton} onClick={copyChanges} type="button">
                    Copy as Markdown
                  </button>
                )}

                <button className={styles.actionButton} onClick={markSeen} type="button">
                  Mark everything as seen
                </button>
              </div>
            </section>

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            {chips.length > 1 && (
              <div aria-label="Filter by module" className={styles.segmented} role="group">
                <button aria-pressed={active === "all"} className={cx(styles.segment, active === "all" && styles.segmentOn)} onClick={() => setFilter("all")} type="button">
                  All <span>{everything}</span>
                </button>

                {chips.map((module) => (
                  <button
                    aria-pressed={active === module.key}
                    className={cx(styles.segment, active === module.key && styles.segmentOn)}
                    key={module.key}
                    onClick={() => setFilter(module.key)}
                    type="button"
                  >
                    {module.label} <span>{counts.get(module.key) ?? 0}</span>
                  </button>
                ))}
              </div>
            )}

            {everything === 0 && (
              <section className={styles.panel}>
                <div className={styles.quiet}>
                  <strong>Nothing has changed.</strong>
                  <span>
                    No new, changed, closed or newly overdue items since {stamp(store.savedAt)}. {items.length} {plural(items.length, "item is", "items are")} open.
                  </span>
                </div>
              </section>
            )}

            {section("fresh", "New", plural(fresh.length, "new item", "new items"), fresh, (item) => itemRow(item), styles.accentNew)}
            {section("late", "Newly overdue", plural(late.length, "item newly overdue", "items newly overdue"), late, (item) => itemRow(item), styles.accentLate)}
            {section(
              "changed",
              "Changed",
              plural(changed.length, "item changed", "items changed"),
              changed,
              (change) => itemRow(change.item, change.notes),
              styles.accentChanged,
            )}
            {section("gone", "No longer open", plural(gone.length, "item no longer open", "items no longer open"), gone, (item) => goneRow(item), styles.accentGone)}

            {diff.held > 0 && (
              <p className={styles.note}>
                {diff.held} {plural(diff.held, "item", "items")} from modules that could not be loaded {plural(diff.held, "was", "were")} left out of this comparison.
              </p>
            )}

            <p className={styles.note}>
              The snapshot lives only in this browser, so another device or browser starts from its own first visit. Nothing resets until you press
              Mark everything as seen. No longer open means the item is not in the open list any more, which covers items that were closed,
              completed, voided or removed. Changed compares owner, due date, severity and the status text, and ignores waiting-time counters that
              tick up on their own.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
