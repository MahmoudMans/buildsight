"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  getProjectCommandCenter,
  getProjectCommercial,
  getProjectCostControl,
  getProjectDocuments,
  getProjectForecast,
  getProjectGovernance,
  getProjectPeriodControl,
  getProjectProcurement,
  getProjectProduction,
  getProjectQuality,
  getProjectResources,
  getProjectRiskControl,
  getProjectSafety,
  getProjectSchedule,
} from "@/lib/api";
import {
  type CsvDelimiter,
  columnsOf,
  downloadCsv,
  downloadZip,
  flattenRecord,
  preferredDelimiter,
  recordsToCsv,
  rememberDelimiter,
  safeFileName,
  todayStamp,
} from "@/lib/csvExport";
import type {
  CommercialControl,
  CostControl,
  DocumentControl,
  ForecastControl,
  GovernanceControl,
  PeriodControl,
  ProcurementControl,
  ProductionControl,
  Project,
  ProjectCommandCenter,
  QualityControl,
  ResourceControl,
  RiskControl,
  SafetyControl,
  ScheduleControl,
} from "@/types/project";

import styles from "./ProjectExportView.module.css";

const PREVIEW_ROWS = 200;

interface Dataset {
  key: string;
  label: string;
  note: string;
  rows: ReadonlyArray<object>;
}

interface Group {
  key: string;
  label: string;
  loaded: boolean;
  datasets: Dataset[];
}

interface Sources {
  center: ProjectCommandCenter | null;
  cost: CostControl | null;
  schedule: ScheduleControl | null;
  forecast: ForecastControl | null;
  period: PeriodControl | null;
  risk: RiskControl | null;
  procurement: ProcurementControl | null;
  production: ProductionControl | null;
  quality: QualityControl | null;
  safety: SafetyControl | null;
  commercial: CommercialControl | null;
  documents: DocumentControl | null;
  governance: GovernanceControl | null;
  resources: ResourceControl | null;
}

type Entry = readonly [key: string, label: string, note: string, rows: ReadonlyArray<object> | undefined];

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function num(value: number): string {
  return new Intl.NumberFormat("en-GB").format(value);
}

function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}

function group(key: string, label: string, source: object | null, entries: ReadonlyArray<Entry>): Group {
  return {
    key,
    label,
    loaded: source !== null,
    datasets:
      source === null
        ? []
        : entries.map(([datasetKey, datasetLabel, note, rows]) => ({
            key: datasetKey,
            label: datasetLabel,
            note,
            rows: rows ?? [],
          })),
  };
}

function buildGroups(s: Sources): Group[] {
  return [
    group("center", "Milestones and progress", s.center, [
      ["milestones", "Milestones", "Planned and forecast dates for each milestone.", s.center?.milestones],
      ["progress-updates", "Progress updates", "Physical progress reported over time.", s.center?.progressUpdates],
    ]),
    group("cost", "Cost", s.cost, [
      ["cost-codes", "Cost codes", "The cost breakdown structure.", s.cost?.costCodes],
      ["budget-lines", "Budget lines", "Budget by cost code.", s.cost?.budgetLines],
      ["commitments", "Commitments", "Purchase orders and contracts.", s.cost?.commitments],
      ["actual-costs", "Actual costs", "Costs posted against the project.", s.cost?.actualCosts],
    ]),
    group("schedule", "Schedule", s.schedule, [
      ["schedule-activities", "Activities", "Planned and actual dates, float and progress.", s.schedule?.activities],
      ["schedule-dependencies", "Dependencies", "Links between activities.", s.schedule?.dependencies],
      ["schedule-constraints", "Constraints", "Date constraints on activities.", s.schedule?.constraints],
      ["schedule-baselines", "Baselines", "Captured schedule baselines.", s.schedule?.baselines],
    ]),
    group("forecast", "Forecast", s.forecast, [
      ["evm-history", "Earned value history", "Snapshots of PV, EV, AC, CPI and SPI.", s.forecast?.history],
      ["forecast-scenarios", "Forecast scenarios", "What-if scenarios and their results.", s.forecast?.scenarios],
    ]),
    group("period", "Period control", s.period, [
      ["control-baselines", "Cost and schedule baselines", "Approved control baselines.", s.period?.baselines],
      ["progress-periods", "Progress periods", "Open and closed reporting periods.", s.period?.periods],
      ["period-snapshots", "Period-end snapshots", "Figures frozen when each period closed.", s.period?.snapshots],
    ]),
    group("risk", "Risk and change", s.risk, [
      ["risks", "Risks", "Risk register with inherent and residual scores.", s.risk?.risks],
      ["issues", "Issues", "Issue log.", s.risk?.issues],
      ["change-events", "Change events", "Change requests and their cost and time impact.", s.risk?.changes],
      ["delay-events", "Delay events", "Delays by cause, with excusable and compensable flags.", s.risk?.delays],
    ]),
    group("procurement", "Procurement", s.procurement, [
      ["suppliers", "Suppliers", "Supplier directory.", s.procurement?.suppliers],
      ["procurement-packages", "Packages", "Packages with their key dates and award.", s.procurement?.packages],
      ["procurement-bids", "Bids", "Bids received per package.", s.procurement?.bids],
      ["supplier-evaluations", "Supplier evaluations", "Performance scores.", s.procurement?.evaluations],
    ]),
    group("production", "Production", s.production, [
      ["work-packages", "Work packages", "Quantities, hours and productivity.", s.production?.workPackages],
      ["site-reports", "Site reports", "Daily site reports.", s.production?.siteReports],
      ["production-entries", "Production entries", "Quantities and hours booked.", s.production?.productionEntries],
    ]),
    group("quality", "Quality", s.quality, [
      ["inspections", "Inspections", "Planned and completed inspections.", s.quality?.inspections],
      ["ncrs", "Non-conformances", "NCRs with severity and due dates.", s.quality?.ncrs],
      ["punch-items", "Punch items", "Snag list.", s.quality?.punchItems],
      ["handover-items", "Handover items", "Closeout documents and handover checks.", s.quality?.handoverItems],
    ]),
    group("safety", "Safety", s.safety, [
      ["safety-incidents", "Incidents", "Incidents with severity and lost time.", s.safety?.incidents],
      ["safety-observations", "Observations", "Safety observations.", s.safety?.observations],
      ["safety-actions", "Safety actions", "Corrective actions and due dates.", s.safety?.actions],
      ["work-permits", "Work permits", "Permits and their validity.", s.safety?.permits],
    ]),
    group("commercial", "Commercial", s.commercial, [
      ["change-orders", "Change orders", "Submitted, assessed and approved amounts.", s.commercial?.changeOrders],
      ["claims", "Claims", "Claimed and awarded money and time.", s.commercial?.claims],
      ["payment-certificates", "Payment certificates", "Applications, certificates and payments.", s.commercial?.paymentCertificates],
      ["cashflow-periods", "Cashflow periods", "Planned and actual cash in and out.", s.commercial?.cashflowPeriods],
    ]),
    group("documents", "Documents", s.documents, [
      ["documents", "Documents", "Document register.", s.documents?.documents],
      ["document-revisions", "Revisions", "Revision history.", s.documents?.revisions],
      ["rfis", "RFIs", "Requests for information.", s.documents?.rfis],
      ["transmittals", "Transmittals", "Documents issued and to whom.", s.documents?.transmittals],
    ]),
    group("governance", "Governance", s.governance, [
      ["meetings", "Meetings", "Meetings and minutes status.", s.governance?.meetings],
      ["decisions", "Decisions", "Decision log.", s.governance?.decisions],
      ["actions", "Actions", "Action log with owners and due dates.", s.governance?.actions],
    ]),
    group("resources", "Resources", s.resources, [
      ["workforce-plans", "Workforce plans", "Planned headcount by trade.", s.resources?.workforcePlans],
      ["workforce-deployments", "Workforce deployments", "Actual headcount on site.", s.resources?.deployments],
      ["equipment", "Equipment", "Equipment register.", s.resources?.equipment],
      ["equipment-usage", "Equipment usage", "Hours worked and idle.", s.resources?.equipmentUsage],
      ["resource-forecasts", "Resource forecasts", "Forecast demand and gaps.", s.resources?.forecasts],
    ]),
  ];
}

export function ProjectExportView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [sources, setSources] = useState<Sources | null>(null);
  const [delimiter, setDelimiter] = useState<CsvDelimiter>(",");
  const [technical, setTechnical] = useState(false);
  const [done, setDone] = useState("");

  useEffect(() => {
    setDelimiter(preferredDelimiter());
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    Promise.allSettled([
      getProjectCommandCenter(projectId),
      getProjectCostControl(projectId),
      getProjectSchedule(projectId),
      getProjectForecast(projectId),
      getProjectPeriodControl(projectId),
      getProjectRiskControl(projectId),
      getProjectProcurement(projectId),
      getProjectProduction(projectId),
      getProjectQuality(projectId),
      getProjectSafety(projectId),
      getProjectCommercial(projectId),
      getProjectDocuments(projectId),
      getProjectGovernance(projectId),
      getProjectResources(projectId),
    ]).then((results) => {
      if (cancelled) {
        return;
      }

      const take = <T,>(result: PromiseSettledResult<T>): T | null =>
        result.status === "fulfilled" ? result.value : null;

      setSources({
        center: take(results[0]),
        cost: take(results[1]),
        schedule: take(results[2]),
        forecast: take(results[3]),
        period: take(results[4]),
        risk: take(results[5]),
        procurement: take(results[6]),
        production: take(results[7]),
        quality: take(results[8]),
        safety: take(results[9]),
        commercial: take(results[10]),
        documents: take(results[11]),
        governance: take(results[12]),
        resources: take(results[13]),
      });
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const project: Project | null = useMemo(() => {
    if (!sources) {
      return null;
    }

    for (const value of Object.values(sources)) {
      if (value && "project" in value) {
        return value.project;
      }
    }

    return null;
  }, [sources]);

  const groups = useMemo(() => (sources ? buildGroups(sources) : []), [sources]);

  const columnCounts = useMemo(() => {
    const map = new Map<string, number>();

    for (const item of groups) {
      for (const dataset of item.datasets) {
        const sample = dataset.rows.slice(0, PREVIEW_ROWS).map(flattenRecord);

        map.set(dataset.key, columnsOf(sample, technical).length);
      }
    }

    return map;
  }, [groups, technical]);

  const totals = useMemo(() => {
    const datasets = groups.flatMap((item) => item.datasets);
    const filled = datasets.filter((dataset) => dataset.rows.length > 0);

    return {
      filled: filled.length,
      rows: filled.reduce((sum, dataset) => sum + dataset.rows.length, 0),
      failed: groups.filter((item) => !item.loaded),
    };
  }, [groups]);

  const code = safeFileName(project?.code ?? "project");
  const stamp = todayStamp();

  const downloadOne = (dataset: Dataset) => {
    downloadCsv(`${code}-${dataset.key}-${stamp}.csv`, recordsToCsv(dataset.rows, delimiter, technical));
    setDone(`${dataset.label}: ${num(dataset.rows.length)} ${plural(dataset.rows.length, "row", "rows")} downloaded.`);
  };

  const downloadAll = () => {
    const entries = groups
      .flatMap((item) => item.datasets)
      .filter((dataset) => dataset.rows.length > 0)
      .map((dataset) => ({
        name: `${code}-${dataset.key}-${stamp}.csv`,
        text: recordsToCsv(dataset.rows, delimiter, technical),
      }));

    downloadZip(`${code}-data-${stamp}.zip`, entries);
    setDone(`${entries.length} ${plural(entries.length, "file", "files")} added to ${code}-data-${stamp}.zip.`);
  };

  const changeDelimiter = (next: CsvDelimiter) => {
    setDelimiter(next);
    rememberDelimiter(next);
  };

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">DATA EXPORT</div>

            <h1>Take the data with you</h1>

            <p className={styles.subtitle}>
              {project ? `${project.code} · ${project.name}. ` : ""}
              Download any register as a CSV file for Excel or Power BI, one file at a time or everything in a ZIP.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/inbox`}>
            Open action inbox
          </Link>
        </header>

        {!sources && <div className={styles.loading}>Loading the project registers…</div>}

        {sources && totals.failed.length === groups.length && (
          <div className="offline-banner">
            <div>
              <strong>Could not load project data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {sources && totals.failed.length > 0 && totals.failed.length < groups.length && (
          <div className="offline-banner">
            <div>
              <strong>Could not load {totals.failed.map((item) => item.label.toLowerCase()).join(", ")}.</strong>
              <span> Those registers are left out below.</span>
            </div>
          </div>
        )}

        {sources && totals.failed.length < groups.length && (
          <>
            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">FORMAT</div>
                  <h2>How the files are written</h2>
                </div>

                <button className={styles.primaryButton} disabled={totals.filled === 0} onClick={downloadAll} type="button">
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
                to English and Power BI expect the comma format. Files are UTF-8 with accents kept. Dates are written as YYYY-MM-DD, and an empty cell
                means there is no value.
              </p>

              <p className={styles.summary} role="status">
                {totals.filled} {plural(totals.filled, "register has", "registers have")} data, {num(totals.rows)}{" "}
                {plural(totals.rows, "row", "rows")} in total.
                {done && <span className={styles.done}> {done}</span>}
              </p>
            </section>

            <div className={styles.groups}>
              {groups
                .filter((item) => item.loaded)
                .map((item) => {
                  const rowTotal = item.datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0);

                  return (
                    <section className={styles.panel} key={item.key}>
                      <header className={styles.panelHead}>
                        <div>
                          <div className="eyebrow">{item.datasets.length} {plural(item.datasets.length, "REGISTER", "REGISTERS")}</div>
                          <h2>{item.label}</h2>
                        </div>

                        <span className={styles.muted}>
                          {num(rowTotal)} {plural(rowTotal, "row", "rows")}
                        </span>
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
                  );
                })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
