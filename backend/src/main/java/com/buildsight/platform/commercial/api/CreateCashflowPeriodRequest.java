package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record CreateCashflowPeriodRequest(

        @NotNull
        LocalDate periodStart,

        @NotNull
        LocalDate periodEnd,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal plannedInflow,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal forecastInflow,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal actualInflow,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal plannedOutflow,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal forecastOutflow,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal actualOutflow) {
}
