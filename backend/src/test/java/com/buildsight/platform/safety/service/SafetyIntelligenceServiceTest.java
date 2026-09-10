package com.buildsight.platform.safety.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.safety.api.SafetyIntelligenceResponse;
import com.buildsight.platform.safety.api.SafetyRiskLevel;
import com.buildsight.platform.safety.domain.HazardCategory;
import com.buildsight.platform.safety.domain.ProjectSafetyAction;
import com.buildsight.platform.safety.domain.ProjectSafetyIncident;
import com.buildsight.platform.safety.domain.ProjectSafetyObservation;
import com.buildsight.platform.safety.domain.ProjectWorkPermit;
import com.buildsight.platform.safety.domain.SafetyActionStatus;
import com.buildsight.platform.safety.domain.SafetyIncidentStatus;
import com.buildsight.platform.safety.domain.SafetyIncidentType;
import com.buildsight.platform.safety.domain.SafetyObservationType;
import com.buildsight.platform.safety.domain.SafetySeverity;
import com.buildsight.platform.safety.domain.WorkPermitStatus;
import com.buildsight.platform.safety.domain.WorkPermitType;

import org.junit.jupiter.api.Test;

class SafetyIntelligenceServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    private final SafetyIntelligenceService
            service =
            new SafetyIntelligenceService(
                    CLOCK);

    @Test
    void criticalIncidentOverdueActionAndExpiredPermitAreAtRisk() {

        UUID projectId =
                UUID.randomUUID();

        ProjectSafetyIncident incident =
                ProjectSafetyIncident.create(
                        UUID.randomUUID(),
                        projectId,
                        "INC-001",
                        SafetyIncidentType.LOST_TIME_INJURY,
                        SafetySeverity.CRITICAL,
                        "Fall incident",
                        "Test incident",
                        "Level 01",
                        LocalDate.of(
                                2026,
                                9,
                                1),
                        LocalDate.of(
                                2026,
                                9,
                                1),
                        1,
                        4,
                        "Area secured");

        incident.update(
                incident.getIncidentType(),
                incident.getSeverity(),
                incident.getTitle(),
                incident.getDescription(),
                incident.getLocation(),
                incident.getPeopleAffected(),
                incident.getLostTimeDays(),
                incident.getImmediateAction(),
                "Test root cause",
                "Investigation ongoing",
                SafetyIncidentStatus.ACTION_IN_PROGRESS,
                LocalDate.of(
                        2026,
                        9,
                        2));

        ProjectSafetyAction action =
                ProjectSafetyAction.create(
                        UUID.randomUUID(),
                        projectId,
                        incident.getId(),
                        null,
                        "ACT-001",
                        "Correct access control",
                        "Implement action",
                        "Manager",
                        LocalDate.of(
                                2026,
                                9,
                                5));

        action.update(
                action.getTitle(),
                action.getActionDescription(),
                action.getOwnerName(),
                action.getDueDate(),
                SafetyActionStatus.IN_PROGRESS,
                null,
                LocalDate.of(
                        2026,
                        9,
                        2));

        ProjectWorkPermit permit =
                ProjectWorkPermit.create(
                        UUID.randomUUID(),
                        projectId,
                        "PTW-001",
                        WorkPermitType.WORK_AT_HEIGHT,
                        "Work at height",
                        "Roof",
                        "Issuer",
                        "Receiver",
                        LocalDate.of(
                                2026,
                                9,
                                1),
                        LocalDate.of(
                                2026,
                                9,
                                8),
                        "Controls");

        permit.update(
                permit.getPermitType(),
                permit.getTitle(),
                permit.getLocation(),
                permit.getIssuerName(),
                permit.getReceiverName(),
                permit.getValidFrom(),
                permit.getValidUntil(),
                permit.getControls(),
                WorkPermitStatus.ACTIVE,
                LocalDate.of(
                        2026,
                        9,
                        1));

        SafetyIntelligenceResponse result =
                service.calculate(
                        List.of(incident),
                        List.of(),
                        List.of(action),
                        List.of(permit));

        assertEquals(
                1,
                result.criticalOpenIncidents());

        assertEquals(
                1,
                result.overdueActions());

        assertEquals(
                1,
                result.expiredPermits());

        assertEquals(
                SafetyRiskLevel.AT_RISK,
                result.safetyRisk());

        assertTrue(
                result.safetyScore()
                        < 60);
    }

    @Test
    void positiveObservationProducesOnTrackLeadingIndicator() {

        UUID projectId =
                UUID.randomUUID();

        ProjectSafetyObservation observation =
                ProjectSafetyObservation.create(
                        UUID.randomUUID(),
                        projectId,
                        "OBS-001",
                        SafetyObservationType.GOOD_PRACTICE,
                        HazardCategory.HOUSEKEEPING,
                        SafetySeverity.LOW,
                        "Good housekeeping",
                        "Access route maintained well.",
                        "Level 01",
                        LocalDate.of(
                                2026,
                                9,
                                9),
                        "HSE",
                        null,
                        null);

        SafetyIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(observation),
                        List.of(),
                        List.of());

        assertEquals(
                1,
                result.positiveObservations());

        assertEquals(
                SafetyRiskLevel.ON_TRACK,
                result.safetyRisk());

        assertEquals(
                100,
                result.safetyScore());
    }

    @Test
    void repeatedUnsafeHazardsAreDetected() {

        UUID projectId =
                UUID.randomUUID();

        ProjectSafetyObservation first =
                ProjectSafetyObservation.create(
                        UUID.randomUUID(),
                        projectId,
                        "OBS-001",
                        SafetyObservationType.UNSAFE_CONDITION,
                        HazardCategory.WORK_AT_HEIGHT,
                        SafetySeverity.HIGH,
                        "Unsafe edge",
                        "Edge protection incomplete",
                        "Roof",
                        LocalDate.of(
                                2026,
                                9,
                                8),
                        "HSE",
                        "Site",
                        LocalDate.of(
                                2026,
                                9,
                                12));

        ProjectSafetyObservation second =
                ProjectSafetyObservation.create(
                        UUID.randomUUID(),
                        projectId,
                        "OBS-002",
                        SafetyObservationType.UNSAFE_ACT,
                        HazardCategory.WORK_AT_HEIGHT,
                        SafetySeverity.HIGH,
                        "Harness control",
                        "Harness control not followed",
                        "Roof",
                        LocalDate.of(
                                2026,
                                9,
                                9),
                        "HSE",
                        "Site",
                        LocalDate.of(
                                2026,
                                9,
                                12));

        SafetyIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(
                                first,
                                second),
                        List.of(),
                        List.of());

        assertEquals(
                1,
                result.recurringHazardCategories());

        assertEquals(
                2,
                result.unsafeObservations());
    }

    @Test
    void emptySafetyRegistersReturnNeutralNoData() {

        SafetyIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());

        assertEquals(
                75,
                result.safetyScore());

        assertEquals(
                SafetyRiskLevel.NO_DATA,
                result.safetyRisk());
    }
}
