package com.buildsight.platform.procurement.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.buildsight.platform.procurement.domain.ProcurementPackageStatus;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateProcurementPackageRequest(

        @PositiveOrZero
        long version,

        @NotBlank
        @Size(max = 180)
        String title,

        @Size(max = 1500)
        String description,

        @NotNull
        @DecimalMin("0.01")
        BigDecimal estimatedValue,

        @NotNull
        LocalDate plannedIssueDate,

        @NotNull
        LocalDate bidDueDate,

        @NotNull
        LocalDate awardDueDate,

        @NotNull
        LocalDate forecastAwardDate,

        @NotNull
        LocalDate requiredOnSiteDate,

        @NotNull
        ProcurementPackageStatus status) {
}
