package com.buildsight.platform.risk.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.buildsight.platform.risk.domain.ChangeEventStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateChangeEventRequest(

        @PositiveOrZero
        long version,

        @NotBlank
        @Size(max = 180)
        String title,

        @Size(max = 1800)
        String description,

        @Size(max = 160)
        String originator,

        @NotNull
        LocalDate requestedDate,

        LocalDate decisionDate,

        @NotNull
        BigDecimal costImpact,

        int scheduleImpactDays,

        @NotNull
        ChangeEventStatus status) {
}
