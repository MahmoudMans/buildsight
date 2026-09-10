package com.buildsight.platform.procurement.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record AwardProcurementPackageRequest(

        @PositiveOrZero
        long version,

        @NotNull
        UUID selectedBidId,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal awardedValue,

        @NotNull
        LocalDate awardDate) {
}
