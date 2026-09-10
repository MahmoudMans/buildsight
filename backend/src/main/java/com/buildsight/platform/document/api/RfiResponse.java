package com.buildsight.platform.document.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.document.domain.RfiPriority;
import com.buildsight.platform.document.domain.RfiStatus;

public record RfiResponse(
        UUID id,
        UUID projectId,
        String reference,
        String subject,
        String question,
        String response,
        String raisedBy,
        String assignedTo,
        LocalDate raisedDate,
        LocalDate dueDate,
        LocalDate respondedDate,
        RfiPriority priority,
        RfiStatus status,
        boolean overdue,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
