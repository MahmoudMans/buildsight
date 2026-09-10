package com.buildsight.platform.production.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.buildsight.platform.production.api.ProductionIntelligenceResponse;
import com.buildsight.platform.production.api.ProductionRiskLevel;
import com.buildsight.platform.production.domain.ProjectSiteReport;
import com.buildsight.platform.production.domain.ProjectWorkPackage;
import com.buildsight.platform.production.domain.SiteReportProductionEntry;
import com.buildsight.platform.production.domain.SiteReportStatus;
import com.buildsight.platform.production.domain.WorkPackageStatus;

import org.springframework.stereotype.Service;

@Service
public class ProductionIntelligenceService {

    private static final BigDecimal ZERO =
            BigDecimal.ZERO.setScale(2);

    private final Clock clock;

    public ProductionIntelligenceService(
            Clock clock) {

        this.clock =
                clock;
    }

    public ProductionIntelligenceResponse calculate(
            List<ProjectWorkPackage> packages,
            List<ProjectSiteReport> reports,
            List<SiteReportProductionEntry> entries) {

        if (packages.isEmpty()) {

            return new ProductionIntelligenceResponse(
                    0,
                    0,
                    0,
                    0,
                    reports.size(),
                    0,
                    0,
                    null,
                    false,
                    0,
                    0,
                    0,
                    ZERO,
                    ZERO,
                    1.0,
                    0,
                    70.0,
                    ProductionRiskLevel.NO_DATA,
                    "No work packages exist yet. BuildSight applies a neutral production score until the site-production baseline is established.");
        }

        LocalDate today =
                LocalDate.now(
                        clock);

        List<ProjectSiteReport> acceptedReports =
                reports.stream()
                        .filter(
                                this::isAccepted)
                        .toList();

        Set<UUID> acceptedReportIds =
                acceptedReports.stream()
                        .map(
                                ProjectSiteReport::getId)
                        .collect(
                                Collectors.toSet());

        List<SiteReportProductionEntry> acceptedEntries =
                entries.stream()
                        .filter(
                                entry ->
                                        acceptedReportIds.contains(
                                                entry.getSiteReportId()))
                        .toList();

        List<ProjectWorkPackage> measurablePackages =
                packages.stream()
                        .filter(
                                packageItem ->
                                        packageItem.getStatus()
                                                != WorkPackageStatus.CANCELLED)
                        .toList();

        Map<UUID, List<SiteReportProductionEntry>>
                entriesByPackage =
                acceptedEntries.stream()
                        .collect(
                                Collectors.groupingBy(
                                        SiteReportProductionEntry::getWorkPackageId));

        List<WorkPackageMetrics> metrics =
                measurablePackages.stream()
                        .map(
                                packageItem ->
                                        metricsFor(
                                                packageItem,
                                                entriesByPackage.getOrDefault(
                                                        packageItem.getId(),
                                                        List.of()),
                                                today))
                        .toList();

        long activePackages =
                packages.stream()
                        .filter(
                                packageItem ->
                                        packageItem.getStatus()
                                                == WorkPackageStatus.IN_PROGRESS
                                                || packageItem.getStatus()
                                                == WorkPackageStatus.BLOCKED)
                        .count();

        long blockedPackages =
                packages.stream()
                        .filter(
                                packageItem ->
                                        packageItem.getStatus()
                                                == WorkPackageStatus.BLOCKED)
                        .count();

        long completedPackages =
                packages.stream()
                        .filter(
                                packageItem ->
                                        packageItem.getStatus()
                                                == WorkPackageStatus.COMPLETED)
                        .count();

        double averageCompletion =
                metrics.stream()
                        .mapToDouble(
                                WorkPackageMetrics::completionPercentage)
                        .average()
                        .orElse(0);

        double averageExpected =
                metrics.stream()
                        .mapToDouble(
                                WorkPackageMetrics::expectedProgressPercentage)
                        .average()
                        .orElse(0);

        double productionVariance =
                averageCompletion
                        - averageExpected;

        BigDecimal totalLaborHours =
                acceptedEntries.stream()
                        .map(
                                SiteReportProductionEntry::getLaborHours)
                        .reduce(
                                ZERO,
                                BigDecimal::add);

        BigDecimal totalEquipmentHours =
                acceptedEntries.stream()
                        .map(
                                SiteReportProductionEntry::getEquipmentHours)
                        .reduce(
                                ZERO,
                                BigDecimal::add);

        double overallProductivityIndex =
                weightedProductivityIndex(
                        metrics);

        LocalDate latestAcceptedReportDate =
                acceptedReports.stream()
                        .map(
                                ProjectSiteReport::getReportDate)
                        .max(
                                LocalDate::compareTo)
                        .orElse(null);

        boolean reportingStale =
                activePackages > 0
                        && (latestAcceptedReportDate == null
                        || latestAcceptedReportDate.isBefore(
                                today.minusDays(7)));

        double weeklyTrend =
                weeklyProductionTrend(
                        measurablePackages,
                        acceptedReports,
                        acceptedEntries,
                        today);

        double lag =
                Math.max(
                        0,
                        averageExpected
                                - averageCompletion);

        double score =
                100.0;

        score -=
                Math.min(
                        35.0,
                        lag);

        score -=
                Math.min(
                        36.0,
                        blockedPackages
                                * 12.0);

        if (overallProductivityIndex
                < 1.0) {

            score -=
                    Math.min(
                            25.0,
                            (1.0
                                    - overallProductivityIndex)
                                    * 30.0);
        }

        if (reportingStale) {
            score -=
                    12.0;
        }

        if (weeklyTrend
                < -20.0) {

            score -=
                    Math.min(
                            10.0,
                            Math.abs(
                                    weeklyTrend)
                                    * 0.10);
        }

        score =
                clamp(
                        score,
                        0,
                        100);

        ProductionRiskLevel risk =
                score >= 80
                        ? ProductionRiskLevel.ON_TRACK
                        : score >= 60
                                ? ProductionRiskLevel.WATCH
                                : ProductionRiskLevel.AT_RISK;

        return new ProductionIntelligenceResponse(
                packages.size(),
                activePackages,
                blockedPackages,
                completedPackages,
                reports.size(),
                acceptedReports.size(),
                reports.stream()
                        .filter(
                                report ->
                                        report.getStatus()
                                                == SiteReportStatus.APPROVED)
                        .count(),
                latestAcceptedReportDate,
                reportingStale,
                roundOne(
                        averageCompletion),
                roundOne(
                        averageExpected),
                roundOne(
                        productionVariance),
                money(
                        totalLaborHours),
                money(
                        totalEquipmentHours),
                roundTwo(
                        overallProductivityIndex),
                roundOne(
                        weeklyTrend),
                roundOne(
                        score),
                risk,
                "Production Intelligence compares accepted site-report quantities with time-phased work-package expectations, labor productivity, blocked work fronts and recent reporting activity. Draft site reports are excluded from production metrics until submitted.");
    }

    public WorkPackageMetrics metricsFor(
            ProjectWorkPackage packageItem,
            List<SiteReportProductionEntry> acceptedEntries,
            LocalDate today) {

        BigDecimal actualQuantity =
                acceptedEntries.stream()
                        .map(
                                SiteReportProductionEntry::getQuantityCompleted)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal laborHours =
                acceptedEntries.stream()
                        .map(
                                SiteReportProductionEntry::getLaborHours)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        BigDecimal equipmentHours =
                acceptedEntries.stream()
                        .map(
                                SiteReportProductionEntry::getEquipmentHours)
                        .reduce(
                                BigDecimal.ZERO,
                                BigDecimal::add);

        double completion =
                percentage(
                        actualQuantity,
                        packageItem.getPlannedQuantity());

        completion =
                clamp(
                        completion,
                        0,
                        100);

        double expected =
                expectedProgress(
                        packageItem,
                        today);

        BigDecimal expectedQuantity =
                packageItem
                        .getPlannedQuantity()
                        .multiply(
                                BigDecimal.valueOf(
                                        expected))
                        .divide(
                                new BigDecimal("100"),
                                3,
                                RoundingMode.HALF_UP);

        BigDecimal quantityVariance =
                actualQuantity.subtract(
                        expectedQuantity);

        double plannedProductivity =
                rate(
                        packageItem.getPlannedQuantity(),
                        packageItem.getPlannedLaborHours());

        double actualProductivity =
                rate(
                        actualQuantity,
                        laborHours);

        double productivityIndex;

        if (plannedProductivity <= 0) {
            productivityIndex =
                    1.0;

        } else if (laborHours.signum() == 0) {
            productivityIndex =
                    actualQuantity.signum() == 0
                            ? 1.0
                            : 0.0;

        } else {
            productivityIndex =
                    actualProductivity
                            / plannedProductivity;
        }

        return new WorkPackageMetrics(
                quantity(
                        actualQuantity),
                roundOne(
                        completion),
                roundOne(
                        expected),
                quantity(
                        expectedQuantity),
                quantity(
                        quantityVariance),
                money(
                        laborHours),
                money(
                        equipmentHours),
                roundThree(
                        plannedProductivity),
                roundThree(
                        actualProductivity),
                roundTwo(
                        productivityIndex));
    }

    public List<SiteReportProductionEntry> acceptedEntries(
            List<ProjectSiteReport> reports,
            List<SiteReportProductionEntry> entries) {

        Set<UUID> accepted =
                reports.stream()
                        .filter(
                                this::isAccepted)
                        .map(
                                ProjectSiteReport::getId)
                        .collect(
                                Collectors.toSet());

        return entries.stream()
                .filter(
                        entry ->
                                accepted.contains(
                                        entry.getSiteReportId()))
                .toList();
    }

    private double expectedProgress(
            ProjectWorkPackage packageItem,
            LocalDate today) {

        if (packageItem.getStatus()
                == WorkPackageStatus.COMPLETED) {

            return 100;
        }

        if (today.isBefore(
                packageItem.getPlannedStartDate())) {

            return 0;
        }

        if (!today.isBefore(
                packageItem.getPlannedEndDate())) {

            return 100;
        }

        long totalDays =
                Math.max(
                        1,
                        ChronoUnit.DAYS.between(
                                packageItem.getPlannedStartDate(),
                                packageItem.getPlannedEndDate()));

        long elapsedDays =
                Math.max(
                        0,
                        ChronoUnit.DAYS.between(
                                packageItem.getPlannedStartDate(),
                                today));

        return clamp(
                elapsedDays
                        * 100.0
                        / totalDays,
                0,
                100);
    }

    private double weightedProductivityIndex(
            List<WorkPackageMetrics> metrics) {

        double numerator =
                0;

        double denominator =
                0;

        for (WorkPackageMetrics metric :
                metrics) {

            if (metric.actualLaborHours()
                    .signum() <= 0) {

                continue;
            }

            double weight =
                    metric.actualLaborHours()
                            .doubleValue();

            numerator +=
                    metric.productivityIndex()
                            * weight;

            denominator +=
                    weight;
        }

        if (denominator <= 0) {
            return 1.0;
        }

        return numerator
                / denominator;
    }

    private double weeklyProductionTrend(
            List<ProjectWorkPackage> packages,
            List<ProjectSiteReport> acceptedReports,
            List<SiteReportProductionEntry> acceptedEntries,
            LocalDate today) {

        if (packages.isEmpty()) {
            return 0;
        }

        Map<UUID, ProjectWorkPackage> packageMap =
                packages.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectWorkPackage::getId,
                                        Function.identity()));

        Map<UUID, LocalDate> reportDateMap =
                acceptedReports.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectSiteReport::getId,
                                        ProjectSiteReport::getReportDate));

        LocalDate currentStart =
                today.minusDays(6);

        LocalDate previousStart =
                today.minusDays(13);

        LocalDate previousEnd =
                today.minusDays(7);

        double currentNormalized =
                normalizedProduction(
                        acceptedEntries,
                        packageMap,
                        reportDateMap,
                        currentStart,
                        today);

        double previousNormalized =
                normalizedProduction(
                        acceptedEntries,
                        packageMap,
                        reportDateMap,
                        previousStart,
                        previousEnd);

        if (previousNormalized == 0) {

            return currentNormalized > 0
                    ? 100.0
                    : 0.0;
        }

        return (currentNormalized
                - previousNormalized)
                * 100.0
                / previousNormalized;
    }

    private double normalizedProduction(
            List<SiteReportProductionEntry> entries,
            Map<UUID, ProjectWorkPackage> packageMap,
            Map<UUID, LocalDate> reportDateMap,
            LocalDate start,
            LocalDate end) {

        double normalizedPoints =
                0;

        Set<UUID> representedPackages =
                new HashSet<>();

        for (SiteReportProductionEntry entry :
                entries) {

            LocalDate reportDate =
                    reportDateMap.get(
                            entry.getSiteReportId());

            if (reportDate == null
                    || reportDate.isBefore(start)
                    || reportDate.isAfter(end)) {

                continue;
            }

            ProjectWorkPackage packageItem =
                    packageMap.get(
                            entry.getWorkPackageId());

            if (packageItem == null) {
                continue;
            }

            normalizedPoints +=
                    percentage(
                            entry.getQuantityCompleted(),
                            packageItem.getPlannedQuantity());

            representedPackages.add(
                    packageItem.getId());
        }

        if (representedPackages.isEmpty()) {
            return 0;
        }

        return normalizedPoints
                / packagesCount(
                        packageMap);
    }

    private int packagesCount(
            Map<UUID, ProjectWorkPackage> packageMap) {

        return Math.max(
                1,
                packageMap.size());
    }

    private boolean isAccepted(
            ProjectSiteReport report) {

        return report.getStatus()
                        == SiteReportStatus.SUBMITTED
                || report.getStatus()
                        == SiteReportStatus.APPROVED;
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
                        6,
                        RoundingMode.HALF_UP)
                .doubleValue();
    }

    private double rate(
            BigDecimal quantity,
            BigDecimal hours) {

        if (hours.signum() <= 0) {
            return 0;
        }

        return quantity
                .divide(
                        hours,
                        6,
                        RoundingMode.HALF_UP)
                .doubleValue();
    }

    private BigDecimal quantity(
            BigDecimal value) {

        return value.setScale(
                3,
                RoundingMode.HALF_UP);
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
                        value
                                * 10.0)
                / 10.0;
    }

    private double roundTwo(
            double value) {

        return Math.round(
                        value
                                * 100.0)
                / 100.0;
    }

    private double roundThree(
            double value) {

        return Math.round(
                        value
                                * 1000.0)
                / 1000.0;
    }
}
