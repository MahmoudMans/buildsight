package com.buildsight.platform.cost.api;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateBudgetLineRequest(

        @PositiveOrZero(
                message = "Version cannot be negative.")
        long version,

        @Size(
                max = 1000,
                message = "Description cannot exceed 1000 characters.")
        String description,

        @NotNull(
                message = "Original budget is required.")
        @DecimalMin(
                value = "0.00",
                message = "Original budget cannot be negative.")
        BigDecimal originalBudget,

        @NotNull(
                message = "Approved changes are required.")
        BigDecimal approvedChanges,

        @NotNull(
                message = "Forecast cost is required.")
        @DecimalMin(
                value = "0.00",
                message = "Forecast cost cannot be negative.")
        BigDecimal forecastCost) {
}
