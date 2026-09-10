package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.buildsight.platform.commercial.domain.CommercialChangeOrderStatus;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateCommercialChangeOrderRequest(

        @PositiveOrZero
        long version,

        @Size(max = 64)
        String sourceChangeReference,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotBlank
        String description,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal submittedAmount,

        @DecimalMin("0.00")
        BigDecimal assessedAmount,

        @DecimalMin("0.00")
        BigDecimal approvedAmount,

        LocalDate submittedDate,

        LocalDate decisionDueDate,

        @NotNull
        CommercialChangeOrderStatus status) {
}
