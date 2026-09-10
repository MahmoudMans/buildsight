package com.buildsight.platform.project.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.cost.api.CostIntelligenceResponse;
import com.buildsight.platform.cost.api.CostRiskLevel;
import com.buildsight.platform.project.api.ProjectHealthBand;
import com.buildsight.platform.project.api.ProjectHealthScoreResponse;
import com.buildsight.platform.project.api.ScheduleRiskLevel;
import com.buildsight.platform.project.domain.MilestoneStatus;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectMilestone;
import com.buildsight.platform.project.domain.ProjectStatus;

import org.junit.jupiter.api.Test;

class ProjectHealthScoreServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    @Test
    void healthScoreIncludesCostRisk() {
        Project project =
                Project.create(
                        UUID.randomUUID(),
                        "BS-HEALTH-001",
                        "Health Test",
                        "Health score test",
                        "Client",
                        "Paris",
                        new BigDecimal("1000000.00"),
                        new BigDecimal("900000.00"),
                        LocalDate.of(
                                2026,
                                1,
                                1),
                        LocalDate.of(
                                2026,
                                12,
                                31),
                        ProjectStatus.ACTIVE,
                        new BigDecimal("50.00"));

        project.updateDetails(
                project.getName(),
                project.getDescription(),
                project.getClientName(),
                project.getLocation(),
                project.getContractValue(),
                project.getApprovedBudget(),
                project.getPlannedStartDate(),
                project.getPlannedEndDate(),
                LocalDate.of(
                        2027,
                        1,
                        20));

        ProjectMilestone milestone =
                ProjectMilestone.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "Blocked package",
                        "Blocked milestone",
                        LocalDate.of(
                                2026,
                                8,
                                1),
                        LocalDate.of(
                                2026,
                                8,
                                15),
                        null,
                        MilestoneStatus.BLOCKED,
                        new BigDecimal("25.00"),
                        10);

        ProjectHealthScoreResponse result =
                new ProjectHealthScoreService(
                        CLOCK)
                        .calculate(
                                project,
                                List.of(
                                        milestone),
                                cost(
                                        75.0,
                                        CostRiskLevel.WATCH));

        assertEquals(
                20,
                result.scheduleVarianceDays());

        assertEquals(
                ScheduleRiskLevel.AT_RISK,
                result.scheduleRisk());

        assertEquals(
                CostRiskLevel.WATCH,
                result.costRisk());

        assertEquals(
                75.0,
                result.costScore());

        assertEquals(
                ProjectHealthBand.WATCH,
                result.healthBand());
    }

    @Test
    void healthyDeliveryAndCostProducesHealthyScore() {
        Project project =
                Project.create(
                        UUID.randomUUID(),
                        "BS-HEALTH-002",
                        "Healthy Test",
                        "Healthy project",
                        "Client",
                        "Tunis",
                        new BigDecimal("1000000.00"),
                        new BigDecimal("900000.00"),
                        LocalDate.of(
                                2026,
                                7,
                                1),
                        LocalDate.of(
                                2027,
                                3,
                                1),
                        ProjectStatus.ACTIVE,
                        new BigDecimal("35.00"));

        ProjectHealthScoreResponse result =
                new ProjectHealthScoreService(
                        CLOCK)
                        .calculate(
                                project,
                                List.of(),
                                cost(
                                        100.0,
                                        CostRiskLevel.ON_TRACK));

        assertEquals(
                ScheduleRiskLevel.ON_TRACK,
                result.scheduleRisk());

        assertEquals(
                CostRiskLevel.ON_TRACK,
                result.costRisk());

        assertTrue(
                result.score()
                        >= 80);

        assertEquals(
                ProjectHealthBand.HEALTHY,
                result.healthBand());
    }

    private CostIntelligenceResponse cost(
            double score,
            CostRiskLevel risk) {

        return new CostIntelligenceResponse(
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                0,
                0,
                0,
                score,
                risk,
                "Test");
    }
}
