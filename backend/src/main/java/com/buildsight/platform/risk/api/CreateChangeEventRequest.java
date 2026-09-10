package com.buildsight.platform.risk.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateChangeEventRequest(

        @NotBlank
        @Size(max = 64)
        String reference,

        @NotBlank
        @Size(max = 180)
        String title,

        @Size(max = 1800)
        String description,

        @Size(max = 160)
        String originator,

        @NotNull
        LocalDate requestedDate,

        @NotNull
        BigDecimal costImpact,

        int scheduleImpactDays) {
}
