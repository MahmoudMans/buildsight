package com.buildsight.platform.project.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.project.domain.ProjectStatus;

public record ProjectResponse(
        UUID id,
        String code,
        String name,
        String description,
        String clientName,
        String location,
        BigDecimal contractValue,
        BigDecimal approvedBudget,
        LocalDate plannedStartDate,
        LocalDate plannedEndDate,
        LocalDate actualStartDate,
        LocalDate actualEndDate,
        ProjectStatus status,
        BigDecimal physicalProgressPercentage,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
