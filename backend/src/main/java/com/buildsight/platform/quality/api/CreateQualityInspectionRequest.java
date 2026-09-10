package com.buildsight.platform.quality.api;

import java.time.LocalDate;

import com.buildsight.platform.quality.domain.QualityDiscipline;
import com.buildsight.platform.quality.domain.QualityInspectionType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateQualityInspectionRequest(

        @NotBlank
        @Size(max = 64)
        String reference,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotNull
        QualityInspectionType inspectionType,

        @NotNull
        QualityDiscipline discipline,

        @NotNull
        LocalDate plannedDate,

        @Size(max = 160)
        String inspectorName,

        @Size(max = 2500)
        String notes) {
}
