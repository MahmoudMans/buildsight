package com.buildsight.platform.portfolio.api;

public record PortfolioBenchmarksResponse(
        double averageHealthScore,
        double averageCostScore,
        double averageProcurementScore,
        double averageRiskScore,
        double averageProductionScore,
        double averageInformationScore,
        double averageCommercialScore,
        double averageProductivityIndex,
        String bestHealthProjectCode,
        String worstHealthProjectCode) {

    public PortfolioBenchmarksResponse(
            double averageHealthScore,
            double averageCostScore,
            double averageProcurementScore,
            double averageRiskScore,
            double averageProductionScore,
            double averageInformationScore,
            double averageProductivityIndex,
            String bestHealthProjectCode,
            String worstHealthProjectCode) {

        this(
                averageHealthScore,
                averageCostScore,
                averageProcurementScore,
                averageRiskScore,
                averageProductionScore,
                averageInformationScore,
                75,
                averageProductivityIndex,
                bestHealthProjectCode,
                worstHealthProjectCode);
    }
}
