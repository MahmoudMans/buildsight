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

function formattedDate(
  value: string | null | undefined,
): string {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

export function DocumentsWorkspaceView() {
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

    const latest = [...projects]
      .filter((project) => project.updatedAt)
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime(),
      )[0];

    return {
      active,
      latest:
        latest?.updatedAt ?? null,
    };
  }, [projects]);

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className={`main ${styles.main}`}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <div className="eyebrow">
              DOCUMENT & INFORMATION CONTROL
            </div>

            <h1>
              Documents
            </h1>

            <p>
              Control project information through
              managed documents, revisions, RFIs,
              transmittals and project-level search.
              Select a project to enter its document
              control room.
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
              PROJECT DOCUMENT ROOMS
            </span>

            <strong>
              {projects.length}
            </strong>

            <small>
              Project document-control workspaces
            </small>
          </article>

          <article className={styles.metric}>
            <span>
              ACTIVE PROJECTS
            </span>

            <strong>
              {metrics.active}
            </strong>

            <small>
              Active information-control contexts
            </small>
          </article>

          <article className={styles.metric}>
            <span>
              LATEST PROJECT UPDATE
            </span>

            <strong>
              {formattedDate(metrics.latest)}
            </strong>

            <small>
              Project metadata freshness indicator
            </small>
          </article>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <div className="eyebrow">
                INFORMATION CONTROL
              </div>

              <h2>
                What belongs in Documents
              </h2>

              <p>
                This workspace controls project records
                and information exchange. It does not
                manage production packages or supplier
                procurement.
              </p>
            </div>

            <div className={styles.sectionBadge}>
              DOCUMENT CONTROL
            </div>
          </div>

          <div className={styles.documentCapabilities}>
            <article className={styles.documentCapability}>
              <span>
                CONTROLLED RECORDS
              </span>

              <strong>
                Documents & revisions
              </strong>

              <p>
                Maintain controlled project documents,
                revision history, revision status and
                stored document content.
              </p>
            </article>

            <article className={styles.documentCapability}>
              <span>
                TECHNICAL QUESTIONS
              </span>

              <strong>
                RFIs
              </strong>

              <p>
                Record and manage requests for
                information associated with project
                delivery.
              </p>
            </article>

            <article className={styles.documentCapability}>
              <span>
                FORMAL ISSUE
              </span>

              <strong>
                Transmittals
              </strong>

              <p>
                Assemble and issue formal document
                transmittals through the controlled
                project record.
              </p>
            </article>

            <article className={styles.documentCapability}>
              <span>
                RETRIEVAL
              </span>

              <strong>
                Search & retrieval
              </strong>

              <p>
                Search controlled project information
                and retrieve the records required for
                delivery decisions.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <div className="eyebrow">
                PROJECT DOCUMENT ROOMS
              </div>

              <h2>
                Open document control
              </h2>

              <p>
                Choose the project whose documents,
                revisions, RFIs or transmittals you
                want to manage.
              </p>
            </div>

            <div className={styles.sectionBadge}>
              {projects.length} PROJECTS
            </div>
          </div>

          {loading ? (
            <div className={styles.state}>
              Loading document-control workspaces...
            </div>
          ) : projects.length === 0 ? (
            <div className={styles.state}>
              No projects are available.
            </div>
          ) : (
            <div className={styles.projectList}>
              {projects.map((project) => (
                <Link
                  className={styles.projectRow}
                  href={`/projects/${project.id}/documents`}
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

                  <div className={styles.meta}>
                    <span>
                      PROJECT UPDATED
                    </span>

                    <strong>
                      {formattedDate(
                        project.updatedAt,
                      )}
                    </strong>
                  </div>

                  <div className={styles.action}>
                    <span>
                      Open document control
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
