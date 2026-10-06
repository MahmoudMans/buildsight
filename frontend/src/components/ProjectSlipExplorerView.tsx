"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSchedule } from "@/lib/api";
import { formatDay, plural, trunc } from "@/lib/openItems";
import {
  DEFAULT_SLIP,
  MAX_DAYS,
  MAX_SLIP,
  SHIFT_LIMIT,
  activityOptions,
  defaultActivity,
  explore,
  failText,
  linkText,
  prepare,
  quickPicks,
  slipMarkdown,
  toleranceText,
  type Explored,
  type SlipMode,
  type Waiting,
} from "@/lib/slipExplorer";
import { copyText } from "@/lib/textExport";
import type { ScheduleControl } from "@/types/project";

import styles from "./ProjectSlipExplorerView.module.css";

const CHAIN_LIMIT = 8;

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function dayText(value: number): string {
  const rounded = Math.round(value * 10) / 10;

  return `${rounded < 0 ? "−" : ""}${Math.abs(rounded)} d`;
}

function shortDate(day: number): string {
  if (!Number.isFinite(day)) {
    return "No date";
  }

  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC", year: "2-digit" }).format(new Date(day * 86_400_000)).replace(/ (\d\d)$/, " ’$1");
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function Relations({ empty, items }: { empty: string; items: Waiting[] }) {
  if (items.length === 0) {
    return <p className={styles.quiet}>{empty}</p>;
  }

  return (
    <ul className={styles.links}>
      {items.map((item, index) => (
        <li key={`${item.id}-${item.type}-${index}`}>
          <div className={styles.linkTop}>
            <strong>{item.code}</strong>
            <span>{trunc(item.name, 44)}</span>
          </div>

          <div className={styles.linkMeta}>
            <span>{linkText(item.type, item.lag)}</span>
            <span>finishes {formatDay(item.finish)}</span>
            {item.driving ? <em className={styles.driving}>Driving</em> : item.spare !== null ? <span>{dayText(item.spare)} to spare</span> : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function Gauge({ result }: { result: Explored }) {
  const reach = result.toleranceCapped ? Math.max(30, result.days) : (result.tolerance ?? 0);
  const top = Math.max(10, Math.ceil((Math.max(result.days, reach) * 1.25) / 5) * 5);
  const safe = result.toleranceCapped ? 100 : clamp(((result.tolerance ?? 0) / top) * 100, 0, 100);
  const mark = clamp((result.days / top) * 100, 0, 100);
  const over = !result.toleranceCapped && result.days > (result.tolerance ?? 0);

  return (
    <div className={styles.gaugeBox}>
      <div aria-hidden="true" className={styles.gauge}>
        <span className={styles.gaugeSafe} style={{ width: `${safe}%` }} />

        {over && <span className={styles.gaugeOver} style={{ left: `${safe}%`, width: `${Math.max(0, mark - safe)}%` }} />}

        <span className={styles.gaugeMark} style={{ left: `${mark}%` }} />
      </div>

      <div aria-hidden="true" className={styles.gaugeAxis}>
        <span>0</span>

        {!result.toleranceCapped && safe > 14 && safe < 86 && (
          <span className={styles.gaugeRoom} style={{ left: `${safe}%` }}>
            room {dayText(result.tolerance ?? 0)}
          </span>
        )}

        <span>{top} days</span>
      </div>

      <ul className={styles.legend}>
        <li>
          <i className={cx(styles.swatch, styles.swatchSafe)} />
          Absorbed without moving the finish
        </li>
        <li>
          <i className={cx(styles.swatch, styles.swatchOver)} />
          Pushes the finish
        </li>
        <li>
          <i className={cx(styles.swatch, styles.swatchMark)} />
          Slip being tested
        </li>
      </ul>
    </div>
  );
}

export function ProjectSlipExplorerView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ScheduleControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [picked, setPicked] = useState("");
  const [days, setDays] = useState(DEFAULT_SLIP);
  const [wanted, setWanted] = useState<SlipMode>("longer");
  const [showAll, setShowAll] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
          setState("failed");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const prepared = useMemo(() => (data ? prepare(data) : null), [data]);
  const ready = prepared && prepared.ok ? prepared.prepared : null;
  const options = useMemo(() => (ready ? activityOptions(ready) : []), [ready]);
  const picks = useMemo(() => (ready ? quickPicks(ready) : []), [ready]);
  const activityId = ready ? (options.some((item) => item.id === picked) ? picked : defaultActivity(ready)) : "";
  const result = useMemo(() => (ready && activityId !== "" ? explore(ready, activityId, days, wanted) : null), [ready, activityId, days, wanted]);
  const projectName = data?.project?.name ?? "Project";
  const today = useMemo(() => Math.floor(Date.now() / 86_400_000), []);
  const hidden = result && !showAll ? Math.max(0, result.moved.length - SHIFT_LIMIT) : 0;
  const rows = result ? (showAll ? result.moved : result.moved.slice(0, SHIFT_LIMIT)) : [];
  const peak = result ? Math.max(1, ...result.moved.map((item) => item.delta)) : 1;
  const earlier = result ? Math.max(0, result.chain.length - CHAIN_LIMIT) : 0;
  const steps = result ? result.chain.slice(-CHAIN_LIMIT) : [];

  function choose(id: string) {
    setPicked(id);
    setShowAll(false);
    setMessage(null);
  }

  function setAmount(raw: string) {
    const value = Number(raw);

    setDays(Number.isFinite(value) ? clamp(Math.round(value), 0, MAX_DAYS) : 0);
    setShowAll(false);
    setMessage(null);
  }

  async function copySummary() {
    if (!result) {
      return;
    }

    const ok = await copyText(slipMarkdown(result, projectName, today));

    setMessage(ok ? "Copied the result as Markdown." : "Could not copy the result.");
  }

  const verdict = (() => {
    if (!result) {
      return "";
    }

    if (result.delta > 0) {
      return `The finish moves ${result.delta} ${plural(result.delta, "day", "days")}, from ${formatDay(result.finishBefore)} to ${formatDay(result.finishAfter)}.`;
    }

    return result.days === 0 ? "Set a slip to see what it would do." : "The finish does not move. The slip is absorbed by float further along.";
  })();

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">WHAT IF</div>

            <h1>What if this activity slips?</h1>

            <p className={styles.subtitle}>
              Pick an activity and say how many days it runs late. The schedule logic is replayed to show which dates move, whether the project finish moves with them and how much slack was there to absorb it.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/finish-simulation`}>
              Finish confidence
            </Link>

            <Link className="secondary-link-button" href={`${base}/schedule-health`}>
              Schedule health
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Loading the schedule…</div>}

        {state === "failed" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the schedule. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {prepared && !prepared.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{failText(prepared)}</div>
          </section>
        )}

        {ready && result && (
          <>
            <section aria-label="Slip settings" className={cx(styles.panel, styles.controlsPanel)}>
              <div className={cx(styles.controlGroup, styles.wide)}>
                <label className={styles.controlLabel} htmlFor="slip-activity">
                  Activity that slips
                </label>

                <select className={styles.select} id="slip-activity" onChange={(event) => choose(event.target.value)} value={activityId}>
                  {options.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} · {trunc(item.name, 56)}
                      {item.started ? " (in progress)" : ""}
                    </option>
                  ))}
                </select>

                <div className={styles.picks}>
                  <span className={styles.controlHint}>Least slack first:</span>

                  <div className={styles.chips}>
                    {picks.map((item) => (
                      <button
                        aria-pressed={item.id === activityId}
                        className={cx(styles.chip, item.id === activityId && styles.chipOn)}
                        key={item.id}
                        onClick={() => choose(item.id)}
                        title={`${item.name} · ${dayText(item.float)} float`}
                        type="button"
                      >
                        {item.code}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={styles.controlGroup}>
                <span className={styles.controlLabel}>What goes wrong</span>

                <div aria-label="Kind of slip" className={styles.segmented} role="group">
                  <button
                    aria-pressed={result.mode === "longer"}
                    className={cx(styles.segment, result.mode === "longer" && styles.segmentOn)}
                    onClick={() => setWanted("longer")}
                    type="button"
                  >
                    Takes longer
                  </button>

                  <button
                    aria-pressed={result.mode === "later"}
                    className={cx(styles.segment, result.mode === "later" && styles.segmentOn)}
                    disabled={result.started}
                    onClick={() => setWanted("later")}
                    type="button"
                  >
                    Starts later
                  </button>
                </div>

                <span className={styles.controlHint}>
                  {result.started
                    ? "This activity has already started, so it can only run longer."
                    : result.mode === "later"
                      ? "The work is delayed, but takes as long as planned."
                      : "The work starts on time but overruns its remaining duration."}
                </span>
              </div>

              <div className={styles.controlGroup}>
                <label className={styles.controlLabel} htmlFor="slip-days">
                  By how many days
                </label>

                <div className={styles.amount}>
                  <input
                    aria-label="Slip in days, slider"
                    className={styles.slider}
                    max={MAX_SLIP}
                    min={0}
                    onChange={(event) => setAmount(event.target.value)}
                    type="range"
                    value={Math.min(days, MAX_SLIP)}
                  />

                  <input className={styles.number} id="slip-days" max={MAX_DAYS} min={0} onChange={(event) => setAmount(event.target.value)} type="number" value={days} />
                </div>

                <div className={styles.actions}>
                  <button className={styles.actionButton} onClick={copySummary} type="button">
                    Copy result
                  </button>
                </div>
              </div>

              {message && (
                <p className={styles.statusLine} role="status">
                  {message}
                </p>
              )}
            </section>

            <section aria-label="Effect of the slip" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>FINISH NOW</div>
                <div className={styles.kpiValue}>{shortDate(result.finishBefore)}</div>
                <div className={styles.kpiSub}>before any slip</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FINISH WITH THE SLIP</div>
                <div className={cx(styles.kpiValue, result.delta > 0 ? styles.neg : result.days > 0 && styles.pos)}>{shortDate(result.finishAfter)}</div>
                <div className={styles.kpiSub}>{result.delta > 0 ? `${result.delta} ${plural(result.delta, "day", "days")} later` : "no change"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ACTIVITIES MOVED</div>
                <div className={styles.kpiValue}>{result.movedCount}</div>
                <div className={styles.kpiSub}>of {ready.live.length} still open</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>RUN OUT OF FLOAT</div>
                <div className={cx(styles.kpiValue, result.nowCritical > 0 && styles.neg)}>{result.nowCritical}</div>
                <div className={styles.kpiSub}>had float, now critical</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ROOM TO SLIP</div>
                <div className={styles.kpiValue}>{result.toleranceCapped ? "1 yr+" : dayText(result.tolerance ?? 0)}</div>
                <div className={styles.kpiSub}>{result.mode === "later" ? "late start" : "overrun"} before the finish moves</div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">THE ANSWER</div>
                  <h2>
                    {result.target.activityCode} · {result.target.name}
                  </h2>
                </div>

                <span className={styles.muted}>
                  {result.started ? "In progress" : "Not started"} · {Math.round(result.remaining * 10) / 10} {plural(result.remaining, "day", "days")} left · finishes {formatDay(result.targetFinish)}
                </span>
              </header>

              <p aria-live="polite" className={cx(styles.verdict, result.delta > 0 && styles.verdictBad)}>
                {verdict}
              </p>

              <p className={styles.verdictSub}>{toleranceText(result)}</p>

              <Gauge result={result} />
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">THE KNOCK-ON</div>
                  <h2>Everything that moves</h2>
                </div>

                <span className={styles.muted}>
                  {result.movedCount} {plural(result.movedCount, "activity moves", "activities move")} · {result.downstream} {plural(result.downstream, "activity depends", "activities depend")} on it
                </span>
              </header>

              {rows.length === 0 ? (
                <div className={styles.emptySmall}>{result.days === 0 ? "Nothing moves until the slip is above zero." : "Nothing else moves. The slip stays inside this activity."}</div>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={cx(styles.table, styles.shiftTable)}>
                    <thead>
                      <tr>
                        <th>ACTIVITY</th>
                        <th className={styles.num}>MOVES BY</th>
                        <th>FINISH NOW</th>
                        <th>FINISH THEN</th>
                        <th className={styles.num} title="Float before the slip, then after it">
                          FLOAT
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((item) => (
                        <tr className={item.target ? styles.targetRow : undefined} key={item.id}>
                          <td>
                            <strong>{item.code}</strong> {trunc(item.name, 40)}
                            {item.target && <em className={styles.tag}>SLIPPING</em>}
                            {item.nowCritical && <em className={styles.late}>OUT OF FLOAT</em>}
                          </td>
                          <td className={styles.num}>
                            <span className={styles.shiftBar}>
                              <i style={{ width: `${clamp((item.delta / peak) * 100, 4, 100)}%` }} />
                            </span>
                            {dayText(item.delta)}
                          </td>
                          <td>{formatDay(item.before)}</td>
                          <td>{formatDay(item.after)}</td>
                          <td className={cx(styles.num, styles.floatCell)}>
                            <small>{dayText(item.floatBefore)} →</small>
                            <span className={item.floatAfter <= 0 ? styles.neg : undefined}>{dayText(item.floatAfter)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {rows.length > 0 && <p className={styles.scrollHint}>Swipe the table sideways for the dates and float.</p>}

              {(hidden > 0 || (showAll && result.moved.length > SHIFT_LIMIT)) && (
                <div className={styles.more}>
                  {hidden > 0 && (
                    <button className={styles.linkButton} onClick={() => setShowAll(true)} type="button">
                      Show the other {hidden}
                    </button>
                  )}

                  {showAll && result.moved.length > SHIFT_LIMIT && (
                    <button className={styles.linkButton} onClick={() => setShowAll(false)} type="button">
                      Show fewer
                    </button>
                  )}
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">WHY</div>
                  <h2>What holds this activity, and what it holds up</h2>
                </div>
              </header>

              <div className={styles.twoCol}>
                <div>
                  <h3 className={styles.subhead}>Waits on</h3>

                  {result.started ? (
                    <p className={styles.quiet}>Already under way, so the activities before it no longer hold it back.</p>
                  ) : (
                    <>
                      {result.held && <p className={styles.quiet}>Its start is set by the planned date, {formatDay(result.targetStart)}, rather than by a predecessor.</p>}

                      <Relations empty="Nothing precedes it, so it can start as soon as its planned date allows." items={result.waiting} />
                    </>
                  )}
                </div>

                <div>
                  <h3 className={styles.subhead}>Holds up</h3>

                  <Relations empty="No open activity depends on it. A slip only matters if this is the last activity to finish." items={result.holds} />
                </div>
              </div>

              {result.chain.length > 1 && (
                <div className={styles.chain}>
                  <h3 className={styles.subhead}>Driving path into this activity</h3>

                  {earlier > 0 && <p className={styles.quiet}>and {earlier} earlier {plural(earlier, "step", "steps")}</p>}

                  <ol className={styles.steps}>
                    {steps.map((step, index) => (
                      <li key={step.id}>
                        <div className={cx(styles.step, index === steps.length - 1 && styles.stepLast)}>
                          <strong>{step.code}</strong>
                          <span>{trunc(step.name, 36)}</span>
                          <small>
                            {formatDay(step.start)} to {formatDay(step.finish)}
                          </small>
                        </div>

                        {index < steps.length - 1 && step.type && <div className={styles.joint}>{linkText(step.type, step.lag).toLowerCase()}</div>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>

            <p className={styles.note}>
              Nothing here changes the schedule. The logic is replayed from each open activity’s remaining duration, its predecessor links and its planned start, measured from the schedule’s data date. Float is worked out on this page from those links, so it can differ slightly from the figures on the schedule board; “float after” is measured against the finish date the slip leaves. “Room to slip” is the largest slip that leaves the project finish where it is.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
