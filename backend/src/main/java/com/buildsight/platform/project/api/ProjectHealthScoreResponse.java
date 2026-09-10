package com.buildsight.platform.project.api;

import java.time.LocalDate;

import com.buildsight.platform.commercial.api.CommercialRiskLevel;
import com.buildsight.platform.cost.api.CostRiskLevel;
import com.buildsight.platform.document.api.InformationRiskLevel;
import com.buildsight.platform.procurement.api.ProcurementRiskLevel;
import com.buildsight.platform.production.api.ProductionRiskLevel;
import com.buildsight.platform.quality.api.QualityRiskLevel;
import com.buildsight.platform.risk.api.RiskIntelligenceLevel;
import com.buildsight.platform.safety.api.SafetyRiskLevel;

public record ProjectHealthScoreResponse(
        LocalDate calculationDate,
        int score,
        ProjectHealthBand healthBand,
        ScheduleRiskLevel scheduleRisk,
        CostRiskLevel costRisk,
        ProcurementRiskLevel procurementRisk,
        RiskIntelligenceLevel riskLevel,
        ProductionRiskLevel productionRisk,
        InformationRiskLevel informationRisk,
        QualityRiskLevel qualityRisk,
        SafetyRiskLevel safetyRisk,
        CommercialRiskLevel commercialRisk,
        long scheduleVarianceDays,
        double expectedProgressPercentage,
        double actualProgressPercentage,
        double progressVariancePoints,
        long overdueMilestones,
        long blockedMilestones,
        double scheduleScore,
        double progressScore,
        double milestoneScore,
        double costScore,
        double procurementScore,
        double riskScore,
        double productionScore,
        double informationScore,
        double qualityScore,
        double safetyScore,
        double commercialScore,
        String explanation) {
}
