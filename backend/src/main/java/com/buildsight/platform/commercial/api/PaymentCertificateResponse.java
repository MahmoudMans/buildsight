package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.commercial.domain.PaymentCertificateStatus;

public record PaymentCertificateResponse(
        UUID id,
        UUID projectId,
        String reference,
        LocalDate periodStart,
        LocalDate periodEnd,
        LocalDate applicationDate,
        LocalDate certificationDueDate,
        BigDecimal applicationAmount,
        BigDecimal certifiedAmount,
        BigDecimal retentionAmount,
        BigDecimal netCertifiedAmount,
        LocalDate certifiedDate,
        LocalDate paymentDueDate,
        BigDecimal amountPaid,
        BigDecimal outstandingAmount,
        LocalDate lastPaymentDate,
        PaymentCertificateStatus status,
        boolean overdueCertification,
        boolean overduePayment,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
