package com.buildsight.platform.recovery.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.project.api.ProjectResponse;
import com.buildsight.platform.recovery.domain.ChangeSimulationStatus;
import com.buildsight.platform.recovery.domain.RecoveryOptionStatus;
import com.buildsight.platform.recovery.domain.RecoveryRiskLevel;
import com.buildsight.platform.recovery.domain.RecoveryStrategyType;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public final class RecoveryModels {

    private RecoveryModels() {
    }

    public record CreateChangeSimulationRequest(
            @NotBlank
            @Size(max = 64)
            String simulationNumber,

            @NotBlank
            @Size(max = 220)
            String title,

            @NotBlank
            @Size(max = 120)
            String sourceChangeReference,

            String description,

            @NotNull
            BigDecimal directCostImpact,

            @Min(0)
            @Max(730)
            int delayDays,

            @NotNull
            @DecimalMin("-50.000")
            @DecimalMax("50.000")
            BigDecimal productivityChangePercentage,

            @Min(0)
            @Max(730)
            int procurementDelayDays,

            @NotNull
            @DecimalMin("-50.000")
            @DecimalMax("50.000")
            BigDecimal resourceCapacityChangePercentage,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("50.000")
            BigDecimal riskContingencyPercentage,

            String notes) {
    }

    public record UpdateChangeSimulationRequest(
            @PositiveOrZero
            long version,

            @NotBlank
            @Size(max = 220)
            String title,

            @NotBlank
            @Size(max = 120)
            String sourceChangeReference,

            String description,

            @NotNull
            BigDecimal directCostImpact,

            @Min(0)
            @Max(730)
            int delayDays,

            @NotNull
            @DecimalMin("-50.000")
            @DecimalMax("50.000")
            BigDecimal productivityChangePercentage,

            @Min(0)
            @Max(730)
            int procurementDelayDays,

            @NotNull
            @DecimalMin("-50.000")
            @DecimalMax("50.000")
            BigDecimal resourceCapacityChangePercentage,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("50.000")
            BigDecimal riskContingencyPercentage,

            String notes) {
    }

    public record CreateRecoveryOptionRequest(
            @NotBlank
            @Size(max = 64)
            String optionNumber,

            @NotBlank
            @Size(max = 220)
            String name,

            @NotNull
            RecoveryStrategyType strategyType,

            @Min(0)
            @Max(730)
            int scheduleRecoveryDays,

            @NotNull
            @PositiveOrZero
            BigDecimal incrementalCost,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("50.000")
            BigDecimal productivityImprovementPercentage,

            @Min(0)
            @Max(730)
            int procurementRecoveryDays,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("50.000")
            BigDecimal resourceCapacityImprovementPercentage,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("100.000")
            BigDecimal residualRiskPercentage,

            String notes) {
    }

    public record UpdateRecoveryOptionRequest(
            @PositiveOrZero
            long version,

            @NotBlank
            @Size(max = 220)
            String name,

            @NotNull
            RecoveryStrategyType strategyType,

            @Min(0)
            @Max(730)
            int scheduleRecoveryDays,

            @NotNull
            @PositiveOrZero
            BigDecimal incrementalCost,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("50.000")
            BigDecimal productivityImprovementPercentage,

            @Min(0)
            @Max(730)
            int procurementRecoveryDays,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("50.000")
            BigDecimal resourceCapacityImprovementPercentage,

            @NotNull
            @DecimalMin("0.000")
            @DecimalMax("100.000")
            BigDecimal residualRiskPercentage,

            String notes) {
    }

    public record ChangeImpactEvaluationResponse(
            BigDecimal baselineForecastCost,

            BigDecimal directCostImpact,
            BigDecimal productivityCostImpact,
            BigDecimal resourceCostImpact,
            BigDecimal extensionCostImpact,
            BigDecimal contingencyCostImpact,

            BigDecimal totalChangeCostExposure,

            BigDecimal impactedForecastCost,

            LocalDate baselineForecastFinishDate,
            LocalDate impactedForecastFinishDate,

            long scheduleImpactDays,

            double impactScore,
            RecoveryRiskLevel impactRisk) {
    }

    public record RecoveryOptionEvaluationResponse(
            BigDecimal recoveredForecastCost,

            BigDecimal recoveryCostVsImpacted,

            LocalDate recoveredForecastFinishDate,

            long recoverableDays,
            long residualDelayDays,

            BigDecimal costPerDayRecovered,

            double recoveryScore,
            RecoveryRiskLevel recoveryRisk) {
    }

    public record RecoveryOptionResponse(
            UUID id,
            UUID projectId,
            UUID simulationId,

            String optionNumber,
            String name,

            RecoveryStrategyType strategyType,
            RecoveryOptionStatus status,

            int scheduleRecoveryDays,
            BigDecimal incrementalCost,
            BigDecimal productivityImprovementPercentage,
            int procurementRecoveryDays,
            BigDecimal resourceCapacityImprovementPercentage,
            BigDecimal residualRiskPercentage,

            String notes,

            boolean recommended,

            Instant selectedAt,

            long version,

            Instant createdAt,
            Instant updatedAt,

            RecoveryOptionEvaluationResponse evaluation) {
    }

    public record ChangeSimulationResponse(
            UUID id,
            UUID projectId,

            String simulationNumber,
            String title,
            String sourceChangeReference,
            String description,

            ChangeSimulationStatus status,

            BigDecimal directCostImpact,
            int delayDays,
            BigDecimal productivityChangePercentage,
            int procurementDelayDays,
            BigDecimal resourceCapacityChangePercentage,
            BigDecimal riskContingencyPercentage,

            String notes,

            Instant approvedAt,

            long version,

            Instant createdAt,
            Instant updatedAt,

            ChangeImpactEvaluationResponse impact,

            List<RecoveryOptionResponse> options) {
    }

    public record RecoveryPlanSnapshotResponse(
            UUID id,
            UUID projectId,
            UUID simulationId,
            UUID recoveryOptionId,

            Instant selectedAt,

            BigDecimal baselineForecastCost,
            BigDecimal impactedForecastCost,
            BigDecimal recoveredForecastCost,

            LocalDate baselineForecastFinishDate,
            LocalDate impactedForecastFinishDate,
            LocalDate recoveredForecastFinishDate,

            BigDecimal changeCostExposure,
            BigDecimal recoveryCost,

            long impactDelayDays,
            long recoveredDays,
            long residualDelayDays,

            BigDecimal costPerDayRecovered,

            BigDecimal recoveryScore,
            RecoveryRiskLevel recoveryRisk,

            Instant createdAt) {
    }

    public record ChangeImpactIntelligenceResponse(
            LocalDate dataDate,

            long simulationCount,

            String activeSimulationNumber,
            String activeSimulationTitle,
            String simulationStatus,

            BigDecimal baselineForecastCost,
            BigDecimal impactedForecastCost,
            BigDecimal changeCostExposure,

            LocalDate baselineForecastFinishDate,
            LocalDate impactedForecastFinishDate,

            long scheduleImpactDays,

            String recommendedRecoveryOptionNumber,
            String recommendedRecoveryOptionName,

            BigDecimal recoveryCost,

            long recoverableDays,
            long residualDelayDays,

            BigDecimal recoveredForecastCost,
            LocalDate recoveredForecastFinishDate,

            BigDecimal costPerDayRecovered,

            double recoveryScore,
            RecoveryRiskLevel recoveryRisk,

            String explanation) {

        public static ChangeImpactIntelligenceResponse noData(
                ForecastIntelligenceResponse forecast) {

            return new ChangeImpactIntelligenceResponse(
                    forecast.dataDate(),

                    0,

                    null,
                    null,
                    null,

                    forecast.expectedForecastCost(),
                    forecast.expectedForecastCost(),
                    BigDecimal.ZERO,

                    forecast.expectedForecastFinishDate(),
                    forecast.expectedForecastFinishDate(),

                    0,

                    null,
                    null,

                    BigDecimal.ZERO,

                    0,
                    0,

                    forecast.expectedForecastCost(),
                    forecast.expectedForecastFinishDate(),

                    BigDecimal.ZERO,

                    75,
                    RecoveryRiskLevel.WATCH,

                    "No active change-impact simulation exists. BuildSight preserves the live predictive forecast and applies a neutral recovery-planning score.");
        }
    }

    public record ChangeImpactControlResponse(
            ProjectResponse project,

            ForecastIntelligenceResponse baselineForecast,

            ChangeImpactIntelligenceResponse intelligence,

            List<ChangeSimulationResponse> simulations,

            List<RecoveryPlanSnapshotResponse> selectedPlanHistory) {
    }

    public record PortfolioRecoveryProjectResponse(
            UUID projectId,
            String projectCode,
            String projectName,

            long simulationCount,

            String activeSimulationNumber,

            BigDecimal changeCostExposure,

            long scheduleImpactDays,

            String recommendedRecoveryOptionNumber,

            BigDecimal recoveryCost,

            long recoverableDays,
            long residualDelayDays,

            double recoveryScore,
            RecoveryRiskLevel recoveryRisk) {
    }

    public record PortfolioRecoveryResponse(
            LocalDate dataDate,

            long projectCount,
            long projectsWithActiveSimulations,

            long onTrackProjects,
            long watchProjects,
            long atRiskProjects,

            BigDecimal totalChangeCostExposure,

            long totalScheduleImpactDays,

            BigDecimal totalRecoveryCost,

            long totalRecoverableDays,
            long totalResidualDelayDays,

            double averageRecoveryScore,

            List<PortfolioRecoveryProjectResponse> projects) {
    }
}
