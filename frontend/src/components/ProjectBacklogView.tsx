"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  DEFAULT_SPAN,
  SPANS,
  STREAMS,
  backlogMarkdown,
  buildBacklog,
  clearText,
  paceText,
  signed,
  type Backlog,
  type Point,
  type StreamKey,
  type StreamRow,
} from "@/lib/backlog";
import { DAY_MS, MODULE_LABEL, loadSources, plural, projectOf, startOfToday, type ModuleKey, type Sources } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";

import styles from "./ProjectBacklogView.module.css";

const SOURCE_COUNT = 9;
const WIDTH = 720;
const LEFT = 40;
const RIGHT = 10;

const VERDICT_CLASS: Record<StreamRow["verdict"], string | undefined> = {
  shrinking: styles.verdictGood,
  growing: styles.verdictBad,
  steady: styles.verdictPlain,
  clear: styles.verdictGood,
  none: styles.verdictPlain,
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function short(day: number): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(day * DAY_MS));
}

const STEPS: ReadonlyArray<number> = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
const SPLITS: ReadonlyArray<number> = [4, 5, 3, 6, 2];

function scaleFor(value: number): { max: number; ticks: number[] } {
  let best: { max: number; parts: number; step: number } | null = null;

  for (const step of STEPS) {
    for (const parts of SPLITS) {
      const max = step * parts;

      if (max >= value && (best === null || max < best.max)) {
        best = { max, parts, step };
      }
    }
  }

  const pick = best ?? { max: Math.ceil(value / 4) * 4, parts: 4, step: Math.ceil(value / 4) };

  return { max: pick.max, ticks: Array.from({ length: pick.parts + 1 }, (_, index) => index * pick.step) };
}

function niceMax(value: number): number {
  return scaleFor(value).max;
}

function labelEvery(count: number): number {
  return count <= 9 ? 1 : count <= 14 ? 2 : count <= 20 ? 3 : 4;
}

function Stack({ points, shown }: { points: Point[]; shown: StreamKey[] }) {
  const height = 250;
  const top = 12;
  const bottom = 26;
  const plotW = WIDTH - LEFT - RIGHT;
  const plotH = height - top - bottom;
  const active = STREAMS.filter((info) => shown.includes(info.key));
  const totals = points.map((point) => active.reduce((sum, info) => sum + point.by[info.key], 0));
  const { max, ticks } = scaleFor(Math.max(1, ...totals));
  const x = (index: number) => LEFT + (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotW);
  const y = (value: number) => top + plotH - (value / max) * plotH;
  const every = labelEvery(points.length);

  const layers = active.map((info, layer) => {
    const lower = points.map((point) => active.slice(0, layer).reduce((sum, item) => sum + point.by[item.key], 0));
    const upper = points.map((point, index) => (lower[index] ?? 0) + point.by[info.key]);
    const forward = upper.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    const back = lower
      .map((value, index) => `L${x(index).toFixed(1)},${y(value).toFixed(1)}`)
      .reverse()
      .join(" ");

    return { info, path: `${forward} ${back} Z` };
  });

  return (
    <svg aria-label="Open items over time, stacked by stream" className={styles.chart} role="img" viewBox={`0 0 ${WIDTH} ${height}`}>
      {ticks.map((tick) => (
        <g key={tick}>
          <line className={styles.grid} x1={LEFT} x2={WIDTH - RIGHT} y1={y(tick)} y2={y(tick)} />
          <text className={styles.axisText} textAnchor="end" x={LEFT - 6} y={y(tick) + 3.5}>
            {tick}
          </text>
        </g>
      ))}

      {layers.map((layer) => (
        <path d={layer.path} fill={layer.info.color} fillOpacity={0.86} key={layer.info.key} stroke="#ffffff" strokeWidth={1}>
          <title>{layer.info.label}</title>
        </path>
      ))}

      {points.map((point, index) => (
        <g key={point.day}>
          {(index % every === 0 && points.length - 1 - index >= Math.ceil(every / 2)) || index === points.length - 1 ? (
            <text className={styles.axisText} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} x={x(index)} y={height - 7}>
              {short(point.day)}
            </text>
          ) : null}

          <circle cx={x(index)} cy={y(totals[index] ?? 0)} fill="transparent" r={9}>
            <title>{`${short(point.day)}: ${totals[index] ?? 0} open${active.map((info) => `\n${info.label}: ${point.by[info.key]}`).join("")}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}

function Flows({ result }: { result: Backlog }) {
  const height = 210;
  const mid = 108;
  const half = 86;
  const plotW = WIDTH - LEFT - RIGHT;
  const count = result.flows.length;
  const slot = plotW / Math.max(1, count);
  const bar = Math.min(26, slot * 0.62);
  const max = niceMax(Math.max(1, ...result.flows.flatMap((flow) => [flow.raised, flow.closed])));
  const scale = half / max;
  const every = labelEvery(count);

  return (
    <svg aria-label="Items raised and closed each week" className={styles.chart} role="img" viewBox={`0 0 ${WIDTH} ${height}`}>
      <line className={styles.grid} x1={LEFT} x2={WIDTH - RIGHT} y1={mid - half} y2={mid - half} />
      <line className={styles.grid} x1={LEFT} x2={WIDTH - RIGHT} y1={mid + half} y2={mid + half} />
      <text className={styles.axisText} textAnchor="end" x={LEFT - 6} y={mid - half + 3.5}>
        {max}
      </text>
      <text className={styles.axisText} textAnchor="end" x={LEFT - 6} y={mid + 3.5}>
        0
      </text>
      <text className={styles.axisText} textAnchor="end" x={LEFT - 6} y={mid + half + 3.5}>
        {max}
      </text>

      {result.flows.map((flow, index) => {
        const centre = LEFT + slot * index + slot / 2;
        const net = flow.closed - flow.raised;

        return (
          <g key={flow.to}>
            <rect className={styles.barRaised} height={Math.max(flow.raised > 0 ? 1 : 0, flow.raised * scale)} rx={2} width={bar} x={centre - bar / 2} y={mid - flow.raised * scale}>
              <title>{`Week to ${short(flow.to)}: ${flow.raised} raised, ${flow.closed} closed (${signed(net)} net)`}</title>
            </rect>

            <rect className={styles.barClosed} height={Math.max(flow.closed > 0 ? 1 : 0, flow.closed * scale)} rx={2} width={bar} x={centre - bar / 2} y={mid}>
              <title>{`Week to ${short(flow.to)}: ${flow.raised} raised, ${flow.closed} closed (${signed(net)} net)`}</title>
            </rect>

            {index % every === 0 || index === count - 1 ? (
              <text className={styles.axisText} textAnchor="middle" x={centre} y={height - 6}>
                {short(flow.to)}
              </text>
            ) : null}
          </g>
        );
      })}

      <line className={styles.zero} x1={LEFT} x2={WIDTH - RIGHT} y1={mid} y2={mid} />
    </svg>
  );
}

function Spark({ points, stream, color }: { points: Point[]; stream: StreamKey; color: string }) {
  const values = points.map((point) => point.by[stream]);
  const max = Math.max(1, ...values);
  const w = 84;
  const h = 24;
  const path = values.map((value, index) => `${index === 0 ? "M" : "L"}${((index / Math.max(1, values.length - 1)) * w).toFixed(1)},${(h - 2 - (value / max) * (h - 4)).toFixed(1)}`).join(" ");

  return (
    <svg aria-hidden="true" className={styles.spark} viewBox={`0 0 ${w} ${h}`}>
      <path d={path} fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} />
    </svg>
  );
}

export function ProjectBacklogView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [weeks, setWeeks] = useState(DEFAULT_SPAN);
  const [hidden, setHidden] = useState<StreamKey[]>([]);
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

  const result = useMemo(() => (sources ? buildBacklog(sources, failed, today, weeks) : null), [sources, failed, today, weeks]);
  const project = sources ? projectOf(sources) : null;
  const projectName = project?.name ?? "Project";

  const loaded = sources !== null && result !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;
  const needed = failed.filter((key) => key === "quality" || key === "documents" || key === "safety" || key === "governance");
  const live = result ? result.rows.filter((row) => row.available) : [];
  const shown: StreamKey[] = live.filter((row) => !hidden.includes(row.key)).map((row) => row.key);
  const empty = loaded && !failedAll && result.openNow === 0 && result.raised === 0 && result.closed === 0;

  function toggle(key: StreamKey) {
    setHidden((list) => (list.includes(key) ? list.filter((item) => item !== key) : [...list, key]));
  }

  async function copySummary() {
    if (!result) {
      return;
    }

    const ok = await copyText(backlogMarkdown(result, projectName, today));

    setMessage(ok ? "Copied the trend as Markdown." : "Could not copy the trend.");
  }

  const spanLabel = SPANS.find((item) => item.weeks === weeks)?.label ?? `${weeks} weeks`;
  const perWeek = (value: number) => (weeks > 0 ? (value / weeks).toFixed(1) : "0.0");

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">BACKLOG TREND</div>

            <h1>Is the backlog shrinking?</h1>

            <p className={styles.subtitle}>
              Open snags, non-conformances, RFIs, safety items and meeting actions rebuilt week by week from their raised and closed dates, so you
              can see whether closing keeps pace with raising.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/inbox`}>
              Open items inbox
            </Link>

            <Link className="secondary-link-button" href={`${base}/closeout-board`}>
              Closeout board
            </Link>
          </div>
        </header>

        {!loaded && <div className={styles.loading}>Rebuilding the history…</div>}

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
              <span> Streams that come from {needed.length > 1 ? "them" : "it"} are left out of the totals.</span>
            </div>
          </div>
        )}

        {empty && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>There are no open or recently closed items to chart yet.</div>
          </section>
        )}

        {loaded && !failedAll && result && !empty && (
          <>
            <section aria-label="Backlog summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OPEN NOW</div>
                <div className={styles.kpiValue}>{result.openNow}</div>
                <div className={styles.kpiSub}>
                  {signed(result.openNow - result.openThen)} in {spanLabel}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>RAISED</div>
                <div className={styles.kpiValue}>{result.raised}</div>
                <div className={styles.kpiSub}>{perWeek(result.raised)} a week</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CLOSED</div>
                <div className={styles.kpiValue}>{result.closed}</div>
                <div className={styles.kpiSub}>{perWeek(result.closed)} a week</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NET PER WEEK</div>
                <div className={cx(styles.kpiValue, result.pace < -0.05 && styles.neg, result.pace > 0.05 && styles.pos)}>{paceText(result.pace)}</div>
                <div className={styles.kpiSub}>{result.pace > 0.05 ? "closing faster than raising" : result.pace < -0.05 ? "raising faster than closing" : "level"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CLEARS IN</div>
                <div className={cx(styles.kpiValue, styles.kpiText, result.verdict === "growing" && styles.neg)}>{clearText(result.weeksToClear, result.verdict)}</div>
                <div className={styles.kpiSub}>at the pace of these {spanLabel}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div aria-label="Look back" className={styles.segmented} role="group">
                {SPANS.map((option) => (
                  <button
                    aria-pressed={weeks === option.weeks}
                    className={cx(styles.segment, weeks === option.weeks && styles.segmentOn)}
                    key={option.weeks}
                    onClick={() => setWeeks(option.weeks)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
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
                  <div className="eyebrow">OPEN ITEMS</div>
                  <h2>The backlog over time</h2>
                </div>

                <span className={styles.muted}>
                  {result.peak && result.peak.total > result.openNow ? `Peak ${result.peak.total} on ${short(result.peak.day)}` : "Weekly, ending today"}
                </span>
              </header>

              <div aria-label="Streams to show" className={styles.chips} role="group">
                {live.map((row) => {
                  const on = !hidden.includes(row.key);

                  return (
                    <button
                      aria-pressed={on}
                      className={cx(styles.chip, on && styles.chipOn)}
                      key={row.key}
                      onClick={() => toggle(row.key)}
                      style={{ "--dot": row.color } as CSSProperties}
                      type="button"
                    >
                      <span aria-hidden="true" className={styles.dot} />
                      {row.label}
                    </button>
                  );
                })}
              </div>

              {shown.length === 0 ? <div className={styles.emptySmall}>Switch at least one stream on to draw the chart.</div> : <Stack points={result.points} shown={shown} />}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">FLOW</div>
                  <h2>Raised and closed each week</h2>
                </div>

                <ul className={styles.legend}>
                  <li>
                    <span className={cx(styles.swatch, styles.swatchRaised)} />
                    Raised
                  </li>
                  <li>
                    <span className={cx(styles.swatch, styles.swatchClosed)} />
                    Closed
                  </li>
                </ul>
              </header>

              <Flows result={result} />

              <p className={styles.hint}>Bars above the line are items raised, bars below are items closed. When the lower bars are longer, the backlog is shrinking.</p>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY STREAM</div>
                  <h2>Where it is growing or clearing</h2>
                </div>

                <span className={styles.muted}>{spanLabel}</span>
              </header>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Stream</th>
                      <th className={styles.num} scope="col">
                        Open now
                      </th>
                      <th className={styles.num} scope="col">
                        Change
                      </th>
                      <th className={styles.num} scope="col">
                        Raised
                      </th>
                      <th className={styles.num} scope="col">
                        Closed
                      </th>
                      <th className={styles.num} scope="col">
                        Net / week
                      </th>
                      <th scope="col">Trend</th>
                      <th scope="col">Clearing</th>
                    </tr>
                  </thead>

                  <tbody>
                    {result.rows.map((row) => (
                      <tr key={row.key}>
                        <th scope="row">
                          <span aria-hidden="true" className={styles.dot} style={{ "--dot": row.color } as CSSProperties} />
                          {row.label}
                        </th>

                        {row.available ? (
                          <>
                            <td className={styles.num}>
                              <strong>{row.openNow}</strong>
                            </td>
                            <td className={cx(styles.num, row.change > 0 && styles.neg, row.change < 0 && styles.pos)}>{signed(row.change)}</td>
                            <td className={styles.num}>{row.raised}</td>
                            <td className={styles.num}>{row.closed}</td>
                            <td className={cx(styles.num, row.pace < -0.05 && styles.neg, row.pace > 0.05 && styles.pos)}>{paceText(row.pace)}</td>
                            <td>
                              <Spark color={row.color} points={result.points} stream={row.key} />
                            </td>
                            <td>
                              <span className={cx(styles.verdict, VERDICT_CLASS[row.verdict])}>{clearText(row.weeksToClear, row.verdict)}</span>
                            </td>
                          </>
                        ) : (
                          <td className={styles.missing} colSpan={7}>
                            Not loaded
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className={styles.note}>
              Each item counts as open from the day it was raised until the day it was closed, answered or completed. Snags and non-conformances
              use the raised and closed dates, RFIs use the response date, observations use the date observed, and safety and meeting actions use the
              day the record was created and the day it was closed or completed.
              {result.estimated > 0
                ? ` ${result.estimated} closed ${plural(result.estimated, "item has", "items have")} no closing date, so its last update date stands in for it.`
                : ""}
              {result.skipped > 0 ? ` ${result.skipped} ${plural(result.skipped, "record was", "records were")} left out for lack of a raised date.` : ""} Net per week is
              closed minus raised, averaged over the period, and the time to clear assumes that pace holds. It is a rough guide, not a forecast.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
