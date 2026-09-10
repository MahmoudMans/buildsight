package com.buildsight.platform.procurement.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record CreateProcurementBidRequest(

        @NotNull
        UUID supplierId,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal bidAmount,

        @NotNull
        LocalDate submittedDate,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal technicalScore,

        @NotNull
        @DecimalMin("0.00")
        @DecimalMax("100.00")
        BigDecimal commercialScore,

        @PositiveOrZero
        int deliveryDays,

        @Size(max = 1200)
        String notes) {
}
