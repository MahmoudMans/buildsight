package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreatePaymentCertificateRequest(

        @NotBlank
        @Size(max = 64)
        String reference,

        @NotNull
        LocalDate periodStart,

        @NotNull
        LocalDate periodEnd,

        @NotNull
        LocalDate applicationDate,

        @NotNull
        LocalDate certificationDueDate,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal applicationAmount) {
}
