package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateCommercialChangeOrderRequest(

        @NotBlank
        @Size(max = 64)
        String reference,

        @Size(max = 64)
        String sourceChangeReference,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotBlank
        String description,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal submittedAmount) {
}
