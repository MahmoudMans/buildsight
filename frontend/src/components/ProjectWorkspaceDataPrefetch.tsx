"use client";

import {
  useEffect,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  getProjectCommandCenter,
  getProjectCommercial,
  getProjectCostControl,
  getProjectDocuments,
  getProjectForecast,
  getProjectGovernance,
  getProjectProcurement,
  getProjectProduction,
  getProjectQuality,
  getProjectRecovery,
  getProjectResources,
  getProjectRiskControl,
  getProjectSafety,
  getProjectSchedule,
  getScheduleLookahead,
} from "@/lib/api";

export type ProjectWorkspaceDataSegment =
  | "overview"
  | "costs"
  | "commercial"
  | "procurement"
  | "production"
  | "resources"
  | "schedule"
  | "risk-control"
  | "documents"
  | "quality"
  | "safety"
  | "forecast"
  | "governance"
  | "recovery"
  | "period-control"
  | "copilot";

type Loader = (
  projectId: string,
) => Promise<unknown>;

const loaders:
  Partial<
    Record<
      ProjectWorkspaceDataSegment,
      Loader
    >
  > = {
    overview: (
      projectId,
    ) =>
      getProjectCommandCenter(
        projectId,
      ),

    costs: (
      projectId,
    ) =>
      getProjectCostControl(
        projectId,
      ),

    commercial: (
      projectId,
    ) =>
      getProjectCommercial(
        projectId,
      ),

    procurement: (
      projectId,
    ) =>
      getProjectProcurement(
        projectId,
      ),

    production: (
      projectId,
    ) =>
      getProjectProduction(
        projectId,
      ),

    resources: (
      projectId,
    ) =>
      getProjectResources(
        projectId,
      ),

    schedule: (
      projectId,
    ) =>
      Promise.all([
        getProjectSchedule(
          projectId,
        ),
        getScheduleLookahead(
          projectId,
          4,
        ),
      ]),

    "risk-control": (
      projectId,
    ) =>
      getProjectRiskControl(
        projectId,
      ),

    documents: (
      projectId,
    ) =>
      getProjectDocuments(
        projectId,
      ),

    quality: (
      projectId,
    ) =>
      getProjectQuality(
        projectId,
      ),

    safety: (
      projectId,
    ) =>
      getProjectSafety(
        projectId,
      ),

    forecast: (
      projectId,
    ) =>
      getProjectForecast(
        projectId,
      ),

    governance: (
      projectId,
    ) =>
      getProjectGovernance(
        projectId,
      ),

    recovery: (
      projectId,
    ) =>
      getProjectRecovery(
        projectId,
      ),
  };

const backgroundOrder:
  ProjectWorkspaceDataSegment[] = [
    "costs",
    "commercial",
    "procurement",

    "production",
    "resources",
    "schedule",

    "risk-control",
    "documents",
    "quality",

    "safety",
    "forecast",
    "governance",

    "recovery",
    "overview",
  ];

export function warmProjectWorkspaceData(
  projectId: string,
  segment:
    ProjectWorkspaceDataSegment,
): Promise<void> {
  const loader =
    loaders[
      segment
    ];

  /*
   * Period Control is still Step 18 work and Copilot has
   * no single aggregate read endpoint. Their routes are
   * still prefetched, but data warming safely no-ops.
   */
  if (!loader) {
    return Promise.resolve();
  }

  return loader(
    projectId,
  )
    .then(
      () => undefined,
    )
    .catch(
      () => undefined,
    );
}

function projectRoute(
  projectId: string,
  segment:
    ProjectWorkspaceDataSegment,
): string {
  if (
    segment === "overview"
  ) {
    return `/projects/${projectId}`;
  }

  return `/projects/${projectId}/${segment}`;
}

interface ProjectWorkspaceDataWarmupProps {
  projectId: string;
}

export function ProjectWorkspaceDataWarmup({
  projectId,
}: ProjectWorkspaceDataWarmupProps) {
  const router =
    useRouter();

  useEffect(
    () => {
      let cancelled =
        false;

      let cursor =
        0;

      const worker =
        async () => {
          while (
            !cancelled
            && cursor
              < backgroundOrder.length
          ) {
            const index =
              cursor;

            cursor += 1;

            const segment =
              backgroundOrder[
                index
              ];

            router.prefetch(
              projectRoute(
                projectId,
                segment,
              ),
            );

            await warmProjectWorkspaceData(
              projectId,
              segment,
            );

            await new Promise<void>(
              (
                resolve,
              ) => {
                window.setTimeout(
                  resolve,
                  20,
                );
              },
            );
          }
        };

      /*
       * Two workers are deliberate:
       * enough concurrency to warm the project quickly,
       * but not enough to flood Spring Boot with all
       * aggregate workspaces at once.
       */
      const timeout =
        window.setTimeout(
          () => {
            void Promise.all([
              worker(),
              worker(),
            ]);
          },
          250,
        );

      return () => {
        cancelled = true;

        window.clearTimeout(
          timeout,
        );
      };
    },
    [
      projectId,
      router,
    ],
  );

  return null;
}
