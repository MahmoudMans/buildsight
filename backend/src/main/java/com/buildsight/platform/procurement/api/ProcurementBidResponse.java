package com.buildsight.platform.procurement.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.procurement.domain.ProcurementBidStatus;
import com.buildsight.platform.procurement.domain.SupplierQualificationStatus;

public record ProcurementBidResponse(
        UUID id,
        UUID procurementPackageId,
        String packageReference,
        UUID supplierId,
        String supplierCode,
        String supplierName,
        SupplierQualificationStatus supplierQualificationStatus,
        BigDecimal bidAmount,
        LocalDate submittedDate,
        BigDecimal technicalScore,
        BigDecimal commercialScore,
        double combinedScore,
        int deliveryDays,
        ProcurementBidStatus status,
        String notes,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
