"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectRiskControl } from "@/lib/api";
import type {
  IssueSeverity,
  ProjectRisk,
  RiskControl,
  RiskExposureBand,
  RiskIntelligenceLevel,
} from "@/types/project";

import styles from "./ProjectRiskMatrixView.module.css";

const DAY_MS = 86_400_000;

type View = "residual" | "inherent";
type Zone = "low" | "moderate" | "high" | "critical";

interface Cell {
  p: number;
  i: number;
}

const PROBABILITY_LABELS = [
  "Rare",
  "Unlikely",
  "Possible",
  "Likely",
  "Almost certain",
];

const IMPACT_LABELS = ["Negligible", "Minor", "Moderate", "Major", "Severe"];

const LEVEL_LABEL: Record<RiskIntelligenceLevel, string> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const LEVEL_CLASS: Record<RiskIntelligenceLevel, string> = {
  NO_DATA: styles.levelNone,
  ON_TRACK: styles.levelGood,
  WATCH: styles.levelWatch,
  AT_RISK: styles.levelBad,
};

const BAND_LABEL: Record<RiskExposureBand, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  CRITICAL: "Critical",
};

const BAND_CLASS: Record<RiskExposureBand, string> = {
  LOW: styles.bandLow,
  MODERATE: styles.bandModerate,
  HIGH: styles.bandHigh,
  CRITICAL: styles.bandCritical,
};

const ZONE_CLASS: Record<Zone, string> = {
  low: styles.zoneLow,
  moderate: styles.zoneModerate,
  high: styles.zoneHigh,
  critical: styles.zoneCritical,
};

const ZONE_LABEL: Record<Zone, string> = {
  critical: "Critical",
  high: "High",
  moderate: "Moderate",
  low: "Low",
};

const ZONE_ORDER: Zone[] = ["critical", "high", "moderate", "low"];

const SEVERITY_RANK: Record<IssueSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const SEVERITY_CLASS: Record<IssueSeverity, string> = {
  CRITICAL: styles.bandCritical,
  HIGH: styles.bandHigh,
  MEDIUM: styles.bandModerate,
  LOW: styles.bandLow,
};

function startOfToday(): number {
  const now = new Date();

  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS,
  );
}

function dayNumber(value: string): number {
  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(
    Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS,
  );
}

function formatDate(value: string | null): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function humanize(value: string): string {
  const text = value.replace(/_/g, " ").toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function levelOf(value: number, scale: number): number {
  const rounded = Number.isFinite(value) ? Math.round(value) : 1;

  return Math.min(scale, Math.max(1, rounded));
}

function zoneFor(score: number, scale: number): Zone {
  const fraction = score / (scale * scale);

  if (fraction < 0.2) {
    return "low";
  }

  if (fraction < 0.4) {
    return "moderate";
  }

  if (fraction < 0.68) {
    return "high";
  }

  return "critical";
}

function scoreOf(risk: ProjectRisk, view: View): number {
  const value = Number(
    view === "residual" ? risk.residualScore : risk.inherentScore,
  );

  return Number.isFinite(value) ? value : 0;
}

function cellOf(risk: ProjectRisk, view: View, scale: number): Cell {
  const probability =
    view === "residual" ? risk.residualProbability : risk.probability;

  const impact = view === "residual" ? risk.residualImpact : risk.impact;

  return {
    p: levelOf(Number(probability), scale),
    i: levelOf(Number(impact), scale),
  };
}

function isActive(risk: ProjectRisk): boolean {
  return risk.status === "OPEN" || risk.status === "MITIGATING";
}

export function ProjectRiskMatrixView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<RiskControl | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("residual");
  const [includeClosed, setIncludeClosed] = useState(false);
  const [category, setCategory] = useState("ALL");
  const [selected, setSelected] = useState<Cell | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectRiskControl(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError(
              "Could not load risk data. Check that the backend is running.",
            );
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const scale = useMemo(() => {
    const values = (data?.risks ?? [])
      .flatMap((risk) => [
        risk.probability,
        risk.impact,
        risk.residualProbability,
        risk.residualImpact,
      ])
      .map(Number)
      .filter(Number.isFinite);

    return Math.min(10, Math.max(5, Math.ceil(Math.max(0, ...values))));
  }, [data]);

  const categories = useMemo(
    () =>
      Array.from(new Set((data?.risks ?? []).map((risk) => risk.category))).sort(),
    [data],
  );

  const visible = useMemo(
    () =>
      (data?.risks ?? []).filter(
        (risk) =>
          (includeClosed || risk.status !== "CLOSED") &&
          (category === "ALL" || risk.category === category),
      ),
    [data, includeClosed, category],
  );

  const cells = useMemo(() => {
    const map = new Map<string, ProjectRisk[]>();

    for (const risk of visible) {
      const position = cellOf(risk, view, scale);
      const key = `${position.p}-${position.i}`;
      const list = map.get(key);

      if (list) {
        list.push(risk);
      } else {
        map.set(key, [risk]);
      }
    }

    return map;
  }, [visible, view, scale]);

  const zoneCounts = useMemo(() => {
    const counts: Record<Zone, number> = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
    };

    for (const risk of visible) {
      const position = cellOf(risk, view, scale);

      counts[zoneFor(position.p * position.i, scale)] += 1;
    }

    return counts;
  }, [visible, view, scale]);

  const effect = useMemo(() => {
    const active = visible.filter(isActive);

    if (active.length === 0) {
      return null;
    }

    const reductions = active.map(
      (risk) => Number(risk.inherentScore) - Number(risk.residualScore),
    );

    return {
      count: active.length,
      average:
        reductions.reduce((total, value) => total + value, 0) / active.length,
      notReduced: reductions.filter((value) => value <= 0).length,
    };
  }, [visible]);

  const tableRisks = useMemo(() => {
    const source = selected
      ? (cells.get(`${selected.p}-${selected.i}`) ?? [])
      : visible;

    return [...source].sort(
      (a, b) =>
        scoreOf(b, view) - scoreOf(a, view) ||
        a.reference.localeCompare(b.reference),
    );
  }, [selected, cells, visible, view]);

  const openIssues = useMemo(
    () =>
      (data?.issues ?? [])
        .filter(
          (issue) => issue.status === "OPEN" || issue.status === "IN_PROGRESS",
        )
        .sort(
          (a, b) =>
            SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
            a.targetResolutionDate.localeCompare(b.targetResolutionDate),
        )
        .slice(0, 8),
    [data],
  );

  const activeDelays = useMemo(
    () =>
      (data?.delays ?? [])
        .filter((delay) => delay.status !== "RESOLVED")
        .sort(
          (a, b) => Number(b.forecastDelayDays) - Number(a.forecastDelayDays),
        )
        .slice(0, 8),
    [data],
  );

  const rows = Array.from({ length: scale }, (_, index) => scale - index);
  const cols = Array.from({ length: scale }, (_, index) => index + 1);
  const intel = data?.intelligence;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">RISK MATRIX</div>

            <h1>{data ? data.project.name : "Risk matrix"}</h1>

            <p className={styles.subtitle}>
              Where the project&apos;s risks sit by probability and impact.
              Compare the position before and after mitigation, then click a
              cell to see its risks. Edit risks in risk control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/risk-control`}>
            Open risk control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && (
          <div className={styles.loading}>Loading risk matrix…</div>
        )}

        {data && intel && (
          <>
            <section aria-label="Risk summary" className={styles.kpis}>
              <article className={`${styles.kpi} ${styles.kpiDark}`}>
                <div className={styles.kpiLabel}>RISK SCORE</div>
                <div className={styles.kpiValue}>
                  {Math.round(intel.riskScore)}
                </div>
                <div className={styles.kpiSub}>
                  <span
                    className={`${styles.pill} ${LEVEL_CLASS[intel.riskLevel]}`}
                  >
                    {LEVEL_LABEL[intel.riskLevel]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN RISKS</div>
                <div className={styles.kpiValue}>{intel.openRisks}</div>
                <div className={styles.kpiSub}>
                  {intel.totalRisks} registered
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>HIGH EXPOSURE</div>
                <div
                  className={`${styles.kpiValue} ${
                    intel.highExposureRisks > 0 ? styles.bad : ""
                  }`}
                >
                  {intel.highExposureRisks}
                </div>
                <div className={styles.kpiSub}>
                  Max residual {Math.round(intel.maximumResidualExposure)}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVERDUE MITIGATIONS</div>
                <div
                  className={`${styles.kpiValue} ${
                    intel.overdueMitigations > 0 ? styles.bad : ""
                  }`}
                >
                  {intel.overdueMitigations}
                </div>
                <div className={styles.kpiSub}>Past their due date</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CRITICAL ISSUES</div>
                <div
                  className={`${styles.kpiValue} ${
                    intel.criticalOpenIssues > 0 ? styles.bad : ""
                  }`}
                >
                  {intel.criticalOpenIssues}
                </div>
                <div className={styles.kpiSub}>
                  {intel.openIssues} open issues
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST DELAY</div>
                <div className={styles.kpiValue}>
                  {intel.forecastDelayDays} d
                </div>
                <div className={styles.kpiSub}>
                  {intel.activeDelays} active delays
                </div>
              </article>
            </section>

            <div className={styles.toolbar}>
              <div className={styles.seg} role="group" aria-label="Position">
                <button
                  aria-pressed={view === "residual"}
                  className={`${styles.segBtn} ${
                    view === "residual" ? styles.segActive : ""
                  }`}
                  onClick={() => setView("residual")}
                  type="button"
                >
                  After mitigation
                </button>

                <button
                  aria-pressed={view === "inherent"}
                  className={`${styles.segBtn} ${
                    view === "inherent" ? styles.segActive : ""
                  }`}
                  onClick={() => setView("inherent")}
                  type="button"
                >
                  Before mitigation
                </button>
              </div>

              <select
                aria-label="Filter by category"
                className={styles.select}
                onChange={(event) => {
                  setCategory(event.target.value);
                  setSelected(null);
                }}
                value={category}
              >
                <option value="ALL">All categories</option>

                {categories.map((value) => (
                  <option key={value} value={value}>
                    {humanize(value)}
                  </option>
                ))}
              </select>

              <label className={styles.check}>
                <input
                  checked={includeClosed}
                  onChange={(event) => {
                    setIncludeClosed(event.target.checked);
                    setSelected(null);
                  }}
                  type="checkbox"
                />
                Include closed risks
              </label>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">
                    {view === "residual" ? "RESIDUAL" : "INHERENT"} RISK
                    POSITION
                  </div>

                  <h2>
                    {visible.length} risk{visible.length === 1 ? "" : "s"} on
                    the matrix
                  </h2>
                </div>

                <ul className={styles.zones}>
                  {ZONE_ORDER.map((zone) => (
                    <li key={zone}>
                      <i className={ZONE_CLASS[zone]} />
                      {ZONE_LABEL[zone]}
                      <b>{zoneCounts[zone]}</b>
                    </li>
                  ))}
                </ul>
              </header>

              {visible.length === 0 ? (
                <div className={styles.empty}>
                  {data.risks.length === 0
                    ? "No risks registered yet. Add risks in risk control to populate the matrix."
                    : "No risks match the current filters."}
                </div>
              ) : (
                <>
                  <div className={styles.matrixScroll}>
                    <div
                      className={styles.matrix}
                      style={{
                        gridTemplateColumns: `96px repeat(${scale}, minmax(86px, 1fr))`,
                      }}
                    >
                      {rows.map((p) => (
                        <Fragment key={p}>
                          <div className={styles.rowLabel}>
                            <b>{p}</b>
                            <span>
                              {scale === 5 ? (PROBABILITY_LABELS[p - 1] ?? "") : ""}
                            </span>
                          </div>

                          {cols.map((i) => {
                            const list = cells.get(`${p}-${i}`) ?? [];
                            const zone = zoneFor(p * i, scale);

                            const isSelected =
                              selected?.p === p && selected?.i === i;

                            return (
                              <button
                                aria-label={`Probability ${p}, impact ${i}: ${
                                  list.length
                                } risk${list.length === 1 ? "" : "s"}`}
                                aria-pressed={isSelected}
                                className={`${styles.cell} ${ZONE_CLASS[zone]} ${
                                  isSelected ? styles.cellSelected : ""
                                }`}
                                disabled={list.length === 0}
                                key={i}
                                onClick={() =>
                                  setSelected(isSelected ? null : { p, i })
                                }
                                type="button"
                              >
                                <span className={styles.cellScore}>{p * i}</span>

                                <span className={styles.chips}>
                                  {list.slice(0, 3).map((risk) => (
                                    <i key={risk.id}>{risk.reference}</i>
                                  ))}

                                  {list.length > 3 && (
                                    <i>+{list.length - 3}</i>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </Fragment>
                      ))}

                      <div />

                      {cols.map((i) => (
                        <div className={styles.colLabel} key={i}>
                          <b>{i}</b>
                          <span>
                            {scale === 5 ? (IMPACT_LABELS[i - 1] ?? "") : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <p className={styles.axisNote}>
                    Rows are probability (top is most likely). Columns are
                    impact (right is most severe). Cell colour shows the
                    standard score zone, and the number is probability × impact.
                  </p>
                </>
              )}

              {effect && (
                <div className={styles.effect}>
                  <div>
                    <span>AVERAGE MITIGATION EFFECT</span>
                    <strong>
                      {effect.average >= 0 ? "−" : "+"}
                      {Math.abs(effect.average).toFixed(1)} points
                    </strong>
                    <small>
                      Inherent to residual score, across {effect.count} active
                      risk{effect.count === 1 ? "" : "s"}
                    </small>
                  </div>

                  <div>
                    <span>NO REDUCTION YET</span>
                    <strong className={effect.notReduced > 0 ? styles.bad : ""}>
                      {effect.notReduced}
                    </strong>
                    <small>Active risks whose residual score is not lower</small>
                  </div>
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">REGISTER</div>

                  <h2>
                    {selected
                      ? `Probability ${selected.p} × impact ${selected.i}`
                      : `All risks by ${view} score`}
                  </h2>
                </div>

                {selected && (
                  <button
                    className={styles.link}
                    onClick={() => setSelected(null)}
                    type="button"
                  >
                    Clear selection
                  </button>
                )}
              </header>

              {tableRisks.length === 0 ? (
                <div className={styles.empty}>No risks in this selection.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>RISK</th>
                        <th>OWNER</th>
                        <th>INHERENT → RESIDUAL</th>
                        <th>EXPOSURE</th>
                        <th>MITIGATION DUE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {tableRisks.map((risk) => {
                        const overdue =
                          isActive(risk) &&
                          Boolean(risk.mitigationDueDate) &&
                          dayNumber(risk.mitigationDueDate) < today;

                        return (
                          <tr key={risk.id}>
                            <td>
                              <strong>
                                {risk.reference} · {risk.title}
                              </strong>
                              <small>{humanize(risk.category)}</small>
                            </td>

                            <td>{risk.ownerName || "—"}</td>

                            <td className={styles.scores}>
                              {Math.round(Number(risk.inherentScore))}
                              <span aria-hidden="true">→</span>
                              <b>{Math.round(Number(risk.residualScore))}</b>
                            </td>

                            <td>
                              <span
                                className={`${styles.pill} ${
                                  BAND_CLASS[risk.exposureBand]
                                }`}
                              >
                                {BAND_LABEL[risk.exposureBand]}
                              </span>
                            </td>

                            <td>
                              {formatDate(risk.mitigationDueDate)}
                              {overdue && (
                                <em className={styles.late}>OVERDUE</em>
                              )}
                            </td>

                            <td>{humanize(risk.status)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">ISSUES</div>
                    <h2>Open issues</h2>
                  </div>

                  <span className={styles.muted}>
                    {intel.openIssues} open
                  </span>
                </header>

                {openIssues.length === 0 ? (
                  <div className={styles.emptySmall}>No open issues.</div>
                ) : (
                  <ul className={styles.list}>
                    {openIssues.map((issue) => {
                      const late =
                        Boolean(issue.targetResolutionDate) &&
                        dayNumber(issue.targetResolutionDate) < today;

                      return (
                        <li key={issue.id}>
                          <span
                            className={`${styles.pill} ${
                              SEVERITY_CLASS[issue.severity]
                            }`}
                          >
                            {issue.severity}
                          </span>

                          <div>
                            <strong>
                              {issue.reference} · {issue.title}
                            </strong>

                            <small>
                              {issue.ownerName || "Unassigned"} · target{" "}
                              {formatDate(issue.targetResolutionDate)}
                              {late && (
                                <em className={styles.late}>OVERDUE</em>
                              )}
                            </small>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">DELAYS</div>
                    <h2>Active delay events</h2>
                  </div>

                  <span className={styles.muted}>
                    {intel.forecastDelayDays} d forecast
                  </span>
                </header>

                {activeDelays.length === 0 ? (
                  <div className={styles.emptySmall}>
                    No active delay events.
                  </div>
                ) : (
                  <ul className={styles.list}>
                    {activeDelays.map((delay) => (
                      <li key={delay.id}>
                        <span className={`${styles.pill} ${styles.bandHigh}`}>
                          {delay.forecastDelayDays} d
                        </span>

                        <div>
                          <strong>
                            {delay.reference} · {delay.title}
                          </strong>

                          <small>
                            {humanize(delay.cause)} ·{" "}
                            {delay.excusable ? "Excusable" : "Non-excusable"} ·{" "}
                            {delay.compensable
                              ? "Compensable"
                              : "Non-compensable"}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <p className={styles.note}>{intel.explanation}</p>
          </>
        )}
      </main>
    </div>
  );
}
