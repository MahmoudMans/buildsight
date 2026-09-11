package com.buildsight.platform.recovery.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.ChangeImpactEvaluationResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.RecoveryOptionEvaluationResponse;
import com.buildsight.platform.recovery.domain.ProjectChangeImpactSimulation;
import com.buildsight.platform.recovery.domain.ProjectRecoveryOption;
import com.buildsight.platform.recovery.domain.RecoveryRiskLevel;

import org.springframework.stereotype.Component;

@Component
public class ChangeImpactSimulationEngine {

    private static final BigDecimal ONE_HUNDRED =
            new BigDecimal("100");

    private static final BigDecimal TIME_RELATED_COST_FACTOR =
            new BigDecimal("0.08");

    public ChangeImpactEvaluationResponse impact(
            ForecastIntelligenceResponse baseline,
            ProjectChangeImpactSimulation simulation) {

        BigDecimal baselineCost =
                money(
                        baseline.expectedForecastCost());

        BigDecimal remainingCost =
                baselineCost
                        .subtract(
                                baseline.actualCost())
                        .max(
                                BigDecimal.ZERO);

        long remainingDays =
                Math.max(
                        1,
                        ChronoUnit.DAYS.between(
                                baseline.dataDate(),
                                baseline.expectedForecastFinishDate()));

        double productivityFactor =
                factor(
                        simulation.getProductivityChangePercentage());

        double resourceFactor =
                factor(
                        simulation.getResourceCapacityChangePercentage());

        long productivityDays =
                Math.round(
                        remainingDays
                                * (
                                        1
                                        / productivityFactor
                                        - 1));

        long resourceDays =
                Math.round(
                        remainingDays
                                * (
                                        1
                                        / resourceFactor
                                        - 1)
                                * 0.60);

        long scheduleImpactDays =
                Math.max(
                        0,
                        simulation.getDelayDays()
                                + simulation.getProcurementDelayDays()
                                + productivityDays
                                + resourceDays);

        BigDecimal dailyRemainingCost =
                remainingCost
                        .divide(
                                BigDecimal.valueOf(
                                        remainingDays),
                                8,
                                RoundingMode.HALF_UP);

        BigDecimal extensionCost =
                money(
                        dailyRemainingCost
                                .multiply(
                                        BigDecimal.valueOf(
                                                scheduleImpactDays))
                                .multiply(
                                        TIME_RELATED_COST_FACTOR));

        BigDecimal productivityCost =
                performanceCost(
                        remainingCost,
                        productivityFactor,
                        new BigDecimal("0.30"));

        BigDecimal resourceCost =
                performanceCost(
                        remainingCost,
                        resourceFactor,
                        new BigDecimal("0.20"));

        BigDecimal directCost =
                money(
                        simulation.getDirectCostImpact());

        BigDecimal positiveExposure =
                directCost
                        .max(
                                BigDecimal.ZERO)
                        .add(
                                productivityCost.max(
                                        BigDecimal.ZERO))
                        .add(
                                resourceCost.max(
                                        BigDecimal.ZERO))
                        .add(
                                extensionCost.max(
                                        BigDecimal.ZERO));

        BigDecimal contingency =
                money(
                        positiveExposure.multiply(
                                rate(
                                        simulation.getRiskContingencyPercentage())));

        BigDecimal totalExposure =
                money(
                        directCost
                                .add(
                                        productivityCost)
                                .add(
                                        resourceCost)
                                .add(
                                        extensionCost)
                                .add(
                                        contingency));

        BigDecimal impactedCost =
                money(
                        baselineCost
                                .add(
                                        totalExposure)
                                .max(
                                        baseline.actualCost()));

        LocalDate impactedFinish =
                baseline.expectedForecastFinishDate()
                        .plusDays(
                                scheduleImpactDays);

        double score =
                impactScore(
                        baseline,
                        totalExposure,
                        scheduleImpactDays);

        RecoveryRiskLevel risk =
                risk(
                        score);

        return new ChangeImpactEvaluationResponse(
                baselineCost,

                directCost,
                productivityCost,
                resourceCost,
                extensionCost,
                contingency,

                totalExposure,

                impactedCost,

                baseline.expectedForecastFinishDate(),
                impactedFinish,

                scheduleImpactDays,

                roundOne(
                        score),

                risk);
    }

    public RecoveryOptionEvaluationResponse recovery(
            ForecastIntelligenceResponse baseline,
            ChangeImpactEvaluationResponse impact,
            ProjectRecoveryOption option) {

        long remainingDays =
                Math.max(
                        1,
                        ChronoUnit.DAYS.between(
                                baseline.dataDate(),
                                baseline.expectedForecastFinishDate()));

        long productivityRecovery =
                Math.max(
                        0,
                        Math.round(
                                remainingDays
                                        * option.getProductivityImprovementPercentage()
                                                .doubleValue()
                                        / 100.0
                                        * 0.70));

        long resourceRecovery =
                Math.max(
                        0,
                        Math.round(
                                remainingDays
                                        * option.getResourceCapacityImprovementPercentage()
                                                .doubleValue()
                                        / 100.0
                                        * 0.50));

        long potentialRecovery =
                Math.max(
                        0,
                        option.getScheduleRecoveryDays()
                                + option.getProcurementRecoveryDays()
                                + productivityRecovery
                                + resourceRecovery);

        long recoverableDays =
                Math.min(
                        impact.scheduleImpactDays(),
                        potentialRecovery);

        long residualDelayDays =
                Math.max(
                        0,
                        impact.scheduleImpactDays()
                                - recoverableDays);

        LocalDate recoveredFinish =
                impact.impactedForecastFinishDate()
                        .minusDays(
                                recoverableDays);

        BigDecimal remainingCost =
                baseline.expectedForecastCost()
                        .subtract(
                                baseline.actualCost())
                        .max(
                                BigDecimal.ZERO);

        BigDecimal dailyRemainingCost =
                remainingCost
                        .divide(
                                BigDecimal.valueOf(
                                        remainingDays),
                                8,
                                RoundingMode.HALF_UP);

        BigDecimal timeRelatedSavings =
                money(
                        dailyRemainingCost
                                .multiply(
                                        BigDecimal.valueOf(
                                                recoverableDays))
                                .multiply(
                                        TIME_RELATED_COST_FACTOR));

        BigDecimal recoveryCostVsImpacted =
                money(
                        option.getIncrementalCost()
                                .subtract(
                                        timeRelatedSavings));

        BigDecimal recoveredForecastCost =
                money(
                        impact.impactedForecastCost()
                                .add(
                                        recoveryCostVsImpacted)
                                .max(
                                        baseline.actualCost()));

        BigDecimal costPerDayRecovered =
                recoverableDays == 0
                        ? BigDecimal.ZERO
                                .setScale(
                                        2,
                                        RoundingMode.HALF_UP)
                        : money(
                                recoveryCostVsImpacted
                                        .divide(
                                                BigDecimal.valueOf(
                                                        recoverableDays),
                                                8,
                                                RoundingMode.HALF_UP));

        double recoveryRatio =
                impact.scheduleImpactDays() == 0
                        ? 1
                        : recoverableDays
                                / (double) impact.scheduleImpactDays();

        double costPenalty =
                baseline.expectedForecastCost()
                                .signum()
                        == 0
                        ? 0
                        : Math.max(
                                0,
                                recoveryCostVsImpacted
                                        .divide(
                                                baseline.expectedForecastCost(),
                                                8,
                                                RoundingMode.HALF_UP)
                                        .doubleValue()
                                        * 100);

        double score =
                70
                        + recoveryRatio
                                * 25
                        - Math.min(
                                35,
                                residualDelayDays
                                        * 1.5)
                        - Math.min(
                                20,
                                costPenalty
                                        * 1.5)
                        - option.getResidualRiskPercentage()
                                .doubleValue()
                                * 0.25;

        score =
                clamp(
                        score,
                        0,
                        100);

        return new RecoveryOptionEvaluationResponse(
                recoveredForecastCost,
                recoveryCostVsImpacted,
                recoveredFinish,
                recoverableDays,
                residualDelayDays,
                costPerDayRecovered,
                roundOne(
                        score),
                risk(
                        score));
    }

    private double impactScore(
            ForecastIntelligenceResponse baseline,
            BigDecimal costExposure,
            long scheduleImpactDays) {

        double score =
                baseline.predictiveScore();

        if (
                baseline.expectedForecastCost()
                        .signum()
                > 0
                && costExposure.signum()
                > 0) {

            double ratio =
                    costExposure.divide(
                                    baseline.expectedForecastCost(),
                                    8,
                                    RoundingMode.HALF_UP)
                            .doubleValue();

            score -=
                    Math.min(
                            35,
                            ratio
                                    * 100
                                    * 1.5);
        }

        score -=
                Math.min(
                        30,
                        scheduleImpactDays
                                * 0.75);

        return clamp(
                score,
                0,
                100);
    }

    private BigDecimal performanceCost(
            BigDecimal remainingCost,
            double factor,
            BigDecimal weighting) {

        BigDecimal variance =
                BigDecimal.valueOf(
                        1
                                / factor
                                - 1);

        return money(
                remainingCost
                        .multiply(
                                variance)
                        .multiply(
                                weighting));
    }

    private double factor(
            BigDecimal percentage) {

        double value =
                1
                        + percentage.doubleValue()
                        / 100.0;

        return clamp(
                value,
                0.50,
                1.50);
    }

    private BigDecimal rate(
            BigDecimal percentage) {

        return percentage.divide(
                ONE_HUNDRED,
                8,
                RoundingMode.HALF_UP);
    }

    private RecoveryRiskLevel risk(
            double score) {

        if (score >= 80) {

            return RecoveryRiskLevel.ON_TRACK;
        }

        if (score >= 60) {

            return RecoveryRiskLevel.WATCH;
        }

        return RecoveryRiskLevel.AT_RISK;
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
}
