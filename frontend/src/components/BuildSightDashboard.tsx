"use client";

// BUILDSIGHT_HOME_DECISION_UI_V1
// BUILDSIGHT_HOME_REFINEMENT_V3
import Link from "next/link";
import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { PortfolioInsights } from "@/components/PortfolioInsights";
import styles from "./BuildSightDashboard.module.css";


import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  BuildSightApiError,
  createProject,
  getProjects,
} from "@/lib/api";

import type {
  CreateProjectInput,
  Project,
  ProjectStatus,
} from "@/types/project";

const initialForm: CreateProjectInput = {
  code: "BS-2026-005",
  name: "",
  description: "",
  clientName: "",
  location: "",
  contractValue: 0,
  approvedBudget: 0,
  plannedStartDate: "",
  plannedEndDate: "",
};

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
    maximumFractionDigits: 0,
  }).format(value);
}

function compactCurrency(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return "No updates";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function statusClass(status: ProjectStatus): string {
  return `status-badge status-${status.toLowerCase().replace("_", "-")}`;
}

export function BuildSightDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(true);
  const [showCreatePanel, setShowCreatePanel] = useState(false);

  const [query, setQuery] = useState("");

  const [statusFilter, setStatusFilter] =
    useState<"ALL" | ProjectStatus>("ALL");

  const [sortKey, setSortKey] =
    useState<"name" | "progress" | "budget" | "finish">("name");

  const [form, setForm] =
    useState<CreateProjectInput>(initialForm);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] =
    useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const response = await getProjects();

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

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  const metrics = useMemo(() => {
    const activeProjects = projects.filter(
      (project) => project.status === "ACTIVE",
    ).length;

    const onHoldProjects = projects.filter(
      (project) => project.status === "ON_HOLD",
    ).length;

    const planningProjects = projects.filter(
      (project) => project.status === "PLANNING",
    ).length;

    const totalBudget = projects.reduce(
      (sum, project) => sum + Number(project.approvedBudget),
      0,
    );

    const contractValue = projects.reduce(
      (sum, project) => sum + Number(project.contractValue),
      0,
    );

    const averageProgress =
      projects.length === 0
        ? 0
        : projects.reduce(
            (sum, project) =>
              sum + Number(project.physicalProgressPercentage),
            0,
          ) / projects.length;

    const latestUpdatedAt = projects.reduce<string | null>(
      (latest, project) => {
        if (!project.updatedAt) {
          return latest;
        }

        if (!latest) {
          return project.updatedAt;
        }

        return new Date(project.updatedAt).getTime() >
          new Date(latest).getTime()
          ? project.updatedAt
          : latest;
      },
      null,
    );

    return {
      activeProjects,
      onHoldProjects,
      planningProjects,
      totalBudget,
      contractValue,
      averageProgress,
      latestUpdatedAt,
    };
  }, [projects]);

  const visibleProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = projects.filter((project) => {
      if (statusFilter !== "ALL" && project.status !== statusFilter) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return [
        project.name,
        project.code,
        project.clientName,
        project.location,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });

    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "progress":
          return (
            Number(b.physicalProgressPercentage) -
            Number(a.physicalProgressPercentage)
          );
        case "budget":
          return Number(b.approvedBudget) - Number(a.approvedBudget);
        case "finish":
          return a.plannedEndDate.localeCompare(b.plannedEndDate);
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [projects, query, statusFilter, sortKey]);

  function exportProjectsCsv() {
    const header = [
      "Code",
      "Name",
      "Client",
      "Location",
      "Status",
      "Approved budget (EUR)",
      "Contract value (EUR)",
      "Progress (%)",
      "Planned finish",
    ];

    const escape = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const rows = visibleProjects.map((project) => [
      project.code,
      project.name,
      project.clientName,
      project.location,
      statusLabels[project.status],
      project.approvedBudget,
      project.contractValue,
      Number(project.physicalProgressPercentage).toFixed(1),
      project.plannedEndDate,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(escape).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `buildsight-projects-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  function updateTextField(
    field: keyof CreateProjectInput,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function updateNumberField(
    field: "contractValue" | "approvedBudget",
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value === "" ? 0 : Number(value),
    }));

    setFieldErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function handleCreateProject(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setSubmitting(true);
    setFormError("");
    setFieldErrors({});

    try {
      const created = await createProject(form);

      setProjects((current) => [created, ...current]);

      setForm({
        ...initialForm,
        code: `BS-2026-${String(projects.length + 6).padStart(3, "0")}`,
      });

      setApiOnline(true);
      setShowCreatePanel(false);
    } catch (error) {
      if (error instanceof BuildSightApiError) {
        setFormError(error.message);
        setFieldErrors(error.fieldErrors);
      } else {
        setFormError(
          "BuildSight could not reach the local backend.",
        );
        setApiOnline(false);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`${styles.dashboard} app-shell buildsight-home`}>
      <BuildSightSidebar />

      <main className="main">
        <header className="topbar">
          <div className="page-heading-copy">
            <div className="eyebrow">
              CONSTRUCTION DELIVERY COMMAND CENTER
            </div>

            <h1>Portfolio overview</h1>

            <p className="page-subtitle">
              Monitor project health, budget, schedule and delivery
              exceptions across the portfolio.
            </p>
          </div>

          <div className="topbar-actions">
            <div
              aria-live="polite"
              role="status"
              className={
                apiOnline
                  ? "connection-pill online"
                  : "connection-pill offline"
              }
            >
              <span />
              {apiOnline ? "Backend online" : "Backend offline"}
            </div>

            <button
              className="primary-button"
              type="button"
              onClick={() =>
                setShowCreatePanel((current) => !current)
              }
            >
              <span className="button-plus">+</span>
              New project
            </button>
          </div>
        </header>

        {!apiOnline && (
          <div className="offline-banner">
            <div>
              <strong>Local backend is not reachable.</strong>
              <span>
                Start PostgreSQL and the Spring Boot service to load
                your project portfolio.
              </span>
            </div>
          </div>
        )}

        <section className="metric-grid">
          <article className="metric-card">
            <div className="metric-header">
              <span>PORTFOLIO VALUE</span>
              <div className="metric-symbol">€</div>
            </div>

            <div className="metric-value">
              {compactCurrency(metrics.contractValue)}
            </div>

            <div className="metric-footer">
              Across {projects.length} construction projects
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-header">
              <span>APPROVED BUDGET</span>
              <div className="metric-symbol">B</div>
            </div>

            <div className="metric-value">
              {compactCurrency(metrics.totalBudget)}
            </div>

            <div className="metric-footer">
              Current approved cost baseline
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-header">
              <span>ACTIVE PROJECTS</span>
              <div className="metric-symbol">A</div>
            </div>

            <div className="metric-value">
              {metrics.activeProjects}
            </div>

            <div className="metric-footer">
              {metrics.activeProjects} of {projects.length} projects currently active
            </div>
          </article>

          <article className="metric-card">
            <div className="metric-header">
              <span>AVG. PROGRESS</span>
              <div className="metric-symbol">%</div>
            </div>

            <div className="metric-value">
              {metrics.averageProgress.toFixed(1)}%
            </div>

            <div className="metric-footer">
              Portfolio physical completion
            </div>
          </article>
        </section>

        <section
          aria-label="Portfolio lifecycle summary"
          className="portfolio-pulse"
        >
          <div className="portfolio-pulse-copy">
            <div className="eyebrow">PORTFOLIO PULSE</div>

            <h2>Lifecycle distribution</h2>

            <p>
              Live project status across the portfolio.
            </p>
          </div>

          <div className="portfolio-pulse-grid">
            <div className="pulse-stat pulse-stat-warning">
              <span className="pulse-stat-label">ON HOLD</span>
              <strong>{metrics.onHoldProjects}</strong>
              <span className="pulse-stat-detail">
                Projects paused
              </span>
            </div>

            <div className="pulse-stat pulse-stat-info">
              <span className="pulse-stat-label">PLANNING</span>
              <strong>{metrics.planningProjects}</strong>
              <span className="pulse-stat-detail">
                Pre-delivery projects
              </span>
            </div>

            <div className="pulse-stat pulse-stat-positive">
              <span className="pulse-stat-label">ACTIVE</span>
              <strong>{metrics.activeProjects}</strong>
              <span className="pulse-stat-detail">
                Projects in delivery
              </span>
            </div>

            <div className="pulse-stat pulse-stat-neutral">
              <span className="pulse-stat-label">LATEST UPDATE</span>
              <strong className="pulse-update-value">
                {formatUpdatedAt(metrics.latestUpdatedAt)}
              </strong>
              <span className="pulse-stat-detail">
                Most recent project record
              </span>
            </div>
          </div>
        </section>

        <PortfolioInsights />

        {showCreatePanel && (
          <section className="create-panel">
            <div className="section-heading">
              <div>
                <div className="eyebrow">
                  PROJECT REGISTRATION
                </div>
                <h2>Create construction project</h2>
              </div>

              <button
                className="close-button"
                type="button"
                onClick={() => setShowCreatePanel(false)}
              >
                Close
              </button>
            </div>

            {formError && (
              <div className="form-error">{formError}</div>
            )}

            <form
              className="project-form"
              onSubmit={handleCreateProject}
            >
              <label>
                <span>Project code</span>
                <input
                  required
                  value={form.code}
                  onChange={(event) =>
                    updateTextField("code", event.target.value)
                  }
                />
                {fieldErrors.code && (
                  <small>{fieldErrors.code}</small>
                )}
              </label>

              <label className="field-wide">
                <span>Project name</span>
                <input
                  required
                  value={form.name}
                  placeholder="Example: Downtown Office Retrofit"
                  onChange={(event) =>
                    updateTextField("name", event.target.value)
                  }
                />
                {fieldErrors.name && (
                  <small>{fieldErrors.name}</small>
                )}
              </label>

              <label>
                <span>Client</span>
                <input
                  required
                  value={form.clientName}
                  placeholder="Client or asset owner"
                  onChange={(event) =>
                    updateTextField(
                      "clientName",
                      event.target.value,
                    )
                  }
                />
                {fieldErrors.clientName && (
                  <small>{fieldErrors.clientName}</small>
                )}
              </label>

              <label>
                <span>Location</span>
                <input
                  required
                  value={form.location}
                  placeholder="City, Country"
                  onChange={(event) =>
                    updateTextField(
                      "location",
                      event.target.value,
                    )
                  }
                />
                {fieldErrors.location && (
                  <small>{fieldErrors.location}</small>
                )}
              </label>

              <label>
                <span>Contract value (€)</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.contractValue}
                  onChange={(event) =>
                    updateNumberField(
                      "contractValue",
                      event.target.value,
                    )
                  }
                />
                {fieldErrors.contractValue && (
                  <small>{fieldErrors.contractValue}</small>
                )}
              </label>

              <label>
                <span>Approved budget (€)</span>
                <input
                  required
                  min="0"
                  step="0.01"
                  type="number"
                  value={form.approvedBudget}
                  onChange={(event) =>
                    updateNumberField(
                      "approvedBudget",
                      event.target.value,
                    )
                  }
                />
                {fieldErrors.approvedBudget && (
                  <small>{fieldErrors.approvedBudget}</small>
                )}
              </label>

              <label>
                <span>Planned start</span>
                <input
                  required
                  type="date"
                  value={form.plannedStartDate}
                  onChange={(event) =>
                    updateTextField(
                      "plannedStartDate",
                      event.target.value,
                    )
                  }
                />
                {fieldErrors.plannedStartDate && (
                  <small>{fieldErrors.plannedStartDate}</small>
                )}
              </label>

              <label>
                <span>Planned completion</span>
                <input
                  required
                  type="date"
                  value={form.plannedEndDate}
                  onChange={(event) =>
                    updateTextField(
                      "plannedEndDate",
                      event.target.value,
                    )
                  }
                />
                {fieldErrors.plannedEndDate && (
                  <small>{fieldErrors.plannedEndDate}</small>
                )}
              </label>

              <label className="field-full">
                <span>Description</span>
                <textarea
                  rows={4}
                  value={form.description}
                  placeholder="Describe the project scope..."
                  onChange={(event) =>
                    updateTextField(
                      "description",
                      event.target.value,
                    )
                  }
                />
                {fieldErrors.description && (
                  <small>{fieldErrors.description}</small>
                )}
              </label>

              <div className="form-actions field-full">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setShowCreatePanel(false)}
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting
                    ? "Creating project..."
                    : "Create project"}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="portfolio-section" id="projects">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                LIVE PROJECT PORTFOLIO
              </div>
              <h2>Construction projects</h2>

              <p className="section-support">
                Open a project to inspect delivery controls, current
                progress and project-level intelligence.
              </p>
            </div>

            <div className="project-count">
              {visibleProjects.length === projects.length
                ? `${projects.length} projects`
                : `${visibleProjects.length} of ${projects.length} projects`}
            </div>
          </div>

          <div className="portfolio-toolbar">
            <input
              aria-label="Search projects"
              className="portfolio-search"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name, code, client or location…"
              type="search"
              value={query}
            />

            <select
              aria-label="Filter by status"
              className="portfolio-select"
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "ALL" | ProjectStatus,
                )
              }
              value={statusFilter}
            >
              <option value="ALL">All statuses</option>
              {(Object.keys(statusLabels) as ProjectStatus[]).map(
                (status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ),
              )}
            </select>

            <select
              aria-label="Sort projects"
              className="portfolio-select"
              onChange={(event) =>
                setSortKey(
                  event.target.value as
                    | "name"
                    | "progress"
                    | "budget"
                    | "finish",
                )
              }
              value={sortKey}
            >
              <option value="name">Sort: Name</option>
              <option value="progress">Sort: Progress</option>
              <option value="budget">Sort: Budget</option>
              <option value="finish">Sort: Planned finish</option>
            </select>

            <button
              className="secondary-button"
              disabled={visibleProjects.length === 0}
              onClick={exportProjectsCsv}
              type="button"
            >
              Export CSV
            </button>
          </div>

          <div className="table-wrapper">
            <table className="project-table">
              <thead>
                <tr>
                  <th>PROJECT</th>
                  <th>CLIENT / LOCATION</th>
                  <th>STATUS</th>
                  <th>BUDGET</th>
                  <th>PROGRESS</th>
                  <th>PLANNED FINISH</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={6}>
                      <div className="table-message">
                        Loading local portfolio...
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && projects.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="table-message">
                        No projects yet. Create your first
                        construction project.
                      </div>
                    </td>
                  </tr>
                )}

                {!loading &&
                  projects.length > 0 &&
                  visibleProjects.length === 0 && (
                    <tr>
                      <td colSpan={6}>
                        <div className="table-message">
                          No projects match your filters.
                        </div>
                      </td>
                    </tr>
                  )}

                {!loading &&
                  visibleProjects.map((project) => (
                    <tr className="project-row" key={project.id}>
                      <td data-label="Project">
                        <Link
                          className="project-identity project-row-link"
                          href={`/projects/${project.id}`}
                        >
                          <div className="project-avatar">
                            {project.name.charAt(0).toUpperCase()}
                          </div>

                          <div className="project-row-copy">
                            <strong>{project.name}</strong>
                            <span>{project.code}</span>
                          </div>

                          <span
                            aria-hidden="true"
                            className="project-open-arrow"
                          >
                            ↗
                          </span>
                        </Link>
                      </td>

                      <td data-label="Client / location">
                        <div className="client-cell">
                          <strong>{project.clientName}</strong>
                          <span>{project.location}</span>
                        </div>
                      </td>

                      <td data-label="Status">
                        <span
                          className={statusClass(
                            project.status,
                          )}
                        >
                          {statusLabels[project.status]}
                        </span>
                      </td>

                      <td data-label="Budget">
                        <div className="budget-cell">
                          <strong>
                            {currency(project.approvedBudget)}
                          </strong>
                          <span>
                            Contract{" "}
                            {compactCurrency(
                              project.contractValue,
                            )}
                          </span>
                        </div>
                      </td>

                      <td data-label="Progress">
                        <div className="progress-cell">
                          <div className="progress-label">
                            <strong>
                              {Number(
                                project.physicalProgressPercentage,
                              ).toFixed(1)}
                              %
                            </strong>
                          </div>

                          <div className="progress-track">
                            <div
                              className="progress-value"
                              style={{
                                width: `${Math.min(
                                  100,
                                  Math.max(
                                    0,
                                    Number(
                                      project.physicalProgressPercentage,
                                    ),
                                  ),
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td data-label="Planned finish">
                        <div className="date-cell">
                          {formatDate(
                            project.plannedEndDate,
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="intelligence-preview intelligence-operational" id="intelligence">
          <div className="intelligence-copy">
            <div className="eyebrow">
              BUILDSIGHT INTELLIGENCE
            </div>

            <h2>Portfolio intelligence</h2>

            <p>
              Review the cost, schedule, health and project
              information that may require action.
            </p>

            <div className="intelligence-context">
              <span className="intelligence-context-dot" />

              <span>
                Built around the same live portfolio shown above.
              </span>
            </div>
          </div>

          <div className="intelligence-grid">
            <article className="intelligence-card">
              <span className="intelligence-index">01</span>

              <strong>Cost intelligence</strong>

              <p>
                Review budget, commitments, actuals and
                forward-looking cost signals.
              </p>

              <Link
                className="intelligence-card-link"
                href="/portfolio/forecast"
              >
                Open forecast control
                <span aria-hidden="true">↗</span>
              </Link>
            </article>

            <article className="intelligence-card">
              <span className="intelligence-index">02</span>

              <strong>Schedule intelligence</strong>

              <p>
                Inspect milestones, delay signals and critical-path
                pressure.
              </p>

              {projects.length > 0 ? (
                <details className="intelligence-project-picker">
                  <summary>
                    Choose a project
                  </summary>

                  <div className="intelligence-project-list">
                    {projects.map((project) => (
                      <Link
                        className="intelligence-project-option"
                        href={`/projects/${project.id}/schedule`}
                        key={project.id}
                      >
                        <span>{project.name}</span>
                        <small>{project.code}</small>
                      </Link>
                    ))}
                  </div>
                </details>
              ) : (
                <span className="intelligence-card-disabled">
                  Available after a project is created
                </span>
              )}
            </article>

            <article className="intelligence-card">
              <span className="intelligence-index">03</span>

              <strong>Project health</strong>

              <p>
                Compare portfolio health and inspect the factors
                affecting project scoring.
              </p>

              <Link
                className="intelligence-card-link"
                href="/portfolio"
              >
                Review portfolio health
                <span aria-hidden="true">↗</span>
              </Link>
            </article>

            <article className="intelligence-card">
              <span className="intelligence-index">04</span>

              <strong>Local AI</strong>

              <p>
                Ask questions across indexed project information
                and review cited answers.
              </p>

              {projects.length > 0 ? (
                <details className="intelligence-project-picker">
                  <summary>
                    Choose a project
                  </summary>

                  <div className="intelligence-project-list">
                    {projects.map((project) => (
                      <Link
                        className="intelligence-project-option"
                        href={`/projects/${project.id}/copilot`}
                        key={project.id}
                      >
                        <span>{project.name}</span>
                        <small>{project.code}</small>
                      </Link>
                    ))}
                  </div>
                </details>
              ) : (
                <span className="intelligence-card-disabled">
                  Available after a project is created
                </span>
              )}
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
