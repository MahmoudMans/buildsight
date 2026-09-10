package com.buildsight.platform.safety.api;

import java.time.LocalDate;

import com.buildsight.platform.safety.domain.SafetyIncidentType;
import com.buildsight.platform.safety.domain.SafetySeverity;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateSafetyIncidentRequest(

        @NotBlank
        @Size(max = 64)
        String reference,

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

        @NotNull
        LocalDate occurredDate,

        @NotNull
        LocalDate reportedDate,

        @Min(0)
        int peopleAffected,

        @Min(0)
        int lostTimeDays,

        String immediateAction) {
}
