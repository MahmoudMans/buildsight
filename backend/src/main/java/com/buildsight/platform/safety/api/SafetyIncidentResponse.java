package com.buildsight.platform.safety.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.safety.domain.SafetyIncidentStatus;
import com.buildsight.platform.safety.domain.SafetyIncidentType;
import com.buildsight.platform.safety.domain.SafetySeverity;

public record SafetyIncidentResponse(
        UUID id,
        UUID projectId,
        String reference,
        SafetyIncidentType incidentType,
        SafetySeverity severity,
        String title,
        String description,
        String location,
        LocalDate occurredDate,
        LocalDate reportedDate,
        int peopleAffected,
        int lostTimeDays,
        String immediateAction,
        String rootCause,
        String investigationNotes,
        SafetyIncidentStatus status,
        LocalDate closedDate,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
