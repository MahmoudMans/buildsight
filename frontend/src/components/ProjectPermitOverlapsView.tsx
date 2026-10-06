"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState, type CSSProperties } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectSafety } from "@/lib/api";
import { formatDay, plural, startOfToday, trunc, words } from "@/lib/openItems";
import { DEFAULT_HORIZON, HORIZONS, INCLUSIONS, LEVEL_LABEL, LONG_PERMIT, PAGE, RULES, TYPES, TYPE_LABEL, buildPlan, dayCount, planMarkdown, rangeText, type Conflict, type Inclusion, type Level, type Permit, type Plan } from "@/lib/permitOverlaps";
import { copyText } from "@/lib/textExport";
import type { SafetyControl, WorkPermitType } from "@/types/project";

import styles from "./ProjectPermitOverlapsView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const COLOR: Record<WorkPermitType, string | undefined> = {
  HOT_WORK: styles.tHot,
  WORK_AT_HEIGHT: styles.tHeight,
  CONFINED_SPACE: styles.tConfined,
  EXCAVATION: styles.tExcavation,
  ELECTRICAL_ISOLATION: styles.tElectrical,
  LIFTING: styles.tLifting,
  GENERAL: styles.tGeneral,
};

function levelClass(level: Level): string | undefined {
  return level === "high" ? styles.chipBad : level === "watch" ? styles.chipWatch : styles.chipPlain;
}

function PermitLine({ permit }: { permit: Permit }) {
  return (
    <span className={styles.permitLine}>
      <i className={cx(styles.swatch, COLOR[permit.type])} />
      <span>
        <strong>{permit.reference}</strong> {TYPE_LABEL[permit.type]}
        <small>
          {trunc(permit.title, 48)}, {rangeText(permit.from, permit.validUntil)}
          {permit.draft ? ", draft" : ""}
        </small>
      </span>
    </span>
  );
}

function Overlap({ conflict }: { conflict: Conflict }) {
  return (
    <li className={styles.overlap}>
      <span className={styles.overlapHead}>
        <em className={cx(styles.chip, levelClass(conflict.level))}>{LEVEL_LABEL[conflict.level]}</em>
        <strong>{conflict.place || "Unnamed place"}</strong>
        <small>
          {rangeText(conflict.from, conflict.to)}, {dayCount(conflict.days)}
        </small>
      </span>

      <PermitLine permit={conflict.a} />
      <PermitLine permit={conflict.b} />

      <span className={styles.why}>{conflict.why}</span>
    </li>
  );
}

function Timeline({ plan, shown }: { plan: Plan; shown: number }) {
  const count = plan.horizon;
  const template = `repeat(${count}, minmax(9px, 1fr))`;
  const days = plan.perDay.map((value, index) => ({ value, day: plan.start + index }));
  const rows = plan.permits.slice(0, shown);

  return (
    <div className={styles.sheetWrap}>
      <div className={styles.sheet} style={{ "--sheet-min": `${220 + 150 + 32 + count * 11}px`, "--cells-min": `${count * 11}px` } as CSSProperties}>
        <div aria-hidden="true" className={cx(styles.sheetRow, styles.sheetHead)}>
          <span />

          <div className={styles.cells} style={{ gridTemplateColumns: template }}>
            {days.map(({ day }) => (
              <span className={styles.tick} key={day}>
                {(new Date(day * 86_400_000).getUTCDay() === 1 || day === plan.start) && <span>{formatDay(day).slice(0, 6).trim()}</span>}
              </span>
            ))}
          </div>

          <span />
        </div>

        <div className={cx(styles.sheetRow, styles.loadRow)}>
          <span className={styles.loadName}>
            <strong>In force each day</strong>
            <small>peak {plan.peak}</small>
          </span>

          <div aria-label={`Permits in force each day, peak ${plan.peak}`} className={styles.cells} role="img" style={{ gridTemplateColumns: template }}>
            {days.map(({ value, day }) => (
              <i className={cx(styles.load, value === plan.peak && value > 0 && styles.loadPeak)} key={day} style={{ opacity: plan.peak === 0 ? 0.2 : 0.25 + (value / plan.peak) * 0.75 }} title={`${formatDay(day)}: ${value} ${plural(value, "permit", "permits")} in force`}>
                {value > 0 ? value : ""}
              </i>
            ))}
          </div>

          <span />
        </div>

        {rows.map((permit) => {
          const first = Math.max(permit.from, plan.start) - plan.start + 1;
          const last = Math.min(permit.to, plan.end) - plan.start + 2;

          return (
            <div className={cx(styles.sheetRow, styles.sheetBody)} key={permit.id}>
              <div className={styles.who}>
                <strong>
                  {permit.reference} <span className={styles.whoType}>{TYPE_LABEL[permit.type]}</span>
                </strong>
                <small>
                  {trunc(permit.title, 40)}
                  {permit.location ? `, ${permit.location}` : ", no location"}
                </small>
              </div>

              <div className={styles.cells} style={{ gridTemplateColumns: template }}>
                <span
                  aria-label={`${permit.reference}, ${TYPE_LABEL[permit.type]}, ${rangeText(permit.from, permit.validUntil)}`}
                  className={cx(styles.bar, COLOR[permit.type], permit.draft && styles.barDraft, permit.stale && styles.barStale, permit.from < plan.start && styles.barCutLeft, permit.to > plan.end && styles.barCutRight)}
                  style={{ gridColumn: `${first} / ${last}` }}
                  title={`${permit.reference}: ${rangeText(permit.from, permit.validUntil)}${permit.stale ? ", past its end date but still active" : ""}${permit.draft ? ", draft" : ""}`}
                />
              </div>

              <div className={styles.sum}>
                <span>{permit.draft ? "Draft" : permit.stale ? "Past its end date" : `Valid to ${formatDay(permit.validUntil)}`}</span>
                <small>{permit.conflicts > 0 ? `${permit.conflicts} ${plural(permit.conflicts, "overlap", "overlaps")}` : "no overlap"}</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProjectPermitOverlapsView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<SafetyControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [horizon, setHorizon] = useState(DEFAULT_HORIZON);
  const [inclusion, setInclusion] = useState<Inclusion>("withDrafts");
  const [shownOverlaps, setShownOverlaps] = useState(PAGE);
  const [shownRows, setShownRows] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectSafety(projectId)
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

  const built = useMemo(() => (data ? buildPlan(data, today, horizon, inclusion) : null), [data, today, horizon, inclusion]);
  const plan = built && built.ok ? built.plan : null;
  const projectName = data?.project?.name ?? "Project";
  const toCoordinate = plan ? plan.conflicts.filter((conflict) => conflict.level !== "info") : [];
  const present = plan ? TYPES.filter((type) => plan.byType.some((item) => item.type === type)) : [];
  const horizonText = HORIZONS.find((item) => item.days === horizon)?.label ?? `${horizon} days`;

  async function copySummary() {
    if (!plan) {
      return;
    }

    const ok = await copyText(planMarkdown(plan, projectName, today, inclusion));

    setMessage(ok ? "Copied the overlaps as Markdown." : "Could not copy the overlaps.");
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

            <div className="eyebrow">PERMIT OVERLAPS</div>

            <h1>Which permitted jobs are about to land on top of each other?</h1>

            <p className={styles.subtitle}>
              Each permit is checked against the others for the same place and the same days. Hot work above a confined space, or a crane lifting beside a trench, is allowed on paper one permit at a time and only dangerous together.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/safety-board`}>
              Safety board
            </Link>

            <Link className="secondary-link-button" href={`${base}/hotspots`}>
              Site hotspots
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the permit register…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the safety data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No work permits are on the register yet, so there is nothing to check.</div>
          </section>
        )}

        {state === "ready" && plan && (
          <>
            <section aria-label="Permit overlap summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>TO COORDINATE</div>
                <div className={styles.kpiValue}>{toCoordinate.length}</div>
                <div className={styles.kpiSub}>
                  {toCoordinate.length === 0 ? "no risky pairing in the next " + horizonText : `${plan.conflicts.filter((conflict) => conflict.level === "high").length} to coordinate first, in the next ${horizonText}`}
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PERMITS IN FORCE</div>
                <div className={styles.kpiValue}>{plan.permits.length}</div>
                <div className={styles.kpiSub}>
                  {plan.issued} issued, {plan.drafts} draft
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PEAK AT ONCE</div>
                <div className={styles.kpiValue}>{plan.peak}</div>
                <div className={styles.kpiSub}>{plan.peakDay !== null ? `on ${formatDay(plan.peakDay)}` : "no permit in force"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PAST END DATE</div>
                <div className={cx(styles.kpiValue, plan.stale.length > 0 && styles.neg)}>{plan.stale.length}</div>
                <div className={styles.kpiSub}>still active after the date it was valid to</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NO LOCATION</div>
                <div className={cx(styles.kpiValue, plan.noLocation.length > 0 && styles.neg)}>{plan.noLocation.length}</div>
                <div className={styles.kpiSub}>cannot be checked for overlaps</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Look ahead</span>

                <div aria-label="Days checked" className={styles.segmented} role="group">
                  {HORIZONS.map((option) => (
                    <button
                      aria-pressed={horizon === option.days}
                      className={cx(styles.segment, horizon === option.days && styles.segmentOn)}
                      key={option.days}
                      onClick={() => {
                        setHorizon(option.days);
                        setShownOverlaps(PAGE);
                        setShownRows(PAGE);
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
                <span className={styles.controlLabel}>Permits</span>

                <div aria-label="Which permits to check" className={styles.segmented} role="group">
                  {INCLUSIONS.map((option) => (
                    <button
                      aria-pressed={inclusion === option.key}
                      className={cx(styles.segment, inclusion === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setInclusion(option.key);
                        setShownOverlaps(PAGE);
                        setShownRows(PAGE);
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

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">OVERLAPS</div>
                  <h2>Different permits, same place, same days</h2>
                </div>

                <span className={styles.muted}>
                  {plan.conflicts.length} {plural(plan.conflicts.length, "overlap", "overlaps")} from {formatDay(plan.start)} to {formatDay(plan.end)}
                </span>
              </header>

              {plan.conflicts.length === 0 ? (
                <p className={styles.quiet}>No two permits of different types cover the same place on the same day in the next {horizonText}.</p>
              ) : (
                <>
                  <ul className={styles.overlaps}>
                    {plan.conflicts.slice(0, shownOverlaps).map((conflict) => (
                      <Overlap conflict={conflict} key={`${conflict.a.id}-${conflict.b.id}`} />
                    ))}
                  </ul>

                  {plan.conflicts.length > shownOverlaps && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setShownOverlaps((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, plan.conflicts.length - shownOverlaps)} more
                      </button>
                      <span className={styles.muted}>
                        {shownOverlaps} of {plan.conflicts.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">TIMELINE</div>
                  <h2>Every permit in force, day by day</h2>
                </div>

                <span className={styles.muted}>
                  {plan.permits.length} {plural(plan.permits.length, "permit", "permits")}
                </span>
              </header>

              {plan.permits.length === 0 ? (
                <p className={styles.quiet}>No permit is in force in the next {horizonText}.</p>
              ) : (
                <>
                  <Timeline plan={plan} shown={shownRows} />

                  {plan.permits.length > shownRows && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setShownRows((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, plan.permits.length - shownRows)} more
                      </button>
                      <span className={styles.muted}>
                        {shownRows} of {plan.permits.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}

              <ul className={styles.legend}>
                {present.map((type) => (
                  <li key={type}>
                    <i className={cx(styles.swatch, COLOR[type])} />
                    {TYPE_LABEL[type]}
                  </li>
                ))}
                <li>
                  <i className={cx(styles.swatch, styles.swatchDraft)} />
                  Draft
                </li>
                <li>
                  <i className={cx(styles.swatch, styles.swatchStale)} />
                  Past its end date, still active
                </li>
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">HOUSEKEEPING</div>
                  <h2>Permits that need tidying</h2>
                </div>

                <span className={styles.muted}>{plan.stale.length + plan.long.length + plan.noLocation.length} flags</span>
              </header>

              {plan.stale.length + plan.long.length + plan.noLocation.length === 0 ? (
                <p className={styles.quiet}>Every permit has a location, an end date that has not passed and a validity of {LONG_PERMIT} days or less.</p>
              ) : (
                <ul className={styles.flags}>
                  {plan.stale.map((permit) => (
                    <li key={`s-${permit.id}`}>
                      <em className={cx(styles.chip, styles.chipBad)}>Past end date</em>
                      <span>
                        <strong>{permit.reference}</strong> {trunc(permit.title, 56)}
                        <small>
                          {TYPE_LABEL[permit.type]}, valid to {formatDay(permit.validUntil)} and still {words(permit.status).toLowerCase()}. Close it, or renew it.
                        </small>
                      </span>
                    </li>
                  ))}

                  {plan.long.map((permit) => (
                    <li key={`l-${permit.id}`}>
                      <em className={cx(styles.chip, styles.chipWatch)}>Long validity</em>
                      <span>
                        <strong>{permit.reference}</strong> {trunc(permit.title, 56)}
                        <small>
                          {TYPE_LABEL[permit.type]}, valid for {dayCount(permit.span)} from {formatDay(permit.from)}. Long permits tend to outlive the conditions they were written for.
                        </small>
                      </span>
                    </li>
                  ))}

                  {plan.noLocation.map((permit) => (
                    <li key={`n-${permit.id}`}>
                      <em className={cx(styles.chip, styles.chipPlain)}>No location</em>
                      <span>
                        <strong>{permit.reference}</strong> {trunc(permit.title, 56)}
                        <small>{TYPE_LABEL[permit.type]}, {rangeText(permit.from, permit.validUntil)}. Add a location so it can be checked against the others.</small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <p className={styles.note}>
              An overlap is two permits of different types in force on the same day for the same place. Places are matched on the location text, so Block A also matches Block A, level 3, and spelling differences such as Block A and Block-A will not match. These pairings are flagged to coordinate: {RULES.map((rule) => `${TYPE_LABEL[rule.a].toLowerCase()} with ${TYPE_LABEL[rule.b].toLowerCase()}`).join(", ")}; hot work with confined space comes first. Any other pairing of different permit types in the same place is listed as the lower level, and general permits are not checked. They are a prompt for a conversation, not a substitute for the site safety plan. Only active permits are checked, plus drafts when they are included; suspended, closed and cancelled permits are not. An active permit past its end date is treated as still in force up to today. The check covers {formatDay(plan.start)} to {formatDay(plan.end)}.
              {plan.skipped > 0 ? ` ${plan.skipped} ${plural(plan.skipped, "permit has", "permits have")} no usable dates and ${plural(plan.skipped, "was", "were")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
