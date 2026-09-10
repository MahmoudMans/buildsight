package com.buildsight.platform.production.api;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateProductionEntryRequest(

        @PositiveOrZero
        long version,

        @NotNull
        @DecimalMin("0.000")
        BigDecimal quantityCompleted,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal laborHours,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal equipmentHours,

        @PositiveOrZero
        int crewSize,

        @Size(max = 1500)
        String notes) {
}
