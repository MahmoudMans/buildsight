"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectCommercial } from "@/lib/api";
import { MODES, buildCashPosition, cash, cashMarkdown, runText, signedMoney, type CashPosition, type Mode, type Period } from "@/lib/cashPosition";
import { formatDay, plural, startOfToday } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { CommercialControl } from "@/types/project";

import styles from "./ProjectCashPositionView.module.css";

const PAD = { left: 62, right: 16, top: 26, bottom: 30 };

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function niceTicks(min: number, max: number, target = 5): number[] {
  const span = max - min || 1;
  const rough = span / target;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const norm = rough / magnitude;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * magnitude;
  const ticks: number[] = [];

  for (let value = Math.ceil(min / step) * step; value <= max + step * 1e-9; value += step) {
    ticks.push(Math.abs(value) < step * 1e-9 ? 0 : value);
  }

  return ticks;
}

function Chart({ flow, mode, today, width }: { flow: CashPosition; mode: Mode; today: number; width: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const periods = flow.periods;
  const height = width < 520 ? 250 : 310;
  const innerW = Math.max(10, width - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  const band = innerW / periods.length;
  const values = periods.flatMap((period) => (mode === "running" ? [period.cum, period.cumPlan] : [period.net, period.planNet]));
  const low = Math.min(0, ...values);
  const high = Math.max(0, ...values);
  const pad = (high - low || 1) * 0.08;
  const bottom = low < 0 ? low - pad : 0;
  const top = high > 0 ? high + pad : pad;
  const x = (index: number) => PAD.left + band * (index + 0.5);
  const y = (value: number) => PAD.top + (1 - (value - bottom) / (top - bottom || 1)) * innerH;
  const ticks = niceTicks(bottom, top);
  const every = Math.max(1, Math.ceil(50 / band));
  const todayX = flow.todayIndex === null ? null : PAD.left + band * (flow.todayIndex + Math.min(1, Math.max(0, (today - (periods[flow.todayIndex] as Period).start) / ((periods[flow.todayIndex] as Period).end - (periods[flow.todayIndex] as Period).start + 1))));
  const barW = Math.max(3, Math.min(18, band * 0.34));

  const path = (from: number, to: number, pick: (period: Period) => number) =>
    periods
      .slice(from, to + 1)
      .map((period, offset) => `${offset === 0 ? "M" : "L"}${x(from + offset).toFixed(1)} ${y(pick(period)).toFixed(1)}`)
      .join(" ");

  const join = flow.lastActual;
  const last = periods.length - 1;
  const lowPoint = flow.low;
  const lowX = lowPoint ? x(lowPoint.index) : 0;
  const lowY = lowPoint ? y(lowPoint.value) : 0;
  const lowFlip = lowPoint !== null && lowX > PAD.left + innerW * 0.6;
  const lowBelow = lowPoint !== null && lowY + 24 < PAD.top + innerH;
  const lowAnchor = lowBelow ? "middle" : lowFlip ? "end" : "start";

  function move(event: MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const index = Math.floor((event.clientX - box.left - PAD.left) / band);

    setHover(index < 0 || index >= periods.length ? null : index);
  }

  const hovered = hover === null ? null : (periods[hover] as Period);
  const hoverFlip = hover !== null && x(hover) > PAD.left + innerW * 0.55;
  const readout = hovered ? (mode === "running" ? `${hovered.label}: ${cash(hovered.cum)} so far, plan ${cash(hovered.cumPlan)}` : `${hovered.label}: net ${cash(hovered.net)}, plan ${cash(hovered.planNet)}`) : "";

  return (
    <svg
      aria-label={mode === "running" ? `Running net cash from ${periods[0]?.label} to ${periods[last]?.label}. Latest view ends at ${cash((periods[last] as Period).cum)} against ${cash((periods[last] as Period).cumPlan)} planned${lowPoint ? `, with a low of ${cash(lowPoint.value)}` : ""}.` : `Net cash in each period from ${periods[0]?.label} to ${periods[last]?.label}, planned against actual or forecast.`}
      className={styles.chart}
      height={height}
      onMouseLeave={() => setHover(null)}
      onMouseMove={move}
      role="img"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      {low < 0 && <rect className={styles.deficit} height={Math.max(0, PAD.top + innerH - y(0))} width={innerW} x={PAD.left} y={y(0)} />}

      {ticks.map((value) => (
        <g key={value}>
          <line className={value === 0 ? styles.zero : styles.grid} x1={PAD.left} x2={width - PAD.right} y1={y(value)} y2={y(value)} />
          <text className={styles.axis} textAnchor="end" x={PAD.left - 8} y={y(value) + 4}>
            {cash(value)}
          </text>
        </g>
      ))}

      {periods.map((period, index) =>
        index % every === 0 ? (
          <text className={styles.axis} key={period.id} textAnchor="middle" x={x(index)} y={PAD.top + innerH + 18}>
            {period.label}
          </text>
        ) : null,
      )}

      {hover !== null && <rect className={styles.hoverBand} height={innerH} width={band} x={PAD.left + band * hover} y={PAD.top} />}

      {mode === "running" ? (
        <>
          <path className={styles.planLine} d={path(0, last, (period) => period.cumPlan)} />

          {join === null ? (
            <path className={styles.forecastLine} d={path(0, last, (period) => period.cum)} />
          ) : (
            <>
              <path className={styles.actualLine} d={path(0, join, (period) => period.cum)} />
              {join < last && <path className={styles.forecastLine} d={path(join, last, (period) => period.cum)} />}
              <circle className={styles.dotActual} cx={x(join)} cy={y((periods[join] as Period).cum)} r={4} />
            </>
          )}

          {lowPoint && (
            <g>
              <circle className={styles.dotLow} cx={lowX} cy={lowY} r={4.5} />
              <text className={styles.mark} textAnchor={lowAnchor} x={lowBelow ? lowX : lowX + (lowFlip ? -9 : 9)} y={lowBelow ? lowY + 18 : lowY - 9}>
                Lowest {cash(lowPoint.value)}
              </text>
            </g>
          )}
        </>
      ) : (
        periods.map((period, index) => (
          <g key={period.id}>
            <rect className={styles.barPlan} height={Math.abs(y(period.planNet) - y(0))} rx={2} width={barW} x={x(index) - barW - 1} y={Math.min(y(0), y(period.planNet))} />
            <rect className={period.basis === "actual" ? styles.barActual : styles.barForecast} height={Math.abs(y(period.net) - y(0))} rx={2} width={barW} x={x(index) + 1} y={Math.min(y(0), y(period.net))} />
          </g>
        ))
      )}

      {todayX !== null && (
        <g>
          <line className={styles.asOf} x1={todayX} x2={todayX} y1={PAD.top - 4} y2={PAD.top + innerH} />
          <text className={styles.mark} textAnchor="middle" x={todayX} y={PAD.top - 9}>
            today
          </text>
        </g>
      )}

      {hovered && (
        <text className={styles.readout} textAnchor={hoverFlip ? "end" : "start"} x={x(hover as number) + (hoverFlip ? -8 : 8)} y={PAD.top + 12}>
          {readout}
        </text>
      )}
    </svg>
  );
}

function verdictOf(flow: CashPosition): string {
  const parts: string[] = [];
  const last = flow.periods[flow.periods.length - 1] as Period;
  const at = flow.lastActual === null ? null : (flow.periods[flow.lastActual] as Period);

  if (flow.toDate && at) {
    const gap = flow.toDate.gap;

    parts.push(Math.abs(gap) < 0.5 ? `To the end of ${at.label} cash is exactly on plan.` : `To the end of ${at.label} the running total is ${cash(Math.abs(gap))} ${gap < 0 ? "behind" : "ahead of"} plan.`);
  } else {
    parts.push("No period has actual figures yet, so everything below is forecast.");
  }

  const tail = flow.runs[flow.runs.length - 1];

  if (flow.low === null) {
    parts.push("On the latest view the running total never goes below zero.");
  } else if (tail && tail.to === flow.periods.length - 1) {
    parts.push(`On the latest view it is still below zero at the end of ${last.label}.`);
  } else if (tail) {
    const back = flow.periods[tail.to + 1] as Period;

    parts.push(`On the latest view it is back above zero in ${back.label}, after bottoming out at ${cash(flow.low.value)}.`);
  }

  if (Math.abs(flow.end.gap) >= 0.5) {
    parts.push(`It finishes ${cash(Math.abs(flow.end.gap))} ${flow.end.gap < 0 ? "below" : "above"} the planned ${cash(flow.end.plan)}.`);
  }

  return parts.join(" ");
}

export function ProjectCashPositionView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<CommercialControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [mode, setMode] = useState<Mode>("running");
  const [message, setMessage] = useState<string | null>(null);
  const [width, setWidth] = useState(900);
  const holder = useRef<HTMLDivElement | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectCommercial(projectId)
      .then((result) => {
        if (!cancelled) {
          setData(result);
          setState("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setState("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const built = useMemo(() => (data ? buildCashPosition(data, today) : null), [data, today]);
  const flow: CashPosition | null = built && built.ok ? built.cash : null;

  useEffect(() => {
    const node = holder.current;

    if (!node || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const measure = () => setWidth(Math.max(300, Math.floor(node.clientWidth)));
    const observer = new ResizeObserver(measure);

    measure();
    observer.observe(node);

    return () => observer.disconnect();
  }, [flow]);

  const projectName = data?.project?.name ?? "Project";

  async function copySummary() {
    if (!flow) {
      return;
    }

    const ok = await copyText(cashMarkdown(flow, projectName, today));

    setMessage(ok ? "Copied the figures as Markdown." : "Could not copy the figures.");
  }

  const at = flow && flow.lastActual !== null ? (flow.periods[flow.lastActual] as Period) : null;
  const final = flow ? (flow.periods[flow.periods.length - 1] as Period) : null;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">CASH POSITION</div>

            <h1>Is the cash arriving when we need it?</h1>

            <p className={styles.subtitle}>
              The running total of money in minus money out, period by period: what has actually happened, what is forecast, and how far both sit from the plan, with the certificates still waiting to turn into cash.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/commercial-board`}>
              Commercial board
            </Link>

            <Link className="secondary-link-button" href={`${base}/spend-board`}>
              Spend board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the cash-flow periods…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the commercial data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>
              {built.reason === "empty" ? "No cash-flow periods have been entered yet. Once periods with planned, forecast and actual inflow and outflow exist, they will appear here." : "None of the cash-flow periods has usable dates."}
            </div>
          </section>
        )}

        {state === "ready" && flow && final && (
          <>
            <section aria-label="Cash position summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>TO DATE</div>
                <div className={styles.kpiValue}>{flow.toDate ? cash(flow.toDate.actual) : "—"}</div>
                <div className={styles.kpiSub}>{flow.toDate && at ? `${signedMoney(flow.toDate.gap)} against plan at the end of ${at.label}` : "no period has actual figures yet"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LOWEST POINT</div>
                <div className={cx(styles.kpiValue, flow.low !== null && styles.neg)}>{flow.low ? cash(flow.low.value) : "None"}</div>
                <div className={styles.kpiSub}>{flow.low ? `end of ${(flow.periods[flow.low.index] as Period).label}, the most to fund` : "never below zero on this view"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ENDS AT</div>
                <div className={styles.kpiValue}>{cash(flow.end.latest)}</div>
                <div className={styles.kpiSub}>
                  {signedMoney(flow.end.gap)} against {cash(flow.end.plan)} planned
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>CERTIFIED, UNPAID</div>
                <div className={styles.kpiValue}>{cash(flow.receivables.unpaidAmount)}</div>
                <div className={styles.kpiSub}>{flow.receivables.unpaidLateAmount > 0 ? `${cash(flow.receivables.unpaidLateAmount)} past its payment date` : "nothing past its payment date"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>RETENTION HELD</div>
                <div className={styles.kpiValue}>{cash(flow.receivables.retention)}</div>
                <div className={styles.kpiSub}>released later, not counted as cash</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div aria-label="Chart" className={styles.segmented} role="group">
                {MODES.map((option) => (
                  <button aria-pressed={mode === option.key} className={cx(styles.segment, mode === option.key && styles.segmentOn)} key={option.key} onClick={() => setMode(option.key)} type="button">
                    {option.label}
                  </button>
                ))}
              </div>

              <button className={styles.linkButton} onClick={copySummary} type="button">
                Copy as Markdown
              </button>
            </section>

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">{mode === "running" ? "RUNNING TOTAL" : "PERIOD BY PERIOD"}</div>
                  <h2>{mode === "running" ? "Net cash since the first period" : "Net cash in each period"}</h2>
                </div>

                <span className={styles.muted}>
                  {flow.periods.length} {plural(flow.periods.length, "period", "periods")}, {(flow.periods[0] as Period).label} to {final.label}
                </span>
              </header>

              <p className={styles.verdict}>{verdictOf(flow)}</p>

              <div className={styles.chartWrap} ref={holder}>
                <Chart flow={flow} mode={mode} today={today} width={width} />
              </div>

              <ul className={styles.legend}>
                {mode === "running" ? (
                  <>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchPlan)} />
                      Planned
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchActual)} />
                      Actual, to the last closed period
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchForecast)} />
                      Forecast
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchDeficit)} />
                      Below zero
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchBarPlan)} />
                      Planned net
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchActual)} />
                      Actual net
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.swatchBarForecast)} />
                      Forecast net
                    </li>
                  </>
                )}
              </ul>
            </section>

            <div className={styles.twoUp}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">WHAT STANDS OUT</div>
                    <h2>Where it departs from plan</h2>
                  </div>
                </header>

                <ul className={styles.records}>
                  {flow.runs.map((run) => (
                    <li key={`run-${run.from}`}>
                      <div className={styles.recTop}>
                        <span>{runText(flow, run)}</span>
                      </div>
                    </li>
                  ))}

                  {flow.shortfalls.map((item) => {
                    const period = flow.periods[item.index] as Period;

                    return (
                      <li key={`gap-${period.id}`}>
                        <div className={styles.recTop}>
                          <strong>{period.label}</strong>
                          <span>
                            {cash(Math.abs(item.gap))} below the planned net ({period.basis === "actual" ? "actual" : "forecast"})
                          </span>
                        </div>
                      </li>
                    );
                  })}

                  {flow.runs.length === 0 && flow.shortfalls.length === 0 && (
                    <li>
                      <div className={styles.recTop}>
                        <span>No period falls below plan and the running total stays above zero.</span>
                      </div>
                    </li>
                  )}

                  {flow.unrecorded > 0 && (
                    <li>
                      <div className={styles.recTop}>
                        <span>
                          {flow.unrecorded} {plural(flow.unrecorded, "period has", "periods have")} ended without actual figures, so the forecast stands in for {plural(flow.unrecorded, "it", "them")}.
                        </span>
                      </div>
                    </li>
                  )}
                </ul>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">RECEIVABLES</div>
                    <h2>Money behind these numbers</h2>
                  </div>
                </header>

                <ul className={styles.records}>
                  <li>
                    <div className={styles.recTop}>
                      <strong>{cash(flow.receivables.appliedAmount)}</strong>
                      <span>applied for, not yet certified</span>
                    </div>
                    <div className={styles.recMeta}>
                      <span>
                        {flow.receivables.appliedCount} {plural(flow.receivables.appliedCount, "application", "applications")}
                      </span>
                      {flow.receivables.appliedLate > 0 && <em className={styles.lateTag}>{flow.receivables.appliedLate} past the certification date</em>}
                    </div>
                  </li>

                  <li>
                    <div className={styles.recTop}>
                      <strong>{cash(flow.receivables.unpaidAmount)}</strong>
                      <span>certified, not yet paid</span>
                    </div>
                    <div className={styles.recMeta}>
                      <span>
                        {flow.receivables.unpaidCount} {plural(flow.receivables.unpaidCount, "certificate", "certificates")}
                      </span>
                      {flow.receivables.unpaidLateCount > 0 && (
                        <em className={styles.lateTag}>
                          {cash(flow.receivables.unpaidLateAmount)} past the payment date ({flow.receivables.unpaidLateCount})
                        </em>
                      )}
                    </div>
                  </li>

                  <li>
                    <div className={styles.recTop}>
                      <strong>{cash(flow.receivables.retention)}</strong>
                      <span>retention held on certificates</span>
                    </div>
                    <div className={styles.recMeta}>
                      <span>Comes back at the retention release dates, not in the periods above.</span>
                    </div>
                  </li>
                </ul>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">THE FIGURES</div>
                  <h2>Every period</h2>
                </div>

                <span className={styles.muted}>Actual where recorded, otherwise forecast</span>
              </header>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Period</th>
                      <th scope="col">Basis</th>
                      <th className={styles.num} scope="col">
                        Inflow
                      </th>
                      <th className={styles.num} scope="col">
                        Outflow
                      </th>
                      <th className={styles.num} scope="col">
                        Net
                      </th>
                      <th className={styles.num} scope="col">
                        Planned net
                      </th>
                      <th className={styles.num} scope="col">
                        Against plan
                      </th>
                      <th className={styles.num} scope="col">
                        Running total
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {flow.periods.map((period) => (
                      <tr className={cx(period.current && styles.rowOn)} key={period.id}>
                        <th scope="row">
                          <span className={styles.groupName}>{period.label}</span>
                          {period.current && <em className={styles.nowTag}>now</em>}
                        </th>
                        <td>
                          <span className={cx(styles.basis, period.basis === "actual" ? styles.basisActual : styles.basisForecast)}>{period.basis === "actual" ? "Actual" : "Forecast"}</span>
                        </td>
                        <td className={styles.num}>{cash(period.inflow)}</td>
                        <td className={styles.num}>{cash(period.outflow)}</td>
                        <td className={cx(styles.num, period.net < 0 && styles.neg)}>{cash(period.net)}</td>
                        <td className={styles.num}>{cash(period.planNet)}</td>
                        <td className={cx(styles.num, period.vsPlan < -0.5 && styles.neg, period.vsPlan > 0.5 && styles.pos)}>{signedMoney(period.vsPlan)}</td>
                        <td className={cx(styles.num, period.cum < 0 && styles.neg)}>{cash(period.cum)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className={styles.scrollHint}>Swipe the table sideways for the rest of the columns.</p>
            </section>

            <p className={styles.note}>
              Net cash is inflow minus outflow. A period that has ended and has actual inflow or outflow recorded uses the actuals; every other period, including the current one, uses the forecast. The running total starts at zero in the first period and ignores any opening balance, so it shows how much cash the project takes in or has to fund, not the bank balance. Planned figures come from the cash-flow plan, and receivables come from the payment certificates; certificates that are drafts, rejected or void are left out.
              {flow.skipped > 0 ? ` ${flow.skipped} ${plural(flow.skipped, "period has", "periods have")} no usable dates and ${plural(flow.skipped, "was", "were")} left out.` : ""} As of {formatDay(today)}.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
