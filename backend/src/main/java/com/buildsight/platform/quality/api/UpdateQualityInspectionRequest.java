package com.buildsight.platform.quality.api;

import java.time.LocalDate;

import com.buildsight.platform.quality.domain.QualityDiscipline;
import com.buildsight.platform.quality.domain.QualityInspectionResult;
import com.buildsight.platform.quality.domain.QualityInspectionStatus;
import com.buildsight.platform.quality.domain.QualityInspectionType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateQualityInspectionRequest(

        @PositiveOrZero
        long version,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotNull
        QualityInspectionType inspectionType,

        @NotNull
        QualityDiscipline discipline,

        @NotNull
        LocalDate plannedDate,

        LocalDate actualDate,

        @Size(max = 160)
        String inspectorName,

        @NotNull
        QualityInspectionStatus status,

        @NotNull
        QualityInspectionResult result,

        @Size(max = 2500)
        String notes) {
}
