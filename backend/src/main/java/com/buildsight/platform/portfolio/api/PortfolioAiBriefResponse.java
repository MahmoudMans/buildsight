package com.buildsight.platform.portfolio.api;

import java.time.Instant;
import java.util.List;

public record PortfolioAiBriefResponse(
        String answer,
        boolean grounded,
        String chatModel,
        List<PortfolioAiSourceResponse> sources,
        Instant generatedAt) {
}
