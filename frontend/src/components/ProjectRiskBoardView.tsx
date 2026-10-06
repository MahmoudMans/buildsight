"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectRiskControl } from "@/lib/api";
import type {
  ChangeEventStatus,
  DelayCause,
  IssueSeverity,
  ProjectIssue,
  ProjectRisk,
  RiskCategory,
  RiskControl,
  RiskExposureBand,
  RiskIntelligenceLevel,
} from "@/types/project";

import styles from "./ProjectRiskBoardView.module.css";

const DAY_MS = 86_400_000;
const LIST_LIMIT = 10;
const STALE_DECISION_DAYS = 30;

const LEVEL_LABEL: Record<RiskIntelligenceLevel, string> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const LEVEL_CLASS: Record<RiskIntelligenceLevel, string | undefined> = {
  NO_DATA: styles.riskNone,
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  COST: "Cost",
  SCHEDULE: "Schedule",
  TECHNICAL: "Technical",
  COMMERCIAL: "Commercial",
  PROCUREMENT: "Procurement",
  SAFETY: "Safety",
  QUALITY: "Quality",
  OTHER: "Other",
};

const BANDS: RiskExposureBand[] = ["LOW", "MODERATE", "HIGH", "CRITICAL"];

const BAND_LABEL: Record<RiskExposureBand, string> = {
  LOW: "Low",
  MODERATE: "Moderate",
  HIGH: "High",
  CRITICAL: "Critical",
};

const BAND_COLOR: Record<RiskExposureBand, string> = {
  LOW: "#9cc9b2",
  MODERATE: "#dcb85e",
  HIGH: "#d9823a",
  CRITICAL: "#b5493e",
};

const BAND_CLASS: Record<RiskExposureBand, string | undefined> = {
  LOW: styles.sevLow,
  MODERATE: styles.sevMedium,
  HIGH: styles.sevHigh,
  CRITICAL: styles.sevCritical,
};

const SEVERITY_CLASS: Record<IssueSeverity, string | undefined> = {
  LOW: styles.sevLow,
  MEDIUM: styles.sevMedium,
  HIGH: styles.sevHigh,
  CRITICAL: styles.sevCritical,
};

const SEVERITY_LABEL: Record<IssueSeverity, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const CAUSE_LABEL: Record<DelayCause, string> = {
  CLIENT: "Client",
  DESIGN: "Design",
  PROCUREMENT: "Procurement",
  SUBCONTRACTOR: "Subcontractor",
  WEATHER: "Weather",
  SITE_CONDITION: "Site conditions",
  REGULATORY: "Regulatory",
  OTHER: "Other",
};

const CHANGE_LABEL: Record<ChangeEventStatus, string> = {
  DRAFT: "Draft",
  UNDER_REVIEW: "Under review",
  APPROVED: "Approved",
  IMPLEMENTED: "Implemented",
  REJECTED: "Rejected",
};

const CHANGE_ORDER: ChangeEventStatus[] = ["DRAFT", "UNDER_REVIEW", "APPROVED", "IMPLEMENTED", "REJECTED"];

const CHANGE_COLOR: Record<ChangeEventStatus, string> = {
  DRAFT: "#c3c9c5",
  UNDER_REVIEW: "#dcb85e",
  APPROVED: "#6fa88c",
  IMPLEMENTED: "#2f6f55",
  REJECTED: "#d98a7f",
};

const DELAY_COLOR = {
  compensable: "#2f6f55",
  excusable: "#dcb85e",
  culpable: "#b5493e",
} as const;

const OUTLOOK = [
  { key: "overdue", label: "Overdue", test: (days: number) => days < 0 },
  { key: "14", label: "Next 14 days", test: (days: number) => days >= 0 && days <= 14 },
  { key: "30", label: "15 to 30 days", test: (days: number) => days >= 15 && days <= 30 },
  { key: "60", label: "31 to 60 days", test: (days: number) => days >= 31 && days <= 60 },
  { key: "later", label: "Later", test: (days: number) => days > 60 },
] as const;

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function startOfToday(): number {
  const now = new Date();

  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

function toDay(value: string | null): number {
  if (!value) {
    return NaN;
  }

  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS);
}

function formatDay(day: number): string {
  if (!Number.isFinite(day)) {
    return "—";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(day * DAY_MS));
}

function num(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function signed(value: number, digits = 0): string {
  if (Math.round(value * 10 ** digits) === 0) {
    return num(0, digits);
  }

  const text = num(Math.abs(value), digits);

  return value > 0 ? `+${text}` : `−${text}`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function signedMoney(value: number): string {
  if (Math.abs(value) < 1) {
    return money(0);
  }

  const text = money(Math.abs(value));

  return value > 0 ? `+${text}` : `−${text}`;
}

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function trunc(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export function ProjectRiskBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<RiskControl | null>(null);
  const [error, setError] = useState("");
  const [showAllRisks, setShowAllRisks] = useState(false);
  const [showAllIssues, setShowAllIssues] = useState(false);

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
            setError("Could not load risk data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const risks = data?.risks ?? [];
    const issues = data?.issues ?? [];
    const changes = data?.changes ?? [];
    const delays = data?.delays ?? [];

    const live = risks.filter((item) => item.status !== "CLOSED");
    const open = live.filter((item) => item.status === "OPEN" || item.status === "MITIGATING");

    const categoryMap = new Map<RiskCategory, { category: RiskCategory; count: number; inherent: number; residual: number }>();

    for (const risk of live) {
      const found = categoryMap.get(risk.category) ?? {
        category: risk.category,
        count: 0,
        inherent: 0,
        residual: 0,
      };

      found.count += 1;
      found.inherent += risk.inherentScore;
      found.residual += risk.residualScore;
      categoryMap.set(risk.category, found);
    }

    const categories = [...categoryMap.values()].sort((a, b) => b.inherent - a.inherent);
    const inherentTotal = categories.reduce((sum, row) => sum + row.inherent, 0);
    const residualTotal = categories.reduce((sum, row) => sum + row.residual, 0);

    const outlook = OUTLOOK.map((bucket) => {
      const items = open.filter((risk) => {
        const days = toDay(risk.mitigationDueDate) - today;

        return Number.isFinite(days) && bucket.test(days);
      });

      return {
        key: bucket.key,
        label: bucket.label,
        total: items.length,
        bands: BANDS.map((band) => ({
          band,
          count: items.filter((risk) => risk.exposureBand === band).length,
        })),
      };
    });

    const noDue = open.filter((risk) => !Number.isFinite(toDay(risk.mitigationDueDate))).length;

    const active = delays.filter((item) => item.status !== "RESOLVED");
    const causeMap = new Map<DelayCause, { cause: DelayCause; compensable: number; excusable: number; culpable: number }>();

    for (const delay of active) {
      const found = causeMap.get(delay.cause) ?? {
        cause: delay.cause,
        compensable: 0,
        excusable: 0,
        culpable: 0,
      };

      if (delay.excusable && delay.compensable) {
        found.compensable += delay.forecastDelayDays;
      } else if (delay.excusable) {
        found.excusable += delay.forecastDelayDays;
      } else {
        found.culpable += delay.forecastDelayDays;
      }

      causeMap.set(delay.cause, found);
    }

    const causes = [...causeMap.values()]
      .map((row) => ({ ...row, total: row.compensable + row.excusable + row.culpable }))
      .sort((a, b) => b.total - a.total);
    const delayTotal = causes.reduce((sum, row) => sum + row.total, 0);

    const changeRows = CHANGE_ORDER.map((status) => {
      const items = changes.filter((item) => item.status === status);

      return {
        status,
        count: items.length,
        cost: items.reduce((sum, item) => sum + item.costImpact, 0),
        days: items.reduce((sum, item) => sum + item.scheduleImpactDays, 0),
      };
    });
    const changeMax = Math.max(0, ...changeRows.map((row) => row.count));

    const waiting = changes
      .filter((item) => item.status === "UNDER_REVIEW" || item.status === "DRAFT")
      .map((item) => ({
        item,
        waited: Math.max(0, today - toDay(item.requestedDate)),
      }))
      .sort((a, b) => b.waited - a.waited);

    const openIssues = issues
      .filter((item) => item.status === "OPEN" || item.status === "IN_PROGRESS")
      .map((item) => ({ item, left: toDay(item.targetResolutionDate) - today }))
      .sort((a, b) => {
        const lateA = Number.isFinite(a.left) && a.left < 0 ? 0 : 1;
        const lateB = Number.isFinite(b.left) && b.left < 0 ? 0 : 1;

        return lateA - lateB || a.left - b.left;
      });

    const topRisks = [...open].sort((a, b) => b.residualScore - a.residualScore || b.inherentScore - a.inherentScore);

    return {
      categories,
      inherentTotal,
      residualTotal,
      categoryMax: Math.max(1, ...categories.map((row) => row.inherent)),
      outlook,
      outlookMax: Math.max(1, ...outlook.map((row) => row.total)),
      noDue,
      openCount: open.length,
      causes,
      delayTotal,
      delayMax: Math.max(1, ...causes.map((row) => row.total)),
      changeRows,
      changeMax,
      waiting,
      openIssues,
      topRisks,
    };
  }, [data, today]);

  const intel = data?.intelligence;
  const visibleRisks = showAllRisks ? model.topRisks : model.topRisks.slice(0, LIST_LIMIT);
  const visibleIssues = showAllIssues ? model.openIssues : model.openIssues.slice(0, LIST_LIMIT);
  const reduction = percent(model.inherentTotal - model.residualTotal, model.inherentTotal);
  const pending = model.changeRows.filter((row) => row.status === "DRAFT" || row.status === "UNDER_REVIEW");
  const pendingCost = pending.reduce((sum, row) => sum + row.cost, 0);
  const pendingDays = pending.reduce((sum, row) => sum + row.days, 0);

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">RISK BOARD</div>

            <h1>{data ? data.project.name : "Risk board"}</h1>

            <p className={styles.subtitle}>
              How much exposure the mitigations remove, when they fall due, what is driving delay,
              and which change events are waiting for a decision. Maintain the register in risk
              control.
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

        {!data && !error && <div className={styles.loading}>Loading risk data…</div>}

        {data && intel && (
          <>
            <section aria-label="Risk summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>RISK SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.riskScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, LEVEL_CLASS[intel.riskLevel])}>
                    {LEVEL_LABEL[intel.riskLevel]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN RISKS</div>
                <div className={styles.kpiValue}>{intel.openRisks}</div>
                <div className={styles.kpiSub}>
                  {intel.highExposureRisks} high exposure · {intel.totalRisks} in the register
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVERDUE MITIGATIONS</div>
                <div className={cx(styles.kpiValue, intel.overdueMitigations > 0 && styles.neg)}>
                  {intel.overdueMitigations}
                </div>
                <div className={styles.kpiSub}>of {model.openCount} open or mitigating</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN ISSUES</div>
                <div className={cx(styles.kpiValue, intel.criticalOpenIssues > 0 && styles.neg)}>
                  {intel.openIssues}
                </div>
                <div className={styles.kpiSub}>
                  {intel.criticalOpenIssues} critical · {intel.overdueIssues} overdue
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CHANGES WAITING</div>
                <div className={styles.kpiValue}>{intel.pendingChanges}</div>
                <div className={styles.kpiSub}>
                  {signedMoney(pendingCost)} · {signed(pendingDays)} d if all approved
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ACTIVE DELAYS</div>
                <div className={cx(styles.kpiValue, intel.forecastDelayDays > 0 && styles.neg)}>
                  {num(intel.forecastDelayDays)} d
                </div>
                <div className={styles.kpiSub}>{intel.activeDelays} delay {plural(intel.activeDelays, "event", "events")}</div>
              </article>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">MITIGATION</div>
                    <h2>Exposure before and after</h2>
                  </div>

                  <span className={styles.muted}>
                    {model.categories.length} {plural(model.categories.length, "category", "categories")}
                  </span>
                </header>

                {model.categories.length === 0 ? (
                  <div className={styles.emptySmall}>No live risks in the register.</div>
                ) : (
                  <>
                    <p className={styles.callout}>
                      Mitigation takes the total risk score from {num(model.inherentTotal)} to{" "}
                      {num(model.residualTotal)}, a {num(reduction)}% reduction.
                    </p>

                    <ul className={styles.ageing}>
                      {model.categories.map((row) => (
                        <li key={row.category}>
                          <div className={styles.ageingTop}>
                            <span>{CATEGORY_LABEL[row.category]}</span>
                            <strong>
                              {num(row.residual)} <small>from {num(row.inherent)} · {row.count} {plural(row.count, "risk", "risks")}</small>
                            </strong>
                          </div>

                          <div
                            aria-label={`${CATEGORY_LABEL[row.category]}: score ${num(row.inherent)} before mitigation, ${num(row.residual)} after`}
                            className={styles.track}
                            role="img"
                          >
                            <div
                              className={styles.pairOuter}
                              style={{ width: `${percent(row.inherent, model.categoryMax)}%` }}
                            >
                              <div
                                className={styles.pairInner}
                                style={{ width: `${percent(row.residual, row.inherent)}%` }}
                              />
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <ul aria-label="Mitigation legend" className={styles.legend}>
                      <li>
                        <i className={styles.swatch} style={{ background: "#b9d6c8" }} />
                        Before mitigation
                      </li>
                      <li>
                        <i className={styles.swatch} style={{ background: "#2f6f55" }} />
                        After mitigation
                      </li>
                    </ul>
                    <p className={styles.hint}>Scores are probability times impact, summed over live risks (not closed).</p>
                  </>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">DUE DATES</div>
                    <h2>When mitigations fall due</h2>
                  </div>

                  <span className={styles.muted}>{model.openCount} open or mitigating</span>
                </header>

                {model.openCount === 0 ? (
                  <div className={styles.emptySmall}>No open risks to mitigate.</div>
                ) : (
                  <>
                    <ul className={styles.ageing}>
                      {model.outlook.map((row) => (
                        <li key={row.key}>
                          <div className={styles.ageingTop}>
                            <span className={row.key === "overdue" && row.total > 0 ? styles.neg : undefined}>
                              {row.label}
                            </span>
                            <strong>{row.total}</strong>
                          </div>

                          <div
                            aria-label={`${row.total} mitigations due: ${row.label.toLowerCase()}`}
                            className={styles.stackTrack}
                            role="img"
                          >
                            <div className={styles.stack} style={{ width: `${percent(row.total, model.outlookMax)}%` }}>
                              {row.bands
                                .filter((entry) => entry.count > 0)
                                .map((entry) => (
                                  <i
                                    key={entry.band}
                                    style={{ background: BAND_COLOR[entry.band], flexGrow: entry.count }}
                                    title={`${entry.count} ${BAND_LABEL[entry.band].toLowerCase()}`}
                                  />
                                ))}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <ul aria-label="Exposure legend" className={styles.legend}>
                      {BANDS.map((band) => (
                        <li key={band}>
                          <i className={styles.swatch} style={{ background: BAND_COLOR[band] }} />
                          {BAND_LABEL[band]}
                        </li>
                      ))}
                    </ul>

                    {model.noDue > 0 && (
                      <p className={styles.hint}>
                        {model.noDue} open {plural(model.noDue, "risk has", "risks have")} no mitigation due date.
                      </p>
                    )}
                  </>
                )}
              </section>
            </div>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">DELAY CAUSES</div>
                    <h2>What is driving the delay</h2>
                  </div>

                  <span className={styles.muted}>{num(model.delayTotal)} d active</span>
                </header>

                {model.causes.length === 0 ? (
                  <div className={styles.emptySmall}>No active delay events.</div>
                ) : (
                  <>
                    <ul className={styles.ageing}>
                      {model.causes.map((row) => (
                        <li key={row.cause}>
                          <div className={styles.ageingTop}>
                            <span>{CAUSE_LABEL[row.cause]}</span>
                            <strong>{num(row.total)} d</strong>
                          </div>

                          <div
                            aria-label={`${CAUSE_LABEL[row.cause]}: ${num(row.total)} days, ${num(row.compensable)} compensable, ${num(row.excusable)} excusable only, ${num(row.culpable)} not excusable`}
                            className={styles.stackTrack}
                            role="img"
                          >
                            <div className={styles.stack} style={{ width: `${percent(row.total, model.delayMax)}%` }}>
                              {row.compensable > 0 && (
                                <i
                                  style={{ background: DELAY_COLOR.compensable, flexGrow: row.compensable }}
                                  title={`${num(row.compensable)} d excusable and compensable`}
                                />
                              )}
                              {row.excusable > 0 && (
                                <i
                                  style={{ background: DELAY_COLOR.excusable, flexGrow: row.excusable }}
                                  title={`${num(row.excusable)} d excusable only`}
                                />
                              )}
                              {row.culpable > 0 && (
                                <i
                                  style={{ background: DELAY_COLOR.culpable, flexGrow: row.culpable }}
                                  title={`${num(row.culpable)} d not excusable`}
                                />
                              )}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>

                    <ul aria-label="Delay legend" className={styles.legend}>
                      <li>
                        <i className={styles.swatch} style={{ background: DELAY_COLOR.compensable }} />
                        Excusable and compensable
                      </li>
                      <li>
                        <i className={styles.swatch} style={{ background: DELAY_COLOR.excusable }} />
                        Excusable only
                      </li>
                      <li>
                        <i className={styles.swatch} style={{ background: DELAY_COLOR.culpable }} />
                        Not excusable
                      </li>
                    </ul>
                    <p className={styles.hint}>
                      Days are the forecast delay on events that are not yet resolved, split by the
                      excusable and compensable flags recorded on each event.
                    </p>
                  </>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">CHANGE EVENTS</div>
                    <h2>Where changes stand</h2>
                  </div>

                  <span className={styles.muted}>
                    {model.changeRows.reduce((sum, row) => sum + row.count, 0)} in total
                  </span>
                </header>

                {model.changeMax === 0 ? (
                  <div className={styles.emptySmall}>No change events recorded.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.changeRows.map((row) => (
                      <li key={row.status}>
                        <div className={styles.ageingTop}>
                          <span>{CHANGE_LABEL[row.status]}</span>
                          <strong>
                            {row.count}
                            <small>
                              {signedMoney(row.cost)} · {signed(row.days)} d
                            </small>
                          </strong>
                        </div>

                        <div
                          aria-label={`${row.count} change events ${CHANGE_LABEL[row.status].toLowerCase()}`}
                          className={styles.track}
                          role="img"
                        >
                          <div
                            className={styles.fill}
                            style={{
                              background: CHANGE_COLOR[row.status],
                              width: `${percent(row.count, model.changeMax)}%`,
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">AWAITING A DECISION</div>
                  <h2>Changes not yet approved or rejected</h2>
                </div>

                <span className={styles.muted}>
                  {model.waiting.length} {plural(model.waiting.length, "change", "changes")}
                </span>
              </header>

              {model.waiting.length === 0 ? (
                <div className={styles.emptySmall}>Every change event has been decided.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>CHANGE</th>
                        <th>ORIGINATOR</th>
                        <th>STATUS</th>
                        <th>REQUESTED</th>
                        <th className={styles.num}>WAITING</th>
                        <th className={styles.num}>COST</th>
                        <th className={styles.num}>DAYS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {model.waiting.slice(0, LIST_LIMIT).map(({ item, waited }) => (
                        <tr key={item.id}>
                          <td className={styles.wrap}>
                            <strong>{item.reference}</strong>
                            <span className={styles.cellSub}>{item.title}</span>
                          </td>
                          <td>{item.originator ?? "—"}</td>
                          <td>{CHANGE_LABEL[item.status]}</td>
                          <td>{formatDay(toDay(item.requestedDate))}</td>
                          <td className={cx(styles.num, waited > STALE_DECISION_DAYS && styles.neg)}>
                            {waited} d
                          </td>
                          <td className={styles.num}>{signedMoney(item.costImpact)}</td>
                          <td className={styles.num}>{signed(item.scheduleImpactDays)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">TOP RISKS</div>
                  <h2>Highest residual exposure first</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>{model.topRisks.length} open or mitigating</span>

                  {model.topRisks.length > LIST_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllRisks((value) => !value)}
                      type="button"
                    >
                      {showAllRisks ? `Show first ${LIST_LIMIT}` : `Show all ${model.topRisks.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.topRisks.length === 0 ? (
                <div className={styles.emptySmall}>No open risks.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>RISK</th>
                        <th>CATEGORY</th>
                        <th>OWNER</th>
                        <th className={styles.num}>BEFORE</th>
                        <th className={styles.num}>AFTER</th>
                        <th>EXPOSURE</th>
                        <th>MITIGATION DUE</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleRisks.map((risk: ProjectRisk) => {
                        const left = toDay(risk.mitigationDueDate) - today;

                        return (
                          <tr key={risk.id}>
                            <td className={styles.wrap}>
                              <strong>{risk.reference}</strong>
                              <span className={styles.cellSub}>{trunc(risk.title, 70)}</span>
                            </td>
                            <td>{CATEGORY_LABEL[risk.category]}</td>
                            <td>{risk.ownerName ?? "Unassigned"}</td>
                            <td className={styles.num}>{risk.inherentScore}</td>
                            <td className={styles.num}>
                              <strong>{risk.residualScore}</strong>
                            </td>
                            <td>
                              <span className={cx(styles.sev, BAND_CLASS[risk.exposureBand])}>
                                {BAND_LABEL[risk.exposureBand]}
                              </span>
                            </td>
                            <td className={Number.isFinite(left) && left < 0 ? styles.neg : undefined}>
                              {formatDay(toDay(risk.mitigationDueDate))}
                              {Number.isFinite(left) && left < 0 && (
                                <span className={styles.cellSub}>{-left} d late</span>
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

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">ISSUES</div>
                  <h2>Open issues, overdue first</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>{model.openIssues.length} open</span>

                  {model.openIssues.length > LIST_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllIssues((value) => !value)}
                      type="button"
                    >
                      {showAllIssues ? `Show first ${LIST_LIMIT}` : `Show all ${model.openIssues.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.openIssues.length === 0 ? (
                <div className={styles.emptySmall}>No open issues.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ISSUE</th>
                        <th>SEVERITY</th>
                        <th>OWNER</th>
                        <th>FROM RISK</th>
                        <th>TARGET</th>
                        <th className={styles.num}>LEFT</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleIssues.map(({ item, left }: { item: ProjectIssue; left: number }) => (
                        <tr key={item.id}>
                          <td className={styles.wrap}>
                            <strong>{item.reference}</strong>
                            <span className={styles.cellSub}>{trunc(item.title, 70)}</span>
                          </td>
                          <td>
                            <span className={cx(styles.sev, SEVERITY_CLASS[item.severity])}>
                              {SEVERITY_LABEL[item.severity]}
                            </span>
                          </td>
                          <td>{item.ownerName ?? "Unassigned"}</td>
                          <td>{item.sourceRiskReference ?? "—"}</td>
                          <td>{formatDay(toDay(item.targetResolutionDate))}</td>
                          <td className={cx(styles.num, Number.isFinite(left) && left < 0 && styles.neg)}>
                            {Number.isFinite(left) ? (left < 0 ? `${-left} d late` : `${left} d`) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className={styles.note}>{intel.explanation}</p>
          </>
        )}
      </main>
    </div>
  );
}

