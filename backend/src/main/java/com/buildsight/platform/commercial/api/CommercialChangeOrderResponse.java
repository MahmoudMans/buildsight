package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.commercial.domain.CommercialChangeOrderStatus;

public record CommercialChangeOrderResponse(
        UUID id,
        UUID projectId,
        String reference,
        String sourceChangeReference,
        String title,
        String description,
        BigDecimal submittedAmount,
        BigDecimal assessedAmount,
        BigDecimal approvedAmount,
        LocalDate submittedDate,
        LocalDate decisionDueDate,
        LocalDate decisionDate,
        CommercialChangeOrderStatus status,
        boolean overdueDecision,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
