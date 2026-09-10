package com.buildsight.platform.quality.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.quality.api.QualityIntelligenceResponse;
import com.buildsight.platform.quality.api.QualityRiskLevel;
import com.buildsight.platform.quality.domain.NcrCategory;
import com.buildsight.platform.quality.domain.NcrSeverity;
import com.buildsight.platform.quality.domain.ProjectNcr;
import com.buildsight.platform.quality.domain.ProjectQualityInspection;
import com.buildsight.platform.quality.domain.QualityDiscipline;
import com.buildsight.platform.quality.domain.QualityInspectionResult;
import com.buildsight.platform.quality.domain.QualityInspectionStatus;
import com.buildsight.platform.quality.domain.QualityInspectionType;

import org.junit.jupiter.api.Test;

class QualityIntelligenceServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    private final QualityIntelligenceService service =
            new QualityIntelligenceService(CLOCK);

    @Test
    void failedInspectionAndCriticalOverdueNcrCreateAtRiskCondition() {

        UUID projectId =
                UUID.randomUUID();

        ProjectQualityInspection inspection =
                ProjectQualityInspection.create(
                        UUID.randomUUID(),
                        projectId,
                        "INS-001",
                        "Structural inspection",
                        QualityInspectionType.CONSULTANT,
                        QualityDiscipline.STRUCTURAL,
                        LocalDate.of(
                                2026,
                                8,
                                20),
                        "Inspector",
                        "Test");

        inspection.update(
                inspection.getTitle(),
                inspection.getInspectionType(),
                inspection.getDiscipline(),
                inspection.getPlannedDate(),
                LocalDate.of(
                        2026,
                        8,
                        21),
                inspection.getInspectorName(),
                QualityInspectionStatus.COMPLETED,
                QualityInspectionResult.FAIL,
                inspection.getNotes(),
                LocalDate.of(
                        2026,
                        8,
                        21));

        ProjectNcr ncr =
                ProjectNcr.create(
                        UUID.randomUUID(),
                        projectId,
                        inspection.getId(),
                        "NCR-001",
                        "Critical defect",
                        "Non-compliant work",
                        NcrCategory.WORKMANSHIP,
                        NcrSeverity.CRITICAL,
                        LocalDate.of(
                                2026,
                                8,
                                22),
                        LocalDate.of(
                                2026,
                                9,
                                1),
                        "Manager");

        QualityIntelligenceResponse result =
                service.calculate(
                        List.of(inspection),
                        List.of(ncr),
                        List.of(),
                        List.of());

        assertEquals(
                1,
                result.failedInspections());

        assertEquals(
                1,
                result.criticalOpenNcrs());

        assertEquals(
                1,
                result.overdueNcrs());

        assertEquals(
                QualityRiskLevel.AT_RISK,
                result.qualityRisk());

        assertTrue(
                result.qualityScore()
                        < 60);
    }

    @Test
    void passingInspectionWithFutureHandoverIsOnTrack() {

        UUID projectId =
                UUID.randomUUID();

        ProjectQualityInspection inspection =
                ProjectQualityInspection.create(
                        UUID.randomUUID(),
                        projectId,
                        "INS-002",
                        "MEP inspection",
                        QualityInspectionType.INTERNAL,
                        QualityDiscipline.MEP,
                        LocalDate.of(
                                2026,
                                9,
                                1),
                        "Inspector",
                        null);

        inspection.update(
                inspection.getTitle(),
                inspection.getInspectionType(),
                inspection.getDiscipline(),
                inspection.getPlannedDate(),
                LocalDate.of(
                        2026,
                        9,
                        2),
                inspection.getInspectorName(),
                QualityInspectionStatus.COMPLETED,
                QualityInspectionResult.PASS,
                null,
                LocalDate.of(
                        2026,
                        9,
                        2));

        QualityIntelligenceResponse result =
                service.calculate(
                        List.of(inspection),
                        List.of(),
                        List.of(),
                        List.of());

        assertEquals(
                100,
                result.inspectionPassRatePercentage());

        assertEquals(
                QualityRiskLevel.ON_TRACK,
                result.qualityRisk());

        assertEquals(
                100,
                result.qualityScore());
    }

    @Test
    void emptyQualityRegistersProduceNeutralNoData() {

        QualityIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());

        assertEquals(
                75,
                result.qualityScore());

        assertEquals(
                QualityRiskLevel.NO_DATA,
                result.qualityRisk());
    }
}
