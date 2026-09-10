package com.buildsight.platform.cost.api;

import java.math.BigDecimal;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateBudgetLineRequest(

        @NotNull(
                message = "Cost code is required.")
        UUID costCodeId,

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

        @DecimalMin(
                value = "0.00",
                message = "Forecast cost cannot be negative.")
        BigDecimal forecastCost) {
}
