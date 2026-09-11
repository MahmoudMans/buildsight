package com.buildsight.platform.recovery.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.forecast.domain.ForecastRiskLevel;
import com.buildsight.platform.forecast.domain.ForecastTrend;
import com.buildsight.platform.recovery.domain.ProjectChangeImpactSimulation;
import com.buildsight.platform.recovery.domain.ProjectRecoveryOption;
import com.buildsight.platform.recovery.domain.RecoveryStrategyType;

import org.junit.jupiter.api.Test;

class ChangeImpactSimulationEngineTest {

    private final ChangeImpactSimulationEngine engine =
            new ChangeImpactSimulationEngine();

    @Test
    void negativeChangeRaisesCostAndForecastFinish() {

        var baseline =
                baseline();

        var simulation =
                simulation();

        var impact =
                engine.impact(
                        baseline,
                        simulation);

        assertTrue(
                impact.impactedForecastCost()
                        .compareTo(
                                baseline.expectedForecastCost())
                        > 0);

        assertTrue(
                impact.impactedForecastFinishDate()
                        .isAfter(
                                baseline.expectedForecastFinishDate()));

        assertTrue(
                impact.totalChangeCostExposure()
                        .signum()
                        > 0);

        assertTrue(
                impact.scheduleImpactDays()
                        > 0);

        assertTrue(
                impact.impactScore()
                        < baseline.predictiveScore());
    }

    @Test
    void recoveryOptionReducesResidualDelay() {

        var baseline =
                baseline();

        var simulation =
                simulation();

        var impact =
                engine.impact(
                        baseline,
                        simulation);

        var recovery =
                engine.recovery(
                        baseline,
                        impact,
                        strongRecovery(
                                simulation.getId()));

        assertTrue(
                recovery.recoverableDays()
                        > 0);

        assertTrue(
                recovery.residualDelayDays()
                        < impact.scheduleImpactDays());

        assertTrue(
                recovery.recoveredForecastFinishDate()
                        .isBefore(
                                impact.impactedForecastFinishDate()));
    }

    @Test
    void strongerRecoveryScoresHigherThanWeakRecovery() {

        var baseline =
                baseline();

        var simulation =
                simulation();

        var impact =
                engine.impact(
                        baseline,
                        simulation);

        var strong =
                engine.recovery(
                        baseline,
                        impact,
                        strongRecovery(
                                simulation.getId()));

        var weak =
                engine.recovery(
                        baseline,
                        impact,
                        weakRecovery(
                                simulation.getId()));

        assertTrue(
                strong.recoverableDays()
                        > weak.recoverableDays());

        assertTrue(
                strong.residualDelayDays()
                        < weak.residualDelayDays());

        assertTrue(
                strong.recoveryScore()
                        > weak.recoveryScore());
    }

    private ForecastIntelligenceResponse baseline() {

        return new ForecastIntelligenceResponse(
                LocalDate.of(
                        2026,
                        9,
                        11),

                new BigDecimal("1000000"),
                new BigDecimal("500000"),
                new BigDecimal("460000"),
                new BigDecimal("480000"),

                new BigDecimal("-20000"),
                new BigDecimal("-40000"),

                new BigDecimal("0.9583"),
                new BigDecimal("0.9200"),

                new BigDecimal("1080000"),
                new BigDecimal("600000"),
                new BigDecimal("-80000"),
                new BigDecimal("1.0833"),

                50,
                46,

                new BigDecimal("1020000"),
                new BigDecimal("1080000"),
                new BigDecimal("1170000"),

                LocalDate.of(
                        2026,
                        12,
                        10),

                LocalDate.of(
                        2026,
                        12,
                        20),

                LocalDate.of(
                        2027,
                        1,
                        5),

                10,

                70,
                ForecastRiskLevel.WATCH,
                ForecastTrend.STABLE,

                2,
                LocalDate.of(
                        2026,
                        9,
                        1),

                "Test baseline.");
    }

    private ProjectChangeImpactSimulation simulation() {

        return ProjectChangeImpactSimulation.create(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "SIM-001",
                "Procurement impact",
                "CHG-001",
                null,
                new BigDecimal("80000"),
                12,
                new BigDecimal("-10"),
                8,
                new BigDecimal("-8"),
                new BigDecimal("10"),
                null);
    }

    private ProjectRecoveryOption strongRecovery(
            UUID simulationId) {

        return ProjectRecoveryOption.create(
                UUID.randomUUID(),
                UUID.randomUUID(),
                simulationId,
                "REC-001",
                "Strong recovery",
                RecoveryStrategyType.COMBINED,
                10,
                new BigDecimal("40000"),
                new BigDecimal("10"),
                5,
                new BigDecimal("8"),
                new BigDecimal("15"),
                null);
    }

    private ProjectRecoveryOption weakRecovery(
            UUID simulationId) {

        return ProjectRecoveryOption.create(
                UUID.randomUUID(),
                UUID.randomUUID(),
                simulationId,
                "REC-002",
                "Weak recovery",
                RecoveryStrategyType.RESEQUENCING,
                2,
                new BigDecimal("5000"),
                new BigDecimal("1"),
                0,
                new BigDecimal("1"),
                new BigDecimal("45"),
                null);
    }
}
