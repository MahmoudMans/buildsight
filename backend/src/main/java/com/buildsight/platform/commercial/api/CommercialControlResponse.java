package com.buildsight.platform.commercial.api;

import java.util.List;

import com.buildsight.platform.project.api.ProjectResponse;

public record CommercialControlResponse(
        ProjectResponse project,
        CommercialIntelligenceResponse intelligence,
        List<CommercialChangeOrderResponse> changeOrders,
        List<CommercialClaimResponse> claims,
        List<PaymentCertificateResponse> paymentCertificates,
        List<CashflowPeriodResponse> cashflowPeriods) {
}
