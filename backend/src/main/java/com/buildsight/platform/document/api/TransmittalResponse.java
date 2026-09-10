package com.buildsight.platform.document.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.document.domain.TransmittalStatus;

public record TransmittalResponse(
        UUID id,
        UUID projectId,
        String reference,
        String recipient,
        String purpose,
        LocalDate transmittalDate,
        LocalDate issuedDate,
        String notes,
        TransmittalStatus status,
        List<UUID> revisionIds,
        List<String> revisionReferences,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
