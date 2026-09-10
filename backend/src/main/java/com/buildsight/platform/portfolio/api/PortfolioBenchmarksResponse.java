package com.buildsight.platform.portfolio.api;

public record PortfolioBenchmarksResponse(
        double averageHealthScore,
        double averageCostScore,
        double averageProcurementScore,
        double averageRiskScore,
        double averageProductionScore,
        double averageInformationScore,
        double averageProductivityIndex,
        String bestHealthProjectCode,
        String worstHealthProjectCode) {
}
