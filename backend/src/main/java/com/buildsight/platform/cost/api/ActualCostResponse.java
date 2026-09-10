package com.buildsight.platform.cost.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ActualCostResponse(
        UUID id,
        UUID projectId,
        UUID costCodeId,
        String costCode,
        String costCodeName,
        UUID commitmentId,
        String commitmentReference,
        String reference,
        String supplierName,
        String description,
        BigDecimal amount,
        LocalDate costDate,
        Instant createdAt) {
}
