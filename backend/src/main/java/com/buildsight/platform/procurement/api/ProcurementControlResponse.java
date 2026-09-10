package com.buildsight.platform.procurement.api;

import java.util.List;

import com.buildsight.platform.cost.api.CostCodeResponse;
import com.buildsight.platform.project.api.ProjectResponse;

public record ProcurementControlResponse(
        ProjectResponse project,
        ProcurementIntelligenceResponse intelligence,
        List<CostCodeResponse> costCodes,
        List<SupplierResponse> suppliers,
        List<ProcurementPackageResponse> packages,
        List<ProcurementBidResponse> bids,
        List<SupplierPerformanceEvaluationResponse> evaluations) {
}
