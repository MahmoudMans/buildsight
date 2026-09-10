package com.buildsight.platform.quality.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.quality.domain.NcrCategory;
import com.buildsight.platform.quality.domain.NcrSeverity;
import com.buildsight.platform.quality.domain.NcrStatus;

public record NcrResponse(
        UUID id,
        UUID projectId,
        UUID inspectionId,
        String inspectionReference,
        String reference,
        String title,
        String description,
        NcrCategory category,
        NcrSeverity severity,
        LocalDate raisedDate,
        LocalDate dueDate,
        String ownerName,
        String rootCause,
        String correctiveAction,
        String verificationNotes,
        NcrStatus status,
        LocalDate closedDate,
        boolean overdue,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
