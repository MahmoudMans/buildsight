package com.buildsight.platform.project.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record RecordProgressRequest(

        @PositiveOrZero(message = "Version cannot be negative.")
        long version,

        @NotNull(message = "Progress percentage is required.")
        @DecimalMin(
                value = "0.00",
                message = "Progress cannot be lower than 0%.")
        @DecimalMax(
                value = "100.00",
                message = "Progress cannot exceed 100%.")
        BigDecimal progressPercentage,

        @NotNull(message = "Progress update date is required.")
        LocalDate updateDate,

        @Size(
                max = 1000,
                message = "Progress note cannot exceed 1000 characters.")
        String note) {
}
