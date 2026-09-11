package com.buildsight.platform.governance.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.governance.domain.GovernanceActionPriority;
import com.buildsight.platform.governance.domain.GovernanceActionStatus;
import com.buildsight.platform.governance.domain.GovernanceDecisionImpactArea;
import com.buildsight.platform.governance.domain.GovernanceDecisionStatus;
import com.buildsight.platform.governance.domain.GovernanceMeetingStatus;
import com.buildsight.platform.governance.domain.GovernanceMeetingType;
import com.buildsight.platform.governance.domain.GovernanceRiskLevel;
import com.buildsight.platform.governance.domain.ProjectGovernanceAction;
import com.buildsight.platform.governance.domain.ProjectGovernanceDecision;
import com.buildsight.platform.governance.domain.ProjectGovernanceMeeting;

import org.junit.jupiter.api.Test;

class GovernanceIntelligenceServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-11T08:00:00Z"),
                    ZoneOffset.UTC);

    private final GovernanceIntelligenceService service =
            new GovernanceIntelligenceService(
                    CLOCK);

    @Test
    void blockedCriticalOverdueGovernanceBecomesAtRisk() {

        UUID projectId =
                UUID.randomUUID();

        LocalDate today =
                LocalDate.of(
                        2026,
                        9,
                        11);

        ProjectGovernanceMeeting meeting =
                ProjectGovernanceMeeting.create(
                        UUID.randomUUID(),
                        projectId,
                        "MTG-001",
                        "Progress Meeting",
                        GovernanceMeetingType.PROGRESS,
                        Instant.parse(
                                "2026-09-05T10:00:00Z"),
                        "Director");

        meeting.update(
                meeting.getTitle(),
                meeting.getMeetingType(),
                meeting.getScheduledAt(),
                meeting.getScheduledAt(),
                GovernanceMeetingStatus.HELD,
                meeting.getChairName(),
                null,
                null);

        ProjectGovernanceDecision decision =
                ProjectGovernanceDecision.create(
                        UUID.randomUUID(),
                        projectId,
                        meeting.getId(),
                        "DEC-001",
                        "Recovery decision",
                        null,
                        today.minusDays(
                                10),
                        "Director",
                        today.minusDays(
                                2),
                        GovernanceDecisionImpactArea.SCHEDULE,
                        null);

        decision.update(
                decision.getMeetingId(),
                decision.getTitle(),
                decision.getDescription(),
                decision.getDecisionDate(),
                decision.getOwnerName(),
                decision.getDueDate(),
                decision.getImpactArea(),
                decision.getRationale(),
                GovernanceDecisionStatus.APPROVED);

        ProjectGovernanceAction action =
                ProjectGovernanceAction.create(
                        UUID.randomUUID(),
                        projectId,
                        meeting.getId(),
                        decision.getId(),
                        "ACT-001",
                        "Release recovery package",
                        null,
                        "Package Manager",
                        GovernanceActionPriority.CRITICAL,
                        today.minusDays(
                                3));

        action.update(
                action.getMeetingId(),
                action.getDecisionId(),
                action.getTitle(),
                action.getDescription(),
                action.getOwnerName(),
                action.getPriority(),
                action.getDueDate(),
                GovernanceActionStatus.BLOCKED,
                "Supplier information missing.",
                Instant.now(
                        CLOCK));

        var result =
                service.calculate(
                        List.of(
                                meeting),
                        List.of(
                                decision),
                        List.of(
                                action));

        assertEquals(
                1,
                result.overdueActions());

        assertEquals(
                1,
                result.criticalOpenActions());

        assertEquals(
                1,
                result.blockedActions());

        assertEquals(
                1,
                result.overdueDecisions());

        assertEquals(
                1,
                result.meetingsWithoutMinutes());

        assertEquals(
                GovernanceRiskLevel.AT_RISK,
                result.governanceRisk());

        assertTrue(
                result.governanceScore()
                        < 60);
    }

    @Test
    void closedGovernanceCanRemainOnTrack() {

        UUID projectId =
                UUID.randomUUID();

        LocalDate today =
                LocalDate.of(
                        2026,
                        9,
                        11);

        ProjectGovernanceMeeting meeting =
                ProjectGovernanceMeeting.create(
                        UUID.randomUUID(),
                        projectId,
                        "MTG-001",
                        "Progress Meeting",
                        GovernanceMeetingType.PROGRESS,
                        Instant.parse(
                                "2026-09-10T10:00:00Z"),
                        "Director");

        meeting.update(
                meeting.getTitle(),
                meeting.getMeetingType(),
                meeting.getScheduledAt(),
                meeting.getScheduledAt(),
                GovernanceMeetingStatus.HELD,
                meeting.getChairName(),
                "Minutes recorded.",
                null);

        ProjectGovernanceDecision decision =
                ProjectGovernanceDecision.create(
                        UUID.randomUUID(),
                        projectId,
                        meeting.getId(),
                        "DEC-001",
                        "Approved sequencing",
                        null,
                        today.minusDays(
                                1),
                        "Director",
                        today.plusDays(
                                5),
                        GovernanceDecisionImpactArea.TECHNICAL,
                        null);

        decision.update(
                decision.getMeetingId(),
                decision.getTitle(),
                decision.getDescription(),
                decision.getDecisionDate(),
                decision.getOwnerName(),
                decision.getDueDate(),
                decision.getImpactArea(),
                decision.getRationale(),
                GovernanceDecisionStatus.IMPLEMENTED);

        ProjectGovernanceAction action =
                ProjectGovernanceAction.create(
                        UUID.randomUUID(),
                        projectId,
                        meeting.getId(),
                        decision.getId(),
                        "ACT-001",
                        "Issue coordinated sequence",
                        null,
                        "Planner",
                        GovernanceActionPriority.MEDIUM,
                        today.plusDays(
                                2));

        action.update(
                action.getMeetingId(),
                action.getDecisionId(),
                action.getTitle(),
                action.getDescription(),
                action.getOwnerName(),
                action.getPriority(),
                action.getDueDate(),
                GovernanceActionStatus.DONE,
                null,
                Instant.now(
                        CLOCK));

        var result =
                service.calculate(
                        List.of(
                                meeting),
                        List.of(
                                decision),
                        List.of(
                                action));

        assertEquals(
                100,
                result.governanceScore());

        assertEquals(
                GovernanceRiskLevel.ON_TRACK,
                result.governanceRisk());

        assertEquals(
                100,
                result.actionClosureRate());

        assertEquals(
                100,
                result.decisionClosureRate());
    }

    @Test
    void emptyGovernanceReturnsNeutralWatch() {

        var result =
                service.calculate(
                        List.of(),
                        List.of(),
                        List.of());

        assertEquals(
                75,
                result.governanceScore());

        assertEquals(
                GovernanceRiskLevel.WATCH,
                result.governanceRisk());
    }
}
