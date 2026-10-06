"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import styles from "./ProjectViewsMenu.module.css";

const VIEWS = [
  ["", "Command center", false],
  ["map", "Project map", true],
  ["find", "Find anything", true],
  ["inbox", "Action inbox", true],
  ["watchlist", "My watchlist", true],
  ["whats-new", "Since my last visit", true],
  ["backlog", "Backlog trend", true],
  ["closure-speed", "Closure speed", true],
  ["owner-reliability", "Owner reliability", true],
  ["pareto", "Pareto analysis", true],
  ["calendar", "Due-date calendar", true],
  ["site-brief", "Site brief", true],
  ["workload", "Workload", true],
  ["scorecard", "Health radar", true],
  ["targets", "Targets", true],
  ["costs", "Cost control", false],
  ["cost-breakdown", "Cost breakdown", true],
  ["spend-board", "Spend board", true],
  ["budget-movement", "Budget movement", true],
  ["schedule", "Schedule", false],
  ["lookahead", "Lookahead board", true],
  ["milestone-board", "Milestone board", true],
  ["timeline", "Timeline (Gantt)", true],
  ["forecast", "Forecast", false],
  ["scenarios", "Scenario board", true],
  ["finish-simulation", "Finish confidence", true],
  ["slip-explorer", "Slip explorer", true],
  ["logic-map", "Logic map", true],
  ["start-readiness", "Start readiness", true],
  ["constraint-log", "Constraint log", true],
  ["schedule-health", "Schedule health", true],
  ["pinch-points", "Pinch points", true],
  ["progress-curve", "Progress curve", true],
  ["progress-agreement", "Programme vs site progress", true],
  ["forecast-drift", "Forecast drift", true],
  ["trends", "Trends (S-curve)", true],
  ["since-report", "Since last report", true],
  ["activity", "Activity timeline", true],
  ["governance", "Governance", false],
  ["governance-board", "Governance board", true],
  ["meeting-cadence", "Meeting cadence", true],
  ["meeting-outputs", "Meeting outputs", true],
  ["meeting-pack", "Meeting pack", true],
  ["board", "Action board", true],
  ["risk-control", "Risk control", false],
  ["risk-board", "Risk board", true],
  ["risk-matrix", "Risk matrix", true],
  ["risk-materialisation", "Risk materialisation", true],
  ["issue-ageing", "Issue ageing", true],
  ["risk-register-checks", "Risk register checks", true],
  ["procurement", "Procurement", false],
  ["supplier-board", "Supplier board", true],
  ["award-choices", "Award choices", true],
  ["procurement-pipeline", "Procurement pipeline", true],
  ["production", "Production", false],
  ["production-board", "Production board", true],
  ["report-lag", "Report filing lag", true],
  ["run-rate", "Run rate", true],
  ["production-checks", "Production reconciliation", true],
  ["weather-record", "Weather record", true],
  ["diary-evidence", "Site diary evidence", true],
  ["quality", "Quality", false],
  ["quality-board", "Quality board", true],
  ["inspection-schedule", "Inspection schedule", true],
  ["inspection-outcomes", "Inspection outcomes", true],
  ["handover-timeliness", "Handover timeliness", true],
  ["ncr-records", "NCR closure records", true],
  ["closeout-board", "Closeout board", true],
  ["safety", "Safety", false],
  ["safety-board", "Safety board", true],
  ["safety-rates", "Safety rates", true],
  ["safety-follow-up", "Safety follow-up", true],
  ["incident-investigations", "Incident investigations", true],
  ["observation-culture", "Observation culture", true],
  ["permit-overlaps", "Permit overlaps", true],
  ["permit-discipline", "Permit discipline", true],
  ["hotspots", "Site hotspots", true],
  ["commercial", "Commercial", false],
  ["commercial-board", "Commercial board", true],
  ["valuation-gap", "Valuation gap", true],
  ["certificate-checks", "Certificate checks", true],
  ["cash-position", "Cash position", true],
  ["entitlement-board", "Entitlement board", true],
  ["delay-concurrency", "Delay concurrency", true],
  ["decision-times", "Decision times", true],
  ["cashflow", "Cashflow", true],
  ["resources", "Resources", false],
  ["idle-plant", "Idle plant", true],
  ["fatigue-watch", "Fatigue watch", true],
  ["labour-reconciliation", "Labour reconciliation", true],
  ["plant-reconciliation", "Plant reconciliation", true],
  ["labour-burn", "Labour budget burn", true],
  ["crew-plan", "Crew size against plan", true],
  ["trade-flow", "Trade flow", true],
  ["trade-sheet", "Trade sheet", true],
  ["resource-heatmap", "Resource heatmap", true],
  ["documents", "Documents", false],
  ["rfi-board", "RFI board", true],
  ["transmittal-coverage", "Transmittal coverage", true],
  ["document-board", "Document board", true],
  ["recovery", "Recovery", false],
  ["recovery-board", "Recovery board", true],
  ["period-control", "Period control", false],
  ["period-board", "Period board", true],
  ["baseline-history", "Baseline history", true],
  ["data-health", "Data hygiene", true],
  ["export", "Data export", true],
  ["copilot", "AI copilot", false],
  ["report", "Project report", true],
] as const;

type ViewGroup = "all" | "modules" | "boards";

const GROUPS: ReadonlyArray<readonly [ViewGroup, string]> = [
  ["all", "All"],
  ["modules", "Modules"],
  ["boards", "Boards"],
];

const BOARD_SLUGS = new Set(["board", "scorecard", "lookahead", "scenarios", "procurement-pipeline", "resource-heatmap", "since-report", "calendar", "meeting-pack", "data-health", "find", "workload", "activity", "finish-simulation", "site-brief", "schedule-health", "hotspots", "whats-new", "backlog", "pareto", "slip-explorer", "closure-speed", "logic-map", "watchlist", "owner-reliability", "progress-curve", "start-readiness", "constraint-log", "trade-flow", "targets", "cash-position", "decision-times", "trade-sheet", "run-rate", "pinch-points", "idle-plant", "safety-rates", "fatigue-watch", "weather-record", "inspection-schedule", "permit-overlaps", "labour-reconciliation", "forecast-drift", "inspection-outcomes", "transmittal-coverage", "labour-burn", "report-lag", "meeting-cadence", "valuation-gap", "meeting-outputs", "risk-materialisation", "crew-plan", "budget-movement", "award-choices", "safety-follow-up", "baseline-history", "observation-culture", "ncr-records", "production-checks", "progress-agreement", "permit-discipline", "plant-reconciliation", "delay-concurrency", "incident-investigations", "handover-timeliness", "risk-register-checks", "diary-evidence", "issue-ageing", "certificate-checks"]);

function isBoard(slug: string): boolean {
  return slug.endsWith("-board") || BOARD_SLUGS.has(slug);
}

function inGroup(slug: string, group: ViewGroup): boolean {
  return group === "all" || (group === "boards") === isBoard(slug);
}

function countInGroup(group: ViewGroup): number {
  return VIEWS.filter(([slug]) => inGroup(slug, group)).length;
}

export function ProjectViewsMenu() {
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<ViewGroup>("all");

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointer(event: MouseEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const match = pathname.match(/^\/projects\/([^/]+)(?:\/([^/]+))?/);
  const projectId = match?.[1];
  const section = match?.[2] ?? "";

  if (!projectId) {
    return null;
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Project views"
        className={styles.button}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="19"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          width="19"
        >
          <rect height="7" rx="1.5" width="7" x="3" y="3" />
          <rect height="7" rx="1.5" width="7" x="14" y="3" />
          <rect height="7" rx="1.5" width="7" x="3" y="14" />
          <rect height="7" rx="1.5" width="7" x="14" y="14" />
        </svg>
      </button>

      {open && (
        <nav aria-label="Project views" className={styles.panel}>
          <div className={styles.head}>Project views</div>

          <div aria-label="Show" className={styles.tabs} role="group">
            {GROUPS.map(([key, name]) => (
              <button
                aria-pressed={group === key}
                className={`${styles.tab} ${group === key ? styles.tabOn : ""}`}
                key={key}
                onClick={() => setGroup(key)}
                type="button"
              >
                {name}
                <small>{countInGroup(key)}</small>
              </button>
            ))}
          </div>

          <ul>
            {VIEWS.filter(([slug]) => inGroup(slug, group)).map(([slug, label, isNew]) => (
              <li key={slug || "overview"}>
                <Link
                  aria-current={section === slug ? "page" : undefined}
                  className={`${styles.item} ${
                    section === slug ? styles.active : ""
                  }`}
                  href={
                    slug
                      ? `/projects/${projectId}/${slug}`
                      : `/projects/${projectId}`
                  }
                  onClick={() => setOpen(false)}
                >
                  <span>{label}</span>
                  {isNew && <em>NEW</em>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
