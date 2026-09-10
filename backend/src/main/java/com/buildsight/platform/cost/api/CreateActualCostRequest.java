package com.buildsight.platform.cost.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateActualCostRequest(

        @NotNull(
                message = "Cost code is required.")
        UUID costCodeId,

        UUID commitmentId,

        @NotBlank(
                message = "Actual-cost reference is required.")
        @Size(
                max = 64,
                message = "Actual-cost reference cannot exceed 64 characters.")
        String reference,

        @NotBlank(
                message = "Supplier name is required.")
        @Size(
                max = 180,
                message = "Supplier name cannot exceed 180 characters.")
        String supplierName,

        @Size(
                max = 1200,
                message = "Description cannot exceed 1200 characters.")
        String description,

        @NotNull(
                message = "Actual cost amount is required.")
        @DecimalMin(
                value = "0.01",
                message = "Actual cost must be greater than zero.")
        BigDecimal amount,

        @NotNull(
                message = "Actual cost date is required.")
        LocalDate costDate) {
}
