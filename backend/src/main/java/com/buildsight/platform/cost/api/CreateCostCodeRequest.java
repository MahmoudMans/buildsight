package com.buildsight.platform.cost.api;

import com.buildsight.platform.cost.domain.CostCodeCategory;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record CreateCostCodeRequest(

        @NotBlank(
                message = "Cost code is required.")
        @Size(
                max = 32,
                message = "Cost code cannot exceed 32 characters.")
        @Pattern(
                regexp = "[A-Za-z0-9][A-Za-z0-9._-]*",
                message = "Cost code may contain letters, numbers, dots, hyphens and underscores.")
        String code,

        @NotBlank(
                message = "Cost code name is required.")
        @Size(
                max = 160,
                message = "Cost code name cannot exceed 160 characters.")
        String name,

        @NotNull(
                message = "Cost category is required.")
        CostCodeCategory category,

        @Size(
                max = 1000,
                message = "Description cannot exceed 1000 characters.")
        String description,

        @PositiveOrZero(
                message = "Sort order cannot be negative.")
        int sortOrder) {
}
