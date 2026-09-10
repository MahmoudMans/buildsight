package com.buildsight.platform.safety.api;

import java.util.List;

import com.buildsight.platform.project.api.ProjectResponse;

public record SafetyControlResponse(
        ProjectResponse project,
        SafetyIntelligenceResponse intelligence,
        List<SafetyIncidentResponse> incidents,
        List<SafetyObservationResponse> observations,
        List<SafetyActionResponse> actions,
        List<WorkPermitResponse> permits) {
}
