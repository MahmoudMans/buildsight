package com.buildsight.platform.safety.api;

import java.time.LocalDate;

import com.buildsight.platform.safety.domain.HazardCategory;
import com.buildsight.platform.safety.domain.SafetyObservationStatus;
import com.buildsight.platform.safety.domain.SafetyObservationType;
import com.buildsight.platform.safety.domain.SafetySeverity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateSafetyObservationRequest(

        @PositiveOrZero
        long version,

        @NotNull
        SafetyObservationType observationType,

        @NotNull
        HazardCategory hazardCategory,

        @NotNull
        SafetySeverity severity,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotBlank
        String description,

        @Size(max = 220)
        String location,

        @Size(max = 160)
        String ownerName,

        LocalDate dueDate,

        @NotNull
        SafetyObservationStatus status) {
}
