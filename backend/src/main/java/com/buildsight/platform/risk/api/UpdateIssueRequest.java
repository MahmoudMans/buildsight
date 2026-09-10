package com.buildsight.platform.risk.api;

import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.risk.domain.IssueSeverity;
import com.buildsight.platform.risk.domain.IssueStatus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateIssueRequest(

        @PositiveOrZero
        long version,

        UUID sourceRiskId,

        @NotBlank
        @Size(max = 180)
        String title,

        @Size(max = 1500)
        String description,

        @NotNull
        IssueSeverity severity,

        @Size(max = 160)
        String ownerName,

        @NotNull
        LocalDate targetResolutionDate,

        @NotNull
        IssueStatus status) {
}
