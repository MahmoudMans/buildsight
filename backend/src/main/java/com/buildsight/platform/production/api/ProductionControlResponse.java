package com.buildsight.platform.production.api;

import java.util.List;

import com.buildsight.platform.project.api.ProjectResponse;

public record ProductionControlResponse(
        ProjectResponse project,
        ProductionIntelligenceResponse intelligence,
        List<WorkPackageResponse> workPackages,
        List<SiteReportResponse> siteReports,
        List<ProductionEntryResponse> productionEntries) {
}
