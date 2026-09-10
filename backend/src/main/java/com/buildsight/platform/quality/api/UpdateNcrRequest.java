package com.buildsight.platform.quality.api;

import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.quality.domain.NcrCategory;
import com.buildsight.platform.quality.domain.NcrSeverity;
import com.buildsight.platform.quality.domain.NcrStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateNcrRequest(

        @PositiveOrZero
        long version,

        UUID inspectionId,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotBlank
        String description,

        @NotNull
        NcrCategory category,

        @NotNull
        NcrSeverity severity,

        @NotNull
        LocalDate dueDate,

        @Size(max = 160)
        String ownerName,

        String rootCause,

        String correctiveAction,

        String verificationNotes,

        @NotNull
        NcrStatus status) {
}
