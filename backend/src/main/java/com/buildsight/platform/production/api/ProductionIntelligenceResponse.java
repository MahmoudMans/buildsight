package com.buildsight.platform.production.api;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ProductionIntelligenceResponse(
        long totalPackages,
        long activePackages,
        long blockedPackages,
        long completedPackages,
        long totalSiteReports,
        long acceptedSiteReports,
        long approvedSiteReports,
        LocalDate latestAcceptedReportDate,
        boolean reportingStale,
        double averagePackageCompletionPercentage,
        double averageExpectedProgressPercentage,
        double productionVariancePoints,
        BigDecimal totalLaborHours,
        BigDecimal totalEquipmentHours,
        double overallProductivityIndex,
        double weeklyProductionTrendPercentage,
        double productionScore,
        ProductionRiskLevel productionRisk,
        String explanation) {
}
