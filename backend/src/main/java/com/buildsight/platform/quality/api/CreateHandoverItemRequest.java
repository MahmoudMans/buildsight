package com.buildsight.platform.quality.api;

import java.time.LocalDate;

import com.buildsight.platform.quality.domain.HandoverCategory;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateHandoverItemRequest(

        @NotBlank
        @Size(max = 64)
        String code,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotNull
        HandoverCategory category,

        @Size(max = 160)
        String ownerName,

        @NotNull
        LocalDate dueDate,

        @Size(max = 2000)
        String notes) {
}
