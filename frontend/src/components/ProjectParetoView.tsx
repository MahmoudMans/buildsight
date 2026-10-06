"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  AREAS,
  DIMENSIONS,
  RECORD_LIMIT,
  VITAL_SHARE,
  WINDOWS,
  availableModules,
  buildPareto,
  formatValue,
  paretoMarkdown,
  percent,
  type Area,
  type Bar,
  type DimensionKey,
  type Pareto,
} from "@/lib/pareto";
import { MODULE_LABEL, formatDay, loadSources, plural, projectOf, startOfToday, type ModuleKey, type Sources } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";

import styles from "./ProjectParetoView.module.css";

const SOURCE_COUNT = 9;
const COLUMN = 82;

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function compact(value: number, measure: Pareto["measure"]): string {
  if (measure.unit === "cost") {
    return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1, notation: "compact" }).format(value);
  }

  return formatValue(value, measure);
}

function niceTop(value: number): number {
  if (value <= 4) {
    return 4;
  }

  if (value <= 48) {
    return Math.ceil(value / 4) * 4;
  }

  const unit = Math.pow(10, Math.floor(Math.log10(value)));
  const steps = [1, 2, 2.5, 4, 5, 8, 10];

  for (const step of steps) {
    if (step * unit * 1 >= value) {
      return step * unit;
    }
  }

  return 10 * unit;
}

function Chart({ result, selected, onPick }: { result: Pareto; selected: string; onPick: (key: string) => void }) {
  const stress = result.concentrated;
  const { bars } = result;
  const count = bars.length;
  const top = niceTop(Math.max(1, ...bars.map((bar) => bar.value)));
  const points = bars.map((bar, index) => `${(index + 0.5) * 100},${(100 - bar.cumulative * 100).toFixed(2)}`).join(" ");

  return (
    <div className={styles.plotScroll}>
      <div className={styles.plotFrame} style={{ minWidth: `${count * COLUMN + 90}px` }}>
        <div aria-hidden="true" className={styles.axisLeft}>
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
            <span key={fraction} style={{ bottom: `${fraction * 100}%` }}>
              {compact(top * fraction, result.measure)}
            </span>
          ))}
        </div>

        <div aria-hidden="true" className={styles.axisRight}>
          {[1, 0.75, 0.5, 0.25, 0].map((fraction) => (
            <span key={fraction} style={{ bottom: `${fraction * 100}%` }}>
              {Math.round(fraction * 100)}%
            </span>
          ))}
        </div>

        <div className={styles.plot} style={{ "--cols": count } as CSSProperties}>
          <div aria-hidden="true" className={styles.guides} />

          <div aria-hidden="true" className={styles.target} style={{ bottom: `${VITAL_SHARE * 100}%` }}>
            <span>80%</span>
          </div>

          <div className={styles.columns}>
            {bars.map((bar) => (
              <button
                aria-label={`${bar.label}: ${formatValue(bar.value, result.measure)} ${result.measure.unit}, ${percent(bar.share)} of the total, ${percent(bar.cumulative)} cumulative`}
                aria-pressed={selected === bar.key}
                className={cx(styles.column, selected === bar.key && styles.columnOn)}
                key={bar.key}
                onClick={() => onPick(bar.key)}
                type="button"
              >
                <span className={styles.stack} style={{ height: `${(bar.value / top) * 100}%` }}>
                  <span className={styles.val}>{compact(bar.value, result.measure)}</span>
                  <span className={cx(styles.bar, bar.vital && stress && styles.barVital, bar.unknown && styles.barUnknown, bar.merged > 1 && styles.barRest)} />
                </span>
              </button>
            ))}
          </div>

          <svg aria-hidden="true" className={styles.line} preserveAspectRatio="none" viewBox={`0 0 ${count * 100} 100`}>
            <polyline fill="none" points={points} stroke="#d9823a" strokeLinejoin="round" strokeWidth={2.4} vectorEffect="non-scaling-stroke" />
          </svg>

          {bars.map((bar, index) => (
            <span aria-hidden="true" className={styles.dot} key={bar.key} style={{ bottom: `${bar.cumulative * 100}%`, left: `${((index + 0.5) / count) * 100}%` }} />
          ))}
        </div>

        <div className={styles.labels} style={{ "--cols": count } as CSSProperties}>
          {bars.map((bar) => (
            <button className={cx(styles.label, selected === bar.key && styles.labelOn)} key={bar.key} onClick={() => onPick(bar.key)} title={bar.label} type="button">
              {bar.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProjectParetoView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [area, setArea] = useState<Area>("Quality");
  const [dimKey, setDimKey] = useState<DimensionKey>("ncrCategory");
  const [measureKey, setMeasureKey] = useState("count");
  const [windowDays, setWindowDays] = useState<number | null>(null);
  const [openOnly, setOpenOnly] = useState(false);
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

  const dimension = DIMENSIONS.find((item) => item.key === dimKey) ?? (DIMENSIONS[0] as (typeof DIMENSIONS)[number]);
  const measure = dimension.measures.find((item) => item.key === measureKey) ?? (dimension.measures[0] as (typeof dimension.measures)[number]);
  const windowLabel = WINDOWS.find((item) => item.days === windowDays)?.label ?? "All time";
  const modules = useMemo(() => availableModules(failed), [failed]);

  const result = useMemo(
    () => (sources ? buildPareto(sources, failed, today, dimension.key, measure.key, windowDays, openOnly) : null),
    [sources, failed, today, dimension.key, measure.key, windowDays, openOnly],
  );

  const project = sources ? projectOf(sources) : null;
  const projectName = project?.name ?? "Project";
  const loaded = sources !== null && result !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;
  const chosen: Bar | null = result ? (result.bars.find((bar) => bar.key === picked) ?? result.bars[0] ?? null) : null;
  const needed = failed.filter((key) => key === "quality" || key === "safety" || key === "risk");
  const onlyUnknown = result !== null && result.bars.length === 1 && result.bars[0]?.unknown === true;

  function chooseArea(next: Area) {
    const first = DIMENSIONS.find((item) => item.area === next);

    setArea(next);

    if (first) {
      chooseDimension(first.key);
    }
  }

  function chooseDimension(key: DimensionKey) {
    const next = DIMENSIONS.find((item) => item.key === key);

    setDimKey(key);
    setMeasureKey(next?.measures[0]?.key ?? "count");
    setPicked(null);
  }

  async function copyTable() {
    if (!result) {
      return;
    }

    const ok = await copyText(paretoMarkdown(result, projectName, today, windowLabel, openOnly));

    setMessage(ok ? "Copied the ranking as Markdown." : "Could not copy the ranking.");
  }

  const inArea = DIMENSIONS.filter((item) => item.area === area);

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">PARETO ANALYSIS</div>

            <h1>What causes most of the problems?</h1>

            <p className={styles.subtitle}>
              Usually a few causes account for most of the trouble. Rank defects, snags, incidents, delays and changes to see which handful is worth
              fixing first.
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

        {!loaded && <div className={styles.loading}>Ranking the records…</div>}

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
              <span> The rankings that rely on {needed.length > 1 ? "them" : "it"} are unavailable.</span>
            </div>
          </div>
        )}

        {loaded && !failedAll && result && (
          <>
            <section className={styles.picker}>
              <div aria-label="Area" className={styles.segmented} role="group">
                {AREAS.map((item) => (
                  <button aria-pressed={area === item} className={cx(styles.segment, area === item && styles.segmentOn)} key={item} onClick={() => chooseArea(item)} type="button">
                    {item}
                  </button>
                ))}
              </div>

              <div aria-label="What to rank" className={styles.chips} role="group">
                {inArea.map((item) => {
                  const ok = modules.has(item.module);

                  return (
                    <button
                      aria-pressed={dimKey === item.key}
                      className={cx(styles.chip, dimKey === item.key && styles.chipOn)}
                      disabled={!ok}
                      key={item.key}
                      onClick={() => chooseDimension(item.key)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className={styles.controls}>
              <div className={styles.controlGroup}>
                {dimension.measures.length > 1 && (
                  <div aria-label="Measure" className={styles.segmented} role="group">
                    {dimension.measures.map((item) => (
                      <button
                        aria-pressed={measure.key === item.key}
                        className={cx(styles.segment, measure.key === item.key && styles.segmentOn)}
                        key={item.key}
                        onClick={() => setMeasureKey(item.key)}
                        title={item.hint}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                )}

                <div aria-label="Period" className={styles.segmented} role="group">
                  {WINDOWS.map((item) => (
                    <button
                      aria-pressed={windowDays === item.days}
                      className={cx(styles.segment, windowDays === item.days && styles.segmentOn)}
                      key={item.label}
                      onClick={() => {
                        setWindowDays(item.days);
                        setPicked(null);
                      }}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ))}
                </div>

                {dimension.openFilter && (
                  <label className={styles.toggle}>
                    <input
                      checked={openOnly}
                      onChange={(event) => {
                        setOpenOnly(event.target.checked);
                        setPicked(null);
                      }}
                      type="checkbox"
                    />
                    Open only
                  </label>
                )}
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

            {!result.available && (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>This ranking needs {MODULE_LABEL[dimension.module].toLowerCase()} data, which could not be loaded.</div>
              </section>
            )}

            {result.available && result.bars.length === 0 && (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No {dimension.noun} match this selection, so there is nothing to rank. Try a longer period.</div>
              </section>
            )}

            {result.available && result.bars.length > 0 && (
              <>
                <section aria-label="Pareto summary" className={styles.kpis}>
                  <article className={cx(styles.kpi, styles.kpiDark)}>
                    <div className={styles.kpiLabel}>{result.concentrated ? "THE VITAL FEW" : "SPREAD OUT"}</div>
                    <div className={styles.kpiValue}>
                      {result.vitalBars}
                      <span className={styles.of}> of {result.categories}</span>
                    </div>
                    <div className={styles.kpiSub}>
                      {result.concentrated
                        ? `${plural(result.vitalBars, "category makes", "categories make")} up ${percent(result.vitalShare)}`
                        : `no small group dominates`}
                    </div>
                  </article>

                  <article className={styles.kpi}>
                    <div className={styles.kpiLabel}>BIGGEST</div>
                    <div className={cx(styles.kpiValue, styles.kpiText)}>{result.bars[0]?.label}</div>
                    <div className={styles.kpiSub}>{percent(result.bars[0]?.share ?? 0)} of the total</div>
                  </article>

                  <article className={styles.kpi}>
                    <div className={styles.kpiLabel}>TOTAL</div>
                    <div className={styles.kpiValue}>{formatValue(result.total, measure)}</div>
                    <div className={styles.kpiSub}>{measure.label.toLowerCase()}</div>
                  </article>

                  <article className={styles.kpi}>
                    <div className={styles.kpiLabel}>RECORDS</div>
                    <div className={styles.kpiValue}>{result.records}</div>
                    <div className={styles.kpiSub}>{dimension.noun}, {windowLabel.toLowerCase()}</div>
                  </article>

                  <article className={styles.kpi}>
                    <div className={styles.kpiLabel}>CATEGORIES</div>
                    <div className={styles.kpiValue}>{result.categories}</div>
                    <div className={styles.kpiSub}>in {dimension.label}</div>
                  </article>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">{dimension.area.toUpperCase()}</div>
                      <h2>{dimension.title}</h2>
                    </div>

                    <ul className={styles.legend}>
                      {result.concentrated && (
                        <li>
                          <span className={cx(styles.swatch, styles.swatchVital)} />
                          Vital few
                        </li>
                      )}
                      <li>
                        <span className={cx(styles.swatch, styles.swatchRest)} />
                        {result.concentrated ? "Others" : "Categories"}
                      </li>
                      <li>
                        <span className={styles.lineKey} />
                        Cumulative share
                      </li>
                    </ul>
                  </header>

                  {onlyUnknown ? (
                    <div className={styles.emptySmall}>
                      Nothing is recorded here yet, so every {dimension.noun === "non-conformances" ? "non-conformance" : "record"} lands in one group. Fill in the field on each record and this
                      chart starts ranking them.
                    </div>
                  ) : (
                    <Chart onPick={setPicked} result={result} selected={chosen?.key ?? ""} />
                  )}

                  {!onlyUnknown && result.bars.length > 4 && <p className={styles.scrollHint}>Scroll the chart sideways to see every bar.</p>}

                  <p className={styles.hint}>
                    {result.concentrated
                      ? result.vitalBars === 1
                        ? `The dark bar is the vital few: one category that on its own makes up ${percent(result.vitalShare)} of the ${measure.label.toLowerCase()}.`
                        : `The dark bars are the vital few: the leading ${result.vitalBars} categories that together reach ${percent(result.vitalShare)} of the ${measure.label.toLowerCase()}.`
                      : "No small group of categories dominates here, so there is no obvious few to fix first."}{" "}
                    {measure.hint}
                  </p>
                </section>

                <section className={styles.panel}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">THE RANKING</div>
                      <h2>In numbers</h2>
                    </div>

                    <span className={styles.muted}>{measure.label}</span>
                  </header>

                  <div className={styles.tableWrap}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">Category</th>
                          <th className={styles.num} scope="col">
                            {measure.unit === "records" ? "Records" : measure.label}
                          </th>
                          <th className={styles.num} scope="col">
                            Share
                          </th>
                          <th className={styles.num} scope="col">
                            Cumulative
                          </th>
                          <th className={styles.num} scope="col">
                            Records
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {result.bars.map((bar) => (
                          <tr className={cx(chosen?.key === bar.key && styles.rowOn)} key={bar.key}>
                            <th scope="row">
                              <button aria-pressed={chosen?.key === bar.key} className={styles.place} onClick={() => setPicked(bar.key)} type="button">
                                {bar.label}
                              </button>
                              {bar.vital && result.concentrated && <span className={styles.tag}>Vital few</span>}
                            </th>
                            <td className={styles.num}>
                              <strong>{formatValue(bar.value, measure)}</strong>
                            </td>
                            <td className={styles.num}>{percent(bar.share)}</td>
                            <td className={styles.num}>{percent(bar.cumulative)}</td>
                            <td className={styles.num}>{bar.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                {chosen && (
                  <section aria-label={`Records for ${chosen.label}`} className={styles.panel}>
                    <header className={styles.panelHead}>
                      <div>
                        <div className="eyebrow">BEHIND THE BAR</div>
                        <h2>{chosen.label}</h2>
                      </div>

                      <span className={styles.muted}>
                        {chosen.count} {plural(chosen.count, "record", "records")}
                      </span>
                    </header>

                    <ul className={styles.records}>
                      {chosen.records.slice(0, RECORD_LIMIT).map((record) => (
                        <li key={record.id}>
                          <span className={styles.recordText}>
                            <strong>{record.reference}</strong> {record.title}
                          </span>

                          <span className={styles.recordMeta}>
                            {record.meta}
                            {Number.isFinite(record.day) ? ` · ${formatDay(record.day)}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {chosen.records.length > RECORD_LIMIT && <p className={styles.more}>and {chosen.records.length - RECORD_LIMIT} more.</p>}
                  </section>
                )}
              </>
            )}

            <p className={styles.note}>
              Categories come from the field recorded on each item, and root causes are free text, so the same cause worded two ways is only
              merged when it differs by capital letters, spacing or a trailing full stop. Voided records are left out. Open only keeps items not yet
              closed. The vital few are the fewest leading categories that reach 80% of the total, and they stand out only when that takes a small
              share of all the categories.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
