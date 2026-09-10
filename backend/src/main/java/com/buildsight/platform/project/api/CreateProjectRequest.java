package com.buildsight.platform.project.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateProjectRequest(

        @NotBlank(message = "Project code is required.")
        @Size(max = 32, message = "Project code cannot exceed 32 characters.")
        @Pattern(
                regexp = "[A-Za-z0-9][A-Za-z0-9._-]*",
                message = "Project code may contain letters, numbers, dots, hyphens and underscores.")
        String code,

        @NotBlank(message = "Project name is required.")
        @Size(max = 160, message = "Project name cannot exceed 160 characters.")
        String name,

        @Size(max = 2000, message = "Description cannot exceed 2000 characters.")
        String description,

        @NotBlank(message = "Client name is required.")
        @Size(max = 160, message = "Client name cannot exceed 160 characters.")
        String clientName,

        @NotBlank(message = "Location is required.")
        @Size(max = 200, message = "Location cannot exceed 200 characters.")
        String location,

        @NotNull(message = "Contract value is required.")
        @DecimalMin(
                value = "0.00",
                inclusive = true,
                message = "Contract value cannot be negative.")
        BigDecimal contractValue,

        @NotNull(message = "Approved budget is required.")
        @DecimalMin(
                value = "0.00",
                inclusive = true,
                message = "Approved budget cannot be negative.")
        BigDecimal approvedBudget,

        @NotNull(message = "Planned start date is required.")
        LocalDate plannedStartDate,

        @NotNull(message = "Planned end date is required.")
        LocalDate plannedEndDate) {
}
