package com.buildsight.platform.risk.api;

import java.time.LocalDate;

import com.buildsight.platform.risk.domain.DelayCause;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record CreateDelayEventRequest(

        @NotBlank
        @Size(max = 64)
        String reference,

        @NotBlank
        @Size(max = 180)
        String title,

        @Size(max = 1800)
        String description,

        @NotNull
        DelayCause cause,

        @Size(max = 160)
        String ownerName,

        @NotNull
        LocalDate startDate,

        @PositiveOrZero
        int forecastDelayDays,

        boolean excusable,

        boolean compensable) {
}
