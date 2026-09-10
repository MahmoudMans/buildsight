package com.buildsight.platform.project.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ProgressUpdateResponse(
        UUID id,
        UUID projectId,
        BigDecimal progressPercentage,
        LocalDate updateDate,
        String note,
        Instant createdAt) {
}
