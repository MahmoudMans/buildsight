package com.buildsight.platform.risk.api;

import java.time.LocalDate;

import com.buildsight.platform.risk.domain.DelayCause;
import com.buildsight.platform.risk.domain.DelayStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateDelayEventRequest(

        @PositiveOrZero
        long version,

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

        LocalDate endDate,

        @PositiveOrZero
        int forecastDelayDays,

        boolean excusable,

        boolean compensable,

        @NotNull
        DelayStatus status) {
}
