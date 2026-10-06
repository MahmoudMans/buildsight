"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import { DRAW_LIMIT, NODE_H, NODE_W, buildLogicMap, chainOf, dayLabel, datesText, floatText, mapFailText, svgMarkup, wiringOf, type Direction, type MapNode, type Wiring } from "@/lib/logicMap";
import { formatDay, plural, startOfToday, toDay, trunc } from "@/lib/openItems";
import { activityOptions, linkText, modelDay, prepare } from "@/lib/slipExplorer";
import { downloadText, slugName } from "@/lib/textExport";
import type { ScheduleControl } from "@/types/project";

import styles from "./ProjectLogicMapView.module.css";

const ZOOMS: ReadonlyArray<number> = [0.4, 0.55, 0.7, 0.85, 1, 1.25];
const DEFAULT_ZOOM = 0.85;

const DIRECTIONS: ReadonlyArray<{ key: Direction; label: string }> = [
  { key: "both", label: "Before and after" },
  { key: "up", label: "What it waits on" },
  { key: "down", label: "What waits on it" },
];

const STATUS_LABEL: Record<MapNode["status"], string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function Wires({ empty, items, onPick }: { empty: string; items: Wiring["predecessors"]; onPick: (id: string) => void }) {
  if (items.length === 0) {
    return <p className={styles.quiet}>{empty}</p>;
  }

  return (
    <ul className={styles.links}>
      {items.map((item, index) => (
        <li key={`${item.id}-${item.type}-${index}`}>
          <button className={styles.linkButton} onClick={() => onPick(item.id)} type="button">
            <strong>{item.code}</strong> <span>{trunc(item.name, 40)}</span>
          </button>

          <div className={styles.linkMeta}>
            <span>{linkText(item.type, item.lag)}</span>
            {item.driving ? <em className={styles.driving}>Driving</em> : item.spare !== null ? <span>{Math.round(item.spare * 10) / 10} d to spare</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ProjectLogicMapView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [focus, setFocus] = useState<string | null>(null);
  const [direction, setDirection] = useState<Direction>("both");
  const [showDone, setShowDone] = useState(false);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(DEFAULT_ZOOM);
  const [message, setMessage] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectSchedule(projectId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState("failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const prepared = useMemo(() => (data ? prepare(data) : null), [data]);
  const ready = prepared && prepared.ok ? prepared.prepared : null;
  const options = useMemo(() => (ready ? activityOptions(ready) : []), [ready]);
  const overview = useMemo(() => (ready ? buildLogicMap(ready, { showDone: false, focus: null, direction: "both", criticalOnly: false }) : null), [ready]);
  const validFocus = focus !== null && options.some((item) => item.id === focus) ? focus : null;
  const map = useMemo(() => (ready ? buildLogicMap(ready, { showDone, focus: validFocus, direction, criticalOnly }) : null), [ready, showDone, validFocus, direction, criticalOnly]);
  const shownIds = useMemo(() => new Set(map ? map.nodes.map((node) => node.id) : []), [map]);
  const active = selected !== null && shownIds.has(selected) ? selected : null;
  const chain = useMemo(() => (map && active ? chainOf(map, active) : null), [map, active]);
  const wiring = useMemo(() => (ready && active ? wiringOf(ready, active) : null), [ready, active]);
  const node = map && active ? (map.nodes.find((item) => item.id === active) ?? null) : null;
  const activity = ready && active ? (ready.net.activities[ready.net.position.get(active) ?? 0] ?? null) : null;
  const projectName = data?.project?.name ?? "Project";
  const critical = overview ? overview.nodes.filter((item) => item.critical).length : 0;
  const finish = ready ? modelDay(ready, ready.base.end) : NaN;

  function pick(id: string) {
    setSelected(id);
    setMessage(null);
  }

  function focusOn(id: string | null) {
    setFocus(id);
    setSelected(id);
    setMessage(null);

    if (viewport.current) {
      viewport.current.scrollLeft = 0;
    }
  }

  function fit() {
    const width = viewport.current?.clientWidth ?? 0;

    if (map && map.width > 0 && width > 0) {
      setZoom(Math.min(1.25, Math.max(0.3, Math.floor(((width - 4) / map.width) * 100) / 100)));
    }
  }

  function step(delta: number) {
    const index = ZOOMS.findIndex((value) => value >= zoom - 0.001);
    const current = index < 0 ? ZOOMS.length - 1 : index;
    const next = Math.min(ZOOMS.length - 1, Math.max(0, current + delta));

    setZoom(ZOOMS[next] ?? DEFAULT_ZOOM);
  }

  function save() {
    if (!map || map.nodes.length === 0) {
      return;
    }

    downloadText(`${slugName(projectName)}-logic-map.svg`, svgMarkup(map, `${projectName}: schedule logic as of ${formatDay(today)}`), "image/svg+xml");
    setMessage("Saved the diagram as an SVG image.");
  }

  function keyPick(event: KeyboardEvent<SVGGElement>, id: string) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      pick(id);
    }
  }

  const arrow = (color: string) => (
    <marker id={`lm-${color.slice(1)}`} markerHeight="7" markerWidth="7" orient="auto" refX="9" refY="5" viewBox="0 0 10 10">
      <path d="M0,0 L10,5 L0,10 z" fill={color} />
    </marker>
  );

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">SCHEDULE LOGIC</div>

            <h1>How does the work connect?</h1>

            <p className={styles.subtitle}>
              Every open activity is a box and every logic link a line, laid out left to right in the order the work has to happen. The chain with no float shows in red. Pick any activity to see what it waits on and what waits on it.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/slip-explorer`}>
              Slip explorer
            </Link>

            <Link className="secondary-link-button" href={`${base}/schedule-health`}>
              Schedule health
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Loading the schedule…</div>}

        {state === "failed" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the schedule. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {prepared && !prepared.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{mapFailText(prepared.reason, prepared.detail)}</div>
          </section>
        )}

        {ready && overview && map && (
          <>
            <section aria-label="Schedule logic summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OPEN ACTIVITIES</div>
                <div className={styles.kpiValue}>{ready.live.length}</div>
                <div className={styles.kpiSub}>
                  {map.hiddenDone} {plural(map.hiddenDone, "activity", "activities")} completed
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LOGIC LINKS</div>
                <div className={styles.kpiValue}>{overview.edges.length}</div>
                <div className={styles.kpiSub}>between open activities</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>STEPS DEEP</div>
                <div className={styles.kpiValue}>{overview.levels}</div>
                <div className={styles.kpiSub}>longest run of linked work</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO FLOAT</div>
                <div className={cx(styles.kpiValue, critical > 0 && styles.neg)}>{critical}</div>
                <div className={styles.kpiSub}>on the critical chain</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LOGIC FINISH</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>{Number.isFinite(finish) ? formatDay(finish) : "—"}</div>
                <div className={styles.kpiSub}>when the last link ends</div>
              </article>
            </section>

            <section aria-label="Map settings" className={cx(styles.panel, styles.controlsPanel)}>
              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>Show</span>

                <div aria-label="What to show" className={styles.segmented} role="group">
                  <button aria-pressed={validFocus === null} className={cx(styles.segment, validFocus === null && styles.segmentOn)} onClick={() => focusOn(null)} type="button">
                    Whole network
                  </button>

                  <button
                    aria-pressed={validFocus !== null}
                    className={cx(styles.segment, validFocus !== null && styles.segmentOn)}
                    onClick={() => focusOn(validFocus ?? active ?? options[0]?.id ?? null)}
                    type="button"
                  >
                    One activity
                  </button>
                </div>
              </div>

              {validFocus !== null && (
                <>
                  <div className={cx(styles.controlGroup, styles.grow)}>
                    <label className={styles.controlLabel} htmlFor="map-focus">
                      Activity
                    </label>

                    <select className={styles.select} id="map-focus" onChange={(event) => focusOn(event.target.value)} value={validFocus}>
                      {options.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.code} · {trunc(item.name, 50)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.controlGroup}>
                    <span className={styles.controlLabel}>Direction</span>

                    <div aria-label="Direction" className={styles.segmented} role="group">
                      {DIRECTIONS.map((item) => (
                        <button aria-pressed={direction === item.key} className={cx(styles.segment, direction === item.key && styles.segmentOn)} key={item.key} onClick={() => setDirection(item.key)} type="button">
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>Filter</span>

                <label className={styles.toggle}>
                  <input checked={criticalOnly} onChange={(event) => setCriticalOnly(event.target.checked)} type="checkbox" />
                  Critical chain only
                </label>

                <label className={styles.toggle}>
                  <input checked={showDone} onChange={(event) => setShowDone(event.target.checked)} type="checkbox" />
                  Include completed work ({map.hiddenDone})
                </label>
              </div>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">THE DIAGRAM</div>
                  <h2>{validFocus !== null ? "Around one activity" : "The whole open network"}</h2>
                </div>

                <div className={styles.tools}>
                  <span className={styles.muted}>
                    {map.nodes.length} of {map.total} {plural(map.total, "activity", "activities")} · {map.edges.length} {plural(map.edges.length, "link", "links")}
                  </span>

                  <div aria-label="Zoom" className={styles.segmented} role="group">
                    <button aria-label="Zoom out" className={styles.segment} onClick={() => step(-1)} type="button">
                      −
                    </button>

                    <span className={styles.zoomValue}>{Math.round(zoom * 100)}%</span>

                    <button aria-label="Zoom in" className={styles.segment} onClick={() => step(1)} type="button">
                      +
                    </button>

                    <button className={styles.segment} onClick={fit} type="button">
                      Fit
                    </button>
                  </div>

                  <button className={styles.linkAction} disabled={map.nodes.length === 0} onClick={save} type="button">
                    Save as SVG
                  </button>
                </div>
              </header>

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.swatchCritical)} />
                  No float
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchProgress)} />
                  In progress
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchDone)} />
                  Completed
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchDriving)} />
                  Link that sets the date
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchLink)} />
                  Dashed: not finish-to-start
                </li>
              </ul>

              {message && (
                <p className={styles.statusLine} role="status">
                  {message}
                </p>
              )}

              {map.tooMany ? (
                <div className={styles.emptySmall}>
                  That is more than {DRAW_LIMIT} activities, too many to draw legibly. Choose “One activity” to see the work around it, or tick “Critical chain only”.
                </div>
              ) : map.nodes.length === 0 ? (
                <div className={styles.emptySmall}>{criticalOnly ? "No open activity is without float, so there is no critical chain to draw." : "There is nothing to draw with these settings."}</div>
              ) : (
                <div aria-label="Schedule logic diagram, scrollable" className={styles.viewport} ref={viewport} role="region" tabIndex={0}>
                  <svg className={styles.canvas} height={map.height * zoom} viewBox={`0 0 ${map.width} ${map.height}`} width={map.width * zoom}>
                    <defs>
                      {arrow("#9aa5a0")}
                      {arrow("#c4574a")}
                      {arrow("#19201e")}
                    </defs>

                    <g>
                      {map.edges.map((edge) => {
                        const on = chain !== null && chain.edges.has(edge.key);
                        const dim = chain !== null && !on;
                        const color = on ? "#19201e" : edge.driving ? "#c4574a" : "#9aa5a0";

                        return (
                          <path
                            className={cx(styles.edge, edge.driving && styles.edgeDriving, on && styles.edgeOn, dim && styles.edgeDim, edge.type !== "FS" && styles.edgeDashed)}
                            d={edge.d}
                            fill="none"
                            key={edge.key}
                            markerEnd={`url(#lm-${color.slice(1)})`}
                          />
                        );
                      })}
                    </g>

                    <g>
                      {map.nodes.map((item) => {
                        const on = item.id === active;
                        const dim = chain !== null && !chain.ids.has(item.id);

                        return (
                          <g
                            aria-label={`${item.code} ${item.name}, ${STATUS_LABEL[item.status].toLowerCase()}${item.critical ? ", no float" : ""}`}
                            aria-pressed={on}
                            className={cx(
                              styles.node,
                              item.done && styles.nodeDone,
                              !item.done && item.status === "IN_PROGRESS" && styles.nodeProgress,
                              !item.done && item.status === "ON_HOLD" && styles.nodeHold,
                              item.critical && styles.nodeCritical,
                              on && styles.nodeOn,
                              dim && styles.nodeDim,
                            )}
                            key={item.id}
                            onClick={() => pick(item.id)}
                            onKeyDown={(event) => keyPick(event, item.id)}
                            role="button"
                            tabIndex={0}
                            transform={`translate(${item.x},${item.y})`}
                          >
                            <title>{`${item.code} ${item.name}\n${datesText(item)}${item.slack !== null ? `\nFloat ${floatText(item.slack)}` : ""}`}</title>
                            <rect className={styles.nodeBox} height={NODE_H} rx={8} width={NODE_W} />
                            <text className={styles.nodeCode} x={10} y={18}>
                              {item.code}
                            </text>
                            {item.slack !== null && (
                              <text className={styles.nodeFloat} textAnchor="end" x={NODE_W - 10} y={18}>
                                float {Math.round(item.slack * 10) / 10}
                              </text>
                            )}
                            <text className={styles.nodeName} x={10} y={33}>
                              {trunc(item.name, 26)}
                            </text>
                            <text className={styles.nodeDates} x={10} y={47}>
                              {datesText(item)}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                </div>
              )}

              <p className={styles.hint}>
                Scroll sideways to follow the work in time order. Select an activity to light up everything before and after it and dim the rest.
              </p>
            </section>

            {node && activity && wiring && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">SELECTED</div>
                    <h2>
                      {node.code} · {node.name}
                    </h2>
                  </div>

                  <div className={styles.tools}>
                    {validFocus !== node.id && (
                      <button className={styles.actionButton} onClick={() => focusOn(node.id)} type="button">
                        Focus on this activity
                      </button>
                    )}

                    {!node.done && (
                      <Link className="secondary-link-button" href={`${base}/slip-explorer`}>
                        Test a slip
                      </Link>
                    )}
                  </div>
                </header>

                <dl className={styles.facts}>
                  <div>
                    <dt>Status</dt>
                    <dd>{STATUS_LABEL[node.status]}</dd>
                  </div>
                  <div>
                    <dt>{node.done ? "Done" : "Logic dates"}</dt>
                    <dd>{node.start !== null && node.finish !== null ? `${dayLabel(node.start)} to ${dayLabel(node.finish)}` : "No dates"}</dd>
                  </div>
                  <div>
                    <dt>Planned finish</dt>
                    <dd>{dayLabel(Number.isFinite(toDay(activity.currentFinish)) ? toDay(activity.currentFinish) : null)}</dd>
                  </div>
                  <div>
                    <dt>Days left</dt>
                    <dd>{node.done ? "—" : `${Math.round(activity.remainingDurationDays * 10) / 10}`}</dd>
                  </div>
                  <div>
                    <dt>Float</dt>
                    <dd className={cx(node.critical && styles.neg)}>{floatText(node.slack)}</dd>
                  </div>
                  <div>
                    <dt>Discipline</dt>
                    <dd>{activity.discipline ?? "Not set"}</dd>
                  </div>
                </dl>

                <div className={styles.twoCol}>
                  <div>
                    <h3 className={styles.subhead}>Waits on ({wiring.predecessors.length})</h3>
                    <Wires empty="Nothing precedes it. It can start as soon as its planned date allows." items={wiring.predecessors} onPick={pick} />
                  </div>

                  <div>
                    <h3 className={styles.subhead}>Holds up ({wiring.successors.length})</h3>
                    <Wires empty="Nothing depends on it. It matters only if it is the last to finish." items={wiring.successors} onPick={pick} />
                  </div>
                </div>
              </section>
            )}

            <p className={styles.note}>
              Boxes are placed by how many links of work come before them, so the left edge holds work that can start straight away and the right edge the last work to finish. Dates and float are worked out on this page from each open activity’s remaining duration, its predecessor links and its planned start, measured from the schedule’s data date, so they can differ slightly from the schedule board. A link “sets the date” when the activity after it could not start any earlier. Float is how far an activity can slip before the project finish moves.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
