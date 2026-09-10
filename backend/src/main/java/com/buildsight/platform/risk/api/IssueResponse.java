package com.buildsight.platform.risk.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.risk.domain.IssueSeverity;
import com.buildsight.platform.risk.domain.IssueStatus;

public record IssueResponse(
        UUID id,
        UUID projectId,
        UUID sourceRiskId,
        String sourceRiskReference,
        String reference,
        String title,
        String description,
        IssueSeverity severity,
        String ownerName,
        LocalDate targetResolutionDate,
        IssueStatus status,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
