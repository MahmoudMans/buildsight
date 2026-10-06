"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectGovernance } from "@/lib/api";
import type {
  GovernanceAction,
  GovernanceActionPriority,
  GovernanceControl,
  GovernanceDecisionImpactArea,
  GovernanceDecisionStatus,
  GovernanceMeeting,
  GovernanceMeetingType,
  GovernanceRiskLevel,
} from "@/types/project";

import styles from "./ProjectGovernanceBoardView.module.css";

const DAY_MS = 86_400_000;
const LIST_LIMIT = 10;
const OWNER_LIMIT = 8;
const MEETING_LIMIT = 10;

const RISK_LABEL: Record<GovernanceRiskLevel, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<GovernanceRiskLevel, string | undefined> = {
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const PRIORITIES: ReadonlyArray<GovernanceActionPriority> = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const PRIORITY_LABEL: Record<GovernanceActionPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
};

const PRIORITY_COLOR: Record<GovernanceActionPriority, string> = {
  LOW: "#a9c1b8",
  MEDIUM: "#dcb85e",
  HIGH: "#d9823a",
  CRITICAL: "#b5493e",
};

const PRIORITY_CLASS: Record<GovernanceActionPriority, string | undefined> = {
  LOW: styles.sevLow,
  MEDIUM: styles.sevMedium,
  HIGH: styles.sevHigh,
  CRITICAL: styles.sevCritical,
};

const PRIORITY_RANK: Record<GovernanceActionPriority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

const ACTION_STATUS_LABEL: Record<GovernanceAction["status"], string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
  VOID: "Void",
};

const OUTLOOK: ReadonlyArray<{ label: string; max: number }> = [
  { label: "Overdue", max: -1 },
  { label: "Due in the next 7 days", max: 6 },
  { label: "Due in 8 to 14 days", max: 13 },
  { label: "Due in 15 to 21 days", max: 20 },
  { label: "Due in 22 to 28 days", max: 27 },
  { label: "Due later", max: Number.POSITIVE_INFINITY },
];

const IMPACT_ORDER: ReadonlyArray<GovernanceDecisionImpactArea> = [
  "SCHEDULE",
  "COST",
  "TECHNICAL",
  "PROCUREMENT",
  "COMMERCIAL",
  "RESOURCE",
  "QUALITY",
  "HSE",
  "OTHER",
];

const IMPACT_LABEL: Record<GovernanceDecisionImpactArea, string> = {
  SCHEDULE: "Schedule",
  COST: "Cost",
  QUALITY: "Quality",
  HSE: "HSE",
  COMMERCIAL: "Commercial",
  TECHNICAL: "Technical",
  PROCUREMENT: "Procurement",
  RESOURCE: "Resources",
  OTHER: "Other",
};

const DECISION_STATUSES: ReadonlyArray<{
  key: GovernanceDecisionStatus;
  label: string;
  color: string;
}> = [
  { key: "PROPOSED", label: "Proposed", color: "#dcb85e" },
  { key: "APPROVED", label: "Approved", color: "#7ab397" },
  { key: "IMPLEMENTED", label: "Implemented", color: "#2f6f55" },
  { key: "REJECTED", label: "Rejected", color: "#b5493e" },
  { key: "SUPERSEDED", label: "Superseded", color: "#c3c9c5" },
];

const MEETING_TYPE_LABEL: Record<GovernanceMeetingType, string> = {
  PROGRESS: "Progress",
  COORDINATION: "Coordination",
  DESIGN: "Design",
  COMMERCIAL: "Commercial",
  HSE: "HSE",
  QUALITY: "Quality",
  EXECUTIVE: "Executive",
  OTHER: "Other",
};

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

function percent(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}

interface ActionRow {
  action: GovernanceAction;
  dueDay: number;
  daysToDue: number;
  lateDays: number;
}

interface OwnerRow {
  name: string;
  total: number;
  overdue: number;
  blocked: number;
  byPriority: Record<GovernanceActionPriority, number>;
}

interface MeetingRow {
  meeting: GovernanceMeeting;
  day: number;
  flag: string;
  upcoming: boolean;
}

export function ProjectGovernanceBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<GovernanceControl | null>(null);
  const [error, setError] = useState("");
  const [showAllActions, setShowAllActions] = useState(false);
  const [showAllOwners, setShowAllOwners] = useState(false);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectGovernance(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError("Could not load governance data. Check that the backend is running.");
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    const actions = (data?.actions ?? []).filter((item) => item.status !== "VOID");
    const decisions = data?.decisions ?? [];
    const meetings = (data?.meetings ?? []).filter((item) => item.status !== "CANCELLED");

    const open: ActionRow[] = actions
      .filter((item) => item.status !== "DONE")
      .map((action) => {
        const dueDay = toDay(action.dueDate);
        const daysToDue = Number.isFinite(dueDay) ? dueDay - today : Number.POSITIVE_INFINITY;
        const late = Number.isFinite(dueDay) ? Math.max(0, today - dueDay) : 0;

        return {
          action,
          dueDay,
          daysToDue,
          lateDays: action.overdue ? Math.max(1, late) : late,
        };
      })
      .sort(
        (a, b) =>
          b.lateDays - a.lateDays ||
          PRIORITY_RANK[b.action.priority] - PRIORITY_RANK[a.action.priority] ||
          a.dueDay - b.dueDay,
      );

    const outlook = OUTLOOK.map((bucket) => ({
      label: bucket.label,
      total: 0,
      byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<GovernanceActionPriority, number>,
    }));

    for (const row of open) {
      const days = row.lateDays > 0 ? -1 : row.daysToDue;
      const index = OUTLOOK.findIndex((bucket) => days <= bucket.max);
      const bucket = outlook[index === -1 ? outlook.length - 1 : index];

      if (bucket) {
        bucket.total += 1;
        bucket.byPriority[row.action.priority] += 1;
      }
    }

    const owners = new Map<string, OwnerRow>();

    for (const row of open) {
      const name = row.action.ownerName?.trim() || "Unassigned";
      const entry = owners.get(name) ?? {
        name,
        total: 0,
        overdue: 0,
        blocked: 0,
        byPriority: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
      };

      entry.total += 1;
      entry.byPriority[row.action.priority] += 1;

      if (row.lateDays > 0) {
        entry.overdue += 1;
      }

      if (row.action.status === "BLOCKED") {
        entry.blocked += 1;
      }

      owners.set(name, entry);
    }

    const ownerRows = [...owners.values()].sort(
      (a, b) => b.overdue - a.overdue || b.total - a.total,
    );

    const impact = IMPACT_ORDER.map((area) => {
      const counts = {
        PROPOSED: 0,
        APPROVED: 0,
        IMPLEMENTED: 0,
        REJECTED: 0,
        SUPERSEDED: 0,
      } as Record<GovernanceDecisionStatus, number>;
      let total = 0;

      for (const decision of decisions) {
        if (decision.impactArea === area) {
          counts[decision.status] += 1;
          total += 1;
        }
      }

      return { area, total, counts };
    }).filter((row) => row.total > 0);

    const pending = decisions
      .filter((item) => item.status === "PROPOSED")
      .map((decision) => {
        const dueDay = toDay(decision.dueDate);
        const late = Number.isFinite(dueDay) ? Math.max(0, today - dueDay) : 0;

        return {
          decision,
          dueDay,
          lateDays: decision.overdue ? Math.max(1, late) : late,
        };
      })
      .sort((a, b) => b.lateDays - a.lateDays || a.dueDay - b.dueDay);

    const meetingRows: MeetingRow[] = [];

    for (const meeting of meetings) {
      const scheduled = toDay(meeting.scheduledAt);

      if (meeting.status === "PLANNED" && scheduled >= today) {
        meetingRows.push({
          meeting,
          day: scheduled,
          flag: scheduled === today ? "Today" : `In ${scheduled - today} d`,
          upcoming: true,
        });
      } else if (meeting.missingMinutes) {
        meetingRows.push({
          meeting,
          day: toDay(meeting.heldAt ?? meeting.scheduledAt),
          flag: "Minutes missing",
          upcoming: false,
        });
      } else if (meeting.status === "PLANNED") {
        meetingRows.push({
          meeting,
          day: scheduled,
          flag: "Date passed, not held",
          upcoming: false,
        });
      }
    }

    meetingRows.sort((a, b) => {
      if (a.upcoming !== b.upcoming) {
        return a.upcoming ? -1 : 1;
      }

      return a.upcoming ? a.day - b.day : b.day - a.day;
    });

    const blocked = open.filter((row) => row.action.status === "BLOCKED");
    const done = actions.filter((item) => item.status === "DONE").length;
    const implemented = decisions.filter((item) => item.status === "IMPLEMENTED").length;

    return {
      open,
      outlook,
      outlookMax: Math.max(0, ...outlook.map((item) => item.total)),
      ownerRows,
      impact,
      pending,
      meetingRows,
      blocked,
      actionTotal: actions.length,
      done,
      decisionTotal: decisions.length,
      implemented,
    };
  }, [data, today]);

  const intel = data?.intelligence;
  const visibleActions = showAllActions ? model.open : model.open.slice(0, LIST_LIMIT);
  const visibleOwners = showAllOwners ? model.ownerRows : model.ownerRows.slice(0, OWNER_LIMIT);
  const ownerMax = Math.max(1, ...model.ownerRows.map((row) => row.total));

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">GOVERNANCE BOARD</div>

            <h1>{data ? data.project.name : "Governance board"}</h1>

            <p className={styles.subtitle}>
              When open actions fall due, who is carrying them, how decisions are progressing and
              which meetings need attention. Record meetings, decisions and actions in governance.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/governance`}>
            Open governance
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && <div className={styles.loading}>Loading governance data…</div>}

        {data && intel && (
          <>
            <section aria-label="Governance summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>GOVERNANCE SCORE</div>
                <div className={styles.kpiValue}>{Math.round(intel.governanceScore)}</div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.governanceRisk])}>
                    {RISK_LABEL[intel.governanceRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN ACTIONS</div>
                <div className={cx(styles.kpiValue, intel.overdueActions > 0 && styles.neg)}>
                  {intel.openActions}
                </div>
                <div className={styles.kpiSub}>
                  {intel.overdueActions} overdue · {intel.criticalOpenActions} critical ·{" "}
                  {intel.blockedActions} blocked
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ACTIONS DONE</div>
                <div className={styles.kpiValue}>
                  {model.actionTotal > 0 ? `${num(percent(model.done, model.actionTotal))}%` : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {model.done} of {model.actionTotal} · {intel.actionsDueNext14Days} due in 14 days
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PENDING DECISIONS</div>
                <div className={cx(styles.kpiValue, intel.overdueDecisions > 0 && styles.neg)}>
                  {intel.pendingDecisions}
                </div>
                <div className={styles.kpiSub}>{intel.overdueDecisions} overdue</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DECISIONS IMPLEMENTED</div>
                <div className={styles.kpiValue}>
                  {model.decisionTotal > 0
                    ? `${num(percent(model.implemented, model.decisionTotal))}%`
                    : "—"}
                </div>
                <div className={styles.kpiSub}>
                  {model.implemented} of {model.decisionTotal}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MINUTES MISSING</div>
                <div className={cx(styles.kpiValue, intel.meetingsWithoutMinutes > 0 && styles.neg)}>
                  {intel.meetingsWithoutMinutes}
                </div>
                <div className={styles.kpiSub}>
                  {intel.heldMeetings} held · {intel.plannedMeetings} planned
                </div>
              </article>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">DUE-DATE OUTLOOK</div>
                    <h2>When open actions fall due</h2>
                  </div>

                  <span className={styles.muted}>{model.open.length} open</span>
                </header>

                {model.open.length === 0 ? (
                  <div className={styles.emptySmall}>No open actions.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.outlook.map((bucket, index) => (
                      <li key={bucket.label}>
                        <div className={styles.ageingTop}>
                          <span className={index === 0 && bucket.total > 0 ? styles.neg : undefined}>
                            {bucket.label}
                          </span>
                          <strong>{bucket.total}</strong>
                        </div>

                        <div
                          aria-label={`${plural(bucket.total, "action")}: ${bucket.label.toLowerCase()}`}
                          className={styles.stackTrack}
                          role="img"
                        >
                          <div
                            className={styles.stack}
                            style={{ width: `${percent(bucket.total, model.outlookMax)}%` }}
                          >
                            {PRIORITIES.map((priority) =>
                              bucket.byPriority[priority] > 0 ? (
                                <i
                                  key={priority}
                                  style={{
                                    background: PRIORITY_COLOR[priority],
                                    flexGrow: bucket.byPriority[priority],
                                  }}
                                  title={`${bucket.byPriority[priority]} ${PRIORITY_LABEL[
                                    priority
                                  ].toLowerCase()} priority`}
                                />
                              ) : null,
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {model.open.length > 0 && (
                  <ul aria-label="Priority legend" className={styles.legend}>
                    {PRIORITIES.map((priority) => (
                      <li key={priority}>
                        <i className={styles.swatch} style={{ background: PRIORITY_COLOR[priority] }} />
                        {PRIORITY_LABEL[priority]}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">WORKLOAD</div>
                    <h2>Open actions by owner</h2>
                  </div>

                  <div className={styles.controls}>
                    <span className={styles.muted}>{model.ownerRows.length} owners</span>

                    {model.ownerRows.length > OWNER_LIMIT && (
                      <button
                        className={styles.linkButton}
                        onClick={() => setShowAllOwners((value) => !value)}
                        type="button"
                      >
                        {showAllOwners ? `Show first ${OWNER_LIMIT}` : `Show all ${model.ownerRows.length}`}
                      </button>
                    )}
                  </div>
                </header>

                {model.ownerRows.length === 0 ? (
                  <div className={styles.emptySmall}>No open actions to assign.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {visibleOwners.map((row) => (
                      <li key={row.name}>
                        <div className={styles.ageingTop}>
                          <span>
                            {row.name}
                            {row.overdue > 0 && <em className={styles.late}>{row.overdue} OVERDUE</em>}
                            {row.blocked > 0 && <em className={styles.late}>{row.blocked} BLOCKED</em>}
                          </span>
                          <strong>{row.total}</strong>
                        </div>

                        <div
                          aria-label={`${plural(row.total, "open action")} owned by ${row.name}`}
                          className={styles.stackTrack}
                          role="img"
                        >
                          <div
                            className={styles.stack}
                            style={{ width: `${percent(row.total, ownerMax)}%` }}
                          >
                            {PRIORITIES.map((priority) =>
                              row.byPriority[priority] > 0 ? (
                                <i
                                  key={priority}
                                  style={{
                                    background: PRIORITY_COLOR[priority],
                                    flexGrow: row.byPriority[priority],
                                  }}
                                  title={`${row.byPriority[priority]} ${PRIORITY_LABEL[
                                    priority
                                  ].toLowerCase()} priority`}
                                />
                              ) : null,
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">DECISIONS</div>
                    <h2>Status by impact area</h2>
                  </div>

                  <span className={styles.muted}>{model.decisionTotal} decisions</span>
                </header>

                {model.impact.length === 0 ? (
                  <div className={styles.emptySmall}>No decisions recorded yet.</div>
                ) : (
                  <ul className={styles.ageing}>
                    {model.impact.map((row) => (
                      <li key={row.area}>
                        <div className={styles.ageingTop}>
                          <span>{IMPACT_LABEL[row.area]}</span>
                          <strong>
                            {row.total}
                            <small>{row.counts.PROPOSED} awaiting a decision</small>
                          </strong>
                        </div>

                        <div
                          aria-label={`${IMPACT_LABEL[row.area]}: ${plural(row.total, "decision")}`}
                          className={styles.stackFull}
                          role="img"
                        >
                          {DECISION_STATUSES.map((entry) =>
                            row.counts[entry.key] > 0 ? (
                              <i
                                key={entry.key}
                                style={{ background: entry.color, flexGrow: row.counts[entry.key] }}
                                title={`${row.counts[entry.key]} ${entry.label.toLowerCase()}`}
                              />
                            ) : null,
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {model.impact.length > 0 && (
                  <ul aria-label="Status legend" className={styles.legend}>
                    {DECISION_STATUSES.map((entry) => (
                      <li key={entry.key}>
                        <i className={styles.swatch} style={{ background: entry.color }} />
                        {entry.label}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">MEETINGS</div>
                    <h2>Upcoming and needing follow-up</h2>
                  </div>

                  <span className={styles.muted}>{intel.meetingCount} meetings</span>
                </header>

                {model.meetingRows.length === 0 ? (
                  <div className={styles.emptySmall}>
                    No meetings are planned and no minutes are outstanding.
                  </div>
                ) : (
                  <ul className={styles.items}>
                    {model.meetingRows.slice(0, MEETING_LIMIT).map((row) => (
                      <li className={row.upcoming ? "" : styles.itemAlert} key={row.meeting.id}>
                        <div className={styles.itemTop}>
                          <strong>{row.meeting.meetingNumber}</strong>
                          <span>{MEETING_TYPE_LABEL[row.meeting.meetingType]}</span>
                        </div>
                        <div className={styles.itemTitle}>{row.meeting.title}</div>
                        <div className={styles.itemMeta}>
                          <span>
                            {formatDay(row.day)}
                            {row.meeting.chairName ? ` · chair ${row.meeting.chairName}` : ""}
                          </span>
                          <span className={row.upcoming ? undefined : styles.neg}>{row.flag}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>

            {model.blocked.length > 0 && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BLOCKED</div>
                    <h2>Actions that cannot move</h2>
                  </div>

                  <span className={styles.muted}>{model.blocked.length} blocked</span>
                </header>

                <ul className={styles.items}>
                  {model.blocked.slice(0, 6).map((row) => (
                    <li className={styles.itemAlert} key={row.action.id}>
                      <div className={styles.itemTop}>
                        <strong>{row.action.actionNumber}</strong>
                        <span>{row.action.ownerName ?? "Unassigned"}</span>
                      </div>
                      <div className={styles.itemTitle}>{row.action.title}</div>
                      <div className={styles.itemMeta}>
                        <span>{row.action.blockerReason ?? "No blocker reason recorded"}</span>
                        <span className={row.lateDays > 0 ? styles.neg : undefined}>
                          {row.lateDays > 0 ? `${row.lateDays} d late` : `Due ${formatDay(row.dueDay)}`}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">PENDING DECISIONS</div>
                  <h2>Waiting for a decision</h2>
                </div>

                <span className={styles.muted}>
                  {model.pending.length} proposed · {model.pending.filter((row) => row.lateDays > 0).length}{" "}
                  overdue
                </span>
              </header>

              {model.pending.length === 0 ? (
                <div className={styles.emptySmall}>No decisions are waiting.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>NUMBER</th>
                        <th>DECISION</th>
                        <th>IMPACT</th>
                        <th>OWNER</th>
                        <th>RAISED</th>
                        <th>DUE</th>
                        <th className={styles.num}>LATE</th>
                      </tr>
                    </thead>

                    <tbody>
                      {model.pending.slice(0, LIST_LIMIT).map((row) => (
                        <tr key={row.decision.id}>
                          <td>
                            <strong>{row.decision.decisionNumber}</strong>
                          </td>
                          <td className={styles.wrap}>{row.decision.title}</td>
                          <td>{IMPACT_LABEL[row.decision.impactArea]}</td>
                          <td>{row.decision.ownerName ?? "Unassigned"}</td>
                          <td>{formatDay(toDay(row.decision.decisionDate))}</td>
                          <td>{formatDay(row.dueDay)}</td>
                          <td className={cx(styles.num, row.lateDays > 0 && styles.neg)}>
                            {row.lateDays > 0 ? `${row.lateDays} d` : "—"}
                          </td>
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
                  <div className="eyebrow">OPEN ACTIONS</div>
                  <h2>Most overdue first</h2>
                </div>

                <div className={styles.controls}>
                  <span className={styles.muted}>
                    {model.open.length} open · {model.open.filter((row) => row.lateDays > 0).length}{" "}
                    overdue
                  </span>

                  {model.open.length > LIST_LIMIT && (
                    <button
                      className={styles.linkButton}
                      onClick={() => setShowAllActions((value) => !value)}
                      type="button"
                    >
                      {showAllActions ? `Show first ${LIST_LIMIT}` : `Show all ${model.open.length}`}
                    </button>
                  )}
                </div>
              </header>

              {model.open.length === 0 ? (
                <div className={styles.emptySmall}>No open actions. Everything is closed out.</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>NUMBER</th>
                        <th>ACTION</th>
                        <th>PRIORITY</th>
                        <th>OWNER</th>
                        <th>DUE</th>
                        <th className={styles.num}>LATE</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>

                    <tbody>
                      {visibleActions.map((row) => (
                        <tr key={row.action.id}>
                          <td>
                            <strong>{row.action.actionNumber}</strong>
                          </td>
                          <td className={styles.wrap}>{row.action.title}</td>
                          <td>
                            <span className={cx(styles.sev, PRIORITY_CLASS[row.action.priority])}>
                              {PRIORITY_LABEL[row.action.priority]}
                            </span>
                          </td>
                          <td>{row.action.ownerName ?? "Unassigned"}</td>
                          <td>{formatDay(row.dueDay)}</td>
                          <td className={cx(styles.num, row.lateDays > 0 && styles.neg)}>
                            {row.lateDays > 0 ? `${row.lateDays} d` : "—"}
                          </td>
                          <td>{ACTION_STATUS_LABEL[row.action.status]}</td>
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
