"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { stamp } from "@/lib/changeTracker";
import { MODULES, MODULE_LABEL, MODULE_PATH, SEVERITY_LABEL, buildOpenItems, formatDay, loadSources, plural, projectOf, startOfToday, trunc, type ModuleKey, type OpenItem, type Severity, type Sources } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import {
  MAX_PINS,
  NOTE_LIMIT,
  RESULT_LIMIT,
  SORTS,
  WATCH_PREFIX,
  dueLabel,
  evaluate,
  pinItem,
  readStore,
  searchItems,
  setNote,
  sortViews,
  stateLabel,
  unpin,
  watchMarkdown,
  writeStore,
  type PinView,
  type SortKey,
  type WatchStore,
} from "@/lib/watchlist";

import styles from "./ProjectWatchlistView.module.css";

const SOURCE_COUNT = 9;
const EMPTY: WatchStore = { v: 1, pins: [] };

const SEVERITY_CLASS: Record<Severity, string | undefined> = {
  critical: styles.sevCritical,
  high: styles.sevHigh,
  medium: styles.sevMedium,
  low: styles.sevLow,
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function stateClass(view: PinView): string | undefined {
  if (view.state === "gone" || view.state === "unknown") {
    return styles.stateMuted;
  }

  return view.overdue ? styles.stateBad : view.state === "changed" ? styles.stateWatch : styles.stateGood;
}

export function ProjectWatchlistView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<string[]>([]);
  const [store, setStore] = useState<WatchStore | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [query, setQuery] = useState("");
  const [module, setModule] = useState<ModuleKey | "all">("all");
  const [sort, setSort] = useState<SortKey>("attention");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sure, setSure] = useState(false);
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

  useEffect(() => {
    if (!projectId) {
      return undefined;
    }

    const load = () => {
      const loaded = readStore(projectId);

      setBlocked(loaded.state === "blocked");
      setStore(loaded.state === "ready" ? loaded.store : EMPTY);
    };

    const onStorage = (event: StorageEvent) => {
      if (event.key === `${WATCH_PREFIX}${projectId}` || event.key === null) {
        load();
      }
    };

    load();
    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, [projectId]);

  const items = useMemo(() => (sources ? buildOpenItems(sources, today) : []), [sources, today]);
  const loaded = sources !== null && store !== null;
  const failedAll = sources !== null && failed.length >= SOURCE_COUNT;
  const views = useMemo(() => (store ? evaluate(store, items, failed, today) : []), [store, items, failed, today]);
  const ordered = useMemo(() => sortViews(views, sort), [views, sort]);
  const watching = ordered.filter((view) => view.state !== "gone");
  const closed = ordered.filter((view) => view.state === "gone");
  const pinnedIds = useMemo(() => new Set(store ? store.pins.map((pin) => pin.id) : []), [store]);
  const found = useMemo(() => searchItems(items, query, module, pinnedIds, RESULT_LIMIT), [items, query, module, pinnedIds]);
  const project = sources ? projectOf(sources) : null;
  const projectName = project?.name ?? "Project";
  const needed = failed.filter((key): key is ModuleKey => MODULES.some((item) => item.key === key));
  const full = store !== null && store.pins.length >= MAX_PINS;

  const open = views.filter((view) => view.state === "open" || view.state === "changed");
  const unchecked = views.filter((view) => view.state === "unknown").length;
  const overdue = open.filter((view) => view.overdue).length;
  const soon = open.filter((view) => !view.overdue && view.days !== null && view.days <= 7).length;
  const changed = views.filter((view) => view.state === "changed").length;

  function commit(next: WatchStore, notice: string | null) {
    setStore(next);

    if (projectId && !writeStore(projectId, next)) {
      setBlocked(true);
      setMessage("This browser would not save the change, so it will only last until you leave the page.");

      return;
    }

    setMessage(notice);
  }

  function pin(item: OpenItem) {
    if (!store) {
      return;
    }

    commit(pinItem(store, item, Date.now()), `Now watching ${item.reference}.`);
  }

  function drop(id: string, reference: string) {
    if (!store) {
      return;
    }

    if (editing === id) {
      setEditing(null);
    }

    commit(unpin(store, id), `Stopped watching ${reference}.`);
  }

  function startNote(view: PinView) {
    setEditing(view.pin.id);
    setDraft(view.pin.note);
  }

  function saveNote(id: string) {
    if (!store) {
      return;
    }

    commit(setNote(store, id, draft.trim()), "Note saved.");
    setEditing(null);
  }

  function clearResolved() {
    if (!store) {
      return;
    }

    const goneIds = new Set(closed.map((view) => view.pin.id));

    commit({ v: 1, pins: store.pins.filter((entry) => !goneIds.has(entry.id)) }, `Removed ${goneIds.size} closed ${plural(goneIds.size, "item", "items")}.`);
  }

  function clearAll() {
    if (!sure) {
      setSure(true);

      return;
    }

    setSure(false);
    commit(EMPTY, "Watchlist cleared.");
  }

  async function copyList() {
    const ok = await copyText(watchMarkdown(ordered, projectName, today));

    setMessage(ok ? "Copied the watchlist as Markdown." : "Could not copy the watchlist.");
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

            <div className="eyebrow">MY WATCHLIST</div>

            <h1>What am I keeping an eye on?</h1>

            <p className={styles.subtitle}>
              Pin the open items you personally care about, from any part of the project. This page tells you when one changes, goes overdue or is closed, so you never have to hunt for it again. Your list is kept in this browser.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/inbox`}>
              Open items inbox
            </Link>

            <Link className="secondary-link-button" href={`${base}/whats-new`}>
              Since my last visit
            </Link>
          </div>
        </header>

        {!loaded && <div className={styles.loading}>Checking your watchlist…</div>}

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
              <span> Pinned items from {needed.length > 1 ? "them" : "it"} cannot be checked right now.</span>
            </div>
          </div>
        )}

        {loaded && blocked && (
          <div className="offline-banner">
            <div>
              <strong>This browser is blocking saved data.</strong>
              <span> Your pins will last only while this page stays open.</span>
            </div>
          </div>
        )}

        {loaded && !failedAll && store && (
          <>
            <section aria-label="Watchlist summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>WATCHING</div>
                <div className={styles.kpiValue}>{watching.length}</div>
                <div className={styles.kpiSub}>{unchecked > 0 ? `${unchecked} could not be checked` : watching.length === 1 ? "open item" : "open items"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVERDUE</div>
                <div className={cx(styles.kpiValue, overdue > 0 && styles.neg)}>{overdue}</div>
                <div className={styles.kpiSub}>past their due date</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DUE IN 7 DAYS</div>
                <div className={styles.kpiValue}>{soon}</div>
                <div className={styles.kpiSub}>coming up this week</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CHANGED</div>
                <div className={cx(styles.kpiValue, changed > 0 && styles.warn)}>{changed}</div>
                <div className={styles.kpiSub}>since you pinned them</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO LONGER OPEN</div>
                <div className={cx(styles.kpiValue, closed.length > 0 && styles.pos)}>{closed.length}</div>
                <div className={styles.kpiSub}>closed since pinned</div>
              </article>
            </section>

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WATCHING</div>
                  <h2>Your pinned items</h2>
                </div>

                <div className={styles.tools}>
                  <div aria-label="Sort pinned items" className={styles.segmented} role="group">
                    {SORTS.map((option) => (
                      <button aria-pressed={sort === option.key} className={cx(styles.segment, sort === option.key && styles.segmentOn)} key={option.key} onClick={() => setSort(option.key)} type="button">
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <button className={styles.linkAction} disabled={views.length === 0} onClick={copyList} type="button">
                    Copy as Markdown
                  </button>
                </div>
              </header>

              {watching.length === 0 ? (
                <div className={styles.emptySmall}>
                  {closed.length > 0 ? "Everything you were watching has been closed." : "Nothing pinned yet. Search below and press Pin on anything you want to keep an eye on."}
                </div>
              ) : (
                <ul className={styles.cards}>
                  {watching.map((view) => {
                    const snap = view.pin.snap;
                    const item = view.item;
                    const unknown = view.state === "unknown";

                    return (
                      <li className={cx(styles.card, view.overdue && styles.cardBad, view.state === "changed" && !view.overdue && styles.cardWatch, unknown && styles.cardMuted)} key={view.pin.id}>
                        <div className={styles.cardTop}>
                          <div className={styles.cardId}>
                            <strong>{snap.r}</strong>
                            <span className={styles.chip}>{MODULE_LABEL[snap.m]}</span>
                            <span className={styles.chip}>{snap.k}</span>
                          </div>

                          <span className={cx(styles.state, stateClass(view))}>{stateLabel(view)}</span>
                        </div>

                        <Link className={styles.cardTitle} href={`${base}/${MODULE_PATH[snap.m]}`}>
                          {item ? item.title : snap.t}
                        </Link>

                        <div className={styles.cardMeta}>
                          <span className={cx(styles.sev, SEVERITY_CLASS[item ? item.severity : snap.s])}>{SEVERITY_LABEL[item ? item.severity : snap.s]}</span>
                          {item ? <span>{dueLabel(view.days)}</span> : <span>Last due {snap.d === null ? "date unknown" : formatDay(snap.d)}</span>}
                          <span>{(item ? item.owner : snap.o) ?? "No owner"}</span>
                          <span>pinned {stamp(view.pin.at)}</span>
                        </div>

                        {item && item.detail && <p className={styles.detail}>{item.detail}</p>}
                        {unknown && <p className={styles.detail}>The {MODULE_LABEL[snap.m].toLowerCase()} data did not load, so this item could not be checked.{snap.x ? ` Last seen: ${snap.x}.` : ""}</p>}

                        {view.notes.length > 0 || view.became ? (
                          <ul className={styles.changes}>
                            {view.became && !view.notes.some((note) => note.startsWith("Due date")) && <li>It has passed its due date since you pinned it</li>}
                            {view.notes.map((note) => (
                              <li key={note}>{note}</li>
                            ))}
                          </ul>
                        ) : null}

                        {editing === view.pin.id ? (
                          <div className={styles.noteForm}>
                            <label className={styles.srOnly} htmlFor={`note-${view.pin.id}`}>
                              Note for {snap.r}
                            </label>

                            <input
                              autoFocus
                              className={styles.noteInput}
                              id={`note-${view.pin.id}`}
                              maxLength={NOTE_LIMIT}
                              onChange={(event) => setDraft(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  saveNote(view.pin.id);
                                } else if (event.key === "Escape") {
                                  setEditing(null);
                                }
                              }}
                              placeholder="Why are you watching this?"
                              type="text"
                              value={draft}
                            />

                            <button className={styles.actionButton} onClick={() => saveNote(view.pin.id)} type="button">
                              Save
                            </button>

                            <button className={styles.linkAction} onClick={() => setEditing(null)} type="button">
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className={styles.cardActions}>
                            {view.pin.note ? <p className={styles.pinNote}>“{view.pin.note}”</p> : null}

                            <button className={styles.linkAction} onClick={() => startNote(view)} type="button">
                              {view.pin.note ? "Edit note" : "Add note"}
                            </button>

                            <Link className={styles.linkAction} href={`${base}/${MODULE_PATH[snap.m]}`}>
                              Open {MODULE_LABEL[snap.m].toLowerCase()}
                            </Link>

                            <button className={styles.linkAction} onClick={() => drop(view.pin.id, snap.r)} type="button">
                              Stop watching
                            </button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {closed.length > 0 && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">RESOLVED</div>
                    <h2>No longer open</h2>
                  </div>

                  <button className={styles.linkAction} onClick={clearResolved} type="button">
                    Remove these {closed.length}
                  </button>
                </header>

                <p className={styles.hint}>These were open when you pinned them and have since been closed, completed, answered or removed.</p>

                <ul className={styles.cards}>
                  {closed.map((view) => (
                    <li className={cx(styles.card, styles.cardDone)} key={view.pin.id}>
                      <div className={styles.cardTop}>
                        <div className={styles.cardId}>
                          <strong>{view.pin.snap.r}</strong>
                          <span className={styles.chip}>{MODULE_LABEL[view.pin.snap.m]}</span>
                        </div>

                        <span className={cx(styles.state, styles.stateGood)}>Closed</span>
                      </div>

                      <span className={styles.struck}>{view.pin.snap.t}</span>

                      <div className={styles.cardMeta}>
                        <span>pinned {stamp(view.pin.at)}</span>
                        <span>was due {view.pin.snap.d === null ? "—" : formatDay(view.pin.snap.d)}</span>
                        {view.pin.note && <span>“{trunc(view.pin.note, 60)}”</span>}
                      </div>

                      <div className={styles.cardActions}>
                        <button className={styles.linkAction} onClick={() => drop(view.pin.id, view.pin.snap.r)} type="button">
                          Remove
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">ADD</div>
                  <h2>Pin something to watch</h2>
                </div>

                <span className={styles.muted}>
                  {full ? `Your list is full (${MAX_PINS})` : `${store.pins.length} of ${MAX_PINS} used`}
                </span>
              </header>

              <div className={styles.searchRow}>
                <div className={styles.field}>
                  <label className={styles.controlLabel} htmlFor="watch-search">
                    Search open items
                  </label>

                  <input
                    className={styles.search}
                    id="watch-search"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Reference, title, owner, status…"
                    type="search"
                    value={query}
                  />
                </div>

                <div className={styles.field}>
                  <label className={styles.controlLabel} htmlFor="watch-area">
                    Area
                  </label>

                  <select className={styles.select} id="watch-area" onChange={(event) => setModule(event.target.value as ModuleKey | "all")} value={module}>
                    <option value="all">All areas</option>
                    {MODULES.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className={styles.resultHead}>
                {query.trim() === "" ? "Most urgent open items" : `${found.total} ${plural(found.total, "match", "matches")}`}
                {found.total > found.results.length ? `, showing the first ${found.results.length}` : ""}
              </p>

              {found.results.length === 0 ? (
                <div className={styles.emptySmall}>{items.length === 0 ? "There are no open items to pin." : query.trim() === "" && pinnedIds.size > 0 ? "Everything open in this area is already on your watchlist." : "No open item matches that search."}</div>
              ) : (
                <ul className={styles.results}>
                  {found.results.map((item) => (
                    <li key={item.id}>
                      <div className={styles.resultMain}>
                        <div className={styles.cardId}>
                          <strong>{item.reference}</strong>
                          <span className={styles.chip}>{MODULE_LABEL[item.module]}</span>
                          <span className={cx(styles.sev, SEVERITY_CLASS[item.severity])}>{SEVERITY_LABEL[item.severity]}</span>
                        </div>

                        <span className={styles.resultTitle}>{trunc(item.title, 90)}</span>

                        <span className={styles.cardMeta}>
                          <span>{dueLabel(Number.isFinite(item.due) ? item.due - today : null)}</span>
                          <span>{item.owner ?? "No owner"}</span>
                        </span>
                      </div>

                      <button className={styles.actionButton} disabled={full} onClick={() => pin(item)} type="button">
                        Pin
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {views.length > 0 && (
              <div className={styles.danger}>
                <button className={styles.linkAction} onClick={clearAll} type="button">
                  {sure ? `Click again to remove all ${views.length}` : "Clear the whole watchlist"}
                </button>

                {sure && (
                  <button className={styles.linkAction} onClick={() => setSure(false)} type="button">
                    Cancel
                  </button>
                )}
              </div>
            )}

            <p className={styles.note}>
              Pins are saved in this browser for this project only, so they do not follow you to another device or browser and nobody else sees them. An item counts as “changed” when its due date, priority, owner or status differs from the moment you pinned it. It moves to “No longer open” when it disappears from the open items, which means it was closed, completed, answered or removed.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
