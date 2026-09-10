package com.buildsight.platform.project.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.project.domain.MilestoneStatus;

public record MilestoneResponse(
        UUID id,
        UUID projectId,
        String name,
        String description,
        LocalDate plannedDate,
        LocalDate forecastDate,
        LocalDate actualDate,
        MilestoneStatus status,
        BigDecimal weightPercentage,
        int sortOrder,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
