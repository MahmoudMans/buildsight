import Link from "next/link";

import styles from "./ProjectFeatureHub.module.css";

interface ProjectFeatureHubProps {
  projectId: string;
}

interface Feature {
  index: string;
  title: string;
  description: string;
  segment: string;
}

interface FeatureGroup {
  label: string;
  description: string;
  features: Feature[];
}

const groups: FeatureGroup[] = [
  {
    label: "FINANCIAL & SUPPLY",
    description:
      "Financial position, commercial exposure and supply-chain control.",
    features: [
      {
        index: "01",
        title: "Financial control",
        description:
          "Cost planning, commitments, actual expenditure, contract changes, claims, certificates and cash flow.",
        segment: "costs",
      },
      {
        index: "02",
        title: "Procurement",
        description:
          "Procurement packages, bids, awards and supplier performance.",
        segment: "procurement",
      },
    ],
  },
  {
    label: "DELIVERY",
    description:
      "Execution, resources and programme control.",
    features: [
      {
        index: "03",
        title: "Work packages",
        description:
          "Executable scope, site reports and daily production evidence.",
        segment: "production",
      },
      {
        index: "04",
        title: "Resources",
        description:
          "Workforce, deployment, equipment and forward capacity.",
        segment: "resources",
      },
      {
        index: "05",
        title: "Schedule",
        description:
          "Activities, logic, constraints, lookahead and schedule baselines.",
        segment: "schedule",
      },
    ],
  },
  {
    label: "ASSURANCE",
    description:
      "Risk, information, quality and HSE controls.",
    features: [
      {
        index: "06",
        title: "Risk control",
        description:
          "Risks, issues, change-control events and project delays.",
        segment: "risk-control",
      },
      {
        index: "07",
        title: "Documents",
        description:
          "Controlled records, revisions, RFIs and transmittals.",
        segment: "documents",
      },
      {
        index: "08",
        title: "Quality",
        description:
          "Inspections, NCRs, punch items and handover readiness.",
        segment: "quality",
      },
      {
        index: "09",
        title: "Safety / HSE",
        description:
          "Incidents, observations, actions and permits to work.",
        segment: "safety",
      },
    ],
  },
  {
    label: "INTELLIGENCE & DECISIONS",
    description:
      "Forward-looking management and evidence-grounded decisions.",
    features: [
      {
        index: "10",
        title: "Forecast",
        description:
          "EVM, CPI/SPI, cost-to-complete and management scenarios.",
        segment: "forecast",
      },
      {
        index: "11",
        title: "Governance",
        description:
          "Meetings, decisions, management actions and reporting.",
        segment: "governance",
      },
      {
        index: "12",
        title: "Recovery",
        description:
          "Change-impact simulations and recovery-option comparison.",
        segment: "recovery",
      },
      {
        index: "13",
        title: "Project Copilot",
        description:
          "Cited cross-domain questions using local project evidence.",
        segment: "copilot",
      },
    ],
  },
];

export function ProjectFeatureHub({
  projectId,
}: ProjectFeatureHubProps) {
  return (
    <section
      aria-labelledby="project-workspaces-title"
      className={styles.section}
      id="workspaces"
    >
      <div className={styles.heading}>
        <div>
          <div className={styles.eyebrow}>
            PROJECT WORKSPACES
          </div>

          <h2 id="project-workspaces-title">
            One project. Specialized controls.
          </h2>

          <p>
            Each workspace owns a different construction-control
            responsibility. Cross-domain information is shown as
            context or intelligence, not as a duplicate operational
            ledger.
          </p>
        </div>

        <div className={styles.count}>
          13 MAJOR WORKSPACES
        </div>
      </div>

      <div className={styles.groups}>
        {groups.map((group) => (
          <article
            className={styles.group}
            key={group.label}
          >
            <div className={styles.groupHeading}>
              <span>{group.label}</span>
              <p>{group.description}</p>
            </div>

            <div className={styles.features}>
              {group.features.map((feature) => (
                <Link
                  className={styles.feature}
                  href={`/projects/${projectId}/${feature.segment}`}
                  key={feature.segment}
                >
                  <span className={styles.index}>
                    {feature.index}
                  </span>

                  <div>
                    <strong>
                      {feature.title}
                    </strong>

                    <p>
                      {feature.description}
                    </p>
                  </div>

                  <span
                    aria-hidden="true"
                    className={styles.arrow}
                  >
                    ↗
                  </span>
                </Link>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
