"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  DEFAULT_WINDOW,
  LIST_LIMIT,
  NO_LOCATION,
  WINDOWS,
  buildHotspots,
  hotspotsMarkdown,
  sortHotspots,
  type GroupBy,
  type HotRecord,
  type Hotspot,
  type RecordKind,
  type SortKey,
} from "@/lib/hotspots";
import { MODULE_LABEL, loadSources, plural, projectOf, startOfToday, type ModuleKey, type Sources } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";

import styles from "./ProjectHotspotsView.module.css";

const SOURCE_COUNT = 9;

const GROUPINGS: ReadonlyArray<{ key: GroupBy; label: string; hint: string }> = [
  { key: "area", label: "By area", hint: "Levels are folded into the area, so Block A L1 and Block A L2 count together." },
  { key: "exact", label: "Exact location", hint: "Each spelling of a location is kept as written, apart from capital letters and spacing." },
];

const KIND_TITLE: Record<RecordKind, string> = {
  snag: "Open snags",
  permit: "Permits to work",
  incident: "Incidents",
  observation: "Unsafe observations",
};

const KIND_ORDER: ReadonlyArray<RecordKind> = ["permit", "incident", "observation", "snag"];

const HEAT_RGB: Record<"snags" | "permits" | "incidents" | "unsafe", string> = {
  snags: "217, 130, 58",
  permits: "59, 127, 176",
  incidents: "181, 73, 62",
  unsafe: "209, 161, 58",
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function heat(value: number, max: number, rgb: string): CSSProperties {
  const strength = value > 0 && max > 0 ? 0.1 + 0.5 * (value / max) : 0;

  return { "--heat": strength.toFixed(2), "--rgb": rgb } as CSSProperties;
}

export function ProjectHotspotsView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [groupBy, setGroupBy] = useState<GroupBy>("area");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [sort, setSort] = useState<SortKey>("score");
  const [picked, setPicked] = useState<string | null>(null);
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

  const result = useMemo(() => (sources ? buildHotspots(sources, failed, today, groupBy, windowDays) : null), [sources, failed, today, groupBy, windowDays]);
  const project = sources ? projectOf(sources) : null;
  const projectName = project?.name ?? "Project";

  const rows = useMemo(() => (result ? sortHotspots(result.rows, sort) : []), [result, sort]);

  const everything: Hotspot[] = useMemo(() => (result ? [...rows, ...(result.none ? [result.none] : [])] : []), [result, rows]);
  const chosen = everything.find((spot) => spot.key === picked) ?? rows[0] ?? result?.none ?? null;

  const loaded = sources !== null && result !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;
  const needed = failed.filter((key) => key === "quality" || key === "safety");
  const hottest = result?.rows[0] && result.rows[0].score > 0 ? result.rows[0] : null;
  const available = result?.available;
  const windowLabel = WINDOWS.find((item) => item.days === windowDays)?.label ?? `${windowDays} days`;
  const empty = loaded && !failedAll && result.rows.length === 0 && result.none === null;

  function choose(key: string) {
    setPicked(key);
  }

  function dash(ok: boolean | undefined, value: number): string {
    return ok ? String(value) : "—";
  }

  async function copyTable() {
    if (!result) {
      return;
    }

    const ok = await copyText(hotspotsMarkdown(result, projectName, today));

    setMessage(ok ? "Copied the table as Markdown." : "Could not copy the table.");
  }

  const heads: ReadonlyArray<{ key: SortKey; label: string; numeric: boolean }> = [
    { key: "name", label: "Location", numeric: false },
    { key: "snags", label: "Open snags", numeric: true },
    { key: "permits", label: "Permits", numeric: true },
    { key: "incidents", label: "Incidents", numeric: true },
    { key: "unsafe", label: "Unsafe obs.", numeric: true },
    { key: "score", label: "Score", numeric: true },
  ];

  function row(spot: Hotspot, pinned: boolean) {
    const on = chosen?.key === spot.key;
    const live = result?.max;

    return (
      <tr className={cx(on && styles.rowOn, pinned && styles.rowNone)} key={spot.key}>
        <th scope="row">
          <button aria-pressed={on} className={styles.place} onClick={() => choose(spot.key)} type="button">
            {spot.label}
          </button>
        </th>

        <td className={styles.heat} style={available?.snags && !pinned && live ? heat(spot.snags, live.snags, HEAT_RGB.snags) : undefined}>
          <strong>{dash(available?.snags, spot.snags)}</strong>
          {available?.snags && spot.overdue > 0 && <small className={styles.bad}>{spot.overdue} overdue</small>}
        </td>

        <td className={styles.heat} style={available?.permits && !pinned && live ? heat(spot.permits + spot.expired, live.permits, HEAT_RGB.permits) : undefined}>
          <strong>{dash(available?.permits, spot.permits)}</strong>
          {available?.permits && spot.expired > 0 && <small className={styles.bad}>{spot.expired} expired</small>}
        </td>

        <td className={styles.heat} style={available?.incidents && !pinned && live ? heat(spot.incidents, live.incidents, HEAT_RGB.incidents) : undefined}>
          <strong>{dash(available?.incidents, spot.incidents)}</strong>
        </td>

        <td className={styles.heat} style={available?.unsafe && !pinned && live ? heat(spot.unsafe, live.unsafe, HEAT_RGB.unsafe) : undefined}>
          <strong>{dash(available?.unsafe, spot.unsafe)}</strong>
        </td>

        <td className={styles.score}>{spot.score}</td>
      </tr>
    );
  }

  function records(spot: Hotspot, kind: RecordKind) {
    const list: HotRecord[] = spot.records.filter((item) => item.kind === kind);

    if (list.length === 0) {
      return null;
    }

    return (
      <section className={styles.group} key={kind}>
        <h3>
          {KIND_TITLE[kind]} <span>{list.length}</span>
        </h3>

        <ul className={styles.records}>
          {list.slice(0, LIST_LIMIT).map((item) => (
            <li key={item.id}>
              <span className={styles.recordText}>
                <strong>{item.reference}</strong> {item.title}
                {item.flag && <em className={cx(styles.flag, item.alert && styles.flagAlert)}>{item.flag}</em>}
              </span>

              {item.meta && <span className={styles.recordMeta}>{item.meta}</span>}
            </li>
          ))}
        </ul>

        {list.length > LIST_LIMIT && <p className={styles.more}>and {list.length - LIST_LIMIT} more.</p>}
      </section>
    );
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

            <div className="eyebrow">SITE HOTSPOTS</div>

            <h1>Where does trouble keep turning up?</h1>

            <p className={styles.subtitle}>
              Open snags, permits, incidents and unsafe observations laid over the same locations, so the next site walk starts where the
              records pile up.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/quality-board`}>
              Quality board
            </Link>

            <Link className="secondary-link-button" href={`${base}/safety-board`}>
              Safety board
            </Link>
          </div>
        </header>

        {!loaded && <div className={styles.loading}>Gathering locations from the records…</div>}

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
              <strong>Could not load {needed.map((key) => MODULE_LABEL[key].toLowerCase()).join(" or ")}.</strong>
              <span> Columns that depend on {needed.length > 1 ? "them" : "it"} show a dash and are left out of the score.</span>
            </div>
          </div>
        )}

        {empty && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No snags, permits, incidents or unsafe observations are open in this period.</div>
          </section>
        )}

        {loaded && !failedAll && result && !empty && (
          <>
            <section aria-label="Hotspot summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>HOTTEST</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>{hottest ? hottest.label : "None"}</div>
                <div className={styles.kpiSub}>{hottest ? `score ${hottest.score}` : "nothing stands out"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN SNAGS</div>
                <div className={styles.kpiValue}>{dash(available?.snags, result.totals.snags)}</div>
                <div className={cx(styles.kpiSub, available?.snags && result.totals.overdue > 0 && styles.neg)}>{available?.snags ? `${result.totals.overdue} overdue` : "not loaded"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PERMITS IN FORCE</div>
                <div className={styles.kpiValue}>{dash(available?.permits, result.totals.permits)}</div>
                <div className={cx(styles.kpiSub, available?.permits && result.totals.expired > 0 && styles.neg)}>{available?.permits ? `${result.totals.expired} expired, still open` : "not loaded"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>INCIDENTS</div>
                <div className={styles.kpiValue}>{dash(available?.incidents, result.totals.incidents)}</div>
                <div className={styles.kpiSub}>{available?.incidents ? `last ${windowLabel}` : "not loaded"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO LOCATION</div>
                <div className={cx(styles.kpiValue, result.unlocated > 0 && result.unlocated >= result.located && styles.neg)}>{result.unlocated}</div>
                <div className={styles.kpiSub}>of {result.located + result.unlocated} {plural(result.located + result.unlocated, "record", "records")}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.controlGroup}>
                <div aria-label="Group locations" className={styles.segmented} role="group">
                  {GROUPINGS.map((option) => (
                    <button
                      aria-pressed={groupBy === option.key}
                      className={cx(styles.segment, groupBy === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setGroupBy(option.key);
                        setPicked(null);
                      }}
                      title={option.hint}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div aria-label="Time window for incidents and observations" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={windowDays === option.days}
                      className={cx(styles.segment, windowDays === option.days && styles.segmentOn)}
                      key={option.days}
                      onClick={() => setWindowDays(option.days)}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <button className={styles.linkButton} onClick={copyTable} type="button">
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
                  <div className="eyebrow">HEAT GRID</div>
                  <h2>{GROUPINGS.find((option) => option.key === groupBy)?.label}</h2>
                </div>

                <span className={styles.muted}>Incidents and observations: last {windowLabel}</span>
              </header>

              <div className={styles.gridWrap}>
                <table className={styles.heatTable}>
                  <thead>
                    <tr>
                      {heads.map((head) => (
                        <th aria-sort={sort === head.key ? (head.key === "name" ? "ascending" : "descending") : "none"} className={cx(head.numeric && styles.numCol)} key={head.key} scope="col">
                          <button className={cx(styles.sortButton, sort === head.key && styles.sortOn)} onClick={() => setSort(head.key)} type="button">
                            {head.label}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((spot) => row(spot, false))}
                    {result.none && row(result.none, true)}
                  </tbody>
                </table>
              </div>

              <p className={styles.hint}>
                {GROUPINGS.find((option) => option.key === groupBy)?.hint} Darker cells have more of that record than other locations.
              </p>
            </section>

            {chosen && (
              <section aria-label={`Records at ${chosen.label}`} className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">{chosen.key === NO_LOCATION ? "NO LOCATION RECORDED" : "LOCATION"}</div>
                    <h2>{chosen.label}</h2>
                  </div>

                  <span className={styles.scoreTag}>
                    Score <strong>{chosen.score}</strong>
                  </span>
                </header>

                {chosen.key !== NO_LOCATION && chosen.places.length > 1 && (
                  <p className={styles.includes}>
                    Includes {chosen.places.slice(0, 6).join("; ")}
                    {chosen.places.length > 6 ? ` and ${chosen.places.length - 6} more` : ""}.
                  </p>
                )}

                {chosen.key === NO_LOCATION && (
                  <p className={styles.includes}>These records have a blank location. Adding one on the record moves it onto the grid.</p>
                )}

                {chosen.records.length === 0 ? <div className={styles.emptySmall}>Nothing is recorded here in this period.</div> : <div className={styles.groups}>{KIND_ORDER.map((kind) => records(chosen, kind))}</div>}
              </section>
            )}

            <p className={styles.note}>
              Locations come from the free-text location on each record, so spelling matters. Open snags are those not closed or void. Permits
              count active ones whose dates cover today, with any past their end date listed as expired. Incidents and unsafe acts or conditions
              count only the chosen period. The score adds open and overdue snags, three for every expired permit and every incident, and one for
              each unsafe observation. It is a way to order the walk, not a risk rating.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
