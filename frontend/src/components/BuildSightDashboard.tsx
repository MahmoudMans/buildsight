"use client";

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

function statusClass(status: ProjectStatus): string {
  return `status-badge status-${status.toLowerCase().replace("_", "-")}`;
}

export function BuildSightDashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(true);
  const [showCreatePanel, setShowCreatePanel] = useState(false);

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

    return {
      activeProjects,
      totalBudget,
      contractValue,
      averageProgress,
    };
  }, [projects]);

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
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">B</div>

          <div>
            <div className="brand-name">BuildSight</div>
            <div className="brand-subtitle">
              Construction Intelligence
            </div>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="navigation">
          <button className="nav-item active" type="button">
            <span className="nav-icon">01</span>
            Portfolio
          </button>

          <button className="nav-item" type="button">
            <span className="nav-icon">02</span>
            Projects
          </button>

          <button className="nav-item" type="button">
            <span className="nav-icon">03</span>
            Budgets
          </button>

          <button className="nav-item" type="button">
            <span className="nav-icon">04</span>
            Work packages
          </button>

          <button className="nav-item" type="button">
            <span className="nav-icon">05</span>
            Procurement
          </button>

          <button className="nav-item" type="button">
            <span className="nav-icon">06</span>
            Risks
          </button>

          <button className="nav-item" type="button">
            <span className="nav-icon">07</span>
            Documents
          </button>

          <button className="nav-item" type="button">
            <span className="nav-icon">08</span>
            Intelligence
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="local-card">
            <div className="local-card-top">
              <span className="local-dot" />
              LOCAL ENVIRONMENT
            </div>

            <strong>Private by design</strong>

            <p>
              PostgreSQL, object storage and AI remain on your
              machine.
            </p>
          </div>

          <div className="version">BuildSight v0.1.0</div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <div className="eyebrow">
              CONSTRUCTION DELIVERY COMMAND CENTER
            </div>
            <h1>Portfolio overview</h1>
          </div>

          <div className="topbar-actions">
            <div
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
              {projects.length} total projects in portfolio
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

        <section className="portfolio-section">
          <div className="section-heading">
            <div>
              <div className="eyebrow">
                LIVE PROJECT PORTFOLIO
              </div>
              <h2>Construction projects</h2>
            </div>

            <div className="project-count">
              {projects.length} projects
            </div>
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
                  projects.map((project) => (
                    <tr key={project.id}>
                      <td>
                        <div className="project-identity">
                          <div className="project-avatar">
                            {project.name.charAt(0).toUpperCase()}
                          </div>

                          <div>
                            <strong>{project.name}</strong>
                            <span>{project.code}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <div className="client-cell">
                          <strong>{project.clientName}</strong>
                          <span>{project.location}</span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={statusClass(
                            project.status,
                          )}
                        >
                          {statusLabels[project.status]}
                        </span>
                      </td>

                      <td>
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

                      <td>
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

                      <td>
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

        <section className="intelligence-preview">
          <div className="intelligence-copy">
            <div className="eyebrow">
              BUILDSIGHT INTELLIGENCE
            </div>

            <h2>
              From project tracking to construction intelligence.
            </h2>

            <p>
              This foundation is ready for cost variance,
              schedule-risk analysis, supplier intelligence,
              procurement risk, document search and locally
              generated project summaries.
            </p>
          </div>

          <div className="intelligence-grid">
            <div>
              <span>01</span>
              <strong>Cost Intelligence</strong>
              <p>Budget, commitments, actuals and forecasting.</p>
            </div>

            <div>
              <span>02</span>
              <strong>Schedule Intelligence</strong>
              <p>Delay signals, milestones and critical risks.</p>
            </div>

            <div>
              <span>03</span>
              <strong>Project Health</strong>
              <p>Explainable multidimensional project scoring.</p>
            </div>

            <div>
              <span>04</span>
              <strong>Local AI</strong>
              <p>Private document search and project summaries.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
