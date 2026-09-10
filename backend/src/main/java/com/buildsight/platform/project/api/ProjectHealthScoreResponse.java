package com.buildsight.platform.project.api;

import java.time.LocalDate;

import com.buildsight.platform.cost.api.CostRiskLevel;
import com.buildsight.platform.procurement.api.ProcurementRiskLevel;
import com.buildsight.platform.production.api.ProductionRiskLevel;
import com.buildsight.platform.risk.api.RiskIntelligenceLevel;

public record ProjectHealthScoreResponse(
        LocalDate calculationDate,
        int score,
        ProjectHealthBand healthBand,
        ScheduleRiskLevel scheduleRisk,
        CostRiskLevel costRisk,
        ProcurementRiskLevel procurementRisk,
        RiskIntelligenceLevel riskLevel,
        ProductionRiskLevel productionRisk,
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
        String explanation) {
}
