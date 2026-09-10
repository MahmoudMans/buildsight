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
import com.buildsight.platform.procurement.api.ProcurementIntelligenceResponse;
import com.buildsight.platform.procurement.api.ProcurementRiskLevel;
import com.buildsight.platform.project.api.ProjectHealthBand;
import com.buildsight.platform.project.api.ProjectHealthScoreResponse;
import com.buildsight.platform.project.api.ScheduleRiskLevel;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectStatus;

import org.junit.jupiter.api.Test;

class ProjectHealthScoreServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    @Test
    void projectHealthV3IncludesProcurementRisk() {

        Project project =
                project(
                        "50.00");

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

        ProjectHealthScoreResponse result =
                new ProjectHealthScoreService(
                        CLOCK)
                        .calculate(
                                project,
                                List.of(),
                                cost(
                                        75.0,
                                        CostRiskLevel.WATCH),
                                procurement(
                                        55.0,
                                        ProcurementRiskLevel.AT_RISK));

        assertEquals(
                ProcurementRiskLevel.AT_RISK,
                result.procurementRisk());

        assertEquals(
                55.0,
                result.procurementScore());

        assertEquals(
                ScheduleRiskLevel.AT_RISK,
                result.scheduleRisk());

        assertTrue(
                result.score()
                        < 80);
    }

    @Test
    void healthyFiveDimensionProjectScoresHealthy() {

        Project project =
                Project.create(
                        UUID.randomUUID(),
                        "BS-H-V3",
                        "Healthy",
                        "Healthy project",
                        "Client",
                        "Paris",
                        new BigDecimal(
                                "1000000.00"),
                        new BigDecimal(
                                "900000.00"),
                        LocalDate.of(
                                2026,
                                7,
                                1),
                        LocalDate.of(
                                2027,
                                3,
                                1),
                        ProjectStatus.ACTIVE,
                        new BigDecimal(
                                "35.00"));

        ProjectHealthScoreResponse result =
                new ProjectHealthScoreService(
                        CLOCK)
                        .calculate(
                                project,
                                List.of(),
                                cost(
                                        100.0,
                                        CostRiskLevel.ON_TRACK),
                                procurement(
                                        95.0,
                                        ProcurementRiskLevel.ON_TRACK));

        assertEquals(
                ProjectHealthBand.HEALTHY,
                result.healthBand());

        assertEquals(
                ProcurementRiskLevel.ON_TRACK,
                result.procurementRisk());

        assertTrue(
                result.score()
                        >= 80);
    }

    private Project project(
            String progress) {

        return Project.create(
                UUID.randomUUID(),
                "BS-H-TEST",
                "Health Test",
                "Health",
                "Client",
                "Paris",
                new BigDecimal(
                        "1000000.00"),
                new BigDecimal(
                        "900000.00"),
                LocalDate.of(
                        2026,
                        1,
                        1),
                LocalDate.of(
                        2026,
                        12,
                        31),
                ProjectStatus.ACTIVE,
                new BigDecimal(
                        progress));
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

    private ProcurementIntelligenceResponse procurement(
            double score,
            ProcurementRiskLevel risk) {

        return new ProcurementIntelligenceResponse(
                1,
                1,
                0,
                0,
                0,
                0,
                1,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                100,
                80,
                0,
                score,
                risk,
                "Test");
    }
}
