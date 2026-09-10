package com.buildsight.platform.resource.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.resource.api.ResourceModels.ResourceIntelligenceResponse;
import com.buildsight.platform.resource.api.ResourceRiskLevel;
import com.buildsight.platform.resource.domain.EquipmentOwnership;
import com.buildsight.platform.resource.domain.EquipmentStatus;
import com.buildsight.platform.resource.domain.ProjectEquipment;
import com.buildsight.platform.resource.domain.ProjectEquipmentUsageLog;
import com.buildsight.platform.resource.domain.ProjectResourceDemandForecast;
import com.buildsight.platform.resource.domain.ProjectWorkforceDeployment;
import com.buildsight.platform.resource.domain.ProjectWorkforcePlan;
import com.buildsight.platform.resource.domain.ResourceDemandType;
import com.buildsight.platform.resource.domain.WorkforcePlanStatus;

import org.junit.jupiter.api.Test;

class ResourceIntelligenceServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    private final ResourceIntelligenceService service =
            new ResourceIntelligenceService(
                    CLOCK);

    @Test
    void poorLaborEquipmentAndFutureShortageCreateAtRiskCondition() {

        UUID projectId =
                UUID.randomUUID();

        UUID packageId =
                UUID.randomUUID();

        ProjectWorkforcePlan plan =
                ProjectWorkforcePlan.create(
                        UUID.randomUUID(),
                        projectId,
                        LocalDate.of(
                                2026,
                                9,
                                1),
                        LocalDate.of(
                                2026,
                                9,
                                7),
                        "Finishes",
                        packageId,
                        20,
                        new BigDecimal("800"),
                        new BigDecimal("650"),
                        new BigDecimal("0.10"));

        plan.update(
                plan.getPeriodStart(),
                plan.getPeriodEnd(),
                plan.getTrade(),
                plan.getWorkPackageId(),
                plan.getPlannedWorkers(),
                plan.getPlannedRegularHours(),
                plan.getPlannedProductiveHours(),
                plan.getPlannedProductivityRate(),
                WorkforcePlanStatus.APPROVED);

        ProjectWorkforceDeployment deployment =
                ProjectWorkforceDeployment.create(
                        UUID.randomUUID(),
                        projectId,
                        LocalDate.of(
                                2026,
                                9,
                                9),
                        "Finishes",
                        packageId,
                        14,
                        new BigDecimal("100"),
                        new BigDecimal("35"),
                        new BigDecimal("65"),
                        new BigDecimal("3.00"),
                        new BigDecimal("0.10"),
                        null);

        ProjectEquipment equipment =
                ProjectEquipment.create(
                        UUID.randomUUID(),
                        projectId,
                        "EQ-001",
                        "Mobile platform",
                        "Access",
                        EquipmentOwnership.RENTED,
                        new BigDecimal("500"));

        equipment.update(
                equipment.getDescription(),
                equipment.getCategory(),
                equipment.getOwnership(),
                EquipmentStatus.IDLE,
                equipment.getDailyCost());

        ProjectEquipmentUsageLog usage =
                ProjectEquipmentUsageLog.create(
                        UUID.randomUUID(),
                        projectId,
                        equipment.getId(),
                        packageId,
                        LocalDate.of(
                                2026,
                                9,
                                9),
                        new BigDecimal("10"),
                        new BigDecimal("1"),
                        new BigDecimal("7"),
                        new BigDecimal("2"),
                        null);

        ProjectResourceDemandForecast labor =
                ProjectResourceDemandForecast.create(
                        UUID.randomUUID(),
                        projectId,
                        LocalDate.of(
                                2026,
                                9,
                                11),
                        LocalDate.of(
                                2026,
                                9,
                                20),
                        ResourceDemandType.LABOR,
                        "Finishes",
                        new BigDecimal("25"),
                        new BigDecimal("14"),
                        null);

        ProjectResourceDemandForecast plant =
                ProjectResourceDemandForecast.create(
                        UUID.randomUUID(),
                        projectId,
                        LocalDate.of(
                                2026,
                                9,
                                11),
                        LocalDate.of(
                                2026,
                                9,
                                20),
                        ResourceDemandType.EQUIPMENT,
                        "Access",
                        new BigDecimal("4"),
                        new BigDecimal("1"),
                        null);

        ResourceIntelligenceResponse result =
                service.calculate(
                        List.of(plan),
                        List.of(deployment),
                        List.of(equipment),
                        List.of(usage),
                        List.of(
                                labor,
                                plant));

        assertTrue(
                result.overtimePercentage()
                        > 20);

        assertTrue(
                result.laborUtilizationPercentage()
                        < 60);

        assertTrue(
                result.averageProductivityIndex()
                        < 0.50);

        assertEquals(
                1,
                result.lowProductivityWorkPackages());

        assertEquals(
                1,
                result.idleEquipment());

        assertTrue(
                result.workerDemandGap()
                        > 0);

        assertTrue(
                result.equipmentDemandGap()
                        > 0);

        assertEquals(
                ResourceRiskLevel.AT_RISK,
                result.resourceRisk());

        assertTrue(
                result.resourceScore()
                        < 60);
    }

    @Test
    void efficientDeploymentAndBalancedDemandAreOnTrack() {

        UUID projectId =
                UUID.randomUUID();

        UUID packageId =
                UUID.randomUUID();

        ProjectWorkforceDeployment deployment =
                ProjectWorkforceDeployment.create(
                        UUID.randomUUID(),
                        projectId,
                        LocalDate.of(
                                2026,
                                9,
                                9),
                        "MEP",
                        packageId,
                        10,
                        new BigDecimal("80"),
                        new BigDecimal("4"),
                        new BigDecimal("72"),
                        new BigDecimal("7.2"),
                        new BigDecimal("0.095"),
                        null);

        ProjectEquipment equipment =
                ProjectEquipment.create(
                        UUID.randomUUID(),
                        projectId,
                        "EQ-002",
                        "Material hoist",
                        "Lifting",
                        EquipmentOwnership.RENTED,
                        new BigDecimal("400"));

        equipment.update(
                equipment.getDescription(),
                equipment.getCategory(),
                equipment.getOwnership(),
                EquipmentStatus.DEPLOYED,
                equipment.getDailyCost());

        ProjectEquipmentUsageLog usage =
                ProjectEquipmentUsageLog.create(
                        UUID.randomUUID(),
                        projectId,
                        equipment.getId(),
                        packageId,
                        LocalDate.of(
                                2026,
                                9,
                                9),
                        new BigDecimal("10"),
                        new BigDecimal("8"),
                        new BigDecimal("1"),
                        new BigDecimal("1"),
                        null);

        ProjectResourceDemandForecast forecast =
                ProjectResourceDemandForecast.create(
                        UUID.randomUUID(),
                        projectId,
                        LocalDate.of(
                                2026,
                                9,
                                11),
                        LocalDate.of(
                                2026,
                                9,
                                20),
                        ResourceDemandType.LABOR,
                        "MEP",
                        new BigDecimal("10"),
                        new BigDecimal("12"),
                        null);

        ResourceIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(deployment),
                        List.of(equipment),
                        List.of(usage),
                        List.of(forecast));

        assertEquals(
                0,
                result.workerDemandGap());

        assertEquals(
                0,
                result.idleEquipment());

        assertTrue(
                result.laborUtilizationPercentage()
                        > 80);

        assertTrue(
                result.equipmentUtilizationPercentage()
                        >= 80);

        assertEquals(
                ResourceRiskLevel.ON_TRACK,
                result.resourceRisk());

        assertTrue(
                result.resourceScore()
                        >= 80);
    }

    @Test
    void emptyResourceRegistersReturnNeutralNoData() {

        ResourceIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());

        assertEquals(
                75,
                result.resourceScore());

        assertEquals(
                ResourceRiskLevel.NO_DATA,
                result.resourceRisk());
    }
}
