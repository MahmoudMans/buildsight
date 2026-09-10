package com.buildsight.platform.cost.api;

import java.util.List;

import com.buildsight.platform.project.api.ProjectResponse;

public record CostControlResponse(
        ProjectResponse project,
        CostIntelligenceResponse intelligence,
        List<CostCodeResponse> costCodes,
        List<BudgetLineResponse> budgetLines,
        List<CommitmentResponse> commitments,
        List<ActualCostResponse> actualCosts) {
}
