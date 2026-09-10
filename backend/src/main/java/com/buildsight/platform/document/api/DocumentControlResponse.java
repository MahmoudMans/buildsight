package com.buildsight.platform.document.api;

import java.util.List;

import com.buildsight.platform.project.api.ProjectResponse;

public record DocumentControlResponse(
        ProjectResponse project,
        DocumentIntelligenceResponse intelligence,
        List<DocumentResponse> documents,
        List<DocumentRevisionResponse> revisions,
        List<RfiResponse> rfis,
        List<TransmittalResponse> transmittals) {
}
