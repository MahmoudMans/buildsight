package com.buildsight.platform.project.api;

import com.buildsight.platform.project.domain.ProjectStatus;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record ChangeProjectStatusRequest(

        @PositiveOrZero(message = "Version cannot be negative.")
        long version,

        @NotNull(message = "Target project status is required.")
        ProjectStatus status) {
}
