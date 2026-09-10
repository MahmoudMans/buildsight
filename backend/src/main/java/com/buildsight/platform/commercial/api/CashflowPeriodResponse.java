package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.commercial.domain.CashflowPeriodStatus;

public record CashflowPeriodResponse(
        UUID id,
        UUID projectId,
        LocalDate periodStart,
        LocalDate periodEnd,
        BigDecimal plannedInflow,
        BigDecimal forecastInflow,
        BigDecimal actualInflow,
        BigDecimal plannedOutflow,
        BigDecimal forecastOutflow,
        BigDecimal actualOutflow,
        BigDecimal plannedNetCashflow,
        BigDecimal forecastNetCashflow,
        BigDecimal actualNetCashflow,
        BigDecimal forecastVariance,
        CashflowPeriodStatus status,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
