package com.buildsight.platform.periodcontrol.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.buildsight.platform.periodcontrol.domain.PeriodControlRiskLevel;
import com.buildsight.platform.periodcontrol.service.PeriodControlCalculator.ControlInput;

import org.junit.jupiter.api.Test;

class PeriodControlCalculatorTest {

    private final PeriodControlCalculator calculator =
            new PeriodControlCalculator();

    @Test
    void healthyPositionRemainsOnTrack() {

        var evaluation =
                calculator.evaluate(
                        new ControlInput(
                                new BigDecimal("1000000"),
                                LocalDate.of(
                                        2027,
                                        3,
                                        31),

                                new BigDecimal("1000000"),

                                new BigDecimal("600000"),
                                new BigDecimal("590000"),

                                new BigDecimal("995000"),
                                LocalDate.of(
                                        2027,
                                        4,
                                        2),

                                new BigDecimal("1.02"),
                                new BigDecimal("0.983"),

                                "ON_TRACK",
                                "ON_TRACK",
                                "ON_TRACK"));

        assertEquals(
                PeriodControlRiskLevel.ON_TRACK,
                evaluation.controlRisk());

        assertTrue(
                evaluation.controlScore()
                        >= 80);
    }

    @Test
    void materialCostAndFinishVarianceBecomesAtRisk() {

        var evaluation =
                calculator.evaluate(
                        new ControlInput(
                                new BigDecimal("1000000"),
                                LocalDate.of(
                                        2027,
                                        3,
                                        31),

                                new BigDecimal("1000000"),

                                new BigDecimal("650000"),
                                new BigDecimal("520000"),

                                new BigDecimal("1150000"),
                                LocalDate.of(
                                        2027,
                                        5,
                                        15),

                                new BigDecimal("0.80"),
                                new BigDecimal("0.80"),

                                "AT_RISK",
                                "AT_RISK",
                                "WATCH"));

        assertEquals(
                PeriodControlRiskLevel.AT_RISK,
                evaluation.controlRisk());

        assertTrue(
                evaluation.costVarianceToBaseline()
                        .signum()
                        < 0);

        assertTrue(
                evaluation.finishVarianceDays()
                        > 30);
    }

    @Test
    void earnedAndPlannedProgressComeFromEvmValues() {

        var evaluation =
                calculator.evaluate(
                        new ControlInput(
                                new BigDecimal("1000000"),
                                LocalDate.of(
                                        2027,
                                        3,
                                        31),

                                new BigDecimal("1000000"),

                                new BigDecimal("500000"),
                                new BigDecimal("420000"),

                                new BigDecimal("1000000"),
                                LocalDate.of(
                                        2027,
                                        3,
                                        31),

                                BigDecimal.ONE,
                                new BigDecimal("0.84"),

                                "WATCH",
                                "WATCH",
                                "WATCH"));

        assertEquals(
                50,
                evaluation.plannedProgressPercentage());

        assertEquals(
                42,
                evaluation.earnedProgressPercentage());
    }
}
