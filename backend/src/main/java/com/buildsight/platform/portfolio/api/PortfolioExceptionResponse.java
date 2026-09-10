package com.buildsight.platform.portfolio.api;

import java.util.UUID;

public record PortfolioExceptionResponse(
        String id,
        UUID projectId,
        String projectCode,
        String projectName,
        PortfolioExceptionSeverity severity,
        PortfolioExceptionDomain domain,
        String title,
        String detail,
        String metricLabel,
        String metricValue,
        String route,
        int priorityScore) {
}
