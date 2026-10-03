"use client";

import {
  ProjectWorkspaceSidebar,
} from "./ProjectWorkspaceSidebar";

import styles from "./ProjectWorkspaceLoading.module.css";

interface ProjectWorkspaceLoadingProps {
  projectId: string;
  label: string;
  mainClassName?: string;
}

export function ProjectWorkspaceLoading({
  projectId,
  label,
  mainClassName = "",
}: ProjectWorkspaceLoadingProps) {
  return (
    <div className={styles.shell}>
      <ProjectWorkspaceSidebar
        projectId={projectId}
      />

      <main
        aria-busy="true"
        aria-live="polite"
        className={[
          mainClassName,
          styles.main,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={styles.srOnly}>
          {label}
        </span>

        <div
          aria-hidden="true"
          className={styles.content}
        >
          <header className={styles.header}>
            <div>
              <div
                className={`${styles.skeleton} ${styles.eyebrow}`}
              />

              <div
                className={`${styles.skeleton} ${styles.title}`}
              />

              <div
                className={`${styles.skeleton} ${styles.description}`}
              />
            </div>

            <div
              className={`${styles.skeleton} ${styles.status}`}
            />
          </header>

          <section className={styles.metrics}>
            <div className={styles.metric}>
              <div
                className={`${styles.skeleton} ${styles.metricLabel}`}
              />

              <div
                className={`${styles.skeleton} ${styles.metricValue}`}
              />

              <div
                className={`${styles.skeleton} ${styles.metricDetail}`}
              />
            </div>

            <div className={styles.metric}>
              <div
                className={`${styles.skeleton} ${styles.metricLabel}`}
              />

              <div
                className={`${styles.skeleton} ${styles.metricValue}`}
              />

              <div
                className={`${styles.skeleton} ${styles.metricDetail}`}
              />
            </div>

            <div className={styles.metric}>
              <div
                className={`${styles.skeleton} ${styles.metricLabel}`}
              />

              <div
                className={`${styles.skeleton} ${styles.metricValue}`}
              />

              <div
                className={`${styles.skeleton} ${styles.metricDetail}`}
              />
            </div>

            <div className={styles.metric}>
              <div
                className={`${styles.skeleton} ${styles.metricLabel}`}
              />

              <div
                className={`${styles.skeleton} ${styles.metricValue}`}
              />

              <div
                className={`${styles.skeleton} ${styles.metricDetail}`}
              />
            </div>
          </section>

          <section className={styles.workspace}>
            <div className={styles.workspaceHeader}>
              <div>
                <div
                  className={`${styles.skeleton} ${styles.sectionEyebrow}`}
                />

                <div
                  className={`${styles.skeleton} ${styles.sectionTitle}`}
                />
              </div>

              <div
                className={`${styles.skeleton} ${styles.action}`}
              />
            </div>

            <div className={styles.rows}>
              {Array.from({
                length: 5,
              }).map(
                (
                  _,
                  index,
                ) => (
                  <div
                    className={styles.row}
                    key={index}
                  >
                    <div
                      className={`${styles.skeleton} ${styles.rowPrimary}`}
                    />

                    <div
                      className={`${styles.skeleton} ${styles.rowValue}`}
                    />

                    <div
                      className={`${styles.skeleton} ${styles.rowValue}`}
                    />

                    <div
                      className={`${styles.skeleton} ${styles.rowStatus}`}
                    />
                  </div>
                ),
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
