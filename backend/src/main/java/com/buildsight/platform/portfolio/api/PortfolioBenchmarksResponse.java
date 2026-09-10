package com.buildsight.platform.portfolio.api;

public record PortfolioBenchmarksResponse(
        double averageHealthScore,
        double averageCostScore,
        double averageProcurementScore,
        double averageRiskScore,
        double averageProductionScore,
        double averageInformationScore,
        double averageCommercialScore,
        double averageResourceScore,
        double averageProductivityIndex,
        String bestHealthProjectCode,
        String worstHealthProjectCode) {

    /*
     * Step 12 compatibility.
     */
    public PortfolioBenchmarksResponse(
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

        this(
                averageHealthScore,
                averageCostScore,
                averageProcurementScore,
                averageRiskScore,
                averageProductionScore,
                averageInformationScore,
                averageCommercialScore,
                75,
                averageProductivityIndex,
                bestHealthProjectCode,
                worstHealthProjectCode);
    }

    /*
     * Step 9/11 compatibility.
     */
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
                75,
                averageProductivityIndex,
                bestHealthProjectCode,
                worstHealthProjectCode);
    }
}
