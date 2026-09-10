package com.buildsight.platform.schedule.service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.UUID;

import com.buildsight.platform.schedule.domain.ProjectScheduleActivity;
import com.buildsight.platform.schedule.domain.ProjectScheduleDependency;
import com.buildsight.platform.schedule.domain.ScheduleDependencyType;

import org.springframework.stereotype.Component;

@Component
public class ScheduleNetworkCalculator {

    public ScheduleNetworkResult calculate(
            List<ProjectScheduleActivity> activities,
            List<ProjectScheduleDependency> dependencies,
            LocalDate dataDate) {

        if (activities.isEmpty()) {

            return new ScheduleNetworkResult(
                    true,
                    null,
                    0,
                    List.of(),
                    Map.of());
        }

        Map<UUID, ProjectScheduleActivity> activityById =
                new HashMap<>();

        Map<UUID, List<ProjectScheduleDependency>> incoming =
                new HashMap<>();

        Map<UUID, List<ProjectScheduleDependency>> outgoing =
                new HashMap<>();

        Map<UUID, Integer> indegree =
                new HashMap<>();

        for (ProjectScheduleActivity activity :
                activities) {

            activityById.put(
                    activity.getId(),
                    activity);

            incoming.put(
                    activity.getId(),
                    new ArrayList<>());

            outgoing.put(
                    activity.getId(),
                    new ArrayList<>());

            indegree.put(
                    activity.getId(),
                    0);
        }

        for (ProjectScheduleDependency dependency :
                dependencies) {

            if (!activityById.containsKey(
                    dependency.getPredecessorActivityId())
                    || !activityById.containsKey(
                            dependency.getSuccessorActivityId())) {

                continue;
            }

            incoming.get(
                    dependency.getSuccessorActivityId())
                    .add(
                            dependency);

            outgoing.get(
                    dependency.getPredecessorActivityId())
                    .add(
                            dependency);

            indegree.compute(
                    dependency.getSuccessorActivityId(),
                    (
                            ignored,
                            value) ->
                            value == null
                                    ? 1
                                    : value + 1);
        }

        Queue<UUID> queue =
                new ArrayDeque<>();

        activities.stream()
                .filter(
                        activity ->
                                indegree.get(
                                        activity.getId())
                                        == 0)
                .sorted(
                        Comparator.comparing(
                                ProjectScheduleActivity::getActivityCode))
                .forEach(
                        activity ->
                                queue.add(
                                        activity.getId()));

        List<UUID> topologicalOrder =
                new ArrayList<>();

        while (!queue.isEmpty()) {

            UUID current =
                    queue.remove();

            topologicalOrder.add(
                    current);

            for (ProjectScheduleDependency dependency :
                    outgoing.get(current)) {

                UUID successor =
                        dependency.getSuccessorActivityId();

                int next =
                        indegree.get(successor)
                                - 1;

                indegree.put(
                        successor,
                        next);

                if (next == 0) {

                    queue.add(
                            successor);
                }
            }
        }

        if (topologicalOrder.size()
                != activities.size()) {

            return new ScheduleNetworkResult(
                    false,
                    "The schedule network contains a dependency cycle.",
                    0,
                    List.of(),
                    Map.of());
        }

        Map<UUID, Long> earlyStart =
                new HashMap<>();

        Map<UUID, Long> earlyFinish =
                new HashMap<>();

        for (UUID activityId :
                topologicalOrder) {

            ProjectScheduleActivity activity =
                    activityById.get(
                            activityId);

            long duration =
                    activity.networkDurationDays();

            long start =
                    Math.max(
                            0,
                            ChronoUnit.DAYS.between(
                                    dataDate,
                                    activity.getCurrentStart()));

            for (ProjectScheduleDependency dependency :
                    incoming.get(
                            activityId)) {

                UUID predecessorId =
                        dependency.getPredecessorActivityId();

                long predecessorStart =
                        earlyStart.get(
                                predecessorId);

                long predecessorFinish =
                        earlyFinish.get(
                                predecessorId);

                long candidate =
                        forwardConstraint(
                                dependency.getDependencyType(),
                                predecessorStart,
                                predecessorFinish,
                                duration,
                                dependency.getLagDays());

                start =
                        Math.max(
                                start,
                                candidate);
            }

            earlyStart.put(
                    activityId,
                    start);

            earlyFinish.put(
                    activityId,
                    start + duration);
        }

        long projectDuration =
                earlyFinish.values()
                        .stream()
                        .mapToLong(
                                Long::longValue)
                        .max()
                        .orElse(0);

        Map<UUID, Long> lateStart =
                new HashMap<>();

        Map<UUID, Long> lateFinish =
                new HashMap<>();

        for (int index =
                        topologicalOrder.size() - 1;
                index >= 0;
                index--) {

            UUID activityId =
                    topologicalOrder.get(
                            index);

            ProjectScheduleActivity activity =
                    activityById.get(
                            activityId);

            long duration =
                    activity.networkDurationDays();

            long latestStart =
                    projectDuration
                            - duration;

            List<ProjectScheduleDependency> successors =
                    outgoing.get(
                            activityId);

            if (!successors.isEmpty()) {

                latestStart =
                        Long.MAX_VALUE;

                for (ProjectScheduleDependency dependency :
                        successors) {

                    UUID successorId =
                            dependency.getSuccessorActivityId();

                    ProjectScheduleActivity successor =
                            activityById.get(
                                    successorId);

                    long successorDuration =
                            successor.networkDurationDays();

                    long successorLateStart =
                            lateStart.get(
                                    successorId);

                    long successorLateFinish =
                            lateFinish.get(
                                    successorId);

                    long candidate =
                            backwardConstraint(
                                    dependency.getDependencyType(),
                                    successorLateStart,
                                    successorLateFinish,
                                    duration,
                                    successorDuration,
                                    dependency.getLagDays());

                    latestStart =
                            Math.min(
                                    latestStart,
                                    candidate);
                }
            }

            lateStart.put(
                    activityId,
                    latestStart);

            lateFinish.put(
                    activityId,
                    latestStart + duration);
        }

        Map<UUID, ScheduleActivityNetworkMetric> metrics =
                new HashMap<>();

        List<String> criticalCodes =
                new ArrayList<>();

        for (UUID activityId :
                topologicalOrder) {

            ProjectScheduleActivity activity =
                    activityById.get(
                            activityId);

            long totalFloat =
                    lateStart.get(activityId)
                            - earlyStart.get(activityId);

            boolean critical =
                    totalFloat <= 0;

            boolean nearCritical =
                    totalFloat > 0
                            && totalFloat <= 5;

            ScheduleActivityNetworkMetric metric =
                    new ScheduleActivityNetworkMetric(
                            activityId,
                            activity.getActivityCode(),
                            earlyStart.get(activityId),
                            earlyFinish.get(activityId),
                            lateStart.get(activityId),
                            lateFinish.get(activityId),
                            totalFloat,
                            critical,
                            nearCritical);

            metrics.put(
                    activityId,
                    metric);

            if (critical) {

                criticalCodes.add(
                        activity.getActivityCode());
            }
        }

        return new ScheduleNetworkResult(
                true,
                null,
                projectDuration,
                List.copyOf(
                        criticalCodes),
                Map.copyOf(
                        metrics));
    }

    private long forwardConstraint(
            ScheduleDependencyType type,
            long predecessorStart,
            long predecessorFinish,
            long successorDuration,
            int lag) {

        long value =
                switch (type) {

                    case FS ->
                            predecessorFinish
                                    + lag;

                    case SS ->
                            predecessorStart
                                    + lag;

                    case FF ->
                            predecessorFinish
                                    + lag
                                    - successorDuration;

                    case SF ->
                            predecessorStart
                                    + lag
                                    - successorDuration;
                };

        return Math.max(
                0,
                value);
    }

    private long backwardConstraint(
            ScheduleDependencyType type,
            long successorLateStart,
            long successorLateFinish,
            long predecessorDuration,
            long successorDuration,
            int lag) {

        return switch (type) {

            case FS ->
                    successorLateStart
                            - lag
                            - predecessorDuration;

            case SS ->
                    successorLateStart
                            - lag;

            case FF ->
                    successorLateFinish
                            - lag
                            - predecessorDuration;

            case SF ->
                    successorLateFinish
                            - lag;
        };
    }

    public record ScheduleActivityNetworkMetric(
            UUID activityId,
            String activityCode,
            long earlyStartDay,
            long earlyFinishDay,
            long lateStartDay,
            long lateFinishDay,
            long totalFloatDays,
            boolean critical,
            boolean nearCritical) {
    }

    public record ScheduleNetworkResult(
            boolean valid,
            String error,
            long projectDurationDays,
            List<String> criticalActivityCodes,
            Map<UUID, ScheduleActivityNetworkMetric> metrics) {
    }
}
