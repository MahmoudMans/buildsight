"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  warmProjectWorkspaceData,
} from "./ProjectWorkspaceDataPrefetch";

import styles from "./FinancialControlTabs.module.css";

interface FinancialControlTabsProps {
  projectId: string;
}

const capabilities = [
  {
    key: "costs",
    index: "01",
    label: "Cost control",
    eyebrow: "INTERNAL COST",
    description:
      "Cost position, budget plan, commitments, actual expenditure and forecast exposure.",
  },
  {
    key: "commercial",
    index: "02",
    label: "Commercial",
    eyebrow: "CLIENT COMMERCIAL",
    description:
      "Contract changes, claims, certificates, receivables and cash-flow control.",
  },
] as const;

export function FinancialControlTabs({
  projectId,
}: FinancialControlTabsProps) {
  const pathname =
    usePathname();

  const active =
    pathname.endsWith(
      "/commercial",
    )
      ? "commercial"
      : "costs";

  return (
    <section
      aria-label="Financial Control"
      className={styles.workspace}
    >
      <div className={styles.context}>
        <div>
          <span className={styles.eyebrow}>
            FINANCIAL CONTROL
          </span>

          <strong>
            Cost & commercial management
          </strong>

          <p>
            One financial workspace with separate
            ownership for internal project cost and
            client-side commercial control.
          </p>
        </div>

        <div className={styles.badge}>
          2 CAPABILITIES
        </div>
      </div>

      <nav
        aria-label="Financial Control capabilities"
        className={styles.tabs}
      >
        {capabilities.map(
          (capability) => {
            const selected =
              active ===
              capability.key;

            return (
              <Link
                aria-current={
                  selected
                    ? "page"
                    : undefined
                }
                className={[
                  styles.tab,
                  selected
                    ? styles.active
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                href={`/projects/${projectId}/${capability.key}`}
                prefetch={true}
                onFocus={() => {
                  void warmProjectWorkspaceData(
                    projectId,
                    capability.key,
                  );
                }}
                onMouseEnter={() => {
                  void warmProjectWorkspaceData(
                    projectId,
                    capability.key,
                  );
                }}
                onPointerDown={() => {
                  void warmProjectWorkspaceData(
                    projectId,
                    capability.key,
                  );
                }}
                onTouchStart={() => {
                  void warmProjectWorkspaceData(
                    projectId,
                    capability.key,
                  );
                }}
                key={capability.key}
              >
                <span
                  aria-hidden="true"
                  className={styles.activeRail}
                />

                <span className={styles.index}>
                  {capability.index}
                </span>

                <span className={styles.copy}>
                  <small>
                    {capability.eyebrow}
                  </small>

                  <strong>
                    {capability.label}
                  </strong>

                  <p>
                    {capability.description}
                  </p>
                </span>

                <span
                  aria-hidden="true"
                  className={styles.arrow}
                >
                  ↗
                </span>
              </Link>
            );
          },
        )}
      </nav>
    </section>
  );
}
