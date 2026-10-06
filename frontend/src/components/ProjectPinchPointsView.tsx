"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import { formatDay, plural, startOfToday, trunc } from "@/lib/openItems";
import { BAND_LABEL, DEFAULT_RANGE, PAGE, RANGES, TIGHT_DAYS, buildPinch, floatLabel, pinchMarkdown, weekRange, type Band, type Item, type Pinch } from "@/lib/pinchPoints";
import { copyText } from "@/lib/textExport";
import type { ScheduleControl } from "@/types/project";

import styles from "./ProjectPinchPointsView.module.css";

const ALL = "__all";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function short(day: number): string {
  return formatDay(day).slice(0, 6).trim();
}

function bandClass(band: Band): string | undefined {
  return band === "none" ? styles.bandNone : band === "tight" ? styles.bandTight : styles.bandLoose;
}

function whenText(item: Item): string {
  if (item.started) {
    return `Under way, finishes ${short(item.finish)}`;
  }

  return item.start < item.effStart ? `Should have started ${short(item.start)}` : `Starts ${short(item.start)}`;
}

function Items({ empty, items }: { empty: string; items: Item[] }) {
  if (items.length === 0) {
    return <p className={styles.quiet}>{empty}</p>;
  }

  return (
    <ul className={styles.items}>
      {items.map((item) => (
        <li key={item.id}>
          <div className={styles.itemTop}>
            <strong>{item.code}</strong>
            <span>{trunc(item.name, 54)}</span>
            <em className={styles.tradeTag}>{item.discipline}</em>
          </div>

          <div className={styles.itemMeta}>
            <em className={cx(styles.band, bandClass(item.band))}>{floatLabel(item.float)}</em>
            <span className={!item.started && item.start < item.effStart ? styles.late : undefined}>{whenText(item)}</span>
            <span>{item.progress}% done</span>
            {item.holds > 0 && (
              <span className={styles.holds}>
                {item.holds} open {plural(item.holds, "constraint", "constraints")}
              </span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Chart({ onPick, pinch, selected }: { onPick: (index: number) => void; pinch: Pinch; selected: number }) {
  const count = pinch.weeks.length;
  const top = Math.max(1, ...pinch.weeks.map((week) => week.total));
  const step = count <= 14 ? 1 : count <= 30 ? 2 : 4;
  const columns = { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` };

  return (
    <div className={styles.chartWrap}>
      <div className={styles.yTop}>{top}</div>

      <div className={styles.chart} role="group" style={columns} aria-label="Work in flight each week, split by how much room it has">
        {pinch.weeks.map((week, index) => (
          <button
            aria-label={`Week of ${weekRange(week.start, week.end)}: ${week.none} with no room, ${week.tight} tight, ${week.loose} with room to spare`}
            aria-pressed={selected === index}
            className={cx(styles.col, selected === index && styles.colOn, week.current && styles.colNow)}
            key={week.start}
            onClick={() => onPick(index)}
            title={`Week of ${weekRange(week.start, week.end)}: ${week.none} no room, ${week.tight} tight, ${week.loose} room to spare`}
            type="button"
          >
            <span className={styles.stack}>
              <i className={styles.segNone} style={{ flexBasis: `${(week.none / top) * 100}%` }} />
              <i className={styles.segTight} style={{ flexBasis: `${(week.tight / top) * 100}%` }} />
              <i className={styles.segLoose} style={{ flexBasis: `${(week.loose / top) * 100}%` }} />
            </span>
          </button>
        ))}
      </div>

      <div className={styles.axis} style={columns}>
        {pinch.weeks.map((week, index) => (
          <span className={cx(styles.tick, index % step === 0 && index % (step * 2) !== 0 && styles.tickMinor)} key={week.start}>
            {index % step === 0 ? (index === 0 ? "Now" : short(week.start)) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ProjectPinchPointsView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [rangeKey, setRangeKey] = useState(DEFAULT_RANGE);
  const [trade, setTrade] = useState(ALL);
  const [picked, setPicked] = useState<number | null>(null);
  const [shownWeek, setShownWeek] = useState(PAGE);
  const [shownNext, setShownNext] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectSchedule(projectId)
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

  const weeksShown = RANGES.find((item) => item.key === rangeKey)?.weeks ?? 26;
  const built = useMemo(() => (data ? buildPinch(data, today, weeksShown, trade === ALL ? null : trade) : null), [data, today, weeksShown, trade]);
  const pinch = built && built.ok ? built.pinch : null;
  const projectName = data?.project?.name ?? "Project";
  const selected = pinch ? Math.min(pinch.weeks.length - 1, Math.max(0, picked ?? pinch.tightestIndex ?? 0)) : 0;
  const week = pinch ? pinch.weeks[selected] : undefined;
  const now = pinch ? pinch.weeks[0] : undefined;
  const worst = pinch && pinch.tightestIndex !== null ? pinch.weeks[pinch.tightestIndex] : undefined;
  const tradeOptions = pinch ? (trade !== ALL && !pinch.disciplines.includes(trade) ? [...pinch.disciplines, trade] : pinch.disciplines) : [];

  function reset() {
    setPicked(null);
    setShownWeek(PAGE);
    setShownNext(PAGE);
    setMessage(null);
  }

  async function copySummary() {
    if (!pinch) {
      return;
    }

    const ok = await copyText(pinchMarkdown(pinch, projectName, today));

    setMessage(ok ? "Copied the figures as Markdown." : "Could not copy the figures.");
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

            <div className="eyebrow">PINCH POINTS</div>

            <h1>When does the schedule run out of room?</h1>

            <p className={styles.subtitle}>
              Float is how many days an activity can slip before the finish date moves. This sets it against the calendar: how much of the work in each coming week has no room left, which trades are tightest, and what is next to go critical.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/schedule-health`}>
              Schedule health
            </Link>

            <Link className="secondary-link-button" href={`${base}/slip-explorer`}>
              Slip explorer
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the schedule…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the schedule. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "empty" ? "The schedule has no activities yet, so there is no float to look at." : "The schedule's activities have no usable dates, so there is no float to look at."}</div>
          </section>
        )}

        {state === "ready" && pinch && now && (
          <>
            <section aria-label="Pinch points summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>NO ROOM THIS WEEK</div>
                <div className={styles.kpiValue}>{now.none}</div>
                <div className={styles.kpiSub}>
                  of {now.total} {plural(now.total, "activity", "activities")} in flight
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>TIGHTEST WEEK</div>
                <div className={cx(styles.kpiValue, styles.kpiText)}>{worst ? short(worst.start) : "—"}</div>
                <div className={styles.kpiSub}>{worst ? `${worst.none} with no room, ${worst.tight} tight` : `nothing within ${TIGHT_DAYS} days of critical`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NEGATIVE FLOAT</div>
                <div className={cx(styles.kpiValue, pinch.negative.length > 0 && styles.neg)}>{pinch.negative.length}</div>
                <div className={styles.kpiSub}>{pinch.negative.length > 0 ? "already behind what the finish needs" : "none below zero"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NEXT TO GO CRITICAL</div>
                <div className={styles.kpiValue}>{pinch.next.length}</div>
                <div className={styles.kpiSub}>within {TIGHT_DAYS} days of having no room</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>MEDIAN FLOAT</div>
                <div className={styles.kpiValue}>{pinch.medianFloat === null ? "—" : `${Math.round(pinch.medianFloat * 2) / 2} d`}</div>
                <div className={styles.kpiSub}>
                  across {pinch.items.length} open {plural(pinch.items.length, "activity", "activities")}
                </div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Look ahead</span>

                <div aria-label="How far ahead to look" className={styles.segmented} role="group">
                  {RANGES.map((option) => (
                    <button
                      aria-pressed={rangeKey === option.key}
                      className={cx(styles.segment, rangeKey === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setRangeKey(option.key);
                        reset();
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.controlLabel} htmlFor="pinch-trade">
                  Trade
                </label>

                <select
                  className={styles.select}
                  id="pinch-trade"
                  onChange={(event) => {
                    setTrade(event.target.value);
                    reset();
                  }}
                  value={trade}
                >
                  <option value={ALL}>All trades</option>
                  {tradeOptions.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
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

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WEEK BY WEEK</div>
                  <h2>Work in flight, by how much room it has</h2>
                </div>

                <span className={styles.muted}>Pick a week to see its activities</span>
              </header>

              <Chart onPick={(index) => { setPicked(index); setShownWeek(PAGE); }} pinch={pinch} selected={selected} />

              <ul className={styles.legend}>
                {(["none", "tight", "loose"] as const).map((band) => (
                  <li key={band}>
                    <i className={cx(styles.swatch, band === "none" ? styles.segNone : band === "tight" ? styles.segTight : styles.segLoose)} />
                    {BAND_LABEL[band]}
                  </li>
                ))}
              </ul>
            </section>

            {week && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">{selected === pinch.tightestIndex && picked === null ? "TIGHTEST WEEK" : week.current ? "THIS WEEK" : "SELECTED WEEK"}</div>
                    <h2>Week of {weekRange(week.start, week.end)}</h2>
                  </div>

                  <div className={styles.weekNav}>
                    <button aria-label="Previous week" className={styles.navButton} disabled={selected === 0} onClick={() => { setPicked(selected - 1); setShownWeek(PAGE); }} type="button">
                      ‹
                    </button>
                    <span className={styles.muted}>
                      {week.none} no room, {week.tight} tight, {week.loose} room to spare
                    </span>
                    <button aria-label="Next week" className={styles.navButton} disabled={selected >= pinch.weeks.length - 1} onClick={() => { setPicked(selected + 1); setShownWeek(PAGE); }} type="button">
                      ›
                    </button>
                  </div>
                </header>

                <Items empty="Nothing is planned or under way this week." items={week.items.slice(0, shownWeek)} />

                {week.items.length > shownWeek && (
                  <div className={styles.more}>
                    <button className={styles.moreButton} onClick={() => setShownWeek((current) => current + PAGE)} type="button">
                      Show {Math.min(PAGE, week.items.length - shownWeek)} more
                    </button>
                    <span className={styles.muted}>
                      {shownWeek} of {week.items.length} shown
                    </span>
                  </div>
                )}
              </section>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">BY TRADE</div>
                  <h2>Which trades are tightest</h2>
                </div>

                <span className={styles.muted}>All open work, tightest first</span>
              </header>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th scope="col">Trade</th>
                      <th className={styles.num} scope="col">
                        Open
                      </th>
                      <th className={styles.num} scope="col">
                        No room
                      </th>
                      <th className={styles.num} scope="col">
                        Tight
                      </th>
                      <th className={styles.num} scope="col">
                        Lowest float
                      </th>
                      <th className={styles.num} scope="col">
                        Median float
                      </th>
                      <th scope="col">First week with no room</th>
                    </tr>
                  </thead>

                  <tbody>
                    {pinch.trades.map((row) => (
                      <tr key={row.name}>
                        <th scope="row">
                          <span className={styles.groupName}>{row.name}</span>
                        </th>
                        <td className={styles.num}>{row.open}</td>
                        <td className={cx(styles.num, row.none > 0 && styles.neg)}>{row.none}</td>
                        <td className={styles.num}>{row.tight}</td>
                        <td className={cx(styles.num, row.lowest !== null && row.lowest < 0 && styles.neg)}>{row.lowest === null ? "—" : `${row.lowest} d`}</td>
                        <td className={styles.num}>{row.median === null ? "—" : `${Math.round(row.median * 2) / 2} d`}</td>
                        <td>{row.firstNone === null ? <span className={styles.missing}>Never</span> : row.firstNone <= today ? "This week" : `Week of ${short(row.firstNone)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className={styles.scrollHint}>Swipe the table sideways for the rest of the columns.</p>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WATCH LIST</div>
                  <h2>Next to go critical</h2>
                </div>

                <span className={styles.muted}>1 to {TIGHT_DAYS} days of float, least first</span>
              </header>

              <Items empty={`Nothing in this range is within ${TIGHT_DAYS} days of having no room.`} items={pinch.next.slice(0, shownNext)} />

              {pinch.next.length > shownNext && (
                <div className={styles.more}>
                  <button className={styles.moreButton} onClick={() => setShownNext((current) => current + PAGE)} type="button">
                    Show {Math.min(PAGE, pinch.next.length - shownNext)} more
                  </button>
                  <span className={styles.muted}>
                    {shownNext} of {pinch.next.length} shown
                  </span>
                </div>
              )}
            </section>

            <p className={styles.note}>
              Float is the number of days an activity can slip before the project finish moves, as calculated by the schedule. An activity has no room when its float is zero or less, or the schedule marks it critical, and is tight with 1 to {TIGHT_DAYS} days. Work counts in every week it is planned or under way, and unfinished work that has overrun is counted from today. Float is shared along a chain of activities, so when one activity uses it up the others on that chain lose it too, which means the tight and critical counts are best read as where attention is needed, not as separate delays. Finished activities are left out.
              {pinch.noFloat > 0 ? ` ${pinch.noFloat} ${plural(pinch.noFloat, "activity has", "activities have")} no float figure and ${plural(pinch.noFloat, "was", "were")} left out.` : ""}
              {pinch.skipped > 0 ? ` ${pinch.skipped} ${plural(pinch.skipped, "activity has", "activities have")} no usable dates and ${plural(pinch.skipped, "was", "were")} left out.` : ""}
              {pinch.dataDate !== null && today - pinch.dataDate > 7 ? ` The schedule was last updated on ${formatDay(pinch.dataDate)}, so float may have moved since.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
