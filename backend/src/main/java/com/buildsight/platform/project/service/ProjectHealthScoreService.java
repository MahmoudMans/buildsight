package com.buildsight.platform.project.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

import com.buildsight.platform.cost.api.CostIntelligenceResponse;
import com.buildsight.platform.procurement.api.ProcurementIntelligenceResponse;
import com.buildsight.platform.project.api.ProjectHealthBand;
import com.buildsight.platform.project.api.ProjectHealthScoreResponse;
import com.buildsight.platform.project.api.ScheduleRiskLevel;
import com.buildsight.platform.project.domain.MilestoneStatus;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectMilestone;

import org.springframework.stereotype.Service;

@Service
public class ProjectHealthScoreService {

    private static final double
            SCHEDULE_WEIGHT =
            0.25;

    private static final double
            PROGRESS_WEIGHT =
            0.20;

    private static final double
            MILESTONE_WEIGHT =
            0.15;

    private static final double
            COST_WEIGHT =
            0.20;

    private static final double
            PROCUREMENT_WEIGHT =
            0.20;

    private final Clock clock;

    public ProjectHealthScoreService(
            Clock clock) {

        this.clock =
                clock;
    }

    public ProjectHealthScoreResponse calculate(
            Project project,
            List<ProjectMilestone> milestones,
            CostIntelligenceResponse cost,
            ProcurementIntelligenceResponse procurement) {

        LocalDate today =
                LocalDate.now(
                        clock);

        long scheduleVarianceDays =
                ChronoUnit.DAYS.between(
                        project.getPlannedEndDate(),
                        project.getForecastEndDate());

        double scheduleScore =
                calculateScheduleScore(
                        scheduleVarianceDays);

        double expectedProgress =
                calculateExpectedProgress(
                        project.getPlannedStartDate(),
                        project.getForecastEndDate(),
                        today);

        double actualProgress =
                project
                        .getPhysicalProgressPercentage()
                        .doubleValue();

        double progressVariance =
                actualProgress
                        - expectedProgress;

        double progressScore =
                calculateProgressScore(
                        expectedProgress,
                        actualProgress);

        long overdueMilestones =
                milestones.stream()
                        .filter(
                                milestone ->
                                        milestone.getStatus()
                                                != MilestoneStatus.COMPLETED)
                        .filter(
                                milestone ->
                                        milestone.getForecastDate()
                                                .isBefore(
                                                        today))
                        .count();

        long blockedMilestones =
                milestones.stream()
                        .filter(
                                milestone ->
                                        milestone.getStatus()
                                                == MilestoneStatus.BLOCKED)
                        .count();

        double milestoneScore =
                calculateMilestoneScore(
                        milestones,
                        overdueMilestones,
                        blockedMilestones);

        double overall =
                scheduleScore
                                * SCHEDULE_WEIGHT
                        + progressScore
                                * PROGRESS_WEIGHT
                        + milestoneScore
                                * MILESTONE_WEIGHT
                        + cost.costScore()
                                * COST_WEIGHT
                        + procurement.procurementScore()
                                * PROCUREMENT_WEIGHT;

        int score =
                (int) Math.round(
                        clamp(
                                overall,
                                0,
                                100));

        return new ProjectHealthScoreResponse(
                today,
                score,
                healthBand(
                        score),
                scheduleRisk(
                        scheduleVarianceDays),
                cost.costRisk(),
                procurement.procurementRisk(),
                scheduleVarianceDays,
                roundOne(
                        expectedProgress),
                roundOne(
                        actualProgress),
                roundOne(
                        progressVariance),
                overdueMilestones,
                blockedMilestones,
                roundOne(
                        scheduleScore),
                roundOne(
                        progressScore),
                roundOne(
                        milestoneScore),
                roundOne(
                        cost.costScore()),
                roundOne(
                        procurement.procurementScore()),
                "Health Score v3 combines schedule performance (25%), physical progress (20%), milestone execution (15%), cost performance (20%), and procurement performance (20%). Each dimension remains independently visible and explainable.");
    }

    private double calculateScheduleScore(
            long varianceDays) {

        if (varianceDays <= 0) {
            return 100;
        }

        return clamp(
                100
                        - varianceDays
                        * 2.0,
                0,
                100);
    }

    private double calculateProgressScore(
            double expected,
            double actual) {

        double lag =
                Math.max(
                        0,
                        expected
                                - actual);

        return clamp(
                100
                        - lag
                        * 1.5,
                0,
                100);
    }

    private double calculateMilestoneScore(
            List<ProjectMilestone> milestones,
            long overdue,
            long blocked) {

        if (milestones.isEmpty()) {
            return 100;
        }

        return clamp(
                100
                        - overdue
                        * 15.0
                        - blocked
                        * 20.0,
                0,
                100);
    }

    private double calculateExpectedProgress(
            LocalDate start,
            LocalDate forecastEnd,
            LocalDate today) {

        if (today.isBefore(
                start)) {

            return 0;
        }

        if (!today.isBefore(
                forecastEnd)) {

            return 100;
        }

        long totalDays =
                Math.max(
                        1,
                        ChronoUnit.DAYS.between(
                                start,
                                forecastEnd));

        long elapsedDays =
                Math.max(
                        0,
                        ChronoUnit.DAYS.between(
                                start,
                                today));

        return clamp(
                elapsedDays
                        * 100.0
                        / totalDays,
                0,
                100);
    }

    private ProjectHealthBand healthBand(
            int score) {

        if (score >= 80) {
            return ProjectHealthBand.HEALTHY;
        }

        if (score >= 60) {
            return ProjectHealthBand.WATCH;
        }

        return ProjectHealthBand.AT_RISK;
    }

    private ScheduleRiskLevel scheduleRisk(
            long varianceDays) {

        if (varianceDays <= 0) {
            return ScheduleRiskLevel.ON_TRACK;
        }

        if (varianceDays <= 14) {
            return ScheduleRiskLevel.WATCH;
        }

        return ScheduleRiskLevel.AT_RISK;
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
