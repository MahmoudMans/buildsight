package com.buildsight.platform.risk.api;

import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.risk.domain.IssueSeverity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateIssueRequest(

        UUID sourceRiskId,

        @NotBlank
        @Size(max = 64)
        String reference,

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
        LocalDate targetResolutionDate) {
}
