package com.buildsight.platform.safety.api;

import java.time.LocalDate;

import com.buildsight.platform.safety.domain.SafetyActionStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateSafetyActionRequest(

        @PositiveOrZero
        long version,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotBlank
        String actionDescription,

        @Size(max = 160)
        String ownerName,

        @NotNull
        LocalDate dueDate,

        @NotNull
        SafetyActionStatus status,

        String verificationNotes) {
}
