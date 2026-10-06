"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./BuildSightSidebar.module.css";

type SidebarKey =
  | "portfolio"
  | "projects"
  | "budgets"
  | "work-packages"
  | "procurement"
  | "risks"
  | "documents"
  | "intelligence";

interface SidebarItem {
  index: string;
  key: SidebarKey;
  label: string;
  href: string;
}

const items: SidebarItem[] = [
  {
    index: "01",
    key: "portfolio",
    label: "Portfolio",
    href: "/",
  },
  {
    index: "02",
    key: "projects",
    label: "Projects",
    href: "/projects",
  },
  {
    index: "03",
    key: "budgets",
    label: "Budgets",
    href: "/budgets",
  },
  {
    index: "04",
    key: "work-packages",
    label: "Work packages",
    href: "/work-packages",
  },
  {
    index: "05",
    key: "procurement",
    label: "Procurement",
    href: "/procurement",
  },
  {
    index: "06",
    key: "risks",
    label: "Risks",
    href: "/risks",
  },
  {
    index: "07",
    key: "documents",
    label: "Documents",
    href: "/documents",
  },
  {
    index: "08",
    key: "intelligence",
    label: "Intelligence",
    href: "/intelligence",
  },
];

function projectSubroute(
  pathname: string,
): string | null {
  const match = pathname.match(
    /^\/projects\/[^/]+\/([^/]+)/,
  );

  return match?.[1] ?? null;
}

function activeKey(
  pathname: string,
): SidebarKey {
  if (
    pathname === "/" ||
    pathname === "/portfolio" ||
    pathname === "/portfolio/report" ||
    pathname === "/portfolio/compare"
  ) {
    return "portfolio";
  }

  if (
    pathname.startsWith("/portfolio/forecast") ||
    pathname.startsWith("/portfolio/governance") ||
    pathname.startsWith("/portfolio/recovery") ||
    pathname.startsWith("/portfolio/period-control")
  ) {
    return "intelligence";
  }

  if (pathname === "/budgets") {
    return "budgets";
  }

  if (pathname === "/work-packages") {
    return "work-packages";
  }

  if (pathname === "/procurement") {
    return "procurement";
  }

  if (pathname === "/risks") {
    return "risks";
  }

  if (pathname === "/documents") {
    return "documents";
  }

  if (pathname === "/intelligence") {
    return "intelligence";
  }

  const section = projectSubroute(
    pathname,
  );

  switch (section) {
    case "costs":
    case "cost-breakdown":
    case "commercial":
    case "cashflow":
      return "budgets";

    case "production":
      return "work-packages";

    case "procurement":
    case "procurement-pipeline":
      return "procurement";

    case "risk-control":
    case "risk-matrix":
    case "recovery":
      return "risks";

    case "documents":
      return "documents";

    case "copilot":
    case "forecast":
    case "trends":
    case "governance":
    case "board":
    case "period-control":
      return "intelligence";

    default:
      return "projects";
  }
}

export function BuildSightSidebar() {
  const pathname = usePathname();
  const current = activeKey(pathname);

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          B
        </div>

        <div>
          <div className="brand-name">
            BuildSight
          </div>

          <div className="brand-subtitle">
            Construction Intelligence
          </div>
        </div>
      </div>

      <div className="workspace-label">
        WORKSPACE
      </div>

      <nav
        aria-label="BuildSight workspace"
        className="navigation"
      >
        {items.map((item) => {
          const active =
            current === item.key;

          return (
            <Link
              aria-current={
                active
                  ? "page"
                  : undefined
              }
              className={
                `${styles.link} nav-item ${
                  active ? "active" : ""
                }`
              }
              href={item.href}
              key={item.key}
            >
              <span className="nav-icon">
                {item.index}
              </span>

              <span
                className={styles.label}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="local-card">
          <div className="local-card-top">
            <span className="local-dot" />
            LOCAL ENVIRONMENT
          </div>

          <strong>
            Private by design
          </strong>

          <p>
            PostgreSQL, object storage and AI
            remain on your machine.
          </p>
        </div>

        <div className="version">
          BuildSight v0.1.0
        </div>
      </div>
    </aside>
  );
}
