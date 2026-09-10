package com.buildsight.platform.project.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record CreateMilestoneRequest(

        @NotBlank(message = "Milestone name is required.")
        @Size(
                max = 180,
                message = "Milestone name cannot exceed 180 characters.")
        String name,

        @Size(
                max = 1200,
                message = "Description cannot exceed 1200 characters.")
        String description,

        @NotNull(message = "Planned milestone date is required.")
        LocalDate plannedDate,

        LocalDate forecastDate,

        @NotNull(message = "Milestone weight is required.")
        @DecimalMin(
                value = "0.01",
                message = "Milestone weight must be greater than 0.")
        @DecimalMax(
                value = "100.00",
                message = "Milestone weight cannot exceed 100.")
        BigDecimal weightPercentage,

        @PositiveOrZero(
                message = "Milestone sort order cannot be negative.")
        int sortOrder) {
}
