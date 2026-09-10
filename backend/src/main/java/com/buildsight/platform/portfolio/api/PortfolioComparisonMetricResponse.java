package com.buildsight.platform.portfolio.api;

public record PortfolioComparisonMetricResponse(
        String metric,
        double projectValue,
        double portfolioAverage,
        double delta,
        String unit,
        boolean higherIsBetter,
        boolean favorable) {
}
