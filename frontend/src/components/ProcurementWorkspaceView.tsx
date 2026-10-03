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

function currency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

export function ProcurementWorkspaceView() {
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

    const budget = projects.reduce(
      (sum, project) =>
        sum + Number(project.approvedBudget),
      0,
    );

    return {
      active,
      budget,
    };
  }, [projects]);

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className={`main ${styles.main}`}>
        <header className={styles.header}>
          <div className={styles.headerCopy}>
            <div className="eyebrow">
              SUPPLY CHAIN CONTROL
            </div>

            <h1>
              Procurement
            </h1>

            <p>
              Manage procurement packages from
              competition through award and supplier
              performance. Select a project to work
              with its actual procurement records.
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
              PROJECT WORKSPACES
            </span>

            <strong>
              {projects.length}
            </strong>

            <small>
              Procurement controls available
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
              Projects currently in delivery
            </small>
          </article>

          <article className={styles.metric}>
            <span>
              APPROVED BUDGET CONTEXT
            </span>

            <strong>
              {currency(metrics.budget)}
            </strong>

            <small>
              Portfolio budget represented below
            </small>
          </article>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <div className="eyebrow">
                PROCUREMENT LIFECYCLE
              </div>

              <h2>
                From package to supplier performance
              </h2>

              <p>
                Procurement is not a production log or
                document library. It manages purchasing
                packages, competitive bids, award
                decisions and subsequent supplier
                performance.
              </p>
            </div>

            <div className={styles.sectionBadge}>
              SUPPLY CHAIN
            </div>
          </div>

          <div className={styles.flow}>
            <article className={styles.flowStep}>
              <span>
                01
              </span>

              <strong>
                Procurement packages
              </strong>

              <p>
                Define and manage packages representing
                the project scope to procure.
              </p>
            </article>

            <article className={styles.flowStep}>
              <span>
                02
              </span>

              <strong>
                Bids & evaluation
              </strong>

              <p>
                Record competing bids and compare the
                commercial response for each package.
              </p>
            </article>

            <article className={styles.flowStep}>
              <span>
                03
              </span>

              <strong>
                Award
              </strong>

              <p>
                Record the selected bid and formalize
                the procurement award decision.
              </p>
            </article>

            <article className={styles.flowStep}>
              <span>
                04
              </span>

              <strong>
                Performance
              </strong>

              <p>
                Maintain supplier performance
                evaluations after procurement decisions.
              </p>
            </article>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div>
              <div className="eyebrow">
                PROJECT PROCUREMENT
              </div>

              <h2>
                Open a procurement workspace
              </h2>

              <p>
                Select a construction project to manage
                its packages, bids, awards and supplier
                performance.
              </p>
            </div>

            <div className={styles.sectionBadge}>
              {projects.length} PROJECTS
            </div>
          </div>

          {loading ? (
            <div className={styles.state}>
              Loading procurement workspaces...
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
                  href={`/projects/${project.id}/procurement`}
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
                      APPROVED BUDGET
                    </span>

                    <strong>
                      {currency(
                        Number(
                          project.approvedBudget,
                        ),
                      )}
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
                      LOCATION
                    </span>

                    <strong>
                      {project.location}
                    </strong>
                  </div>

                  <div className={styles.action}>
                    <span>
                      Open procurement
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
