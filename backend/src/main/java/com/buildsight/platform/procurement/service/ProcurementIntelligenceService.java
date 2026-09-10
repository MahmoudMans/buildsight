package com.buildsight.platform.procurement.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.buildsight.platform.procurement.api.ProcurementIntelligenceResponse;
import com.buildsight.platform.procurement.api.ProcurementRiskLevel;
import com.buildsight.platform.procurement.domain.ProcurementBid;
import com.buildsight.platform.procurement.domain.ProcurementPackage;
import com.buildsight.platform.procurement.domain.ProcurementPackageStatus;
import com.buildsight.platform.procurement.domain.Supplier;
import com.buildsight.platform.procurement.domain.SupplierPerformanceEvaluation;
import com.buildsight.platform.procurement.domain.SupplierQualificationStatus;

import org.springframework.stereotype.Service;

@Service
public class ProcurementIntelligenceService {

    private static final BigDecimal ZERO =
            BigDecimal.ZERO.setScale(2);

    private final Clock clock;

    public ProcurementIntelligenceService(
            Clock clock) {

        this.clock = clock;
    }

    public ProcurementIntelligenceResponse calculate(
            List<ProcurementPackage> packages,
            List<ProcurementBid> bids,
            List<Supplier> suppliers,
            List<SupplierPerformanceEvaluation> evaluations) {

        if (packages.isEmpty()) {
            return new ProcurementIntelligenceResponse(
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    ZERO,
                    ZERO,
                    0,
                    75.0,
                    0,
                    70.0,
                    ProcurementRiskLevel.NO_DATA,
                    "No procurement packages have been established yet. BuildSight applies a neutral procurement score until a procurement plan exists.");
        }

        LocalDate today =
                LocalDate.now(
                        clock);

        Map<UUID, Supplier> supplierMap =
                suppliers.stream()
                        .collect(
                                Collectors.toMap(
                                        Supplier::getId,
                                        Function.identity()));

        Map<UUID, Long> bidCounts =
                bids.stream()
                        .collect(
                                Collectors.groupingBy(
                                        ProcurementBid::getProcurementPackageId,
                                        Collectors.counting()));

        long awardedPackages =
                packages.stream()
                        .filter(
                                this::isAwarded)
                        .count();

        long openPackages =
                packages.stream()
                        .filter(
                                packageItem ->
                                        !isTerminal(
                                                packageItem))
                        .count();

        long delayedPackages =
                packages.stream()
                        .filter(
                                packageItem ->
                                        isDelayed(
                                                packageItem,
                                                today))
                        .count();

        long maximumAwardDelayDays =
                packages.stream()
                        .mapToLong(
                                packageItem ->
                                        awardDelayDays(
                                                packageItem,
                                                today))
                        .max()
                        .orElse(0);

        List<ProcurementPackage> competitionEligible =
                packages.stream()
                        .filter(
                                packageItem ->
                                        packageItem.getStatus()
                                                        != ProcurementPackageStatus.PLANNING
                                                && packageItem.getStatus()
                                                        != ProcurementPackageStatus.CANCELLED)
                        .toList();

        long packagesWithCompetition =
                competitionEligible.stream()
                        .filter(
                                packageItem ->
                                        bidCounts.getOrDefault(
                                                        packageItem.getId(),
                                                        0L)
                                                >= 2)
                        .count();

        double competitionCoverage =
                competitionEligible.isEmpty()
                        ? 100.0
                        : packagesWithCompetition
                                * 100.0
                                / competitionEligible.size();

        long conditionalAwards =
                packages.stream()
                        .filter(
                                this::isAwarded)
                        .filter(
                                packageItem -> {
                                    Supplier supplier =
                                            supplierMap.get(
                                                    packageItem.getAwardedSupplierId());

                                    return supplier != null
                                            && supplier.getQualificationStatus()
                                                    != SupplierQualificationStatus.QUALIFIED;
                                })
                        .count();

        double averagePerformance =
                evaluations.isEmpty()
                        ? 75.0
                        : evaluations.stream()
                                .mapToDouble(
                                        SupplierPerformanceEvaluation::overallScore)
                                .average()
                                .orElse(75.0);

        long lowPerformanceEvaluations =
                evaluations.stream()
                        .filter(
                                evaluation ->
                                        evaluation.overallScore()
                                                < 60.0)
                        .count();

        BigDecimal estimatedValue =
                packages.stream()
                        .map(
                                ProcurementPackage::getEstimatedValue)
                        .reduce(
                                ZERO,
                                BigDecimal::add);

        BigDecimal awardedValue =
                packages.stream()
                        .map(
                                ProcurementPackage::getAwardedValue)
                        .filter(
                                value ->
                                        value != null)
                        .reduce(
                                ZERO,
                                BigDecimal::add);

        double score =
                100.0;

        score -=
                Math.min(
                        45.0,
                        delayedPackages
                                * 15.0);

        score -=
                conditionalAwards
                        * 10.0;

        score -=
                lowPerformanceEvaluations
                        * 8.0;

        score -=
                Math.max(
                        0,
                        70.0
                                - competitionCoverage)
                        * 0.20;

        score -=
                Math.max(
                        0,
                        75.0
                                - averagePerformance)
                        * 0.40;

        score =
                clamp(
                        score,
                        0,
                        100);

        ProcurementRiskLevel risk =
                score >= 80
                        ? ProcurementRiskLevel.ON_TRACK
                        : score >= 60
                                ? ProcurementRiskLevel.WATCH
                                : ProcurementRiskLevel.AT_RISK;

        return new ProcurementIntelligenceResponse(
                packages.size(),
                openPackages,
                awardedPackages,
                delayedPackages,
                conditionalAwards,
                lowPerformanceEvaluations,
                packagesWithCompetition,
                money(
                        estimatedValue),
                money(
                        awardedValue),
                roundOne(
                        competitionCoverage),
                roundOne(
                        averagePerformance),
                maximumAwardDelayDays,
                roundOne(
                        score),
                risk,
                "Procurement Intelligence combines award-date performance, tender competition, supplier qualification and supplier delivery performance. Delayed awards, conditional supplier awards and weak performance evaluations reduce the procurement score.");
    }

    private boolean isTerminal(
            ProcurementPackage packageItem) {

        return packageItem.getStatus()
                        == ProcurementPackageStatus.AWARDED
                || packageItem.getStatus()
                        == ProcurementPackageStatus.CLOSED
                || packageItem.getStatus()
                        == ProcurementPackageStatus.CANCELLED;
    }

    private boolean isAwarded(
            ProcurementPackage packageItem) {

        return packageItem.getStatus()
                        == ProcurementPackageStatus.AWARDED
                || packageItem.getStatus()
                        == ProcurementPackageStatus.CLOSED;
    }

    private boolean isDelayed(
            ProcurementPackage packageItem,
            LocalDate today) {

        if (packageItem.getStatus()
                == ProcurementPackageStatus.CANCELLED) {

            return false;
        }

        LocalDate effectiveDate =
                effectiveAwardDate(
                        packageItem,
                        today);

        return effectiveDate.isAfter(
                packageItem.getAwardDueDate());
    }

    private long awardDelayDays(
            ProcurementPackage packageItem,
            LocalDate today) {

        if (packageItem.getStatus()
                == ProcurementPackageStatus.CANCELLED) {

            return 0;
        }

        LocalDate effectiveDate =
                effectiveAwardDate(
                        packageItem,
                        today);

        long delay =
                ChronoUnit.DAYS.between(
                        packageItem.getAwardDueDate(),
                        effectiveDate);

        return Math.max(
                0,
                delay);
    }

    private LocalDate effectiveAwardDate(
            ProcurementPackage packageItem,
            LocalDate today) {

        if (packageItem.getAwardDate()
                != null) {

            return packageItem.getAwardDate();
        }

        LocalDate forecast =
                packageItem.getForecastAwardDate();

        if (today.isAfter(
                forecast)
                && !isTerminal(
                        packageItem)) {

            return today;
        }

        return forecast;
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
