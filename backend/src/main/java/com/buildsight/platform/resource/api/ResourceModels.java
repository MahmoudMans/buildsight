package com.buildsight.platform.resource.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.project.api.ProjectResponse;
import com.buildsight.platform.resource.domain.EquipmentOwnership;
import com.buildsight.platform.resource.domain.EquipmentStatus;
import com.buildsight.platform.resource.domain.ResourceDemandType;
import com.buildsight.platform.resource.domain.ResourceForecastStatus;
import com.buildsight.platform.resource.domain.WorkforcePlanStatus;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public final class ResourceModels {

    private ResourceModels() {
    }

    public record CreateWorkforcePlanRequest(
            @NotNull
            LocalDate periodStart,

            @NotNull
            LocalDate periodEnd,

            @NotBlank
            @Size(max = 100)
            String trade,

            UUID workPackageId,

            @Min(0)
            int plannedWorkers,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal plannedRegularHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal plannedProductiveHours,

            @DecimalMin("0.00")
            BigDecimal plannedProductivityRate) {
    }

    public record UpdateWorkforcePlanRequest(
            @PositiveOrZero
            long version,

            @NotNull
            LocalDate periodStart,

            @NotNull
            LocalDate periodEnd,

            @NotBlank
            @Size(max = 100)
            String trade,

            UUID workPackageId,

            @Min(0)
            int plannedWorkers,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal plannedRegularHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal plannedProductiveHours,

            @DecimalMin("0.00")
            BigDecimal plannedProductivityRate,

            @NotNull
            WorkforcePlanStatus status) {
    }

    public record WorkforcePlanResponse(
            UUID id,
            UUID projectId,
            LocalDate periodStart,
            LocalDate periodEnd,
            String trade,
            UUID workPackageId,
            int plannedWorkers,
            BigDecimal plannedRegularHours,
            BigDecimal plannedProductiveHours,
            BigDecimal plannedProductivityRate,
            WorkforcePlanStatus status,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CreateWorkforceDeploymentRequest(
            @NotNull
            LocalDate workDate,

            @NotBlank
            @Size(max = 100)
            String trade,

            UUID workPackageId,

            @Min(0)
            int workers,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal regularHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal overtimeHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal productiveHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal quantityCompleted,

            @DecimalMin("0.00")
            BigDecimal plannedProductivityRate,

            @Size(max = 2500)
            String notes) {
    }

    public record UpdateWorkforceDeploymentRequest(
            @PositiveOrZero
            long version,

            @NotNull
            LocalDate workDate,

            @NotBlank
            @Size(max = 100)
            String trade,

            UUID workPackageId,

            @Min(0)
            int workers,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal regularHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal overtimeHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal productiveHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal quantityCompleted,

            @DecimalMin("0.00")
            BigDecimal plannedProductivityRate,

            @Size(max = 2500)
            String notes) {
    }

    public record WorkforceDeploymentResponse(
            UUID id,
            UUID projectId,
            LocalDate workDate,
            String trade,
            UUID workPackageId,
            int workers,
            BigDecimal regularHours,
            BigDecimal overtimeHours,
            BigDecimal totalLaborHours,
            BigDecimal productiveHours,
            BigDecimal quantityCompleted,
            BigDecimal plannedProductivityRate,
            BigDecimal actualProductivityRate,
            BigDecimal productivityIndex,
            String notes,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CreateEquipmentRequest(
            @NotBlank
            @Size(max = 64)
            String code,

            @NotBlank
            @Size(max = 220)
            String description,

            @NotBlank
            @Size(max = 100)
            String category,

            @NotNull
            EquipmentOwnership ownership,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal dailyCost) {
    }

    public record UpdateEquipmentRequest(
            @PositiveOrZero
            long version,

            @NotBlank
            @Size(max = 220)
            String description,

            @NotBlank
            @Size(max = 100)
            String category,

            @NotNull
            EquipmentOwnership ownership,

            @NotNull
            EquipmentStatus status,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal dailyCost) {
    }

    public record EquipmentResponse(
            UUID id,
            UUID projectId,
            String code,
            String description,
            String category,
            EquipmentOwnership ownership,
            EquipmentStatus status,
            BigDecimal dailyCost,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CreateEquipmentUsageRequest(
            @NotNull
            UUID equipmentId,

            UUID workPackageId,

            @NotNull
            LocalDate workDate,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal availableHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal operatingHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal idleHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal downtimeHours,

            @Size(max = 2500)
            String notes) {
    }

    public record UpdateEquipmentUsageRequest(
            @PositiveOrZero
            long version,

            UUID workPackageId,

            @NotNull
            LocalDate workDate,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal availableHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal operatingHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal idleHours,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal downtimeHours,

            @Size(max = 2500)
            String notes) {
    }

    public record EquipmentUsageResponse(
            UUID id,
            UUID projectId,
            UUID equipmentId,
            String equipmentCode,
            UUID workPackageId,
            LocalDate workDate,
            BigDecimal availableHours,
            BigDecimal operatingHours,
            BigDecimal idleHours,
            BigDecimal downtimeHours,
            double utilizationPercentage,
            String notes,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CreateResourceForecastRequest(
            @NotNull
            LocalDate periodStart,

            @NotNull
            LocalDate periodEnd,

            @NotNull
            ResourceDemandType resourceType,

            @NotBlank
            @Size(max = 120)
            String resourceKey,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal requiredQuantity,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal availableQuantity,

            @Size(max = 2000)
            String notes) {
    }

    public record UpdateResourceForecastRequest(
            @PositiveOrZero
            long version,

            @NotNull
            LocalDate periodStart,

            @NotNull
            LocalDate periodEnd,

            @NotNull
            ResourceDemandType resourceType,

            @NotBlank
            @Size(max = 120)
            String resourceKey,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal requiredQuantity,

            @NotNull
            @DecimalMin("0.00")
            BigDecimal availableQuantity,

            @Size(max = 2000)
            String notes,

            @NotNull
            ResourceForecastStatus status) {
    }

    public record ResourceForecastResponse(
            UUID id,
            UUID projectId,
            LocalDate periodStart,
            LocalDate periodEnd,
            ResourceDemandType resourceType,
            String resourceKey,
            BigDecimal requiredQuantity,
            BigDecimal availableQuantity,
            BigDecimal shortage,
            String notes,
            ResourceForecastStatus status,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ResourceIntelligenceResponse(
            long workforcePlans,
            long workforceDeployments,
            BigDecimal plannedLaborHours,
            BigDecimal actualLaborHours,
            BigDecimal productiveLaborHours,
            BigDecimal overtimeHours,
            double overtimePercentage,
            double laborUtilizationPercentage,
            double averageProductivityIndex,
            long lowProductivityWorkPackages,
            long equipmentCount,
            long idleEquipment,
            BigDecimal equipmentAvailableHours,
            BigDecimal equipmentOperatingHours,
            BigDecimal equipmentDowntimeHours,
            double equipmentUtilizationPercentage,
            long openResourceForecasts,
            double workerDemandGap,
            double equipmentDemandGap,
            double resourceScore,
            ResourceRiskLevel resourceRisk,
            String explanation) {
    }

    public record ResourceControlResponse(
            ProjectResponse project,
            ResourceIntelligenceResponse intelligence,
            List<WorkforcePlanResponse> workforcePlans,
            List<WorkforceDeploymentResponse> deployments,
            List<EquipmentResponse> equipment,
            List<EquipmentUsageResponse> equipmentUsage,
            List<ResourceForecastResponse> forecasts) {
    }
}
