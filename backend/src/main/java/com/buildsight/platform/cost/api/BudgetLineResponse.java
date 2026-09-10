package com.buildsight.platform.cost.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record BudgetLineResponse(
        UUID id,
        UUID projectId,
        UUID costCodeId,
        String costCode,
        String costCodeName,
        String description,
        BigDecimal originalBudget,
        BigDecimal approvedChanges,
        BigDecimal revisedBudget,
        BigDecimal forecastCost,
        BigDecimal forecastVariance,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
