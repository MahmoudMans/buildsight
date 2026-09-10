package com.buildsight.platform.safety.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.safety.domain.HazardCategory;
import com.buildsight.platform.safety.domain.SafetyObservationStatus;
import com.buildsight.platform.safety.domain.SafetyObservationType;
import com.buildsight.platform.safety.domain.SafetySeverity;

public record SafetyObservationResponse(
        UUID id,
        UUID projectId,
        String reference,
        SafetyObservationType observationType,
        HazardCategory hazardCategory,
        SafetySeverity severity,
        String title,
        String description,
        String location,
        LocalDate observedDate,
        String observerName,
        String ownerName,
        LocalDate dueDate,
        SafetyObservationStatus status,
        LocalDate closedDate,
        boolean overdue,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
