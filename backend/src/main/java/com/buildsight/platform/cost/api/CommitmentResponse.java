package com.buildsight.platform.cost.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.cost.domain.CommitmentStatus;

public record CommitmentResponse(
        UUID id,
        UUID projectId,
        UUID costCodeId,
        String costCode,
        String costCodeName,
        String reference,
        String vendorName,
        String description,
        BigDecimal committedAmount,
        CommitmentStatus status,
        LocalDate commitmentDate,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
