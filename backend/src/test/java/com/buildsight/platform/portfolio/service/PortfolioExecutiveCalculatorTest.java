package com.buildsight.platform.portfolio.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.portfolio.api.PortfolioExceptionDomain;
import com.buildsight.platform.portfolio.api.PortfolioExceptionSeverity;
import com.buildsight.platform.portfolio.api.PortfolioProjectSnapshotResponse;
import com.buildsight.platform.project.api.ProjectHealthBand;
import com.buildsight.platform.project.domain.ProjectStatus;

import org.junit.jupiter.api.Test;

class PortfolioExecutiveCalculatorTest {

    private final PortfolioExecutiveCalculator
            calculator =
            new PortfolioExecutiveCalculator();

    @Test
    void severeProjectCreatesPrioritizedExecutiveExceptions() {

        PortfolioProjectSnapshotResponse project =
                snapshot(
                        "BS-001",
                        48,
                        ProjectHealthBand.AT_RISK,
                        -12_000,
                        2,
                        1,
                        1,
                        2,
                        1);

        var exceptions =
                calculator.exceptions(
                        List.of(
                                project));

        assertTrue(
                exceptions.size()
                        >= 5);

        assertEquals(
                PortfolioExceptionSeverity.CRITICAL,
                exceptions.get(0)
                        .severity());

        assertTrue(
                exceptions.stream()
                        .anyMatch(
                                exception ->
                                        exception.domain()
                                                == PortfolioExceptionDomain.COST));

        assertTrue(
                exceptions.stream()
                        .anyMatch(
                                exception ->
                                        exception.domain()
                                                == PortfolioExceptionDomain.RISK));

        assertTrue(
                exceptions.stream()
                        .anyMatch(
                                exception ->
                                        exception.domain()
                                                == PortfolioExceptionDomain.PRODUCTION));
    }

    @Test
    void healthyPortfolioHasWeightedHealthyScore() {

        var first =
                snapshot(
                        "BS-001",
                        90,
                        ProjectHealthBand.HEALTHY,
                        10_000,
                        0,
                        0,
                        0,
                        0,
                        0);

        var second =
                snapshot(
                        "BS-002",
                        82,
                        ProjectHealthBand.HEALTHY,
                        5_000,
                        0,
                        0,
                        0,
                        0,
                        0);

        var summary =
                calculator.summary(
                        List.of(
                                first,
                                second),
                        0);

        assertEquals(
                2,
                summary.healthyProjects());

        assertEquals(
                ProjectHealthBand.HEALTHY,
                summary.portfolioHealthBand());

        assertTrue(
                summary.weightedPortfolioHealthScore()
                        >= 80);
    }

    @Test
    void attentionScoreRisesWithCrossDomainExposure() {

        int healthy =
                calculator.attentionScore(
                        90,
                        0,
                        BigDecimal.ZERO,
                        new BigDecimal("100000"),
                        0,
                        0,
                        0,
                        0,
                        0,
                        0,
                        0);

        int stressed =
                calculator.attentionScore(
                        55,
                        20,
                        new BigDecimal("-15000"),
                        new BigDecimal("100000"),
                        2,
                        2,
                        1,
                        14,
                        2,
                        2,
                        1);

        assertTrue(
                stressed
                        > healthy);

        assertTrue(
                stressed
                        >= 80);
    }

    private PortfolioProjectSnapshotResponse snapshot(
            String code,
            int health,
            ProjectHealthBand band,
            long vac,
            long delayedProcurement,
            long highRisk,
            long criticalIssues,
            long blockedPackages,
            long overdueRfis) {

        return new PortfolioProjectSnapshotResponse(
                UUID.randomUUID(),
                code,
                "Test Project",
                "Client",
                "Paris",
                ProjectStatus.ACTIVE,
                health,
                band,
                health < 60
                        ? 18
                        : 0,
                new BigDecimal("100000.00"),
                new BigDecimal("100000.00"),
                new BigDecimal("100000.00")
                        .subtract(
                                BigDecimal.valueOf(
                                        vac)),
                new BigDecimal("50000.00"),
                new BigDecimal("20000.00"),
                BigDecimal.valueOf(
                        vac),
                health,
                delayedProcurement,
                health,
                highRisk,
                criticalIssues,
                criticalIssues > 0
                        ? 14
                        : 0,
                health,
                blockedPackages,
                health,
                health < 60
                        ? 0.65
                        : 1.05,
                overdueRfis,
                overdueRfis > 0
                        ? 1
                        : 0,
                health,
                0,
                1);
    }
}
