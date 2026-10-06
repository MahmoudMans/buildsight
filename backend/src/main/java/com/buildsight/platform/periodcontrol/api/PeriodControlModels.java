package com.buildsight.platform.periodcontrol.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.periodcontrol.domain.ControlBaselineStatus;
import com.buildsight.platform.periodcontrol.domain.PeriodControlRiskLevel;
import com.buildsight.platform.periodcontrol.domain.ProgressPeriodStatus;
import com.buildsight.platform.project.api.ProjectResponse;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public final class PeriodControlModels {

    private PeriodControlModels() {
    }

    public record CaptureBaselineRequest(
            @NotBlank
            @Size(max = 64)
            String versionCode,

            @NotBlank
            @Size(max = 220)
            String title,

            String reason,

            @Size(max = 120)
            String changeReference) {
    }

    public record CreateProgressPeriodRequest(
            @NotBlank
            @Size(max = 64)
            String periodCode,

            @NotBlank
            @Size(max = 220)
            String title,

            @NotNull
            LocalDate startDate,

            @NotNull
            LocalDate endDate) {
    }

    public record ControlBaselineResponse(
            UUID id,
            UUID projectId,

            String versionCode,
            String title,

            String reason,
            String changeReference,

            ControlBaselineStatus status,

            LocalDate sourceDataDate,

            BigDecimal budgetAtCompletion,

            BigDecimal costTarget,

            LocalDate finishTarget,

            BigDecimal capturedPredictiveScore,

            Instant approvedAt,
            Instant supersededAt,

            long version,

            Instant createdAt,
            Instant updatedAt) {
    }

    public record ProgressPeriodResponse(
            UUID id,
            UUID projectId,
            UUID baselineVersionId,

            String baselineVersionCode,

            String periodCode,
            String title,

            LocalDate startDate,
            LocalDate endDate,

            ProgressPeriodStatus status,

            Instant closedAt,

            long version,

            Instant createdAt,
            Instant updatedAt) {
    }

    public record PeriodEndReadinessResponse(
            UUID periodId,
            String periodCode,

            LocalDate periodEndDate,
            LocalDate currentDate,
            LocalDate forecastDataDate,

            boolean canClose,

            List<String> blockers,
            List<String> warnings) {
    }

    public record PeriodEndSnapshotResponse(
            UUID id,
            UUID projectId,
            UUID periodId,
            UUID baselineVersionId,

            String periodCode,

            LocalDate periodStartDate,
            LocalDate periodEndDate,

            LocalDate sourceDataDate,

            BigDecimal baselineCostTarget,
            LocalDate baselineFinishTarget,

            BigDecimal budgetAtCompletion,
            BigDecimal plannedValue,
            BigDecimal earnedValue,
            BigDecimal actualCost,

            BigDecimal expectedForecastCost,
            LocalDate expectedForecastFinishDate,

            BigDecimal plannedProgressPercentage,
            BigDecimal earnedProgressPercentage,

            BigDecimal costPerformanceIndex,
            BigDecimal schedulePerformanceIndex,

            BigDecimal costVarianceToBaseline,
            long finishVarianceDays,

            BigDecimal predictiveScore,
            String predictiveRisk,

            BigDecimal governanceScore,
            String governanceRisk,

            BigDecimal recoveryScore,
            String recoveryRisk,

            BigDecimal changeCostExposure,
            long recoveryResidualDelayDays,

            long openActions,
            long overdueActions,
            long criticalOpenActions,
            long blockedActions,

            BigDecimal periodControlScore,
            PeriodControlRiskLevel periodControlRisk,

            Instant closedAt,
            Instant createdAt) {
    }

    public record PeriodControlIntelligenceResponse(
            LocalDate dataDate,

            long baselineVersionCount,

            String activeBaselineVersionCode,
            BigDecimal baselineCostTarget,
            LocalDate baselineFinishTarget,

            long openPeriodCount,
            String openPeriodCode,
            LocalDate openPeriodEndDate,

            long closedPeriodCount,
            String latestClosedPeriodCode,

            BigDecimal currentExpectedForecastCost,
            LocalDate currentExpectedForecastFinishDate,

            BigDecimal costVarianceToBaseline,
            long finishVarianceDays,

            double plannedProgressPercentage,
            double earnedProgressPercentage,

            BigDecimal costPerformanceIndex,
            BigDecimal schedulePerformanceIndex,

            double predictiveScore,
            String predictiveRisk,

            double governanceScore,
            String governanceRisk,

            double recoveryScore,
            String recoveryRisk,

            double periodControlScore,
            PeriodControlRiskLevel periodControlRisk,

            String explanation) {

        public static PeriodControlIntelligenceResponse noBaseline(
                ForecastIntelligenceResponse forecast) {

            return new PeriodControlIntelligenceResponse(
                    forecast.dataDate(),

                    0,

                    null,
                    null,
                    null,

                    0,
                    null,
                    null,

                    0,
                    null,

                    forecast.expectedForecastCost(),
                    forecast.expectedForecastFinishDate(),

                    BigDecimal.ZERO,
                    0,

                    0,
                    0,

                    forecast.cpi(),
                    forecast.spi(),

                    forecast.predictiveScore(),
                    forecast.predictiveRisk()
                            .name(),

                    75,
                    "WATCH",

                    75,
                    "WATCH",

                    75,
                    PeriodControlRiskLevel.WATCH,

                    "No approved control baseline exists. Capture and approve a control baseline before period-end variance can be measured.");
        }
    }

    public record PeriodControlResponse(
            ProjectResponse project,

            ForecastIntelligenceResponse forecast,

            PeriodControlIntelligenceResponse intelligence,

            List<ControlBaselineResponse> baselines,

            List<ProgressPeriodResponse> periods,

            PeriodEndReadinessResponse openPeriodReadiness,

            List<PeriodEndSnapshotResponse> snapshots) {
    }

    public record PortfolioPeriodControlProjectResponse(
            UUID projectId,
            String projectCode,
            String projectName,

            String activeBaselineVersionCode,

            String openPeriodCode,
            String latestClosedPeriodCode,

            BigDecimal baselineCostTarget,
            BigDecimal currentExpectedForecastCost,

            BigDecimal costVarianceToBaseline,
            long finishVarianceDays,

            double plannedProgressPercentage,
            double earnedProgressPercentage,

            BigDecimal costPerformanceIndex,
            BigDecimal schedulePerformanceIndex,

            double periodControlScore,
            PeriodControlRiskLevel periodControlRisk) {
    }

    public record PortfolioPeriodControlResponse(
            LocalDate dataDate,

            long projectCount,
            long projectsWithApprovedBaseline,
            long projectsWithOpenPeriod,

            long onTrackProjects,
            long watchProjects,
            long atRiskProjects,

            BigDecimal totalCostVarianceToBaseline,

            long totalFinishVarianceDays,

            double averagePeriodControlScore,

            List<PortfolioPeriodControlProjectResponse> projects) {
    }
}
