package com.buildsight.platform.risk.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.risk.domain.DelayCause;
import com.buildsight.platform.risk.domain.DelayStatus;

public record DelayEventResponse(
        UUID id,
        UUID projectId,
        String reference,
        String title,
        String description,
        DelayCause cause,
        String ownerName,
        LocalDate startDate,
        LocalDate endDate,
        int forecastDelayDays,
        boolean excusable,
        boolean compensable,
        DelayStatus status,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
