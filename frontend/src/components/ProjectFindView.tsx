"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { MODULES, MODULE_LABEL, MODULE_PATH, formatDay, loadSources, plural, startOfToday, type ModuleKey, type Sources } from "@/lib/openItems";
import { buildSearchIndex, countByModule, highlight, runSearch, snippetFor, tokenize, type SearchRecord } from "@/lib/searchIndex";
import { copyText } from "@/lib/textExport";

import styles from "./ProjectFindView.module.css";

const SOURCE_COUNT = 9;
const PAGE_SIZE = 40;
const RECENT_LIMIT = 6;
const SUGGESTIONS = ["overdue", "blocked", "critical", "expired", "open"];
const ALERT_FLAG = /overdue|expired|blocked|missing/i;

interface WatchEntry {
  id: string;
  status: string;
  since: string;
}

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // storage can be blocked; the page still works for this visit
  }
}

function readWatch(key: string): WatchEntry[] {
  const raw = storageGet(key);

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((entry): WatchEntry[] => {
      const item = entry as Partial<WatchEntry> | null;

      return item && typeof item.id === "string" && typeof item.status === "string" && typeof item.since === "string"
        ? [{ id: item.id, status: item.status, since: item.since }]
        : [];
    });
  } catch {
    return [];
  }
}

function readRecent(key: string): string[] {
  const raw = storageGet(key);

  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function Marked({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlight(text, terms).map((part, index) =>
        part.hit ? (
          <mark className={styles.mark} key={index}>
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}

function dateText(record: SearchRecord): string {
  return Number.isFinite(record.day) && record.dayLabel !== "" ? `${record.dayLabel} ${formatDay(record.day)}` : "";
}

export function ProjectFindView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";
  const watchKey = `buildsight.watchlist.${projectId ?? "none"}`;
  const recentKey = `buildsight.find.recent.${projectId ?? "none"}`;

  const today = useMemo(startOfToday, []);
  const inputRef = useRef<HTMLInputElement>(null);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [query, setQuery] = useState("");
  const [moduleFilter, setModuleFilter] = useState<ModuleKey | "all">("all");
  const [kindFilter, setKindFilter] = useState("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const [watch, setWatch] = useState<WatchEntry[]>([]);
  const [recent, setRecent] = useState<string[]>([]);
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

  useEffect(() => {
    setWatch(readWatch(watchKey));
    setRecent(readRecent(recentKey));

    try {
      const initial = new URLSearchParams(window.location.search).get("q");

      if (initial) {
        setQuery(initial);
      }
    } catch {
      // no address bar to read
    }
  }, [watchKey, recentKey]);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);

      if (query.trim() === "") {
        url.searchParams.delete("q");
      } else {
        url.searchParams.set("q", query.trim());
      }

      if (url.href !== window.location.href) {
        window.history.replaceState(null, "", url.href);
      }
    } catch {
      // address bar not available
    }
  }, [query]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);

      if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const records = useMemo(() => (sources ? buildSearchIndex(sources, today) : []), [sources, today]);
  const byId = useMemo(() => new Map(records.map((record) => [record.id, record])), [records]);
  const terms = useMemo(() => tokenize(query), [query]);

  const kinds = useMemo(() => {
    const names = new Set<string>();

    for (const record of records) {
      if (moduleFilter === "all" || record.module === moduleFilter) {
        names.add(record.kind);
      }
    }

    return [...names].sort((a, b) => a.localeCompare(b));
  }, [records, moduleFilter]);

  const kind = kinds.includes(kindFilter) ? kindFilter : "all";

  const browsing = terms.length > 0 || moduleFilter !== "all" || kind !== "all";

  const hits = useMemo(() => runSearch(records, terms, { module: moduleFilter, kind }), [records, terms, moduleFilter, kind]);
  const counts = useMemo(() => countByModule(records, terms, kind), [records, terms, kind]);
  const countAll = useMemo(() => [...counts.values()].reduce((sum, value) => sum + value, 0), [counts]);

  const indexCounts = useMemo(() => {
    const map = new Map<ModuleKey, Map<string, number>>();

    for (const record of records) {
      const inner = map.get(record.module) ?? new Map<string, number>();

      inner.set(record.kind, (inner.get(record.kind) ?? 0) + 1);
      map.set(record.module, inner);
    }

    return map;
  }, [records]);

  const watched = useMemo(() => new Set(watch.map((entry) => entry.id)), [watch]);

  function saveWatch(next: WatchEntry[]) {
    setWatch(next);
    storageSet(watchKey, JSON.stringify(next));
  }

  function toggleWatch(record: SearchRecord) {
    if (watched.has(record.id)) {
      saveWatch(watch.filter((entry) => entry.id !== record.id));
    } else {
      saveWatch([...watch, { id: record.id, status: record.status, since: new Date(today * 86_400_000).toISOString().slice(0, 10) }]);
    }

    setMessage(null);
  }

  function markSeen(record: SearchRecord) {
    saveWatch(watch.map((entry) => (entry.id === record.id ? { ...entry, status: record.status } : entry)));
  }

  function remember(term: string) {
    const clean = term.trim();

    if (clean === "") {
      return;
    }

    const next = [clean, ...recent.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, RECENT_LIMIT);

    setRecent(next);
    storageSet(recentKey, JSON.stringify(next));
  }

  function forgetRecent() {
    setRecent([]);
    storageSet(recentKey, "[]");
  }

  function chooseModule(next: ModuleKey | "all") {
    setModuleFilter(next);
    setKindFilter("all");
    setShown(PAGE_SIZE);
  }

  async function copyWatchlist() {
    const lines = ["# Watchlist", ""];

    for (const entry of watch) {
      const record = byId.get(entry.id);

      if (!record) {
        continue;
      }

      const when = Number.isFinite(record.day) && record.dayLabel !== "" ? `, ${record.dayLabel.toLowerCase()} ${formatDay(record.day)}` : "";

      lines.push(`- **${record.reference || record.kind}** ${record.title} — ${record.status || "no status"} (${MODULE_LABEL[record.module]}, ${record.kind})${when}`);
    }

    if (lines.length === 2) {
      lines.push("Nothing on the watchlist.");
    }

    const ok = await copyText(`${lines.join("\n")}\n`);

    setMessage(ok ? "Copied the watchlist as Markdown." : "Could not copy the watchlist.");
  }

  const loaded = sources !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;
  const nothingIndexed = loaded && !failedAll && records.length === 0;
  const visible = hits.slice(0, shown);

  const changedCount = watch.filter((entry) => {
    const record = byId.get(entry.id);

    return record !== undefined && record.status !== entry.status;
  }).length;

  function renderResult(record: SearchRecord) {
    const snippet = snippetFor(record, terms);
    const when = dateText(record);

    return (
      <li className={record.flags.some((flag) => ALERT_FLAG.test(flag)) ? styles.resultAlert : undefined} key={record.id}>
        <div className={styles.resultTop}>
          <span className={styles.kindTag}>
            {MODULE_LABEL[record.module]} · {record.kind}
          </span>

          <span className={styles.resultTitle}>
            {record.reference !== "" && (
              <strong className={styles.reference}>
                <Marked terms={terms} text={record.reference} />
              </strong>
            )}
            <Marked terms={terms} text={record.title} />
          </span>

          <button
            aria-pressed={watched.has(record.id)}
            className={cx(styles.watchButton, watched.has(record.id) && styles.watchOn)}
            onClick={() => toggleWatch(record)}
            type="button"
          >
            {watched.has(record.id) ? "★ Watching" : "☆ Watch"}
          </button>
        </div>

        <div className={styles.resultMeta}>
          {record.status !== "" && (
            <span className={styles.statusTag}>
              <Marked terms={terms} text={record.status} />
            </span>
          )}

          {record.flags.map((flag) => (
            <span className={cx(styles.flag, ALERT_FLAG.test(flag) && styles.flagAlert)} key={flag}>
              <Marked terms={terms} text={flag} />
            </span>
          ))}

          <span className={styles.metaText}>
            {[record.owner, when].filter((part) => part && part !== "").join(" · ")}
          </span>

          <Link className={styles.openLink} href={`${base}/${MODULE_PATH[record.module]}`} onClick={() => remember(query)}>
            Open →
          </Link>
        </div>

        {snippet && (
          <div className={styles.snippet}>
            <Marked terms={terms} text={snippet} />
          </div>
        )}
      </li>
    );
  }

  function renderWatched(entry: WatchEntry) {
    const record = byId.get(entry.id);

    if (!record) {
      return (
        <li className={styles.watchGone} key={entry.id}>
          <div className={styles.resultTop}>
            <span className={styles.resultTitle}>This record is no longer in the data.</span>

            <button className={styles.linkButton} onClick={() => saveWatch(watch.filter((item) => item.id !== entry.id))} type="button">
              Remove
            </button>
          </div>
        </li>
      );
    }

    const changed = record.status !== entry.status;
    const when = dateText(record);

    return (
      <li className={cx(changed && styles.watchChanged)} key={entry.id}>
        <div className={styles.resultTop}>
          <span className={styles.kindTag}>
            {MODULE_LABEL[record.module]} · {record.kind}
          </span>

          <span className={styles.resultTitle}>
            {record.reference !== "" && <strong className={styles.reference}>{record.reference}</strong>}
            {record.title}
          </span>

          <button className={styles.linkButton} onClick={() => toggleWatch(record)} type="button">
            Remove
          </button>
        </div>

        <div className={styles.resultMeta}>
          <span className={styles.statusTag}>{record.status || "No status"}</span>

          {changed && (
            <span className={cx(styles.flag, styles.flagChanged)}>
              Was {entry.status || "no status"}
            </span>
          )}

          {record.flags.map((flag) => (
            <span className={cx(styles.flag, ALERT_FLAG.test(flag) && styles.flagAlert)} key={flag}>
              {flag}
            </span>
          ))}

          <span className={styles.metaText}>
            {[record.owner, when, `watching since ${formatDay(Date.parse(entry.since) / 86_400_000)}`].filter((part) => part && part !== "").join(" · ")}
          </span>

          {changed && (
            <button className={styles.linkButton} onClick={() => markSeen(record)} type="button">
              Mark as seen
            </button>
          )}

          <Link className={styles.openLink} href={`${base}/${MODULE_PATH[record.module]}`}>
            Open →
          </Link>
        </div>
      </li>
    );
  }

  const watchPanel =
    watch.length > 0 ? (
      <section className={styles.panel}>
        <header className={styles.panelHead}>
          <div>
            <div className="eyebrow">WATCHLIST</div>
            <h2>
              Records you are following <span className={styles.count}>{watch.length}</span>
            </h2>
          </div>

          <button className={styles.linkButton} onClick={copyWatchlist} type="button">
            Copy as Markdown
          </button>
        </header>

        {message && (
          <p className={styles.statusLine} role="status">
            {message}
          </p>
        )}

        {changedCount > 0 && (
          <p className={styles.changedLine}>
            {changedCount} of {watch.length} changed status since you started watching.
          </p>
        )}

        <ul className={styles.results}>{watch.map(renderWatched)}</ul>
      </section>
    ) : null;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">FIND</div>

            <h1>Find anything in this project</h1>

            <p className={styles.subtitle}>
              One search across every register: actions, risks, RFIs, NCRs, claims, packages, milestones and the rest. Watch the records
              you care about and see when their status changes.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/map`}>
            Open project map
          </Link>
        </header>

        {!loaded && <div className={styles.loading}>Indexing the project…</div>}

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
              <span> Those records cannot be found until the backend answers.</span>
            </div>
          </div>
        )}

        {nothingIndexed && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No records are loaded yet, so there is nothing to search. Add some and come back.</div>
          </section>
        )}

        {loaded && !failedAll && !nothingIndexed && (
          <>
            <section className={styles.searchPanel}>
              <div className={styles.searchRow}>
                <input
                  aria-label="Search every record"
                  autoComplete="off"
                  className={styles.searchBox}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setShown(PAGE_SIZE);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      remember(query);
                    }

                    if (event.key === "Escape") {
                      if (query !== "") {
                        setQuery("");
                      } else {
                        event.currentTarget.blur();
                      }
                    }
                  }}
                  placeholder="Search by reference, title or owner…"
                  ref={inputRef}
                  spellCheck={false}
                  type="text"
                  value={query}
                />

                {query !== "" ? (
                  <button className={styles.clearButton} onClick={() => setQuery("")} type="button">
                    Clear
                  </button>
                ) : (
                  <span className={styles.slashHint}>
                    Press <kbd>/</kbd>
                  </span>
                )}
              </div>

              <div aria-label="Limit to one module" className={styles.chips} role="group">
                <button
                  aria-pressed={moduleFilter === "all"}
                  className={cx(styles.chip, moduleFilter === "all" && styles.chipOn)}
                  onClick={() => chooseModule("all")}
                  type="button"
                >
                  Everything <span>{browsing ? countAll : records.length}</span>
                </button>

                {MODULES.map((item) => {
                  const count = browsing ? (counts.get(item.key) ?? 0) : [...(indexCounts.get(item.key)?.values() ?? [])].reduce((sum, value) => sum + value, 0);

                  return (
                    <button
                      aria-pressed={moduleFilter === item.key}
                      className={cx(styles.chip, moduleFilter === item.key && styles.chipOn, count === 0 && moduleFilter !== item.key && styles.chipEmpty)}
                      key={item.key}
                      onClick={() => chooseModule(item.key)}
                      type="button"
                    >
                      {item.label} <span>{count}</span>
                    </button>
                  );
                })}
              </div>

              <div className={styles.filterRow}>
                <label className={styles.kindPick}>
                  <span>Kind of record</span>

                  <select
                    className={styles.select}
                    onChange={(event) => {
                      setKindFilter(event.target.value);
                      setShown(PAGE_SIZE);
                    }}
                    value={kind}
                  >
                    <option value="all">All kinds</option>
                    {kinds.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>

                {(moduleFilter !== "all" || kind !== "all") && (
                  <button
                    className={styles.linkButton}
                    onClick={() => {
                      chooseModule("all");
                    }}
                    type="button"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </section>

            {!browsing && watchPanel}

            {!browsing && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">TRY</div>
                    <h2>Start with a word</h2>
                  </div>
                </header>

                <div className={styles.suggestions}>
                  {SUGGESTIONS.map((word) => (
                    <button
                      className={styles.suggestion}
                      key={word}
                      onClick={() => {
                        setQuery(word);
                        remember(word);
                      }}
                      type="button"
                    >
                      {word}
                    </button>
                  ))}
                </div>

                {recent.length > 0 && (
                  <div className={styles.recentRow}>
                    <span className={styles.recentLabel}>Recent</span>

                    {recent.map((word) => (
                      <button className={styles.suggestion} key={word} onClick={() => setQuery(word)} type="button">
                        {word}
                      </button>
                    ))}

                    <button className={styles.linkButton} onClick={forgetRecent} type="button">
                      Forget
                    </button>
                  </div>
                )}

                <p className={styles.hint}>
                  {records.length} {plural(records.length, "record", "records")} are searchable. Pick a module above to browse it, or type
                  several words to narrow the match: every word has to appear somewhere in the record.
                </p>
              </section>
            )}

            {browsing && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">RESULTS</div>
                    <h2>
                      {hits.length} {plural(hits.length, "record", "records")}
                      {terms.length > 0 && (
                        <span className={styles.forTerms}>
                          {" "}
                          for “{terms.join(" ")}”
                        </span>
                      )}
                    </h2>
                  </div>
                </header>

                {hits.length === 0 ? (
                  <div className={styles.emptySmall}>
                    Nothing matches. Try fewer words, or check the spelling of a reference number.
                  </div>
                ) : (
                  <>
                    <ul className={styles.results}>{visible.map((hit) => renderResult(hit.record))}</ul>

                    {hits.length > visible.length && (
                      <button className={cx(styles.linkButton, styles.moreButton)} onClick={() => setShown((count) => count + PAGE_SIZE)} type="button">
                        Show {Math.min(PAGE_SIZE, hits.length - visible.length)} more ({hits.length - visible.length} left)
                      </button>
                    )}
                  </>
                )}
              </section>
            )}

            {browsing && watchPanel}

            <p className={styles.note}>
              Searches governance meetings, decisions and actions; risks, issues, change and delay events; safety incidents, observations,
              actions and permits; quality inspections, NCRs, punch and handover items; documents, RFIs and transmittals; change orders,
              claims and certificates; procurement packages, bids and suppliers; work packages and site reports; and milestones. Closed
              records are included. Matches are ranked by reference first, then title, then owner, then the rest of the text. The
              watchlist is kept in this browser only.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
