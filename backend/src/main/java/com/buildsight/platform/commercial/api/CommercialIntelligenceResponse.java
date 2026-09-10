package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;

public record CommercialIntelligenceResponse(
        long totalChangeOrders,
        long pendingChangeOrders,
        long overdueChangeDecisions,
        BigDecimal submittedChangeValue,
        BigDecimal approvedChangeValue,
        long totalClaims,
        long openClaims,
        long overdueClaimResponses,
        BigDecimal claimedValue,
        BigDecimal awardedClaimValue,
        long claimedDays,
        long awardedDays,
        long totalPaymentCertificates,
        long awaitingCertification,
        long overdueCertifications,
        BigDecimal certifiedValue,
        BigDecimal retentionHeld,
        BigDecimal amountPaid,
        BigDecimal outstandingCertifiedAmount,
        long overduePayments,
        long cashflowPeriods,
        BigDecimal plannedNetCashflow,
        BigDecimal forecastNetCashflow,
        BigDecimal actualNetCashflow,
        BigDecimal forecastCashflowVariance,
        double commercialScore,
        CommercialRiskLevel commercialRisk,
        String explanation) {
}
