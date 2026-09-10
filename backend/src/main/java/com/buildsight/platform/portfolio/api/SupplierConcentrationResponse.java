package com.buildsight.platform.portfolio.api;

import java.math.BigDecimal;
import java.util.UUID;

public record SupplierConcentrationResponse(
        UUID supplierId,
        String supplierCode,
        String supplierName,
        String supplierType,
        long awardedPackages,
        BigDecimal awardedValue,
        double portfolioAwardSharePercentage,
        SupplierConcentrationRisk concentrationRisk) {
}
