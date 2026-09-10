package com.buildsight.platform.cost.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.cost.api.CostIntelligenceResponse;
import com.buildsight.platform.cost.api.CostRiskLevel;
import com.buildsight.platform.cost.domain.CommitmentStatus;
import com.buildsight.platform.cost.domain.ProjectActualCost;
import com.buildsight.platform.cost.domain.ProjectBudgetLine;
import com.buildsight.platform.cost.domain.ProjectCommitment;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectStatus;

import org.junit.jupiter.api.Test;

class CostIntelligenceServiceTest {

    private final CostIntelligenceService
            service =
            new CostIntelligenceService();

    @Test
    void forecastAvoidsDoubleCountingLinkedActuals() {
        Project project =
                project();

        UUID costCodeId =
                UUID.randomUUID();

        ProjectBudgetLine budgetLine =
                ProjectBudgetLine.create(
                        UUID.randomUUID(),
                        project.getId(),
                        costCodeId,
                        "Main package",
                        new BigDecimal("900.00"),
                        new BigDecimal("100.00"),
                        new BigDecimal("1050.00"));

        ProjectCommitment commitment =
                ProjectCommitment.create(
                        UUID.randomUUID(),
                        project.getId(),
                        costCodeId,
                        "PO-001",
                        "Test Vendor",
                        "Main commitment",
                        new BigDecimal("700.00"),
                        CommitmentStatus.APPROVED,
                        LocalDate.of(
                                2026,
                                7,
                                1));

        ProjectActualCost linkedActual =
                ProjectActualCost.create(
                        UUID.randomUUID(),
                        project.getId(),
                        costCodeId,
                        commitment.getId(),
                        "INV-001",
                        "Test Vendor",
                        "Linked invoice",
                        new BigDecimal("400.00"),
                        LocalDate.of(
                                2026,
                                8,
                                1));

        ProjectActualCost uncommittedActual =
                ProjectActualCost.create(
                        UUID.randomUUID(),
                        project.getId(),
                        costCodeId,
                        null,
                        "INV-002",
                        "Other Vendor",
                        "Uncommitted cost",
                        new BigDecimal("50.00"),
                        LocalDate.of(
                                2026,
                                8,
                                5));

        CostIntelligenceResponse result =
                service.calculate(
                        project,
                        List.of(
                                budgetLine),
                        List.of(
                                commitment),
                        List.of(
                                linkedActual,
                                uncommittedActual));

        assertEquals(
                new BigDecimal("300.00"),
                result.outstandingCommitments());

        assertEquals(
                new BigDecimal("450.00"),
                result.actualCosts());

        assertEquals(
                new BigDecimal("1050.00"),
                result.forecastAtCompletion());

        assertEquals(
                new BigDecimal("-50.00"),
                result.varianceAtCompletion());

        assertEquals(
                new BigDecimal("50.00"),
                result.overrunAmount());

        assertEquals(
                75.0,
                result.costScore());

        assertEquals(
                CostRiskLevel.WATCH,
                result.costRisk());
    }

    @Test
    void costPlanUnderBudgetIsHealthy() {
        Project project =
                project();

        UUID costCodeId =
                UUID.randomUUID();

        ProjectBudgetLine line =
                ProjectBudgetLine.create(
                        UUID.randomUUID(),
                        project.getId(),
                        costCodeId,
                        "Package",
                        new BigDecimal("1000.00"),
                        BigDecimal.ZERO,
                        new BigDecimal("950.00"));

        CostIntelligenceResponse result =
                service.calculate(
                        project,
                        List.of(
                                line),
                        List.of(),
                        List.of());

        assertEquals(
                new BigDecimal("950.00"),
                result.forecastAtCompletion());

        assertEquals(
                new BigDecimal("50.00"),
                result.varianceAtCompletion());

        assertEquals(
                100.0,
                result.costScore());

        assertEquals(
                CostRiskLevel.ON_TRACK,
                result.costRisk());
    }

    @Test
    void missingCostBaselineIsFlagged() {
        CostIntelligenceResponse result =
                service.calculate(
                        project(),
                        List.of(),
                        List.of(),
                        List.of());

        assertEquals(
                60.0,
                result.costScore());

        assertEquals(
                CostRiskLevel.NO_BASELINE,
                result.costRisk());
    }

    private Project project() {
        return Project.create(
                UUID.randomUUID(),
                "BS-COST-TEST",
                "Cost Test Project",
                "Testing",
                "Test Client",
                "Paris",
                new BigDecimal("1200.00"),
                new BigDecimal("1000.00"),
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
    }
}
