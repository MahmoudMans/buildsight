"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { getProjectCommercial } from "@/lib/api";
import { FILTERS, GOOD, GROUP_LABELS, GROUP_OF, MIN_GROUP, PAGE, RATE_TOLERANCE, TOLERANCE, WATCH, bandOf, buildCertificates, certificatesMarkdown, dayCount, eur, filterRows, flagText, pct, rate, type Certificates, type Check, type Coverage, type Filter, type Flag, type Grouping, type Row, type Segment } from "@/lib/certificateChecks";
import { formatDay, plural, words } from "@/lib/openItems";
import { copyText } from "@/lib/textExport";
import type { CommercialControl } from "@/types/project";

import styles from "./ProjectCertificateChecksView.module.css";

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

const FILL: Record<"good" | "watch" | "bad", string | undefined> = {
  good: styles.fillGood,
  watch: styles.fillWatch,
  bad: styles.fillBad,
};

const SEGMENT: Record<Segment["kind"], string | undefined> = {
  period: styles.segPeriod,
  overlap: styles.segOverlap,
  gap: styles.segGap,
};

const SEGMENT_LABEL: Record<Segment["kind"], string> = {
  period: "Period covered by one certificate",
  overlap: "Period that overlaps another certificate",
  gap: "Days no certificate covers",
};

function chipOf(flag: Flag): string | undefined {
  if (flag === "netMismatch" || flag === "paidMismatch" || flag === "overpaid" || flag === "certifiedAboveApplied") {
    return styles.chipBad;
  }

  if (GROUP_OF[flag] === "records" && flag !== "statusMismatch") {
    return styles.chipPlain;
  }

  return styles.chipWatch;
}

function CheckLine({ check }: { check: Check }) {
  const fill = check.share === null || check.share === 0 ? null : check.share <= 0.2 ? styles.fillWatch : styles.fillBad;

  return (
    <li className={cx(styles.groupRow, styles.checkRow)}>
      <span className={styles.what}>
        <strong>{check.label}</strong>
        <small>{GROUP_LABELS[check.group]}</small>
      </span>

      <span aria-label={`${check.label}: ${check.count} of ${check.base} certificates`} className={styles.track} role="img">
        {fill && check.share !== null && <i className={cx(styles.fill, fill)} style={{ width: `${Math.min(1, check.share) * 100}%` }} />}
      </span>

      <span className={styles.rateFig}>
        <b>{check.base > 0 ? check.count : "—"}</b>
        <small>{check.base > 0 ? `of ${check.base} ${plural(check.base, "certificate", "certificates")}` : "none to check"}</small>
      </span>
    </li>
  );
}

function StatusLine({ group }: { group: Grouping }) {
  const band = bandOf(group.cleanShare, group.count);

  return (
    <li className={styles.grp}>
      <span className={styles.what}>
        <strong>{group.label}</strong>
        <small>
          {group.count} {plural(group.count, "certificate", "certificates")}
        </small>
      </span>

      <span className={styles.bars}>
        <span className={styles.barLine} title={`${group.clean} of ${group.count} certificates have nothing to fix`}>
          <em>Clean</em>
          <span className={styles.track}>{group.cleanShare !== null && <i className={cx(styles.fill, band ? FILL[band] : styles.fillQuiet)} style={{ width: `${group.cleanShare * 100}%` }} />}</span>
          <b>{pct(group.cleanShare)}</b>
        </span>
      </span>
    </li>
  );
}

function Timeline({ coverage }: { coverage: Coverage }) {
  return (
    <>
      <ul aria-label="Certificate periods in date order, with the days no certificate covers" className={styles.timeline}>
        {coverage.segments.map((segment, index) => (
          <li className={cx(styles.seg, SEGMENT[segment.kind])} key={`${index}-${segment.kind}`} style={{ flexGrow: segment.days }} title={segment.label} />
        ))}
      </ul>

      <div className={styles.axis}>
        <span>{formatDay(coverage.from)}</span>
        <span>{formatDay(coverage.to)}</span>
      </div>

      <ul className={styles.legend}>
        {(["period", "gap", "overlap"] as const).map((kind) => (
          <li key={kind}>
            <i className={cx(styles.swatch, SEGMENT[kind])} />
            {SEGMENT_LABEL[kind]}
          </li>
        ))}
      </ul>
    </>
  );
}

function CertificateLine({ row, usual }: { row: Row; usual: number | null }) {
  const certified = row.certified !== null;
  const open = row.outstanding !== null && row.outstanding > TOLERANCE;

  return (
    <li className={styles.item}>
      <span className={styles.what}>
        <strong>{row.reference.trim() || "No reference"}</strong>
        <small>
          {words(row.status)}
          {row.applied !== null ? `, applied for ${formatDay(row.applied)}` : ""}
        </small>
        <small>{certified ? `Net ${row.net !== null ? eur(row.net) : "—"}, retention ${row.retention !== null && row.retention > 0 ? eur(row.retention) : "none"}` : "Not certified"}</small>
      </span>

      <span className={styles.records}>
        <span className={styles.record}>
          <b>Period</b>
          {row.start !== null && row.end !== null ? (
            <>
              <span>{formatDay(row.start)}</span>
              <small>to {formatDay(row.end)}</small>
            </>
          ) : (
            <span className={styles.missing}>missing or reversed</span>
          )}
        </span>

        <span className={styles.record}>
          <b>Certified</b>
          {certified ? <span>{eur(row.certified as number)}</span> : <span className={styles.pending}>not yet</span>}
          {row.application !== null && <small>applied {eur(row.application)}</small>}
        </span>

        <span className={styles.record}>
          <b>Paid</b>
          <span>{row.paid !== null ? eur(row.paid) : "—"}</span>
          <small>{open ? `${eur(row.outstanding as number)} outstanding` : certified ? "nothing outstanding" : "nothing due yet"}</small>
        </span>
      </span>

      <span className={styles.verdict}>
        {row.flags.length === 0 && <em className={cx(styles.chip, styles.chipGood)}>In order</em>}
        {row.flags.map((flag) => (
          <em className={cx(styles.chip, chipOf(flag))} key={flag}>
            {flagText(flag, row, usual)}
          </em>
        ))}
      </span>
    </li>
  );
}

function refs(list: string[]): string {
  return `${list.slice(0, 4).join(", ")}${list.length > 4 ? ` and ${list.length - 4} more` : ""}`;
}

function Total({ label, value, note }: { label: string; value: string; note?: string | null }) {
  return (
    <div className={styles.totalRow}>
      <dt>{label}</dt>
      <dd>
        <b>{value}</b>
        {note && <small>{note}</small>}
      </dd>
    </div>
  );
}

export function ProjectCertificateChecksView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<CommercialControl | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!projectId) {
      return undefined;
    }

    getProjectCommercial(projectId)
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

  const built = useMemo(() => (data ? buildCertificates(data) : null), [data]);
  const certs: Certificates | null = built && built.ok ? built.data : null;
  const projectName = data?.project?.name ?? "Project";
  const list = useMemo(() => (certs ? filterRows(certs.rows, filter) : []), [certs, filter]);
  const filterLabel = FILTERS.find((option) => option.key === filter)?.label ?? "";
  const wrongRows = certs ? certs.rows.filter((row) => row.serious) : [];

  async function copySummary() {
    if (!certs) {
      return;
    }

    const ok = await copyText(certificatesMarkdown(certs, list, projectName, filter === "all" ? null : filterLabel));

    setMessage(ok ? "Copied the certificate checks as Markdown." : "Could not copy the certificate checks.");
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

            <div className="eyebrow">CERTIFICATE CHECKS</div>

            <h1>Do the payment certificates add up?</h1>

            <p className={styles.subtitle}>
              A payment certificate is a claim on cash, so its figures have to agree. This page checks that the periods run on without a gap or overlap, that the net is the certified amount less retention, that paid plus outstanding is the net, and that status and dates tell the same story.
            </p>
          </div>

          <div className={styles.headerLinks}>
            <Link className="secondary-link-button" href={`${base}/commercial-board`}>
              Commercial board
            </Link>

            <Link className="secondary-link-button" href={`${base}/cash-position`}>
              Cash position
            </Link>
          </div>
        </header>

        {state === "loading" && <div className={styles.loading}>Reading the certificates…</div>}

        {state === "error" && (
          <div className="offline-banner">
            <div>
              <strong>Could not load the commercial data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {state === "ready" && built && !built.ok && (
          <section className={styles.panel}>
            <div className={styles.emptySmall}>{built.reason === "allVoid" ? "Every payment certificate is void, so there is nothing to check." : "No payment certificate has been recorded yet, so there is nothing to check."}</div>
          </section>
        )}

        {state === "ready" && certs && (
          <>
            <section aria-label="Certificate check summary" className={styles.kpis}>
              <article className={cx(styles.kpi, styles.kpiDark)}>
                <div className={styles.kpiLabel}>CERTIFICATES</div>
                <div className={styles.kpiValue}>{certs.live}</div>
                <div className={styles.kpiSub}>{certs.voided > 0 ? `${certs.voided} void not checked` : "none void"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>NOTHING TO FIX</div>
                <div className={styles.kpiValue}>{certs.clean}</div>
                <div className={styles.kpiSub}>{pct(certs.cleanShare)} of certificates</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>PERIOD ISSUES</div>
                <div className={cx(styles.kpiValue, certs.periodIssues > 0 && styles.neg)}>{certs.periodIssues}</div>
                <div className={styles.kpiSub}>{certs.coverage && certs.coverage.gapDays > 0 ? `${dayCount(certs.coverage.gapDays)} with no certificate` : "gaps, overlaps or bad dates"}</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>AMOUNT ISSUES</div>
                <div className={cx(styles.kpiValue, certs.amountIssues > 0 && styles.neg)}>{certs.amountIssues}</div>
                <div className={styles.kpiSub}>figures that do not add up</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>RECORD ISSUES</div>
                <div className={cx(styles.kpiValue, certs.recordIssues > 0 && styles.neg)}>{certs.recordIssues}</div>
                <div className={styles.kpiSub}>status or dates that disagree</div>
              </article>
            </section>

            <section className={styles.controls}>
              <div className={styles.field}>
                <span className={styles.controlLabel}>Certificates</span>

                <div aria-label="Which certificates to list" className={styles.segmented} role="group">
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

            {wrongRows.length > 0 && (
              <p className={styles.caution} role="note">
                {wrongRows.length} of {certs.moneyBase} certified {plural(certs.moneyBase, "certificate has", "certificates have")} amounts that do not add up: {refs(wrongRows.map((row) => row.reference.trim()))}.
              </p>
            )}

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">THE PERIODS</div>
                  <h2>Do the certificate periods run on without a gap</h2>
                </div>

                <span className={styles.muted}>{certs.coverage ? (certs.coverage.gapDays === 0 && certs.coverage.doubleDays === 0 ? "no gaps or overlaps" : `${dayCount(certs.coverage.gapDays)} uncovered, ${dayCount(certs.coverage.doubleDays)} twice`) : "no usable period dates"}</span>
              </header>

              {certs.coverage ? (
                <>
                  <Timeline coverage={certs.coverage} />

                  <p className={styles.hint}>
                    Each block is one certificate period in date order, as wide as the days it covers. The periods span {dayCount(certs.coverage.span)}, from {formatDay(certs.coverage.from)} to {formatDay(certs.coverage.to)}. Certificates with missing or reversed dates cannot be placed and are left off the strip.
                  </p>
                </>
              ) : (
                <p className={styles.quiet}>No certificate has usable period dates, so the timeline cannot be drawn.</p>
              )}
            </section>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">CHECK BY CHECK</div>
                  <h2>Which checks the certificates fail</h2>
                </div>

                <span className={styles.muted}>
                  {certs.withProblem} of {certs.live} {plural(certs.live, "certificate", "certificates")} fail at least one
                </span>
              </header>

              <ul className={styles.rates}>
                {certs.checks.map((check) => (
                  <CheckLine check={check} key={check.flag} />
                ))}
              </ul>

              <p className={styles.hint}>
                Amounts are compared to the nearest {eur(TOLERANCE)}. Amount checks apply to certified, partly paid and paid certificates.
                {certs.usualRate !== null ? ` Most certificates hold ${rate(certs.usualRate)} retention; one that differs by more than ${Math.round(RATE_TOLERANCE * 1000) / 10} percentage points is flagged.` : " Too few certificates share a retention rate to say what is usual, so retention is not checked."}
              </p>
            </section>

            <div className={styles.twoCol}>
              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">BY STATUS</div>
                    <h2>Where the problems sit</h2>
                  </div>
                </header>

                <ul className={styles.rates}>
                  {certs.statuses.map((group) => (
                    <StatusLine group={group} key={group.key} />
                  ))}
                </ul>

                <p className={styles.hint}>
                  Clean is the share of certificates with nothing to fix. Green is {Math.round(GOOD * 100)}% or more, amber {Math.round(WATCH * 100)}% or more, red below that. Bars with fewer than {MIN_GROUP} certificates behind them are not coloured.
                </p>
              </section>

              <section className={styles.panel}>
                <header className={styles.panelHead}>
                  <div>
                    <div className="eyebrow">THE TOTALS</div>
                    <h2>Adding up every certificate</h2>
                  </div>
                </header>

                <dl className={styles.totals}>
                  <Total label="Applied for" value={eur(certs.totals.applied)} />
                  <Total label="Certified" value={eur(certs.totals.certified)} />
                  <Total label="Retention held" note={certs.usualRate !== null ? `usual rate ${rate(certs.usualRate)}` : null} value={eur(certs.totals.retention)} />
                  <Total
                    label="Net certified"
                    note={Math.abs(certs.totals.netGap) > TOLERANCE ? `${eur(Math.abs(certs.totals.netGap))} ${certs.totals.netGap > 0 ? "more" : "less"} than certified less retention` : "equals certified less retention"}
                    value={eur(certs.totals.net)}
                  />
                  <Total label="Paid" value={eur(certs.totals.paid)} />
                  <Total
                    label="Outstanding"
                    note={Math.abs(certs.totals.paidGap) > TOLERANCE ? `paid plus outstanding is ${eur(Math.abs(certs.totals.paidGap))} ${certs.totals.paidGap > 0 ? "more" : "less"} than the net` : "paid plus outstanding equals the net"}
                    value={eur(certs.totals.outstanding)}
                  />
                </dl>

                <p className={styles.hint}>Totals cover every certificate that is not void. The two comparison lines look only at certified, partly paid and paid certificates.</p>
              </section>
            </div>

            <section className={styles.panel}>
              <header className={styles.panelHead}>
                <div>
                  <div className="eyebrow">CERTIFICATE BY CERTIFICATE</div>
                  <h2>What each certificate needs</h2>
                </div>

                <span className={styles.muted}>
                  {list.length} of {certs.rows.length} {plural(certs.rows.length, "certificate", "certificates")}, wrong amounts first
                </span>
              </header>

              {list.length === 0 ? (
                <p className={styles.quiet}>No certificate matches this selection.</p>
              ) : (
                <>
                  <ul className={styles.items}>
                    {list.slice(0, shown).map((row) => (
                      <CertificateLine key={row.key} row={row} usual={certs.usualRate} />
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
              Void certificates are not checked. A certificate whose amounts do not add up is listed before the others. The status checks look for a certified, partly paid or paid status without a certified amount or date, a paid status with money still outstanding, and payments recorded against a draft, submitted or rejected certificate. The date checks look for certification due or done before the application, payment due before certification, and an application made before its period started. These checks compare the certificates with each other and with their own figures; they cannot tell whether the amounts match the valuation on site.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
