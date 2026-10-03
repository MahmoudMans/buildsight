"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getProjects,
} from "@/lib/api";

import type {
  Project,
  ProjectStatus,
} from "@/types/project";

import {
  BuildSightSidebar,
} from "./BuildSightSidebar";

import styles from "./WorkspaceDirectoryView.module.css";

export type WorkspaceKind =
  | "projects"
  | "budgets"
  | "work-packages"
  | "procurement"
  | "risks"
  | "documents"
  | "intelligence";

interface WorkspaceConfig {
  eyebrow: string;
  title: string;
  description: string;
  sectionTitle: string;
  sectionDescription: string;
  actionLabel: string;
  segment: string | null;
}

const configurations: Record<
  WorkspaceKind,
  WorkspaceConfig
> = {
  projects: {
    eyebrow: "PROJECT DIRECTORY",
    title: "Projects",
    description:
      "Open a construction project to review its delivery controls, progress, forecasts and operational intelligence.",
    sectionTitle: "Construction projects",
    sectionDescription:
      "Choose the project you want to manage.",
    actionLabel: "Open project",
    segment: null,
  },

  budgets: {
    eyebrow: "COST CONTROL",
    title: "Budgets & cost control",
    description:
      "Review approved project budgets and open the detailed cost-control workspace for the project that requires attention.",
    sectionTitle: "Project budgets",
    sectionDescription:
      "Choose a project to inspect its budget, actual cost and cost-control information.",
    actionLabel: "Open cost control",
    segment: "costs",
  },

  "work-packages": {
    eyebrow: "DELIVERY CONTROL",
    title: "Work packages & production",
    description:
      "Review project delivery through the work-package and production workspace for each construction project.",
    sectionTitle: "Project work packages",
    sectionDescription:
      "Choose a project to inspect its production and work-package controls.",
    actionLabel: "Open work packages",
    segment: "production",
  },

  procurement: {
    eyebrow: "SUPPLY CHAIN CONTROL",
    title: "Procurement",
    description:
      "Review procurement activity by project and open the relevant supplier and package controls.",
    sectionTitle: "Project procurement",
    sectionDescription:
      "Choose a project to review its procurement workspace.",
    actionLabel: "Open procurement",
    segment: "procurement",
  },

  risks: {
    eyebrow: "RISK CONTROL",
    title: "Risks",
    description:
      "Review project risk-control workspaces and investigate the projects that require mitigation or recovery action.",
    sectionTitle: "Project risk control",
    sectionDescription:
      "Choose a project to inspect its risks and mitigation controls.",
    actionLabel: "Open risk control",
    segment: "risk-control",
  },

  documents: {
    eyebrow: "DOCUMENT CONTROL",
    title: "Documents",
    description:
      "Access project document-control workspaces without mixing document selection into the main navigation.",
    sectionTitle: "Project documents",
    sectionDescription:
      "Choose a project to inspect its controlled project documents.",
    actionLabel: "Open documents",
    segment: "documents",
  },

  intelligence: {
    eyebrow: "BUILDSIGHT INTELLIGENCE",
    title: "Intelligence",
    description:
      "Use portfolio-level intelligence for cross-project decisions or open a project copilot for project-specific investigation.",
    sectionTitle: "Project intelligence",
    sectionDescription:
      "Choose a project to open its local AI copilot and cited project intelligence.",
    actionLabel: "Open project copilot",
    segment: "copilot",
  },
};

const statusLabels: Record<
  ProjectStatus,
  string
> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function compactCurrency(
  value: number,
): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function projectHref(
  project: Project,
  config: WorkspaceConfig,
): string {
  if (!config.segment) {
    return `/projects/${project.id}`;
  }

  return `/projects/${project.id}/${config.segment}`;
}

export function WorkspaceDirectoryView({
  kind,
}: {
  kind: WorkspaceKind;
}) {
  const config = configurations[kind];

  const [projects, setProjects] =
    useState<Project[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [apiOnline, setApiOnline] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response =
          await getProjects();

        if (!cancelled) {
          setProjects(response);
          setApiOnline(true);
        }
      } catch {
        if (!cancelled) {
          setApiOnline(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const active = projects.filter(
      (project) =>
        project.status === "ACTIVE",
    ).length;

    const onHold = projects.filter(
      (project) =>
        project.status === "ON_HOLD",
    ).length;

    return {
      active,
      onHold,
    };
  }, [projects]);

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main
        className={`main ${styles.main}`}
      >
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <div className="eyebrow">
              {config.eyebrow}
            </div>

            <h1>
              {config.title}
            </h1>

            <p>
              {config.description}
            </p>
          </div>

          <div className={styles.headerActions}>
            <div
              className={
                apiOnline
                  ? "connection-pill online"
                  : "connection-pill offline"
              }
              role="status"
            >
              <span />

              {apiOnline
                ? "Backend online"
                : "Backend offline"}
            </div>

            <Link
              className={styles.portfolioLink}
              href="/"
            >
              Portfolio overview
              <span aria-hidden="true">
                ↗
              </span>
            </Link>
          </div>
        </header>

        {!apiOnline && (
          <div className="offline-banner">
            <div>
              <strong>
                Local backend is not reachable.
              </strong>

              <span>
                Project information cannot be
                loaded until the BuildSight API
                is available.
              </span>
            </div>
          </div>
        )}

        <section className={styles.summaryGrid}>
          <article className={styles.summaryCard}>
            <span>
              PROJECTS
            </span>

            <strong>
              {projects.length}
            </strong>

            <small>
              Current portfolio
            </small>
          </article>

          <article className={styles.summaryCard}>
            <span>
              ACTIVE
            </span>

            <strong>
              {metrics.active}
            </strong>

            <small>
              In delivery
            </small>
          </article>

          <article className={styles.summaryCard}>
            <span>
              ON HOLD
            </span>

            <strong>
              {metrics.onHold}
            </strong>

            <small>
              Paused projects
            </small>
          </article>
        </section>

        {kind === "budgets" && (
          <section className={styles.toolPanel}>
            <div>
              <div className="eyebrow">
                PORTFOLIO COST INTELLIGENCE
              </div>

              <h2>
                Portfolio forecast
              </h2>

              <p>
                Compare forecast and earned-value
                signals across the portfolio before
                opening a specific project.
              </p>
            </div>

            <Link
              className={styles.toolLink}
              href="/portfolio/forecast"
            >
              Open portfolio forecast
              <span aria-hidden="true">
                ↗
              </span>
            </Link>
          </section>
        )}

        {kind === "risks" && (
          <section className={styles.toolPanel}>
            <div>
              <div className="eyebrow">
                PORTFOLIO RECOVERY
              </div>

              <h2>
                Recovery intelligence
              </h2>

              <p>
                Review recovery exposure and
                portfolio-level recovery options
                before opening individual project
                risks.
              </p>
            </div>

            <Link
              className={styles.toolLink}
              href="/portfolio/recovery"
            >
              Open portfolio recovery
              <span aria-hidden="true">
                ↗
              </span>
            </Link>
          </section>
        )}

        {kind === "intelligence" && (
          <section
            className={styles.intelligenceTools}
          >
            <div className={styles.toolsHeading}>
              <div className="eyebrow">
                PORTFOLIO INTELLIGENCE
              </div>

              <h2>
                Cross-project controls
              </h2>

              <p>
                Use the portfolio tools when the
                question concerns more than one
                project.
              </p>
            </div>

            <div className={styles.toolsGrid}>
              <Link
                href="/portfolio/forecast"
              >
                <span>01</span>
                <strong>
                  Forecast
                </strong>
                <small>
                  Predictive cost and schedule
                  controls.
                </small>
              </Link>

              <Link
                href="/portfolio/governance"
              >
                <span>02</span>
                <strong>
                  Governance
                </strong>
                <small>
                  Portfolio governance and
                  decision controls.
                </small>
              </Link>

              <Link
                href="/portfolio/recovery"
              >
                <span>03</span>
                <strong>
                  Recovery
                </strong>
                <small>
                  Change impact and recovery
                  intelligence.
                </small>
              </Link>
            </div>
          </section>
        )}

        <section className={styles.directory}>
          <div className={styles.directoryHeading}>
            <div>
              <div className="eyebrow">
                WORKSPACE DIRECTORY
              </div>

              <h2>
                {config.sectionTitle}
              </h2>

              <p>
                {config.sectionDescription}
              </p>
            </div>

            <div className={styles.count}>
              {projects.length} projects
            </div>
          </div>

          {loading ? (
            <div className={styles.state}>
              Loading projects...
            </div>
          ) : projects.length === 0 ? (
            <div className={styles.state}>
              {apiOnline
                ? "No construction projects are available yet."
                : "Projects cannot be loaded while the backend is offline."}
            </div>
          ) : (
            <div className={styles.projectGrid}>
              {projects.map((project) => (
                <Link
                  className={styles.projectCard}
                  href={projectHref(
                    project,
                    config,
                  )}
                  key={project.id}
                >
                  <div
                    className={styles.projectTop}
                  >
                    <div
                      className={
                        styles.projectIdentity
                      }
                    >
                      <div
                        className={
                          styles.projectAvatar
                        }
                      >
                        {project.name
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <strong>
                          {project.name}
                        </strong>

                        <span>
                          {project.code}
                        </span>
                      </div>
                    </div>

                    <span
                      className={styles.status}
                      data-status={
                        project.status
                      }
                    >
                      {
                        statusLabels[
                          project.status
                        ]
                      }
                    </span>
                  </div>

                  <div
                    className={
                      styles.projectMetadata
                    }
                  >
                    <div>
                      <span>
                        CLIENT
                      </span>

                      <strong>
                        {project.clientName}
                      </strong>
                    </div>

                    <div>
                      <span>
                        LOCATION
                      </span>

                      <strong>
                        {project.location}
                      </strong>
                    </div>
                  </div>

                  <div
                    className={
                      styles.projectMetrics
                    }
                  >
                    <div>
                      <span>
                        BUDGET
                      </span>

                      <strong>
                        {compactCurrency(
                          project.approvedBudget,
                        )}
                      </strong>
                    </div>

                    <div>
                      <span>
                        PROGRESS
                      </span>

                      <strong>
                        {Number(
                          project
                            .physicalProgressPercentage,
                        ).toFixed(1)}
                        %
                      </strong>
                    </div>
                  </div>

                  <div
                    className={
                      styles.projectAction
                    }
                  >
                    <span>
                      {config.actionLabel}
                    </span>

                    <span aria-hidden="true">
                      ↗
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
