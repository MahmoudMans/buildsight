"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  getProjectCommandCenter,
  getProjectCommercial,
  getProjectCostControl,
  getProjectDocuments,
  getProjectProcurement,
  getProjectProduction,
  getProjectQuality,
  getProjectResources,
  getProjectRiskControl,
  getProjectSafety,
  getProjectSchedule,
} from "@/lib/api";
import type { ProjectCommandCenter, ProjectHealthBand, ProjectHealthScore } from "@/types/project";

import styles from "./ProjectScorecardView.module.css";

type AxisKey =
  | "schedule"
  | "cost"
  | "commercial"
  | "procurement"
  | "resources"
  | "production"
  | "quality"
  | "safety"
  | "risk"
  | "documents";

type Tone = "good" | "watch" | "bad" | "none";

interface AxisDefinition {
  key: AxisKey;
  label: string;
  route: string;
}

interface AxisReading extends AxisDefinition {
  score: number;
  level: string;
  tone: Tone;
}

type Explanation =
  | { state: "loading" }
  | { state: "error" }
  | { state: "done"; text: string };

const AXES: ReadonlyArray<AxisDefinition> = [
  { key: "schedule", label: "Schedule", route: "schedule" },
  { key: "cost", label: "Cost", route: "costs" },
  { key: "commercial", label: "Commercial", route: "commercial" },
  { key: "procurement", label: "Procurement", route: "procurement" },
  { key: "resources", label: "Resources", route: "resources" },
  { key: "production", label: "Production", route: "production" },
  { key: "quality", label: "Quality", route: "quality" },
  { key: "safety", label: "Safety", route: "safety" },
  { key: "risk", label: "Risk", route: "risk-control" },
  { key: "documents", label: "Documents", route: "documents" },
];

const EXPLAIN: Record<AxisKey, (projectId: string) => Promise<string>> = {
  schedule: (id) => getProjectSchedule(id).then((response) => response.intelligence.explanation),
  cost: (id) => getProjectCostControl(id).then((response) => response.intelligence.explanation),
  commercial: (id) => getProjectCommercial(id).then((response) => response.intelligence.explanation),
  procurement: (id) => getProjectProcurement(id).then((response) => response.intelligence.explanation),
  resources: (id) => getProjectResources(id).then((response) => response.intelligence.explanation),
  production: (id) => getProjectProduction(id).then((response) => response.intelligence.explanation),
  quality: (id) => getProjectQuality(id).then((response) => response.intelligence.explanation),
  safety: (id) => getProjectSafety(id).then((response) => response.intelligence.explanation),
  risk: (id) => getProjectRiskControl(id).then((response) => response.intelligence.explanation),
  documents: (id) => getProjectDocuments(id).then((response) => response.intelligence.explanation),
};

const BAND_LABEL: Record<ProjectHealthBand, string> = {
  HEALTHY: "Healthy",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const BAND_CLASS: Record<ProjectHealthBand, string | undefined> = {
  HEALTHY: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const TONE_CLASS: Record<Tone, string | undefined> = {
  good: styles.riskGood,
  watch: styles.riskWatch,
  bad: styles.riskBad,
  none: styles.riskMuted,
};

const TONE_FILL: Record<Tone, string | undefined> = {
  good: styles.toneGood,
  watch: styles.toneWatch,
  bad: styles.toneBad,
  none: styles.toneNone,
};

const TONE_COLOR: Record<Tone, string> = {
  good: "#3f8a68",
  watch: "#d1a13a",
  bad: "#b5493e",
  none: "#8a948f",
};

const TONE_LABEL: Record<Tone, string> = {
  good: "On track",
  watch: "Watch",
  bad: "At risk",
  none: "No data",
};

const RINGS: ReadonlyArray<number> = [25, 50, 75, 100];
const MIN_AXES = 3;

const VIEW = { width: 640, height: 500, cx: 320, cy: 250, radius: 160 };

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function toneOf(level: string): Tone {
  if (level === "ON_TRACK") {
    return "good";
  }

  if (level === "WATCH") {
    return "watch";
  }

  if (level === "AT_RISK") {
    return "bad";
  }

  return "none";
}

function clampScore(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : 0;
}

function readAxis(definition: AxisDefinition, health: ProjectHealthScore): AxisReading {
  let score = 0;
  let level = "NO_DATA";

  switch (definition.key) {
    case "schedule":
      score = health.scheduleScore;
      level = health.scheduleRisk;
      break;
    case "cost":
      score = health.costScore;
      level = health.costRisk;
      break;
    case "commercial":
      score = health.commercialScore;
      level = health.commercialRisk;
      break;
    case "procurement":
      score = health.procurementScore;
      level = health.procurementRisk;
      break;
    case "resources":
      score = health.resourceScore;
      level = health.resourceRisk;
      break;
    case "production":
      score = health.productionScore;
      level = health.productionRisk;
      break;
    case "quality":
      score = health.qualityScore;
      level = health.qualityRisk;
      break;
    case "safety":
      score = health.safetyScore;
      level = health.safetyRisk;
      break;
    case "risk":
      score = health.riskScore;
      level = health.riskLevel;
      break;
    case "documents":
      score = health.informationScore;
      level = health.informationRisk;
      break;
  }

  return { ...definition, score: clampScore(score), level, tone: toneOf(level) };
}

function formatDate(value: string): string {
  const parts = value.slice(0, 10).split("-").map(Number);
  const time = Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1);

  if (!Number.isFinite(time)) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(time));
}

function polar(index: number, count: number, radius: number): { x: number; y: number } {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / count;

  return {
    x: VIEW.cx + Math.cos(angle) * radius,
    y: VIEW.cy + Math.sin(angle) * radius,
  };
}

export function ProjectScorecardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ProjectCommandCenter | null>(null);
  const [error, setError] = useState("");
  const [active, setActive] = useState<AxisKey | null>(null);
  const [open, setOpen] = useState<AxisKey | null>(null);
  const [explanations, setExplanations] = useState<Partial<Record<AxisKey, Explanation>>>({});

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectCommandCenter(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load project health. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const readings = data ? AXES.map((axis) => readAxis(axis, data.health)) : [];
    const scored = readings.filter((reading) => reading.tone !== "none");
    const ranked = [...scored].sort((a, b) => a.score - b.score);
    const missing = readings.filter((reading) => reading.tone === "none");

    const count = readings.length;
    const points = readings.map((reading, index) => ({
      reading,
      index,
      ...polar(index, count, (VIEW.radius * reading.score) / 100),
    }));

    const dataPoints = points.filter((point) => point.reading.tone !== "none");
    const average =
      scored.length > 0
        ? scored.reduce((sum, reading) => sum + reading.score, 0) / scored.length
        : null;

    return {
      readings,
      ranked,
      missing,
      points,
      dataPoints,
      average,
      weakest: ranked[0] ?? null,
      strongest: ranked[ranked.length - 1] ?? null,
      atRisk: scored.filter((reading) => reading.tone === "bad").length,
      watch: scored.filter((reading) => reading.tone === "watch").length,
    };
  }, [data]);

  function toggleExplanation(key: AxisKey) {
    if (open === key) {
      setOpen(null);

      return;
    }

    setOpen(key);

    if (!projectId || explanations[key]?.state === "done") {
      return;
    }

    setExplanations((current) => ({ ...current, [key]: { state: "loading" } }));

    EXPLAIN[key](projectId)
      .then((text) => {
        if (mounted.current) {
          setExplanations((current) => ({ ...current, [key]: { state: "done", text } }));
        }
      })
      .catch(() => {
        if (mounted.current) {
          setExplanations((current) => ({ ...current, [key]: { state: "error" } }));
        }
      });
  }

  const health = data?.health;
  const count = model.readings.length;
  const polygon = model.dataPoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const canDraw = model.dataPoints.length >= MIN_AXES;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">HEALTH RADAR</div>

            <h1>{data ? data.project.name : "Health radar"}</h1>

            <p className={styles.subtitle}>
              Every module score on one chart. The shape shows where the project is balanced and
              where it is being pulled in. Open any module to see what drives its score.
            </p>
          </div>

          <Link className="secondary-link-button" href={base}>
            Open command center
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading project health…</div>}

        {data && health && (
          <>
            <section aria-label="Health summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OVERALL HEALTH</div>
                <div className={styles.kpiValue}>{Math.round(health.score)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, BAND_CLASS[health.healthBand])}>
                    {BAND_LABEL[health.healthBand]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MODULE AVERAGE</div>
                <div className={styles.kpiValue}>
                  {model.average === null ? "—" : Math.round(model.average)}
                </div>
                <div className={styles.kpiSub}>
                  across {model.ranked.length} of {count} modules with data
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WEAKEST AREA</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>
                  {model.weakest ? model.weakest.label : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {model.weakest ? `Score ${Math.round(model.weakest.score)}` : "No module data"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>STRONGEST AREA</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>
                  {model.strongest ? model.strongest.label : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {model.strongest ? `Score ${Math.round(model.strongest.score)}` : "No module data"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AREAS AT RISK</div>
                <div className={cx(styles.kpiValue, model.atRisk > 0 && styles.neg)}>
                  {model.atRisk}
                </div>
                <div className={styles.kpiSub}>{model.watch} more on watch</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AS OF</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>
                  {formatDate(health.calculationDate)}
                </div>
                <div className={styles.kpiSub}>
                  {model.missing.length > 0
                    ? `${model.missing.length} without data`
                    : "All modules reporting"}
                </div>
              </article>
            </section>

            <div className={styles.radarGrid}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">SCORE SHAPE</div>
                    <h2>Module scores, 0 to 100</h2>
                  </div>

                  <span className={styles.muted}>{model.ranked.length} plotted</span>
                </header>

                {!canDraw ? (
                  <div className={styles.emptySmall}>
                    The radar needs at least {MIN_AXES} modules with data. Record data in more
                    modules and it will appear here.
                  </div>
                ) : (
                  <svg
                    aria-label={`Radar of ${model.dataPoints.length} module scores. Weakest is ${
                      model.weakest?.label ?? "none"
                    } at ${Math.round(model.weakest?.score ?? 0)}.`}
                    className={styles.radar}
                    role="img"
                    viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
                  >
                    {RINGS.map((ring) => {
                      const ringPoints = model.readings
                        .map((_, index) => {
                          const point = polar(index, count, (VIEW.radius * ring) / 100);

                          return `${point.x.toFixed(1)},${point.y.toFixed(1)}`;
                        })
                        .join(" ");

                      return (
                        <polygon
                          fill={ring === 100 ? "#fafbf9" : "none"}
                          key={ring}
                          points={ringPoints}
                          stroke="#dfe3df"
                          strokeWidth="1"
                        />
                      );
                    })}

                    {model.readings.map((reading, index) => {
                      const end = polar(index, count, VIEW.radius);

                      return (
                        <line
                          key={reading.key}
                          stroke="#e3e7e3"
                          strokeDasharray={reading.tone === "none" ? "3 4" : undefined}
                          x1={VIEW.cx}
                          x2={end.x}
                          y1={VIEW.cy}
                          y2={end.y}
                        />
                      );
                    })}

                    <polygon
                      fill="rgba(215, 255, 69, 0.28)"
                      points={polygon}
                      stroke="#19201e"
                      strokeLinejoin="round"
                      strokeWidth="1.8"
                    />

                    {RINGS.map((ring) => {
                      const label = polar(0, count, (VIEW.radius * ring) / 100);

                      return (
                        <text
                          className={styles.ringLabel}
                          fill="#8a948f"
                          key={ring}
                          textAnchor="start"
                          x={label.x + 5}
                          y={label.y + 3}
                        >
                          {ring}
                        </text>
                      );
                    })}

                    {model.points.map((point) => {
                      const { reading } = point;
                      const label = polar(point.index, count, VIEW.radius + 26);
                      const cos = Math.cos(-Math.PI / 2 + (point.index * 2 * Math.PI) / count);
                      const anchor = Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end";
                      const on = active === reading.key;

                      return (
                        <g
                          key={reading.key}
                          onMouseEnter={() => setActive(reading.key)}
                          onMouseLeave={() => setActive(null)}
                        >
                          {reading.tone !== "none" && (
                            <circle
                              cx={point.x}
                              cy={point.y}
                              fill={TONE_COLOR[reading.tone]}
                              r={on ? 7.5 : 5.5}
                              stroke="#ffffff"
                              strokeWidth="2"
                            >
                              <title>{`${reading.label}: ${Math.round(reading.score)} (${TONE_LABEL[reading.tone]})`}</title>
                            </circle>
                          )}

                          <text
                            className={styles.axisName}
                            fill={on ? "#19201e" : "#3c4642"}
                            fontWeight={on ? 800 : 700}
                            textAnchor={anchor}
                            x={label.x}
                            y={label.y - 2}
                          >
                            {reading.label}
                          </text>
                          <text
                            className={styles.axisScore}
                            fill={reading.tone === "none" ? "#9aa39f" : TONE_COLOR[reading.tone]}
                            fontWeight="800"
                            textAnchor={anchor}
                            x={label.x}
                            y={label.y + 13}
                          >
                            {reading.tone === "none" ? "No data" : Math.round(reading.score)}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                )}

                <ul aria-label="Colour legend" className={styles.legend}>
                  {(["good", "watch", "bad", "none"] as const).map((tone) => (
                    <li key={tone}>
                      <i className={styles.swatch} style={{ background: TONE_COLOR[tone] }} />
                      {TONE_LABEL[tone]}
                    </li>
                  ))}
                </ul>

                <p className={styles.hint}>
                  Scores are plotted as each module reports them. Colour comes from the module's
                  own risk level, so a high score can still show as watch. Modules without data are
                  left off the shape.
                </p>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">WEAKEST FIRST</div>
                    <h2>Where to look</h2>
                  </div>

                  <span className={styles.muted}>
                    {model.atRisk} at risk · {model.watch} watch
                  </span>
                </header>

                {model.ranked.length === 0 ? (
                  <div className={styles.emptySmall}>No module has reported data yet.</div>
                ) : (
                  <ol className={styles.rankList}>
                    {model.ranked.map((reading, index) => {
                      const entry = explanations[reading.key];
                      const isOpen = open === reading.key;

                      return (
                        <li
                          className={cx(styles.rank, active === reading.key && styles.rankOn)}
                          key={reading.key}
                          onMouseEnter={() => setActive(reading.key)}
                          onMouseLeave={() => setActive(null)}
                        >
                          <div className={styles.rankTop}>
                            <span className={styles.rankNo}>{index + 1}</span>

                            <Link className={styles.rankName} href={`${base}/${reading.route}`}>
                              {reading.label}
                            </Link>

                            <button
                              aria-expanded={isOpen}
                              aria-label={`${isOpen ? "Hide" : "Show"} why ${reading.label} scores ${Math.round(reading.score)}`}
                              className={styles.linkButton}
                              onClick={() => toggleExplanation(reading.key)}
                              type="button"
                            >
                              {isOpen ? "Hide" : "Why?"}
                            </button>

                            <span className={cx(styles.pill, TONE_CLASS[reading.tone])}>
                              {TONE_LABEL[reading.tone]}
                            </span>

                            <strong className={styles.rankScore}>{Math.round(reading.score)}</strong>
                          </div>

                          <div
                            aria-label={`${reading.label} score ${Math.round(reading.score)} of 100`}
                            className={styles.track}
                            role="img"
                          >
                            <div
                              className={cx(styles.fill, TONE_FILL[reading.tone])}
                              style={{ width: `${reading.score}%` }}
                            />
                          </div>

                          {isOpen && (
                            <p className={styles.why}>
                              {entry?.state === "done"
                                ? entry.text
                                : entry?.state === "error"
                                  ? "Could not load the explanation for this module."
                                  : "Loading…"}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}

                {model.missing.length > 0 && (
                  <p className={styles.hint}>
                    No data yet for{" "}
                    {model.missing.map((reading, index) => (
                      <span key={reading.key}>
                        {index > 0 && ", "}
                        <Link className={styles.inlineLink} href={`${base}/${reading.route}`}>
                          {reading.label.toLowerCase()}
                        </Link>
                      </span>
                    ))}
                    .
                  </p>
                )}
              </section>
            </div>

            <p className={styles.note}>{health.explanation}</p>
          </>
        )}
      </main>
    </div>
  );
}
