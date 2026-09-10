package com.buildsight.platform.risk.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.risk.api.RiskIntelligenceLevel;
import com.buildsight.platform.risk.api.RiskIntelligenceResponse;
import com.buildsight.platform.risk.domain.ChangeEventStatus;
import com.buildsight.platform.risk.domain.DelayCause;
import com.buildsight.platform.risk.domain.DelayStatus;
import com.buildsight.platform.risk.domain.IssueSeverity;
import com.buildsight.platform.risk.domain.ProjectChangeEvent;
import com.buildsight.platform.risk.domain.ProjectDelayEvent;
import com.buildsight.platform.risk.domain.ProjectIssue;
import com.buildsight.platform.risk.domain.ProjectRisk;
import com.buildsight.platform.risk.domain.RiskCategory;
import com.buildsight.platform.risk.domain.RiskStatus;

import org.junit.jupiter.api.Test;

class RiskIntelligenceServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    private final RiskIntelligenceService
            service =
            new RiskIntelligenceService(
                    CLOCK);

    @Test
    void highResidualRiskAndCriticalIssueCreateAtRiskSignal() {

        UUID projectId =
                UUID.randomUUID();

        ProjectRisk risk =
                ProjectRisk.create(
                        UUID.randomUUID(),
                        projectId,
                        "RISK-001",
                        "Critical procurement exposure",
                        "Testing",
                        RiskCategory.PROCUREMENT,
                        "Manager",
                        5,
                        5,
                        4,
                        5,
                        "Mitigate",
                        LocalDate.of(
                                2026,
                                9,
                                1));

        risk.update(
                risk.getTitle(),
                risk.getDescription(),
                risk.getCategory(),
                risk.getOwnerName(),
                risk.getProbability(),
                risk.getImpact(),
                risk.getResidualProbability(),
                risk.getResidualImpact(),
                risk.getMitigationPlan(),
                risk.getMitigationDueDate(),
                RiskStatus.MITIGATING);

        ProjectIssue issue =
                ProjectIssue.create(
                        UUID.randomUUID(),
                        projectId,
                        risk.getId(),
                        "ISS-001",
                        "Critical unresolved issue",
                        "Testing",
                        IssueSeverity.CRITICAL,
                        "Manager",
                        LocalDate.of(
                                2026,
                                9,
                                2));

        ProjectDelayEvent delay =
                ProjectDelayEvent.create(
                        UUID.randomUUID(),
                        projectId,
                        "DLY-001",
                        "Active delay",
                        "Testing",
                        DelayCause.DESIGN,
                        "Planner",
                        LocalDate.of(
                                2026,
                                9,
                                1),
                        20,
                        false,
                        false);

        delay.update(
                delay.getTitle(),
                delay.getDescription(),
                delay.getCause(),
                delay.getOwnerName(),
                delay.getStartDate(),
                null,
                delay.getForecastDelayDays(),
                false,
                false,
                DelayStatus.MITIGATING,
                LocalDate.of(
                        2026,
                        9,
                        10));

        RiskIntelligenceResponse result =
                service.calculate(
                        List.of(
                                risk),
                        List.of(
                                issue),
                        List.of(),
                        List.of(
                                delay));

        assertEquals(
                1,
                result.highExposureRisks());

        assertEquals(
                1,
                result.overdueMitigations());

        assertEquals(
                1,
                result.criticalOpenIssues());

        assertEquals(
                20,
                result.forecastDelayDays());

        assertEquals(
                RiskIntelligenceLevel.AT_RISK,
                result.riskLevel());

        assertTrue(
                result.riskScore()
                        < 60);
    }

    @Test
    void approvedChangesAreReportedWithoutAutomaticRiskPenalty() {

        UUID projectId =
                UUID.randomUUID();

        ProjectChangeEvent change =
                ProjectChangeEvent.create(
                        UUID.randomUUID(),
                        projectId,
                        "CHG-001",
                        "Approved scope change",
                        "Testing",
                        "Client",
                        LocalDate.of(
                                2026,
                                8,
                                1),
                        new BigDecimal(
                                "50000.00"),
                        5);

        change.update(
                change.getTitle(),
                change.getDescription(),
                change.getOriginator(),
                change.getRequestedDate(),
                LocalDate.of(
                        2026,
                        8,
                        10),
                change.getCostImpact(),
                change.getScheduleImpactDays(),
                ChangeEventStatus.APPROVED,
                LocalDate.of(
                        2026,
                        9,
                        10));

        RiskIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(),
                        List.of(
                                change),
                        List.of());

        assertEquals(
                1,
                result.approvedChanges());

        assertEquals(
                new BigDecimal(
                        "50000.00"),
                result.approvedChangeCostImpact());

        assertEquals(
                5,
                result.approvedChangeScheduleImpactDays());

        assertEquals(
                100.0,
                result.riskScore());

        assertEquals(
                RiskIntelligenceLevel.ON_TRACK,
                result.riskLevel());
    }

    @Test
    void emptyRegistersProduceNeutralNoDataState() {

        RiskIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());

        assertEquals(
                75.0,
                result.riskScore());

        assertEquals(
                RiskIntelligenceLevel.NO_DATA,
                result.riskLevel());
    }
}
