package com.buildsight.platform.quality.api;

public record QualityIntelligenceResponse(
        long totalInspections,
        long completedInspections,
        long passedInspections,
        long failedInspections,
        double inspectionPassRatePercentage,
        long openNcrs,
        long criticalOpenNcrs,
        long overdueNcrs,
        long recurringDefectCategories,
        long openPunchItems,
        long overduePunchItems,
        long requiredHandoverItems,
        long approvedHandoverItems,
        long overdueHandoverItems,
        double handoverReadinessPercentage,
        double qualityScore,
        QualityRiskLevel qualityRisk,
        String explanation) {
}
