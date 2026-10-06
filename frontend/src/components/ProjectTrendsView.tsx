"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { LineChart } from "@/components/LineChart";
import {
  BuildSightApiError,
  captureEvmSnapshot,
  getProjectForecast,
} from "@/lib/api";
import type {
  ForecastControl,
  ForecastRiskLevel,
  ForecastTrend,
} from "@/types/project";

import styles from "./ProjectTrendsView.module.css";

const DAY_MS = 86_400_000;

const RISK_LABEL: Record<ForecastRiskLevel, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<ForecastRiskLevel, string> = {
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

const TREND_LABEL: Record<ForecastTrend, string> = {
  IMPROVING: "Improving",
  STABLE: "Stable",
  DETERIORATING: "Deteriorating",
  NO_HISTORY: "No history yet",
};

const TREND_CLASS: Record<ForecastTrend, string> = {
  IMPROVING: styles.good,
  STABLE: "",
  DETERIORATING: styles.bad,
  NO_HISTORY: "",
};

interface TrendRow {
  id: string;
  date: string;
  pv: number;
  ev: number;
  ac: number;
  eac: number;
  cpi: number;
  spi: number;
  score: number;
  risk: ForecastRiskLevel;
  live: boolean;
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

function formatIso(value: string): string {
  const day = toDay(value);

  return Number.isFinite(day) ? formatDay(day) : value;
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

function signedMoney(value: number): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(
    Math.abs(value),
  )}`;
}

export function ProjectTrendsView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ForecastControl | null>(null);
  const [error, setError] = useState("");
  const [capturing, setCapturing] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    if (!projectId) {
      return;
    }

    try {
      const response = await getProjectForecast(projectId);

      setData(response);
      setError("");
    } catch {
      setError(
        "Could not load forecast data. Check that the backend is running.",
      );
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function capture() {
    if (!projectId) {
      return;
    }

    setCapturing(true);
    setMessage("");

    try {
      await captureEvmSnapshot(projectId);
      await load();
      setMessage("Snapshot captured.");
    } catch (failure) {
      setMessage(
        failure instanceof BuildSightApiError
          ? failure.message
          : "Could not capture a snapshot.",
      );
    } finally {
      setCapturing(false);
    }
  }

  const rows = useMemo<TrendRow[]>(() => {
    if (!data) {
      return [];
    }

    const result: TrendRow[] = data.history.map((item) => ({
      id: item.id,
      date: item.dataDate,
      pv: Number(item.plannedValue),
      ev: Number(item.earnedValue),
      ac: Number(item.actualCost),
      eac: Number(item.estimateAtCompletion),
      cpi: Number(item.cpi),
      spi: Number(item.spi),
      score: Number(item.predictiveScore),
      risk: item.predictiveRisk,
      live: false,
    }));

    const intel = data.intelligence;

    if (
      !result.some(
        (row) => row.date.slice(0, 10) === intel.dataDate.slice(0, 10),
      )
    ) {
      result.push({
        id: "live",
        date: intel.dataDate,
        pv: Number(intel.plannedValue),
        ev: Number(intel.earnedValue),
        ac: Number(intel.actualCost),
        eac: Number(intel.estimateAtCompletion),
        cpi: Number(intel.cpi),
        spi: Number(intel.spi),
        score: Number(intel.predictiveScore),
        risk: intel.predictiveRisk,
        live: true,
      });
    }

    return result.sort((a, b) => toDay(a.date) - toDay(b.date));
  }, [data]);

  const intel = data?.intelligence;

  const costSeries = useMemo(
    () => [
      {
        name: "Planned value",
        color: "#7a847f",
        dashed: true,
        points: rows.map((row) => ({ x: toDay(row.date), y: row.pv })),
      },
      {
        name: "Earned value",
        color: "#3f8a68",
        points: rows.map((row) => ({ x: toDay(row.date), y: row.ev })),
      },
      {
        name: "Actual cost",
        color: "#b5493e",
        points: rows.map((row) => ({ x: toDay(row.date), y: row.ac })),
      },
    ],
    [rows],
  );

  const indexSeries = useMemo(
    () => [
      {
        name: "CPI (cost)",
        color: "#344b42",
        points: rows.map((row) => ({ x: toDay(row.date), y: row.cpi })),
      },
      {
        name: "SPI (schedule)",
        color: "#386b8d",
        points: rows.map((row) => ({ x: toDay(row.date), y: row.spi })),
      },
    ],
    [rows],
  );

  const scoreSeries = useMemo(
    () => [
      {
        name: "Predictive score",
        color: "#344b42",
        points: rows.map((row) => ({ x: toDay(row.date), y: row.score })),
      },
    ],
    [rows],
  );

  const tableRows = [...rows].reverse();

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">PERFORMANCE TRENDS</div>

            <h1>{data ? data.project.name : "Project trends"}</h1>

            <p className={styles.subtitle}>
              Earned value history for this project. Capture a snapshot after
              each reporting cycle to build the trend lines.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button
              className="primary-button"
              disabled={capturing || !data}
              onClick={() => void capture()}
              type="button"
            >
              {capturing ? "Capturing…" : "Capture snapshot now"}
            </button>

            <Link className="secondary-link-button" href={`${base}/forecast`}>
              Open forecast control
            </Link>
          </div>
        </header>

        {message && (
          <div aria-live="polite" className={styles.message}>
            {message}
          </div>
        )}

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && (
          <div className={styles.loading}>Loading trends…</div>
        )}

        {data && intel && (
          <>
            <section aria-label="Key indicators" className={styles.kpis}>
              <article className={`${styles.kpi} ${styles.kpiDark}`}>
                <div className={styles.kpiLabel}>PREDICTIVE SCORE</div>
                <div className={styles.kpiValue}>
                  {Math.round(intel.predictiveScore)}
                </div>
                <div className={styles.kpiSub}>
                  <span
                    className={`${styles.pill} ${
                      RISK_CLASS[intel.predictiveRisk]
                    }`}
                  >
                    {RISK_LABEL[intel.predictiveRisk]}
                  </span>
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COST INDEX (CPI)</div>
                <div
                  className={`${styles.kpiValue} ${
                    intel.cpi < 1 ? styles.bad : styles.good
                  }`}
                >
                  {Number(intel.cpi).toFixed(2)}
                </div>
                <div className={styles.kpiSub}>
                  {intel.cpi < 1 ? "Over budget for work done" : "On or under budget"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SCHEDULE INDEX (SPI)</div>
                <div
                  className={`${styles.kpiValue} ${
                    intel.spi < 1 ? styles.bad : styles.good
                  }`}
                >
                  {Number(intel.spi).toFixed(2)}
                </div>
                <div className={styles.kpiSub}>
                  {intel.spi < 1 ? "Behind planned progress" : "On or ahead of plan"}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FORECAST COST (EAC)</div>
                <div className={styles.kpiValue}>
                  {money(Number(intel.estimateAtCompletion))}
                </div>
                <div className={styles.kpiSub}>
                  Budget {money(Number(intel.bac))}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>VARIANCE AT COMPLETION</div>
                <div
                  className={`${styles.kpiValue} ${
                    intel.varianceAtCompletion < 0 ? styles.bad : styles.good
                  }`}
                >
                  {signedMoney(Number(intel.varianceAtCompletion))}
                </div>
                <div className={styles.kpiSub}>
                  Finish {formatIso(intel.expectedForecastFinishDate)}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TREND</div>
                <div
                  className={`${styles.kpiValue} ${styles.kpiSmall} ${
                    TREND_CLASS[intel.trend]
                  }`}
                >
                  {TREND_LABEL[intel.trend]}
                </div>
                <div className={styles.kpiSub}>
                  {intel.snapshotCount} snapshot
                  {intel.snapshotCount === 1 ? "" : "s"} recorded
                </div>
              </article>
            </section>

            {data.history.length < 2 && (
              <div className={styles.hint}>
                <strong>Only {data.history.length} snapshot
                  {data.history.length === 1 ? "" : "s"} recorded.</strong>
                <span>
                  The charts show today&apos;s live position. Capture a
                  snapshot after each period to draw trend lines.
                </span>
              </div>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">COST S-CURVE</div>
                  <h2>Planned vs earned vs actual</h2>
                </div>

                <span className={styles.muted}>
                  Data date {formatIso(intel.dataDate)}
                </span>
              </header>

              <LineChart
                ariaLabel="Cost S-curve: planned value, earned value and actual cost over time"
                formatX={formatDay}
                formatY={money}
                height={320}
                refs={[
                  {
                    y: Number(intel.bac),
                    label: "Budget (BAC)",
                    color: "#19201e",
                  },
                  {
                    y: Number(intel.estimateAtCompletion),
                    label: "Forecast (EAC)",
                    color: "#d1a13a",
                  },
                ]}
                series={costSeries}
                yMin={0}
              />
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">PERFORMANCE INDICES</div>
                    <h2>CPI and SPI</h2>
                  </div>
                </header>

                <LineChart
                  ariaLabel="Cost and schedule performance indices over time"
                  formatX={formatDay}
                  formatY={(value) => value.toFixed(2)}
                  height={260}
                  refs={[{ y: 1, label: "Target 1.00", color: "#7a847f" }]}
                  series={indexSeries}
                />
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">PREDICTIVE SCORE</div>
                    <h2>Forecast health</h2>
                  </div>
                </header>

                <LineChart
                  ariaLabel="Predictive score over time"
                  formatX={formatDay}
                  formatY={(value) => String(Math.round(value))}
                  height={260}
                  series={scoreSeries}
                  yMax={100}
                  yMin={0}
                />
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">HISTORY</div>
                  <h2>Snapshots</h2>
                </div>

                <span className={styles.muted}>
                  {rows.length} data point{rows.length === 1 ? "" : "s"}
                </span>
              </header>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>DATA DATE</th>
                      <th>PLANNED</th>
                      <th>EARNED</th>
                      <th>ACTUAL</th>
                      <th>CPI</th>
                      <th>SPI</th>
                      <th>FORECAST (EAC)</th>
                      <th>SCORE</th>
                    </tr>
                  </thead>

                  <tbody>
                    {tableRows.map((row) => (
                      <tr key={row.id}>
                        <td>
                          {formatIso(row.date)}
                          {row.live && (
                            <span className={styles.live}>LIVE</span>
                          )}
                        </td>
                        <td>{moneyFull(row.pv)}</td>
                        <td>{moneyFull(row.ev)}</td>
                        <td>{moneyFull(row.ac)}</td>
                        <td className={row.cpi < 1 ? styles.bad : ""}>
                          {row.cpi.toFixed(2)}
                        </td>
                        <td className={row.spi < 1 ? styles.bad : ""}>
                          {row.spi.toFixed(2)}
                        </td>
                        <td>{moneyFull(row.eac)}</td>
                        <td>
                          <span
                            className={`${styles.pill} ${RISK_CLASS[row.risk]}`}
                          >
                            {Math.round(row.score)}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {tableRows.length === 0 && (
                      <tr>
                        <td className={styles.emptyCell} colSpan={8}>
                          No snapshots yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <p className={styles.note}>{intel.explanation}</p>
          </>
        )}
      </main>
    </div>
  );
}
