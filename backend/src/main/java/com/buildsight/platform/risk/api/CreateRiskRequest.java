package com.buildsight.platform.risk.api;

import java.time.LocalDate;

import com.buildsight.platform.risk.domain.RiskCategory;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateRiskRequest(

        @NotBlank
        @Size(max = 64)
        String reference,

        @NotBlank
        @Size(max = 180)
        String title,

        @Size(max = 1500)
        String description,

        @NotNull
        RiskCategory category,

        @Size(max = 160)
        String ownerName,

        @Min(1)
        @Max(5)
        int probability,

        @Min(1)
        @Max(5)
        int impact,

        @Min(1)
        @Max(5)
        int residualProbability,

        @Min(1)
        @Max(5)
        int residualImpact,

        @Size(max = 2000)
        String mitigationPlan,

        @NotNull
        LocalDate mitigationDueDate) {
}
