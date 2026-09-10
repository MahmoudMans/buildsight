package com.buildsight.platform.cost.api;

import java.time.Instant;
import java.util.UUID;

import com.buildsight.platform.cost.domain.CostCodeCategory;

public record CostCodeResponse(
        UUID id,
        UUID projectId,
        String code,
        String name,
        CostCodeCategory category,
        String description,
        int sortOrder,
        Instant createdAt) {
}
