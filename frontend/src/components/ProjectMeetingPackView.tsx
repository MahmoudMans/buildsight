"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import { SECTION_DEFS, buildPack, packToMarkdown, type PackLine, type PackMeta, type PackSection, type SectionKey } from "@/lib/meetingPack";
import { MODULE_LABEL, SEVERITY_LABEL, formatDay, isoDay, loadSources, plural, projectOf, startOfToday, toDay, type ModuleKey, type Severity, type Sources } from "@/lib/openItems";
import { copyText, downloadText, slugName } from "@/lib/textExport";

import styles from "./ProjectMeetingPackView.module.css";

const LIMITS = [5, 10, 20, 50] as const;
const SOURCE_COUNT = 9;
const DEFAULT_TITLE = "Weekly progress meeting";
const STORAGE_PREFIX = "buildsight.meetingPack.";

const SEVERITY_CLASS: Record<Severity, string | undefined> = {
  critical: styles.sevCritical,
  high: styles.sevHigh,
  medium: styles.sevMedium,
  low: styles.sevLow,
};

function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

function longDate(day: number): string {
  if (!Number.isFinite(day)) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(day * 86_400_000),
  );
}

interface Remembered {
  title: string;
  chair: string;
  attendees: string;
}

function readRemembered(projectId: string): Partial<Remembered> {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);

    if (!raw) {
      return {};
    }

    const parsed: unknown = JSON.parse(raw);

    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;

      return {
        title: typeof record.title === "string" ? record.title : undefined,
        chair: typeof record.chair === "string" ? record.chair : undefined,
        attendees: typeof record.attendees === "string" ? record.attendees : undefined,
      };
    }
  } catch {
    // storage can be blocked or hold something else; start empty
  }

  return {};
}

function remember(projectId: string, value: Remembered) {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, JSON.stringify(value));
  } catch {
    // storage can be blocked; the pack still works
  }
}

export function ProjectMeetingPackView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const today = useMemo(startOfToday, []);

  const [sources, setSources] = useState<Sources | null>(null);
  const [failed, setFailed] = useState<ModuleKey[]>([]);
  const [title, setTitle] = useState(DEFAULT_TITLE);
  const [dateValue, setDateValue] = useState(() => isoDay(startOfToday()));
  const [chair, setChair] = useState("");
  const [attendees, setAttendees] = useState("");
  const [notes, setNotes] = useState("");
  const [enabled, setEnabled] = useState<ReadonlySet<SectionKey>>(() => new Set(SECTION_DEFS.map((item) => item.key)));
  const [limit, setLimit] = useState<number>(10);
  const [message, setMessage] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!projectId) {
      return;
    }

    const saved = readRemembered(projectId);

    if (saved.title) {
      setTitle(saved.title);
    }

    if (saved.chair) {
      setChair(saved.chair);
    }

    if (saved.attendees) {
      setAttendees(saved.attendees);
    }

    setRestored(true);
  }, [projectId]);

  useEffect(() => {
    if (projectId && restored) {
      remember(projectId, { title, chair, attendees });
    }
  }, [projectId, restored, title, chair, attendees]);

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
  const pack = useMemo(() => (sources ? buildPack(sources, today, limit) : null), [sources, today, limit]);

  const shown: PackSection[] = useMemo(() => {
    if (!pack) {
      return [];
    }

    return SECTION_DEFS.filter((item) => enabled.has(item.key)).map((item) => pack[item.key]);
  }, [pack, enabled]);

  const meta: PackMeta = {
    title: title.trim() || DEFAULT_TITLE,
    project: project?.name ?? "Project",
    date: longDate(toDay(dateValue)) || formatDay(today),
    chair,
    attendees,
    notes,
  };

  const markdown = packToMarkdown(meta, shown, formatDay(today));

  function toggle(key: SectionKey) {
    setEnabled((current) => {
      const next = new Set(current);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  }

  async function copy() {
    const ok = await copyText(markdown);

    setMessage(ok ? "Copied the pack as Markdown." : "Could not copy. Use Download .md instead.");
  }

  function download() {
    const name = `${slugName(project?.name ?? "project")}-meeting-pack-${dateValue || isoDay(today)}.md`;

    downloadText(name, markdown, "text/markdown");
    setMessage(`Downloaded ${name}.`);
  }

  const loaded = sources !== null;
  const failedAll = loaded && failed.length >= SOURCE_COUNT;

  function renderLines(lines: PackLine[]) {
    return (
      <>
        <p className={styles.swipe}>Swipe sideways to see every column.</p>

        <div className={styles.tableWrap}>
          <table className={cx(styles.table, styles.sheetTable)}>
            <thead>
              <tr>
                <th>REF</th>
                <th>ITEM</th>
                <th>OWNER</th>
                <th>DUE</th>
                <th>NOTE</th>
              </tr>
            </thead>

            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.ref}-${index}`}>
                  <td>
                    <Link className={styles.refLink} href={`${base}/${line.path}`}>
                      {line.ref}
                    </Link>
                  </td>
                  <td className={styles.wrap}>
                    {line.title}
                    {line.severity && <span className={cx(styles.sev, SEVERITY_CLASS[line.severity])}>{SEVERITY_LABEL[line.severity]}</span>}
                  </td>
                  <td>{line.owner}</td>
                  <td className={styles.nowrap}>{line.due}</td>
                  <td className={styles.wrap}>{line.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={cx(styles.header, styles.noPrint)}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">MEETING PACK</div>

            <h1>Your meeting agenda, already filled in</h1>

            <p className={styles.subtitle}>
              Builds the weekly agenda from live project data: what is overdue, what needs a decision, what is blocked, the top risks
              and what is coming. Tick the parts you want, then copy it, download it or print it.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/inbox`}>
            Open action inbox
          </Link>
        </header>

        {!loaded && <div className={styles.loading}>Gathering the latest figures…</div>}

        {failedAll && (
          <div className="offline-banner">
            <div>
              <strong>Could not load any project data. Check that the backend is running.</strong>
            </div>
          </div>
        )}

        {loaded && !failedAll && failed.length > 0 && (
          <div className={cx("offline-banner", styles.noPrint)}>
            <div>
              <strong>Could not load {failed.map((key) => MODULE_LABEL[key].toLowerCase()).join(", ")}.</strong>
              <span> Anything from those modules is missing from the pack.</span>
            </div>
          </div>
        )}

        {loaded && !failedAll && pack && (
          <>
            <section className={cx(styles.panel, styles.noPrint)}>
              <div className={styles.setup}>
                <div className={styles.fields}>
                  <div className="eyebrow">DETAILS</div>

                  <label className={styles.field}>
                    <span>Meeting title</span>
                    <input className={styles.input} onChange={(event) => setTitle(event.target.value)} type="text" value={title} />
                  </label>

                  <label className={styles.field}>
                    <span>Date</span>
                    <input className={styles.input} onChange={(event) => setDateValue(event.target.value)} type="date" value={dateValue} />
                  </label>

                  <label className={styles.field}>
                    <span>Chair</span>
                    <input className={styles.input} onChange={(event) => setChair(event.target.value)} type="text" value={chair} />
                  </label>

                  <label className={styles.field}>
                    <span>Attendees</span>
                    <input
                      className={styles.input}
                      onChange={(event) => setAttendees(event.target.value)}
                      placeholder="Names, separated by commas"
                      type="text"
                      value={attendees}
                    />
                  </label>

                  <label className={styles.field}>
                    <span>Opening note</span>
                    <textarea className={styles.textarea} onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} />
                  </label>
                </div>

                <div className={styles.sections}>
                  <div className={styles.sectionsHead}>
                    <div className="eyebrow">SECTIONS</div>

                    <div className={styles.miniActions}>
                      <button className={styles.linkButton} onClick={() => setEnabled(new Set(SECTION_DEFS.map((item) => item.key)))} type="button">
                        All
                      </button>

                      <button className={styles.linkButton} onClick={() => setEnabled(new Set())} type="button">
                        None
                      </button>
                    </div>
                  </div>

                  <ul className={styles.checks}>
                    {SECTION_DEFS.map((item) => {
                      const section = pack[item.key];

                      return (
                        <li key={item.key}>
                          <label className={styles.check}>
                            <input checked={enabled.has(item.key)} onChange={() => toggle(item.key)} type="checkbox" />

                            <span className={styles.checkText}>
                              <strong>{item.title}</strong>
                              <small>{item.hint}</small>
                            </span>

                            {item.key !== "position" && <span className={styles.count}>{section.total}</span>}
                          </label>
                        </li>
                      );
                    })}
                  </ul>

                  <label className={cx(styles.field, styles.limit)}>
                    <span>Items per section</span>
                    <select className={styles.input} onChange={(event) => setLimit(Number(event.target.value))} value={limit}>
                      {LIMITS.map((value) => (
                        <option key={value} value={value}>
                          Up to {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className={styles.buttons}>
                <button className={styles.primary} disabled={shown.length === 0} onClick={copy} type="button">
                  Copy as Markdown
                </button>

                <button className={styles.secondary} disabled={shown.length === 0} onClick={download} type="button">
                  Download .md
                </button>

                <button className={styles.secondary} disabled={shown.length === 0} onClick={() => window.print()} type="button">
                  Print or save as PDF
                </button>

                {message && (
                  <span className={styles.status} role="status">
                    {message}
                  </span>
                )}
              </div>
            </section>

            <article aria-label="Meeting pack preview" className={styles.sheet}>
              <header className={styles.sheetHead}>
                <div className={styles.sheetEyebrow}>{meta.project.toUpperCase()}</div>
                <h2>{meta.title}</h2>

                <dl className={styles.sheetMeta}>
                  <div>
                    <dt>Date</dt>
                    <dd>{meta.date}</dd>
                  </div>

                  {chair.trim() && (
                    <div>
                      <dt>Chair</dt>
                      <dd>{chair.trim()}</dd>
                    </div>
                  )}

                  {attendees.trim() && (
                    <div>
                      <dt>Attendees</dt>
                      <dd>{attendees.trim()}</dd>
                    </div>
                  )}
                </dl>

                {notes.trim() && <p className={styles.sheetNote}>{notes.trim()}</p>}
              </header>

              {shown.length === 0 && <div className={styles.emptySmall}>No sections are ticked, so there is nothing to show. Tick at least one above.</div>}

              {shown.map((item, index) => (
                <section className={styles.sheetSection} key={item.key}>
                  <h3>
                    {index + 1}. {item.title}
                    {item.key !== "position" && <span className={styles.sheetCount}>{item.total}</span>}
                  </h3>

                  {item.key === "position" ? (
                    <dl className={styles.positionFacts}>
                      {item.facts.map((fact) => (
                        <div key={fact.label}>
                          <dt>{fact.label}</dt>
                          <dd>{fact.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : item.lines.length === 0 ? (
                    <p className={styles.muted}>Nothing to report.</p>
                  ) : (
                    <>
                      {renderLines(item.lines)}

                      {item.total > item.lines.length && (
                        <p className={styles.hint}>
                          Showing {item.lines.length} of {item.total} {plural(item.total, "item", "items")}. The rest are in the action inbox.
                        </p>
                      )}
                    </>
                  )}
                </section>
              ))}

              {shown.length > 0 && (
                <>
                  <section className={styles.sheetSection}>
                    <h3>
                      {shown.length + 1}. Actions from this meeting
                    </h3>

                    <div className={styles.blanks}>
                      <div />
                      <div />
                      <div />
                    </div>
                  </section>

                  <section className={styles.sheetSection}>
                    <h3>
                      {shown.length + 2}. Any other business
                    </h3>

                    <div className={styles.blanks}>
                      <div />
                      <div />
                    </div>
                  </section>
                </>
              )}
            </article>

            <p className={cx(styles.note, styles.noPrint)}>
              Everything comes from the live records. Overdue means past its due date, and decisions waiting covers proposed decisions,
              change decisions, change orders, claims, payment certificates and package awards. Blocked picks up blocked actions,
              work packages and anything whose status says so. The pack is a snapshot of right now, so build it just before the meeting.
              Title, chair and attendees are remembered in this browser for next time.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
