package com.buildsight.platform.project.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;

import com.buildsight.platform.commercial.api.CommercialIntelligenceResponse;
import com.buildsight.platform.cost.api.CostIntelligenceResponse;
import com.buildsight.platform.document.api.DocumentIntelligenceResponse;
import com.buildsight.platform.procurement.api.ProcurementIntelligenceResponse;
import com.buildsight.platform.production.api.ProductionIntelligenceResponse;
import com.buildsight.platform.project.api.ProjectHealthBand;
import com.buildsight.platform.project.api.ProjectHealthScoreResponse;
import com.buildsight.platform.project.api.ScheduleRiskLevel;
import com.buildsight.platform.project.domain.MilestoneStatus;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectMilestone;
import com.buildsight.platform.quality.api.QualityIntelligenceResponse;
import com.buildsight.platform.risk.api.RiskIntelligenceResponse;
import com.buildsight.platform.safety.api.SafetyIntelligenceResponse;

import org.springframework.stereotype.Service;

@Service
public class ProjectHealthScoreService {

    private static final double SCHEDULE_WEIGHT = 0.14;
    private static final double PROGRESS_WEIGHT = 0.05;
    private static final double MILESTONE_WEIGHT = 0.05;
    private static final double COST_WEIGHT = 0.14;
    private static final double PROCUREMENT_WEIGHT = 0.10;
    private static final double RISK_WEIGHT = 0.07;
    private static final double PRODUCTION_WEIGHT = 0.11;
    private static final double INFORMATION_WEIGHT = 0.07;
    private static final double QUALITY_WEIGHT = 0.07;
    private static final double SAFETY_WEIGHT = 0.10;
    private static final double COMMERCIAL_WEIGHT = 0.10;

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
            ProcurementIntelligenceResponse procurement,
            RiskIntelligenceResponse risk,
            ProductionIntelligenceResponse production,
            DocumentIntelligenceResponse information,
            QualityIntelligenceResponse quality,
            SafetyIntelligenceResponse safety,
            CommercialIntelligenceResponse commercial) {

        LocalDate today =
                LocalDate.now(clock);

        long scheduleVarianceDays =
                ChronoUnit.DAYS.between(
                        project.getPlannedEndDate(),
                        project.getForecastEndDate());

        double scheduleScore =
                scheduleScore(
                        scheduleVarianceDays);

        double expectedProgress =
                expectedProgress(
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
                progressScore(
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
                                                .isBefore(today))
                        .count();

        long blockedMilestones =
                milestones.stream()
                        .filter(
                                milestone ->
                                        milestone.getStatus()
                                                == MilestoneStatus.BLOCKED)
                        .count();

        double milestoneScore =
                milestoneScore(
                        milestones,
                        overdueMilestones,
                        blockedMilestones);

        double overall =
                scheduleScore * SCHEDULE_WEIGHT
                        + progressScore * PROGRESS_WEIGHT
                        + milestoneScore * MILESTONE_WEIGHT
                        + cost.costScore() * COST_WEIGHT
                        + procurement.procurementScore() * PROCUREMENT_WEIGHT
                        + risk.riskScore() * RISK_WEIGHT
                        + production.productionScore() * PRODUCTION_WEIGHT
                        + information.informationScore() * INFORMATION_WEIGHT
                        + quality.qualityScore() * QUALITY_WEIGHT
                        + safety.safetyScore() * SAFETY_WEIGHT
                        + commercial.commercialScore() * COMMERCIAL_WEIGHT;

        int score =
                (int) Math.round(
                        clamp(
                                overall,
                                0,
                                100));

        return new ProjectHealthScoreResponse(
                today,
                score,
                healthBand(score),
                scheduleRisk(
                        scheduleVarianceDays),
                cost.costRisk(),
                procurement.procurementRisk(),
                risk.riskLevel(),
                production.productionRisk(),
                information.informationRisk(),
                quality.qualityRisk(),
                safety.safetyRisk(),
                commercial.commercialRisk(),
                scheduleVarianceDays,
                roundOne(expectedProgress),
                roundOne(actualProgress),
                roundOne(progressVariance),
                overdueMilestones,
                blockedMilestones,
                roundOne(scheduleScore),
                roundOne(progressScore),
                roundOne(milestoneScore),
                roundOne(cost.costScore()),
                roundOne(procurement.procurementScore()),
                roundOne(risk.riskScore()),
                roundOne(production.productionScore()),
                roundOne(information.informationScore()),
                roundOne(quality.qualityScore()),
                roundOne(safety.safetyScore()),
                roundOne(commercial.commercialScore()),
                "Health Score v9 combines schedule (14%), physical progress (5%), milestones (5%), cost (14%), procurement (10%), risk control (7%), site production (11%), information control (7%), quality/handover (7%), HSE/safety (10%), and commercial/cash-flow performance (10%).");
    }

    private double scheduleScore(
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

    private double progressScore(
            double expected,
            double actual) {

        double lag =
                Math.max(
                        0,
                        expected - actual);

        return clamp(
                100
                        - lag
                        * 1.5,
                0,
                100);
    }

    private double milestoneScore(
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

    private double expectedProgress(
            LocalDate start,
            LocalDate forecastEnd,
            LocalDate today) {

        if (today.isBefore(start)) {
            return 0;
        }

        if (!today.isBefore(forecastEnd)) {
            return 100;
        }

        long totalDays =
                Math.max(
                        1,
                        ChronoUnit.DAYS.between(
                                start,
                                forecastEnd));

        long elapsed =
                Math.max(
                        0,
                        ChronoUnit.DAYS.between(
                                start,
                                today));

        return clamp(
                elapsed
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
