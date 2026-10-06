"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectCostControl } from "@/lib/api";
import type {
  ActualCost,
  BudgetLine,
  Commitment,
  CommitmentStatus,
  CostCode,
  CostCodeCategory,
  CostControl,
  CostRiskLevel,
} from "@/types/project";

import styles from "./ProjectCostBreakdownView.module.css";

const CATEGORY_LABEL: Record<CostCodeCategory, string> = {
  PRELIMINARIES: "Preliminaries",
  STRUCTURE: "Structure",
  ARCHITECTURAL: "Architectural",
  MEP: "MEP",
  EXTERNAL_WORKS: "External works",
  PROFESSIONAL_FEES: "Professional fees",
  CONTINGENCY: "Contingency",
  OTHER: "Other",
};

const RISK_LABEL: Record<CostRiskLevel, string> = {
  NO_BASELINE: "No baseline",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<CostRiskLevel, string> = {
  NO_BASELINE: styles.riskNone,
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const COMMITMENT_LABEL: Record<CommitmentStatus, string> = {
  DRAFT: "Draft",
  APPROVED: "Approved",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

interface CodeRow {
  code: CostCode;
  original: number;
  revised: number;
  forecast: number;
  committed: number;
  actual: number;
  variance: number;
  lines: BudgetLine[];
  commitments: Commitment[];
  actuals: ActualCost[];
}

interface CategoryRow {
  category: CostCodeCategory;
  codes: CodeRow[];
  revised: number;
  forecast: number;
  committed: number;
  actual: number;
  variance: number;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const id = key(item);
    const list = map.get(id);

    if (list) {
      list.push(item);
    } else {
      map.set(id, [item]);
    }
  }

  return map;
}

function toggle(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);

  if (next.has(key)) {
    next.delete(key);
  } else {
    next.add(key);
  }

  return next;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function moneyFull(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function signedFull(value: number): string {
  if (Math.abs(value) < 0.5) {
    return "—";
  }

  return `${value > 0 ? "+" : "−"}${moneyFull(Math.abs(value))}`;
}

function varianceClass(value: number): string {
  return value < -0.5 ? styles.neg : value > 0.5 ? styles.pos : "";
}

function formatDate(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function unbudgeted(row: CodeRow): boolean {
  return row.revised === 0 && (row.actual > 0 || row.committed > 0);
}

function needsAttention(row: CodeRow): boolean {
  return row.variance < -0.5 || unbudgeted(row);
}

function CostBar({
  actual,
  committed,
  forecast,
  revised,
  scale,
}: {
  actual: number;
  committed: number;
  forecast: number;
  revised: number;
  scale: number;
}) {
  const pct = (value: number) =>
    scale > 0 ? Math.min(100, Math.max(0, (value / scale) * 100)) : 0;

  return (
    <div
      aria-label={`Budget ${money(revised)}, approved commitments ${money(
        committed,
      )}, actual ${money(actual)}, forecast ${money(forecast)}`}
      className={styles.bar}
      role="img"
    >
      <div className={styles.barBudget} style={{ width: `${pct(revised)}%` }} />

      <div
        className={styles.barCommitted}
        style={{ width: `${pct(committed)}%` }}
      />

      <div className={styles.barActual} style={{ width: `${pct(actual)}%` }} />

      {forecast > 0 && (
        <span
          className={forecast > revised ? styles.tickOver : styles.tick}
          style={{ left: `${pct(forecast)}%` }}
        />
      )}
    </div>
  );
}

function Detail({ row }: { row: CodeRow }) {
  const commitments = [...row.commitments].sort((a, b) =>
    b.commitmentDate.localeCompare(a.commitmentDate),
  );

  const actuals = [...row.actuals].sort((a, b) =>
    b.costDate.localeCompare(a.costDate),
  );

  return (
    <div className={styles.detail}>
      <section>
        <h4>Budget lines ({row.lines.length})</h4>

        {row.lines.length === 0 ? (
          <p className={styles.none}>No budget lines for this cost code.</p>
        ) : (
          <table className={styles.sub}>
            <thead>
              <tr>
                <th>DESCRIPTION</th>
                <th>ORIGINAL</th>
                <th>CHANGES</th>
                <th>REVISED</th>
                <th>FORECAST</th>
                <th>VARIANCE</th>
              </tr>
            </thead>

            <tbody>
              {row.lines.map((line) => {
                const variance =
                  Number(line.revisedBudget) - Number(line.forecastCost);

                return (
                  <tr key={line.id}>
                    <td>{line.description || "—"}</td>
                    <td>{moneyFull(Number(line.originalBudget))}</td>
                    <td>{signedFull(Number(line.approvedChanges))}</td>
                    <td>{moneyFull(Number(line.revisedBudget))}</td>
                    <td>{moneyFull(Number(line.forecastCost))}</td>
                    <td className={varianceClass(variance)}>
                      {signedFull(variance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h4>Commitments ({commitments.length})</h4>

        {commitments.length === 0 ? (
          <p className={styles.none}>No commitments against this cost code.</p>
        ) : (
          <table className={styles.sub}>
            <thead>
              <tr>
                <th>REFERENCE</th>
                <th>VENDOR</th>
                <th>STATUS</th>
                <th>DATE</th>
                <th>AMOUNT</th>
              </tr>
            </thead>

            <tbody>
              {commitments.map((commitment) => (
                <tr key={commitment.id}>
                  <td>{commitment.reference}</td>
                  <td>{commitment.vendorName}</td>
                  <td>{COMMITMENT_LABEL[commitment.status]}</td>
                  <td>{formatDate(commitment.commitmentDate)}</td>
                  <td>{moneyFull(Number(commitment.committedAmount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section>
        <h4>Actual costs ({actuals.length})</h4>

        {actuals.length === 0 ? (
          <p className={styles.none}>No actual costs recorded yet.</p>
        ) : (
          <table className={styles.sub}>
            <thead>
              <tr>
                <th>DATE</th>
                <th>REFERENCE</th>
                <th>SUPPLIER</th>
                <th>COMMITMENT</th>
                <th>AMOUNT</th>
              </tr>
            </thead>

            <tbody>
              {actuals.map((cost) => (
                <tr key={cost.id}>
                  <td>{formatDate(cost.costDate)}</td>
                  <td>{cost.reference}</td>
                  <td>{cost.supplierName}</td>
                  <td>{cost.commitmentReference ?? "—"}</td>
                  <td>{moneyFull(Number(cost.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

export function ProjectCostBreakdownView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<CostControl | null>(null);
  const [error, setError] = useState("");
  const [openCategories, setOpenCategories] = useState<Set<string>>(new Set());
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set());
  const [attention, setAttention] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectCostControl(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError(
              "Could not load cost data. Check that the backend is running.",
            );
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const model = useMemo(() => {
    if (!data) {
      return null;
    }

    const lines = groupBy(data.budgetLines, (line) => line.costCodeId);
    const commitments = groupBy(data.commitments, (item) => item.costCodeId);
    const actuals = groupBy(data.actualCosts, (item) => item.costCodeId);

    const codes: CodeRow[] = data.costCodes.map((code) => {
      const codeLines = lines.get(code.id) ?? [];
      const codeCommitments = commitments.get(code.id) ?? [];
      const codeActuals = actuals.get(code.id) ?? [];

      const revised = sum(codeLines.map((line) => Number(line.revisedBudget)));
      const forecast = sum(codeLines.map((line) => Number(line.forecastCost)));

      return {
        code,
        original: sum(codeLines.map((line) => Number(line.originalBudget))),
        revised,
        forecast,
        committed: sum(
          codeCommitments
            .filter((item) => item.status === "APPROVED")
            .map((item) => Number(item.committedAmount)),
        ),
        actual: sum(codeActuals.map((item) => Number(item.amount))),
        variance: revised - forecast,
        lines: codeLines,
        commitments: codeCommitments,
        actuals: codeActuals,
      };
    });

    const byCategory = groupBy(codes, (row) => row.code.category);

    const categories: CategoryRow[] = Array.from(byCategory.entries())
      .map(([category, rows]) => {
        const sorted = [...rows].sort(
          (a, b) =>
            a.code.sortOrder - b.code.sortOrder ||
            a.code.code.localeCompare(b.code.code),
        );

        const revised = sum(sorted.map((row) => row.revised));
        const forecast = sum(sorted.map((row) => row.forecast));

        return {
          category: category as CostCodeCategory,
          codes: sorted,
          revised,
          forecast,
          committed: sum(sorted.map((row) => row.committed)),
          actual: sum(sorted.map((row) => row.actual)),
          variance: revised - forecast,
        };
      })
      .sort((a, b) => b.revised - a.revised);

    return { categories, codes };
  }, [data]);

  const categoryScale = useMemo(
    () =>
      Math.max(
        0,
        ...(model?.categories ?? []).map((category) =>
          Math.max(
            category.revised,
            category.forecast,
            category.actual,
            category.committed,
          ),
        ),
      ),
    [model],
  );

  const overruns = useMemo(
    () =>
      (model?.codes ?? [])
        .filter((row) => row.variance < -0.5)
        .sort((a, b) => a.variance - b.variance)
        .slice(0, 5),
    [model],
  );

  const unbudgetedRows = useMemo(
    () => (model?.codes ?? []).filter(unbudgeted),
    [model],
  );

  const shown = useMemo(
    () =>
      (model?.categories ?? [])
        .map((category) => ({
          category,
          codes: attention
            ? category.codes.filter(needsAttention)
            : category.codes,
        }))
        .filter((entry) => entry.codes.length > 0),
    [model, attention],
  );

  function reveal(row: CodeRow) {
    setOpenCategories((current) => new Set(current).add(row.code.category));
    setOpenCodes((current) => new Set(current).add(row.code.id));

    window.setTimeout(() => {
      document
        .getElementById(`code-${row.code.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }

  function exportCsv() {
    if (!model || !data) {
      return;
    }

    const header = [
      "Category",
      "Cost code",
      "Name",
      "Original budget (EUR)",
      "Revised budget (EUR)",
      "Approved commitments (EUR)",
      "Actual cost (EUR)",
      "Forecast (EUR)",
      "Variance (EUR)",
    ];

    const escape = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`;

    const rows = model.categories.flatMap((category) =>
      category.codes.map((row) => [
        CATEGORY_LABEL[category.category],
        row.code.code,
        row.code.name,
        row.original,
        row.revised,
        row.committed,
        row.actual,
        row.forecast,
        row.variance,
      ]),
    );

    const csv = [header, ...rows]
      .map((row) => row.map(escape).join(","))
      .join("\n");

    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `${data.project.code}-cost-breakdown-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  const intel = data?.intelligence;

  const totals = model
    ? {
        revised: sum(model.categories.map((row) => row.revised)),
        forecast: sum(model.categories.map((row) => row.forecast)),
        committed: sum(model.categories.map((row) => row.committed)),
        actual: sum(model.categories.map((row) => row.actual)),
      }
    : null;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">COST BREAKDOWN</div>

            <h1>{data ? data.project.name : "Cost breakdown"}</h1>

            <p className={styles.subtitle}>
              Drill down from cost category to cost code to the budget lines,
              commitments and actual costs behind each number. Variance is
              revised budget minus forecast, so a negative value is an
              overrun.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              className="secondary-button"
              disabled={!model}
              onClick={exportCsv}
              type="button"
            >
              Export CSV
            </button>

            <Link className="secondary-link-button" href={`${base}/costs`}>
              Open cost control
            </Link>
          </div>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && (
          <div className={styles.loading}>Loading cost breakdown…</div>
        )}

        {data && intel && model && totals && (
          <>
            <section aria-label="Cost summary" className={styles.kpis}>
              <article className={`${styles.kpi} ${styles.kpiDark}`}>
                <div className={styles.kpiLabel}>COST SCORE</div>
                <div className={styles.kpiValue}>
                  {Math.round(intel.costScore)}
                </div>
                <div className={styles.kpiSub}>
                  <span
                    className={`${styles.pill} ${RISK_CLASS[intel.costRisk]}`}
                  >
                    {RISK_LABEL[intel.costRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>REVISED COST PLAN</div>
                <div className={styles.kpiValue}>
                  {money(Number(intel.revisedCostPlan))}
                </div>
                <div className={styles.kpiSub}>
                  Approved budget {money(Number(intel.projectApprovedBudget))}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST AT COMPLETION</div>
                <div className={styles.kpiValue}>
                  {money(Number(intel.forecastAtCompletion))}
                </div>
                <div
                  className={`${styles.kpiSub} ${varianceClass(
                    Number(intel.revisedCostPlan) -
                      Number(intel.forecastAtCompletion),
                  )}`}
                >
                  vs plan{" "}
                  {signedFull(
                    Number(intel.revisedCostPlan) -
                      Number(intel.forecastAtCompletion),
                  )}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ACTUAL COSTS</div>
                <div className={styles.kpiValue}>
                  {money(Number(intel.actualCosts))}
                </div>
                <div className={styles.kpiSub}>
                  {Number(intel.revisedCostPlan) > 0
                    ? `${Math.round(
                        (Number(intel.actualCosts) /
                          Number(intel.revisedCostPlan)) *
                          100,
                      )}% of plan spent`
                    : "No cost plan yet"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COMMITMENTS</div>
                <div className={styles.kpiValue}>
                  {money(Number(intel.totalApprovedCommitments))}
                </div>
                <div className={styles.kpiSub}>
                  Outstanding {money(Number(intel.outstandingCommitments))}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>UNALLOCATED BUDGET</div>
                <div className={styles.kpiValue}>
                  {money(Number(intel.unallocatedBudget))}
                </div>
                <div className={styles.kpiSub}>Not yet in the cost plan</div>
              </article>
            </section>

            {(overruns.length > 0 || unbudgetedRows.length > 0) && (
              <section className={styles.attention}>
                {overruns.length > 0 && (
                  <div className={styles.attentionBlock}>
                    <div className="eyebrow">LARGEST FORECAST OVERRUNS</div>

                    <ul>
                      {overruns.map((row) => (
                        <li key={row.code.id}>
                          <button onClick={() => reveal(row)} type="button">
                            <span>
                              <b>{row.code.code}</b> {row.code.name}
                            </span>

                            <strong className={styles.neg}>
                              {signedFull(row.variance)}
                            </strong>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {unbudgetedRows.length > 0 && (
                  <div className={styles.attentionBlock}>
                    <div className="eyebrow">SPEND WITHOUT A BUDGET</div>

                    <ul>
                      {unbudgetedRows.slice(0, 5).map((row) => (
                        <li key={row.code.id}>
                          <button onClick={() => reveal(row)} type="button">
                            <span>
                              <b>{row.code.code}</b> {row.code.name}
                            </span>

                            <strong>
                              {money(Math.max(row.actual, row.committed))}
                            </strong>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            <section className={styles.panel}>
              <div className={styles.toolbar}>
                <div className={styles.legend}>
                  <span>
                    <i className={styles.swBudget} />
                    Revised budget
                  </span>
                  <span>
                    <i className={styles.swCommitted} />
                    Approved commitments
                  </span>
                  <span>
                    <i className={styles.swActual} />
                    Actual cost
                  </span>
                  <span>
                    <i className={styles.swTick} />
                    Forecast
                  </span>
                </div>

                <div className={styles.controls}>
                  <label className={styles.check}>
                    <input
                      checked={attention}
                      onChange={(event) => setAttention(event.target.checked)}
                      type="checkbox"
                    />
                    Needs attention only
                  </label>

                  <button
                    className={styles.link}
                    onClick={() =>
                      setOpenCategories(
                        new Set(model.categories.map((row) => row.category)),
                      )
                    }
                    type="button"
                  >
                    Expand all
                  </button>

                  <button
                    className={styles.link}
                    onClick={() => {
                      setOpenCategories(new Set());
                      setOpenCodes(new Set());
                    }}
                    type="button"
                  >
                    Collapse all
                  </button>
                </div>
              </div>

              {shown.length === 0 ? (
                <div className={styles.empty}>
                  {model.codes.length === 0
                    ? "No cost codes yet. Add cost codes and budget lines in cost control."
                    : "No cost codes need attention. Everything is within forecast."}
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>COST CATEGORY / CODE</th>
                        <th className={styles.barCol}>PLAN VS SPEND</th>
                        <th className={styles.num}>BUDGET</th>
                        <th className={styles.num}>COMMITTED</th>
                        <th className={styles.num}>ACTUAL</th>
                        <th className={styles.num}>FORECAST</th>
                        <th className={styles.num}>VARIANCE</th>
                      </tr>
                    </thead>

                    {shown.map(({ category, codes }) => {
                      const isOpen =
                        attention || openCategories.has(category.category);

                      const codeScale = Math.max(
                        0,
                        ...category.codes.map((row) =>
                          Math.max(
                            row.revised,
                            row.forecast,
                            row.actual,
                            row.committed,
                          ),
                        ),
                      );

                      return (
                        <tbody key={category.category}>
                          <tr className={styles.catRow}>
                            <td>
                              <button
                                aria-expanded={isOpen}
                                className={styles.toggle}
                                onClick={() =>
                                  setOpenCategories((current) =>
                                    toggle(current, category.category),
                                  )
                                }
                                type="button"
                              >
                                <span
                                  aria-hidden="true"
                                  className={`${styles.chev} ${
                                    isOpen ? styles.chevOpen : ""
                                  }`}
                                >
                                  ›
                                </span>

                                <strong>
                                  {CATEGORY_LABEL[category.category]}
                                </strong>

                                <small>
                                  {category.codes.length} cost code
                                  {category.codes.length === 1 ? "" : "s"}
                                </small>
                              </button>
                            </td>

                            <td className={styles.barCol}>
                              <CostBar
                                actual={category.actual}
                                committed={category.committed}
                                forecast={category.forecast}
                                revised={category.revised}
                                scale={categoryScale}
                              />
                            </td>

                            <td className={styles.num}>
                              {moneyFull(category.revised)}
                            </td>
                            <td className={styles.num}>
                              {moneyFull(category.committed)}
                            </td>
                            <td className={styles.num}>
                              {moneyFull(category.actual)}
                            </td>
                            <td className={styles.num}>
                              {moneyFull(category.forecast)}
                            </td>
                            <td
                              className={`${styles.num} ${varianceClass(
                                category.variance,
                              )}`}
                            >
                              {signedFull(category.variance)}
                            </td>
                          </tr>

                          {isOpen &&
                            codes.map((row) => {
                              const codeOpen = openCodes.has(row.code.id);

                              return (
                                <Fragment key={row.code.id}>
                                  <tr
                                    className={styles.codeRow}
                                    id={`code-${row.code.id}`}
                                  >
                                    <td>
                                      <button
                                        aria-expanded={codeOpen}
                                        className={`${styles.toggle} ${styles.codeToggle}`}
                                        onClick={() =>
                                          setOpenCodes((current) =>
                                            toggle(current, row.code.id),
                                          )
                                        }
                                        type="button"
                                      >
                                        <span
                                          aria-hidden="true"
                                          className={`${styles.chev} ${
                                            codeOpen ? styles.chevOpen : ""
                                          }`}
                                        >
                                          ›
                                        </span>

                                        <span className={styles.codeNo}>
                                          {row.code.code}
                                        </span>

                                        <span>{row.code.name}</span>

                                        {unbudgeted(row) && (
                                          <em className={styles.flag}>
                                            NO BUDGET
                                          </em>
                                        )}
                                      </button>
                                    </td>

                                    <td className={styles.barCol}>
                                      <CostBar
                                        actual={row.actual}
                                        committed={row.committed}
                                        forecast={row.forecast}
                                        revised={row.revised}
                                        scale={codeScale}
                                      />
                                    </td>

                                    <td className={styles.num}>
                                      {moneyFull(row.revised)}
                                    </td>
                                    <td className={styles.num}>
                                      {moneyFull(row.committed)}
                                    </td>
                                    <td className={styles.num}>
                                      {moneyFull(row.actual)}
                                    </td>
                                    <td className={styles.num}>
                                      {moneyFull(row.forecast)}
                                    </td>
                                    <td
                                      className={`${styles.num} ${varianceClass(
                                        row.variance,
                                      )}`}
                                    >
                                      {signedFull(row.variance)}
                                    </td>
                                  </tr>

                                  {codeOpen && (
                                    <tr className={styles.detailRow}>
                                      <td colSpan={7}>
                                        <Detail row={row} />
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}
                        </tbody>
                      );
                    })}

                    <tfoot>
                      <tr>
                        <td>Total (cost plan lines)</td>
                        <td className={styles.barCol} />
                        <td className={styles.num}>
                          {moneyFull(totals.revised)}
                        </td>
                        <td className={styles.num}>
                          {moneyFull(totals.committed)}
                        </td>
                        <td className={styles.num}>
                          {moneyFull(totals.actual)}
                        </td>
                        <td className={styles.num}>
                          {moneyFull(totals.forecast)}
                        </td>
                        <td
                          className={`${styles.num} ${varianceClass(
                            totals.revised - totals.forecast,
                          )}`}
                        >
                          {signedFull(totals.revised - totals.forecast)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            <p className={styles.note}>
              Committed counts approved commitments only. {intel.explanation}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
