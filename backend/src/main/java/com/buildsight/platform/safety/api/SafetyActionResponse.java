package com.buildsight.platform.safety.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.safety.domain.SafetyActionStatus;

public record SafetyActionResponse(
        UUID id,
        UUID projectId,
        UUID incidentId,
        String incidentReference,
        UUID observationId,
        String observationReference,
        String reference,
        String title,
        String actionDescription,
        String ownerName,
        LocalDate dueDate,
        SafetyActionStatus status,
        String verificationNotes,
        LocalDate closedDate,
        boolean overdue,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
