package com.buildsight.platform.quality.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.quality.domain.QualityDiscipline;
import com.buildsight.platform.quality.domain.QualityInspectionResult;
import com.buildsight.platform.quality.domain.QualityInspectionStatus;
import com.buildsight.platform.quality.domain.QualityInspectionType;

public record QualityInspectionResponse(
        UUID id,
        UUID projectId,
        String reference,
        String title,
        QualityInspectionType inspectionType,
        QualityDiscipline discipline,
        LocalDate plannedDate,
        LocalDate actualDate,
        String inspectorName,
        QualityInspectionStatus status,
        QualityInspectionResult result,
        String notes,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
