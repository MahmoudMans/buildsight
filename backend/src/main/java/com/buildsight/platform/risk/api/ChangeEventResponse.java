package com.buildsight.platform.risk.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.risk.domain.ChangeEventStatus;

public record ChangeEventResponse(
        UUID id,
        UUID projectId,
        String reference,
        String title,
        String description,
        String originator,
        LocalDate requestedDate,
        LocalDate decisionDate,
        BigDecimal costImpact,
        int scheduleImpactDays,
        ChangeEventStatus status,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
