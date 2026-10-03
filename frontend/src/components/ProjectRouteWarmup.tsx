"use client";

import {
  useEffect,
} from "react";

import {
  useRouter,
} from "next/navigation";

interface ProjectRouteWarmupProps {
  projectId: string;
}

const segments = [
  "",
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
  "period-control",
  "copilot",
] as const;

export function ProjectRouteWarmup({
  projectId,
}: ProjectRouteWarmupProps) {
  const router =
    useRouter();

  useEffect(
    () => {
      let cancelled =
        false;

      const routes =
        segments.map(
          (segment) =>
            segment
              ? `/projects/${projectId}/${segment}`
              : `/projects/${projectId}`,
        );

      let index = 0;

      const warmNext = () => {
        if (
          cancelled ||
          index >= routes.length
        ) {
          return;
        }

        /*
         * Warm only a few destinations per browser turn.
         *
         * Doing every route synchronously would compete with the
         * current workspace for CPU/network and could make initial
         * rendering slower — the opposite of what we want.
         */
        const end = Math.min(
          index + 3,
          routes.length,
        );

        while (index < end) {
          router.prefetch(
            routes[index],
          );

          index += 1;
        }

        if (
          index <
          routes.length
        ) {
          window.setTimeout(
            warmNext,
            120,
          );
        }
      };

      /*
       * Do not compete with the initial page load.
       * Let the current workspace become interactive first.
       */
      const timeout =
        window.setTimeout(
          warmNext,
          350,
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
