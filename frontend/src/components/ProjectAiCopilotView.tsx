"use client";

import Link from "next/link";
import { ProjectWorkspaceSidebar } from "./ProjectWorkspaceSidebar";

import {
  type FormEvent,
  useEffect,
  useState,
} from "react";

import {
  BuildSightApiError,
  askProjectAi,
  getProjectAiAttentionBrief,
  getProjectAiHistory,
  getProjectAiStatus,
  rebuildProjectAiIndex,
} from "@/lib/api";

import type {
  AiAnswer,
  AiHistoryItem,
  AiStatus,
} from "@/types/project";

function formatDateTime(
  value: string | null,
): string {
  if (!value) {
    return "Never";
  }

  return new Intl.DateTimeFormat(
    "en-GB",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  ).format(
    new Date(
      value,
    ),
  );
}

export function ProjectAiCopilotView({
  projectId,
}: {
  projectId: string;
}) {
  const [status, setStatus] =
    useState<AiStatus | null>(
      null,
    );

  const [history, setHistory] =
    useState<AiHistoryItem[]>(
      [],
    );

  const [answer, setAnswer] =
    useState<AiAnswer | null>(
      null,
    );

  const [question, setQuestion] =
    useState(
      "",
    );

  const [loading, setLoading] =
    useState(
      true,
    );

  const [busy, setBusy] =
    useState(
      false,
    );

  const [error, setError] =
    useState(
      "",
    );

  useEffect(
    () => {
      let cancelled =
        false;

      Promise.all([
        getProjectAiStatus(
          projectId,
        ),
        getProjectAiHistory(
          projectId,
        ),
      ])
        .then(
          ([
            statusResponse,
            historyResponse,
          ]) => {
            if (
              cancelled
            ) {
              return;
            }

            setStatus(
              statusResponse,
            );

            setHistory(
              historyResponse,
            );

            setError(
              "",
            );
          },
        )
        .catch(
          (
            caught: unknown,
          ) => {
            if (
              cancelled
            ) {
              return;
            }

            if (
              caught instanceof
              BuildSightApiError
            ) {
              setError(
                caught.message,
              );
            } else {
              setError(
                "BuildSight could not load the local AI workspace.",
              );
            }
          },
        )
        .finally(
          () => {
            if (
              !cancelled
            ) {
              setLoading(
                false,
              );
            }
          },
        );

      return () => {
        cancelled =
          true;
      };
    },
    [
      projectId,
    ],
  );

  async function refresh() {
    const [
      refreshedStatus,
      refreshedHistory,
    ] =
      await Promise.all([
        getProjectAiStatus(
          projectId,
        ),
        getProjectAiHistory(
          projectId,
        ),
      ]);

    setStatus(
      refreshedStatus,
    );

    setHistory(
      refreshedHistory,
    );
  }

  async function rebuildIndex() {
    setBusy(
      true,
    );

    setError(
      "",
    );

    try {
      await rebuildProjectAiIndex(
        projectId,
      );

      await refresh();

    } catch (
      caught
    ) {
      if (
        caught instanceof
        BuildSightApiError
      ) {
        setError(
          caught.message,
        );
      } else {
        setError(
          "The local AI index could not be rebuilt.",
        );
      }

    } finally {
      setBusy(
        false,
      );
    }
  }

  async function submitQuestion(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !question.trim()
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError(
      "",
    );

    try {
      const response =
        await askProjectAi(
          projectId,
          question,
        );

      setAnswer(
        response,
      );

      setQuestion(
        "",
      );

      await refresh();

    } catch (
      caught
    ) {
      if (
        caught instanceof
        BuildSightApiError
      ) {
        setError(
          caught.message,
        );
      } else {
        setError(
          "The local copilot request failed.",
        );
      }

    } finally {
      setBusy(
        false,
      );
    }
  }

  async function attentionBrief() {
    setBusy(
      true,
    );

    setError(
      "",
    );

    try {
      const response =
        await getProjectAiAttentionBrief(
          projectId,
        );

      setAnswer(
        response,
      );

      await refresh();

    } catch (
      caught
    ) {
      if (
        caught instanceof
        BuildSightApiError
      ) {
        setError(
          caught.message,
        );
      } else {
        setError(
          "The project attention brief could not be generated.",
        );
      }

    } finally {
      setBusy(
        false,
      );
    }
  }

  if (
    loading
  ) {
    return (
      <main className="command-loading">
        <div className="loading-mark">
          B
        </div>

        <strong>
          Loading local AI copilot...
        </strong>
      </main>
    );
  }

  return (
    <div className="copilot-shell">
      <ProjectWorkspaceSidebar
        projectId={projectId}
        className="copilot-sidebar"
      />

      <main className="copilot-main">
        <header className="copilot-topbar">
          <div>
            <Link
              href={`/projects/${projectId}`}
              className="back-link"
            >
              ← Project command center
            </Link>

            <div className="eyebrow">
              BUILDSIGHT LOCAL INTELLIGENCE
            </div>

            <h1>
              Project Copilot
            </h1>

            <p>
              Evidence-grounded project Q&A
              using local embeddings, local
              semantic retrieval and a local
              language model.
            </p>
          </div>

          <div
            className={
              status?.ready
                ? "copilot-ready-badge ready"
                : "copilot-ready-badge"
            }
          >
            <span />

            {status?.ready
              ? "LOCAL AI READY"
              : "SETUP REQUIRED"}
          </div>
        </header>

        {error && (
          <div className="command-alert">
            <strong>
              Local AI operation not completed
            </strong>

            <span>
              {error}
            </span>
          </div>
        )}

        <section className="copilot-status-grid">
          <StatusCard
            label="OLLAMA"
            value={
              status?.ollamaReachable
                ? "Online"
                : "Offline"
            }
            detail="localhost:11434"
            good={
              status?.ollamaReachable ??
              false
            }
          />

          <StatusCard
            label="CHAT MODEL"
            value={
              status?.chatModel ??
              "qwen3:4b"
            }
            detail={
              status?.chatModelAvailable
                ? "Installed"
                : "Not installed"
            }
            good={
              status?.chatModelAvailable ??
              false
            }
          />

          <StatusCard
            label="EMBEDDING MODEL"
            value={
              status?.embeddingModel ??
              "qwen3-embedding:0.6b"
            }
            detail={`${status?.embeddingDimensions ?? 1024} dimensions`}
            good={
              status?.embeddingModelAvailable ??
              false
            }
          />

          <StatusCard
            label="PROJECT INDEX"
            value={String(
              status?.indexedChunks ??
                0,
            )}
            detail={`Last indexed ${formatDateTime(
              status?.lastIndexedAt ??
                null,
            )}`}
            good={
              (status?.indexedChunks ??
                0) > 0
            }
          />
        </section>

        {!status?.chatModelAvailable ||
        !status?.embeddingModelAvailable ? (
          <section className="copilot-setup-card">
            <div>
              <div className="eyebrow">
                ONE-TIME LOCAL SETUP
              </div>

              <h2>
                Install the local models
              </h2>

              <p>
                Run the included helper from
                the BuildSight project root.
                Models stay on your machine
                after installation.
              </p>
            </div>

            <code>
              ./scripts/ai-models-pull.sh
            </code>
          </section>
        ) : null}

        <section className="copilot-index-card">
          <div>
            <div className="eyebrow">
              KNOWLEDGE INDEX
            </div>

            <h2>
              Project evidence
            </h2>

            <p>
              The index includes current
              document revisions, RFIs and
              structured BuildSight project
              intelligence.
            </p>
          </div>

          <button
            type="button"
            className="primary-button"
            disabled={
              busy
              ||
              !status?.embeddingModelAvailable
            }
            onClick={() =>
              void rebuildIndex()
            }
          >
            {busy
              ? "Working..."
              : status?.indexedChunks
                ? "Rebuild AI index"
                : "Build AI index"}
          </button>
        </section>

        <section className="copilot-chat-card">
          <div className="copilot-chat-heading">
            <div>
              <div className="eyebrow">
                CITED PROJECT Q&A
              </div>

              <h2>
                Ask BuildSight
              </h2>

              <p>
                Answers are constrained to
                retrieved project evidence.
              </p>
            </div>

            <button
              type="button"
              className="secondary-button"
              disabled={
                busy
                ||
                !status?.ready
              }
              onClick={() =>
                void attentionBrief()
              }
            >
              What needs attention?
            </button>
          </div>

          <form
            className="copilot-question-form"
            onSubmit={
              submitQuestion
            }
          >
            <textarea
              rows={4}
              placeholder="Example: Why is this project at risk, and which records support that conclusion?"
              value={
                question
              }
              onChange={(
                event,
              ) =>
                setQuestion(
                  event.target
                    .value,
                )
              }
            />

            <button
              type="submit"
              className="primary-button"
              disabled={
                busy
                ||
                !status?.ready
                ||
                !question.trim()
              }
            >
              {busy
                ? "Analyzing locally..."
                : "Ask local copilot"}
            </button>
          </form>

          {!status?.ready && (
            <div className="copilot-not-ready">
              {status?.message}
            </div>
          )}
        </section>

        {answer && (
          <section className="copilot-answer-card">
            <div className="copilot-answer-header">
              <div>
                <div className="eyebrow">
                  COPILOT RESPONSE
                </div>

                <h2>
                  Evidence-grounded answer
                </h2>
              </div>

              <span
                className={
                  answer.grounded
                    ? "grounding-badge grounded"
                    : "grounding-badge"
                }
              >
                {answer.grounded
                  ? "CITATION VERIFIED"
                  : "ANSWER DISCARDED"}
              </span>
            </div>

            <div className="copilot-answer-question">
              {answer.question}
            </div>

            <div className="copilot-answer-text">
              {answer.answer}
            </div>

            <div className="copilot-model-meta">
              <span>
                Chat: {answer.chatModel}
              </span>

              <span>
                Embeddings:{" "}
                {answer.embeddingModel}
              </span>
            </div>

            <div className="copilot-sources">
              <div className="copilot-sources-title">
                Retrieved BuildSight Evidence
              </div>

              {answer.sources.map(
                (
                  source,
                ) => (
                  <article
                    key={
                      source.citation
                    }
                  >
                    <div className="copilot-source-top">
                      <strong>
                        {
                          source.citation
                        }
                      </strong>

                      <span>
                        {
                          source.sourceType
                        }
                      </span>

                      <small>
                        Similarity{" "}
                        {source.similarity.toFixed(
                          3,
                        )}
                      </small>
                    </div>

                    <h3>
                      {
                        source.reference
                      }
                    </h3>

                    <h4>
                      {
                        source.title
                      }
                    </h4>

                    <p>
                      {
                        source.snippet
                      }
                    </p>
                  </article>
                ),
              )}
            </div>
          </section>
        )}

        <section className="copilot-history-card">
          <div className="copilot-history-heading">
            <div>
              <div className="eyebrow">
                LOCAL HISTORY
              </div>

              <h2>
                Recent questions
              </h2>
            </div>

            <span>
              {history.length} interactions
            </span>
          </div>

          <div className="copilot-history-list">
            {history.map(
              (
                item,
              ) => (
                <article
                  key={
                    item.id
                  }
                >
                  <div>
                    <strong>
                      {
                        item.question
                      }
                    </strong>

                    <span>
                      {formatDateTime(
                        item.createdAt,
                      )}
                    </span>
                  </div>

                  <p>
                    {
                      item.answer
                    }
                  </p>

                  <footer>
                    <span
                      className={
                        item.grounded
                          ? "grounded-history"
                          : ""
                      }
                    >
                      {item.grounded
                        ? "Grounded"
                        : "Not grounded"}
                    </span>

                    <span>
                      {item.sourceCount} sources
                    </span>
                  </footer>
                </article>
              ),
            )}

            {history.length ===
              0 && (
              <div className="table-message">
                No local AI questions yet.
              </div>
            )}
          </div>
        </section>

        <footer className="command-footer">
          <div>
            BuildSight · Local AI Project Copilot
          </div>

          <div>
            No cloud API
            {" · "}
            No API key
            {" · "}
            Local project evidence only
          </div>
        </footer>
      </main>
    </div>
  );
}

function StatusCard({
  label,
  value,
  detail,
  good,
}: {
  label: string;
  value: string;
  detail: string;
  good: boolean;
}) {
  return (
    <article className="copilot-status-card">
      <div
        className={
          good
            ? "copilot-status-dot good"
            : "copilot-status-dot"
        }
      />

      <span>
        {label}
      </span>

      <strong>
        {value}
      </strong>

      <small>
        {detail}
      </small>
    </article>
  );
}
