package com.buildsight.platform.production.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.buildsight.platform.production.domain.WorkPackageStatus;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateWorkPackageRequest(

        @PositiveOrZero
        long version,

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
        LocalDate plannedEndDate,

        @NotNull
        WorkPackageStatus status,

        @Size(max = 1200)
        String blockReason) {
}
