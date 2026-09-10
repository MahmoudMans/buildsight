package com.buildsight.platform.portfolio.api;

import java.time.LocalDate;
import java.util.List;

public record PortfolioExecutiveResponse(
        LocalDate calculationDate,
        PortfolioSummaryResponse summary,
        PortfolioBenchmarksResponse benchmarks,
        List<PortfolioProjectSnapshotResponse> projects,
        List<PortfolioExceptionResponse> exceptions,
        List<SupplierConcentrationResponse> supplierConcentration) {
}
