package com.buildsight.platform.quality.api;

import java.util.List;

import com.buildsight.platform.project.api.ProjectResponse;

public record QualityControlResponse(
        ProjectResponse project,
        QualityIntelligenceResponse intelligence,
        List<QualityInspectionResponse> inspections,
        List<NcrResponse> ncrs,
        List<PunchItemResponse> punchItems,
        List<HandoverItemResponse> handoverItems) {
}
