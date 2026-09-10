package com.buildsight.platform.portfolio.api;

import java.math.BigDecimal;
import java.util.UUID;

import com.buildsight.platform.project.api.ProjectHealthBand;
import com.buildsight.platform.project.domain.ProjectStatus;

public record PortfolioProjectSnapshotResponse(
        UUID projectId,
        String code,
        String name,
        String clientName,
        String location,
        ProjectStatus status,
        int healthScore,
        ProjectHealthBand healthBand,
        long scheduleVarianceDays,
        BigDecimal approvedBudget,
        BigDecimal revisedCostPlan,
        BigDecimal forecastAtCompletion,
        BigDecimal actualCosts,
        BigDecimal outstandingCommitments,
        BigDecimal varianceAtCompletion,
        double costScore,
        long delayedProcurementPackages,
        double procurementScore,
        long highExposureRisks,
        long criticalOpenIssues,
        long forecastDelayDays,
        double riskScore,
        long blockedWorkPackages,
        double productionScore,
        double productivityIndex,
        long overdueRfis,
        long criticalOpenRfis,
        double informationScore,
        long openSafetyIncidents,
        long criticalSafetyIncidents,
        long overdueSafetyActions,
        long expiredWorkPermits,
        double safetyScore,
        int attentionScore,
        int healthRank) {

    public PortfolioProjectSnapshotResponse withHealthRank(
            int rank) {

        return new PortfolioProjectSnapshotResponse(
                projectId,
                code,
                name,
                clientName,
                location,
                status,
                healthScore,
                healthBand,
                scheduleVarianceDays,
                approvedBudget,
                revisedCostPlan,
                forecastAtCompletion,
                actualCosts,
                outstandingCommitments,
                varianceAtCompletion,
                costScore,
                delayedProcurementPackages,
                procurementScore,
                highExposureRisks,
                criticalOpenIssues,
                forecastDelayDays,
                riskScore,
                blockedWorkPackages,
                productionScore,
                productivityIndex,
                overdueRfis,
                criticalOpenRfis,
                informationScore,
                openSafetyIncidents,
                criticalSafetyIncidents,
                overdueSafetyActions,
                expiredWorkPermits,
                safetyScore,
                attentionScore,
                rank);
    }
}
