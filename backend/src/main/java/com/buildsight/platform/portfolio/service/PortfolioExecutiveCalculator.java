package com.buildsight.platform.portfolio.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

import com.buildsight.platform.portfolio.api.PortfolioBenchmarksResponse;
import com.buildsight.platform.portfolio.api.PortfolioExceptionDomain;
import com.buildsight.platform.portfolio.api.PortfolioExceptionResponse;
import com.buildsight.platform.portfolio.api.PortfolioExceptionSeverity;
import com.buildsight.platform.portfolio.api.PortfolioProjectSnapshotResponse;
import com.buildsight.platform.portfolio.api.PortfolioSummaryResponse;
import com.buildsight.platform.project.api.ProjectHealthBand;
import com.buildsight.platform.project.domain.ProjectStatus;

import org.springframework.stereotype.Service;

@Service
public class PortfolioExecutiveCalculator {

    public int attentionScore(
            int healthScore,
            long scheduleVarianceDays,
            BigDecimal varianceAtCompletion,
            BigDecimal revisedCostPlan,
            long delayedProcurementPackages,
            long highExposureRisks,
            long criticalOpenIssues,
            long forecastDelayDays,
            long blockedPackages,
            long overdueRfis,
            long criticalOpenRfis) {

        double score =
                Math.max(
                        0,
                        100 - healthScore);

        score +=
                Math.min(
                        18,
                        Math.max(
                                0,
                                scheduleVarianceDays)
                                * 0.6);

        if (varianceAtCompletion.signum()
                < 0) {

            double overrun =
                    overrunPercentage(
                            varianceAtCompletion,
                            revisedCostPlan);

            score +=
                    Math.min(
                            25,
                            overrun * 2);
        }

        score +=
                Math.min(
                        15,
                        delayedProcurementPackages
                                * 5);

        score +=
                Math.min(
                        18,
                        highExposureRisks
                                * 6);

        score +=
                Math.min(
                        25,
                        criticalOpenIssues
                                * 10);

        score +=
                Math.min(
                        15,
                        forecastDelayDays
                                * 0.5);

        score +=
                Math.min(
                        20,
                        blockedPackages
                                * 8);

        score +=
                Math.min(
                        15,
                        overdueRfis
                                * 4);

        score +=
                Math.min(
                        20,
                        criticalOpenRfis
                                * 10);

        return (int) Math.round(
                clamp(
                        score,
                        0,
                        100));
    }

    public PortfolioSummaryResponse summary(
            List<PortfolioProjectSnapshotResponse> projects,
            long exceptionCount) {

        BigDecimal totalApproved =
                sum(
                        projects,
                        PortfolioProjectSnapshotResponse::approvedBudget);

        BigDecimal totalRevised =
                sum(
                        projects,
                        PortfolioProjectSnapshotResponse::revisedCostPlan);

        BigDecimal totalEac =
                sum(
                        projects,
                        PortfolioProjectSnapshotResponse::forecastAtCompletion);

        BigDecimal totalActual =
                sum(
                        projects,
                        PortfolioProjectSnapshotResponse::actualCosts);

        BigDecimal outstanding =
                sum(
                        projects,
                        PortfolioProjectSnapshotResponse::outstandingCommitments);

        BigDecimal vac =
                sum(
                        projects,
                        PortfolioProjectSnapshotResponse::varianceAtCompletion);

        double weightedHealth =
                weightedHealth(
                        projects);

        return new PortfolioSummaryResponse(
                projects.size(),

                projects.stream()
                        .filter(
                                project ->
                                        project.status()
                                                == ProjectStatus.PLANNING)
                        .count(),

                projects.stream()
                        .filter(
                                project ->
                                        project.status()
                                                == ProjectStatus.ACTIVE)
                        .count(),

                projects.stream()
                        .filter(
                                project ->
                                        project.status()
                                                == ProjectStatus.ON_HOLD)
                        .count(),

                projects.stream()
                        .filter(
                                project ->
                                        project.status()
                                                == ProjectStatus.COMPLETED)
                        .count(),

                projects.stream()
                        .filter(
                                project ->
                                        project.healthBand()
                                                == ProjectHealthBand.HEALTHY)
                        .count(),

                projects.stream()
                        .filter(
                                project ->
                                        project.healthBand()
                                                == ProjectHealthBand.WATCH)
                        .count(),

                projects.stream()
                        .filter(
                                project ->
                                        project.healthBand()
                                                == ProjectHealthBand.AT_RISK)
                        .count(),

                money(
                        totalApproved),

                money(
                        totalRevised),

                money(
                        totalEac),

                money(
                        totalActual),

                money(
                        outstanding),

                money(
                        vac),

                roundOne(
                        weightedHealth),

                healthBand(
                        weightedHealth),

                projects.stream()
                        .mapToLong(
                                PortfolioProjectSnapshotResponse::delayedProcurementPackages)
                        .sum(),

                projects.stream()
                        .mapToLong(
                                PortfolioProjectSnapshotResponse::highExposureRisks)
                        .sum(),

                projects.stream()
                        .mapToLong(
                                PortfolioProjectSnapshotResponse::criticalOpenIssues)
                        .sum(),

                projects.stream()
                        .mapToLong(
                                PortfolioProjectSnapshotResponse::blockedWorkPackages)
                        .sum(),

                projects.stream()
                        .mapToLong(
                                PortfolioProjectSnapshotResponse::overdueRfis)
                        .sum(),

                exceptionCount);
    }

    public PortfolioBenchmarksResponse benchmarks(
            List<PortfolioProjectSnapshotResponse> projects) {

        if (projects.isEmpty()) {

            return new PortfolioBenchmarksResponse(
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    null,
                    null);
        }

        PortfolioProjectSnapshotResponse best =
                projects.stream()
                        .max(
                                Comparator.comparingInt(
                                        PortfolioProjectSnapshotResponse::healthScore))
                        .orElseThrow();

        PortfolioProjectSnapshotResponse worst =
                projects.stream()
                        .min(
                                Comparator.comparingInt(
                                        PortfolioProjectSnapshotResponse::healthScore))
                        .orElseThrow();

        return new PortfolioBenchmarksResponse(
                average(
                        projects,
                        Metric.HEALTH),

                average(
                        projects,
                        Metric.COST),

                average(
                        projects,
                        Metric.PROCUREMENT),

                average(
                        projects,
                        Metric.RISK),

                average(
                        projects,
                        Metric.PRODUCTION),

                average(
                        projects,
                        Metric.INFORMATION),

                roundTwo(
                        projects.stream()
                                .mapToDouble(
                                        PortfolioProjectSnapshotResponse::productivityIndex)
                                .average()
                                .orElse(0)),

                best.code(),
                worst.code());
    }

    public List<PortfolioExceptionResponse> exceptions(
            List<PortfolioProjectSnapshotResponse> projects) {

        List<PortfolioExceptionResponse> result =
                new ArrayList<>();

        for (PortfolioProjectSnapshotResponse project :
                projects) {

            addOverallException(
                    result,
                    project);

            addScheduleException(
                    result,
                    project);

            addCostException(
                    result,
                    project);

            addProcurementException(
                    result,
                    project);

            addRiskException(
                    result,
                    project);

            addProductionException(
                    result,
                    project);

            addInformationException(
                    result,
                    project);
        }

        result.sort(
                Comparator
                        .comparingInt(
                                PortfolioExceptionResponse::priorityScore)
                        .reversed()
                        .thenComparing(
                                PortfolioExceptionResponse::projectCode)
                        .thenComparing(
                                exception ->
                                        exception.domain()
                                                .name()));

        return List.copyOf(
                result);
    }

    private void addOverallException(
            List<PortfolioExceptionResponse> result,
            PortfolioProjectSnapshotResponse project) {

        if (project.healthScore()
                >= 60) {
            return;
        }

        result.add(
                exception(
                        project,
                        PortfolioExceptionSeverity.CRITICAL,
                        PortfolioExceptionDomain.OVERALL,
                        "Overall project health is at risk",
                        "The combined BuildSight health score is below the executive at-risk threshold.",
                        "Health score",
                        project.healthScore()
                                + "/100",
                        "/projects/"
                                + project.projectId(),
                        100
                                + project.attentionScore()));
    }

    private void addScheduleException(
            List<PortfolioExceptionResponse> result,
            PortfolioProjectSnapshotResponse project) {

        if (project.scheduleVarianceDays()
                <= 0) {
            return;
        }

        PortfolioExceptionSeverity severity =
                project.scheduleVarianceDays()
                                > 14
                        ? PortfolioExceptionSeverity.HIGH
                        : PortfolioExceptionSeverity.MEDIUM;

        result.add(
                exception(
                        project,
                        severity,
                        PortfolioExceptionDomain.SCHEDULE,
                        "Forecast completion is behind plan",
                        "The current forecast finish exceeds the baseline planned finish.",
                        "Schedule variance",
                        "+"
                                + project.scheduleVarianceDays()
                                + " days",
                        "/projects/"
                                + project.projectId(),
                        severityScore(
                                severity)
                                + (int) Math.min(
                                        20,
                                        project.scheduleVarianceDays())));
    }

    private void addCostException(
            List<PortfolioExceptionResponse> result,
            PortfolioProjectSnapshotResponse project) {

        if (project.varianceAtCompletion()
                .signum()
                >= 0) {
            return;
        }

        double overrun =
                overrunPercentage(
                        project.varianceAtCompletion(),
                        project.revisedCostPlan());

        PortfolioExceptionSeverity severity =
                overrun > 5
                        ? PortfolioExceptionSeverity.CRITICAL
                        : PortfolioExceptionSeverity.HIGH;

        result.add(
                exception(
                        project,
                        severity,
                        PortfolioExceptionDomain.COST,
                        "Forecast cost exceeds revised cost plan",
                        "Forecast-at-completion is above the currently revised project cost baseline.",
                        "Forecast overrun",
                        roundOne(
                                overrun)
                                + "%",
                        "/projects/"
                                + project.projectId()
                                + "/costs",
                        severityScore(
                                severity)
                                + (int) Math.min(
                                        30,
                                        overrun * 2)));
    }

    private void addProcurementException(
            List<PortfolioExceptionResponse> result,
            PortfolioProjectSnapshotResponse project) {

        if (project.delayedProcurementPackages()
                <= 0) {
            return;
        }

        PortfolioExceptionSeverity severity =
                project.delayedProcurementPackages()
                                >= 2
                        ? PortfolioExceptionSeverity.HIGH
                        : PortfolioExceptionSeverity.MEDIUM;

        result.add(
                exception(
                        project,
                        severity,
                        PortfolioExceptionDomain.PROCUREMENT,
                        "Delayed procurement packages require attention",
                        "One or more procurement packages are forecast or recorded beyond their award due date.",
                        "Delayed packages",
                        Long.toString(
                                project.delayedProcurementPackages()),
                        "/projects/"
                                + project.projectId()
                                + "/procurement",
                        severityScore(
                                severity)
                                + (int) Math.min(
                                        20,
                                        project.delayedProcurementPackages()
                                                * 5)));
    }

    private void addRiskException(
            List<PortfolioExceptionResponse> result,
            PortfolioProjectSnapshotResponse project) {

        if (project.criticalOpenIssues()
                > 0) {

            result.add(
                    exception(
                            project,
                            PortfolioExceptionSeverity.CRITICAL,
                            PortfolioExceptionDomain.RISK,
                            "Critical project issues remain unresolved",
                            "The project risk-control register contains unresolved critical issues.",
                            "Critical issues",
                            Long.toString(
                                    project.criticalOpenIssues()),
                            "/projects/"
                                    + project.projectId()
                                    + "/risk-control",
                            110
                                    + (int) Math.min(
                                            20,
                                            project.criticalOpenIssues()
                                                    * 5)));

            return;
        }

        if (project.highExposureRisks()
                > 0) {

            result.add(
                    exception(
                            project,
                            PortfolioExceptionSeverity.HIGH,
                            PortfolioExceptionDomain.RISK,
                            "High residual risk exposure",
                            "Residual risk exposure remains above BuildSight's high-exposure threshold.",
                            "High-exposure risks",
                            Long.toString(
                                    project.highExposureRisks()),
                            "/projects/"
                                    + project.projectId()
                                    + "/risk-control",
                            75
                                    + (int) Math.min(
                                            20,
                                            project.highExposureRisks()
                                                    * 4)));
        }
    }

    private void addProductionException(
            List<PortfolioExceptionResponse> result,
            PortfolioProjectSnapshotResponse project) {

        if (project.blockedWorkPackages()
                > 0) {

            result.add(
                    exception(
                            project,
                            PortfolioExceptionSeverity.HIGH,
                            PortfolioExceptionDomain.PRODUCTION,
                            "Blocked production fronts",
                            "One or more active work packages are currently blocked.",
                            "Blocked packages",
                            Long.toString(
                                    project.blockedWorkPackages()),
                            "/projects/"
                                    + project.projectId()
                                    + "/production",
                            80
                                    + (int) Math.min(
                                            20,
                                            project.blockedWorkPackages()
                                                    * 5)));

            return;
        }

        if (project.productionScore()
                < 60) {

            result.add(
                    exception(
                            project,
                            PortfolioExceptionSeverity.HIGH,
                            PortfolioExceptionDomain.PRODUCTION,
                            "Production performance is at risk",
                            "Quantity progress and/or productivity is materially below the expected production baseline.",
                            "Production score",
                            roundOne(
                                    project.productionScore())
                                    + "/100",
                            "/projects/"
                                    + project.projectId()
                                    + "/production",
                            75
                                    + (int) Math.min(
                                            20,
                                            60
                                                    - project.productionScore())));
        }
    }

    private void addInformationException(
            List<PortfolioExceptionResponse> result,
            PortfolioProjectSnapshotResponse project) {

        if (project.criticalOpenRfis()
                > 0) {

            result.add(
                    exception(
                            project,
                            PortfolioExceptionSeverity.HIGH,
                            PortfolioExceptionDomain.INFORMATION,
                            "Critical RFIs remain open",
                            "Critical construction information is awaiting resolution.",
                            "Critical open RFIs",
                            Long.toString(
                                    project.criticalOpenRfis()),
                            "/projects/"
                                    + project.projectId()
                                    + "/documents",
                            85
                                    + (int) Math.min(
                                            15,
                                            project.criticalOpenRfis()
                                                    * 5)));

            return;
        }

        if (project.overdueRfis()
                > 0) {

            result.add(
                    exception(
                            project,
                            PortfolioExceptionSeverity.MEDIUM,
                            PortfolioExceptionDomain.INFORMATION,
                            "Overdue RFIs",
                            "Open requests for information have passed their required response date.",
                            "Overdue RFIs",
                            Long.toString(
                                    project.overdueRfis()),
                            "/projects/"
                                    + project.projectId()
                                    + "/documents",
                            45
                                    + (int) Math.min(
                                            20,
                                            project.overdueRfis()
                                                    * 4)));
        }
    }

    private PortfolioExceptionResponse exception(
            PortfolioProjectSnapshotResponse project,
            PortfolioExceptionSeverity severity,
            PortfolioExceptionDomain domain,
            String title,
            String detail,
            String metricLabel,
            String metricValue,
            String route,
            int priority) {

        return new PortfolioExceptionResponse(
                project.projectId()
                        + "-"
                        + domain.name(),
                project.projectId(),
                project.code(),
                project.name(),
                severity,
                domain,
                title,
                detail,
                metricLabel,
                metricValue,
                route,
                priority);
    }

    private double weightedHealth(
            List<PortfolioProjectSnapshotResponse> projects) {

        if (projects.isEmpty()) {
            return 0;
        }

        double numerator =
                0;

        double denominator =
                0;

        for (PortfolioProjectSnapshotResponse project :
                projects) {

            double weight =
                    Math.max(
                            0,
                            project.revisedCostPlan()
                                    .doubleValue());

            if (weight <= 0) {
                continue;
            }

            numerator +=
                    project.healthScore()
                            * weight;

            denominator +=
                    weight;
        }

        if (denominator <= 0) {

            return projects.stream()
                    .mapToInt(
                            PortfolioProjectSnapshotResponse::healthScore)
                    .average()
                    .orElse(0);
        }

        return numerator
                / denominator;
    }

    private double average(
            List<PortfolioProjectSnapshotResponse> projects,
            Metric metric) {

        return roundOne(
                projects.stream()
                        .mapToDouble(
                                project ->
                                        switch (metric) {
                                            case HEALTH ->
                                                    project.healthScore();

                                            case COST ->
                                                    project.costScore();

                                            case PROCUREMENT ->
                                                    project.procurementScore();

                                            case RISK ->
                                                    project.riskScore();

                                            case PRODUCTION ->
                                                    project.productionScore();

                                            case INFORMATION ->
                                                    project.informationScore();
                                        })
                        .average()
                        .orElse(0));
    }

    private BigDecimal sum(
            List<PortfolioProjectSnapshotResponse> projects,
            java.util.function.Function<
                    PortfolioProjectSnapshotResponse,
                    BigDecimal>
                    extractor) {

        return projects.stream()
                .map(
                        extractor)
                .reduce(
                        BigDecimal.ZERO,
                        BigDecimal::add);
    }

    private double overrunPercentage(
            BigDecimal varianceAtCompletion,
            BigDecimal revisedCostPlan) {

        if (varianceAtCompletion.signum()
                        >= 0
                || revisedCostPlan.signum()
                        <= 0) {

            return 0;
        }

        return varianceAtCompletion
                .abs()
                .multiply(
                        new BigDecimal("100"))
                .divide(
                        revisedCostPlan,
                        6,
                        RoundingMode.HALF_UP)
                .doubleValue();
    }

    private ProjectHealthBand healthBand(
            double score) {

        if (score >= 80) {
            return ProjectHealthBand.HEALTHY;
        }

        if (score >= 60) {
            return ProjectHealthBand.WATCH;
        }

        return ProjectHealthBand.AT_RISK;
    }

    private int severityScore(
            PortfolioExceptionSeverity severity) {

        return switch (severity) {
            case CRITICAL -> 100;
            case HIGH -> 70;
            case MEDIUM -> 40;
        };
    }

    private BigDecimal money(
            BigDecimal value) {

        return value.setScale(
                2,
                RoundingMode.HALF_UP);
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

    private double roundTwo(
            double value) {

        return Math.round(
                        value
                                * 100.0)
                / 100.0;
    }

    private enum Metric {
        HEALTH,
        COST,
        PROCUREMENT,
        RISK,
        PRODUCTION,
        INFORMATION
    }
}
