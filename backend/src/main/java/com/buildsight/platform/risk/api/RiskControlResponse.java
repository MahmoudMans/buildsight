package com.buildsight.platform.risk.api;

import java.util.List;

import com.buildsight.platform.project.api.ProjectResponse;

public record RiskControlResponse(
        ProjectResponse project,
        RiskIntelligenceResponse intelligence,
        List<RiskResponse> risks,
        List<IssueResponse> issues,
        List<ChangeEventResponse> changes,
        List<DelayEventResponse> delays) {
}
