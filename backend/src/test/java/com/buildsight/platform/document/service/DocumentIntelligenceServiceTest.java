package com.buildsight.platform.document.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.document.api.DocumentIntelligenceResponse;
import com.buildsight.platform.document.api.InformationRiskLevel;
import com.buildsight.platform.document.domain.ProjectRfi;
import com.buildsight.platform.document.domain.ProjectTransmittal;
import com.buildsight.platform.document.domain.RfiPriority;

import org.junit.jupiter.api.Test;

class DocumentIntelligenceServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    private final DocumentIntelligenceService
            service =
            new DocumentIntelligenceService(
                    CLOCK);

    @Test
    void overdueCriticalRfiAndStaleTransmittalCreateWatchCondition() {

        UUID projectId =
                UUID.randomUUID();

        ProjectRfi rfi =
                ProjectRfi.create(
                        UUID.randomUUID(),
                        projectId,
                        "RFI-001",
                        "Critical design information",
                        "Provide construction information.",
                        "Site",
                        "Design",
                        LocalDate.of(
                                2026,
                                8,
                                20),
                        LocalDate.of(
                                2026,
                                9,
                                1),
                        RfiPriority.CRITICAL,
                        "RFI-001 Critical design information");

        ProjectTransmittal transmittal =
                ProjectTransmittal.create(
                        UUID.randomUUID(),
                        projectId,
                        "TR-001",
                        "Contractor",
                        "Construction issue",
                        LocalDate.of(
                                2026,
                                8,
                                25),
                        "Draft");

        DocumentIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(),
                        List.of(
                                rfi),
                        List.of(
                                transmittal));

        assertEquals(
                1,
                result.overdueRfis());

        assertEquals(
                1,
                result.criticalOpenRfis());

        assertEquals(
                1,
                result.staleDraftTransmittals());

        assertEquals(
                InformationRiskLevel.WATCH,
                result.informationRisk());

        assertTrue(
                result.informationScore()
                        >= 60
                        && result.informationScore()
                        < 80);
    }

    @Test
    void emptyInformationRegistersReturnNeutralNoData() {

        DocumentIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());

        assertEquals(
                75.0,
                result.informationScore());

        assertEquals(
                InformationRiskLevel.NO_DATA,
                result.informationRisk());
    }
}
