package com.buildsight.platform.procurement.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.procurement.domain.ProcurementPackageStatus;

public record ProcurementPackageResponse(
        UUID id,
        UUID projectId,
        UUID costCodeId,
        String costCode,
        String costCodeName,
        String reference,
        String title,
        String description,
        BigDecimal estimatedValue,
        LocalDate plannedIssueDate,
        LocalDate actualIssueDate,
        LocalDate bidDueDate,
        LocalDate awardDueDate,
        LocalDate forecastAwardDate,
        LocalDate requiredOnSiteDate,
        ProcurementPackageStatus status,
        UUID awardedSupplierId,
        String awardedSupplierName,
        BigDecimal awardedValue,
        LocalDate awardDate,
        UUID commitmentId,
        String commitmentReference,
        long bidCount,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
