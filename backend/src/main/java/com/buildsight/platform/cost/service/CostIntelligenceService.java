package com.buildsight.platform.cost.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.buildsight.platform.cost.api.CostIntelligenceResponse;
import com.buildsight.platform.cost.api.CostRiskLevel;
import com.buildsight.platform.cost.domain.CommitmentStatus;
import com.buildsight.platform.cost.domain.ProjectActualCost;
import com.buildsight.platform.cost.domain.ProjectBudgetLine;
import com.buildsight.platform.cost.domain.ProjectCommitment;
import com.buildsight.platform.project.domain.Project;

import org.springframework.stereotype.Service;

@Service
public class CostIntelligenceService {

    private static final BigDecimal ZERO =
            BigDecimal.ZERO.setScale(2);

    public CostIntelligenceResponse calculate(
            Project project,
            List<ProjectBudgetLine> budgetLines,
            List<ProjectCommitment> commitments,
            List<ProjectActualCost> actualCosts) {

        BigDecimal originalCostPlan =
                sum(
                        budgetLines.stream()
                                .map(
                                        ProjectBudgetLine::getOriginalBudget)
                                .toList());

        BigDecimal approvedChanges =
                sum(
                        budgetLines.stream()
                                .map(
                                        ProjectBudgetLine::getApprovedChanges)
                                .toList());

        BigDecimal revisedCostPlan =
                originalCostPlan.add(
                        approvedChanges);

        BigDecimal forecastPlan =
                sum(
                        budgetLines.stream()
                                .map(
                                        ProjectBudgetLine::getForecastCost)
                                .toList());

        BigDecimal totalActualCosts =
                sum(
                        actualCosts.stream()
                                .map(
                                        ProjectActualCost::getAmount)
                                .toList());

        Map<UUID, BigDecimal> actualByCommitment =
                actualByCommitment(
                        actualCosts);

        BigDecimal totalApprovedCommitments =
                commitments.stream()
                        .filter(
                                commitment ->
                                        commitment.getStatus()
                                                == CommitmentStatus.APPROVED
                                                || commitment.getStatus()
                                                == CommitmentStatus.CLOSED)
                        .map(
                                ProjectCommitment::getCommittedAmount)
                        .reduce(
                                ZERO,
                                BigDecimal::add);

        BigDecimal outstandingCommitments =
                commitments.stream()
                        .filter(
                                commitment ->
                                        commitment.getStatus()
                                                == CommitmentStatus.APPROVED)
                        .map(
                                commitment -> {
                                    BigDecimal invoiced =
                                            actualByCommitment
                                                    .getOrDefault(
                                                            commitment.getId(),
                                                            ZERO);

                                    BigDecimal remaining =
                                            commitment
                                                    .getCommittedAmount()
                                                    .subtract(
                                                            invoiced);

                                    return remaining
                                                    .compareTo(ZERO)
                                                    > 0
                                            ? remaining
                                            : ZERO;
                                })
                        .reduce(
                                ZERO,
                                BigDecimal::add);

        BigDecimal minimumCommittedForecast =
                totalActualCosts.add(
                        outstandingCommitments);

        BigDecimal forecastAtCompletion =
                forecastPlan.compareTo(
                                minimumCommittedForecast)
                                >= 0
                        ? forecastPlan
                        : minimumCommittedForecast;

        BigDecimal varianceAtCompletion =
                revisedCostPlan.subtract(
                        forecastAtCompletion);

        BigDecimal overrunAmount =
                varianceAtCompletion.signum() < 0
                        ? varianceAtCompletion
                                .abs()
                        : ZERO;

        BigDecimal unallocatedBudget =
                project.getApprovedBudget()
                        .subtract(
                                revisedCostPlan);

        double utilization =
                percentage(
                        totalActualCosts,
                        revisedCostPlan);

        double exposure =
                percentage(
                        totalActualCosts.add(
                                outstandingCommitments),
                        revisedCostPlan);

        double forecastVariancePercentage =
                revisedCostPlan.signum() == 0
                        ? 0
                        : forecastAtCompletion
                                .subtract(
                                        revisedCostPlan)
                                .multiply(
                                        new BigDecimal("100"))
                                .divide(
                                        revisedCostPlan,
                                        4,
                                        RoundingMode.HALF_UP)
                                .doubleValue();

        double costScore =
                calculateCostScore(
                        revisedCostPlan,
                        overrunAmount);

        CostRiskLevel risk =
                calculateRisk(
                        revisedCostPlan,
                        overrunAmount);

        return new CostIntelligenceResponse(
                money(
                        project.getApprovedBudget()),
                money(originalCostPlan),
                money(approvedChanges),
                money(revisedCostPlan),
                money(unallocatedBudget),
                money(
                        totalApprovedCommitments),
                money(
                        outstandingCommitments),
                money(totalActualCosts),
                money(
                        forecastAtCompletion),
                money(
                        varianceAtCompletion),
                money(overrunAmount),
                roundOne(utilization),
                roundOne(exposure),
                roundOne(
                        forecastVariancePercentage),
                roundOne(costScore),
                risk,
                "Cost Intelligence compares the revised cost plan with actual expenditure, remaining approved commitments and line-level forecasts. Forecast at Completion uses the higher of the explicit cost forecast and actual-plus-outstanding committed exposure, preventing linked invoices from being double-counted.");
    }

    private Map<UUID, BigDecimal> actualByCommitment(
            List<ProjectActualCost> actualCosts) {

        Map<UUID, BigDecimal> result =
                new HashMap<>();

        for (ProjectActualCost actual :
                actualCosts) {

            if (actual.getCommitmentId()
                    == null) {
                continue;
            }

            result.merge(
                    actual.getCommitmentId(),
                    actual.getAmount(),
                    BigDecimal::add);
        }

        return result;
    }

    private BigDecimal sum(
            List<BigDecimal> values) {

        return values.stream()
                .reduce(
                        ZERO,
                        BigDecimal::add);
    }

    private double calculateCostScore(
            BigDecimal revisedCostPlan,
            BigDecimal overrunAmount) {

        if (revisedCostPlan.signum() <= 0) {
            return 60.0;
        }

        if (overrunAmount.signum() <= 0) {
            return 100.0;
        }

        double overrunPercentage =
                percentage(
                        overrunAmount,
                        revisedCostPlan);

        return clamp(
                100.0
                        - overrunPercentage
                        * 5.0,
                0,
                100);
    }

    private CostRiskLevel calculateRisk(
            BigDecimal revisedCostPlan,
            BigDecimal overrunAmount) {

        if (revisedCostPlan.signum() <= 0) {
            return CostRiskLevel.NO_BASELINE;
        }

        if (overrunAmount.signum() <= 0) {
            return CostRiskLevel.ON_TRACK;
        }

        double overrunPercentage =
                percentage(
                        overrunAmount,
                        revisedCostPlan);

        if (overrunPercentage <= 5.0) {
            return CostRiskLevel.WATCH;
        }

        return CostRiskLevel.AT_RISK;
    }

    private double percentage(
            BigDecimal numerator,
            BigDecimal denominator) {

        if (denominator.signum() <= 0) {
            return 0;
        }

        return numerator
                .multiply(
                        new BigDecimal("100"))
                .divide(
                        denominator,
                        4,
                        RoundingMode.HALF_UP)
                .doubleValue();
    }

    private BigDecimal money(
            BigDecimal value) {

        return value.setScale(
                2,
                RoundingMode.HALF_UP);
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

    private double roundOne(
            double value) {

        return Math.round(
                        value * 10.0)
                / 10.0;
    }
}
