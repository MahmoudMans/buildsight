package com.buildsight.platform.quality.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.quality.domain.HandoverCategory;
import com.buildsight.platform.quality.domain.HandoverStatus;

public record HandoverItemResponse(
        UUID id,
        UUID projectId,
        String code,
        String title,
        HandoverCategory category,
        String ownerName,
        LocalDate dueDate,
        LocalDate receivedDate,
        LocalDate approvedDate,
        HandoverStatus status,
        String notes,
        boolean overdue,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
