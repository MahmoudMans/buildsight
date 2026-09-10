package com.buildsight.platform.safety.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.safety.domain.WorkPermitStatus;
import com.buildsight.platform.safety.domain.WorkPermitType;

public record WorkPermitResponse(
        UUID id,
        UUID projectId,
        String reference,
        WorkPermitType permitType,
        String title,
        String location,
        String issuerName,
        String receiverName,
        LocalDate validFrom,
        LocalDate validUntil,
        String controls,
        WorkPermitStatus status,
        LocalDate closedDate,
        boolean expired,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
