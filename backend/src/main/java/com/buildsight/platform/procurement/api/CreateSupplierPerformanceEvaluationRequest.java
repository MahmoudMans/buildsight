package com.buildsight.platform.procurement.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateSupplierPerformanceEvaluationRequest(

        @NotNull
        UUID supplierId,

        UUID procurementPackageId,

        @NotNull
        LocalDate evaluationDate,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal qualityScore,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal deliveryScore,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal safetyScore,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal commercialScore,

        @Size(max = 1500)
        String comments) {
}
