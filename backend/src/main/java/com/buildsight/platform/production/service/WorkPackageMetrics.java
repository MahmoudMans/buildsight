package com.buildsight.platform.production.service;

import java.math.BigDecimal;

public record WorkPackageMetrics(
        BigDecimal actualQuantity,
        double completionPercentage,
        double expectedProgressPercentage,
        BigDecimal expectedQuantity,
        BigDecimal quantityVariance,
        BigDecimal actualLaborHours,
        BigDecimal actualEquipmentHours,
        double plannedProductivityRate,
        double actualProductivityRate,
        double productivityIndex) {
}
