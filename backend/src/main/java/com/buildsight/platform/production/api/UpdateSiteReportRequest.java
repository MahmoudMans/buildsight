package com.buildsight.platform.production.api;

import java.time.LocalDate;

import com.buildsight.platform.production.domain.SiteReportStatus;
import com.buildsight.platform.production.domain.WeatherCondition;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateSiteReportRequest(

        @PositiveOrZero
        long version,

        @NotNull
        LocalDate reportDate,

        @NotNull
        WeatherCondition weatherCondition,

        @Size(max = 2500)
        String generalNotes,

        @NotNull
        SiteReportStatus status) {
}
