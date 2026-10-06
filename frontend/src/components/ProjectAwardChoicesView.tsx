"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectProcurement } from "@/lib/api";
import { FILTERS, OUTCOME_LABEL, PAGE, buildChoices, cash, choicesMarkdown, exact, filterAwards, pct, pctOne, signedCash, signedExact, type Award, type Choices, type Filter, type Outcome } from "@/lib/awardChoices";
import { plural, trunc } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { ProcurementControl } from "@/types/project";

import styles from "./ProjectAwardChoicesView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const SEGMENT: Record<Outcome, string | undefined> = {
  lowest: styles.sLowest,
  justified: styles.sJustified,
  unjustified: styles.sUnjustified,
  single: styles.sSingle,
  unmatched: styles.sUnmatched,
  noBids: styles.sNone,
};

const CHIP: Record<Outcome, string | undefined> = {
  lowest: styles.chipGood,
  justified: styles.chipPlain,
  unjustified: styles.chipBad,
  single: styles.chipWatch,
  unmatched: styles.chipWatch,
  noBids: styles.chipWatch,
};

const ORDER: Outcome[] = ["lowest", "justified", "unjustified", "single", "unmatched", "noBids"];

function Dots({ award }: { award: Award }) {
  const span = award.highest !== null && award.lowest !== null ? award.highest - award.lowest : 0;

  return (
    <span
      aria-label={`${award.bids.length} ${plural(award.bids.length, "bid", "bids")}${award.lowest !== null && award.highest !== null ? ` from ${exact(award.lowest)} to ${exact(award.highest)}` : ""}${award.selectedAmount !== null ? `, the winning bid was ${exact(award.selectedAmount)}` : ""}`}
      className={styles.dotTrack}
      role="img"
    >
      <i className={styles.dotLine} />
      {award.bids.map((bid) => {
        const left = span > 0 && award.lowest !== null ? ((bid.amount - award.lowest) / span) * 94 + 3 : 50;

        return <i className={cx(styles.dot, bid.selected ? styles.dotWin : bid.cheapest ? styles.dotCheap : styles.dotPlain, bid.selected && bid.cheapest && styles.dotWinCheap)} key={bid.id} style={{ left: `${left}%` }} title={`${bid.supplier}: ${exact(bid.amount)}, score ${bid.score}${bid.selected ? " (winner)" : ""}`} />;
      })}
    </span>
  );
}

function AwardLine({ award }: { award: Award }) {
  const above = award.outcome === "justified" || award.outcome === "unjustified";

  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{award.reference}</strong> {trunc(award.title, 56)}
        <small>
          Won by {award.supplier ?? "an unnamed supplier"}
        </small>
        <small>
          Awarded {exact(award.value)}
          {award.negotiatedFlag && award.negotiated !== null ? `, ${signedExact(award.negotiated)} against the winning bid` : ""}
        </small>
      </span>

      <span className={styles.cell}>
        {award.bids.length > 0 ? (
          <>
            <Dots award={award} />
            <b>
              {award.bids.length} {plural(award.bids.length, "bid", "bids")}
            </b>
            {award.lowest !== null && award.highest !== null && award.bids.length > 1 ? ` from ${exact(award.lowest)} to ${exact(award.highest)}` : award.lowest !== null ? ` at ${exact(award.lowest)}` : ""}
            {award.selectedAmount !== null && <small>Winning bid {exact(award.selectedAmount)}</small>}
            {above && award.lowestSupplier && (
              <small>
                Lowest: {award.lowestSupplier}, {exact(award.lowest ?? 0)}
              </small>
            )}
          </>
        ) : (
          <small>No bid is recorded for this package.</small>
        )}
      </span>

      <span className={styles.verdict}>
        <em className={cx(styles.chip, CHIP[award.outcome])}>{OUTCOME_LABEL[award.outcome]}</em>
        {above && (
          <small>
            {signedExact(award.premium)} above the lowest bid{award.premiumShare !== null ? ` (+${pctOne(award.premiumShare)})` : ""}
          </small>
        )}
        {above && award.selectedScore !== null && award.lowestScore !== null && (
          <small>
            scored {Math.round(award.selectedScore)} against {Math.round(award.lowestScore)} for the lowest bidder
          </small>
        )}
        {award.outcome === "unmatched" && award.lowest !== null && <small>cheapest bid on record {exact(award.lowest)}</small>}
      </span>
    </li>
  );
}

function Split({ data }: { data: Choices }) {
  const t = data.totals;
  const counts: Record<Outcome, number> = { lowest: t.lowest, justified: t.justified, unjustified: t.unjustified, single: t.single, unmatched: t.unmatched, noBids: t.noBids };

  return (
    <>
      <span aria-label={`How awards were decided: ${ORDER.map((key) => `${counts[key]} ${OUTCOME_LABEL[key].toLowerCase()}`).join(", ")}`} className={styles.split} role="img">
        {ORDER.map((key) => (counts[key] > 0 ? <i className={SEGMENT[key]} key={key} style={{ flexGrow: counts[key] }} title={`${OUTCOME_LABEL[key]}: ${counts[key]}`} /> : null))}
      </span>

      <ul className={styles.legend}>
        {ORDER.map((key) => (
          <li key={key}>
            <i className={cx(styles.swatch, SEGMENT[key])} />
            {OUTCOME_LABEL[key]}: {counts[key]}
            {` (${Math.round((counts[key] / t.awards) * 100)}%)`}
          </li>
        ))}
      </ul>
    </>
  );
}

export function ProjectAwardChoicesView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<ProcurementControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectProcurement(projectId)
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

  const built = useMemo(() => (data ? buildChoices(data) : null), [data]);
  const choices = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (choices ? filterAwards(choices.awards, filter) : []), [choices, filter]);
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const t = choices?.totals;

  async function copySummary() {
    if (!choices) {
      return;
    }

    const ok = await copyText(choicesMarkdown(choices, list, projectName, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the award choices as Markdown." : "Could not copy the award choices.");
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

            <div className="eyebrow">AWARD CHOICES</div>

            <h1>Did the packages go to the lowest bid, and when not, why?</h1>

            <p className={styles.subtitle}>
              Setting the winning bid against the rest of the field on each awarded package shows how often price decided the award, how much was paid above the cheapest bid, and whether the extra money bought a better score.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/supplier-board`}>
              Supplier board
            </Link>

            <Link className="secondary-link-button" href={`${base}/procurement`}>
              Procurement
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the packages and bids…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the packages and bids. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>No package has been awarded yet, so there is no choice to look at.</div>
          </section>
        )}

        {state === "ready" && choices && t && (
          <>
            <section aria-label="Award choices summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>AWARDS</div>
                <div className={styles.kpiValue}>{t.awards}</div>
                <div className={styles.kpiSub}>{cash(t.value)} awarded</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>WON BY LOWEST</div>
                <div className={cx(styles.kpiValue, t.wonLowestShare !== null && t.wonLowestShare < 0.5 && styles.neg)}>{pct(t.wonLowestShare)}</div>
                <div className={styles.kpiSub}>{t.compared > 0 ? `${t.lowest} of ${t.compared} awards with competing bids` : "no award had competing bids"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>ABOVE LOWEST</div>
                <div className={cx(styles.kpiValue, t.unjustifiedPremium > 0 && styles.neg)}>{cash(t.premium)}</div>
                <div className={styles.kpiSub}>
                  {t.above} {plural(t.above, "award", "awards")}, {cash(t.unjustifiedPremium)} with no better score
                </div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>SINGLE BID</div>
                <div className={styles.kpiValue}>{t.single}</div>
                <div className={styles.kpiSub}>{t.unmatched + t.noBids > 0 ? `${t.unmatched + t.noBids} more with no bid from the winner` : `of ${t.awards} ${plural(t.awards, "award", "awards")}`}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>BID SPREAD</div>
                <div className={styles.kpiValue}>{pct(t.medianSpread)}</div>
                <div className={styles.kpiSub}>{t.medianSpread === null ? "no award had two bids to compare" : "median gap from the lowest to the highest bid"}</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Awards</span>

                <div aria-label="Which awards to list" className={styles.segmented} role="group">
                  {FILTERS.map((option) => (
                    <button
                      aria-pressed={filter === option.key}
                      className={cx(styles.segment, filter === option.key && styles.segmentOn)}
                      key={option.key}
                      onClick={() => {
                        setFilter(option.key);
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

            {t.unjustified > 0 && (
              <p className={styles.caution} role="note">
                {t.unjustified} {plural(t.unjustified, "package was", "packages were")} awarded to a supplier who cost {cash(t.unjustifiedPremium)} more than the cheapest bidder without scoring better.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">HOW THE AWARDS WERE DECIDED</div>
                  <h2>Price, score or too few bids</h2>
                </div>

                <span className={styles.muted}>{t.awards} {plural(t.awards, "award", "awards")}</span>
              </header>

              <Split data={choices} />

              {t.negotiatedFlagged > 0 && (
                <p className={styles.hint}>
                  {t.negotiatedFlagged} {plural(t.negotiatedFlagged, "award was", "awards were")} made at a different value from the winning bid, {signedCash(t.negotiatedNet)} in total{t.negotiatedUp > 0 ? `, ${t.negotiatedUp} of them above the bid` : ""}.
                </p>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">AWARD BY AWARD</div>
                  <h2>The winning bid against the field</h2>
                </div>

                <span className={styles.muted}>
                  {list.length} of {choices.awards.length} {plural(choices.awards.length, "award", "awards")}
                </span>
              </header>

              <p className={styles.keyLine}>
                <i className={cx(styles.dot, styles.dotWin, styles.keyDot)} /> winner <i className={cx(styles.dot, styles.dotCheap, styles.keyDot)} /> cheapest <i className={cx(styles.dot, styles.dotPlain, styles.keyDot)} /> other bid
              </p>

              {list.length === 0 ? (
                <p className={styles.quiet}>No award matches this selection.</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {list.slice(0, shown).map((award) => (
                      <AwardLine award={award} key={award.id} />
                    ))}
                  </ul>

                  {list.length > shown && (
                    <div className={styles.more}>
                      <button className={styles.moreButton} onClick={() => setShown((current) => current + PAGE)} type="button">
                        Show {Math.min(PAGE, list.length - shown)} more
                      </button>
                      <span className={styles.muted}>
                        {shown} of {list.length} shown
                      </span>
                    </div>
                  )}
                </>
              )}
            </section>

            <p className={styles.note}>
              An award is a package with a winning supplier that is not cancelled. The field is the bids on the package that are not marked rejected, and the lowest bid is the cheapest of them; bids tied on price count as the lowest together. The winner&apos;s bid is the one from the awarded supplier. A higher price is shown as better scored when the winner&apos;s combined score beats that of the lowest bidder by more than half a point. The amount above the lowest bid is the winner&apos;s bid less the lowest bid, and a difference between the awarded value and the winner&apos;s bid, such as a negotiated price, is reported separately. Awards with fewer than two bids on record cannot be compared on price.
              {choices.rejectedBids > 0 ? ` ${choices.rejectedBids} rejected ${plural(choices.rejectedBids, "bid is", "bids are")} not counted in the field.` : ""}
              {choices.skippedBids > 0 ? ` ${choices.skippedBids} ${plural(choices.skippedBids, "bid has", "bids have")} no usable amount and ${plural(choices.skippedBids, "was", "were")} left out.` : ""}
              {choices.noSupplier > 0 ? ` ${choices.noSupplier} ${plural(choices.noSupplier, "package is", "packages are")} marked awarded with no supplier and ${plural(choices.noSupplier, "is", "are")} left out.` : ""}
            </p>
          </>
        )}
      </main>
    </div>
  );
}
