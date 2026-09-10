package com.buildsight.platform.production.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record ProductionEntryResponse(
        UUID id,
        UUID siteReportId,
        String siteReportReference,
        LocalDate reportDate,
        UUID workPackageId,
        String workPackageCode,
        String workPackageName,
        String unit,
        BigDecimal quantityCompleted,
        BigDecimal laborHours,
        BigDecimal equipmentHours,
        int crewSize,
        String notes,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
