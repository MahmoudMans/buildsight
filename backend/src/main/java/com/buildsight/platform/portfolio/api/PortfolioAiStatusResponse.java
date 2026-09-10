package com.buildsight.platform.portfolio.api;

public record PortfolioAiStatusResponse(
        boolean ollamaReachable,
        String chatModel,
        boolean chatModelAvailable,
        boolean ready,
        String message) {
}
