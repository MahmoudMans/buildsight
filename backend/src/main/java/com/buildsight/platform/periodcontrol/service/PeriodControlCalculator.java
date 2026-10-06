package com.buildsight.platform.periodcontrol.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import com.buildsight.platform.periodcontrol.domain.PeriodControlRiskLevel;

import org.springframework.stereotype.Component;

@Component
public class PeriodControlCalculator {

    public ControlEvaluation evaluate(
            ControlInput input) {

        BigDecimal costVariance =
                money(
                        input.baselineCostTarget()
                                .subtract(
                                        input.expectedForecastCost()));

        long finishVarianceDays =
                ChronoUnit.DAYS.between(
                        input.baselineFinishTarget(),
                        input.expectedForecastFinishDate());

        double plannedProgress =
                percentage(
                        input.plannedValue(),
                        input.budgetAtCompletion());

        double earnedProgress =
                percentage(
                        input.earnedValue(),
                        input.budgetAtCompletion());

        double score =
                100;

        if (costVariance.signum() < 0) {

            double overrunPercentage =
                    input.baselineCostTarget()
                                    .signum()
                            == 0
                            ? 0
                            : costVariance
                                    .abs()
                                    .divide(
                                            input.baselineCostTarget(),
                                            8,
                                            RoundingMode.HALF_UP)
                                    .doubleValue()
                                    * 100;

            score -=
                    Math.min(
                            35,
                            overrunPercentage
                                    * 2);
        }

        if (finishVarianceDays > 0) {

            score -=
                    Math.min(
                            30,
                            finishVarianceDays
                                    * 1.0);
        }

        if (
                input.costPerformanceIndex()
                        .doubleValue()
                < 1) {

            score -=
                    Math.min(
                            15,
                            (
                                    1
                                    - input.costPerformanceIndex()
                                            .doubleValue())
                                    * 50);
        }

        if (
                input.schedulePerformanceIndex()
                        .doubleValue()
                < 1) {

            score -=
                    Math.min(
                            15,
                            (
                                    1
                                    - input.schedulePerformanceIndex()
                                            .doubleValue())
                                    * 50);
        }

        score -=
                riskPenalty(
                        input.predictiveRisk());

        score -=
                riskPenalty(
                        input.governanceRisk());

        score -=
                riskPenalty(
                        input.recoveryRisk());

        score =
                clamp(
                        score,
                        0,
                        100);

        return new ControlEvaluation(
                costVariance,
                finishVarianceDays,
                roundTwo(
                        plannedProgress),
                roundTwo(
                        earnedProgress),
                roundOne(
                        score),
                risk(
                        score));
    }

    private double percentage(
            BigDecimal numerator,
            BigDecimal denominator) {

        if (denominator.signum() == 0) {
            return 0;
        }

        return clamp(
                numerator.divide(
                                denominator,
                                8,
                                RoundingMode.HALF_UP)
                        .doubleValue()
                        * 100,
                0,
                100);
    }

    private double riskPenalty(
            String risk) {

        if ("AT_RISK".equalsIgnoreCase(
                risk)) {

            return 10;
        }

        if ("WATCH".equalsIgnoreCase(
                risk)) {

            return 4;
        }

        return 0;
    }

    private PeriodControlRiskLevel risk(
            double score) {

        if (score >= 80) {
            return PeriodControlRiskLevel.ON_TRACK;
        }

        if (score >= 60) {
            return PeriodControlRiskLevel.WATCH;
        }

        return PeriodControlRiskLevel.AT_RISK;
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
                                * 10)
                / 10.0;
    }

    private double roundTwo(
            double value) {

        return Math.round(
                        value
                                * 100)
                / 100.0;
    }

    private double clamp(
            double value,
            double minimum,
            double maximum) {

        return Math.max(
                minimum,
                Math.min(
                        maximum,
                        value));
    }

    public record ControlInput(
            BigDecimal baselineCostTarget,
            LocalDate baselineFinishTarget,

            BigDecimal budgetAtCompletion,

            BigDecimal plannedValue,
            BigDecimal earnedValue,

            BigDecimal expectedForecastCost,
            LocalDate expectedForecastFinishDate,

            BigDecimal costPerformanceIndex,
            BigDecimal schedulePerformanceIndex,

            String predictiveRisk,
            String governanceRisk,
            String recoveryRisk) {
    }

    public record ControlEvaluation(
            BigDecimal costVarianceToBaseline,
            long finishVarianceDays,

            double plannedProgressPercentage,
            double earnedProgressPercentage,

            double controlScore,
            PeriodControlRiskLevel controlRisk) {
    }
}
