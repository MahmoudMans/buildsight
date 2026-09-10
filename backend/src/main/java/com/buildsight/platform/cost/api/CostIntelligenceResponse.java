package com.buildsight.platform.cost.api;

import java.math.BigDecimal;

public record CostIntelligenceResponse(
        BigDecimal projectApprovedBudget,
        BigDecimal originalCostPlan,
        BigDecimal approvedChanges,
        BigDecimal revisedCostPlan,
        BigDecimal unallocatedBudget,
        BigDecimal totalApprovedCommitments,
        BigDecimal outstandingCommitments,
        BigDecimal actualCosts,
        BigDecimal forecastAtCompletion,
        BigDecimal varianceAtCompletion,
        BigDecimal overrunAmount,
        double budgetUtilizationPercentage,
        double committedExposurePercentage,
        double forecastVariancePercentage,
        double costScore,
        CostRiskLevel costRisk,
        String explanation) {
}
