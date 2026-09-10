package com.buildsight.platform.cost.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.buildsight.platform.cost.domain.CommitmentStatus;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateCommitmentRequest(

        @PositiveOrZero(
                message = "Version cannot be negative.")
        long version,

        @NotBlank(
                message = "Vendor name is required.")
        @Size(
                max = 180,
                message = "Vendor name cannot exceed 180 characters.")
        String vendorName,

        @Size(
                max = 1200,
                message = "Description cannot exceed 1200 characters.")
        String description,

        @NotNull(
                message = "Committed amount is required.")
        @DecimalMin(
                value = "0.01",
                message = "Committed amount must be greater than zero.")
        BigDecimal committedAmount,

        @NotNull(
                message = "Commitment status is required.")
        CommitmentStatus status,

        @NotNull(
                message = "Commitment date is required.")
        LocalDate commitmentDate) {
}
