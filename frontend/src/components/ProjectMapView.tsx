"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectCommandCenter } from "@/lib/api";
import type { ProjectCommandCenter, ProjectHealthScore } from "@/types/project";

import styles from "./ProjectMapView.module.css";

type Layout = "area" | "weakest";
type Tone = "good" | "watch" | "weak" | "none";

interface LinkItem {
  slug: string;
  label: string;
}

interface Area {
  key: string;
  group: string;
  label: string;
  blurb: string;
  slug: string;
  open: string;
  boards: LinkItem[];
  score?: (health: ProjectHealthScore) => number;
  risk?: (health: ProjectHealthScore) => string;
}

interface Tile {
  area: Area;
  score: number;
  risk: string;
  tone: Tone;
}

const DELIVERY = "Delivery";
const MONEY = "Money";
const ASSURANCE = "Assurance";
const MANAGEMENT = "Management";

const GROUPS = [DELIVERY, MONEY, ASSURANCE, MANAGEMENT];

const AREAS: Area[] = [
  {
    key: "schedule",
    group: DELIVERY,
    label: "Schedule",
    blurb: "Milestones, critical path and the forecast finish.",
    slug: "schedule",
    open: "Open schedule",
    boards: [
      { slug: "lookahead", label: "Lookahead" },
      { slug: "timeline", label: "Timeline" },
    ],
    score: (h) => h.scheduleScore,
    risk: (h) => String(h.scheduleRisk),
  },
  {
    key: "production",
    group: DELIVERY,
    label: "Production",
    blurb: "Work packages, output against plan and productivity.",
    slug: "production",
    open: "Open production",
    boards: [{ slug: "production-board", label: "Production board" }],
    score: (h) => h.productionScore,
    risk: (h) => String(h.productionRisk),
  },
  {
    key: "resources",
    group: DELIVERY,
    label: "Resources",
    blurb: "Labour and equipment against what the work needs.",
    slug: "resources",
    open: "Open resources",
    boards: [{ slug: "resource-heatmap", label: "Heat map" }],
    score: (h) => h.resourceScore,
    risk: (h) => String(h.resourceRisk),
  },
  {
    key: "procurement",
    group: DELIVERY,
    label: "Procurement",
    blurb: "Packages, suppliers and what is due on site.",
    slug: "procurement",
    open: "Open procurement",
    boards: [{ slug: "procurement-pipeline", label: "Pipeline" }],
    score: (h) => h.procurementScore,
    risk: (h) => String(h.procurementRisk),
  },
  {
    key: "costs",
    group: MONEY,
    label: "Cost control",
    blurb: "Budget, commitments, spend and the forecast at completion.",
    slug: "costs",
    open: "Open cost control",
    boards: [
      { slug: "spend-board", label: "Spend board" },
      { slug: "cost-breakdown", label: "Breakdown" },
      { slug: "cashflow", label: "Cash flow" },
    ],
    score: (h) => h.costScore,
    risk: (h) => String(h.costRisk),
  },
  {
    key: "commercial",
    group: MONEY,
    label: "Commercial",
    blurb: "Change orders, claims, certificates and payment.",
    slug: "commercial",
    open: "Open commercial",
    boards: [
      { slug: "commercial-board", label: "Commercial board" },
      { slug: "entitlement-board", label: "Entitlement board" },
    ],
    score: (h) => h.commercialScore,
    risk: (h) => String(h.commercialRisk),
  },
  {
    key: "forecast",
    group: MONEY,
    label: "Forecast",
    blurb: "Earned value, finish and cost forecasts and what-ifs.",
    slug: "forecast",
    open: "Open forecast",
    boards: [
      { slug: "scenarios", label: "Scenarios" },
      { slug: "trends", label: "Trends" },
      { slug: "since-report", label: "Since last report" },
    ],
  },
  {
    key: "period",
    group: MONEY,
    label: "Period control",
    blurb: "Monthly close, accruals and period-by-period results.",
    slug: "period-control",
    open: "Open period control",
    boards: [{ slug: "period-board", label: "Period board" }],
  },
  {
    key: "recovery",
    group: MONEY,
    label: "Recovery",
    blurb: "Recovery plans for time and money that have slipped.",
    slug: "recovery",
    open: "Open recovery",
    boards: [{ slug: "recovery-board", label: "Recovery board" }],
  },
  {
    key: "risk",
    group: ASSURANCE,
    label: "Risk control",
    blurb: "Risks, issues, change events and delay events.",
    slug: "risk-control",
    open: "Open risk control",
    boards: [
      { slug: "risk-board", label: "Risk board" },
      { slug: "risk-matrix", label: "Risk matrix" },
    ],
    score: (h) => h.riskScore,
    risk: (h) => String(h.riskLevel),
  },
  {
    key: "quality",
    group: ASSURANCE,
    label: "Quality",
    blurb: "Inspections, defects and non-conformance reports.",
    slug: "quality",
    open: "Open quality",
    boards: [{ slug: "quality-board", label: "Quality board" }],
    score: (h) => h.qualityScore,
    risk: (h) => String(h.qualityRisk),
  },
  {
    key: "safety",
    group: ASSURANCE,
    label: "Safety",
    blurb: "Incidents, hazards, permits and toolbox talks.",
    slug: "safety",
    open: "Open safety",
    boards: [{ slug: "safety-board", label: "Safety board" }],
    score: (h) => h.safetyScore,
    risk: (h) => String(h.safetyRisk),
  },
  {
    key: "documents",
    group: ASSURANCE,
    label: "Documents",
    blurb: "Drawings, submittals and requests for information.",
    slug: "documents",
    open: "Open documents",
    boards: [{ slug: "rfi-board", label: "RFI board" }],
    score: (h) => h.informationScore,
    risk: (h) => String(h.informationRisk),
  },
  {
    key: "governance",
    group: MANAGEMENT,
    label: "Governance",
    blurb: "Meetings, decisions, actions and the executive report.",
    slug: "governance",
    open: "Open governance",
    boards: [
      { slug: "governance-board", label: "Governance board" },
      { slug: "board", label: "Action board" },
    ],
  },
  {
    key: "reporting",
    group: MANAGEMENT,
    label: "Reporting",
    blurb: "The status report, the health radar and data exports.",
    slug: "report",
    open: "Open status report",
    boards: [
      { slug: "scorecard", label: "Health radar" },
      { slug: "export", label: "Data export" },
    ],
  },
  {
    key: "inbox",
    group: MANAGEMENT,
    label: "Inbox",
    blurb: "Everything still open across the modules, in date order.",
    slug: "inbox",
    open: "Open inbox",
    boards: [],
  },
  {
    key: "copilot",
    group: MANAGEMENT,
    label: "AI copilot",
    blurb: "Ask questions about this project in plain language.",
    slug: "copilot",
    open: "Open copilot",
    boards: [],
  },
];

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function num(value: number, digits = 0): string {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function pretty(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  const text = value.replace(/_/g, " ").toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDate(value: string | null | undefined): string {
  if (!value) {
    return "—";
  }

  const parts = value.slice(0, 10).split("-").map(Number);
  const stamp = Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1);

  if (!Number.isFinite(stamp)) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(stamp));
}

function toneOf(score: number): Tone {
  if (!Number.isFinite(score)) {
    return "none";
  }

  return score >= 75 ? "good" : score >= 55 ? "watch" : "weak";
}

const BAR_CLASS: Record<Tone, string | undefined> = {
  good: styles.toneGood,
  watch: styles.toneWatch,
  weak: styles.toneBad,
  none: styles.toneNone,
};

const SCORE_CLASS: Record<Tone, string | undefined> = {
  good: styles.scoreGood,
  watch: styles.scoreWatch,
  weak: styles.scoreWeak,
  none: styles.scoreNone,
};

const TONE_LABEL: Record<Tone, string> = {
  good: "Healthy",
  watch: "Watch",
  weak: "Weak",
  none: "No score",
};

function average(tiles: ReadonlyArray<Tile>): number {
  const scored = tiles.filter((tile) => tile.tone !== "none");

  return scored.length === 0 ? NaN : scored.reduce((sum, tile) => sum + tile.score, 0) / scored.length;
}

export function ProjectMapView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [center, setCenter] = useState<ProjectCommandCenter | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [layout, setLayout] = useState<Layout>("area");

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectCommandCenter(projectId)
      .then((result) => {
        if (!cancelled) {
          setCenter(result);
          setLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCenter(null);
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const health = center?.health ?? null;

  const tiles = useMemo<Tile[]>(
    () =>
      AREAS.map((area) => {
        const score = health && area.score ? area.score(health) : NaN;

        return {
          area,
          score: Number.isFinite(score) ? score : NaN,
          risk: health && area.risk ? area.risk(health) : "",
          tone: toneOf(score),
        };
      }),
    [health],
  );

  const scored = tiles.filter((tile) => tile.tone !== "none");
  const weakest = [...scored].sort((a, b) => a.score - b.score)[0] ?? null;
  const strongest = [...scored].sort((a, b) => b.score - a.score)[0] ?? null;
  const weak = scored.filter((tile) => tile.tone === "weak");
  const watch = scored.filter((tile) => tile.tone === "watch");

  const ordered = useMemo(() => {
    const withScore = tiles.filter((tile) => tile.tone !== "none").sort((a, b) => a.score - b.score);
    const without = tiles.filter((tile) => tile.tone === "none");

    return [...withScore, ...without];
  }, [tiles]);

  function renderTile(tile: Tile, showGroup: boolean) {
    const { area } = tile;
    const href = area.slug ? `${base}/${area.slug}` : base;

    return (
      <article className={styles.tile} key={area.key}>
        <div className={styles.tileTop}>
          <div>
            {showGroup && <div className={styles.tileGroup}>{area.group.toUpperCase()}</div>}
            <h3 className={styles.tileTitle}>{area.label}</h3>
          </div>

          {tile.tone !== "none" ? (
            <span aria-label={`${area.label} score ${num(tile.score)} out of 100, ${TONE_LABEL[tile.tone]}`} className={cx(styles.score, SCORE_CLASS[tile.tone])}>
              {num(tile.score)}
            </span>
          ) : (
            <span className={cx(styles.score, SCORE_CLASS.none)}>—</span>
          )}
        </div>

        {tile.tone !== "none" ? (
          <>
            <div aria-hidden="true" className={styles.track}>
              <div className={cx(styles.fill, BAR_CLASS[tile.tone])} style={{ width: `${Math.max(2, Math.min(100, tile.score))}%` }} />
            </div>

            <div className={styles.caption}>
              {TONE_LABEL[tile.tone]}
              {tile.risk && pretty(tile.risk).toLowerCase() !== TONE_LABEL[tile.tone].toLowerCase() ? ` · ${pretty(tile.risk)}` : ""}
            </div>
          </>
        ) : (
          <div className={styles.caption}>{area.score ? "Score unavailable" : "Not part of the health score"}</div>
        )}

        <p className={styles.blurb}>{area.blurb}</p>

        <div className={styles.actions}>
          <Link className={styles.open} href={href}>
            {area.open}
          </Link>

          {area.boards.map((board) => (
            <Link className={styles.chip} href={`${base}/${board.slug}`} key={board.slug}>
              {board.label}
            </Link>
          ))}
        </div>
      </article>
    );
  }

  const failed = loaded && !center;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">PROJECT MAP</div>

            <h1>Everything in this project</h1>

            <p className={styles.subtitle}>
              Every module and board, grouped by what it is for, with the latest health score on each so you can see where to go first.
            </p>
          </div>

          <Link className="secondary-link-button" href="/portfolio/tower">
            Open portfolio tower
          </Link>
        </header>

        {!loaded && <div className={styles.loading}>Loading health scores…</div>}

        {failed && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the health scores. Check that the backend is running.</strong>
              <span> The links below still work.</span>
            </div>
          </div>
        )}

        {loaded && health && (
          <>
            <section aria-label="Health summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>HEALTH SCORE</div>
                <div className={styles.kpiValue}>{num(health.score)}</div>
                <div className={styles.kpiSub}>
                  {pretty(String(health.healthBand))} · {formatDate(health.calculationDate)}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WEAKEST AREA</div>
                <div className={cx(styles.kpiValue, weakest && weakest.tone === "weak" && styles.neg)}>{weakest ? num(weakest.score) : "—"}</div>
                <div className={styles.kpiSub}>{weakest ? weakest.area.label : "no scored areas"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>STRONGEST AREA</div>
                <div className={cx(styles.kpiValue, strongest && strongest.tone === "good" && styles.pos)}>{strongest ? num(strongest.score) : "—"}</div>
                <div className={styles.kpiSub}>{strongest ? strongest.area.label : "no scored areas"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WEAK, BELOW 55</div>
                <div className={cx(styles.kpiValue, weak.length > 0 && styles.neg)}>{weak.length}</div>
                <div className={styles.kpiSub}>
                  {weak.length > 0 ? weak.map((tile) => tile.area.label).slice(0, 2).join(", ") : "none"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WATCH, 55 TO 74</div>
                <div className={styles.kpiValue}>{watch.length}</div>
                <div className={styles.kpiSub}>
                  {watch.length > 0 ? watch.map((tile) => tile.area.label).slice(0, 2).join(", ") : "none"}
                </div>
              </article>
            </section>

            {health.explanation && <p className={styles.callout}>{health.explanation}</p>}
          </>
        )}

        {loaded && (
          <section aria-label="Project areas">
            <div className={styles.mapHead}>
              <div className="eyebrow">{AREAS.length} AREAS</div>

              <div aria-label="How to arrange the areas" className={styles.segmented} role="group">
                <button
                  aria-pressed={layout === "area"}
                  className={cx(styles.segment, layout === "area" && styles.segmentOn)}
                  onClick={() => setLayout("area")}
                  type="button"
                >
                  By area
                </button>

                <button
                  aria-pressed={layout === "weakest"}
                  className={cx(styles.segment, layout === "weakest" && styles.segmentOn)}
                  disabled={!health}
                  onClick={() => setLayout("weakest")}
                  type="button"
                >
                  Weakest first
                </button>
              </div>
            </div>

            {layout === "area" || !health ? (
              GROUPS.map((group) => {
                const groupTiles = tiles.filter((tile) => tile.area.group === group);
                const mean = average(groupTiles);

                return (
                  <section className={styles.group} key={group}>
                    <header className={styles.groupHead}>
                      <h2>{group}</h2>

                      <span className={styles.muted}>
                        {groupTiles.length} {plural(groupTiles.length, "area", "areas")}
                        {Number.isFinite(mean) ? ` · average score ${num(mean)}` : ""}
                      </span>
                    </header>

                    <div className={styles.tiles}>{groupTiles.map((tile) => renderTile(tile, false))}</div>
                  </section>
                );
              })
            ) : (
              <div className={styles.tiles}>{ordered.map((tile) => renderTile(tile, true))}</div>
            )}
          </section>
        )}

        <p className={styles.note}>
          Scores come from the project health calculation: 75 and above is healthy, 55 to 74 is on watch, and below 55 is weak. Forecast,
          period control, recovery, governance, reporting, the inbox and the copilot are not part of that calculation, so they carry no
          score here. Open them to see their own figures.
        </p>
      </main>
    </div>
  );
}
