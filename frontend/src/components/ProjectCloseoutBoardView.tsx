"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { BLOCKER_LIMIT, GROUP_LABEL, buildCloseout, closeoutMarkdown, paceLine, type Gate, type GateKey, type GateState } from "@/lib/closeout";
import { MODULE_LABEL, formatDay, loadSources, plural, projectOf, startOfToday, type ModuleKey, type Sources } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";

import styles from "./ProjectCloseoutBoardView.module.css";

const SOURCE_COUNT = 9;

type Filter = "all" | "late" | "open" | "clear";
type Order = "checklist" | "furthest";

const FILTERS: ReadonlyArray<{ key: Filter; label: string }> = [
  { key: "all", label: "All" },
  { key: "late", label: "Late" },
  { key: "open", label: "Open" },
  { key: "clear", label: "Clear" },
];

const STATE_LABEL: Record<GateState, string> = {
  clear: "Clear",
  open: "Open",
  late: "Late",
  none: "Nothing recorded",
  unknown: "Not loaded",
};

const STATE_CLASS: Record<GateState, string | undefined> = {
  clear: styles.pillClear,
  open: styles.pillOpen,
  late: styles.pillLate,
  none: styles.pillNone,
  unknown: styles.pillNone,
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function percent(value: number): string {
  return Number.isFinite(value) ? `${Math.round(value)}%` : "—";
}

function sentenceDays(days: number): string {
  if (!Number.isFinite(days)) {
    return "";
  }

  return days >= 0 ? `${days} ${plural(days, "day", "days")} left` : `${-days} ${plural(-days, "day", "days")} past`;
}

export function ProjectCloseoutBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [order, setOrder] = useState<Order>("checklist");
  const [open, setOpen] = useState<GateKey[]>([]);
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

  const closeout = useMemo(() => (sources ? buildCloseout(sources, failed, today) : null), [sources, failed, today]);
  const project = sources ? projectOf(sources) : null;

  const visible = useMemo(() => {
    if (!closeout) {
      return [] as Gate[];
    }

    const kept = closeout.gates.filter((gate) => filter === "all" || gate.state === filter);

    if (order === "checklist") {
      return kept;
    }

    return [...kept].sort((a, b) => {
      const left = Number.isFinite(a.ratio) && a.state !== "unknown" ? a.ratio : 2;
      const right = Number.isFinite(b.ratio) && b.state !== "unknown" ? b.ratio : 2;

      return left - right || b.blockers.length - a.blockers.length;
    });
  }, [closeout, filter, order]);

  const counts = useMemo(() => {
    const tally: Record<Filter, number> = { all: 0, late: 0, open: 0, clear: 0 };

    for (const gate of closeout?.gates ?? []) {
      tally.all += 1;

      if (gate.state === "late" || gate.state === "open" || gate.state === "clear") {
        tally[gate.state] += 1;
      }
    }

    return tally;
  }, [closeout]);

  function toggle(key: GateKey) {
    setOpen((list) => (list.includes(key) ? list.filter((item) => item !== key) : [...list, key]));
  }

  async function copyChecklist() {
    if (!closeout) {
      return;
    }

    const ok = await copyText(closeoutMarkdown(closeout, project?.name ?? "Project", today));

    setMessage(ok ? "Copied the checklist as Markdown." : "Could not copy the checklist.");
  }

  const loaded = sources !== null && closeout !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;
  const nothing = loaded && !failedAll && closeout.applicable === 0;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">CLOSEOUT</div>

            <h1>How close is handover?</h1>

            <p className={styles.subtitle}>
              Every gate that has to be clear before the project can be handed over, with what is still holding each one open and how fast
              it has been closing lately.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/inbox`}>
              Action inbox
            </Link>

            <Link className="secondary-link-button" href={`${base}/quality-board`}>
              Quality board
            </Link>
          </div>
        </header>

        {!loaded && <div className={styles.loading}>Checking every module…</div>}

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
              <span> Gates that depend on them are marked below.</span>
            </div>
          </div>
        )}

        {nothing && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>Nothing that counts towards closeout is recorded yet. Punch items, NCRs, handover items and the rest will appear here as they are added.</div>
          </section>
        )}

        {loaded && !failedAll && !nothing && closeout && (
          <>
            <section aria-label="Closeout summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>READINESS</div>
                <div className={styles.kpiValue}>{percent(closeout.readiness)}</div>
                <div className={styles.kpiSub}>average of the gates</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>GATES CLEAR</div>
                <div className={styles.kpiValue}>
                  {closeout.clear}
                  <span className={styles.of}> / {closeout.applicable}</span>
                </div>
                <div className={styles.kpiSub}>nothing left open</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN ITEMS</div>
                <div className={styles.kpiValue}>{closeout.open}</div>
                <div className={cx(styles.kpiSub, closeout.overdue > 0 && styles.neg)}>{closeout.overdue} overdue</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PLANNED COMPLETION</div>
                <div className={styles.kpiValue}>{Number.isFinite(closeout.planned) ? formatDay(closeout.planned) : "—"}</div>
                <div className={styles.kpiSub}>{Number.isFinite(closeout.daysLeft) ? sentenceDays(closeout.daysLeft) : "no end date set"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ALL CLEAR AT PACE</div>
                <div className={styles.kpiValue}>{closeout.estimate !== null ? formatDay(closeout.estimate) : "—"}</div>
                <div className={styles.kpiSub}>{closeout.slowest ? `held up by ${closeout.slowest.title.toLowerCase()}` : "needs closures to measure"}</div>
              </article>
            </section>

            {closeout.stalled.length > 0 && (
              <p className={styles.stalledNote} role="note">
                <strong>No progress in four weeks:</strong> {closeout.stalled.map((gate) => gate.title).join(", ")}. The pace estimate cannot include {closeout.stalled.length === 1 ? "it" : "them"} until something closes.
              </p>
            )}

            <section className={styles.controls}>
              <div aria-label="Filter gates" className={styles.segmented} role="group">
                {FILTERS.map((option) => (
                  <button
                    aria-pressed={filter === option.key}
                    className={cx(styles.segment, filter === option.key && styles.segmentOn)}
                    key={option.key}
                    onClick={() => setFilter(option.key)}
                    type="button"
                  >
                    {option.label} <span>{counts[option.key]}</span>
                  </button>
                ))}
              </div>

              <div aria-label="Order gates" className={styles.segmented} role="group">
                <button aria-pressed={order === "checklist"} className={cx(styles.segment, order === "checklist" && styles.segmentOn)} onClick={() => setOrder("checklist")} type="button">
                  Checklist order
                </button>

                <button aria-pressed={order === "furthest"} className={cx(styles.segment, order === "furthest" && styles.segmentOn)} onClick={() => setOrder("furthest")} type="button">
                  Furthest from done
                </button>
              </div>

              <button className={styles.linkButton} onClick={copyChecklist} type="button">
                Copy checklist
              </button>
            </section>

            {message && (
              <p className={styles.statusLine} role="status">
                {message}
              </p>
            )}

            {visible.length === 0 ? (
              <section className={styles.panel}>
                <div className={styles.emptySmall}>No gate is {filter} right now.</div>
              </section>
            ) : (
              <ul className={styles.gates}>
                {visible.map((gate) => {
                  const expanded = open.includes(gate.key);
                  const pace = paceLine(gate);
                  const done = Number.isFinite(gate.ratio) ? gate.ratio * 100 : 0;

                  return (
                    <li className={cx(styles.gate, gate.state === "late" && styles.gateLate, gate.state === "clear" && styles.gateClear)} key={gate.key}>
                      <div className={styles.gateHead}>
                        <span className={styles.groupTag}>{GROUP_LABEL[gate.group]}</span>
                        <span className={cx(styles.pill, STATE_CLASS[gate.state])}>{STATE_LABEL[gate.state]}</span>
                      </div>

                      <h2 className={styles.gateTitle}>{gate.title}</h2>
                      <p className={styles.gateQuestion}>{gate.question}</p>

                      <div aria-hidden="true" className={styles.meter}>
                        <span className={cx(styles.meterFill, gate.state === "clear" && styles.meterClear)} style={{ width: `${done}%` }} />
                      </div>

                      <div className={styles.figureRow}>
                        <span className={styles.figure}>{gate.state === "unknown" ? "Could not load this module" : gate.figure}</span>
                        {gate.state !== "unknown" && gate.state !== "none" && <strong>{percent(done)}</strong>}
                      </div>

                      {gate.overdue > 0 && (
                        <div className={styles.overdueLine}>
                          {gate.overdue} of {gate.blockers.length} open {plural(gate.blockers.length, "item is", "items are")} overdue
                        </div>
                      )}

                      {pace && <div className={cx(styles.paceLine, gate.pace?.closed === 0 && styles.paceStalled)}>{pace}</div>}

                      {gate.note && <div className={styles.noteLine}>{gate.note}</div>}

                      {gate.blockers.length > 0 && (
                        <button aria-expanded={expanded} className={styles.toggle} onClick={() => toggle(gate.key)} type="button">
                          {expanded ? "Hide what is open" : `Show what is open (${gate.blockers.length})`}
                        </button>
                      )}

                      {expanded && (
                        <>
                          <ul className={styles.blockers}>
                            {gate.blockers.slice(0, BLOCKER_LIMIT).map((item) => (
                              <li key={item.id}>
                                <span className={styles.blockerMain}>
                                  {item.reference && <strong>{item.reference}</strong>} {item.title}
                                </span>

                                <span className={styles.blockerMeta}>
                                  {item.detail}
                                  {item.owner ? ` · ${item.owner}` : ""}
                                  {Number.isFinite(item.due) ? ` · due ${formatDay(item.due)}` : ""}
                                  {item.overdue && <em className={styles.overdueTag}>overdue</em>}
                                </span>
                              </li>
                            ))}
                          </ul>

                          {gate.blockers.length > BLOCKER_LIMIT && (
                            <p className={styles.moreLine}>
                              and {gate.blockers.length - BLOCKER_LIMIT} more, oldest first.
                            </p>
                          )}
                        </>
                      )}

                      <Link className={styles.gateLink} href={`${base}/${gate.path}`}>
                        Open {MODULE_LABEL[gate.module].toLowerCase()} →
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}

            <p className={styles.note}>
              A gate is clear when nothing in it is still open, and late when any open item has passed its due date. Each gate&apos;s bar shows
              how much of what is recorded is already done, and readiness is the plain average of those bars, so a gate with a few items
              counts as much as one with hundreds. The pace line looks at what closed in the last four weeks, so a quiet month stretches the
              estimate. Voided, cancelled and superseded records are left out, and a gate with nothing recorded is not counted.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
