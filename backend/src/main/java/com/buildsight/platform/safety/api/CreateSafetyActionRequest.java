package com.buildsight.platform.safety.api;

import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateSafetyActionRequest(

        UUID incidentId,

        UUID observationId,

        @NotBlank
        @Size(max = 64)
        String reference,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotBlank
        String actionDescription,

        @Size(max = 160)
        String ownerName,

        @NotNull
        LocalDate dueDate) {
}
