package com.buildsight.platform.risk.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.risk.domain.RiskCategory;
import com.buildsight.platform.risk.domain.RiskStatus;

public record RiskResponse(
        UUID id,
        UUID projectId,
        String reference,
        String title,
        String description,
        RiskCategory category,
        String ownerName,
        int probability,
        int impact,
        int inherentScore,
        int residualProbability,
        int residualImpact,
        int residualScore,
        RiskExposureBand exposureBand,
        String mitigationPlan,
        LocalDate mitigationDueDate,
        RiskStatus status,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
