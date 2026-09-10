package com.buildsight.platform.quality.api;

import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.quality.domain.NcrCategory;
import com.buildsight.platform.quality.domain.NcrSeverity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateNcrRequest(

        UUID inspectionId,

        @NotBlank
        @Size(max = 64)
        String reference,

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
        LocalDate raisedDate,

        @NotNull
        LocalDate dueDate,

        @Size(max = 160)
        String ownerName) {
}
