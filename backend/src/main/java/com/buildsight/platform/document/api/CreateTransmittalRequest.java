package com.buildsight.platform.document.api;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateTransmittalRequest(

        @NotBlank
        @Size(max = 64)
        String reference,

        @NotBlank
        @Size(max = 220)
        String recipient,

        @NotBlank
        @Size(max = 220)
        String purpose,

        @NotNull
        LocalDate transmittalDate,

        @Size(max = 2000)
        String notes,

        @NotEmpty
        List<UUID> revisionIds) {
}
