package com.buildsight.platform.safety.api;

import com.buildsight.platform.safety.domain.SafetyIncidentStatus;
import com.buildsight.platform.safety.domain.SafetyIncidentType;
import com.buildsight.platform.safety.domain.SafetySeverity;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateSafetyIncidentRequest(

        @PositiveOrZero
        long version,

        @NotNull
        SafetyIncidentType incidentType,

        @NotNull
        SafetySeverity severity,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotBlank
        String description,

        @Size(max = 220)
        String location,

        @Min(0)
        int peopleAffected,

        @Min(0)
        int lostTimeDays,

        String immediateAction,

        String rootCause,

        String investigationNotes,

        @NotNull
        SafetyIncidentStatus status) {
}
