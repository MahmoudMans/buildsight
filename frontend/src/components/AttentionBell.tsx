"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { getPortfolioExecutive } from "@/lib/api";
import type { PortfolioException } from "@/types/project";

import styles from "./AttentionBell.module.css";

const STORAGE_KEY = "buildsight.seenAlerts";
const REFRESH_MS = 5 * 60 * 1000;

function readSeen(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [],
    );
  } catch {
    return new Set();
  }
}

function writeSeen(values: Set<string>) {
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(Array.from(values).slice(-300)),
    );
  } catch {
    /* storage unavailable: seen state simply won't persist */
  }
}

function hrefFor(item: PortfolioException): string {
  return item.route?.startsWith("/")
    ? item.route
    : `/projects/${item.projectId}`;
}

export function AttentionBell() {
  const rootRef = useRef<HTMLDivElement>(null);

  const [items, setItems] = useState<PortfolioException[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSeen(readSeen());
  }, []);

  useEffect(() => {
    let cancelled = false;

    function refresh() {
      getPortfolioExecutive()
        .then((response) => {
          if (!cancelled) {
            setItems(response.exceptions);
            setFailed(false);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setFailed(true);
          }
        });
    }

    refresh();

    const timer = window.setInterval(refresh, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointer(event: MouseEvent) {
      if (
        rootRef.current &&
        event.target instanceof Node &&
        !rootRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const alerts = useMemo(
    () =>
      (items ?? [])
        .filter(
          (item) => item.severity === "CRITICAL" || item.severity === "HIGH",
        )
        .sort((a, b) => b.priorityScore - a.priorityScore),
    [items],
  );

  const unseen = alerts.filter((item) => !seen.has(item.id)).length;

  function markSeen(ids: string[]) {
    const next = new Set(seen);

    ids.forEach((id) => next.add(id));

    setSeen(next);
    writeSeen(next);
  }

  if (failed || items === null) {
    return null;
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Alerts: ${unseen} unseen`}
        className={styles.bell}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <svg
          aria-hidden="true"
          fill="none"
          height="20"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
          viewBox="0 0 24 24"
          width="20"
        >
          <path d="M12 3a6 6 0 0 0-6 6v3.2c0 .5-.2 1-.5 1.4L4 15.5V17h16v-1.5l-1.5-1.9a2.3 2.3 0 0 1-.5-1.4V9a6 6 0 0 0-6-6z" />
          <path d="M10 20a2 2 0 0 0 4 0" />
        </svg>

        {unseen > 0 && (
          <span className={styles.badge}>{unseen > 99 ? "99+" : unseen}</span>
        )}
      </button>

      {open && (
        <div
          aria-label="Portfolio alerts"
          className={styles.panel}
          role="dialog"
        >
          <header className={styles.head}>
            <div>
              <strong>Alerts</strong>
              <span>Critical and high-severity exceptions</span>
            </div>

            <button
              className={styles.link}
              disabled={unseen === 0}
              onClick={() => markSeen(alerts.map((item) => item.id))}
              type="button"
            >
              Mark all as seen
            </button>
          </header>

          {alerts.length === 0 ? (
            <div className={styles.empty}>
              Nothing needs urgent attention right now.
            </div>
          ) : (
            <ul className={styles.list}>
              {alerts.slice(0, 10).map((item) => (
                <li key={item.id}>
                  <Link
                    className={`${styles.item} ${
                      seen.has(item.id) ? styles.seen : ""
                    }`}
                    href={hrefFor(item)}
                    onClick={() => {
                      markSeen([item.id]);
                      setOpen(false);
                    }}
                  >
                    <span
                      className={`${styles.pill} ${
                        item.severity === "CRITICAL"
                          ? styles.critical
                          : styles.high
                      }`}
                    >
                      {item.severity}
                    </span>

                    <div className={styles.body}>
                      <strong>{item.title}</strong>
                      <small>
                        {item.projectCode} · {item.detail}
                      </small>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <footer className={styles.foot}>
            <span>
              {alerts.length} alert{alerts.length === 1 ? "" : "s"}
            </span>

            <Link
              href="/portfolio/report"
              onClick={() => setOpen(false)}
            >
              Executive report ↗
            </Link>
          </footer>
        </div>
      )}
    </div>
  );
}
