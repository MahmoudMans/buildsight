package com.buildsight.platform.forecast.service;

import java.math.BigDecimal;
import java.math.RoundingMode;

import org.springframework.stereotype.Component;

@Component
public class EarnedValueCalculator {

    private static final BigDecimal ONE_HUNDRED =
            new BigDecimal("100");

    public EarnedValueResult calculate(
            BigDecimal bac,
            double plannedProgressPercentage,
            double earnedProgressPercentage,
            BigDecimal actualCost) {

        BigDecimal normalizedBac =
                money(
                        nonNegative(
                                bac));

        BigDecimal normalizedAc =
                money(
                        nonNegative(
                                actualCost));

        BigDecimal plannedRate =
                percentageRate(
                        plannedProgressPercentage);

        BigDecimal earnedRate =
                percentageRate(
                        earnedProgressPercentage);

        BigDecimal plannedValue =
                money(
                        normalizedBac.multiply(
                                plannedRate));

        BigDecimal earnedValue =
                money(
                        normalizedBac.multiply(
                                earnedRate));

        BigDecimal costVariance =
                money(
                        earnedValue.subtract(
                                normalizedAc));

        BigDecimal scheduleVariance =
                money(
                        earnedValue.subtract(
                                plannedValue));

        BigDecimal cpi =
                ratio(
                        earnedValue,
                        normalizedAc);

        BigDecimal spi =
                ratio(
                        earnedValue,
                        plannedValue);

        BigDecimal performanceFactor =
                cpi.multiply(
                        spi);

        BigDecimal remainingBudgetedWork =
                normalizedBac
                        .subtract(
                                earnedValue)
                        .max(
                                BigDecimal.ZERO);

        BigDecimal estimateAtCompletion;

        if (performanceFactor.signum() > 0) {

            estimateAtCompletion =
                    normalizedAc.add(
                            remainingBudgetedWork.divide(
                                    performanceFactor,
                                    8,
                                    RoundingMode.HALF_UP));

        } else {

            estimateAtCompletion =
                    normalizedBac.max(
                            normalizedAc);
        }

        estimateAtCompletion =
                money(
                        estimateAtCompletion.max(
                                normalizedAc));

        BigDecimal estimateToComplete =
                money(
                        estimateAtCompletion
                                .subtract(
                                        normalizedAc)
                                .max(
                                        BigDecimal.ZERO));

        BigDecimal varianceAtCompletion =
                money(
                        normalizedBac.subtract(
                                estimateAtCompletion));

        BigDecimal remainingFunding =
                normalizedBac.subtract(
                        normalizedAc);

        BigDecimal tcpi =
                remainingFunding.signum() > 0
                        ? ratio(
                                remainingBudgetedWork,
                                remainingFunding)
                        : BigDecimal.ZERO.setScale(
                                4,
                                RoundingMode.HALF_UP);

        return new EarnedValueResult(
                normalizedBac,
                plannedValue,
                earnedValue,
                normalizedAc,
                costVariance,
                scheduleVariance,
                cpi,
                spi,
                estimateAtCompletion,
                estimateToComplete,
                varianceAtCompletion,
                tcpi);
    }

    private BigDecimal percentageRate(
            double percentage) {

        double normalized =
                Math.max(
                        0,
                        Math.min(
                                100,
                                percentage));

        return BigDecimal.valueOf(
                        normalized)
                .divide(
                        ONE_HUNDRED,
                        8,
                        RoundingMode.HALF_UP);
    }

    private BigDecimal ratio(
            BigDecimal numerator,
            BigDecimal denominator) {

        if (denominator.signum() == 0) {

            if (numerator.signum() == 0) {

                return BigDecimal.ONE.setScale(
                        4,
                        RoundingMode.HALF_UP);
            }

            return BigDecimal.ZERO.setScale(
                    4,
                    RoundingMode.HALF_UP);
        }

        return numerator.divide(
                denominator,
                4,
                RoundingMode.HALF_UP);
    }

    private BigDecimal nonNegative(
            BigDecimal value) {

        if (value == null) {
            return BigDecimal.ZERO;
        }

        return value.max(
                BigDecimal.ZERO);
    }

    private BigDecimal money(
            BigDecimal value) {

        return value.setScale(
                2,
                RoundingMode.HALF_UP);
    }

    public record EarnedValueResult(
            BigDecimal bac,
            BigDecimal plannedValue,
            BigDecimal earnedValue,
            BigDecimal actualCost,
            BigDecimal costVariance,
            BigDecimal scheduleVariance,
            BigDecimal cpi,
            BigDecimal spi,
            BigDecimal estimateAtCompletion,
            BigDecimal estimateToComplete,
            BigDecimal varianceAtCompletion,
            BigDecimal tcpi) {
    }
}
