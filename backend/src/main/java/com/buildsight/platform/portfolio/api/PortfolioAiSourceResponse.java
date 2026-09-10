package com.buildsight.platform.portfolio.api;

import java.util.UUID;

public record PortfolioAiSourceResponse(
        String citation,
        UUID projectId,
        String projectCode,
        String projectName,
        String evidence) {
}
