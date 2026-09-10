package com.buildsight.platform.document.api;

import java.time.LocalDate;

import com.buildsight.platform.document.domain.RfiPriority;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateRfiRequest(

        @NotBlank
        @Size(max = 64)
        String reference,

        @NotBlank
        @Size(max = 220)
        String subject,

        @NotBlank
        String question,

        @Size(max = 160)
        String raisedBy,

        @Size(max = 160)
        String assignedTo,

        @NotNull
        LocalDate raisedDate,

        @NotNull
        LocalDate dueDate,

        @NotNull
        RfiPriority priority) {
}
