package com.buildsight.platform.portfolio.service;

import java.util.List;

import com.buildsight.platform.portfolio.api.PortfolioAiSourceResponse;

public record PortfolioAiPrompt(
        String prompt,
        List<PortfolioAiSourceResponse> sources) {
}
