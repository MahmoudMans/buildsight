package com.buildsight.platform.portfolio.api;

import java.math.BigDecimal;

import com.buildsight.platform.project.api.ProjectHealthBand;

public record PortfolioSummaryResponse(
        long totalProjects,
        long planningProjects,
        long activeProjects,
        long onHoldProjects,
        long completedProjects,
        long healthyProjects,
        long watchProjects,
        long atRiskProjects,
        BigDecimal totalApprovedBudget,
        BigDecimal totalRevisedCostPlan,
        BigDecimal totalForecastAtCompletion,
        BigDecimal totalActualCosts,
        BigDecimal totalOutstandingCommitments,
        BigDecimal portfolioVarianceAtCompletion,
        double weightedPortfolioHealthScore,
        ProjectHealthBand portfolioHealthBand,
        long delayedProcurementPackages,
        long highExposureRisks,
        long criticalOpenIssues,
        long blockedWorkPackages,
        long overdueRfis,
        long openSafetyIncidents,
        long criticalSafetyIncidents,
        long overdueSafetyActions,
        long expiredWorkPermits,
        long totalExceptions) {
}
