package com.buildsight.platform.document.api;

import java.time.LocalDate;

import com.buildsight.platform.document.domain.RfiPriority;
import com.buildsight.platform.document.domain.RfiStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateRfiRequest(

        @PositiveOrZero
        long version,

        @NotBlank
        @Size(max = 220)
        String subject,

        @NotBlank
        String question,

        String response,

        @Size(max = 160)
        String assignedTo,

        @NotNull
        LocalDate dueDate,

        @NotNull
        RfiPriority priority,

        @NotNull
        RfiStatus status) {
}
