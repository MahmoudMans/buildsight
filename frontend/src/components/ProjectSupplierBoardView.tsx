"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProcurement } from "@/lib/api";
import { formatDay, money, plural, toDay, words } from "@/lib/openItems";
import {
  DIMENSIONS,
  FAIR_FROM,
  GOOD_FROM,
  awardLine,
  bandOf,
  buildSuppliers,
  type Band,
  type SupplierRow,
} from "@/lib/supplierBoard";
import type { ProcurementControl } from "@/types/project";

import styles from "./ProjectSupplierBoardView.module.css";

type SortKey = "score" | "value" | "warnings" | "name";

const SORTS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: "score", label: "Score" },
  { key: "value", label: "Awarded value" },
  { key: "warnings", label: "Warnings" },
  { key: "name", label: "Name" },
];

const BAND_CLASS: Record<Band, string | undefined> = {
  good: styles.toneGood,
  fair: styles.toneWatch,
  weak: styles.toneBad,
  none: styles.toneNone,
};

const BAND_LABEL: Record<Band, string> = {
  good: "Strong",
  fair: "Fair",
  weak: "Weak",
  none: "Not evaluated",
};

const SHARE_COLORS = ["#19201e", "#3f6f58", "#7fb79a", "#d1a13a", "#b5493e", "#9aa59f"];

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function percent(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

function signedPoints(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const rounded = Math.round(value);

  return rounded === 0 ? "0" : rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}

function scaleOf(values: number[]): number {
  const top = Math.max(0, ...values.filter(Number.isFinite));

  return top <= 5 ? 5 : top <= 10 ? 10 : 100;
}

function Sparkline({ row }: { row: SupplierRow }) {
  const points = row.history;

  if (points.length < 2) {
    return <p className={styles.hint}>Only one evaluation so far, so there is no trend to draw.</p>;
  }

  const width = 300;
  const height = 96;
  const left = 8;
  const right = 8;
  const top = 8;
  const bottom = 8;
  const first = points[0]?.day ?? 0;
  const last = points[points.length - 1]?.day ?? first + 1;
  const span = Math.max(1, last - first);
  const x = (day: number) => left + ((day - first) / span) * (width - left - right);
  const values = points.map((point) => point.value);
  const low = Math.max(0, Math.min(...values, FAIR_FROM) - 8);
  const high = Math.min(100, Math.max(...values, GOOD_FROM) + 8);
  const y = (value: number) => top + (1 - (Math.min(high, Math.max(low, value)) - low) / Math.max(1, high - low)) * (height - top - bottom);

  return (
    <figure className={styles.spark}>
      <svg aria-label={`Overall score for ${row.supplier.name} over time`} role="img" viewBox={`0 0 ${width} ${height}`}>
        {[GOOD_FROM, FAIR_FROM].map((line) => (
          <g key={line}>
            <line className={styles.sparkGuide} x1={left} x2={width - right} y1={y(line)} y2={y(line)} />
            <text className={styles.sparkLabel} x={left + 2} y={y(line) - 3}>
              {line}%
            </text>
          </g>
        ))}

        <polyline className={styles.sparkLine} fill="none" points={points.map((point) => `${x(point.day)},${y(point.value)}`).join(" ")} />

        {points.map((point) => (
          <circle className={styles.sparkDot} cx={x(point.day)} cy={y(point.value)} key={`${point.day}-${point.value}`} r={3.5}>
            <title>{`${formatDay(point.day)}: ${Math.round(point.value)}%`}</title>
          </circle>
        ))}
      </svg>

      <figcaption>
        {formatDay(first)} to {formatDay(last)}
      </figcaption>
    </figure>
  );
}

export function ProjectSupplierBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ProcurementControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [sort, setSort] = useState<SortKey>("score");
  const [picked, setPicked] = useState<string | null>(null);
  const detailRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectProcurement(projectId)
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

  const model = useMemo(() => (data ? buildSuppliers(data) : null), [data]);
  const rows = useMemo(() => model?.rows ?? [], [model]);

  const ordered = useMemo(() => {
    const copy = [...rows];
    const score = (row: SupplierRow) => (Number.isFinite(row.average) ? row.average : -1);

    return copy.sort((a, b) => {
      if (sort === "name") {
        return a.supplier.name.localeCompare(b.supplier.name);
      }

      if (sort === "value") {
        return b.awardedValue - a.awardedValue || score(b) - score(a) || a.supplier.name.localeCompare(b.supplier.name);
      }

      if (sort === "warnings") {
        const severe = (row: SupplierRow) => row.warnings.filter((item) => item.severe).length;

        return severe(b) - severe(a) || b.warnings.length - a.warnings.length || score(a) - score(b) || a.supplier.name.localeCompare(b.supplier.name);
      }

      return score(b) - score(a) || b.awardedValue - a.awardedValue || a.supplier.name.localeCompare(b.supplier.name);
    });
  }, [rows, sort]);


  const evaluated = rows.filter((row) => Number.isFinite(row.average));
  const overall = evaluated.length > 0 ? evaluated.reduce((sum, row) => sum + row.average, 0) / evaluated.length : NaN;
  const evaluationCount = rows.reduce((sum, row) => sum + row.evaluations.length, 0);
  const qualified = rows.filter((row) => row.supplier.qualificationStatus === "QUALIFIED").length;
  const flagged = rows.filter((row) => row.warnings.length > 0);
  const serious = flagged.filter((row) => row.warnings.some((item) => item.severe));
  const unevaluated = rows.filter((row) => row.evaluations.length === 0);
  const unevaluatedAwarded = unevaluated.filter((row) => row.awards.length > 0);

  const holders = useMemo(() => [...rows].filter((row) => row.awardedValue > 0).sort((a, b) => b.awardedValue - a.awardedValue), [rows]);
  const topHolder = holders[0] ?? null;
  const topThree = holders.slice(0, 3).reduce((sum, row) => sum + row.share, 0);

  const slices = useMemo(() => {
    const head = holders.slice(0, 5).map((row, index) => ({
      key: row.supplier.id,
      label: row.supplier.name,
      value: row.awardedValue,
      share: row.share,
      color: SHARE_COLORS[index] ?? "#9aa59f",
    }));

    const rest = holders.slice(5);

    if (rest.length > 0) {
      head.push({
        key: "others",
        label: `${rest.length} other ${plural(rest.length, "supplier", "suppliers")}`,
        value: rest.reduce((sum, row) => sum + row.awardedValue, 0),
        share: rest.reduce((sum, row) => sum + row.share, 0),
        color: "#c3c9c5",
      });
    }

    return head;
  }, [holders]);

  const watch = useMemo(
    () =>
      [...flagged].sort((a, b) => {
        const severe = (row: SupplierRow) => row.warnings.filter((item) => item.severe).length;

        return severe(b) - severe(a) || b.warnings.length - a.warnings.length || b.awardedValue - a.awardedValue;
      }),
    [flagged],
  );

  const selected = useMemo(() => ordered.find((row) => row.supplier.id === picked) ?? watch[0] ?? ordered[0] ?? null, [ordered, picked, watch]);

  function choose(id: string) {
    setPicked(id);

    window.setTimeout(() => {
      const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      detailRef.current?.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    }, 30);
  }

  const packageById = useMemo(() => new Map((data?.packages ?? []).map((item) => [item.id, item])), [data]);
  const bidScale = useMemo(() => scaleOf((data?.bids ?? []).map((bid) => bid.combinedScore)), [data]);

  const empty = state === "ready" && rows.length === 0;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">SUPPLIERS</div>

            <h1>{data ? data.project.name : "Supplier board"}</h1>

            <p className={styles.subtitle}>
              How each supplier is performing, how much of the awarded work sits with each one, and who should not be holding an award
              without a second look.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/procurement-pipeline`}>
            Open procurement pipeline
          </Link>
        </header>

        {state === "loading" && <div className={styles.loading}>Loading suppliers…</div>}

        {state === "failed" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load procurement. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {empty && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No suppliers are registered yet. Add suppliers on the procurement page and they will appear here.</div>
          </section>
        )}

        {state === "ready" && rows.length > 0 && model && (
          <>
            <section aria-label="Supplier summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>SUPPLIERS</div>
                <div className={styles.kpiValue}>{rows.length}</div>
                <div className={styles.kpiSub}>{qualified} qualified</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AVERAGE SCORE</div>
                <div className={cx(styles.kpiValue, bandOf(overall) === "good" && styles.pos, bandOf(overall) === "weak" && styles.neg)}>{percent(overall)}</div>
                <div className={styles.kpiSub}>
                  {evaluationCount} {plural(evaluationCount, "evaluation", "evaluations")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TOP SUPPLIER SHARE</div>
                <div className={cx(styles.kpiValue, topHolder && topHolder.share >= 0.4 && styles.neg)}>{topHolder ? percent(topHolder.share * 100) : "—"}</div>
                <div className={styles.kpiSub}>{topHolder ? topHolder.supplier.name : "nothing awarded yet"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NEED ATTENTION</div>
                <div className={cx(styles.kpiValue, flagged.length > 0 && styles.neg)}>{flagged.length}</div>
                <div className={styles.kpiSub}>{flagged.length > 0 ? `${serious.length} serious` : "no warnings"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NEVER EVALUATED</div>
                <div className={cx(styles.kpiValue, unevaluatedAwarded.length > 0 && styles.neg)}>{unevaluated.length}</div>
                <div className={styles.kpiSub}>{unevaluatedAwarded.length > 0 ? `${unevaluatedAwarded.length} already hold awards` : "none holds an award"}</div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WATCH LIST</div>
                  <h2>Who needs a conversation</h2>
                </div>
              </header>

              {watch.length === 0 ? (
                <div className={styles.emptySmall}>
                  No warnings. Every supplier with an award is qualified and evaluated, scores above {FAIR_FROM}%, and none holds a dominant share.
                </div>
              ) : (
                <ul className={styles.watch}>
                  {watch.map((row) => (
                    <li key={row.supplier.id}>
                      <button className={styles.watchName} onClick={() => choose(row.supplier.id)} type="button">
                        {row.supplier.name}
                      </button>

                      <ul className={styles.warnings}>
                        {row.warnings.map((item) => (
                          <li className={cx(styles.warning, item.severe && styles.warningSevere)} key={item.key}>
                            {item.text}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">AWARDED VALUE</div>
                  <h2>Who holds the work</h2>
                </div>

                <span className={styles.muted}>{model.totalAwarded > 0 ? `${money(model.totalAwarded)} awarded` : ""}</span>
              </header>

              {slices.length === 0 ? (
                <div className={styles.emptySmall}>No package has been awarded yet.</div>
              ) : (
                <>
                  <div aria-hidden="true" className={styles.shareBar}>
                    {slices.map((slice) => (
                      <span key={slice.key} style={{ background: slice.color, flexGrow: slice.value }} title={`${slice.label}: ${percent(slice.share * 100)}`} />
                    ))}
                  </div>

                  <ul className={styles.shareLegend}>
                    {slices.map((slice) => (
                      <li key={slice.key}>
                        <span className={styles.swatch} style={{ background: slice.color }} />
                        <span className={styles.shareName}>{slice.label}</span>
                        <span className={styles.shareFigure}>
                          {money(slice.value)} · {percent(slice.share * 100)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <p className={styles.hint}>
                    {topHolder ? `${topHolder.supplier.name} holds ${percent(topHolder.share * 100)} of awarded value` : ""}
                    {holders.length > 3 ? `, and the top three hold ${percent(topThree * 100)}.` : "."}
                  </p>
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">LEAGUE</div>
                  <h2>Every supplier</h2>
                </div>

                <div aria-label="Sort suppliers" className={styles.segmented} role="group">
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

              <ul className={styles.league}>
                {ordered.map((row) => (
                  <li key={row.supplier.id}>
                    <button
                      aria-pressed={selected?.supplier.id === row.supplier.id}
                      className={cx(styles.leagueRow, selected?.supplier.id === row.supplier.id && styles.leagueOn)}
                      onClick={() => choose(row.supplier.id)}
                      type="button"
                    >
                      <span className={styles.leagueName}>
                        <strong>{row.supplier.name}</strong>
                        <small>
                          {words(row.supplier.supplierType)}
                          {row.supplier.trade ? ` · ${row.supplier.trade}` : ""} · {words(row.supplier.qualificationStatus)}
                        </small>
                      </span>

                      <span aria-hidden="true" className={styles.scoreTrack}>
                        <span className={cx(styles.scoreFill, BAND_CLASS[row.band])} style={{ width: `${Number.isFinite(row.average) ? Math.max(2, row.average) : 0}%` }} />
                      </span>

                      <span className={styles.leagueScore}>
                        <strong>{percent(row.average)}</strong>
                        <small className={cx(Number.isFinite(row.trend) && row.trend <= -3 && styles.neg, Number.isFinite(row.trend) && row.trend >= 3 && styles.pos)}>
                          {Number.isFinite(row.trend) ? `${signedPoints(row.trend)} pts` : BAND_LABEL[row.band]}
                        </small>
                      </span>

                      <span className={styles.leagueValue}>
                        {awardLine(row)}
                        {row.warnings.length > 0 && (
                          <em className={cx(styles.warnTag, row.warnings.some((item) => item.severe) && styles.warnTagSevere)}>
                            {row.warnings.length} {plural(row.warnings.length, "warning", "warnings")}
                          </em>
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            {selected && (
              <section className={styles.panel} ref={detailRef}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">SELECTED SUPPLIER</div>
                    <h2>{selected.supplier.name}</h2>
                  </div>

                  <span className={cx(styles.qualPill, selected.supplier.qualificationStatus === "QUALIFIED" ? styles.qualOk : styles.qualWarn)}>
                    {words(selected.supplier.qualificationStatus)}
                  </span>
                </header>

                <ul className={styles.facts2}>
                  <li>
                    <strong>{selected.evaluations.length}</strong> {plural(selected.evaluations.length, "evaluation", "evaluations")}
                  </li>
                  <li>
                    latest <strong>{percent(selected.latest)}</strong>
                  </li>
                  <li>
                    <strong>{selected.bids.length}</strong> {plural(selected.bids.length, "bid", "bids")}, <strong>{selected.won}</strong> selected
                  </li>
                  <li>
                    <strong>{selected.liveBids}</strong> live {plural(selected.liveBids, "bid", "bids")}
                  </li>
                  <li>
                    <strong>{money(selected.awardedValue)}</strong> awarded
                  </li>
                </ul>

                {selected.warnings.length > 0 && (
                  <ul className={cx(styles.warnings, styles.warningsInline)}>
                    {selected.warnings.map((item) => (
                      <li className={cx(styles.warning, item.severe && styles.warningSevere)} key={item.key}>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                )}

                <div className={styles.twoCol}>
                  <div>
                    <h3 className={styles.subhead}>Average score by area</h3>

                    {selected.evaluations.length === 0 ? (
                      <p className={styles.hint}>No evaluation has been recorded for this supplier.</p>
                    ) : (
                      <ul className={styles.dims}>
                        {DIMENSIONS.map((dimension) => {
                          const value = selected.dims[dimension.key];
                          const weakest = selected.weakest?.key === dimension.key;

                          return (
                            <li key={dimension.key}>
                              <span className={styles.dimName}>
                                {dimension.label}
                                {weakest && <em className={styles.weakTag}>lowest</em>}
                              </span>

                              <span aria-hidden="true" className={styles.scoreTrack}>
                                <span className={cx(styles.scoreFill, BAND_CLASS[bandOf(value)])} style={{ width: `${Number.isFinite(value) ? Math.max(2, value) : 0}%` }} />
                              </span>

                              <span className={styles.dimValue}>{percent(value)}</span>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>

                  <div>
                    <h3 className={styles.subhead}>Overall score over time</h3>
                    {selected.evaluations.length === 0 ? <p className={styles.hint}>Nothing to plot yet.</p> : <Sparkline row={selected} />}
                  </div>
                </div>

                <h3 className={styles.subhead}>Awards</h3>

                {selected.awards.length === 0 ? (
                  <p className={styles.hint}>This supplier has not been awarded a package.</p>
                ) : (
                  <>
                    <p className={styles.hint}>Packages awarded to this supplier.</p>

                    <div className={styles.tableWrap}>
                      <table className={cx(styles.table, styles.small)}>
                        <thead>
                          <tr>
                            <th>Package</th>
                            <th className={styles.num}>Value</th>
                            <th>Awarded</th>
                            <th>Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {selected.awards.map((pack) => (
                            <tr key={pack.id}>
                              <td className={styles.wrapCell}>
                                <strong>{pack.reference}</strong> {pack.title}
                              </td>
                              <td className={styles.num}>{money(pack.awardedValue ?? 0)}</td>
                              <td>{Number.isFinite(toDay(pack.awardDate)) ? formatDay(toDay(pack.awardDate)) : "—"}</td>
                              <td>{words(pack.status)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                <h3 className={styles.subhead}>Bids</h3>

                {selected.bids.length === 0 ? (
                  <p className={styles.hint}>This supplier has not bid on any package.</p>
                ) : (
                  <>
                    <p className={styles.hint}>Combined score is technical and commercial together.</p>

                    <div className={styles.tableWrap}>
                      <table className={cx(styles.table, styles.small)}>
                        <thead>
                          <tr>
                            <th>Package</th>
                            <th className={styles.num}>Bid</th>
                            <th className={styles.num}>Score</th>
                            <th>Result</th>
                          </tr>
                        </thead>

                        <tbody>
                          {selected.bids.map((bid) => {
                            const pack = packageById.get(bid.procurementPackageId);

                            return (
                              <tr key={bid.id}>
                                <td className={styles.wrapCell}>
                                  <strong>{bid.packageReference}</strong> {pack ? pack.title : ""}
                                </td>
                                <td className={styles.num}>{money(bid.bidAmount)}</td>
                                <td className={styles.num}>{percent((bid.combinedScore / bidScale) * 100)}</td>
                                <td>{words(bid.status)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            )}

            <p className={styles.note}>
              Scores are shown as a percentage of the scale the backend uses, which is detected from the data. A supplier&apos;s score is the
              average of its evaluations, and 75% and above counts as strong, 60% to 74% as fair and below 60% as weak. The trend is the
              latest evaluation minus the one before. Warnings are raised for a supplier that is not fully qualified yet holds an award or
              a live bid, holds an award with no evaluation, averages below 60%, dropped 8 points or more at its last evaluation, or holds
              {" "}40% or more of the awarded value.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
