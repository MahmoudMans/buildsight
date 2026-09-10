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
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectStatus;
import com.buildsight.platform.risk.api.RiskIntelligenceLevel;
import com.buildsight.platform.risk.api.RiskIntelligenceResponse;

import org.junit.jupiter.api.Test;

class ProjectHealthScoreServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    @Test
    void projectHealthV4IncludesRiskControlPerformance() {

        Project project =
                Project.create(
                        UUID.randomUUID(),
                        "BS-H-V4-001",
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
                                "50.00"));

        ProjectHealthScoreResponse result =
                new ProjectHealthScoreService(
                        CLOCK)
                        .calculate(
                                project,
                                List.of(),
                                cost(
                                        90,
                                        CostRiskLevel.ON_TRACK),
                                procurement(
                                        85,
                                        ProcurementRiskLevel.ON_TRACK),
                                risk(
                                        40,
                                        RiskIntelligenceLevel.AT_RISK));

        assertEquals(
                RiskIntelligenceLevel.AT_RISK,
                result.riskLevel());

        assertEquals(
                40.0,
                result.riskScore());

        assertTrue(
                result.score()
                        < 90);
    }

    @Test
    void healthySixDimensionProjectRemainsHealthy() {

        Project project =
                Project.create(
                        UUID.randomUUID(),
                        "BS-H-V4-002",
                        "Healthy",
                        "Healthy project",
                        "Client",
                        "Tunis",
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
                                        100,
                                        CostRiskLevel.ON_TRACK),
                                procurement(
                                        95,
                                        ProcurementRiskLevel.ON_TRACK),
                                risk(
                                        95,
                                        RiskIntelligenceLevel.ON_TRACK));

        assertEquals(
                ProjectHealthBand.HEALTHY,
                result.healthBand());

        assertTrue(
                result.score()
                        >= 80);
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

    private RiskIntelligenceResponse risk(
            double score,
            RiskIntelligenceLevel level) {

        return new RiskIntelligenceResponse(
                1,
                1,
                0,
                0,
                5,
                5,
                0,
                0,
                0,
                0,
                0,
                BigDecimal.ZERO,
                0,
                0,
                0,
                score,
                level,
                "Test");
    }
}
