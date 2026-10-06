"use client";

import Link from "next/link";
import { plainCodes } from "@/lib/labels";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  getProjectCommandCenter,
  getProjectCommercial,
  getProjectCostControl,
  getProjectForecast,
  getProjectGovernance,
  getProjectQuality,
  getProjectRiskControl,
  getProjectSafety,
  getProjectSchedule,
} from "@/lib/api";
import type {
  CommercialControl,
  CostControl,
  ForecastControl,
  GovernanceControl,
  MilestoneStatus,
  ProjectCommandCenter,
  ProjectHealthBand,
  ProjectHealthScore,
  ProjectStatus,
  QualityControl,
  RiskControl,
  SafetyControl,
  ScheduleControl,
} from "@/types/project";

import styles from "./ProjectStatusReportView.module.css";

const DAY_MS = 86_400_000;

interface Bundle {
  center: ProjectCommandCenter;
  cost: CostControl | null;
  schedule: ScheduleControl | null;
  forecast: ForecastControl | null;
  risk: RiskControl | null;
  safety: SafetyControl | null;
  quality: QualityControl | null;
  commercial: CommercialControl | null;
  governance: GovernanceControl | null;
  missing: string[];
}

interface MetricGroup {
  title: string;
  rows: Array<[string, string]> | null;
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const BAND_LABEL: Record<ProjectHealthBand, string> = {
  HEALTHY: "Healthy",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const BAND_CLASS: Record<ProjectHealthBand, string> = {
  HEALTHY: styles.bandHealthy,
  WATCH: styles.bandWatch,
  AT_RISK: styles.bandRisk,
};

const MILESTONE_LABEL: Record<MilestoneStatus, string> = {
  PLANNED: "Planned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  BLOCKED: "Blocked",
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

function longDate(value: string | Date | null): string {
  if (!value) {
    return "—";
  }

  const date =
    typeof value === "string"
      ? new Date(value.length === 10 ? `${value}T00:00:00` : value)
      : value;

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function shortDate(value: string | null): string {
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

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function humanize(value: string): string {
  const text = value.replace(/_/g, " ").toLowerCase();

  return text.charAt(0).toUpperCase() + text.slice(1);
}

function riskLabel(value: string | null): string {
  switch (value) {
    case null:
      return "";
    case "ON_TRACK":
      return "On track";
    case "WATCH":
      return "Watch";
    case "AT_RISK":
      return "At risk";
    default:
      return "No data";
  }
}

function riskClass(value: string | null): string {
  switch (value) {
    case "ON_TRACK":
      return styles.fillGood;
    case "WATCH":
      return styles.fillWatch;
    case "AT_RISK":
      return styles.fillBad;
    default:
      return styles.fillNone;
  }
}

function pick<T>(
  label: string,
  result: PromiseSettledResult<T>,
  missing: string[],
): T | null {
  if (result.status === "fulfilled") {
    return result.value;
  }

  missing.push(label);

  return null;
}

function domainScores(
  health: ProjectHealthScore,
): Array<{ label: string; score: number; risk: string | null }> {
  return [
    { label: "Schedule", score: health.scheduleScore, risk: health.scheduleRisk },
    { label: "Progress", score: health.progressScore, risk: null },
    { label: "Milestones", score: health.milestoneScore, risk: null },
    { label: "Cost", score: health.costScore, risk: health.costRisk },
    {
      label: "Procurement",
      score: health.procurementScore,
      risk: health.procurementRisk,
    },
    { label: "Risk", score: health.riskScore, risk: health.riskLevel },
    {
      label: "Production",
      score: health.productionScore,
      risk: health.productionRisk,
    },
    {
      label: "Information",
      score: health.informationScore,
      risk: health.informationRisk,
    },
    { label: "Quality", score: health.qualityScore, risk: health.qualityRisk },
    { label: "Safety", score: health.safetyScore, risk: health.safetyRisk },
    {
      label: "Commercial",
      score: health.commercialScore,
      risk: health.commercialRisk,
    },
    { label: "Resources", score: health.resourceScore, risk: health.resourceRisk },
  ];
}

function buildNarrative(bundle: Bundle): string[] {
  const { project, health } = bundle.center;
  const paragraphs: string[] = [];

  const actual = Number(health.actualProgressPercentage);
  const expected = Number(health.expectedProgressPercentage);
  const gap = actual - expected;

  paragraphs.push(
    `${project.name} (${project.code}) is ${STATUS_LABEL[
      project.status
    ].toLowerCase()} for ${project.clientName} in ${
      project.location
    }. Physical progress is ${actual.toFixed(1)}% against ${expected.toFixed(
      1,
    )}% expected, ${
      gap >= 0
        ? `${gap.toFixed(1)} points ahead of`
        : `${Math.abs(gap).toFixed(1)} points behind`
    } plan. The overall health score is ${Math.round(
      health.score,
    )} out of 100, rated ${BAND_LABEL[health.healthBand].toLowerCase()}.`,
  );

  const forecastFinish =
    bundle.schedule?.intelligence.cpmForecastFinishDate ??
    project.forecastEndDate;

  const delta = dayNumber(forecastFinish) - dayNumber(project.plannedEndDate);

  if (Number.isFinite(delta)) {
    const finishText =
      delta > 0
        ? `${delta} days later than the planned finish`
        : delta < 0
          ? `${Math.abs(delta)} days ahead of the planned finish`
          : "in line with the planned finish";

    const watch: string[] = [];

    if (health.overdueMilestones > 0) {
      watch.push(
        `${health.overdueMilestones} overdue milestone${
          health.overdueMilestones === 1 ? "" : "s"
        }`,
      );
    }

    if (health.blockedMilestones > 0) {
      watch.push(
        `${health.blockedMilestones} blocked milestone${
          health.blockedMilestones === 1 ? "" : "s"
        }`,
      );
    }

    if (bundle.schedule && bundle.schedule.intelligence.overdueActivities > 0) {
      watch.push(
        `${bundle.schedule.intelligence.overdueActivities} overdue schedule activities`,
      );
    }

    paragraphs.push(
      `The forecast finish is ${longDate(forecastFinish)}, ${finishText} (${longDate(
        project.plannedEndDate,
      )}).${watch.length > 0 ? ` Watch-points: ${watch.join(", ")}.` : ""}`,
    );
  }

  if (bundle.cost) {
    const intel = bundle.cost.intelligence;
    const revised = Number(intel.revisedCostPlan);
    const forecast = Number(intel.forecastAtCompletion);
    const overrun = forecast - revised;

    paragraphs.push(
      `Forecast cost at completion is ${money(forecast)} against a revised cost plan of ${money(
        revised,
      )}, ${
        overrun > 0
          ? `an overrun of ${money(overrun)}`
          : overrun < 0
            ? `${money(Math.abs(overrun))} inside the plan`
            : "exactly on plan"
      }. Costs incurred to date are ${money(
        Number(intel.actualCosts),
      )}, with ${money(Number(intel.totalApprovedCommitments))} of approved commitments.`,
    );
  }

  const exposure: string[] = [];

  if (bundle.risk) {
    const intel = bundle.risk.intelligence;

    exposure.push(
      `${intel.openRisks} open risk${intel.openRisks === 1 ? "" : "s"} (${
        intel.highExposureRisks
      } high exposure) and ${intel.criticalOpenIssues} critical open issue${
        intel.criticalOpenIssues === 1 ? "" : "s"
      }`,
    );
  }

  if (bundle.safety) {
    const intel = bundle.safety.intelligence;
    const days = intel.daysSinceLastRecordableIncident;

    exposure.push(
      `${intel.openIncidents} open safety incident${
        intel.openIncidents === 1 ? "" : "s"
      }${
        days === null
          ? ", with no recordable incident on file"
          : `, ${days} days since the last recordable incident`
      }`,
    );
  }

  if (exposure.length > 0) {
    paragraphs.push(`Delivery exposure: ${exposure.join("; ")}.`);
  }

  if (bundle.missing.length > 0) {
    paragraphs.push(
      `Some data could not be loaded and is omitted from this report: ${bundle.missing.join(
        ", ",
      )}.`,
    );
  }

  return paragraphs;
}

function buildGroups(bundle: Bundle): MetricGroup[] {
  const { project } = bundle.center;
  const groups: MetricGroup[] = [];

  const s = bundle.schedule?.intelligence;

  groups.push({
    title: "Schedule",
    rows: s
      ? [
          [
            "Schedule score",
            `${Math.round(s.scheduleScore)} · ${riskLabel(s.scheduleRisk)}`,
          ],
          [
            "Forecast finish",
            shortDate(s.cpmForecastFinishDate ?? project.forecastEndDate),
          ],
          ["Critical path", `${s.criticalPathLengthDays} days`],
          ["Overdue activities", String(s.overdueActivities)],
          ["Open constraints", String(s.openConstraints)],
        ]
      : null,
  });

  const c = bundle.cost?.intelligence;

  groups.push({
    title: "Cost",
    rows: c
      ? [
          ["Revised cost plan", money(Number(c.revisedCostPlan))],
          ["Forecast at completion", money(Number(c.forecastAtCompletion))],
          [
            "Forecast vs plan",
            (() => {
              const gap =
                Number(c.forecastAtCompletion) - Number(c.revisedCostPlan);

              return gap === 0
                ? "On plan"
                : `${gap > 0 ? "+" : "−"}${money(Math.abs(gap))}${
                    gap > 0 ? " over" : " under"
                  }`;
            })(),
          ],
          ["Actual costs", money(Number(c.actualCosts))],
          ["Approved commitments", money(Number(c.totalApprovedCommitments))],
        ]
      : null,
  });

  const f = bundle.forecast?.intelligence;

  groups.push({
    title: "Forecast",
    rows: f
      ? [
          ["Cost index (CPI)", Number(f.cpi).toFixed(2)],
          ["Schedule index (SPI)", Number(f.spi).toFixed(2)],
          [
            "Predictive score",
            `${Math.round(f.predictiveScore)} · ${riskLabel(f.predictiveRisk)}`,
          ],
          ["Trend", humanize(f.trend)],
          ["Forecast finish", shortDate(f.expectedForecastFinishDate)],
        ]
      : null,
  });

  const r = bundle.risk?.intelligence;

  groups.push({
    title: "Risk and issues",
    rows: r
      ? [
          ["Open risks", String(r.openRisks)],
          ["High-exposure risks", String(r.highExposureRisks)],
          ["Overdue mitigations", String(r.overdueMitigations)],
          ["Critical open issues", String(r.criticalOpenIssues)],
          ["Forecast delay", `${r.forecastDelayDays} days`],
        ]
      : null,
  });

  const sa = bundle.safety?.intelligence;

  groups.push({
    title: "Safety",
    rows: sa
      ? [
          ["Open incidents", String(sa.openIncidents)],
          ["Recordable incidents", String(sa.recordableIncidents)],
          [
            "Days since recordable",
            sa.daysSinceLastRecordableIncident === null
              ? "—"
              : String(sa.daysSinceLastRecordableIncident),
          ],
          ["Overdue actions", String(sa.overdueActions)],
          ["Expired permits", String(sa.expiredPermits)],
        ]
      : null,
  });

  const q = bundle.quality?.intelligence;

  groups.push({
    title: "Quality",
    rows: q
      ? [
          [
            "Inspection pass rate",
            `${Number(q.inspectionPassRatePercentage).toFixed(0)}%`,
          ],
          ["Open NCRs", String(q.openNcrs)],
          ["Overdue NCRs", String(q.overdueNcrs)],
          ["Open punch items", String(q.openPunchItems)],
          [
            "Handover readiness",
            `${Number(q.handoverReadinessPercentage).toFixed(0)}%`,
          ],
        ]
      : null,
  });

  const co = bundle.commercial?.intelligence;

  groups.push({
    title: "Commercial",
    rows: co
      ? [
          ["Certified value", money(Number(co.certifiedValue))],
          ["Paid to date", money(Number(co.amountPaid))],
          ["Outstanding certified", money(Number(co.outstandingCertifiedAmount))],
          ["Overdue payments", String(co.overduePayments)],
          ["Pending change orders", String(co.pendingChangeOrders)],
        ]
      : null,
  });

  const g = bundle.governance?.intelligence;

  groups.push({
    title: "Governance",
    rows: g
      ? [
          [
            "Governance score",
            `${Math.round(g.governanceScore)} · ${riskLabel(g.governanceRisk)}`,
          ],
          ["Open actions", String(g.openActions)],
          ["Overdue actions", String(g.overdueActions)],
          ["Pending decisions", String(g.pendingDecisions)],
          ["Meetings without minutes", String(g.meetingsWithoutMinutes)],
        ]
      : null,
  });

  return groups;
}

export function ProjectStatusReportView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [error, setError] = useState("");
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      Promise.allSettled([
        getProjectCommandCenter(projectId),
        getProjectCostControl(projectId),
        getProjectSchedule(projectId),
        getProjectForecast(projectId),
        getProjectRiskControl(projectId),
        getProjectSafety(projectId),
        getProjectQuality(projectId),
        getProjectCommercial(projectId),
        getProjectGovernance(projectId),
      ]).then(
        ([
          center,
          cost,
          schedule,
          forecast,
          risk,
          safety,
          quality,
          commercial,
          governance,
        ]) => {
          if (cancelled) {
            return;
          }

          if (center.status !== "fulfilled") {
            setError(
              "Could not load the project. Check that the backend is running.",
            );

            return;
          }

          const missing: string[] = [];

          setBundle({
            center: center.value,
            cost: pick("cost", cost, missing),
            schedule: pick("schedule", schedule, missing),
            forecast: pick("forecast", forecast, missing),
            risk: pick("risk", risk, missing),
            safety: pick("safety", safety, missing),
            quality: pick("quality", quality, missing),
            commercial: pick("commercial", commercial, missing),
            governance: pick("governance", governance, missing),
            missing,
          });

          setGeneratedAt(new Date());
        },
      );
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const today = startOfToday();

  const project = bundle?.center.project;
  const health = bundle?.center.health;

  const milestones = bundle
    ? [...bundle.center.milestones].sort(
        (a, b) =>
          a.sortOrder - b.sortOrder || a.plannedDate.localeCompare(b.plannedDate),
      )
    : [];

  const topRisks = bundle?.risk
    ? bundle.risk.risks
        .filter((risk) => risk.status === "OPEN" || risk.status === "MITIGATING")
        .sort((a, b) => Number(b.residualScore) - Number(a.residualScore))
        .slice(0, 5)
    : [];

  const criticalIssues = bundle?.risk
    ? bundle.risk.issues
        .filter(
          (issue) =>
            (issue.status === "OPEN" || issue.status === "IN_PROGRESS") &&
            (issue.severity === "CRITICAL" || issue.severity === "HIGH"),
        )
        .slice(0, 5)
    : [];

  const attention =
    bundle?.governance?.executiveReport.attentionItems.slice(0, 8) ?? [];

  const updates = bundle
    ? [...bundle.center.progressUpdates]
        .sort((a, b) => b.updateDate.localeCompare(a.updateDate))
        .slice(0, 5)
    : [];

  const forecastFinish = bundle
    ? (bundle.schedule?.intelligence.cpmForecastFinishDate ??
      bundle.center.project.forecastEndDate)
    : null;

  const finishDelta =
    forecastFinish && project
      ? dayNumber(forecastFinish) - dayNumber(project.plannedEndDate)
      : null;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <div className={styles.actions}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">STATUS REPORT</div>
            <h1>Project status report</h1>
          </div>

          {bundle && (
            <button
              className="primary-button"
              onClick={() => window.print()}
              type="button"
            >
              Print / Save as PDF
            </button>
          )}
        </div>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!bundle && !error && (
          <div className={styles.loading}>Preparing report…</div>
        )}

        {bundle && project && health && (
          <article className={styles.sheet}>
            <header className={styles.reportHead}>
              <div className={styles.brand}>
                <div className={styles.mark}>B</div>

                <div>
                  <strong>BuildSight</strong>
                  <span>Construction Intelligence</span>
                </div>
              </div>

              <div className={styles.meta}>
                <strong>Project status report</strong>
                <span>Data as of {longDate(health.calculationDate)}</span>
                {generatedAt && <span>Generated {longDate(generatedAt)}</span>}
              </div>
            </header>

            <section className={styles.titleBlock}>
              <h2>{project.name}</h2>

              <p>
                {project.code} · {project.clientName} · {project.location} ·{" "}
                {STATUS_LABEL[project.status]}
              </p>
            </section>

            <section className={styles.kpis}>
              <div className={`${styles.kpi} ${styles.kpiDark}`}>
                <span>HEALTH SCORE</span>
                <strong>{Math.round(health.score)}</strong>
                <small>{BAND_LABEL[health.healthBand]}</small>
              </div>

              <div className={styles.kpi}>
                <span>PHYSICAL PROGRESS</span>
                <strong>
                  {Number(health.actualProgressPercentage).toFixed(1)}%
                </strong>
                <small>
                  Expected {Number(health.expectedProgressPercentage).toFixed(1)}%
                </small>
              </div>

              <div className={styles.kpi}>
                <span>FORECAST FINISH</span>
                <strong>{shortDate(forecastFinish)}</strong>
                <small
                  className={
                    finishDelta !== null && finishDelta > 0
                      ? styles.neg
                      : finishDelta !== null && finishDelta < 0
                        ? styles.pos
                        : ""
                  }
                >
                  {finishDelta === null || !Number.isFinite(finishDelta)
                    ? `Planned ${shortDate(project.plannedEndDate)}`
                    : finishDelta === 0
                      ? "On the planned date"
                      : finishDelta > 0
                        ? `${finishDelta} d late vs plan`
                        : `${Math.abs(finishDelta)} d ahead of plan`}
                </small>
              </div>

              <div className={styles.kpi}>
                <span>FORECAST COST</span>
                <strong>
                  {bundle.cost
                    ? money(Number(bundle.cost.intelligence.forecastAtCompletion))
                    : "—"}
                </strong>
                <small>
                  {bundle.cost
                    ? `Plan ${money(Number(bundle.cost.intelligence.revisedCostPlan))}`
                    : "Cost data unavailable"}
                </small>
              </div>
            </section>

            <section className={styles.section}>
              <h3>Executive summary</h3>

              {buildNarrative(bundle).map((paragraph) => (
                <p className={styles.paragraph} key={paragraph}>
                  {paragraph}
                </p>
              ))}

              {bundle.governance &&
                bundle.governance.executiveReport.executiveSummary && (
                  <blockquote className={styles.quote}>
                    <span>FROM THE GOVERNANCE REPORT</span>
                    {plainCodes(bundle.governance.executiveReport.executiveSummary)}
                  </blockquote>
                )}
            </section>

            <section className={styles.section}>
              <h3>Control scorecard</h3>
              <p className={styles.caption}>
                Score per control area (0–100). Bar colour reflects the risk
                level where one is reported.
              </p>

              <div className={styles.bars}>
                {domainScores(health).map((item) => (
                  <div className={styles.barRow} key={item.label}>
                    <span>{item.label}</span>

                    <div className={styles.track}>
                      <div
                        className={`${styles.fill} ${
                          item.risk ? riskClass(item.risk) : styles.fillBase
                        }`}
                        style={{
                          width: `${Math.min(100, Math.max(0, item.score))}%`,
                        }}
                      />
                    </div>

                    <strong>{Math.round(item.score)}</strong>
                    <em>{riskLabel(item.risk)}</em>
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h3>Delivery indicators</h3>

              <div className={styles.groups}>
                {buildGroups(bundle).map((group) => (
                  <div className={styles.group} key={group.title}>
                    <h4>{group.title}</h4>

                    {group.rows === null ? (
                      <p className={styles.unavailable}>Data unavailable</p>
                    ) : (
                      <dl>
                        {group.rows.map(([label, value]) => (
                          <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section className={styles.section}>
              <h3>Milestones</h3>

              {milestones.length === 0 ? (
                <p className={styles.caption}>No milestones defined.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>MILESTONE</th>
                        <th>PLANNED</th>
                        <th>FORECAST</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {milestones.map((milestone) => {
                        const overdue =
                          milestone.status !== "COMPLETED" &&
                          dayNumber(milestone.forecastDate) < today;

                        return (
                          <tr key={milestone.id}>
                            <td>
                              <strong>{milestone.name}</strong>
                            </td>
                            <td>{shortDate(milestone.plannedDate)}</td>
                            <td>{shortDate(milestone.forecastDate)}</td>
                            <td>
                              {MILESTONE_LABEL[milestone.status]}
                              {overdue && (
                                <em className={styles.late}>OVERDUE</em>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {(topRisks.length > 0 || criticalIssues.length > 0) && (
              <section className={styles.section}>
                <h3>Top risks and issues</h3>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>TYPE</th>
                        <th>ITEM</th>
                        <th>OWNER</th>
                        <th>MEASURE</th>
                      </tr>
                    </thead>

                    <tbody>
                      {topRisks.map((risk) => (
                        <tr key={risk.id}>
                          <td>Risk</td>
                          <td>
                            <strong>
                              {risk.reference} · {risk.title}
                            </strong>
                            <small>{humanize(risk.category)}</small>
                          </td>
                          <td>{risk.ownerName || "—"}</td>
                          <td>
                            Residual {Math.round(Number(risk.residualScore))}
                            <small>{humanize(risk.exposureBand)} exposure</small>
                          </td>
                        </tr>
                      ))}

                      {criticalIssues.map((issue) => (
                        <tr key={issue.id}>
                          <td>Issue</td>
                          <td>
                            <strong>
                              {issue.reference} · {issue.title}
                            </strong>
                            <small>{humanize(issue.status)}</small>
                          </td>
                          <td>{issue.ownerName || "—"}</td>
                          <td>
                            {humanize(issue.severity)}
                            <small>
                              Target {shortDate(issue.targetResolutionDate)}
                            </small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {attention.length > 0 && (
              <section className={styles.section}>
                <h3>Items needing attention</h3>

                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>SEVERITY</th>
                        <th>ITEM</th>
                        <th>OWNER</th>
                        <th>DUE</th>
                      </tr>
                    </thead>

                    <tbody>
                      {attention.map((item) => (
                        <tr key={`${item.type}-${item.reference}`}>
                          <td>{humanize(item.severity)}</td>
                          <td>
                            <strong>
                              {item.reference} · {item.title}
                            </strong>
                            <small>{item.detail}</small>
                          </td>
                          <td>{item.owner || "—"}</td>
                          <td>{shortDate(item.dueDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {updates.length > 0 && (
              <section className={styles.section}>
                <h3>Recent progress updates</h3>

                <ul className={styles.updates}>
                  {updates.map((update) => (
                    <li key={update.id}>
                      <strong>
                        {Number(update.progressPercentage).toFixed(1)}%
                      </strong>

                      <div>
                        <span>{shortDate(update.updateDate)}</span>
                        <p>{update.note || "No note recorded."}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <footer className={styles.footer}>
              Generated by BuildSight · figures reflect the project state on{" "}
              {longDate(health.calculationDate)}.
            </footer>
          </article>
        )}
      </main>
    </div>
  );
}
