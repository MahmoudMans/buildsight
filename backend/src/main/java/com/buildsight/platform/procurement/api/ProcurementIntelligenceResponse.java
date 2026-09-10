package com.buildsight.platform.procurement.api;

import java.math.BigDecimal;

public record ProcurementIntelligenceResponse(
        long totalPackages,
        long openPackages,
        long awardedPackages,
        long delayedPackages,
        long conditionalAwards,
        long lowPerformanceEvaluations,
        long packagesWithCompetitiveCoverage,
        BigDecimal totalEstimatedValue,
        BigDecimal totalAwardedValue,
        double competitionCoveragePercentage,
        double averageSupplierPerformance,
        long maximumAwardDelayDays,
        double procurementScore,
        ProcurementRiskLevel procurementRisk,
        String explanation) {
}
