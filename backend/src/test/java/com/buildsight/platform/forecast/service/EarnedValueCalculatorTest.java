package com.buildsight.platform.forecast.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;

import org.junit.jupiter.api.Test;

class EarnedValueCalculatorTest {

    private final EarnedValueCalculator calculator =
            new EarnedValueCalculator();

    @Test
    void calculatesCoreEarnedValueMetrics() {

        var result =
                calculator.calculate(
                        new BigDecimal(
                                "100000"),
                        50,
                        40,
                        new BigDecimal(
                                "50000"));

        assertEquals(
                new BigDecimal(
                        "100000.00"),
                result.bac());

        assertEquals(
                new BigDecimal(
                        "50000.00"),
                result.plannedValue());

        assertEquals(
                new BigDecimal(
                        "40000.00"),
                result.earnedValue());

        assertEquals(
                new BigDecimal(
                        "50000.00"),
                result.actualCost());

        assertEquals(
                new BigDecimal(
                        "-10000.00"),
                result.costVariance());

        assertEquals(
                new BigDecimal(
                        "-10000.00"),
                result.scheduleVariance());

        assertEquals(
                new BigDecimal(
                        "0.8000"),
                result.cpi());

        assertEquals(
                new BigDecimal(
                        "0.8000"),
                result.spi());

        assertTrue(
                result.estimateAtCompletion()
                        .compareTo(
                                result.bac())
                        > 0);

        assertTrue(
                result.varianceAtCompletion()
                        .signum()
                        < 0);
    }

    @Test
    void healthyPerformanceKeepsCpiAndSpiAboveOne() {

        var result =
                calculator.calculate(
                        new BigDecimal(
                                "100000"),
                        40,
                        50,
                        new BigDecimal(
                                "40000"));

        assertTrue(
                result.cpi()
                        .compareTo(
                                BigDecimal.ONE)
                        > 0);

        assertTrue(
                result.spi()
                        .compareTo(
                                BigDecimal.ONE)
                        > 0);

        assertTrue(
                result.varianceAtCompletion()
                        .signum()
                        >= 0);
    }

    @Test
    void zeroProgressDoesNotProduceDivisionFailure() {

        var result =
                calculator.calculate(
                        new BigDecimal(
                                "100000"),
                        0,
                        0,
                        BigDecimal.ZERO);

        assertEquals(
                new BigDecimal(
                        "1.0000"),
                result.cpi());

        assertEquals(
                new BigDecimal(
                        "1.0000"),
                result.spi());

        assertEquals(
                new BigDecimal(
                        "100000.00"),
                result.estimateAtCompletion());
    }
}
