package com.buildsight.platform.quality.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.quality.domain.PunchPriority;
import com.buildsight.platform.quality.domain.PunchStatus;

public record PunchItemResponse(
        UUID id,
        UUID projectId,
        String reference,
        String title,
        String description,
        String location,
        String trade,
        PunchPriority priority,
        LocalDate raisedDate,
        LocalDate dueDate,
        String ownerName,
        PunchStatus status,
        LocalDate closedDate,
        boolean overdue,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
