package com.buildsight.platform.production.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.production.api.ProductionIntelligenceResponse;
import com.buildsight.platform.production.api.ProductionRiskLevel;
import com.buildsight.platform.production.domain.ProjectSiteReport;
import com.buildsight.platform.production.domain.ProjectWorkPackage;
import com.buildsight.platform.production.domain.SiteReportProductionEntry;
import com.buildsight.platform.production.domain.SiteReportStatus;
import com.buildsight.platform.production.domain.WeatherCondition;
import com.buildsight.platform.production.domain.WorkPackageStatus;

import org.junit.jupiter.api.Test;

class ProductionIntelligenceServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    private final ProductionIntelligenceService
            service =
            new ProductionIntelligenceService(
                    CLOCK);

    @Test
    void blockedLowProductivityProductionCreatesRisk() {

        ProjectWorkPackage packageItem =
                packageItem(
                        WorkPackageStatus.BLOCKED);

        ProjectSiteReport report =
                approvedReport(
                        LocalDate.of(
                                2026,
                                9,
                                9));

        SiteReportProductionEntry entry =
                SiteReportProductionEntry.create(
                        UUID.randomUUID(),
                        report.getId(),
                        packageItem.getId(),
                        new BigDecimal(
                                "300.000"),
                        new BigDecimal(
                                "1800.00"),
                        new BigDecimal(
                                "200.00"),
                        8,
                        "Low productivity");

        ProductionIntelligenceResponse result =
                service.calculate(
                        List.of(
                                packageItem),
                        List.of(
                                report),
                        List.of(
                                entry));

        assertEquals(
                1,
                result.blockedPackages());

        assertTrue(
                result.overallProductivityIndex()
                        < 1.0);

        assertTrue(
                result.productionScore()
                        < 60);

        assertEquals(
                ProductionRiskLevel.AT_RISK,
                result.productionRisk());
    }

    @Test
    void strongRecentProductionIsOnTrack() {

        ProjectWorkPackage packageItem =
                packageItem(
                        WorkPackageStatus.IN_PROGRESS);

        ProjectSiteReport report =
                approvedReport(
                        LocalDate.of(
                                2026,
                                9,
                                9));

        SiteReportProductionEntry entry =
                SiteReportProductionEntry.create(
                        UUID.randomUUID(),
                        report.getId(),
                        packageItem.getId(),
                        new BigDecimal(
                                "720.000"),
                        new BigDecimal(
                                "2200.00"),
                        new BigDecimal(
                                "180.00"),
                        12,
                        "Strong output");

        ProductionIntelligenceResponse result =
                service.calculate(
                        List.of(
                                packageItem),
                        List.of(
                                report),
                        List.of(
                                entry));

        assertEquals(
                false,
                result.reportingStale());

        assertTrue(
                result.averagePackageCompletionPercentage()
                        >= 70);

        assertEquals(
                ProductionRiskLevel.ON_TRACK,
                result.productionRisk());

        assertTrue(
                result.productionScore()
                        >= 80);
    }

    @Test
    void draftReportDoesNotCountTowardAcceptedProduction() {

        ProjectWorkPackage packageItem =
                packageItem(
                        WorkPackageStatus.IN_PROGRESS);

        ProjectSiteReport report =
                ProjectSiteReport.create(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "SR-DRAFT",
                        LocalDate.of(
                                2026,
                                9,
                                9),
                        WeatherCondition.CLEAR,
                        "Draft");

        SiteReportProductionEntry entry =
                SiteReportProductionEntry.create(
                        UUID.randomUUID(),
                        report.getId(),
                        packageItem.getId(),
                        new BigDecimal(
                                "500.000"),
                        new BigDecimal(
                                "1000.00"),
                        BigDecimal.ZERO,
                        10,
                        "Draft");

        ProductionIntelligenceResponse result =
                service.calculate(
                        List.of(
                                packageItem),
                        List.of(
                                report),
                        List.of(
                                entry));

        assertEquals(
                0,
                result.acceptedSiteReports());

        assertEquals(
                0.0,
                result.averagePackageCompletionPercentage());
    }

    private ProjectWorkPackage packageItem(
            WorkPackageStatus status) {

        ProjectWorkPackage packageItem =
                ProjectWorkPackage.create(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "WP-001",
                        "Test Work",
                        "Testing",
                        "m2",
                        new BigDecimal(
                                "1000.000"),
                        new BigDecimal(
                                "3000.00"),
                        LocalDate.of(
                                2026,
                                7,
                                1),
                        LocalDate.of(
                                2026,
                                11,
                                1));

        packageItem.update(
                packageItem.getName(),
                packageItem.getDescription(),
                packageItem.getUnit(),
                packageItem.getPlannedQuantity(),
                packageItem.getPlannedLaborHours(),
                packageItem.getPlannedStartDate(),
                packageItem.getPlannedEndDate(),
                status,
                status == WorkPackageStatus.BLOCKED
                        ? "Constraint"
                        : null,
                LocalDate.of(
                        2026,
                        7,
                        1));

        return packageItem;
    }

    private ProjectSiteReport approvedReport(
            LocalDate date) {

        ProjectSiteReport report =
                ProjectSiteReport.create(
                        UUID.randomUUID(),
                        UUID.randomUUID(),
                        "SR-001",
                        date,
                        WeatherCondition.CLEAR,
                        "Approved");

        report.update(
                date,
                WeatherCondition.CLEAR,
                "Approved",
                SiteReportStatus.SUBMITTED);

        report.update(
                date,
                WeatherCondition.CLEAR,
                "Approved",
                SiteReportStatus.APPROVED);

        return report;
    }
}
