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

import com.buildsight.platform.commercial.api.CommercialIntelligenceResponse;
import com.buildsight.platform.commercial.api.CommercialRiskLevel;
import com.buildsight.platform.cost.api.CostIntelligenceResponse;
import com.buildsight.platform.cost.api.CostRiskLevel;
import com.buildsight.platform.document.api.DocumentIntelligenceResponse;
import com.buildsight.platform.document.api.InformationRiskLevel;
import com.buildsight.platform.procurement.api.ProcurementIntelligenceResponse;
import com.buildsight.platform.procurement.api.ProcurementRiskLevel;
import com.buildsight.platform.production.api.ProductionIntelligenceResponse;
import com.buildsight.platform.production.api.ProductionRiskLevel;
import com.buildsight.platform.project.api.ProjectHealthBand;
import com.buildsight.platform.project.api.ProjectHealthScoreResponse;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectStatus;
import com.buildsight.platform.quality.api.QualityIntelligenceResponse;
import com.buildsight.platform.quality.api.QualityRiskLevel;
import com.buildsight.platform.risk.api.RiskIntelligenceLevel;
import com.buildsight.platform.risk.api.RiskIntelligenceResponse;
import com.buildsight.platform.safety.api.SafetyIntelligenceResponse;
import com.buildsight.platform.safety.api.SafetyRiskLevel;

import org.junit.jupiter.api.Test;

class ProjectHealthScoreServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    @Test
    void healthV9IncludesCommercialPerformance() {

        ProjectHealthScoreResponse result =
                new ProjectHealthScoreService(
                        CLOCK)
                        .calculate(
                                project(),
                                List.of(),
                                cost(90),
                                procurement(90),
                                risk(90),
                                production(90),
                                information(90),
                                quality(
                                        90,
                                        QualityRiskLevel.ON_TRACK),
                                safety(
                                        90,
                                        SafetyRiskLevel.ON_TRACK),
                                commercial(
                                        35,
                                        CommercialRiskLevel.AT_RISK));

        assertEquals(
                35,
                result.commercialScore());

        assertEquals(
                CommercialRiskLevel.AT_RISK,
                result.commercialRisk());

        assertTrue(
                result.score()
                        < 90);
    }

    @Test
    void healthyElevenDimensionProjectRemainsHealthy() {

        ProjectHealthScoreResponse result =
                new ProjectHealthScoreService(
                        CLOCK)
                        .calculate(
                                project(),
                                List.of(),
                                cost(100),
                                procurement(95),
                                risk(95),
                                production(95),
                                information(95),
                                quality(
                                        95,
                                        QualityRiskLevel.ON_TRACK),
                                safety(
                                        95,
                                        SafetyRiskLevel.ON_TRACK),
                                commercial(
                                        95,
                                        CommercialRiskLevel.ON_TRACK));

        assertEquals(
                ProjectHealthBand.HEALTHY,
                result.healthBand());

        assertTrue(
                result.score()
                        >= 80);
    }

    private Project project() {

        return Project.create(
                UUID.randomUUID(),
                "BS-H-V9",
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
                        7,
                        1),
                LocalDate.of(
                        2027,
                        3,
                        1),
                ProjectStatus.ACTIVE,
                new BigDecimal(
                        "35.00"));
    }

    private CostIntelligenceResponse cost(
            double score) {

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
                CostRiskLevel.ON_TRACK,
                "Test");
    }

    private ProcurementIntelligenceResponse procurement(
            double score) {

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
                ProcurementRiskLevel.ON_TRACK,
                "Test");
    }

    private RiskIntelligenceResponse risk(
            double score) {

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
                RiskIntelligenceLevel.ON_TRACK,
                "Test");
    }

    private ProductionIntelligenceResponse production(
            double score) {

        return new ProductionIntelligenceResponse(
                3,
                2,
                0,
                0,
                4,
                4,
                4,
                LocalDate.of(
                        2026,
                        9,
                        9),
                false,
                50,
                45,
                5,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                1.0,
                10,
                score,
                ProductionRiskLevel.ON_TRACK,
                "Test");
    }

    private DocumentIntelligenceResponse information(
            double score) {

        return new DocumentIntelligenceResponse(
                2,
                3,
                1,
                3,
                1,
                0,
                0,
                0,
                0,
                1,
                score,
                InformationRiskLevel.ON_TRACK,
                "Test");
    }

    private QualityIntelligenceResponse quality(
            double score,
            QualityRiskLevel level) {

        return new QualityIntelligenceResponse(
                3,
                2,
                2,
                0,
                100,
                0,
                0,
                0,
                0,
                0,
                0,
                3,
                1,
                0,
                33.3,
                score,
                level,
                "Test");
    }

    private SafetyIntelligenceResponse safety(
            double score,
            SafetyRiskLevel level) {

        return new SafetyIntelligenceResponse(
                1,
                0,
                0,
                0,
                0,
                4,
                1,
                3,
                0,
                0,
                1,
                0,
                0,
                null,
                score,
                level,
                "Test");
    }

    private CommercialIntelligenceResponse commercial(
            double score,
            CommercialRiskLevel level) {

        return new CommercialIntelligenceResponse(
                1,
                0,
                0,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                1,
                0,
                0,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                0,
                0,
                1,
                0,
                0,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                0,
                1,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                BigDecimal.ZERO,
                score,
                level,
                "Test");
    }
}
