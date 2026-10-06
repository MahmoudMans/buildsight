"use client";

import Link from "next/link";
import { codeLabel } from "@/lib/labels";

import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";

import {
  approveControlBaseline,
  BuildSightApiError,
  captureControlBaseline,
  closeProgressPeriod,
  createProgressPeriod,
  getProjectPeriodControl,
} from "@/lib/api";

import type {
  CaptureBaselineInput,
  CreateProgressPeriodInput,
  PeriodControl,
  PeriodControlRiskLevel,
} from "@/types/project";

function currency(
  value: number | null,
): string {
  if (value === null) {
    return "—";
  }

  return new Intl.NumberFormat(
    "en-GB",
    {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    },
  ).format(
    value,
  );
}

function date(
  value: string | null,
): string {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    },
  ).format(
    new Date(
      `${value}T00:00:00`,
    ),
  );
}

function riskClass(
  risk: PeriodControlRiskLevel,
): string {
  return risk
    .toLowerCase()
    .replaceAll(
      "_",
      "-",
    );
}

const baselineDefaults: CaptureBaselineInput = {
  versionCode: "",
  title: "",
  reason: "",
  changeReference: "",
};

const periodDefaults: CreateProgressPeriodInput = {
  periodCode: "",
  title: "",
  startDate: "",
  endDate: "",
};

export function ProjectPeriodControlView({
  projectId,
}: {
  projectId: string;
}) {
  const [
    data,
    setData,
  ] =
    useState<PeriodControl | null>(
      null,
    );

  const [
    baselineForm,
    setBaselineForm,
  ] =
    useState(
      baselineDefaults,
    );

  const [
    periodForm,
    setPeriodForm,
  ] =
    useState(
      periodDefaults,
    );

  const [
    showBaselineForm,
    setShowBaselineForm,
  ] =
    useState(
      false,
    );

  const [
    showPeriodForm,
    setShowPeriodForm,
  ] =
    useState(
      false,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState(
      "",
    );

  useEffect(
    () => {
      let cancelled =
        false;

      getProjectPeriodControl(
        projectId,
      )
        .then(
          response => {
            if (!cancelled) {
              setData(
                response,
              );
            }
          },
        )
        .catch(
          (
            caught: unknown,
          ) => {
            if (!cancelled) {
              setError(
                caught instanceof
                  BuildSightApiError
                  ? caught.message
                  : "Unable to load period controls.",
              );
            }
          },
        )
        .finally(
          () => {
            if (!cancelled) {
              setLoading(
                false,
              );
            }
          },
        );

      return () => {
        cancelled =
          true;
      };
    },
    [projectId],
  );

  async function refresh() {
    setData(
      await getProjectPeriodControl(
        projectId,
      ),
    );
  }

  async function action(
    callback: () => Promise<unknown>,
  ) {
    setBusy(
      true,
    );

    setError(
      "",
    );

    try {
      await callback();
      await refresh();

      return true;

    } catch (
      caught
    ) {
      setError(
        caught instanceof
          BuildSightApiError
          ? caught.message
          : "Period-control operation failed.",
      );

      return false;

    } finally {
      setBusy(
        false,
      );
    }
  }

  async function submitBaseline(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await action(
        () =>
          captureControlBaseline(
            projectId,
            baselineForm,
          ),
      )
    ) {
      setBaselineForm(
        baselineDefaults,
      );

      setShowBaselineForm(
        false,
      );
    }
  }

  async function submitPeriod(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      await action(
        () =>
          createProgressPeriod(
            projectId,
            periodForm,
          ),
      )
    ) {
      setPeriodForm(
        periodDefaults,
      );

      setShowPeriodForm(
        false,
      );
    }
  }

  if (loading) {
    return (
      <main className="command-loading">
        <div className="loading-mark">
          B
        </div>

        <strong>
          Loading period controls...
        </strong>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="command-error-page">
        <div className="command-error-card">
          <div className="brand-mark">
            B
          </div>

          <h1>
            Period controls unavailable
          </h1>

          <p>
            {error}
          </p>
        </div>
      </main>
    );
  }

  const {
    project,
    intelligence,
    baselines,
    periods,
    openPeriodReadiness,
    snapshots,
  } = data;

  const openPeriod =
    periods.find(
      period =>
        period.status ===
        "OPEN",
    );

  return (
    <div className="period-shell">
      <aside className="period-sidebar">
        <Link
          href="/"
          className="command-brand"
        >
          <div className="brand-mark">
            B
          </div>

          <div>
            <strong>
              BuildSight
            </strong>

            <span>
              Construction Intelligence
            </span>
          </div>
        </Link>

        <div className="command-nav-label">
          PERIOD CONTROLS
        </div>

        <nav className="command-navigation">
          <Link
            href={`/projects/${projectId}`}
            className="command-nav-item"
          >
            01
            <span>
              Command center
            </span>
          </Link>

          <Link
            href={`/projects/${projectId}/forecast`}
            className="command-nav-item"
          >
            02
            <span>
              Forecast
            </span>
          </Link>

          <Link
            href={`/projects/${projectId}/governance`}
            className="command-nav-item"
          >
            03
            <span>
              Governance
            </span>
          </Link>

          <Link
            href={`/projects/${projectId}/recovery`}
            className="command-nav-item"
          >
            04
            <span>
              Recovery
            </span>
          </Link>

          <div className="command-nav-item active">
            05
            <span>
              Period control
            </span>
          </div>

          <a
            href="#baselines"
            className="command-nav-item"
          >
            06
            <span>
              Baselines
            </span>
          </a>

          <a
            href="#periods"
            className="command-nav-item"
          >
            07
            <span>
              Reporting periods
            </span>
          </a>

          <a
            href="#snapshots"
            className="command-nav-item"
          >
            08
            <span>
              Period snapshots
            </span>
          </a>

          <Link
            href="/portfolio/period-control"
            className="command-nav-item"
          >
            09
            <span>
              Portfolio periods
            </span>
          </Link>
        </nav>

        <div className="command-sidebar-footer">
          <span>
            PERIOD CONTROL
          </span>

          <strong>
            {intelligence.periodControlScore.toFixed(
              0,
            )}
            /100
          </strong>

          <small>
            Reporting overlay · Health v11 unchanged.
          </small>
        </div>
      </aside>

      <main className="period-main">
        <header className="period-header">
          <div>
            <Link
              href={`/projects/${projectId}`}
              className="back-link"
            >
              ← Project command center
            </Link>

            <div className="eyebrow">
              {project.code}
              {" · "}
              PERIOD-END CONTROLS
            </div>

            <h1>
              {project.name}
            </h1>

            <p>
              Version control baselines, manage
              progress periods, verify period-end
              readiness and preserve immutable
              reporting snapshots.
            </p>
          </div>

          <div className="period-score">
            <span>
              CONTROL SCORE
            </span>

            <strong>
              {intelligence.periodControlScore.toFixed(
                0,
              )}
              /100
            </strong>

            <i
              className={`period-risk period-risk-${riskClass(
                intelligence.periodControlRisk,
              )}`}
            >
              {intelligence.periodControlRisk.replaceAll(
                "_",
                " ",
              )}
            </i>
          </div>
        </header>

        <div className="period-architecture-note">
          <strong>
            Period-control architecture
          </strong>

          <span>
            Baselines and reporting snapshots
            reference the existing EVM, predictive,
            governance and recovery authorities.
            No duplicate cost or schedule ledger
            is created.
          </span>
        </div>

        {error && (
          <div className="command-alert">
            <strong>
              Operation not completed
            </strong>

            <span>
              {error}
            </span>
          </div>
        )}

        <section className="period-kpis">
          <Kpi
            label="CONTROL BASELINE"
            value={
              intelligence.activeBaselineVersionCode
              ?? "NOT SET"
            }
            detail={
              intelligence.baselineFinishTarget
                ? `Finish ${date(
                    intelligence.baselineFinishTarget,
                  )}`
                : "Capture and approve a baseline"
            }
            dark
          />

          <Kpi
            label="COST VARIANCE TO BASELINE"
            value={currency(
              intelligence.costVarianceToBaseline,
            )}
            detail={`Current EAC ${currency(
              intelligence.currentExpectedForecastCost,
            )}`}
          />

          <Kpi
            label="FINISH VARIANCE"
            value={`${intelligence.finishVarianceDays}d`}
            detail={date(
              intelligence.currentExpectedForecastFinishDate,
            )}
          />

          <Kpi
            label="OPEN PERIOD"
            value={
              intelligence.openPeriodCode
              ?? "NONE"
            }
            detail={
              intelligence.openPeriodEndDate
                ? `Ends ${date(
                    intelligence.openPeriodEndDate,
                  )}`
                : `${intelligence.closedPeriodCount} periods closed`
            }
          />
        </section>

        <section className="period-performance-strip">
          <Metric
            label="Planned progress"
            value={`${intelligence.plannedProgressPercentage.toFixed(
              1,
            )}%`}
          />

          <Metric
            label="Earned progress"
            value={`${intelligence.earnedProgressPercentage.toFixed(
              1,
            )}%`}
          />

          <Metric
            label="CPI"
            value={Number(
              intelligence.costPerformanceIndex,
            ).toFixed(
              2,
            )}
          />

          <Metric
            label="SPI"
            value={Number(
              intelligence.schedulePerformanceIndex,
            ).toFixed(
              2,
            )}
          />

          <Metric
            label="Predictive"
            value={`${intelligence.predictiveScore.toFixed(
              0,
            )} · ${codeLabel(intelligence.predictiveRisk)}`}
          />

          <Metric
            label="Governance"
            value={`${intelligence.governanceScore.toFixed(
              0,
            )} · ${codeLabel(intelligence.governanceRisk)}`}
          />

          <Metric
            label="Recovery"
            value={`${intelligence.recoveryScore.toFixed(
              0,
            )} · ${codeLabel(intelligence.recoveryRisk)}`}
          />
        </section>

        <section className="period-actions-toolbar">
          <button
            type="button"
            onClick={() =>
              setShowBaselineForm(
                !showBaselineForm,
              )
            }
          >
            + Capture baseline
          </button>

          <button
            type="button"
            disabled={
              !intelligence.activeBaselineVersionCode
              || Boolean(
                openPeriod,
              )
            }
            onClick={() =>
              setShowPeriodForm(
                !showPeriodForm,
              )
            }
          >
            + Open reporting period
          </button>
        </section>

        {showBaselineForm && (
          <section className="period-card">
            <SectionHeader
              eyebrow="CONTROL BASELINE"
              title="Capture current control position"
              value="Draft"
            />

            <form
              className="period-form"
              onSubmit={
                submitBaseline
              }
            >
              <Field label="Version code">
                <input
                  required
                  value={
                    baselineForm.versionCode
                  }
                  onChange={event =>
                    setBaselineForm({
                      ...baselineForm,
                      versionCode:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Change reference">
                <input
                  value={
                    baselineForm.changeReference
                  }
                  onChange={event =>
                    setBaselineForm({
                      ...baselineForm,
                      changeReference:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Title"
                full
              >
                <input
                  required
                  value={
                    baselineForm.title
                  }
                  onChange={event =>
                    setBaselineForm({
                      ...baselineForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field
                label="Reason / rebaseline rationale"
                full
              >
                <textarea
                  rows={3}
                  value={
                    baselineForm.reason
                  }
                  onChange={event =>
                    setBaselineForm({
                      ...baselineForm,
                      reason:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setShowBaselineForm(
                    false,
                  )
                }
              />
            </form>
          </section>
        )}

        {showPeriodForm && (
          <section className="period-card">
            <SectionHeader
              eyebrow="REPORTING PERIOD"
              title="Open progress period"
              value={
                intelligence.activeBaselineVersionCode
                ?? "No baseline"
              }
            />

            <form
              className="period-form"
              onSubmit={
                submitPeriod
              }
            >
              <Field label="Period code">
                <input
                  required
                  value={
                    periodForm.periodCode
                  }
                  onChange={event =>
                    setPeriodForm({
                      ...periodForm,
                      periodCode:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Title">
                <input
                  required
                  value={
                    periodForm.title
                  }
                  onChange={event =>
                    setPeriodForm({
                      ...periodForm,
                      title:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="Start date">
                <input
                  required
                  type="date"
                  value={
                    periodForm.startDate
                  }
                  onChange={event =>
                    setPeriodForm({
                      ...periodForm,
                      startDate:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <Field label="End date">
                <input
                  required
                  type="date"
                  value={
                    periodForm.endDate
                  }
                  onChange={event =>
                    setPeriodForm({
                      ...periodForm,
                      endDate:
                        event.target.value,
                    })
                  }
                />
              </Field>

              <FormActions
                busy={
                  busy
                }
                onCancel={() =>
                  setShowPeriodForm(
                    false,
                  )
                }
              />
            </form>
          </section>
        )}

        <section
          className="period-card"
          id="baselines"
        >
          <SectionHeader
            eyebrow="BASELINE VERSION CONTROL"
            title="Control baselines"
            value={`${baselines.length} versions`}
          />

          <div className="schedule-table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>VERSION</th>
                  <th>STATUS</th>
                  <th>DATA DATE</th>
                  <th>COST TARGET</th>
                  <th>FINISH TARGET</th>
                  <th>PREDICTIVE</th>
                  <th>CHANGE REF</th>
                  <th></th>
                </tr>
              </thead>

              <tbody>
                {baselines.map(
                  baseline => (
                    <tr
                      key={
                        baseline.id
                      }
                    >
                      <td>
                        <div className="schedule-name-cell">
                          <strong>
                            {
                              baseline.versionCode
                            }
                          </strong>

                          <span>
                            {
                              baseline.title
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {
                          baseline.status
                        }
                      </td>

                      <td>
                        {date(
                          baseline.sourceDataDate,
                        )}
                      </td>

                      <td>
                        {currency(
                          baseline.costTarget,
                        )}
                      </td>

                      <td>
                        {date(
                          baseline.finishTarget,
                        )}
                      </td>

                      <td>
                        {Number(
                          baseline.capturedPredictiveScore,
                        ).toFixed(
                          0,
                        )}
                      </td>

                      <td>
                        {baseline.changeReference
                          ?? "—"}
                      </td>

                      <td>
                        {baseline.status ===
                          "DRAFT" && (
                          <button
                            type="button"
                            className="period-table-button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void action(
                                () =>
                                  approveControlBaseline(
                                    projectId,
                                    baseline.id,
                                  ),
                              )
                            }
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  ),
                )}

                {baselines.length ===
                  0 && (
                  <tr>
                    <td colSpan={8}>
                      <div className="table-message">
                        No control baseline has been captured.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="period-card"
          id="periods"
        >
          <SectionHeader
            eyebrow="PROGRESS PERIODS"
            title="Reporting calendar"
            value={`${periods.length} periods`}
          />

          {openPeriodReadiness && (
            <div className="period-readiness">
              <div>
                <span>
                  PERIOD-END READINESS
                </span>

                <strong>
                  {openPeriodReadiness.canClose
                    ? "READY TO CLOSE"
                    : "NOT READY"}
                </strong>
              </div>

              <div>
                <span>
                  BLOCKERS
                </span>

                <strong>
                  {
                    openPeriodReadiness.blockers.length
                  }
                </strong>
              </div>

              <div>
                <span>
                  WARNINGS
                </span>

                <strong>
                  {
                    openPeriodReadiness.warnings.length
                  }
                </strong>
              </div>

              {openPeriod
                && openPeriodReadiness.canClose && (
                <button
                  type="button"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    void action(
                      () =>
                        closeProgressPeriod(
                          projectId,
                          openPeriod.id,
                        ),
                    )
                  }
                >
                  Close period & capture snapshot
                </button>
              )}
            </div>
          )}

          {openPeriodReadiness
            && (
              openPeriodReadiness.blockers.length >
                0
              || openPeriodReadiness.warnings.length >
                0
            ) && (
            <div className="period-readiness-notes">
              {openPeriodReadiness.blockers.map(
                blocker => (
                  <div
                    key={
                      `b-${blocker}`
                    }
                    className="period-blocker"
                  >
                    Blocker · {blocker}
                  </div>
                ),
              )}

              {openPeriodReadiness.warnings.map(
                warning => (
                  <div
                    key={
                      `w-${warning}`
                    }
                    className="period-warning"
                  >
                    Warning · {warning}
                  </div>
                ),
              )}
            </div>
          )}

          <div className="schedule-table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>PERIOD</th>
                  <th>BASELINE</th>
                  <th>START</th>
                  <th>END</th>
                  <th>STATUS</th>
                  <th>CLOSED</th>
                </tr>
              </thead>

              <tbody>
                {periods.map(
                  period => (
                    <tr
                      key={
                        period.id
                      }
                    >
                      <td>
                        <div className="schedule-name-cell">
                          <strong>
                            {
                              period.periodCode
                            }
                          </strong>

                          <span>
                            {
                              period.title
                            }
                          </span>
                        </div>
                      </td>

                      <td>
                        {
                          period.baselineVersionCode
                        }
                      </td>

                      <td>
                        {date(
                          period.startDate,
                        )}
                      </td>

                      <td>
                        {date(
                          period.endDate,
                        )}
                      </td>

                      <td>
                        {
                          period.status
                        }
                      </td>

                      <td>
                        {period.closedAt
                          ? new Intl.DateTimeFormat(
                              "en-GB",
                              {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              },
                            ).format(
                              new Date(
                                period.closedAt,
                              ),
                            )
                          : "—"}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section
          className="period-card"
          id="snapshots"
        >
          <SectionHeader
            eyebrow="PERIOD-END HISTORY"
            title="Immutable reporting snapshots"
            value={`${snapshots.length} snapshots`}
          />

          <div className="schedule-table-wrapper">
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>PERIOD</th>
                  <th>PLAN</th>
                  <th>EARNED</th>
                  <th>CPI</th>
                  <th>SPI</th>
                  <th>COST VARIANCE</th>
                  <th>FINISH VAR</th>
                  <th>SCORE</th>
                  <th>RISK</th>
                </tr>
              </thead>

              <tbody>
                {snapshots.map(
                  snapshot => (
                    <tr
                      key={
                        snapshot.id
                      }
                    >
                      <td>
                        <strong>
                          {
                            snapshot.periodCode
                          }
                        </strong>
                      </td>

                      <td>
                        {Number(
                          snapshot.plannedProgressPercentage,
                        ).toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {Number(
                          snapshot.earnedProgressPercentage,
                        ).toFixed(
                          1,
                        )}
                        %
                      </td>

                      <td>
                        {Number(
                          snapshot.costPerformanceIndex,
                        ).toFixed(
                          2,
                        )}
                      </td>

                      <td>
                        {Number(
                          snapshot.schedulePerformanceIndex,
                        ).toFixed(
                          2,
                        )}
                      </td>

                      <td>
                        {currency(
                          snapshot.costVarianceToBaseline,
                        )}
                      </td>

                      <td>
                        {
                          snapshot.finishVarianceDays
                        }
                        d
                      </td>

                      <td>
                        {Number(
                          snapshot.periodControlScore,
                        ).toFixed(
                          0,
                        )}
                      </td>

                      <td>
                        {
                          codeLabel(snapshot.periodControlRisk)
                        }
                      </td>
                    </tr>
                  ),
                )}

                {snapshots.length ===
                  0 && (
                  <tr>
                    <td colSpan={9}>
                      <div className="table-message">
                        No period-end snapshots have been captured yet.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <footer className="command-footer">
          <div>
            BuildSight · Period-End Controls
          </div>

          <div>
            Health v11
            {" · "}
            Period Control{" "}
            {intelligence.periodControlScore.toFixed(
              0,
            )}
            /100
          </div>
        </footer>
      </main>
    </div>
  );
}

function Kpi({
  label,
  value,
  detail,
  dark = false,
}: {
  label: string;
  value: string;
  detail: string;
  dark?: boolean;
}) {
  return (
    <article
      className={
        dark
          ? "period-kpi period-kpi-dark"
          : "period-kpi"
      }
    >
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {detail}
      </small>
    </article>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="period-metric">
      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  value,
}: {
  eyebrow: string;
  title: string;
  value: string;
}) {
  return (
    <div className="period-card-header">
      <div>
        <div className="eyebrow">
          {eyebrow}
        </div>

        <h2>
          {title}
        </h2>
      </div>

      <strong>
        {value}
      </strong>
    </div>
  );
}

function Field({
  label,
  full = false,
  children,
}: {
  label: string;
  full?: boolean;
  children: ReactNode;
}) {
  return (
    <label
      className={
        full
          ? "field-full"
          : ""
      }
    >
      <span>
        {label}
      </span>

      {children}
    </label>
  );
}

function FormActions({
  busy,
  onCancel,
}: {
  busy: boolean;
  onCancel: () => void;
}) {
  return (
    <div className="form-actions field-full">
      <button
        type="button"
        className="secondary-button"
        onClick={
          onCancel
        }
      >
        Cancel
      </button>

      <button
        type="submit"
        className="primary-button"
        disabled={
          busy
        }
      >
        {busy
          ? "Saving..."
          : "Save"}
      </button>
    </div>
  );
}
