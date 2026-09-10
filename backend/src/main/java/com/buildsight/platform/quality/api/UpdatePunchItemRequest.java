package com.buildsight.platform.quality.api;

import java.time.LocalDate;

import com.buildsight.platform.quality.domain.PunchPriority;
import com.buildsight.platform.quality.domain.PunchStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdatePunchItemRequest(

        @PositiveOrZero
        long version,

        @NotBlank
        @Size(max = 220)
        String title,

        @Size(max = 2500)
        String description,

        @Size(max = 220)
        String location,

        @Size(max = 120)
        String trade,

        @NotNull
        PunchPriority priority,

        @NotNull
        LocalDate dueDate,

        @Size(max = 160)
        String ownerName,

        @NotNull
        PunchStatus status) {
}
