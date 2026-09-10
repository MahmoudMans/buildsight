package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.buildsight.platform.commercial.domain.PaymentCertificateStatus;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record UpdatePaymentCertificateRequest(

        @PositiveOrZero
        long version,

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
        BigDecimal applicationAmount,

        @DecimalMin("0.00")
        BigDecimal certifiedAmount,

        @DecimalMin("0.00")
        BigDecimal retentionAmount,

        LocalDate certifiedDate,

        LocalDate paymentDueDate,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal amountPaid,

        LocalDate lastPaymentDate,

        @NotNull
        PaymentCertificateStatus status) {
}
