package com.buildsight.platform.production.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.production.domain.WorkPackageStatus;

public record WorkPackageResponse(
        UUID id,
        UUID projectId,
        String code,
        String name,
        String description,
        String unit,
        BigDecimal plannedQuantity,
        BigDecimal plannedLaborHours,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        LocalDate actualStartDate,
        LocalDate actualEndDate,
        WorkPackageStatus status,
        String blockReason,
        BigDecimal actualQuantity,
        double completionPercentage,
        double expectedProgressPercentage,
        BigDecimal expectedQuantity,
        BigDecimal quantityVariance,
        BigDecimal actualLaborHours,
        BigDecimal actualEquipmentHours,
        double plannedProductivityRate,
        double actualProductivityRate,
        double productivityIndex,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
