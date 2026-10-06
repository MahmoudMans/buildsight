"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { buildIcs, downloadIcs, icsFileName } from "@/lib/icsExport";
import {
  DAY_MS,
  MODULE_LABEL,
  MODULE_PATH,
  MODULES,
  SEVERITY_LABEL,
  type ModuleKey,
  type OpenItem,
  type Severity,
  type Sources,
  buildEvents,
  buildOpenItems,
  compareOpenItems,
  formatDay,
  isoDay,
  loadSources,
  plural,
  projectOf,
  startOfToday,
  toDay,
  trunc,
} from "@/lib/openItems";

import styles from "./ProjectCalendarView.module.css";

const AGENDA_LATE_LIMIT = 5;
const CHIPS_PER_DAY = 3;
const AGENDA_DAYS = 30;
const UNASSIGNED = "Unassigned";

type Mode = "month" | "agenda";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const SEVERITY_CLASS: Record<Severity, string | undefined> = {
  critical: styles.sevCritical,
  high: styles.sevHigh,
  medium: styles.sevMedium,
  low: styles.sevLow,
};

const CHIP_CLASS: Record<Severity, string | undefined> = {
  critical: styles.chipCritical,
  high: styles.chipHigh,
  medium: styles.chipMedium,
  low: styles.chipLow,
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function isEvent(item: OpenItem): boolean {
  return item.kind === "Meeting" || item.kind === "Milestone";
}

function ownerOf(item: OpenItem): string {
  return item.owner?.trim() || UNASSIGNED;
}

function monthStart(index: number): number {
  return Math.floor(Date.UTC(Math.floor(index / 12), index % 12, 1) / DAY_MS);
}

function monthIndexOf(day: number): number {
  const date = new Date(day * DAY_MS);

  return date.getUTCFullYear() * 12 + date.getUTCMonth();
}

function monthLabel(index: number): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(monthStart(index) * DAY_MS));
}

function weekdayLabel(day: number): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(day * DAY_MS),
  );
}

function shortDay(day: number): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(day * DAY_MS));
}

function dayOfMonth(day: number): number {
  return new Date(day * DAY_MS).getUTCDate();
}

function dueText(days: number): string {
  if (days < 0) {
    return `${-days} ${plural(-days, "day", "days")} late`;
  }

  if (days === 0) {
    return "Due today";
  }

  if (days === 1) {
    return "Due tomorrow";
  }

  return `Due in ${days} days`;
}

function chipLabel(item: OpenItem): string {
  return item.kind === "Milestone" ? item.title : `${item.reference} ${item.title}`;
}

function summaryOf(item: OpenItem): string {
  if (item.kind === "Milestone") {
    return `Milestone: ${item.title}`;
  }

  if (item.kind === "Meeting") {
    return `${item.reference} ${item.title}`;
  }

  return `[${item.kind}] ${item.reference} ${item.title}`;
}

function descriptionOf(item: OpenItem): string {
  const parts = [`${MODULE_LABEL[item.module]} · ${SEVERITY_LABEL[item.severity]}`];

  if (item.owner) {
    parts.push(`Owner: ${item.owner}`);
  }

  if (item.detail) {
    parts.push(item.detail);
  }

  return parts.join("\n");
}

export function ProjectCalendarView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [cursor, setCursor] = useState(() => monthIndexOf(startOfToday()));
  const [selected, setSelected] = useState(() => startOfToday());
  const [mode, setMode] = useState<Mode>("month");
  const [moduleFilter, setModuleFilter] = useState<ModuleKey | "all">("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [showAllLate, setShowAllLate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    loadSources(projectId).then((result) => {
      if (cancelled) {
        return;
      }

      setSources(result.sources);
      setFailed(result.failed);
    });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const project = useMemo(() => (sources ? projectOf(sources) : null), [sources]);

  const everything = useMemo(() => {
    if (!sources) {
      return [];
    }

    return [...buildOpenItems(sources, today), ...buildEvents(sources)];
  }, [sources, today]);

  const owners = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of everything) {
      if (Number.isFinite(item.due)) {
        counts.set(ownerOf(item), (counts.get(ownerOf(item)) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [everything]);

  const scoped = useMemo(
    () =>
      everything.filter(
        (item) => (moduleFilter === "all" || item.module === moduleFilter) && (ownerFilter === "all" || ownerOf(item) === ownerFilter),
      ),
    [everything, moduleFilter, ownerFilter],
  );

  const dated = useMemo(() => scoped.filter((item) => Number.isFinite(item.due)).sort(compareOpenItems), [scoped]);
  const undatedCount = scoped.filter((item) => !Number.isFinite(item.due) && !isEvent(item)).length;

  const byDay = useMemo(() => {
    const map = new Map<number, OpenItem[]>();

    for (const item of dated) {
      const list = map.get(item.due) ?? [];

      list.push(item);
      map.set(item.due, list);
    }

    return map;
  }, [dated]);

  const grid = useMemo(() => {
    const first = monthStart(cursor);
    const next = monthStart(cursor + 1);
    const offset = (new Date(first * DAY_MS).getUTCDay() + 6) % 7;
    const weeks = Math.ceil((offset + (next - first)) / 7);

    return Array.from({ length: weeks * 7 }, (_, index) => {
      const day = first - offset + index;

      return { day, inMonth: day >= first && day < next };
    });
  }, [cursor]);

  const overdue = dated.filter((item) => item.due < today && item.kind !== "Meeting");
  const week = dated.filter((item) => item.due >= today && item.due <= today + 7);
  const inMonth = dated.filter((item) => monthIndexOf(item.due) === cursor);
  const upcoming = dated.filter((item) => item.due >= today);

  const busiest = useMemo(() => {
    let best: { day: number; count: number } | null = null;

    for (const cell of grid) {
      if (!cell.inMonth) {
        continue;
      }

      const count = byDay.get(cell.day)?.length ?? 0;

      if (count > 0 && (!best || count > best.count)) {
        best = { day: cell.day, count };
      }
    }

    return best;
  }, [grid, byDay]);

  function go(delta: number) {
    const next = cursor + delta;

    setCursor(next);
    setSelected(monthIndexOf(today) === next ? today : monthStart(next));
  }

  function goToday() {
    setCursor(monthIndexOf(today));
    setSelected(today);
  }

  function download() {
    const events = upcoming.map((item) => ({
      uid: item.id,
      day: item.due,
      summary: summaryOf(item),
      description: descriptionOf(item),
      categories: MODULE_LABEL[item.module],
    }));

    const name = project?.name ?? "BuildSight";

    downloadIcs(icsFileName(name, isoDay(today)), buildIcs(events, `${name} deadlines`));
    setMessage(
      `Downloaded ${events.length} ${plural(events.length, "event", "events")}. Import the file into Apple Calendar, Google Calendar or Outlook. Overdue items are left out.`,
    );
  }

  const selectedItems = byDay.get(selected) ?? [];
  const loaded = sources !== null;
  const failedAll = loaded && failed.length === MODULES.length;
  const nothing = loaded && !failedAll && everything.length === 0;

  const agenda = useMemo(() => {
    const groups: Array<{ day: number; items: OpenItem[] }> = [];

    for (let offset = 0; offset <= AGENDA_DAYS; offset += 1) {
      const items = byDay.get(today + offset);

      if (items && items.length > 0) {
        groups.push({ day: today + offset, items });
      }
    }

    return groups;
  }, [byDay, today]);

  const lateShown = showAllLate ? overdue : overdue.slice(0, AGENDA_LATE_LIMIT);

  function renderItem(item: OpenItem) {
    return (
      <li className={styles.row} key={item.id}>
        <span className={cx(styles.sev, SEVERITY_CLASS[item.severity])}>{SEVERITY_LABEL[item.severity]}</span>

        <div className={styles.rowBody}>
          <Link className={styles.rowTitle} href={`${base}/${MODULE_PATH[item.module]}`}>
            {item.kind === "Milestone" ? item.title : `${item.reference} · ${item.title}`}
          </Link>

          <div className={styles.rowMeta}>
            {item.kind} · {MODULE_LABEL[item.module]} · {item.owner?.trim() || UNASSIGNED} · {dueText(item.due - today)}
          </div>

          {item.detail && <div className={styles.rowDetail}>{item.detail}</div>}
        </div>
      </li>
    );
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

            <div className="eyebrow">CALENDAR</div>

            <h1>Every deadline in one calendar</h1>

            <p className={styles.subtitle}>
              Actions, decisions, RFIs, NCRs, permits, payments, planned meetings and milestones, placed on the day they fall due. Select
              a day to see what is waiting, or download the upcoming deadlines for your own calendar.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/inbox`}>
            Open action inbox
          </Link>
        </header>

        {!loaded && <div className={styles.loading}>Loading deadlines…</div>}

        {failedAll && (
          <div className="offline-banner">
            <div>
              <strong>Could not load any project data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {loaded && !failedAll && failed.length > 0 && (
          <div className="offline-banner">
            <div>
              <strong>Could not load {failed.map((key) => MODULE_LABEL[key].toLowerCase()).join(", ")}.</strong>
              <span> Their deadlines are missing from the calendar.</span>
            </div>
          </div>
        )}

        {nothing && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>
              Nothing with a due date is recorded yet. Deadlines appear here as actions, RFIs, NCRs, permits and payments are added.
            </div>
          </section>
        )}

        {loaded && !failedAll && !nothing && (
          <>
            <section aria-label="Deadline summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>OVERDUE</div>
                <div className={styles.kpiValue}>{overdue.length}</div>
                <div className={styles.kpiSub}>past their due date</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NEXT 7 DAYS</div>
                <div className={styles.kpiValue}>{week.length}</div>
                <div className={styles.kpiSub}>due from today</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>{monthLabel(cursor).toUpperCase()}</div>
                <div className={styles.kpiValue}>{inMonth.length}</div>
                <div className={styles.kpiSub}>on the calendar this month</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>BUSIEST DAY</div>
                <div className={styles.kpiValue}>{busiest ? busiest.count : "—"}</div>
                <div className={styles.kpiSub}>{busiest ? shortDay(busiest.day) : "nothing this month"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO DUE DATE</div>
                <div className={styles.kpiValue}>{undatedCount}</div>
                <div className={styles.kpiSub}>open items, not on the calendar</div>
              </article>
            </section>

            <section className={styles.panel}>
              <header className={styles.toolbar}>
                <div className={styles.navGroup}>
                  <button aria-label="Previous month" className={styles.navButton} onClick={() => go(-1)} type="button">
                    ‹
                  </button>

                  <button className={styles.navButton} onClick={goToday} type="button">
                    Today
                  </button>

                  <button aria-label="Next month" className={styles.navButton} onClick={() => go(1)} type="button">
                    ›
                  </button>

                  <h2 className={styles.monthTitle}>{monthLabel(cursor)}</h2>
                </div>

                <div className={styles.controls}>
                  <select
                    aria-label="Filter by module"
                    className={styles.select}
                    onChange={(event) => setModuleFilter(event.target.value as ModuleKey | "all")}
                    value={moduleFilter}
                  >
                    <option value="all">All modules</option>
                    {MODULES.map((item) => (
                      <option key={item.key} value={item.key}>
                        {item.label}
                      </option>
                    ))}
                  </select>

                  <select
                    aria-label="Filter by owner"
                    className={styles.select}
                    onChange={(event) => setOwnerFilter(event.target.value)}
                    value={ownerFilter}
                  >
                    <option value="all">All owners</option>
                    {owners.map(([owner, count]) => (
                      <option key={owner} value={owner}>
                        {owner} ({count})
                      </option>
                    ))}
                  </select>

                  <div aria-label="Calendar layout" className={styles.segmented} role="group">
                    <button
                      aria-pressed={mode === "month"}
                      className={cx(styles.segment, mode === "month" && styles.segmentOn)}
                      onClick={() => setMode("month")}
                      type="button"
                    >
                      Month
                    </button>

                    <button
                      aria-pressed={mode === "agenda"}
                      className={cx(styles.segment, mode === "agenda" && styles.segmentOn)}
                      onClick={() => setMode("agenda")}
                      type="button"
                    >
                      Agenda
                    </button>
                  </div>

                  <button className={styles.linkButton} disabled={upcoming.length === 0} onClick={download} type="button">
                    Download .ics · {upcoming.length}
                  </button>
                </div>
              </header>

              {message && (
                <p className={styles.statusLine} role="status">
                  {message}
                </p>
              )}

              {mode === "month" ? (
                <>
                  <div aria-hidden="true" className={styles.weekdays}>
                    {WEEKDAYS.map((name) => (
                      <div key={name}>
                        <span className={styles.wdFull}>{name}</span>
                        <span className={styles.wdShort}>{name.charAt(0)}</span>
                      </div>
                    ))}
                  </div>

                  <div aria-label={`Calendar for ${monthLabel(cursor)}`} className={styles.grid} role="group">
                    {grid.map((cell) => {
                      const items = byDay.get(cell.day) ?? [];
                      const count = items.length;

                      return (
                        <button
                          aria-label={`${shortDay(cell.day)}, ${count} ${plural(count, "item", "items")}`}
                          aria-pressed={cell.day === selected}
                          className={cx(
                            styles.cell,
                            !cell.inMonth && styles.cellOut,
                            cell.day === today && styles.cellToday,
                            cell.day === selected && styles.cellSelected,
                          )}
                          key={cell.day}
                          onClick={() => setSelected(cell.day)}
                          type="button"
                        >
                          <span className={styles.cellTop}>
                            <span className={styles.cellDate}>{dayOfMonth(cell.day)}</span>
                            {count > 0 && <span className={styles.cellCount}>{count}</span>}
                          </span>

                          <span className={styles.cellChips}>
                            {items.slice(0, CHIPS_PER_DAY).map((item) => (
                              <span className={cx(styles.chip, isEvent(item) ? styles.chipEvent : CHIP_CLASS[item.severity])} key={item.id}>
                                <span className={styles.chipText}>{trunc(chipLabel(item), 30)}</span>
                              </span>
                            ))}

                            {count > CHIPS_PER_DAY && <span className={styles.chipMore}>+{count - CHIPS_PER_DAY} more</span>}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <ul className={styles.legend}>
                    <li>
                      <i className={cx(styles.swatch, styles.chipCritical)} /> Critical
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.chipHigh)} /> High
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.chipMedium)} /> Medium
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.chipLow)} /> Low
                    </li>
                    <li>
                      <i className={cx(styles.swatch, styles.chipEvent)} /> Meeting or milestone
                    </li>
                  </ul>
                </>
              ) : (
                <div className={styles.agenda}>
                  {overdue.length > 0 && (
                    <section>
                      <h3 className={cx(styles.agendaDay, styles.agendaLate)}>
                        Overdue <span>{overdue.length}</span>
                      </h3>

                      <ul className={styles.rows}>{lateShown.map(renderItem)}</ul>

                      {overdue.length > AGENDA_LATE_LIMIT && (
                        <button className={styles.linkButton} onClick={() => setShowAllLate((value) => !value)} type="button">
                          {showAllLate ? `Show first ${AGENDA_LATE_LIMIT}` : `Show all ${overdue.length}`}
                        </button>
                      )}
                    </section>
                  )}

                  {agenda.map((group) => (
                    <section key={group.day}>
                      <h3 className={styles.agendaDay}>
                        {group.day === today ? "Today" : group.day === today + 1 ? "Tomorrow" : shortDay(group.day)} <span>{group.items.length}</span>
                      </h3>

                      <ul className={styles.rows}>{group.items.map(renderItem)}</ul>
                    </section>
                  ))}

                  {agenda.length === 0 && <div className={styles.emptySmall}>Nothing is due in the next {AGENDA_DAYS} days.</div>}
                </div>
              )}
            </section>

            {mode === "month" && (
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">{selected === today ? "TODAY" : selected < today ? "EARLIER" : "COMING UP"}</div>
                    <h2>{weekdayLabel(selected)}</h2>
                  </div>

                  <span className={styles.muted}>
                    {selectedItems.length} {plural(selectedItems.length, "item", "items")}
                  </span>
                </header>

                {selectedItems.length === 0 ? (
                  <div className={styles.emptySmall}>Nothing is due on this day.</div>
                ) : (
                  <ul className={styles.rows}>{selectedItems.map(renderItem)}</ul>
                )}
              </section>
            )}

            <p className={styles.note}>
              Items come from the same open records as the action inbox. Meetings are planned meetings, and milestones sit on their
              forecast date, or the planned date if there is no forecast. Overdue counts everything dated before today except planned
              meetings. The .ics file lists upcoming deadlines only, as all-day events, so it never fills your calendar with old items.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
