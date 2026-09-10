package com.buildsight.platform.procurement.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record SupplierPerformanceEvaluationResponse(
        UUID id,
        UUID projectId,
        UUID supplierId,
        String supplierName,
        UUID procurementPackageId,
        String packageReference,
        LocalDate evaluationDate,
        BigDecimal qualityScore,
        BigDecimal deliveryScore,
        BigDecimal safetyScore,
        BigDecimal commercialScore,
        double overallScore,
        String comments,
        Instant createdAt) {
}
