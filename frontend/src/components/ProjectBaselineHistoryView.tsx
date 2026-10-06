"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectPeriodControl } from "@/lib/api";
import { FLAG_LABEL, STATUS_LABEL, buildHistory, cash, costLadder, finishLadder, historyMarkdown, lifeText, signedCash, signedDays, signedPct, type History, type Ladder, type MarkKind, type Version, type VersionFlag } from "@/lib/baselineHistory";
import { formatDay, plural, startOfToday } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { PeriodControl } from "@/types/project";

import styles from "./ProjectBaselineHistoryView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const DOT: Record<MarkKind, string | undefined> = {
  original: styles.dotOriginal,
  baseline: styles.dotBaseline,
  current: styles.dotCurrent,
  forecast: styles.dotForecast,
};

const FLAG_CHIP: Record<VersionFlag, string | undefined> = {
  noReason: styles.chipWatch,
  noReference: styles.chipPlain,
  quick: styles.chipWatch,
};

function kindOf(kinds: MarkKind[]): MarkKind {
  return kinds.includes("forecast") ? "forecast" : kinds.includes("current") ? "current" : kinds.includes("original") ? "original" : "baseline";
}

function LadderChart({ ladder, label }: { ladder: Ladder; label: string }) {
  const summary = ladder.marks.flatMap((mark) => mark.entries.map((entry) => `${entry.label} ${entry.value}`)).join(", ");

  return (
    <div aria-label={`${label}: ${summary}`} className={styles.ladder} role="img">
      <span className={styles.rail} />

      {ladder.reset && <i className={cx(styles.span, styles.spanReset)} style={{ left: `${ladder.reset.left}%`, width: `${ladder.reset.width}%` }} />}

      {ladder.over && <i className={cx(styles.span, ladder.over.beyond ? styles.spanOver : styles.spanUnder)} style={{ left: `${ladder.over.left}%`, width: `${ladder.over.width}%` }} />}

      {ladder.marks.map((mark) => (
        <span className={cx(styles.mark, mark.side === "above" ? styles.markAbove : styles.markBelow)} key={mark.entries.map((entry) => entry.label).join("|")} style={{ left: `${mark.pos}%` }}>
          <i className={cx(styles.dot, DOT[kindOf(mark.entries.map((entry) => entry.kind))])} />

          <span className={styles.markLabel}>
            {mark.entries.map((entry) => (
              <span className={styles.markEntry} key={entry.label}>
                <b>{entry.label}</b>
                {entry.value}
              </span>
            ))}
          </span>
        </span>
      ))}
    </div>
  );
}

function leftText(version: Version): { title: string; text: string; note: string } {
  if (!version.left) {
    return { title: "LEFT BEHIND", text: "—", note: "no period was closed under this version" };
  }

  return {
    title: version.current ? "AT LAST PERIOD END" : "LEFT BEHIND",
    text: `${signedCash(version.left.cost)}, ${signedDays(version.left.finish)}`,
    note: `at ${version.left.periodCode}, ${formatDay(version.left.end)}`,
  };
}

function VersionLine({ version }: { version: Version }) {
  const left = leftText(version);

  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>
          {version.code}, {version.title}
        </strong>

        <span className={styles.tags}>
          <em className={cx(styles.chip, version.current ? styles.chipGood : styles.chipPlain)}>{version.current ? "In force" : STATUS_LABEL[version.status]}</em>
          {version.flags.map((flag) => (
            <em className={cx(styles.chip, FLAG_CHIP[flag])} key={flag}>
              {FLAG_LABEL[flag]}
            </em>
          ))}
        </span>

        <small>
          {version.start !== null ? `Approved ${formatDay(version.start)}, ` : ""}
          {lifeText(version)}
        </small>
        {(version.reason || version.original) && <small>{version.reason ? `Reason: ${version.reason}` : "The first baseline"}</small>}
        {version.reference && <small>Change {version.reference}</small>}
      </span>

      <span className={styles.figs}>
        <span>
          <b>COST TARGET</b>
          {cash(version.costTarget)}
          {version.costShift !== null && <small className={version.costShift > 0 ? styles.neg : version.costShift < 0 ? styles.pos : undefined}>{version.costShift === 0 ? "unchanged" : `${signedCash(version.costShift)} on the previous`}</small>}
        </span>

        <span>
          <b>FINISH TARGET</b>
          {formatDay(version.finishTarget)}
          {version.finishShift !== null && <small className={version.finishShift > 0 ? styles.neg : version.finishShift < 0 ? styles.pos : undefined}>{version.finishShift === 0 ? "unchanged" : `${signedDays(version.finishShift)} on the previous`}</small>}
        </span>
      </span>

      <span className={styles.cell}>
        <span className={styles.figLabel}>{left.title}</span>
        <b>{left.text}</b>
        <small>{left.note}</small>
      </span>
    </li>
  );
}

export function ProjectBaselineHistoryView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<PeriodControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  const today = useMemo(startOfToday, []);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectPeriodControl(projectId)
      .then((value) => {
        if (!cancelled) {
          setData(value);
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

  const built = useMemo(() => (data ? buildHistory(data, today) : null), [data, today]);
  const history: History | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const cost = useMemo(() => (history ? costLadder(history) : null), [history]);
  const finish = useMemo(() => (history ? finishLadder(history) : null), [history]);

  async function copySummary() {
    if (!history) {
      return;
    }

    const ok = await copyText(historyMarkdown(history, projectName));

    setMessage(ok ? "Copied the baseline history as Markdown." : "Could not copy the baseline history.");
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

            <div className="eyebrow">BASELINE HISTORY</div>

            <h1>How far have the baselines moved?</h1>

            <p className={styles.subtitle}>
              Every re-baseline resets the cost and finish targets the project is measured against. This page lines up each version, shows what every reset moved, and compares the forecast with the original baseline as well as the current one, so a reset cannot quietly hide an overrun.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/period-board`}>
              Period board
            </Link>

            <Link className="secondary-link-button" href={`${base}/forecast-drift`}>
              Forecast drift
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the baseline versions…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the baselines. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No baseline has been approved yet, so there are no targets to compare.</div>
          </section>
        )}

        {state === "ready" && history && cost && finish && (
          <>
            <section aria-label="Baseline history summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>BASELINES</div>
                <div className={styles.kpiValue}>{history.versions.length}</div>
                <div className={styles.kpiSub}>{history.resets === 0 ? "no reset since the first" : `${history.resets} ${plural(history.resets, "reset", "resets")}${history.sinceReset !== null ? `, the latest ${history.sinceReset} ${plural(history.sinceReset, "day", "days")} ago` : ""}`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COST RESET</div>
                <div className={cx(styles.kpiValue, history.costReset > 0 && styles.neg)}>{signedCash(history.costReset)}</div>
                <div className={styles.kpiSub}>{history.resets === 0 ? "cost target has not moved" : history.costResetPct !== null ? `${signedPct(history.costResetPct)} on the original cost target` : "on the original cost target"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>FINISH RESET</div>
                <div className={cx(styles.kpiValue, history.finishReset > 0 && styles.neg)}>{signedDays(history.finishReset)}</div>
                <div className={styles.kpiSub}>{history.resets === 0 ? "finish target has not moved" : `${formatDay(history.original.finishTarget)} to ${formatDay(history.current.finishTarget)}`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVER CURRENT</div>
                <div className={cx(styles.kpiValue, history.overCurrent.cost !== null && history.overCurrent.cost > 0 && styles.neg)}>{signedCash(history.overCurrent.cost)}</div>
                <div className={styles.kpiSub}>{history.overCurrent.cost === null && history.overCurrent.finish === null ? "no forecast available" : `${signedDays(history.overCurrent.finish)} on finish, against ${history.current.code}`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVER ORIGINAL</div>
                <div className={cx(styles.kpiValue, history.overOriginal.cost !== null && history.overOriginal.cost > 0 && styles.neg)}>{signedCash(history.overOriginal.cost)}</div>
                <div className={styles.kpiSub}>{history.overOriginal.cost === null && history.overOriginal.finish === null ? "no forecast available" : `${signedDays(history.overOriginal.finish)} on finish, against ${history.original.code}`}</div>
              </article>
            </section>

            <section className={styles.controls}>
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

            {history.noReason.length > 0 && (
              <p className={styles.caution} role="note">
                {history.noReason.map((version) => version.code).join(", ")} {plural(history.noReason.length, "was", "were")} approved with no reason recorded, so nothing says why the {plural(history.noReason.length, "target", "targets")} moved.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">TARGET LADDER</div>
                  <h2>Where each baseline set the target, and where the forecast sits</h2>
                </div>

                <span className={styles.muted}>drawn to scale between the lowest and highest value</span>
              </header>

              <h3 className={styles.ladderTitle}>Cost target</h3>
              <LadderChart ladder={cost} label="Cost target by baseline version and the current forecast" />

              <h3 className={styles.ladderTitle}>Finish target</h3>
              <LadderChart ladder={finish} label="Finish target by baseline version and the current forecast" />

              <ul className={styles.legend}>
                {(cost.reset || finish.reset) && (
                  <li>
                    <i className={cx(styles.swatch, styles.spanReset)} />
                    Moved by re-baselining
                  </li>
                )}
                {(cost.over || finish.over) && (
                  <li>
                    <i className={cx(styles.swatch, (cost.over ?? finish.over)?.beyond === false ? styles.spanUnder : styles.spanOver)} />
                    Forecast beyond the current target
                  </li>
                )}
                <li>
                  <i className={cx(styles.swatch, styles.dotForecast)} />
                  Forecast
                </li>
              </ul>
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">VERSION BY VERSION</div>
                  <h2>What each baseline set, and what it left behind</h2>
                </div>

                <span className={styles.muted}>
                  {history.versions.length} {plural(history.versions.length, "version", "versions")}, oldest first
                </span>
              </header>

              <ul className={styles.items}>
                {history.versions.map((version) => (
                  <VersionLine key={version.id} version={version} />
                ))}
              </ul>
            </section>

            <p className={styles.note}>
              Versions are ordered by the data date they were set from. Drafts are not counted, and the last approved version is the current baseline. A reset is the change in a target from one version to the next. Left behind is the cost and finish variance against that version recorded at the last period end closed under it, which can be some weeks before the reset, so it is a guide to the overrun the reset followed rather than an exact figure. Over current and over original compare the forecast cost and finish date held in the period control with the targets of the current and the first baseline.
              {history.drafts > 0 ? ` ${history.drafts} draft ${plural(history.drafts, "baseline is", "baselines are")} left out.` : ""}
              {history.skipped > 0 ? ` ${history.skipped} ${plural(history.skipped, "version has", "versions have")} no usable cost or finish target and ${plural(history.skipped, "is", "are")} left out.` : ""}
              {history.unknownSnapshots > 0 ? ` ${history.unknownSnapshots} period-end ${plural(history.unknownSnapshots, "snapshot belongs", "snapshots belong")} to a baseline that is not listed and ${plural(history.unknownSnapshots, "is", "are")} left out.` : ""}
              {history.skippedSnapshots > 0 ? ` ${history.skippedSnapshots} period-end ${plural(history.skippedSnapshots, "snapshot has", "snapshots have")} an unusable date or variance and ${plural(history.skippedSnapshots, "is", "are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
