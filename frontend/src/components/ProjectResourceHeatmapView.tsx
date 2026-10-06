"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectResources } from "@/lib/api";
import type {
  EquipmentStatus,
  EquipmentUsage,
  ResourceControl,
  ResourceForecast,
  ResourceRiskLevel,
  WorkforceDeployment,
  WorkforcePlan,
} from "@/types/project";

import styles from "./ProjectResourceHeatmapView.module.css";

const DAY_MS = 86_400_000;
const DEFAULT_WEEKS = 12;

const RISK_LABEL: Record<ResourceRiskLevel, string> = {
  NO_DATA: "No data",
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<ResourceRiskLevel, string | undefined> = {
  NO_DATA: styles.riskNone,
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const STATUS_LABEL: Record<EquipmentStatus, string> = {
  AVAILABLE: "Available",
  DEPLOYED: "Deployed",
  IDLE: "Idle",
  MAINTENANCE: "Maintenance",
  OFF_HIRE: "Off hire",
};

type LaborMetric = "hours" | "plan" | "productivity" | "overtime";
type EquipMetric = "utilisation" | "idle" | "downtime";

const LABOR_METRICS: ReadonlyArray<{
  key: LaborMetric;
  label: string;
  hint: string;
}> = [
  {
    key: "hours",
    label: "Labour hours",
    hint: "Total labour hours (regular + overtime) logged in the week.",
  },
  {
    key: "plan",
    label: "Actual vs plan",
    hint: "Actual hours as a share of planned regular hours. Plans are spread evenly across their period.",
  },
  {
    key: "productivity",
    label: "Productivity",
    hint: "Hours-weighted productivity index. 1.00 means output matches the planned rate; deployments without a planned rate are ignored.",
  },
  {
    key: "overtime",
    label: "Overtime share",
    hint: "Overtime hours as a share of total hours. 30% or more is the darkest shade.",
  },
];

const EQUIP_METRICS: ReadonlyArray<{
  key: EquipMetric;
  label: string;
  hint: string;
}> = [
  {
    key: "utilisation",
    label: "Utilisation",
    hint: "Operating hours as a share of available hours.",
  },
  {
    key: "idle",
    label: "Idle share",
    hint: "Idle hours as a share of available hours. 40% or more is the darkest shade.",
  },
  {
    key: "downtime",
    label: "Downtime share",
    hint: "Breakdown and maintenance hours as a share of available hours. 40% or more is the darkest shade.",
  },
];

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function mod(value: number, by: number): number {
  return ((value % by) + by) % by;
}

function weekStart(day: number): number {
  return day - mod(day + 3, 7);
}

function startOfToday(): number {
  const now = new Date();

  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS,
  );
}

function toDay(value: string): number {
  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(
    Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS,
  );
}

function formatDay(day: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(day * DAY_MS));
}

function formatShortDay(day: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(day * DAY_MS));
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatWeek(day: number): string {
  const date = new Date(day * DAY_MS);

  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()] ?? ""}`;
}

function formatIso(value: string): string {
  const day = toDay(value);

  return Number.isFinite(day) ? formatDay(day) : "—";
}

function num(value: number, digits = 0): string {
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function percent(value: number, digits = 0): string {
  return `${num(value, digits)}%`;
}

function money(value: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "EUR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

interface Heat {
  background?: string;
  color?: string;
  tone?: string;
  text: string;
}

const NO_HEAT: Heat = { text: "" };

function sequential(
  ratio: number,
  rgb: readonly [number, number, number],
  text: string,
): Heat {
  const clamped = Math.max(0, Math.min(1, ratio));

  return {
    background: `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${0.1 + clamped * 0.85})`,
    color: clamped > 0.55 ? "#ffffff" : "#19201e",
    text,
  };
}

const GREEN: readonly [number, number, number] = [46, 128, 98];
const RED: readonly [number, number, number] = [181, 73, 62];

/* ------------------------------ Labour grid ------------------------------ */

interface LaborAgg {
  hours: number;
  overtime: number;
  weighted: number;
  weightedHours: number;
  planned: number;
  rows: WorkforceDeployment[];
}

function emptyLabor(): LaborAgg {
  return {
    hours: 0,
    overtime: 0,
    weighted: 0,
    weightedHours: 0,
    planned: 0,
    rows: [],
  };
}

function mergeLabor(into: LaborAgg, from: LaborAgg): void {
  into.hours += from.hours;
  into.overtime += from.overtime;
  into.weighted += from.weighted;
  into.weightedHours += from.weightedHours;
  into.planned += from.planned;
  into.rows.push(...from.rows);
}

function laborHeat(agg: LaborAgg | undefined, metric: LaborMetric, max: number): Heat {
  if (!agg) {
    return NO_HEAT;
  }

  if (metric === "hours") {
    return agg.hours > 0
      ? sequential(agg.hours / max, GREEN, num(agg.hours))
      : NO_HEAT;
  }

  if (metric === "overtime") {
    return agg.hours > 0
      ? sequential(
          agg.overtime / agg.hours / 0.3,
          RED,
          percent((agg.overtime / agg.hours) * 100),
        )
      : NO_HEAT;
  }

  if (metric === "productivity") {
    if (agg.weightedHours <= 0) {
      return NO_HEAT;
    }

    const index = agg.weighted / agg.weightedHours;

    return {
      tone: index < 0.8 ? styles.heatBad : index < 0.95 ? styles.heatWatch : styles.heatGood,
      text: num(index, 2),
    };
  }

  if (agg.planned <= 0.5) {
    return agg.hours > 0
      ? { tone: styles.heatUnplanned, text: "unplanned" }
      : NO_HEAT;
  }

  const ratio = agg.hours / agg.planned;

  return {
    tone: ratio < 0.7 ? styles.heatUnder : ratio > 1.15 ? styles.heatWatch : styles.heatGood,
    text: percent(ratio * 100),
  };
}

/* ---------------------------- Equipment grid ----------------------------- */

interface EquipAgg {
  available: number;
  operating: number;
  idle: number;
  downtime: number;
  idleCost: number;
  rows: EquipmentUsage[];
}

function emptyEquip(): EquipAgg {
  return {
    available: 0,
    operating: 0,
    idle: 0,
    downtime: 0,
    idleCost: 0,
    rows: [],
  };
}

function mergeEquip(into: EquipAgg, from: EquipAgg): void {
  into.available += from.available;
  into.operating += from.operating;
  into.idle += from.idle;
  into.downtime += from.downtime;
  into.idleCost += from.idleCost;
  into.rows.push(...from.rows);
}

function equipShare(agg: EquipAgg, metric: EquipMetric): number | null {
  if (agg.available <= 0) {
    return null;
  }

  const part =
    metric === "utilisation"
      ? agg.operating
      : metric === "idle"
        ? agg.idle
        : agg.downtime;

  return part / agg.available;
}

function equipHeat(agg: EquipAgg | undefined, metric: EquipMetric): Heat {
  if (!agg) {
    return NO_HEAT;
  }

  const share = equipShare(agg, metric);

  if (share === null) {
    return NO_HEAT;
  }

  if (metric === "utilisation") {
    return {
      tone: share < 0.4 ? styles.heatBad : share < 0.65 ? styles.heatWatch : styles.heatGood,
      text: percent(share * 100),
    };
  }

  return sequential(share / 0.4, RED, percent(share * 100));
}

/* ------------------------------- Selection ------------------------------- */

type Selection =
  | { kind: "labor"; row: string; week: number }
  | { kind: "equip"; row: string; week: number }
  | null;

function dayOverlap(startA: number, endA: number, startB: number, endB: number): number {
  return Math.max(0, Math.min(endA, endB) - Math.max(startA, startB) + 1);
}

function coverageClass(required: number, available: number): string | undefined {
  if (required <= 0) {
    return styles.toneGood;
  }

  const ratio = available / required;

  return ratio >= 1 ? styles.toneGood : ratio >= 0.7 ? styles.toneWatch : styles.toneBad;
}

export function ProjectResourceHeatmapView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ResourceControl | null>(null);
  const [error, setError] = useState("");
  const [laborMetric, setLaborMetric] = useState<LaborMetric>("hours");
  const [equipMetric, setEquipMetric] = useState<EquipMetric>("utilisation");
  const [showAll, setShowAll] = useState(false);
  const [selection, setSelection] = useState<Selection>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (projectId) {
      getProjectResources(projectId)
        .then((response) => {
          if (!cancelled) {
            setData(response);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError(
              "Could not load resource data. Check that the backend is running.",
            );
          }
        });
    }

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelection(null);
      }
    }

    document.addEventListener("keydown", onKey);

    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const model = useMemo(() => {
    const deployments: WorkforceDeployment[] = data?.deployments ?? [];
    const usage: EquipmentUsage[] = data?.equipmentUsage ?? [];
    const plans: WorkforcePlan[] = data?.workforcePlans ?? [];
    const equipment = data?.equipment ?? [];

    const actualDays: number[] = [];

    for (const row of deployments) {
      actualDays.push(toDay(row.workDate));
    }

    for (const row of usage) {
      actualDays.push(toDay(row.workDate));
    }

    const planDays: number[] = [];

    for (const plan of plans) {
      planDays.push(toDay(plan.periodStart), toDay(plan.periodEnd));
    }

    const finiteActual = actualDays.filter(Number.isFinite);
    const finitePlan = planDays.filter(Number.isFinite);

    const lastDay =
      finiteActual.length > 0
        ? Math.max(...finiteActual)
        : finitePlan.length > 0
          ? Math.max(...finitePlan)
          : null;

    const firstDay =
      finiteActual.length + finitePlan.length > 0
        ? Math.min(...finiteActual, ...finitePlan)
        : null;

    const allWeeks: number[] = [];

    if (firstDay !== null && lastDay !== null) {
      for (
        let week = weekStart(firstDay);
        week <= weekStart(lastDay);
        week += 7
      ) {
        allWeeks.push(week);
      }
    }

    const weeks = showAll ? allWeeks : allWeeks.slice(-DEFAULT_WEEKS);
    const firstShown = weeks[0];
    const visible = (day: number): boolean =>
      firstShown !== undefined && weekStart(day) >= firstShown;

    /* labour */
    const laborCells = new Map<string, LaborAgg>();
    const tradeTotals = new Map<string, number>();

    function laborCell(trade: string, week: number): LaborAgg {
      const key = `${trade}|${week}`;
      let cell = laborCells.get(key);

      if (!cell) {
        cell = emptyLabor();
        laborCells.set(key, cell);
      }

      return cell;
    }

    for (const row of deployments) {
      const day = toDay(row.workDate);

      if (!Number.isFinite(day) || !visible(day)) {
        continue;
      }

      const trade = row.trade.trim() || "Unassigned";
      const cell = laborCell(trade, weekStart(day));

      cell.hours += row.totalLaborHours;
      cell.overtime += row.overtimeHours;
      cell.rows.push(row);

      if (row.plannedProductivityRate !== null) {
        cell.weighted += row.productivityIndex * row.totalLaborHours;
        cell.weightedHours += row.totalLaborHours;
      }

      tradeTotals.set(trade, (tradeTotals.get(trade) ?? 0) + row.totalLaborHours);
    }

    for (const plan of plans) {
      const start = toDay(plan.periodStart);
      const end = toDay(plan.periodEnd);

      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        continue;
      }

      const trade = plan.trade.trim() || "Unassigned";
      const perDay = plan.plannedRegularHours / (end - start + 1);

      for (const week of weeks) {
        const overlap = dayOverlap(week, week + 6, start, end);

        if (overlap > 0) {
          laborCell(trade, week).planned += perDay * overlap;

          if (!tradeTotals.has(trade)) {
            tradeTotals.set(trade, 0);
          }
        }
      }
    }

    const trades = [...tradeTotals.keys()].sort(
      (a, b) => (tradeTotals.get(b) ?? 0) - (tradeTotals.get(a) ?? 0) || a.localeCompare(b),
    );

    const laborRowAgg = new Map<string, LaborAgg>();
    const laborColAgg = new Map<number, LaborAgg>();
    const laborAll = emptyLabor();
    let laborMax = 0;

    for (const trade of trades) {
      const rowAgg = emptyLabor();

      for (const week of weeks) {
        const cell = laborCells.get(`${trade}|${week}`);

        if (cell) {
          laborMax = Math.max(laborMax, cell.hours);
          mergeLabor(rowAgg, cell);

          let col = laborColAgg.get(week);

          if (!col) {
            col = emptyLabor();
            laborColAgg.set(week, col);
          }

          mergeLabor(col, cell);
        }
      }

      laborRowAgg.set(trade, rowAgg);
      mergeLabor(laborAll, rowAgg);
    }

    /* equipment */
    const byId = new Map(equipment.map((item) => [item.id, item]));
    const equipCells = new Map<string, EquipAgg>();
    const equipRows = new Map<
      string,
      { id: string; code: string; description: string; status: EquipmentStatus | null }
    >();

    for (const item of equipment) {
      equipRows.set(item.id, {
        id: item.id,
        code: item.code,
        description: item.description,
        status: item.status,
      });
    }

    for (const row of usage) {
      const day = toDay(row.workDate);

      if (!Number.isFinite(day) || !visible(day)) {
        continue;
      }

      if (!equipRows.has(row.equipmentId)) {
        equipRows.set(row.equipmentId, {
          id: row.equipmentId,
          code: row.equipmentCode,
          description: "",
          status: null,
        });
      }

      const week = weekStart(day);
      const key = `${row.equipmentId}|${week}`;
      let cell = equipCells.get(key);

      if (!cell) {
        cell = emptyEquip();
        equipCells.set(key, cell);
      }

      cell.available += row.availableHours;
      cell.operating += row.operatingHours;
      cell.idle += row.idleHours;
      cell.downtime += row.downtimeHours;
      cell.rows.push(row);

      const dailyCost = byId.get(row.equipmentId)?.dailyCost ?? 0;

      if (row.availableHours > 0) {
        cell.idleCost +=
          (dailyCost * (row.idleHours + row.downtimeHours)) / row.availableHours;
      }
    }

    const equipRowAgg = new Map<string, EquipAgg>();
    const equipColAgg = new Map<number, EquipAgg>();
    const equipAll = emptyEquip();

    for (const row of equipRows.values()) {
      const rowAgg = emptyEquip();

      for (const week of weeks) {
        const cell = equipCells.get(`${row.id}|${week}`);

        if (cell) {
          mergeEquip(rowAgg, cell);

          let col = equipColAgg.get(week);

          if (!col) {
            col = emptyEquip();
            equipColAgg.set(week, col);
          }

          mergeEquip(col, cell);
        }
      }

      equipRowAgg.set(row.id, rowAgg);
      mergeEquip(equipAll, rowAgg);
    }

    const equipList = [...equipRows.values()].sort((a, b) => {
      const shareA = equipShare(equipRowAgg.get(a.id) ?? emptyEquip(), "utilisation");
      const shareB = equipShare(equipRowAgg.get(b.id) ?? emptyEquip(), "utilisation");

      if (shareA === null && shareB === null) {
        return a.code.localeCompare(b.code);
      }

      if (shareA === null) {
        return 1;
      }

      if (shareB === null) {
        return -1;
      }

      return shareA - shareB || a.code.localeCompare(b.code);
    });

    const shortages = (data?.forecasts ?? [])
      .filter((item) => item.status === "OPEN" && item.shortage > 0)
      .sort((a, b) => b.shortage - a.shortage);

    return {
      allWeeks,
      weeks,
      trades,
      laborCells,
      laborRowAgg,
      laborColAgg,
      laborAll,
      laborMax,
      equipList,
      equipCells,
      equipRowAgg,
      equipColAgg,
      equipAll,
      shortages,
    };
  }, [data, showAll]);

  const intel = data?.intelligence;
  const laborInfo = LABOR_METRICS.find((item) => item.key === laborMetric);
  const equipInfo = EQUIP_METRICS.find((item) => item.key === equipMetric);

  const shortageByType = useMemo(() => {
    const totals = { LABOR: 0, EQUIPMENT: 0 };

    for (const item of model.shortages) {
      totals[item.resourceType] += item.shortage;
    }

    return totals;
  }, [model.shortages]);

  const selectedLabor =
    selection?.kind === "labor"
      ? model.laborCells.get(`${selection.row}|${selection.week}`)
      : undefined;

  const selectedEquip =
    selection?.kind === "equip"
      ? model.equipCells.get(`${selection.row}|${selection.week}`)
      : undefined;

  const selectedEquipName =
    selection?.kind === "equip"
      ? (model.equipList.find((item) => item.id === selection.row)?.code ?? "Equipment")
      : "";

  function forecastTiming(item: ResourceForecast): string {
    const start = toDay(item.periodStart);
    const end = toDay(item.periodEnd);

    if (Number.isFinite(end) && end < today) {
      return "Ended";
    }

    if (Number.isFinite(start) && start <= today) {
      return "In progress";
    }

    return Number.isFinite(start) ? `Starts in ${start - today}d` : "—";
  }

  const hasActivity = model.trades.length > 0 || model.equipList.length > 0;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">RESOURCE HEATMAP</div>

            <h1>{data ? data.project.name : "Resource heatmap"}</h1>

            <p className={styles.subtitle}>
              Where labour and equipment are working hardest, where they sit
              idle, and where demand outruns supply. Weeks start on Monday.
              Click any cell to see the records behind it.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/resources`}>
            Open resource control
          </Link>
        </header>

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && (
          <div className={styles.loading}>Loading resources…</div>
        )}

        {data && intel && (
          <>
            <section aria-label="Resource summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>RESOURCE SCORE</div>
                <div className={styles.kpiValue}>
                  {Math.round(intel.resourceScore)}
                </div>
                <div className={styles.kpiSub}>
                  <span className={cx(styles.pill, RISK_CLASS[intel.resourceRisk])}>
                    {RISK_LABEL[intel.resourceRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LABOUR UTILISATION</div>
                <div className={styles.kpiValue}>
                  {percent(intel.laborUtilizationPercentage, 1)}
                </div>
                <div className={styles.kpiSub}>
                  {num(intel.actualLaborHours)} h actual ·{" "}
                  {num(intel.plannedLaborHours)} h planned
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVERTIME</div>
                <div
                  className={cx(
                    styles.kpiValue,
                    intel.overtimePercentage >= 15 && styles.neg,
                  )}
                >
                  {percent(intel.overtimePercentage, 1)}
                </div>
                <div className={styles.kpiSub}>
                  {num(intel.overtimeHours)} h of overtime
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PRODUCTIVITY INDEX</div>
                <div className={styles.kpiValue}>
                  {num(intel.averageProductivityIndex, 2)}
                </div>
                <div className={styles.kpiSub}>
                  {intel.lowProductivityWorkPackages} low-productivity work
                  package{intel.lowProductivityWorkPackages === 1 ? "" : "s"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FLEET UTILISATION</div>
                <div className={styles.kpiValue}>
                  {percent(intel.equipmentUtilizationPercentage, 1)}
                </div>
                <div className={styles.kpiSub}>
                  {intel.idleEquipment} idle · {num(intel.equipmentDowntimeHours)} h
                  downtime
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DEMAND GAP</div>
                <div
                  className={cx(
                    styles.kpiValue,
                    intel.workerDemandGap + intel.equipmentDemandGap > 0 && styles.neg,
                  )}
                >
                  {num(intel.workerDemandGap)} / {num(intel.equipmentDemandGap)}
                </div>
                <div className={styles.kpiSub}>
                  Workers / equipment · {intel.openResourceForecasts} open
                  forecast{intel.openResourceForecasts === 1 ? "" : "s"}
                </div>
              </article>
            </section>

            {!hasActivity && (
              <section className={styles.panel}>
                <div className={styles.empty}>
                  No deployments, equipment usage or workforce plans recorded
                  yet. Add them in{" "}
                  <Link href={`${base}/resources`}>resource control</Link> to
                  fill the heatmaps.
                </div>
              </section>
            )}

            {hasActivity && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">LABOUR BY TRADE</div>
                    <h2>Weekly labour heatmap</h2>
                  </div>

                  <div className={styles.controls}>
                    <div
                      aria-label="Labour metric"
                      className={styles.segmented}
                      role="group"
                    >
                      {LABOR_METRICS.map((item) => (
                        <button
                          aria-pressed={laborMetric === item.key}
                          className={cx(
                            styles.segment,
                            laborMetric === item.key && styles.segmentOn,
                          )}
                          key={item.key}
                          onClick={() => {
                            setLaborMetric(item.key);
                            setSelection(null);
                          }}
                          type="button"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>

                    {model.allWeeks.length > DEFAULT_WEEKS && (
                      <button
                        className={styles.linkButton}
                        onClick={() => {
                          setShowAll((value) => !value);
                          setSelection(null);
                        }}
                        type="button"
                      >
                        {showAll
                          ? `Show last ${DEFAULT_WEEKS} weeks`
                          : `Show all ${model.allWeeks.length} weeks`}
                      </button>
                    )}
                  </div>
                </header>

                {model.trades.length === 0 ? (
                  <div className={styles.emptySmall}>
                    No labour deployments or plans in this window.
                  </div>
                ) : (
                  <div className={styles.gridWrap}>
                    <table className={styles.grid}>
                      <thead>
                        <tr>
                          <th className={styles.corner} scope="col">
                            TRADE
                          </th>
                          <th className={styles.totalHead} scope="col">
                            TOTAL
                          </th>
                          {model.weeks.map((week) => (
                            <th key={week} scope="col">
                              {formatWeek(week)}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {model.trades.map((trade) => {
                          const rowAgg = model.laborRowAgg.get(trade);
                          const total = laborHeat(rowAgg, laborMetric, Math.max(model.laborMax, 1));

                          return (
                            <tr key={trade}>
                              <th className={styles.rowHead} scope="row">
                                {trade}
                              </th>

                              <td className={styles.totalCell}>{total.text || "—"}</td>

                              {model.weeks.map((week) => {
                                const agg = model.laborCells.get(`${trade}|${week}`);
                                const heat = laborHeat(agg, laborMetric, Math.max(model.laborMax, 1));
                                const on =
                                  selection?.kind === "labor" &&
                                  selection.row === trade &&
                                  selection.week === week;

                                return (
                                  <td key={week}>
                                    {heat.text && agg && agg.rows.length > 0 ? (
                                      <button
                                        aria-label={`${trade}, week of ${formatDay(week)}: ${heat.text}`}
                                        aria-pressed={on}
                                        className={cx(styles.cell, heat.tone, on && styles.cellOn)}
                                        onClick={() =>
                                          setSelection(
                                            on ? null : { kind: "labor", row: trade, week },
                                          )
                                        }
                                        style={{
                                          background: heat.background,
                                          color: heat.color,
                                        }}
                                        type="button"
                                      >
                                        {heat.text}
                                      </button>
                                    ) : heat.text ? (
                                      <span
                                        className={cx(styles.cell, styles.cellStatic, heat.tone)}
                                        style={{
                                          background: heat.background,
                                          color: heat.color,
                                        }}
                                      >
                                        {heat.text}
                                      </span>
                                    ) : (
                                      <span className={cx(styles.cell, styles.cellEmpty)}>·</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>

                      <tfoot>
                        <tr>
                          <th className={styles.rowHead} scope="row">
                            All trades
                          </th>
                          <td className={styles.totalCell}>
                            {laborHeat(model.laborAll, laborMetric, Math.max(model.laborMax, 1))
                              .text || "—"}
                          </td>
                          {model.weeks.map((week) => (
                            <td className={styles.footCell} key={week}>
                              {laborHeat(
                                model.laborColAgg.get(week),
                                laborMetric,
                                Math.max(model.laborMax, 1),
                              ).text || "·"}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                <p className={styles.hint}>{laborInfo?.hint}</p>

                {selection?.kind === "labor" && selectedLabor && (
                  <div className={styles.detail}>
                    <div className={styles.detailHead}>
                      <strong>
                        {selection.row} · week of {formatDay(selection.week)}
                      </strong>
                      <button
                        className={styles.linkButton}
                        onClick={() => setSelection(null)}
                        type="button"
                      >
                        Close
                      </button>
                    </div>

                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>DATE</th>
                            <th className={styles.num}>WORKERS</th>
                            <th className={styles.num}>REGULAR H</th>
                            <th className={styles.num}>OVERTIME H</th>
                            <th className={styles.num}>PRODUCTIVE H</th>
                            <th className={styles.num}>QUANTITY</th>
                            <th className={styles.num}>PRODUCTIVITY</th>
                            <th>NOTES</th>
                          </tr>
                        </thead>

                        <tbody>
                          {[...selectedLabor.rows]
                            .sort((a, b) => a.workDate.localeCompare(b.workDate))
                            .map((row) => (
                              <tr key={row.id}>
                                <td>{formatIso(row.workDate)}</td>
                                <td className={styles.num}>{num(row.workers)}</td>
                                <td className={styles.num}>{num(row.regularHours, 1)}</td>
                                <td className={styles.num}>{num(row.overtimeHours, 1)}</td>
                                <td className={styles.num}>{num(row.productiveHours, 1)}</td>
                                <td className={styles.num}>{num(row.quantityCompleted, 1)}</td>
                                <td className={styles.num}>
                                  {row.plannedProductivityRate === null
                                    ? "—"
                                    : num(row.productivityIndex, 2)}
                                </td>
                                <td className={styles.notes}>{row.notes ?? "—"}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            {hasActivity && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">EQUIPMENT</div>
                    <h2>Weekly equipment heatmap</h2>
                  </div>

                  <div
                    aria-label="Equipment metric"
                    className={styles.segmented}
                    role="group"
                  >
                    {EQUIP_METRICS.map((item) => (
                      <button
                        aria-pressed={equipMetric === item.key}
                        className={cx(
                          styles.segment,
                          equipMetric === item.key && styles.segmentOn,
                        )}
                        key={item.key}
                        onClick={() => {
                          setEquipMetric(item.key);
                          setSelection(null);
                        }}
                        type="button"
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </header>

                {model.equipList.length === 0 ? (
                  <div className={styles.emptySmall}>
                    No equipment registered for this project.
                  </div>
                ) : (
                  <div className={styles.gridWrap}>
                    <table className={styles.grid}>
                      <thead>
                        <tr>
                          <th className={styles.corner} scope="col">
                            EQUIPMENT
                          </th>
                          <th className={styles.totalHead} scope="col">
                            OVERALL
                          </th>
                          <th className={styles.totalHead} scope="col">
                            IDLE COST
                          </th>
                          {model.weeks.map((week) => (
                            <th key={week} scope="col">
                              {formatWeek(week)}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {model.equipList.map((item) => {
                          const rowAgg = model.equipRowAgg.get(item.id);
                          const overall = equipHeat(rowAgg, equipMetric);

                          return (
                            <tr key={item.id}>
                              <th className={styles.rowHead} scope="row">
                                <strong>{item.code}</strong>
                                <small>
                                  {item.description}
                                  {item.status ? ` · ${STATUS_LABEL[item.status]}` : ""}
                                </small>
                              </th>

                              <td className={styles.totalCell}>{overall.text || "—"}</td>
                              <td className={styles.totalCell}>
                                {rowAgg && rowAgg.idleCost > 0 ? money(rowAgg.idleCost) : "—"}
                              </td>

                              {model.weeks.map((week) => {
                                const agg = model.equipCells.get(`${item.id}|${week}`);
                                const heat = equipHeat(agg, equipMetric);
                                const on =
                                  selection?.kind === "equip" &&
                                  selection.row === item.id &&
                                  selection.week === week;

                                return (
                                  <td key={week}>
                                    {heat.text ? (
                                      <button
                                        aria-label={`${item.code}, week of ${formatDay(week)}: ${heat.text}`}
                                        aria-pressed={on}
                                        className={cx(styles.cell, heat.tone, on && styles.cellOn)}
                                        onClick={() =>
                                          setSelection(
                                            on ? null : { kind: "equip", row: item.id, week },
                                          )
                                        }
                                        style={{
                                          background: heat.background,
                                          color: heat.color,
                                        }}
                                        type="button"
                                      >
                                        {heat.text}
                                      </button>
                                    ) : (
                                      <span className={cx(styles.cell, styles.cellEmpty)}>·</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>

                      <tfoot>
                        <tr>
                          <th className={styles.rowHead} scope="row">
                            Whole fleet
                          </th>
                          <td className={styles.totalCell}>
                            {equipHeat(model.equipAll, equipMetric).text || "—"}
                          </td>
                          <td className={styles.totalCell}>
                            {model.equipAll.idleCost > 0 ? money(model.equipAll.idleCost) : "—"}
                          </td>
                          {model.weeks.map((week) => (
                            <td className={styles.footCell} key={week}>
                              {equipHeat(model.equipColAgg.get(week), equipMetric).text || "·"}
                            </td>
                          ))}
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}

                <p className={styles.hint}>
                  {equipInfo?.hint} Rows are sorted with the lowest utilisation
                  first. Idle cost is an estimate: each equipment day’s daily
                  cost multiplied by the share of that day spent idle or down.
                </p>

                {selection?.kind === "equip" && selectedEquip && (
                  <div className={styles.detail}>
                    <div className={styles.detailHead}>
                      <strong>
                        {selectedEquipName} · week of {formatDay(selection.week)}
                      </strong>
                      <button
                        className={styles.linkButton}
                        onClick={() => setSelection(null)}
                        type="button"
                      >
                        Close
                      </button>
                    </div>

                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>DATE</th>
                            <th className={styles.num}>AVAILABLE H</th>
                            <th className={styles.num}>OPERATING H</th>
                            <th className={styles.num}>IDLE H</th>
                            <th className={styles.num}>DOWNTIME H</th>
                            <th className={styles.num}>UTILISATION</th>
                            <th>NOTES</th>
                          </tr>
                        </thead>

                        <tbody>
                          {[...selectedEquip.rows]
                            .sort((a, b) => a.workDate.localeCompare(b.workDate))
                            .map((row) => (
                              <tr key={row.id}>
                                <td>{formatIso(row.workDate)}</td>
                                <td className={styles.num}>{num(row.availableHours, 1)}</td>
                                <td className={styles.num}>{num(row.operatingHours, 1)}</td>
                                <td className={styles.num}>{num(row.idleHours, 1)}</td>
                                <td className={styles.num}>{num(row.downtimeHours, 1)}</td>
                                <td className={styles.num}>
                                  {percent(row.utilizationPercentage, 0)}
                                </td>
                                <td className={styles.notes}>{row.notes ?? "—"}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </section>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">DEMAND VS SUPPLY</div>
                  <h2>Open shortages</h2>
                </div>

                <span className={styles.muted}>
                  {num(shortageByType.LABOR)} labour · {num(shortageByType.EQUIPMENT)}{" "}
                  equipment short
                </span>
              </header>

              {model.shortages.length === 0 ? (
                <div className={styles.emptySmall}>
                  {data.forecasts.length === 0
                    ? "No resource forecasts recorded yet."
                    : "No open forecast has a shortage. Supply covers the forecast demand."}
                </div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>RESOURCE</th>
                        <th>TYPE</th>
                        <th>PERIOD</th>
                        <th>TIMING</th>
                        <th className={styles.num}>REQUIRED</th>
                        <th className={styles.num}>AVAILABLE</th>
                        <th className={styles.num}>SHORTAGE</th>
                        <th>COVERAGE</th>
                      </tr>
                    </thead>

                    <tbody>
                      {model.shortages.map((item) => {
                        const covered =
                          item.requiredQuantity > 0
                            ? Math.min(100, (item.availableQuantity / item.requiredQuantity) * 100)
                            : 100;

                        return (
                          <tr key={item.id}>
                            <td>
                              <strong>{item.resourceKey}</strong>
                            </td>
                            <td>{item.resourceType === "LABOR" ? "Labour" : "Equipment"}</td>
                            <td>
                              {formatShortDay(toDay(item.periodStart))} →{" "}
                              {formatIso(item.periodEnd)}
                            </td>
                            <td>{forecastTiming(item)}</td>
                            <td className={styles.num}>{num(item.requiredQuantity, 1)}</td>
                            <td className={styles.num}>{num(item.availableQuantity, 1)}</td>
                            <td className={cx(styles.num, styles.neg)}>
                              {num(item.shortage, 1)}
                            </td>
                            <td className={styles.coverageCell}>
                              <div className={styles.track}>
                                <div
                                  className={cx(
                                    styles.fill,
                                    coverageClass(item.requiredQuantity, item.availableQuantity),
                                  )}
                                  style={{ width: `${covered}%` }}
                                />
                              </div>
                              <small>{percent(covered)}</small>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className={styles.note}>
              {intel.explanation} Heatmap cells come straight from logged
              deployments and equipment usage; weeks with nothing logged show a
              dot.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
