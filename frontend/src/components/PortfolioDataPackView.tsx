"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  getPortfolioExecutive,
  getPortfolioForecast,
  getPortfolioGovernance,
  getPortfolioPeriodControl,
  getPortfolioRecovery,
} from "@/lib/api";
import {
  type CsvDelimiter,
  type CsvRow,
  columnsOf,
  downloadCsv,
  downloadZip,
  flattenRecord,
  preferredDelimiter,
  recordsToCsv,
  rememberDelimiter,
  todayStamp,
  toCsv,
} from "@/lib/csvExport";
import type {
  PortfolioExecutive,
  PortfolioForecast,
  PortfolioForecastProject,
  PortfolioGovernance,
  PortfolioGovernanceProject,
  PortfolioPeriodControl,
  PortfolioPeriodControlProject,
  PortfolioProjectSnapshot,
  PortfolioRecovery,
  PortfolioRecoveryProject,
} from "@/types/project";

import styles from "./PortfolioDataPackView.module.css";

const PREVIEW_ROWS = 200;

type SourceKey = "executive" | "forecast" | "governance" | "recovery" | "period";

const SOURCE_LABEL: Record<SourceKey, string> = {
  executive: "portfolio health",
  forecast: "forecast",
  governance: "governance",
  recovery: "recovery",
  period: "period control",
};

interface Sources {
  executive: PortfolioExecutive | null;
  forecast: PortfolioForecast | null;
  governance: PortfolioGovernance | null;
  recovery: PortfolioRecovery | null;
  period: PortfolioPeriodControl | null;
}

interface Dataset {
  key: string;
  label: string;
  note: string;
  rows: ReadonlyArray<object>;
  table?: { rows: CsvRow[]; columns: string[] };
}

interface Group {
  key: string;
  label: string;
  datasets: Dataset[];
}

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function num(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

const MATRIX_COLUMNS = [
  "Code",
  "Name",
  "Status",
  "Health score",
  "Health band",
  "Cost score",
  "Procurement score",
  "Risk score",
  "Production score",
  "Information score",
  "Safety score",
  "Commercial score",
  "Resource score",
  "Budget",
  "Forecast cost",
  "Variance at completion",
  "CPI",
  "SPI",
  "Finish variance (days)",
  "Predictive score",
  "Predictive risk",
  "Forecast trend",
  "Governance score",
  "Governance risk",
  "Overdue actions",
  "Overdue decisions",
  "Recovery simulations",
  "Change cost exposure",
  "Schedule impact (days)",
  "Recovery score",
  "Recovery risk",
  "Active baseline",
  "Cost vs baseline",
  "Finish vs baseline (days)",
  "Period control score",
  "Period control risk",
];

function buildMatrix(sources: Sources): CsvRow[] {
  const ids = new Map<string, string>();
  const snapshots = new Map<string, PortfolioProjectSnapshot>();
  const forecasts = new Map<string, PortfolioForecastProject>();
  const governance = new Map<string, PortfolioGovernanceProject>();
  const recovery = new Map<string, PortfolioRecoveryProject>();
  const period = new Map<string, PortfolioPeriodControlProject>();

  for (const item of sources.executive?.projects ?? []) {
    ids.set(item.projectId, item.code);
    snapshots.set(item.projectId, item);
  }

  for (const item of sources.forecast?.projects ?? []) {
    ids.set(item.projectId, ids.get(item.projectId) ?? item.projectCode);
    forecasts.set(item.projectId, item);
  }

  for (const item of sources.governance?.projects ?? []) {
    ids.set(item.projectId, ids.get(item.projectId) ?? item.projectCode);
    governance.set(item.projectId, item);
  }

  for (const item of sources.recovery?.projects ?? []) {
    ids.set(item.projectId, ids.get(item.projectId) ?? item.projectCode);
    recovery.set(item.projectId, item);
  }

  for (const item of sources.period?.projects ?? []) {
    ids.set(item.projectId, ids.get(item.projectId) ?? item.projectCode);
    period.set(item.projectId, item);
  }

  return [...ids.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([id, code]) => {
      const snap = snapshots.get(id);
      const fc = forecasts.get(id);
      const gov = governance.get(id);
      const rec = recovery.get(id);
      const per = period.get(id);
      const name = snap?.name ?? fc?.projectName ?? gov?.projectName ?? rec?.projectName ?? per?.projectName ?? "";
      const baselined = Boolean(per?.activeBaselineVersionCode);

      return {
        Code: code,
        Name: name,
        Status: snap?.status ?? null,
        "Health score": snap?.healthScore ?? null,
        "Health band": snap?.healthBand ?? null,
        "Cost score": snap?.costScore ?? null,
        "Procurement score": snap?.procurementScore ?? null,
        "Risk score": snap?.riskScore ?? null,
        "Production score": snap?.productionScore ?? null,
        "Information score": snap?.informationScore ?? null,
        "Safety score": snap?.safetyScore ?? null,
        "Commercial score": snap?.commercialScore ?? null,
        "Resource score": snap?.resourceScore ?? null,
        Budget: fc?.bac ?? null,
        "Forecast cost": fc?.expectedForecastCost ?? null,
        "Variance at completion": fc?.varianceAtCompletion ?? null,
        CPI: fc ? Math.round(fc.cpi * 1000) / 1000 : null,
        SPI: fc ? Math.round(fc.spi * 1000) / 1000 : null,
        "Finish variance (days)": fc?.scheduleVarianceDays ?? null,
        "Predictive score": fc?.predictiveScore ?? null,
        "Predictive risk": fc?.predictiveRisk ?? null,
        "Forecast trend": fc?.trend ?? null,
        "Governance score": gov?.governanceScore ?? null,
        "Governance risk": gov?.governanceRisk ?? null,
        "Overdue actions": gov?.overdueActions ?? null,
        "Overdue decisions": gov?.overdueDecisions ?? null,
        "Recovery simulations": rec?.simulationCount ?? null,
        "Change cost exposure": rec?.changeCostExposure ?? null,
        "Schedule impact (days)": rec?.scheduleImpactDays ?? null,
        "Recovery score": rec && rec.simulationCount > 0 ? rec.recoveryScore : null,
        "Recovery risk": rec && rec.simulationCount > 0 ? rec.recoveryRisk : null,
        "Active baseline": per?.activeBaselineVersionCode ?? null,
        "Cost vs baseline": baselined ? (per?.costVarianceToBaseline ?? null) : null,
        "Finish vs baseline (days)": baselined ? (per?.finishVarianceDays ?? null) : null,
        "Period control score": baselined ? (per?.periodControlScore ?? null) : null,
        "Period control risk": baselined ? (per?.periodControlRisk ?? null) : null,
      };
    });
}

function buildGroups(sources: Sources): Group[] {
  const matrix = buildMatrix(sources);

  const groups: Group[] = [
    {
      key: "table",
      label: "Portfolio table",
      datasets: [
        {
          key: "projects-by-lens",
          label: "Projects by lens",
          note: "One row per project with health, forecast, governance, recovery and period control side by side.",
          rows: matrix,
          table: { rows: matrix, columns: MATRIX_COLUMNS },
        },
      ],
    },
  ];

  if (sources.executive) {
    groups.push({
      key: "executive",
      label: "Health and exceptions",
      datasets: [
        { key: "health-snapshots", label: "Health snapshots", note: "Every health and cost figure per project.", rows: sources.executive.projects },
        { key: "exceptions", label: "Exceptions", note: "What needs attention, with severity and priority.", rows: sources.executive.exceptions },
        { key: "supplier-concentration", label: "Supplier concentration", note: "Share of awarded value held by each supplier.", rows: sources.executive.supplierConcentration },
      ],
    });
  }

  const detail: Dataset[] = [];

  if (sources.forecast) {
    detail.push({ key: "forecast-projects", label: "Forecast by project", note: "BAC, forecast cost, CPI, SPI and predictive score.", rows: sources.forecast.projects });
  }

  if (sources.governance) {
    detail.push({ key: "governance-projects", label: "Governance by project", note: "Actions, decisions and meeting minutes.", rows: sources.governance.projects });
  }

  if (sources.recovery) {
    detail.push({ key: "recovery-projects", label: "Recovery by project", note: "Change exposure and recovery options.", rows: sources.recovery.projects });
  }

  if (sources.period) {
    detail.push({ key: "period-projects", label: "Period control by project", note: "Baseline, drift and period close status.", rows: sources.period.projects });
  }

  if (detail.length > 0) {
    groups.push({ key: "detail", label: "Detail by lens", datasets: detail });
  }

  return groups;
}

function csvOf(dataset: Dataset, delimiter: CsvDelimiter, technical: boolean): string {
  return dataset.table
    ? toCsv(dataset.table.rows, dataset.table.columns, delimiter)
    : recordsToCsv(dataset.rows, delimiter, technical);
}

export function PortfolioDataPackView() {
  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<SourceKey[]>([]);
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const [technical, setTechnical] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    setDelimiter(preferredDelimiter());
  }, []);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      getPortfolioExecutive(),
      getPortfolioForecast(),
      getPortfolioGovernance(),
      getPortfolioRecovery(),
      getPortfolioPeriodControl(),
    ]).then((results) => {
      if (cancelled) {
        return;
      }

      const missing: SourceKey[] = [];

      const take = <T,>(result: PromiseSettledResult<T>, key: SourceKey): T | null => {
        if (result.status === "fulfilled") {
          return result.value;
        }

        missing.push(key);

        return null;
      };

      setSources({
        executive: take(results[0], "executive"),
        forecast: take(results[1], "forecast"),
        governance: take(results[2], "governance"),
        recovery: take(results[3], "recovery"),
        period: take(results[4], "period"),
      });
      setFailed(missing);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => (sources ? buildGroups(sources) : []), [sources]);

  const columnCounts = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of groups) {
      for (const dataset of item.datasets) {
        map.set(
          dataset.key,
          dataset.table
            ? dataset.table.columns.length
            : columnsOf(dataset.rows.slice(0, PREVIEW_ROWS).map(flattenRecord), technical).length,
        );
      }
    }

    return map;
  }, [groups, technical]);

  const filled = useMemo(
    () => groups.flatMap((item) => item.datasets).filter((dataset) => dataset.rows.length > 0),
    [groups],
  );

  const stamp = todayStamp();

  const downloadOne = (dataset: Dataset) => {
    downloadCsv(`portfolio-${dataset.key}-${stamp}.csv`, csvOf(dataset, delimiter, technical));
    setDone(`${dataset.label}: ${num(dataset.rows.length)} ${plural(dataset.rows.length, "row", "rows")} downloaded.`);
  };

  const downloadAll = () => {
    const entries = filled.map((dataset) => ({
      name: `portfolio-${dataset.key}-${stamp}.csv`,
      text: csvOf(dataset, delimiter, technical),
    }));

    downloadZip(`portfolio-data-pack-${stamp}.zip`, entries);
    setDone(`${entries.length} ${plural(entries.length, "file", "files")} added to portfolio-data-pack-${stamp}.zip.`);
  };

  const changeDelimiter = (next: CsvDelimiter) => {
    setDelimiter(next);
    rememberDelimiter(next);
  };

  const everythingFailed = failed.length === 5;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href="/portfolio">
              ← Portfolio
            </Link>

            <div className="eyebrow">PORTFOLIO DATA PACK</div>

            <h1>Every project in one download</h1>

            <p className={styles.subtitle}>
              The portfolio figures as CSV files for Excel or Power BI. Start with the projects by lens table, or take everything in a ZIP.
            </p>
          </div>

          <Link className="secondary-link-button" href="/portfolio/tower">
            Open control tower
          </Link>
        </header>

        {!sources && <div className={styles.loading}>Loading portfolio data…</div>}

        {sources && failed.length > 0 && (
          <div className="offline-banner">
            <div>
              <strong>
                {everythingFailed
                  ? "Could not load portfolio data. Check that the backend is running."
                  : `Could not load ${failed.map((key) => SOURCE_LABEL[key]).join(", ")}.`}
              </strong>
              {!everythingFailed && <span> Those figures are left out of the files.</span>}
            </div>
          </div>
        )}

        {sources && !everythingFailed && (
          <>
            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">FORMAT</div>
                  <h2>How the files are written</h2>
                </div>

                <button className={styles.primaryButton} disabled={filled.length === 0} onClick={downloadAll} type="button">
                  Download everything (ZIP)
                </button>
              </header>

              <div className={styles.options}>
                <div aria-label="Separator" className={styles.segmented} role="group">
                  <button
                    aria-pressed={delimiter === ","}
                    className={cx(styles.segment, delimiter === "," && styles.segmentOn)}
                    onClick={() => changeDelimiter(",")}
                    type="button"
                  >
                    Comma
                  </button>
                  <button
                    aria-pressed={delimiter === ";"}
                    className={cx(styles.segment, delimiter === ";" && styles.segmentOn)}
                    onClick={() => changeDelimiter(";")}
                    type="button"
                  >
                    Semicolon
                  </button>
                </div>

                <label className={styles.check}>
                  <input checked={technical} onChange={(event) => setTechnical(event.target.checked)} type="checkbox" />
                  Include technical columns (ids, versions, timestamps)
                </label>
              </div>

              <p className={styles.hint}>
                Excel set to French or German regional settings expects the semicolon format, and it writes decimals with a comma. Excel set
                to English and Power BI expect the comma format. The projects by lens table has readable column names; the other tables
                keep the names the backend uses. Empty cells mean there is no value, for example no baseline or no recovery simulation yet.
              </p>

              <p className={styles.summary} role="status">
                {filled.length} {plural(filled.length, "table has", "tables have")} data.
                {done && <span className={styles.done}> {done}</span>}
              </p>
            </section>

            <div className={styles.groups}>
              {groups.map((item) => (
                <section className={styles.panel} key={item.key}>
                  <header className={styles.panelHead}>
                    <div>
                      <div className="eyebrow">
                        {item.datasets.length} {plural(item.datasets.length, "TABLE", "TABLES")}
                      </div>
                      <h2>{item.label}</h2>
                    </div>
                  </header>

                  <ul className={styles.dataList}>
                    {item.datasets.map((dataset) => (
                      <li className={styles.dataRow} key={dataset.key}>
                        <div className={styles.dataText}>
                          <div className={styles.dataName}>{dataset.label}</div>
                          <div className={styles.dataNote}>
                            {dataset.rows.length === 0
                              ? "No rows yet."
                              : `${num(dataset.rows.length)} ${plural(dataset.rows.length, "row", "rows")} · ${columnCounts.get(dataset.key) ?? 0} columns`}
                          </div>
                          <div className={styles.dataNote}>{dataset.note}</div>
                        </div>

                        <button
                          aria-label={`Download ${dataset.label} as CSV`}
                          className={styles.downloadButton}
                          disabled={dataset.rows.length === 0}
                          onClick={() => downloadOne(dataset)}
                          type="button"
                        >
                          CSV
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
