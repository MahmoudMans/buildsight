package com.buildsight.platform.production.api;

import java.time.LocalDate;

import com.buildsight.platform.production.domain.WeatherCondition;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateSiteReportRequest(

        @NotBlank
        @Size(max = 64)
        String reference,

        @NotNull
        LocalDate reportDate,

        @NotNull
        WeatherCondition weatherCondition,

        @Size(max = 2500)
        String generalNotes) {
}
