package com.buildsight.platform.quality.api;

import java.time.LocalDate;

import com.buildsight.platform.quality.domain.HandoverCategory;
import com.buildsight.platform.quality.domain.HandoverStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateHandoverItemRequest(

        @PositiveOrZero
        long version,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotNull
        HandoverCategory category,

        @Size(max = 160)
        String ownerName,

        @NotNull
        LocalDate dueDate,

        @NotNull
        HandoverStatus status,

        @Size(max = 2000)
        String notes) {
}
