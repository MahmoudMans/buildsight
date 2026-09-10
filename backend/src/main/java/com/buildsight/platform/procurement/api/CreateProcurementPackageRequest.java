package com.buildsight.platform.procurement.api;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateProcurementPackageRequest(

        @NotNull(
                message = "Cost code is required.")
        UUID costCodeId,

        @NotBlank(
                message = "Package reference is required.")
        @Size(
                max = 64,
                message = "Reference cannot exceed 64 characters.")
        String reference,

        @NotBlank(
                message = "Package title is required.")
        @Size(
                max = 180,
                message = "Title cannot exceed 180 characters.")
        String title,

        @Size(
                max = 1500,
                message = "Description cannot exceed 1500 characters.")
        String description,

        @NotNull(
                message = "Estimated value is required.")
        @DecimalMin(
                value = "0.01",
                message = "Estimated value must be greater than zero.")
        BigDecimal estimatedValue,

        @NotNull
        LocalDate plannedIssueDate,

        @NotNull
        LocalDate bidDueDate,

        @NotNull
        LocalDate awardDueDate,

        LocalDate forecastAwardDate,

        @NotNull
        LocalDate requiredOnSiteDate) {
}
