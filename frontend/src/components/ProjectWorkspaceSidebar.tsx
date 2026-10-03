"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "./ProjectWorkspaceSidebar.module.css";

export interface ProjectWorkspaceLocalLink {
  href: string;
  label: string;
}

interface ProjectWorkspaceSidebarProps {
  projectId: string;
  projectCode?: string;
  className?: string;
  localLinks?: readonly ProjectWorkspaceLocalLink[];
}

interface WorkspaceItem {
  index: string;
  key: string;
  label: string;
  segment: string | null;
}

interface WorkspaceGroup {
  label: string;
  items: WorkspaceItem[];
}

const overview: WorkspaceItem = {
  index: "00",
  key: "overview",
  label: "Overview",
  segment: null,
};

const groups: WorkspaceGroup[] = [
  {
    label: "FINANCIAL & SUPPLY",
    items: [
      {
        index: "01",
        key: "costs",
        label: "Cost control",
        segment: "costs",
      },
      {
        index: "02",
        key: "commercial",
        label: "Commercial",
        segment: "commercial",
      },
      {
        index: "03",
        key: "procurement",
        label: "Procurement",
        segment: "procurement",
      },
    ],
  },
  {
    label: "DELIVERY",
    items: [
      {
        index: "04",
        key: "production",
        label: "Work packages",
        segment: "production",
      },
      {
        index: "05",
        key: "resources",
        label: "Resources",
        segment: "resources",
      },
      {
        index: "06",
        key: "schedule",
        label: "Schedule",
        segment: "schedule",
      },
    ],
  },
  {
    label: "ASSURANCE",
    items: [
      {
        index: "07",
        key: "risk-control",
        label: "Risk control",
        segment: "risk-control",
      },
      {
        index: "08",
        key: "documents",
        label: "Documents",
        segment: "documents",
      },
      {
        index: "09",
        key: "quality",
        label: "Quality",
        segment: "quality",
      },
      {
        index: "10",
        key: "safety",
        label: "Safety / HSE",
        segment: "safety",
      },
    ],
  },
  {
    label: "INTELLIGENCE & DECISIONS",
    items: [
      {
        index: "11",
        key: "forecast",
        label: "Forecast",
        segment: "forecast",
      },
      {
        index: "12",
        key: "governance",
        label: "Governance",
        segment: "governance",
      },
      {
        index: "13",
        key: "recovery",
        label: "Recovery",
        segment: "recovery",
      },
      {
        index: "14",
        key: "period-control",
        label: "Period control",
        segment: "period-control",
      },
      {
        index: "15",
        key: "copilot",
        label: "Project Copilot",
        segment: "copilot",
      },
    ],
  },
];

function activeWorkspace(
  pathname: string,
): string {
  const match = pathname.match(
    /^\/projects\/[^/]+(?:\/([^/]+))?/,
  );

  return match?.[1] ?? "overview";
}

function projectHref(
  projectId: string,
  segment: string | null,
): string {
  return segment
    ? `/projects/${projectId}/${segment}`
    : `/projects/${projectId}`;
}

function WorkspaceLink({
  projectId,
  item,
  active,
}: {
  projectId: string;
  item: WorkspaceItem;
  active: string;
}) {
  const selected =
    item.key === active;

  return (
    <Link
      aria-current={
        selected
          ? "page"
          : undefined
      }
      className={[
        "command-nav-item",
        styles.workspaceLink,
        selected
          ? "active"
          : "",
        selected
          ? styles.active
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      href={projectHref(
        projectId,
        item.segment,
      )}
    >
      <span className={styles.index}>
        {item.index}
      </span>

      <span>
        {item.label}
      </span>
    </Link>
  );
}

export function ProjectWorkspaceSidebar({
  projectId,
  projectCode,
  className,
  localLinks = [],
}: ProjectWorkspaceSidebarProps) {
  const pathname = usePathname();

  const active =
    activeWorkspace(pathname);

  const activeItem =
    active === "overview"
      ? overview
      : groups
          .flatMap(
            (group) =>
              group.items,
          )
          .find(
            (item) =>
              item.key === active,
          );

  const sidebarClassName = [
    className ??
      "command-sidebar",
    styles.sidebar,
  ]
    .filter(Boolean)
    .join(" ");

  const displayProjectCode =
    projectCode?.trim() ||
    "Project workspace";

  return (
    <aside
      className={sidebarClassName}
    >
      <Link
        className={`command-brand ${styles.brand}`}
        href="/"
      >
        <div className="brand-mark">
          B
        </div>

        <div>
          <strong>
            BuildSight
          </strong>

          <span>
            Construction Intelligence
          </span>
        </div>
      </Link>

      <div className={styles.projectContext}>
        <span>
          CURRENT PROJECT
        </span>

        <strong>
          {displayProjectCode}
        </strong>

        <Link href="/projects">
          Change project
        </Link>
      </div>

      <nav
        aria-label="Project workspaces"
        className={`command-navigation ${styles.navigation}`}
      >
        <div className={styles.overview}>
          <WorkspaceLink
            active={active}
            item={overview}
            projectId={projectId}
          />
        </div>

        {groups.map((group) => (
          <div
            className={styles.group}
            key={group.label}
          >
            <div className={styles.groupLabel}>
              {group.label}
            </div>

            {group.items.map(
              (item) => (
                <WorkspaceLink
                  active={active}
                  item={item}
                  key={item.key}
                  projectId={projectId}
                />
              ),
            )}
          </div>
        ))}

        {localLinks.length > 0 && (
          <div className={styles.localGroup}>
            <div className={styles.groupLabel}>
              THIS WORKSPACE
            </div>

            {localLinks.map(
              (
                link,
                index,
              ) => (
                <a
                  className={styles.localLink}
                  href={link.href}
                  key={`${link.href}-${index}`}
                >
                  <span>
                    {String(
                      index + 1,
                    ).padStart(
                      2,
                      "0",
                    )}
                  </span>

                  <strong>
                    {link.label}
                  </strong>
                </a>
              ),
            )}
          </div>
        )}
      </nav>

      <div
        className={`command-sidebar-footer ${styles.footer}`}
      >
        <span>
          ACTIVE WORKSPACE
        </span>

        <strong>
          {activeItem?.label ??
            active.replaceAll(
              "-",
              " ",
            )}
        </strong>

        <small>
          {displayProjectCode}
          {" · "}
          specialized project control
        </small>
      </div>
    </aside>
  );
}
