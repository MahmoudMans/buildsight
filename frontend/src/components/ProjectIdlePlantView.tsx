"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectResources } from "@/lib/api";
import { DEFAULT_WINDOW, HIGH_DOWNTIME, LOW_USE, OWNER_FILTERS, PAGE, SORTS, VERDICT_LABEL, WINDOWS, adviceText, buildPlant, eur, filterUnits, pct, plantMarkdown, sinceText, sortUnits, summarise, type OwnerFilter, type Plant, type SortKey, type Unit, type Verdict } from "@/lib/idlePlant";
import { formatDay, plural, startOfToday, trunc, words } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { ResourceControl } from "@/types/project";

import styles from "./ProjectIdlePlantView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function verdictClass(verdict: Verdict): string | undefined {
  return verdict === "breakdown" || verdict === "idleHire" ? styles.chipBad : verdict === "idleOwned" ? styles.chipWatch : verdict === "busy" ? styles.chipGood : styles.chipPlain;
}

function Spark({ unit }: { unit: Unit }) {
  const width = 96;
  const height = 30;
  const gap = 3;
  const barWidth = (width - gap * (unit.weeks.length - 1)) / unit.weeks.length;
  const mark = height - LOW_USE * height;

  return (
    <svg aria-label={`${unit.code}: share of available hours spent operating in each week`} className={styles.spark} role="img" viewBox={`0 0 ${width} ${height}`}>
      {unit.weeks.map((value, index) => {
        const h = value === null ? 0 : Math.max(1.5, value * height);

        return (
          <rect className={index === unit.weeks.length - 1 ? styles.sparkNow : styles.sparkBar} height={h} key={index} rx={1} width={barWidth} x={index * (barWidth + gap)} y={height - h}>
            <title>{value === null ? "No hours logged" : `${Math.round(value * 100)}% used`}</title>
          </rect>
        );
      })}

      <line className={styles.sparkMark} x1={0} x2={width} y1={mark} y2={mark} />
    </svg>
  );
}

function UnitRow({ unit, windowDays }: { unit: Unit; windowDays: number }) {
  const use = (unit.use ?? 0) * 100;
  const idle = (unit.idleShare ?? 0) * 100;
  const down = (unit.downShare ?? 0) * 100;
  const total = Math.max(100, use + idle + down);

  return (
    <li className={styles.row}>
      <div className={styles.unit}>
        <div className={styles.title}>
          <strong>{unit.code}</strong>
          <span>{trunc(unit.description, 44)}</span>
        </div>

        <div className={styles.tags}>
          <em className={cx(styles.tag, unit.hired && styles.tagHired)}>{words(unit.ownership)}</em>
          <em className={styles.tag}>{words(unit.status)}</em>
        </div>
      </div>

      <div className={styles.hours}>
        {unit.days > 0 ? (
          <>
            <span aria-hidden="true" className={styles.split}>
              <i className={styles.splitUse} style={{ width: `${(use / total) * 100}%` }} />
              <i className={styles.splitIdle} style={{ width: `${(idle / total) * 100}%` }} />
              <i className={styles.splitDown} style={{ width: `${(down / total) * 100}%` }} />
            </span>
            <span>
              <strong>{pct(unit.use)}</strong> used, {pct(unit.idleShare)} idle, {pct(unit.downShare)} down
            </span>
            <small>
              {unit.days} {plural(unit.days, "day", "days")} logged
            </small>
          </>
        ) : (
          <span className={styles.none}>No hours logged</span>
        )}
      </div>

      <div className={styles.cost}>
        <span>
          <strong>{eur(unit.wasted)}</strong> wasted
        </span>
        <small>
          of {eur(unit.spend)} at {eur(unit.dailyCost)} a day
        </small>
      </div>

      <div className={styles.last}>
        <span>{sinceText(unit)}</span>
        {unit.lastUsed !== null && <small>{formatDay(unit.lastUsed)}</small>}
      </div>

      <div className={styles.verdictCell}>
        <em className={cx(styles.chip, verdictClass(unit.verdict))}>{VERDICT_LABEL[unit.verdict]}</em>
        <small>{adviceText(unit, windowDays)}</small>
        {unit.days > 0 && <Spark unit={unit} />}
      </div>
    </li>
  );
}

function Weekly({ plant }: { plant: Plant }) {
  const top = Math.max(1, ...plant.weeks.map((week) => week.idleCost + week.downCost));

  return (
    <div className={styles.weekly} style={{ gridTemplateColumns: `repeat(${plant.weeks.length}, minmax(0, 1fr))` }}>
      {plant.weeks.map((week) => (
        <div className={styles.weekCol} key={week.to} title={`Week to ${formatDay(week.to)}: ${eur(week.idleCost)} idle, ${eur(week.downCost)} broken down, ${week.use === null ? "no hours logged" : `${Math.round(week.use * 100)}% used`}`}>
          <span className={styles.weekTotal}>{eur(week.idleCost + week.downCost)}</span>

          <span className={styles.weekBar}>
            <span className={styles.weekStack}>
              <i className={styles.segDown} style={{ flexBasis: `${(week.downCost / top) * 100}%` }} />
              <i className={styles.segIdle} style={{ flexBasis: `${(week.idleCost / top) * 100}%` }} />
            </span>
          </span>

          <span className={styles.weekLabel}>to {formatDay(week.to).slice(0, 6).trim()}</span>
          <span className={styles.weekUse}>{week.use === null ? "—" : `${Math.round(week.use * 100)}% used`}</span>
        </div>
      ))}
    </div>
  );
}

export function ProjectIdlePlantView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ResourceControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [windowDays, setWindowDays] = useState(DEFAULT_WINDOW);
  const [owner, setOwner] = useState<OwnerFilter>("all");
  const [sort, setSort] = useState<SortKey>("wasted");
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectResources(projectId)
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

  const built = useMemo(() => (data ? buildPlant(data, today, windowDays) : null), [data, today, windowDays]);
  const plant = built && built.ok ? built.plant : null;
  const units = useMemo(() => (plant ? sortUnits(filterUnits(plant.units, owner), sort) : []), [plant, owner, sort]);
  const totals = useMemo(() => (plant ? summarise(units, plant.windowDays) : null), [plant, units]);
  const projectName = data?.project?.name ?? "Project";
  const windowText = WINDOWS.find((item) => item.days === windowDays)?.label ?? `${windowDays} days`;
  const anyHours = plant ? plant.units.some((unit) => unit.days > 0) : false;

  async function copySummary() {
    if (!plant || !totals) {
      return;
    }

    const ok = await copyText(plantMarkdown(plant, units, totals, projectName, today));

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

            <div className="eyebrow">IDLE PLANT</div>

            <h1>What are idle and broken-down machines costing us?</h1>

            <p className={styles.subtitle}>
              Equipment hours logged on site, turned into money: how much of each machine&apos;s daily cost went on standing idle or being repaired, which hired units are barely used, and which keep breaking down.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/resource-heatmap`}>
              Resource heatmap
            </Link>

            <Link className="secondary-link-button" href={`${base}/spend-board`}>
              Spend board
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the equipment logs…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the resource data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No equipment has been registered yet, so there is no plant to measure.</div>
          </section>
        )}

        {state === "ready" && plant && totals && (
          <>
            <section aria-label="Idle plant summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>IDLE AND DOWN COST</div>
                <div className={styles.kpiValue}>{eur(totals.wasted)}</div>
                <div className={styles.kpiSub}>{totals.wastedShare === null ? `nothing logged in the last ${windowText}` : `${pct(totals.wastedShare)} of plant cost, about ${eur(totals.perWeek)} a week`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ON HIRED PLANT</div>
                <div className={styles.kpiValue}>{eur(totals.hiredWasted)}</div>
                <div className={styles.kpiSub}>rented or subcontracted units</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OFF-HIRE CANDIDATES</div>
                <div className={cx(styles.kpiValue, totals.candidates > 0 && styles.neg)}>{totals.candidates}</div>
                <div className={styles.kpiSub}>{totals.candidates > 0 ? `hired, used under ${Math.round(LOW_USE * 100)}% of the time, ${eur(totals.candidateWasted)} wasted` : `no hired unit is used under ${Math.round(LOW_USE * 100)}% of the time`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>UTILISATION</div>
                <div className={styles.kpiValue}>{pct(totals.use)}</div>
                <div className={styles.kpiSub}>of available hours were spent operating</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>DOWNTIME</div>
                <div className={cx(styles.kpiValue, totals.breakdowns > 0 && styles.neg)}>{pct(totals.downShare)}</div>
                <div className={styles.kpiSub}>
                  {totals.breakdowns > 0 ? `${totals.breakdowns} ${plural(totals.breakdowns, "unit loses", "units lose")} over ${Math.round(HIGH_DOWNTIME * 100)}% of ${totals.breakdowns === 1 ? "its" : "their"} hours` : "no unit loses much time"}
                </div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Hours from the last</span>

                <div aria-label="Period measured" className={styles.segmented} role="group">
                  {WINDOWS.map((option) => (
                    <button
                      aria-pressed={windowDays === option.days}
                      className={cx(styles.segment, windowDays === option.days && styles.segmentOn)}
                      key={option.days}
                      onClick={() => {
                        setWindowDays(option.days);
                        setMessage(null);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.controlLabel}>Show</span>

                <div aria-label="Which plant to show" className={styles.segmented} role="group">
                  {OWNER_FILTERS.map((option) => (
                    <button
                      aria-pressed={owner === option.key}
                      className={cx(styles.segment, owner === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setOwner(option.key);
                        setShown(PAGE);
                        setMessage(null);
                      }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <span className={styles.controlLabel}>Order</span>

                <div aria-label="Order of units" className={styles.segmented} role="group">
                  {SORTS.map((option) => (
                    <button
                      aria-pressed={sort === option.key}
                      className={cx(styles.segment, sort === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setSort(option.key);
                        setShown(PAGE);
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

            {!anyHours && (
              <div className="offline-banner">
                <div>
                  <strong>No equipment hours were logged in the last {windowText}, so there is nothing to price. Try a longer period.</strong>
                </div>
              </div>
            )}

            {anyHours && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">WEEK BY WEEK</div>
                    <h2>What idle and broken-down time cost each week</h2>
                  </div>

                  <span className={styles.muted}>All plant, not affected by the filters below</span>
                </header>

                <Weekly plant={plant} />

                <ul className={styles.legend}>
                  <li>
                    <i className={cx(styles.swatch, styles.segIdle)} />
                    Standing idle
                  </li>
                  <li>
                    <i className={cx(styles.swatch, styles.segDown)} />
                    Broken down or in repair
                  </li>
                </ul>
              </section>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">MACHINE BY MACHINE</div>
                  <h2>Where the money is going</h2>
                </div>

                <span className={styles.muted}>
                  {units.length} {plural(units.length, "unit", "units")}
                </span>
              </header>

              {units.length === 0 ? (
                <p className={styles.quiet}>No {owner === "hired" ? "hired" : "owned"} plant is registered.</p>
              ) : (
                <>
                  <div aria-hidden="true" className={styles.columns}>
                    <span>Machine</span>
                    <span>How the hours went</span>
                    <span>Cost of idle and down time</span>
                    <span>Last operated</span>
                    <span>Verdict and weekly use</span>
                  </div>

                  <ul className={styles.rows}>
                    {units.slice(0, shown).map((unit) => (
                      <UnitRow key={unit.id} unit={unit} windowDays={plant.windowDays} />
                    ))}
                  </ul>

                  {units.length > shown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, units.length - shown)} more
                      </button>
                      <span className={styles.muted}>
                        {shown} of {units.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}

              <ul className={styles.legend}>
                <li>
                  <i className={cx(styles.swatch, styles.splitUse)} />
                  Operating
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.splitIdle)} />
                  Idle
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.splitDown)} />
                  Down
                </li>
                <li>
                  <i className={styles.swatchLine} />
                  {Math.round(LOW_USE * 100)}% use, below which hired plant is a candidate to hand back
                </li>
              </ul>
            </section>

            <p className={styles.note}>
              Used is operating hours as a share of the hours each machine was available. The cost of idle or broken-down time is each machine&apos;s daily cost multiplied by the share of every logged day that was idle or down, so a machine that stands idle for half of each day is charged half its daily cost; the daily cost is whatever has been entered for it, an internal rate for owned plant. A hired machine is an off-hire candidate when it was used less than {Math.round(LOW_USE * 100)}% of the time, and a machine is flagged for breakdowns when {Math.round(HIGH_DOWNTIME * 100)}% or more of its available hours were lost. Machines with fewer than five logged days are not judged, and one marked off hire is shown as such. The figures cover hours logged from {formatDay(plant.from)} to {formatDay(today)}.
              {plant.latest !== null && today - plant.latest > 7 ? ` The latest usage log is from ${formatDay(plant.latest)}, so recent days may be missing.` : ""}
              {plant.unpriced > 0 ? ` ${plant.unpriced} ${plural(plant.unpriced, "machine has", "machines have")} no daily cost, so ${plural(plant.unpriced, "it adds", "they add")} nothing to the money figures.` : ""}
              {plant.skipped > 0 ? ` ${plant.skipped} usage ${plural(plant.skipped, "record has", "records have")} no usable date and ${plural(plant.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
