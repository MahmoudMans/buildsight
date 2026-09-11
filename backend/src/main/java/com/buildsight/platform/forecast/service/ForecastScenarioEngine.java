package com.buildsight.platform.forecast.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.forecast.api.ForecastModels.ForecastScenarioEvaluationResponse;
import com.buildsight.platform.forecast.domain.ForecastRiskLevel;
import com.buildsight.platform.forecast.domain.ProjectForecastScenario;

import org.springframework.stereotype.Component;

@Component
public class ForecastScenarioEngine {

    private static final BigDecimal ONE_HUNDRED =
            new BigDecimal("100");

    public ForecastScenarioEvaluationResponse evaluate(
            ForecastIntelligenceResponse current,
            ProjectForecastScenario scenario) {

        BigDecimal directAdjustment =
                rate(
                        scenario.getCostAdjustmentPercentage())
                        .add(
                                rate(
                                        scenario.getCommercialExposurePercentage()))
                        .add(
                                rate(
                                        scenario.getRiskContingencyPercentage()));

        double productivity =
                scenario.getProductivityMultiplier()
                        .doubleValue();

        double resources =
                scenario.getResourceCapacityMultiplier()
                        .doubleValue();

        double productivityCostPenalty =
                productivity < 1
                        ? (
                                1
                                / productivity
                                - 1)
                                * 0.40
                        : (
                                1
                                / productivity
                                - 1)
                                * 0.15;

        double resourceCostPenalty =
                resources < 1
                        ? (
                                1
                                / resources
                                - 1)
                                * 0.25
                        : (
                                1
                                / resources
                                - 1)
                                * 0.10;

        BigDecimal multiplier =
                BigDecimal.ONE
                        .add(
                                directAdjustment)
                        .add(
                                BigDecimal.valueOf(
                                        productivityCostPenalty))
                        .add(
                                BigDecimal.valueOf(
                                        resourceCostPenalty));

        multiplier =
                multiplier.max(
                        new BigDecimal(
                                "0.50"));

        BigDecimal expectedCost =
                money(
                        current.expectedForecastCost()
                                .multiply(
                                        multiplier));

        BigDecimal lowerRatio =
                safeRatio(
                        current.costForecastLower(),
                        current.expectedForecastCost(),
                        new BigDecimal(
                                "0.95"));

        BigDecimal upperRatio =
                safeRatio(
                        current.costForecastUpper(),
                        current.expectedForecastCost(),
                        new BigDecimal(
                                "1.10"));

        BigDecimal lower =
                money(
                        expectedCost.multiply(
                                lowerRatio));

        BigDecimal upper =
                money(
                        expectedCost.multiply(
                                upperRatio));

        BigDecimal impact =
                money(
                        expectedCost.subtract(
                                current.expectedForecastCost()));

        LocalDate baseFinish =
                current.expectedForecastFinishDate();

        long remainingDays =
                Math.max(
                        1,
                        ChronoUnit.DAYS.between(
                                current.dataDate(),
                                baseFinish));

        long productivityDays =
                Math.round(
                        remainingDays
                                * (
                                        1
                                        / productivity
                                        - 1));

        long resourceDays =
                Math.round(
                        remainingDays
                                * (
                                        1
                                        / resources
                                        - 1)
                                * 0.65);

        long finishImpactDays =
                scenario.getScheduleAdjustmentDays()
                        + scenario.getProcurementDelayDays()
                        + productivityDays
                        + resourceDays;

        LocalDate expectedFinish =
                baseFinish.plusDays(
                        finishImpactDays);

        long baseEarlySpread =
                Math.max(
                        0,
                        ChronoUnit.DAYS.between(
                                current.earliestForecastFinishDate(),
                                baseFinish));

        long baseLateSpread =
                Math.max(
                        0,
                        ChronoUnit.DAYS.between(
                                baseFinish,
                                current.latestForecastFinishDate()));

        LocalDate earliest =
                expectedFinish.minusDays(
                        baseEarlySpread);

        if (earliest.isBefore(
                current.dataDate())) {

            earliest =
                    current.dataDate();
        }

        LocalDate latest =
                expectedFinish.plusDays(
                        baseLateSpread);

        double score =
                current.predictiveScore();

        if (current.expectedForecastCost()
                        .signum()
                > 0) {

            double costImpactRate =
                    impact.divide(
                                    current.expectedForecastCost(),
                                    8,
                                    RoundingMode.HALF_UP)
                            .doubleValue();

            if (costImpactRate > 0) {

                score -=
                        Math.min(
                                30,
                                costImpactRate
                                        * 100);
            } else {

                score +=
                        Math.min(
                                8,
                                Math.abs(
                                        costImpactRate)
                                        * 50);
            }
        }

        if (finishImpactDays > 0) {

            score -=
                    Math.min(
                            25,
                            finishImpactDays
                                    * 0.75);

        } else if (finishImpactDays < 0) {

            score +=
                    Math.min(
                            6,
                            Math.abs(
                                    finishImpactDays)
                                    * 0.30);
        }

        score =
                Math.max(
                        0,
                        Math.min(
                                100,
                                score));

        ForecastRiskLevel risk =
                score >= 80
                        ? ForecastRiskLevel.ON_TRACK
                        : score >= 60
                                ? ForecastRiskLevel.WATCH
                                : ForecastRiskLevel.AT_RISK;

        return new ForecastScenarioEvaluationResponse(
                expectedCost,
                lower,
                upper,
                impact,
                expectedFinish,
                earliest,
                latest,
                finishImpactDays,
                roundOne(
                        score),
                risk);
    }

    private BigDecimal rate(
            BigDecimal percentage) {

        return percentage.divide(
                ONE_HUNDRED,
                8,
                RoundingMode.HALF_UP);
    }

    private BigDecimal safeRatio(
            BigDecimal numerator,
            BigDecimal denominator,
            BigDecimal fallback) {

        if (denominator.signum() == 0) {

            return fallback;
        }

        return numerator.divide(
                denominator,
                8,
                RoundingMode.HALF_UP);
    }

    private BigDecimal money(
            BigDecimal value) {

        return value.setScale(
                2,
                RoundingMode.HALF_UP);
    }

    private double roundOne(
            double value) {

        return Math.round(
                        value
                                * 10.0)
                / 10.0;
    }
}
