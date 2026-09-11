package com.buildsight.platform.forecast.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.forecast.domain.ForecastRiskLevel;
import com.buildsight.platform.forecast.domain.ForecastScenarioType;
import com.buildsight.platform.forecast.domain.ForecastTrend;
import com.buildsight.platform.forecast.domain.ProjectForecastScenario;

import org.junit.jupiter.api.Test;

class ForecastScenarioEngineTest {

    private final ForecastScenarioEngine engine =
            new ForecastScenarioEngine();

    @Test
    void downsideScenarioIncreasesCostAndFinishDate() {

        ForecastIntelligenceResponse current =
                current();

        ProjectForecastScenario downside =
                ProjectForecastScenario.create(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "Downside",
                        ForecastScenarioType.PESSIMISTIC,
                        new BigDecimal("8"),
                        14,
                        new BigDecimal("0.85"),
                        10,
                        new BigDecimal("4"),
                        new BigDecimal("8"),
                        new BigDecimal("0.90"),
                        null);

        var result =
                engine.evaluate(
                        current,
                        downside);

        assertTrue(
                result.expectedCost()
                        .compareTo(
                                current.expectedForecastCost())
                        > 0);

        assertTrue(
                result.expectedFinishDate()
                        .isAfter(
                                current.expectedForecastFinishDate()));

        assertTrue(
                result.finishImpactDays()
                        > 0);

        assertTrue(
                result.scenarioScore()
                        < current.predictiveScore());
    }

    @Test
    void recoveryScenarioCanImproveForecast() {

        ForecastIntelligenceResponse current =
                current();

        ProjectForecastScenario recovery =
                ProjectForecastScenario.create(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "Recovery",
                        ForecastScenarioType.OPTIMISTIC,
                        new BigDecimal("-5"),
                        -5,
                        new BigDecimal("1.10"),
                        0,
                        BigDecimal.ZERO,
                        new BigDecimal("1"),
                        new BigDecimal("1.10"),
                        null);

        var result =
                engine.evaluate(
                        current,
                        recovery);

        assertTrue(
                result.expectedCost()
                        .compareTo(
                                current.expectedForecastCost())
                        < 0);

        assertTrue(
                result.expectedFinishDate()
                        .isBefore(
                                current.expectedForecastFinishDate()));
    }

    private ForecastIntelligenceResponse current() {

        return new ForecastIntelligenceResponse(
                LocalDate.of(
                        2026,
                        9,
                        11),

                new BigDecimal("100000"),
                new BigDecimal("50000"),
                new BigDecimal("45000"),
                new BigDecimal("47000"),

                new BigDecimal("-2000"),
                new BigDecimal("-5000"),

                new BigDecimal("0.9574"),
                new BigDecimal("0.9000"),

                new BigDecimal("110000"),
                new BigDecimal("63000"),
                new BigDecimal("-10000"),
                new BigDecimal("1.0377"),

                50,
                45,

                new BigDecimal("103000"),
                new BigDecimal("110000"),
                new BigDecimal("122000"),

                LocalDate.of(
                        2026,
                        12,
                        15),

                LocalDate.of(
                        2026,
                        12,
                        20),

                LocalDate.of(
                        2026,
                        12,
                        30),

                10,

                72,
                ForecastRiskLevel.WATCH,
                ForecastTrend.STABLE,

                2,
                LocalDate.of(
                        2026,
                        9,
                        1),

                "Test forecast.");
    }
}
