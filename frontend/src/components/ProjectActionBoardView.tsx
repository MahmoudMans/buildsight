"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  type DragEvent as ReactDragEvent,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { BuildSightSidebar } from "@/components/BuildSightSidebar";
import {
  BuildSightApiError,
  getProjectGovernance,
  updateGovernanceAction,
} from "@/lib/api";
import type {
  GovernanceAction,
  GovernanceActionPriority,
  GovernanceActionStatus,
  GovernanceControl,
  GovernanceRiskLevel,
} from "@/types/project";

import styles from "./ProjectActionBoardView.module.css";

const DAY_MS = 86_400_000;
const DONE_LIMIT = 12;

type BoardStatus = Exclude<GovernanceActionStatus, "VOID">;
type PriorityFilter = "ALL" | GovernanceActionPriority;

const COLUMNS: ReadonlyArray<{
  status: BoardStatus;
  label: string;
  hint: string;
}> = [
  { status: "OPEN", label: "Open", hint: "Not started" },
  { status: "IN_PROGRESS", label: "In progress", hint: "Being worked on" },
  { status: "BLOCKED", label: "Blocked", hint: "Needs unblocking" },
  { status: "DONE", label: "Done", hint: "Completed" },
];

const STATUS_LABEL: Record<BoardStatus, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In progress",
  BLOCKED: "Blocked",
  DONE: "Done",
};

const COLUMN_TONE: Record<BoardStatus, string> = {
  OPEN: styles.toneOpen,
  IN_PROGRESS: styles.toneProgress,
  BLOCKED: styles.toneBlocked,
  DONE: styles.toneDone,
};

const PRIORITY_RANK: Record<GovernanceActionPriority, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

const PRIORITY_CLASS: Record<GovernanceActionPriority, string> = {
  LOW: styles.prLow,
  MEDIUM: styles.prMedium,
  HIGH: styles.prHigh,
  CRITICAL: styles.prCritical,
};

const RISK_LABEL: Record<GovernanceRiskLevel, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
};

const RISK_CLASS: Record<GovernanceRiskLevel, string> = {
  ON_TRACK: styles.riskGood,
  WATCH: styles.riskWatch,
  AT_RISK: styles.riskBad,
};

function startOfToday(): number {
  const now = new Date();

  return Math.floor(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS,
  );
}

function dayNumber(value: string): number {
  const parts = value.slice(0, 10).split("-").map(Number);

  return Math.floor(
    Date.UTC(parts[0] ?? NaN, (parts[1] ?? 1) - 1, parts[2] ?? 1) / DAY_MS,
  );
}

function formatShort(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(date);
}

function formatLong(value: string): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00` : value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function initials(name: string | null): string {
  if (!name || !name.trim()) {
    return "–";
  }

  const letters = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  return letters || "–";
}

function dueText(
  action: GovernanceAction,
  today: number,
): { late: boolean; text: string } {
  if (action.status === "DONE") {
    return {
      late: false,
      text: action.completedAt
        ? `Done ${formatShort(action.completedAt)}`
        : "Done",
    };
  }

  const diff = dayNumber(action.dueDate) - today;

  if (!Number.isFinite(diff)) {
    return { late: false, text: "No due date" };
  }

  if (diff < 0) {
    return { late: true, text: `${Math.abs(diff)} d overdue` };
  }

  if (diff === 0) {
    return { late: false, text: "Due today" };
  }

  if (diff === 1) {
    return { late: false, text: "Due tomorrow" };
  }

  return { late: false, text: `Due in ${diff} d` };
}

function buildUpdate(
  action: GovernanceAction,
  status: BoardStatus,
  blockerReason: string,
): Record<string, unknown> {
  return {
    version: action.version,
    meetingId: action.meetingId,
    decisionId: action.decisionId,
    title: action.title,
    description: action.description ?? "",
    ownerName: action.ownerName ?? "",
    priority: action.priority,
    dueDate: action.dueDate,
    status,
    blockerReason: status === "BLOCKED" ? blockerReason : "",
  };
}

export function ProjectActionBoardView() {
  const params = useParams();
  const rawId = params?.id;
  const projectId = Array.isArray(rawId) ? rawId[0] : rawId;
  const base = projectId ? `/projects/${projectId}` : "/projects";

  const [data, setData] = useState<GovernanceControl | null>(null);
  const [actions, setActions] = useState<GovernanceAction[]>([]);
  const [error, setError] = useState("");

  const [toast, setToast] = useState<{
    text: string;
    tone: "error" | "ok";
  } | null>(null);

  const [saving, setSaving] = useState<Set<string>>(new Set());

  const [query, setQuery] = useState("");
  const [owner, setOwner] = useState("ALL");
  const [priority, setPriority] = useState<PriorityFilter>("ALL");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showAllDone, setShowAllDone] = useState(false);

  const [dragId, setDragId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<BoardStatus | null>(null);

  const [blockTarget, setBlockTarget] = useState<GovernanceAction | null>(
    null,
  );
  const [blockReason, setBlockReason] = useState("");

  const today = useMemo(startOfToday, []);

  const load = useCallback(async () => {
    if (!projectId) {
      return;
    }

    try {
      const response = await getProjectGovernance(projectId);

      setData(response);
      setActions(response.actions);
      setError("");
    } catch {
      setError("Could not load actions. Check that the backend is running.");
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 4500);

    return () => window.clearTimeout(timer);
  }, [toast]);

  const move = useCallback(
    async (action: GovernanceAction, status: BoardStatus, reason = "") => {
      if (!projectId || action.status === status) {
        return;
      }

      setSaving((current) => new Set(current).add(action.id));

      setActions((list) =>
        list.map((item) =>
          item.id === action.id
            ? {
                ...item,
                status,
                blockerReason: status === "BLOCKED" ? reason : null,
              }
            : item,
        ),
      );

      try {
        const saved = await updateGovernanceAction(
          projectId,
          action.id,
          buildUpdate(action, status, reason),
        );

        setActions((list) =>
          list.map((item) => (item.id === saved.id ? saved : item)),
        );

        setToast({
          tone: "ok",
          text: `${saved.actionNumber} moved to ${
            STATUS_LABEL[status]
          }.`,
        });
      } catch (failure) {
        setActions((list) =>
          list.map((item) => (item.id === action.id ? action : item)),
        );

        setToast({
          tone: "error",
          text:
            failure instanceof BuildSightApiError
              ? failure.message
              : "Could not update the action.",
        });

        if (
          failure instanceof BuildSightApiError &&
          failure.status === 409
        ) {
          void load();
        }
      } finally {
        setSaving((current) => {
          const next = new Set(current);

          next.delete(action.id);

          return next;
        });
      }
    },
    [projectId, load],
  );

  function requestMove(action: GovernanceAction, status: BoardStatus) {
    if (action.status === status || saving.has(action.id)) {
      return;
    }

    if (status === "BLOCKED") {
      setBlockTarget(action);
      setBlockReason(action.blockerReason ?? "");

      return;
    }

    void move(action, status);
  }

  function cancelBlock() {
    setBlockTarget(null);
    setBlockReason("");
  }

  function submitBlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const reason = blockReason.trim();

    if (!blockTarget || !reason) {
      return;
    }

    const target = blockTarget;

    cancelBlock();
    void move(target, "BLOCKED", reason);
  }

  function onDrop(event: ReactDragEvent<HTMLElement>, status: BoardStatus) {
    event.preventDefault();

    const id = event.dataTransfer.getData("text/plain") || dragId;

    setOverColumn(null);
    setDragId(null);

    const action = actions.find((item) => item.id === id);

    if (action) {
      requestMove(action, status);
    }
  }

  const owners = useMemo(() => {
    const names = new Set<string>();
    let unassigned = false;

    for (const action of actions) {
      if (action.status === "VOID") {
        continue;
      }

      if (action.ownerName && action.ownerName.trim()) {
        names.add(action.ownerName.trim());
      } else {
        unassigned = true;
      }
    }

    return {
      names: Array.from(names).sort((a, b) => a.localeCompare(b)),
      unassigned,
    };
  }, [actions]);

  const meetingLabel = useMemo(
    () =>
      new Map(
        (data?.meetings ?? []).map(
          (meeting) => [meeting.id, meeting.meetingNumber] as const,
        ),
      ),
    [data],
  );

  const decisionLabel = useMemo(
    () =>
      new Map(
        (data?.decisions ?? []).map(
          (decision) => [decision.id, decision.decisionNumber] as const,
        ),
      ),
    [data],
  );

  const counts = useMemo(() => {
    const result = {
      OPEN: 0,
      IN_PROGRESS: 0,
      BLOCKED: 0,
      DONE: 0,
      overdue: 0,
    };

    for (const action of actions) {
      if (action.status === "VOID") {
        continue;
      }

      result[action.status] += 1;

      if (action.overdue && action.status !== "DONE") {
        result.overdue += 1;
      }
    }

    return result;
  }, [actions]);

  const columns = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const groups: Record<BoardStatus, GovernanceAction[]> = {
      OPEN: [],
      IN_PROGRESS: [],
      BLOCKED: [],
      DONE: [],
    };

    for (const action of actions) {
      if (action.status === "VOID") {
        continue;
      }

      if (priority !== "ALL" && action.priority !== priority) {
        continue;
      }

      if (overdueOnly && !(action.overdue && action.status !== "DONE")) {
        continue;
      }

      if (owner !== "ALL") {
        const name = (action.ownerName ?? "").trim();

        if (owner === "__none" ? name !== "" : name !== owner) {
          continue;
        }
      }

      if (
        needle &&
        !`${action.actionNumber} ${action.title} ${action.ownerName ?? ""}`
          .toLowerCase()
          .includes(needle)
      ) {
        continue;
      }

      groups[action.status].push(action);
    }

    for (const status of ["OPEN", "IN_PROGRESS", "BLOCKED"] as const) {
      groups[status].sort(
        (a, b) =>
          Number(b.overdue) - Number(a.overdue) ||
          PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
          a.dueDate.localeCompare(b.dueDate),
      );
    }

    groups.DONE.sort((a, b) =>
      (b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
    );

    return groups;
  }, [actions, query, owner, priority, overdueOnly]);

  const total = counts.OPEN + counts.IN_PROGRESS + counts.BLOCKED + counts.DONE;
  const completion = total > 0 ? Math.round((counts.DONE / total) * 100) : 0;
  const intel = data?.intelligence;

  return (
    <div className="app-shell">
      <BuildSightSidebar />

      <main className="main">
        <header className={styles.header}>
          <div>
            <Link className={styles.back} href={base}>
              ← Project command center
            </Link>

            <div className="eyebrow">ACTION BOARD</div>

            <h1>{data ? data.project.name : "Project actions"}</h1>

            <p className={styles.subtitle}>
              Track governance actions across their lifecycle. Drag a card to
              change its status, or use the dropdown on each card. Create and
              edit actions in governance control.
            </p>
          </div>

          <Link className="secondary-link-button" href={`${base}/governance`}>
            Open governance
          </Link>
        </header>

        {toast && (
          <div
            aria-live="polite"
            className={`${styles.toast} ${
              toast.tone === "error" ? styles.toastError : styles.toastOk
            }`}
            role="status"
          >
            {toast.text}
          </div>
        )}

        {error && (
          <div className="offline-banner">
            <div>
              <strong>{error}</strong>
            </div>
          </div>
        )}

        {!data && !error && (
          <div className={styles.loading}>Loading actions…</div>
        )}

        {data && (
          <>
            <section aria-label="Action summary" className={styles.kpis}>
              {intel && (
                <article className={`${styles.kpi} ${styles.kpiDark}`}>
                  <div className={styles.kpiLabel}>GOVERNANCE SCORE</div>
                  <div className={styles.kpiValue}>
                    {Math.round(intel.governanceScore)}
                  </div>
                  <div className={styles.kpiSub}>
                    <span
                      className={`${styles.pill} ${
                        RISK_CLASS[intel.governanceRisk]
                      }`}
                    >
                      {RISK_LABEL[intel.governanceRisk]}
                    </span>
                  </div>
                </article>
              )}

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OPEN</div>
                <div className={styles.kpiValue}>{counts.OPEN}</div>
                <div className={styles.kpiSub}>Waiting to start</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>IN PROGRESS</div>
                <div className={styles.kpiValue}>{counts.IN_PROGRESS}</div>
                <div className={styles.kpiSub}>Being worked on</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>BLOCKED</div>
                <div
                  className={`${styles.kpiValue} ${
                    counts.BLOCKED > 0 ? styles.bad : ""
                  }`}
                >
                  {counts.BLOCKED}
                </div>
                <div className={styles.kpiSub}>Need unblocking</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>OVERDUE</div>
                <div
                  className={`${styles.kpiValue} ${
                    counts.overdue > 0 ? styles.bad : ""
                  }`}
                >
                  {counts.overdue}
                </div>
                <div className={styles.kpiSub}>Past their due date</div>
              </article>

              <article className={styles.kpi}>
                <div className={styles.kpiLabel}>COMPLETION</div>
                <div className={`${styles.kpiValue} ${styles.good}`}>
                  {completion}%
                </div>
                <div className={styles.kpiSub}>
                  {counts.DONE} of {total} done
                </div>
              </article>
            </section>

            {total === 0 ? (
              <div className={styles.empty}>
                No actions yet. Create actions in{" "}
                <Link href={`${base}/governance`}>governance control</Link>{" "}
                and they will appear here.
              </div>
            ) : (
              <>
                <div className={styles.toolbar}>
                  <input
                    aria-label="Search actions"
                    className={styles.search}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by number, title or owner…"
                    type="search"
                    value={query}
                  />

                  <select
                    aria-label="Filter by owner"
                    className={styles.select}
                    onChange={(event) => setOwner(event.target.value)}
                    value={owner}
                  >
                    <option value="ALL">All owners</option>

                    {owners.names.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}

                    {owners.unassigned && (
                      <option value="__none">Unassigned</option>
                    )}
                  </select>

                  <select
                    aria-label="Filter by priority"
                    className={styles.select}
                    onChange={(event) =>
                      setPriority(event.target.value as PriorityFilter)
                    }
                    value={priority}
                  >
                    <option value="ALL">All priorities</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>

                  <label className={styles.check}>
                    <input
                      checked={overdueOnly}
                      onChange={(event) => setOverdueOnly(event.target.checked)}
                      type="checkbox"
                    />
                    Overdue only
                  </label>
                </div>

                <div className={styles.board}>
                  {COLUMNS.map((column) => {
                    const all = columns[column.status];

                    const shown =
                      column.status === "DONE" && !showAllDone
                        ? all.slice(0, DONE_LIMIT)
                        : all;

                    return (
                      <section
                        aria-label={`${column.label} actions`}
                        className={`${styles.column} ${
                          COLUMN_TONE[column.status]
                        } ${
                          overColumn === column.status
                            ? styles.columnOver
                            : ""
                        }`}
                        key={column.status}
                        onDragLeave={(event) => {
                          if (
                            !event.currentTarget.contains(
                              event.relatedTarget as Node | null,
                            )
                          ) {
                            setOverColumn(null);
                          }
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setOverColumn(column.status);
                        }}
                        onDrop={(event) => onDrop(event, column.status)}
                      >
                        <header className={styles.colHead}>
                          <span className={styles.colDot} />

                          <div>
                            <strong>{column.label}</strong>
                            <small>{column.hint}</small>
                          </div>

                          <span className={styles.colCount}>{all.length}</span>
                        </header>

                        <div className={styles.cards}>
                          {shown.map((action) => {
                            const due = dueText(action, today);
                            const busy = saving.has(action.id);
                            const meeting = action.meetingId
                              ? meetingLabel.get(action.meetingId)
                              : undefined;
                            const decision = action.decisionId
                              ? decisionLabel.get(action.decisionId)
                              : undefined;

                            return (
                              <article
                                className={`${styles.card} ${
                                  due.late ? styles.cardLate : ""
                                } ${
                                  dragId === action.id
                                    ? styles.cardDragging
                                    : ""
                                } ${busy ? styles.cardBusy : ""}`}
                                draggable={!busy}
                                key={action.id}
                                onDragEnd={() => {
                                  setDragId(null);
                                  setOverColumn(null);
                                }}
                                onDragStart={(event) => {
                                  event.dataTransfer.setData(
                                    "text/plain",
                                    action.id,
                                  );
                                  event.dataTransfer.effectAllowed = "move";
                                  setDragId(action.id);
                                }}
                              >
                                <div className={styles.cardTop}>
                                  <span className={styles.number}>
                                    {action.actionNumber}
                                  </span>

                                  <span
                                    className={`${styles.pill} ${
                                      PRIORITY_CLASS[action.priority]
                                    }`}
                                  >
                                    {action.priority}
                                  </span>
                                </div>

                                <h3 className={styles.cardTitle}>
                                  {action.title}
                                </h3>

                                {action.status === "BLOCKED" &&
                                  action.blockerReason && (
                                    <p className={styles.blocker}>
                                      <b>Blocked:</b> {action.blockerReason}
                                    </p>
                                  )}

                                {(decision || meeting) && (
                                  <div className={styles.refs}>
                                    {decision && <span>{decision}</span>}
                                    {meeting && <span>{meeting}</span>}
                                  </div>
                                )}

                                <div className={styles.meta}>
                                  <span
                                    className={styles.owner}
                                    title={action.ownerName ?? "Unassigned"}
                                  >
                                    <i>{initials(action.ownerName)}</i>
                                    {action.ownerName || "Unassigned"}
                                  </span>

                                  <span
                                    className={
                                      due.late ? styles.dueLate : styles.due
                                    }
                                    title={`Due ${formatLong(action.dueDate)}`}
                                  >
                                    {due.text}
                                  </span>
                                </div>

                                <label className={styles.move}>
                                  <span className={styles.srOnly}>
                                    Move {action.actionNumber} to
                                  </span>

                                  <select
                                    disabled={busy}
                                    onChange={(event) =>
                                      requestMove(
                                        action,
                                        event.target.value as BoardStatus,
                                      )
                                    }
                                    value={action.status}
                                  >
                                    {COLUMNS.map((option) => (
                                      <option
                                        key={option.status}
                                        value={option.status}
                                      >
                                        {busy
                                          ? "Saving…"
                                          : `Move to: ${option.label}`}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              </article>
                            );
                          })}

                          {all.length === 0 && (
                            <div className={styles.colEmpty}>
                              {total > 0 && counts[column.status] > 0
                                ? "No matches"
                                : "Drop actions here"}
                            </div>
                          )}

                          {column.status === "DONE" &&
                            all.length > DONE_LIMIT && (
                              <button
                                className={styles.more}
                                onClick={() => setShowAllDone((value) => !value)}
                                type="button"
                              >
                                {showAllDone
                                  ? "Show fewer"
                                  : `Show all ${all.length}`}
                              </button>
                            )}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {blockTarget && (
          <div
            className={styles.overlay}
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                cancelBlock();
              }
            }}
            role="presentation"
          >
            <form
              aria-labelledby="bs-block-title"
              aria-modal="true"
              className={styles.modal}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  cancelBlock();
                }
              }}
              onSubmit={submitBlock}
              role="dialog"
            >
              <h2 id="bs-block-title">Mark as blocked</h2>

              <p className={styles.modalSub}>
                {blockTarget.actionNumber} · {blockTarget.title}
              </p>

              <label className={styles.modalField}>
                <span>What is blocking this action?</span>

                <textarea
                  autoFocus
                  maxLength={500}
                  onChange={(event) => setBlockReason(event.target.value)}
                  required
                  rows={4}
                  value={blockReason}
                />
              </label>

              <div className={styles.modalActions}>
                <button
                  className="secondary-button"
                  onClick={cancelBlock}
                  type="button"
                >
                  Cancel
                </button>

                <button
                  className="primary-button"
                  disabled={!blockReason.trim()}
                  type="submit"
                >
                  Mark as blocked
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
