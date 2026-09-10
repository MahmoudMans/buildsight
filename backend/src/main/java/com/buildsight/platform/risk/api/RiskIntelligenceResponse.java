package com.buildsight.platform.risk.api;

import java.math.BigDecimal;

public record RiskIntelligenceResponse(
        long totalRisks,
        long openRisks,
        long highExposureRisks,
        long overdueMitigations,
        int maximumResidualExposure,
        double averageResidualExposure,
        long openIssues,
        long criticalOpenIssues,
        long overdueIssues,
        long pendingChanges,
        long approvedChanges,
        BigDecimal approvedChangeCostImpact,
        long approvedChangeScheduleImpactDays,
        long activeDelays,
        long forecastDelayDays,
        double riskScore,
        RiskIntelligenceLevel riskLevel,
        String explanation) {
}
