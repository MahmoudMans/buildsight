package com.buildsight.platform.schedule.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import com.buildsight.platform.project.api.ScheduleRiskLevel;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleIntelligenceResponse;
import com.buildsight.platform.schedule.domain.ProjectScheduleActivity;
import com.buildsight.platform.schedule.domain.ProjectScheduleBaseline;
import com.buildsight.platform.schedule.domain.ProjectScheduleBaselineActivity;
import com.buildsight.platform.schedule.domain.ProjectScheduleConstraint;
import com.buildsight.platform.schedule.domain.ProjectScheduleDependency;
import com.buildsight.platform.schedule.domain.ScheduleActivityStatus;
import com.buildsight.platform.schedule.domain.ScheduleConstraintStatus;
import com.buildsight.platform.schedule.service.ScheduleNetworkCalculator.ScheduleActivityNetworkMetric;
import com.buildsight.platform.schedule.service.ScheduleNetworkCalculator.ScheduleNetworkResult;

import org.springframework.stereotype.Service;

@Service
public class ScheduleIntelligenceService {

    private final ScheduleNetworkCalculator
            networkCalculator;

    private final Clock
            clock;

    public ScheduleIntelligenceService(
            ScheduleNetworkCalculator networkCalculator,
            Clock clock) {

        this.networkCalculator =
                networkCalculator;

        this.clock =
                clock;
    }

    public ScheduleIntelligenceResponse calculate(
            Project project,
            Optional<ProjectScheduleBaseline> approvedBaseline,
            List<ProjectScheduleBaselineActivity> baselineActivities,
            List<ProjectScheduleActivity> activities,
            List<ProjectScheduleDependency> dependencies,
            List<ProjectScheduleConstraint> constraints) {

        LocalDate today =
                LocalDate.now(
                        clock);

        if (activities.isEmpty()) {

            long legacyVariance =
                    ChronoUnit.DAYS.between(
                            project.getPlannedEndDate(),
                            project.getForecastEndDate());

            return new ScheduleIntelligenceResponse(
                    today,
                    true,
                    null,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    approvedBaseline
                            .map(
                                    ProjectScheduleBaseline::getName)
                            .orElse(null),
                    baselineFinish(
                            baselineActivities),
                    project.getForecastEndDate(),
                    0,
                    legacyVariance,
                    75,
                    ScheduleRiskLevel.WATCH,
                    List.of(),
                    "No detailed activity network exists yet. BuildSight applies a neutral schedule score until CPM schedule activities and logic are established.");
        }

        ScheduleNetworkResult network =
                networkCalculator.calculate(
                        activities,
                        dependencies,
                        today);

        if (!network.valid()) {

            return new ScheduleIntelligenceResponse(
                    today,
                    false,
                    network.error(),
                    activities.size(),
                    completedCount(
                            activities),
                    inProgressCount(
                            activities),
                    overdueCount(
                            activities,
                            today),
                    0,
                    0,
                    0,
                    0,
                    openConstraintCount(
                            constraints),
                    overdueConstraintCount(
                            constraints,
                            today),
                    0,
                    lookaheadCount(
                            activities,
                            today,
                            14),
                    lookaheadCount(
                            activities,
                            today,
                            28),
                    lookaheadCount(
                            activities,
                            today,
                            42),
                    approvedBaseline
                            .map(
                                    ProjectScheduleBaseline::getName)
                            .orElse(null),
                    baselineFinish(
                            baselineActivities),
                    null,
                    0,
                    0,
                    0,
                    ScheduleRiskLevel.AT_RISK,
                    List.of(),
                    "The activity dependency network contains a cycle. CPM forecasting is invalid until the circular logic is removed.");
        }

        LocalDate cpmForecastFinish =
                today.plusDays(
                        network.projectDurationDays());

        LocalDate approvedBaselineFinish =
                baselineFinish(
                        baselineActivities);

        long baselineVariance =
                approvedBaselineFinish == null
                        ? 0
                        : ChronoUnit.DAYS.between(
                                approvedBaselineFinish,
                                cpmForecastFinish);

        long projectVariance =
                ChronoUnit.DAYS.between(
                        project.getPlannedEndDate(),
                        cpmForecastFinish);

        long critical =
                network.metrics()
                        .values()
                        .stream()
                        .filter(
                                ScheduleActivityNetworkMetric::critical)
                        .count();

        long nearCritical =
                network.metrics()
                        .values()
                        .stream()
                        .filter(
                                ScheduleActivityNetworkMetric::nearCritical)
                        .count();

        double averageFloat =
                network.metrics()
                        .values()
                        .stream()
                        .mapToLong(
                                ScheduleActivityNetworkMetric::totalFloatDays)
                        .average()
                        .orElse(0);

        Set<java.util.UUID> criticalIds =
                new HashSet<>();

        network.metrics()
                .values()
                .stream()
                .filter(
                        ScheduleActivityNetworkMetric::critical)
                .map(
                        ScheduleActivityNetworkMetric::activityId)
                .forEach(
                        criticalIds::add);

        long constrainedCritical =
                constraints.stream()
                        .filter(
                                constraint ->
                                        constraint.getStatus()
                                                == ScheduleConstraintStatus.OPEN)
                        .filter(
                                constraint ->
                                        criticalIds.contains(
                                                constraint.getActivityId()))
                        .map(
                                ProjectScheduleConstraint::getActivityId)
                        .distinct()
                        .count();

        long overdueActivities =
                overdueCount(
                        activities,
                        today);

        long overdueConstraints =
                overdueConstraintCount(
                        constraints,
                        today);

        double score =
                100;

        if (approvedBaseline.isEmpty()) {

            score -=
                    10;
        }

        if (baselineVariance > 0) {

            score -=
                    Math.min(
                            35,
                            baselineVariance
                                    * 1.5);
        }

        if (projectVariance > 0) {

            score -=
                    Math.min(
                            20,
                            projectVariance
                                    * 0.75);
        }

        score -=
                Math.min(
                        24,
                        overdueActivities
                                * 4.0);

        score -=
                Math.min(
                        30,
                        constrainedCritical
                                * 10.0);

        score -=
                Math.min(
                        24,
                        overdueConstraints
                                * 6.0);

        score -=
                Math.min(
                        10,
                        nearCritical
                                * 2.0);

        score =
                clamp(
                        score,
                        0,
                        100);

        ScheduleRiskLevel risk =
                score >= 80
                        ? ScheduleRiskLevel.ON_TRACK
                        : score >= 60
                                ? ScheduleRiskLevel.WATCH
                                : ScheduleRiskLevel.AT_RISK;

        return new ScheduleIntelligenceResponse(
                today,
                true,
                null,
                activities.size(),
                completedCount(
                        activities),
                inProgressCount(
                        activities),
                overdueActivities,
                critical,
                nearCritical,
                network.projectDurationDays(),
                roundOne(
                        averageFloat),
                openConstraintCount(
                        constraints),
                overdueConstraints,
                constrainedCritical,
                lookaheadCount(
                        activities,
                        today,
                        14),
                lookaheadCount(
                        activities,
                        today,
                        28),
                lookaheadCount(
                        activities,
                        today,
                        42),
                approvedBaseline
                        .map(
                                ProjectScheduleBaseline::getName)
                        .orElse(null),
                approvedBaselineFinish,
                cpmForecastFinish,
                baselineVariance,
                projectVariance,
                roundOne(
                        score),
                risk,
                network.criticalActivityCodes(),
                "Schedule Intelligence applies CPM network logic, baseline-to-forecast finish variance, overdue activities, critical-path constraints, overdue lookahead constraints and near-critical exposure. The project-level schedule health dimension now uses this CPM-derived score.");
    }

    private long completedCount(
            List<ProjectScheduleActivity> activities) {

        return activities.stream()
                .filter(
                        activity ->
                                activity.getStatus()
                                        == ScheduleActivityStatus.COMPLETED)
                .count();
    }

    private long inProgressCount(
            List<ProjectScheduleActivity> activities) {

        return activities.stream()
                .filter(
                        activity ->
                                activity.getStatus()
                                        == ScheduleActivityStatus.IN_PROGRESS)
                .count();
    }

    private long overdueCount(
            List<ProjectScheduleActivity> activities,
            LocalDate today) {

        return activities.stream()
                .filter(
                        activity ->
                                activity.getStatus()
                                        != ScheduleActivityStatus.COMPLETED)
                .filter(
                        activity ->
                                activity.getCurrentFinish()
                                        .isBefore(today))
                .count();
    }

    private long openConstraintCount(
            List<ProjectScheduleConstraint> constraints) {

        return constraints.stream()
                .filter(
                        constraint ->
                                constraint.getStatus()
                                        == ScheduleConstraintStatus.OPEN)
                .count();
    }

    private long overdueConstraintCount(
            List<ProjectScheduleConstraint> constraints,
            LocalDate today) {

        return constraints.stream()
                .filter(
                        constraint ->
                                constraint.getStatus()
                                        == ScheduleConstraintStatus.OPEN)
                .filter(
                        constraint ->
                                constraint.getDueDate()
                                        .isBefore(today))
                .count();
    }

    private long lookaheadCount(
            List<ProjectScheduleActivity> activities,
            LocalDate today,
            int days) {

        LocalDate end =
                today.plusDays(
                        days);

        return activities.stream()
                .filter(
                        activity ->
                                activity.getStatus()
                                        != ScheduleActivityStatus.COMPLETED)
                .filter(
                        activity ->
                                !activity.getCurrentStart()
                                        .isBefore(today))
                .filter(
                        activity ->
                                !activity.getCurrentStart()
                                        .isAfter(end))
                .count();
    }

    private LocalDate baselineFinish(
            List<ProjectScheduleBaselineActivity> baselineActivities) {

        return baselineActivities.stream()
                .map(
                        ProjectScheduleBaselineActivity::getPlannedFinish)
                .max(
                        LocalDate::compareTo)
                .orElse(null);
    }

    private double clamp(
            double value,
            double minimum,
            double maximum) {

        return Math.max(
                minimum,
                Math.min(
                        maximum,
                        value));
    }

    private double roundOne(
            double value) {

        return Math.round(
                        value
                                * 10.0)
                / 10.0;
    }
}
