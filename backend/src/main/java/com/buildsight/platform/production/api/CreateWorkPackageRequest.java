package com.buildsight.platform.production.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateWorkPackageRequest(

        @NotBlank
        @Size(max = 40)
        @Pattern(
                regexp = "[A-Za-z0-9][A-Za-z0-9._-]*",
                message = "Work package code may contain letters, numbers, dots, hyphens and underscores.")
        String code,

        @NotBlank
        @Size(max = 180)
        String name,

        @Size(max = 1500)
        String description,

        @NotBlank
        @Size(max = 32)
        String unit,

        @NotNull
        @DecimalMin("0.001")
        BigDecimal plannedQuantity,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal plannedLaborHours,

        @NotNull
        LocalDate plannedStartDate,

        @NotNull
        LocalDate plannedEndDate) {
}
