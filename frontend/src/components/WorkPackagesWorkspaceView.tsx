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

import styles from "./OperationalWorkspace.module.css";

const statusLabels: Record<ProjectStatus, string> = {
  PLANNING: "Planning",
  ACTIVE: "Active",
  ON_HOLD: "On hold",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

function progress(project: Project): number {
  return Math.max(
    0,
    Math.min(
      100,
      Number(
        project.physicalProgressPercentage,
      ),
    ),
  );
}

export function WorkPackagesWorkspaceView() {
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

    const averageProgress =
      projects.length === 0
        ? 0
        : projects.reduce(
            (sum, project) =>
              sum + progress(project),
            0,
          ) / projects.length;

    return {
      active,
      averageProgress,
    };
  }, [projects]);

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className={`main ${styles.main}`}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <div className="eyebrow">
              DELIVERY & PRODUCTION CONTROL
            </div>

            <h1>
              Work packages
            </h1>

            <p>
              Control construction execution through
              work packages, site reporting and
              production evidence. Select a project to
              manage its actual delivery records.
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
              Portfolio
              <span aria-hidden="true">
                ↗
              </span>
            </Link>
          </div>
        </header>

        <section className={styles.metrics}>
          <article className={styles.metric}>
            <span>
              PROJECTS
            </span>

            <strong>
              {projects.length}
            </strong>

            <small>
              Available delivery workspaces
            </small>
          </article>

          <article className={styles.metric}>
            <span>
              ACTIVE DELIVERY
            </span>

            <strong>
              {metrics.active}
            </strong>

            <small>
              Projects currently active
            </small>
          </article>

          <article className={styles.metric}>
            <span>
              AVG. PHYSICAL PROGRESS
            </span>

            <strong>
              {metrics.averageProgress.toFixed(1)}%
            </strong>

            <small>
              Current project-level progress
            </small>
          </article>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <div className="eyebrow">
                PRODUCTION MODEL
              </div>

              <h2>
                What this workspace controls
              </h2>

              <p>
                Work packages is the execution workspace:
                scope is broken into controllable packages,
                field activity is recorded through site
                reports, and progress evidence is maintained
                against actual production.
              </p>
            </div>

            <div className={styles.sectionBadge}>
              DELIVERY
            </div>
          </div>

          <div className={styles.capabilityGrid}>
            <article className={styles.capabilityCard}>
              <span className={styles.capabilityIndex}>
                01
              </span>

              <strong>
                Work packages
              </strong>

              <p>
                Organize executable construction scope
                into project work packages and maintain
                their delivery status.
              </p>
            </article>

            <article className={styles.capabilityCard}>
              <span className={styles.capabilityIndex}>
                02
              </span>

              <strong>
                Site reports
              </strong>

              <p>
                Record site activity and maintain the
                operational reporting trail for actual
                project execution.
              </p>
            </article>

            <article className={styles.capabilityCard}>
              <span className={styles.capabilityIndex}>
                03
              </span>

              <strong>
                Production evidence
              </strong>

              <p>
                Capture site-report entries and connect
                reported activity to measurable delivery
                progress.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <div className="eyebrow">
                PROJECT DELIVERY
              </div>

              <h2>
                Open a production workspace
              </h2>

              <p>
                Select the project whose work packages,
                site reports or production progress you
                want to manage.
              </p>
            </div>

            <div className={styles.sectionBadge}>
              {projects.length} PROJECTS
            </div>
          </div>

          {loading ? (
            <div className={styles.state}>
              Loading project delivery workspaces...
            </div>
          ) : projects.length === 0 ? (
            <div className={styles.state}>
              No projects are available.
            </div>
          ) : (
            <div className={styles.projectList}>
              {projects.map((project) => {
                const value = progress(project);

                return (
                  <Link
                    className={styles.projectRow}
                    href={`/projects/${project.id}/production`}
                    key={project.id}
                  >
                    <div className={styles.projectIdentity}>
                      <strong>
                        {project.name}
                      </strong>

                      <span>
                        {project.code} · {project.clientName}
                      </span>
                    </div>

                    <div className={styles.meta}>
                      <span>
                        LOCATION
                      </span>

                      <strong>
                        {project.location}
                      </strong>
                    </div>

                    <div className={styles.meta}>
                      <span>
                        STATUS
                      </span>

                      <span
                        className={styles.status}
                        data-status={project.status}
                      >
                        {statusLabels[project.status]}
                      </span>
                    </div>

                    <div className={styles.progress}>
                      <div className={styles.progressTop}>
                        <span>
                          PROGRESS
                        </span>

                        <span>
                          {value.toFixed(1)}%
                        </span>
                      </div>

                      <div className={styles.progressRail}>
                        <div
                          className={styles.progressFill}
                          style={{
                            width: `${value}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className={styles.action}>
                      <span>
                        Open production
                      </span>

                      <span aria-hidden="true">
                        ↗
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
