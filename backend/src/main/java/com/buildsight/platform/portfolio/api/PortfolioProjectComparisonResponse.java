package com.buildsight.platform.portfolio.api;

import java.util.List;
import java.util.UUID;

public record PortfolioProjectComparisonResponse(
        UUID projectId,
        String projectCode,
        String projectName,
        int healthRank,
        int totalProjects,
        double healthPercentile,
        List<PortfolioComparisonMetricResponse> metrics) {
}
