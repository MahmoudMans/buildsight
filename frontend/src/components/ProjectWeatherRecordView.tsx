"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProduction, getProjectRiskControl } from "@/lib/api";
import { formatDay, plural, startOfToday, trunc, words } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import { CONDITIONS, CONDITION_CODE, CONDITION_LABEL, DEFAULT_WINDOW, WINDOWS, buildWeather, hoursText, isAdverse, pct, verdictText, weatherMarkdown, type GridCell, type MonthRow, type Weather, type WeatherDelay } from "@/lib/weatherRecord";
import type { ProductionControl, ProjectDelayEvent, WeatherCondition } from "@/types/project";

import styles from "./ProjectWeatherRecordView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const COLOR: Record<WeatherCondition, string | undefined> = {
  CLEAR: styles.cClear,
  CLOUDY: styles.cCloudy,
  RAIN: styles.cRain,
  WIND: styles.cWind,
  EXTREME_HEAT: styles.cHeat,
  EXTREME_COLD: styles.cCold,
  OTHER: styles.cOther,
};

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function cellClass(cell: GridCell): string {
  if (cell.kind === "report" && cell.condition) {
    return cx(styles.day, COLOR[cell.condition], isAdverse(cell.condition) && styles.cAdverse, cell.today && styles.dayToday);
  }

  return cx(styles.day, cell.kind === "missing" && styles.dayMissing, cell.kind === "rest" && styles.dayRest, cell.kind === "future" && styles.dayFuture, cell.today && styles.dayToday);
}

function cellTitle(cell: GridCell): string {
  if (cell.kind === "report" && cell.condition) {
    return `${formatDay(cell.day)}: ${CONDITION_LABEL[cell.condition].toLowerCase()}, ${hoursText(cell.hours)} labour hours`;
  }

  return cell.kind === "missing" ? `${formatDay(cell.day)}: no site report` : cell.kind === "future" ? `${formatDay(cell.day)}: not reported yet` : formatDay(cell.day);
}

function verdictChip(delay: WeatherDelay): { label: string; className: string | undefined } {
  return delay.verdict === "supported" ? { label: "Backed by the log", className: styles.chipGood } : delay.verdict === "short" ? { label: "Claims more than logged", className: styles.chipWatch } : { label: "Nothing logged", className: styles.chipBad };
}

function Calendar({ weather }: { weather: Weather }) {
  return (
    <div className={styles.calendar} role="group" aria-label="Weather reported on each of the last ten weeks">
      <div aria-hidden="true" className={styles.week}>
        <span />
        {DOW.map((name) => (
          <span className={styles.dow} key={name}>
            {name}
          </span>
        ))}
      </div>

      {weather.grid.map((week) => (
        <div className={styles.week} key={week[0]?.day}>
          <span className={styles.weekName}>{formatDay(week[0]?.day ?? 0).slice(0, 6).trim()}</span>

          {week.map((cell) => (
            <span className={cellClass(cell)} key={cell.day} title={cellTitle(cell)}>
              {cell.kind === "report" && cell.condition ? CONDITION_CODE[cell.condition] : cell.kind === "missing" ? "?" : ""}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function MonthLine({ row }: { row: MonthRow }) {
  return (
    <li className={styles.monthRow}>
      <span className={styles.monthName}>{row.label}</span>

      <span
        aria-label={`${row.label}: ${CONDITIONS.filter((condition) => row.counts[condition] > 0)
          .map((condition) => `${row.counts[condition]} ${CONDITION_LABEL[condition].toLowerCase()}`)
          .join(", ")}`}
        className={styles.stack}
        role="img"
      >
        {CONDITIONS.map((condition) =>
          row.counts[condition] > 0 ? <i className={COLOR[condition]} key={condition} style={{ flexGrow: row.counts[condition] }} title={`${row.counts[condition]} ${CONDITION_LABEL[condition].toLowerCase()}`} /> : null,
        )}
      </span>

      <span>
        <strong>{row.adverse}</strong> adverse
        <small>
          of {row.reported} reported {plural(row.reported, "day", "days")}
        </small>
      </span>

      <span>
        {row.adverse === 0 ? "No adverse days" : row.lost > 0 ? `About ${hoursText(row.lost)} h lost` : "No labour lost"}
        {row.adverseHours !== null && row.normalHours !== null && (
          <small>
            {hoursText(row.adverseHours)} h on adverse days against {hoursText(row.normalHours)} h on a normal day
          </small>
        )}
      </span>

      <span>
        {row.missing > 0 ? <em className={cx(styles.chip, styles.chipWatch)}>{row.missing} no report</em> : <small>Every weekday reported</small>}
      </span>
    </li>
  );
}

export function ProjectWeatherRecordView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [production, setProduction] = useState<ProductionControl | null>(null);
  const [events, setEvents] = useState<ProjectDelayEvent[] | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [months, setMonths] = useState(DEFAULT_WINDOW);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    Promise.allSettled([getProjectProduction(projectId), getProjectRiskControl(projectId)]).then(([prod, risk]) => {
      if (cancelled) {
        return;
      }

      if (prod.status !== "fulfilled") {
        setState("error");
        return;
      }

      setProduction(prod.value);
      setEvents(risk.status === "fulfilled" ? (risk.value.delays ?? []) : null);
      setState("ready");
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const built = useMemo(() => (production ? buildWeather(production, events, today, months) : null), [production, events, today, months]);
  const weather = built && built.ok ? built.weather : null;
  const projectName = production?.project?.name ?? "Project";

  const tally = useMemo(() => {
    if (!weather) {
      return [];
    }

    return CONDITIONS.map((condition) => ({ condition, count: weather.months.reduce((sum, row) => sum + row.counts[condition], 0) }));
  }, [weather]);

  const claimsShort = weather?.delays ? weather.delays.filter((delay) => delay.verdict !== "supported").length : 0;

  async function copySummary() {
    if (!weather) {
      return;
    }

    const ok = await copyText(weatherMarkdown(weather, projectName, today));

    setMessage(ok ? "Copied the record as Markdown." : "Could not copy the record.");
  }

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">WEATHER RECORD</div>

            <h1>How many working days has the weather really cost us?</h1>

            <p className={styles.subtitle}>
              The weather written on every site report, counted month by month, set against the labour that turned up and the weather delay events on file. It is the evidence behind an extension of time, and shows where it has holes.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/risk-board`}>
              Risk board
            </Link>

            <Link className="secondary-link-button" href={`${base}/production-board`}>
              Production board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the site reports…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the site reports. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No submitted or approved site reports exist yet, so there is no weather to record.</div>
          </section>
        )}

        {state === "ready" && weather && (
          <>
            <section aria-label="Weather summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>ADVERSE DAYS</div>
                <div className={styles.kpiValue}>{weather.adverse}</div>
                <div className={styles.kpiSub}>
                  {pct(weather.adverseShare)} of {weather.reported} reported {plural(weather.reported, "day", "days")}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>LABOUR LOST</div>
                <div className={styles.kpiValue}>{weather.adverse === 0 ? "0 h" : `~${hoursText(weather.lost)} h`}</div>
                <div className={styles.kpiSub}>below a normal day, an indication only</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WORST MONTH</div>
                <div className={styles.kpiValue}>{weather.worst ? weather.worst.label : "None"}</div>
                <div className={styles.kpiSub}>{weather.worst ? `${weather.worst.adverse} adverse ${plural(weather.worst.adverse, "day", "days")}` : "no adverse day reported"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO REPORT</div>
                <div className={cx(styles.kpiValue, weather.missing > 0 && styles.neg)}>{weather.missing}</div>
                <div className={styles.kpiSub}>{plural(weather.missing, "weekday", "weekdays")} with nothing on file, so the weather cannot be shown</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WEATHER DELAYS</div>
                <div className={styles.kpiValue}>{weather.delays === null ? "—" : weather.delays.length}</div>
                <div className={styles.kpiSub}>{weather.delays === null ? "delay events could not be loaded" : weather.delays.length === 0 ? "no weather delay event on file" : claimsShort > 0 ? `${claimsShort} claim more than the log supports` : "all backed by the log"}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Months</span>

                <div aria-label="Months shown" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={months === option.months}
                      className={cx(styles.segment, months === option.months && styles.segmentOn)}
                      key={option.months}
                      onClick={() => {
                        setMonths(option.months);
                        setMessage(null);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.actions}>
                <button className={styles.linkButton} onClick={copySummary} type="button">
                  Copy as Markdown
                </button>
              </div>
            </section>

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            {weather.latest !== null && today - weather.latest > 3 && (
              <div className="offline-banner">
                <div>
                  <strong>The latest site report is from {formatDay(weather.latest)}, so recent weather is missing from this record.</strong>
                </div>
              </div>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">LAST TEN WEEKS</div>
                  <h2>The weather, day by day</h2>
                </div>

                <span className={styles.muted}>Not affected by the months chosen above</span>
              </header>

              <div className={styles.calendarRow}>
                <Calendar weather={weather} />

                <div>
                  <ul className={styles.tally}>
                    {tally.map((item) => (
                      <li key={item.condition}>
                        <i className={COLOR[item.condition]} />
                        <span>{CONDITION_LABEL[item.condition]}</span>
                        <em>
                          {item.count} {plural(item.count, "day", "days")}
                        </em>
                      </li>
                    ))}
                  </ul>

                  <p className={styles.tallyNote}>
                    Counts cover the {months} months chosen above.
                    {weather.longestSpell ? ` The longest run of adverse days was ${weather.longestSpell.length} ${plural(weather.longestSpell.length, "day", "days")}, from ${formatDay(weather.longestSpell.from)}.` : " No adverse weather was reported in that time."}
                  </p>
                </div>
              </div>

              <ul className={styles.legend}>
                {CONDITIONS.map((condition) => (
                  <li key={condition}>
                    <i className={cx(styles.swatch, COLOR[condition])} />
                    {CONDITION_CODE[condition]} {CONDITION_LABEL[condition]}
                  </li>
                ))}
                <li>
                  <i className={cx(styles.swatch, styles.dayMissing)} />
                  ? Weekday with no report
                </li>
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">MONTH BY MONTH</div>
                  <h2>Adverse days and the labour they cost</h2>
                </div>

                <span className={styles.muted}>
                  {formatDay(weather.from)} to {formatDay(weather.to)}
                </span>
              </header>

              <ul className={styles.monthRows}>
                {[...weather.months].reverse().map((row) => (
                  <MonthLine key={row.month} row={row} />
                ))}
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WEATHER DELAY EVENTS</div>
                  <h2>What has been claimed, against what the reports show</h2>
                </div>

                <span className={styles.muted}>{weather.delays === null ? "unavailable" : `${weather.delays.length} in this period`}</span>
              </header>

              {weather.delays === null ? (
                <p className={styles.quiet}>The delay events could not be loaded, so the claims cannot be compared with the weather log.</p>
              ) : weather.delays.length === 0 ? (
                <p className={styles.quiet}>No delay event caused by weather overlaps these months.</p>
              ) : (
                <ul className={styles.events}>
                  {weather.delays.map((delay) => {
                    const chip = verdictChip(delay);

                    return (
                      <li className={styles.event} key={delay.id}>
                        <span>
                          <strong>{delay.reference}</strong>
                          <small>{words(delay.status)}</small>
                        </span>

                        <span>
                          {trunc(delay.title, 70)}
                          <small>
                            {formatDay(delay.from)} to {delay.open ? "still open" : formatDay(delay.to)}
                            {delay.excusable ? ", excusable" : ""}
                            {delay.compensable ? ", compensable" : ""}
                          </small>
                        </span>

                        <span className={styles.eventVerdict}>
                          {verdictText(delay)}
                          <small>
                            {delay.reportedDays} {plural(delay.reportedDays, "report", "reports")} in the period
                          </small>
                        </span>

                        <span className={styles.eventChip}>
                          <em className={cx(styles.chip, chip.className)}>{chip.label}</em>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {weather.uncovered !== null && weather.adverse > 0 && (
                <p className={styles.tallyNote}>
                  {weather.uncovered === 0
                    ? "Every adverse day in these months falls inside a weather delay event."
                    : `${weather.uncovered} of the ${weather.adverse} adverse ${plural(weather.adverse, "day", "days")} fall outside any weather delay event. That is not a fault in itself, since a wet day does not always delay the programme, but it is where an unclaimed delay could be hiding.`}
                </p>
              )}
            </section>

            <p className={styles.note}>
              An adverse day is a site report that records rain, wind, extreme heat or extreme cold; clear, cloudy and other count as ordinary weather. Labour below a normal day compares each adverse day with the average labour on clear or cloudy days in the same month, falling back to the average across the months shown, and is an indication of lost time, not a measure of it. Draft reports are left out, a day with several reports counts as adverse if any of them says so, and a weekday is only treated as unreported from the first report onwards and never for today. A weekday with no report cannot be shown either way, and public holidays appear there too. A delay event is checked by counting the adverse days reported between its start and end dates, or up to today while it is open, and comparing that with the days of delay it forecasts. The figures cover {formatDay(weather.from)} to {formatDay(weather.to)}.
              {weather.drafts > 0 ? ` ${weather.drafts} draft ${plural(weather.drafts, "report was", "reports were")} left out.` : ""}
              {weather.duplicates > 0 ? ` ${weather.duplicates} ${plural(weather.duplicates, "extra report shares", "extra reports share")} a day with another report.` : ""}
              {weather.skipped > 0 ? ` ${weather.skipped} ${plural(weather.skipped, "report has", "reports have")} no usable date and ${plural(weather.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
