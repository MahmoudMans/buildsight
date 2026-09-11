package com.buildsight.platform.forecast.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.forecast.domain.ForecastRiskLevel;
import com.buildsight.platform.forecast.domain.ForecastScenarioStatus;
import com.buildsight.platform.forecast.domain.ForecastScenarioType;
import com.buildsight.platform.forecast.domain.ForecastTrend;
import com.buildsight.platform.project.api.ProjectResponse;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public final class ForecastModels {

    private ForecastModels() {
    }

    public record ForecastIntelligenceResponse(
            LocalDate dataDate,

            BigDecimal bac,
            BigDecimal plannedValue,
            BigDecimal earnedValue,
            BigDecimal actualCost,

            BigDecimal costVariance,
            BigDecimal scheduleVariance,

            BigDecimal cpi,
            BigDecimal spi,

            BigDecimal estimateAtCompletion,
            BigDecimal estimateToComplete,
            BigDecimal varianceAtCompletion,
            BigDecimal tcpi,

            double plannedProgressPercentage,
            double earnedProgressPercentage,

            BigDecimal costForecastLower,
            BigDecimal expectedForecastCost,
            BigDecimal costForecastUpper,

            LocalDate earliestForecastFinishDate,
            LocalDate expectedForecastFinishDate,
            LocalDate latestForecastFinishDate,

            long scheduleVarianceDays,

            double predictiveScore,
            ForecastRiskLevel predictiveRisk,
            ForecastTrend trend,

            long snapshotCount,
            LocalDate latestSnapshotDate,

            String explanation) {
    }

    public record CreateForecastScenarioRequest(
            @NotBlank
            @Size(max = 180)
            String name,

            @NotNull
            ForecastScenarioType scenarioType,

            @NotNull
            @DecimalMin("-30.000")
            @DecimalMax("100.000")
            BigDecimal costAdjustmentPercentage,

            @Min(-60)
            @Max(365)
            int scheduleAdjustmentDays,

            @NotNull
            @DecimalMin("0.5000")
            @DecimalMax("1.5000")
            BigDecimal productivityMultiplier,

            @Min(0)
            @Max(365)
            int procurementDelayDays,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("50.000")
            BigDecimal commercialExposurePercentage,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("50.000")
            BigDecimal riskContingencyPercentage,

            @NotNull
            @DecimalMin("0.5000")
            @DecimalMax("1.5000")
            BigDecimal resourceCapacityMultiplier,

            String notes) {
    }

    public record UpdateForecastScenarioRequest(
            @PositiveOrZero
            long version,

            @NotBlank
            @Size(max = 180)
            String name,

            @NotNull
            ForecastScenarioType scenarioType,

            @NotNull
            @DecimalMin("-30.000")
            @DecimalMax("100.000")
            BigDecimal costAdjustmentPercentage,

            @Min(-60)
            @Max(365)
            int scheduleAdjustmentDays,

            @NotNull
            @DecimalMin("0.5000")
            @DecimalMax("1.5000")
            BigDecimal productivityMultiplier,

            @Min(0)
            @Max(365)
            int procurementDelayDays,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("50.000")
            BigDecimal commercialExposurePercentage,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("50.000")
            BigDecimal riskContingencyPercentage,

            @NotNull
            @DecimalMin("0.5000")
            @DecimalMax("1.5000")
            BigDecimal resourceCapacityMultiplier,

            String notes) {
    }

    public record ForecastScenarioEvaluationResponse(
            BigDecimal expectedCost,
            BigDecimal lowerCost,
            BigDecimal upperCost,

            BigDecimal costImpactVsCurrent,

            LocalDate expectedFinishDate,
            LocalDate earliestFinishDate,
            LocalDate latestFinishDate,

            long finishImpactDays,

            double scenarioScore,
            ForecastRiskLevel scenarioRisk) {
    }

    public record ForecastScenarioResponse(
            UUID id,
            UUID projectId,

            String name,
            ForecastScenarioType scenarioType,
            ForecastScenarioStatus status,

            BigDecimal costAdjustmentPercentage,
            int scheduleAdjustmentDays,
            BigDecimal productivityMultiplier,
            int procurementDelayDays,
            BigDecimal commercialExposurePercentage,
            BigDecimal riskContingencyPercentage,
            BigDecimal resourceCapacityMultiplier,

            String notes,

            Instant approvedAt,
            long version,
            Instant createdAt,
            Instant updatedAt,

            ForecastScenarioEvaluationResponse evaluation) {
    }

    public record EvmSnapshotResponse(
            UUID id,
            UUID projectId,
            LocalDate dataDate,

            BigDecimal bac,
            BigDecimal plannedValue,
            BigDecimal earnedValue,
            BigDecimal actualCost,

            BigDecimal costVariance,
            BigDecimal scheduleVariance,

            BigDecimal cpi,
            BigDecimal spi,

            BigDecimal estimateAtCompletion,
            BigDecimal estimateToComplete,
            BigDecimal varianceAtCompletion,
            BigDecimal tcpi,

            LocalDate forecastFinishDate,
            long scheduleVarianceDays,

            BigDecimal predictiveScore,
            ForecastRiskLevel predictiveRisk,

            Instant createdAt) {
    }

    public record ForecastControlResponse(
            ProjectResponse project,
            ForecastIntelligenceResponse intelligence,
            List<ForecastScenarioResponse> scenarios,
            List<EvmSnapshotResponse> history) {
    }

    public record PortfolioForecastProjectResponse(
            UUID projectId,
            String projectCode,
            String projectName,

            BigDecimal bac,
            BigDecimal plannedValue,
            BigDecimal earnedValue,
            BigDecimal actualCost,
            BigDecimal expectedForecastCost,
            BigDecimal varianceAtCompletion,

            BigDecimal cpi,
            BigDecimal spi,

            LocalDate expectedForecastFinishDate,
            long scheduleVarianceDays,

            double predictiveScore,
            ForecastRiskLevel predictiveRisk,
            ForecastTrend trend) {
    }

    public record PortfolioForecastResponse(
            LocalDate dataDate,

            long projectCount,
            long onTrackProjects,
            long watchProjects,
            long atRiskProjects,
            long deterioratingProjects,

            BigDecimal portfolioBac,
            BigDecimal portfolioPlannedValue,
            BigDecimal portfolioEarnedValue,
            BigDecimal portfolioActualCost,
            BigDecimal portfolioExpectedForecastCost,
            BigDecimal portfolioVarianceAtCompletion,

            BigDecimal weightedCpi,
            BigDecimal weightedSpi,

            List<PortfolioForecastProjectResponse> projects) {
    }
}
