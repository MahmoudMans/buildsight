package com.buildsight.platform.production.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.production.domain.SiteReportStatus;
import com.buildsight.platform.production.domain.WeatherCondition;

public record SiteReportResponse(
        UUID id,
        UUID projectId,
        String reference,
        LocalDate reportDate,
        WeatherCondition weatherCondition,
        String generalNotes,
        SiteReportStatus status,
        long entryCount,
        BigDecimal totalLaborHours,
        BigDecimal totalEquipmentHours,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
