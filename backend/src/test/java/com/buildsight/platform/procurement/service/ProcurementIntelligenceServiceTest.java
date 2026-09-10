package com.buildsight.platform.procurement.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.procurement.api.ProcurementIntelligenceResponse;
import com.buildsight.platform.procurement.api.ProcurementRiskLevel;
import com.buildsight.platform.procurement.domain.ProcurementBid;
import com.buildsight.platform.procurement.domain.ProcurementPackage;
import com.buildsight.platform.procurement.domain.ProcurementPackageStatus;
import com.buildsight.platform.procurement.domain.Supplier;
import com.buildsight.platform.procurement.domain.SupplierPerformanceEvaluation;
import com.buildsight.platform.procurement.domain.SupplierQualificationStatus;
import com.buildsight.platform.procurement.domain.SupplierType;

import org.junit.jupiter.api.Test;

class ProcurementIntelligenceServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    private final ProcurementIntelligenceService service =
            new ProcurementIntelligenceService(
                    CLOCK);

    @Test
    void delayedUnderCompetedPackageCreatesRisk() {

        ProcurementPackage packageItem =
                packageItem(
                        LocalDate.of(
                                2026,
                                9,
                                1),
                        LocalDate.of(
                                2026,
                                9,
                                20));

        packageItem.changeStatus(
                ProcurementPackageStatus.TENDERING,
                LocalDate.of(
                        2026,
                        8,
                        1));

        packageItem.changeStatus(
                ProcurementPackageStatus.EVALUATION,
                LocalDate.of(
                        2026,
                        8,
                        20));

        Supplier supplier =
                supplier(
                        SupplierQualificationStatus.QUALIFIED);

        ProcurementBid bid =
                bid(
                        packageItem,
                        supplier);

        ProcurementIntelligenceResponse result =
                service.calculate(
                        List.of(
                                packageItem),
                        List.of(
                                bid),
                        List.of(
                                supplier),
                        List.of());

        assertEquals(
                1,
                result.delayedPackages());

        assertTrue(
                result.maximumAwardDelayDays()
                        > 0);

        assertTrue(
                result.procurementScore()
                        < 80);

        assertEquals(
                ProcurementRiskLevel.WATCH,
                result.procurementRisk());
    }

    @Test
    void competitiveQualifiedAwardWithStrongPerformanceIsHealthy() {

        ProcurementPackage packageItem =
                packageItem(
                        LocalDate.of(
                                2026,
                                9,
                                15),
                        LocalDate.of(
                                2026,
                                9,
                                15));

        packageItem.changeStatus(
                ProcurementPackageStatus.TENDERING,
                LocalDate.of(
                        2026,
                        8,
                        1));

        packageItem.changeStatus(
                ProcurementPackageStatus.EVALUATION,
                LocalDate.of(
                        2026,
                        8,
                        20));

        Supplier supplierOne =
                supplier(
                        SupplierQualificationStatus.QUALIFIED);

        Supplier supplierTwo =
                Supplier.create(
                        UUID.randomUUID(),
                        "SUP-B",
                        "Supplier B",
                        SupplierType.SUBCONTRACTOR,
                        "MEP",
                        "France",
                        null,
                        null,
                        SupplierQualificationStatus.QUALIFIED);

        ProcurementBid bidOne =
                bid(
                        packageItem,
                        supplierOne);

        ProcurementBid bidTwo =
                bid(
                        packageItem,
                        supplierTwo);

        packageItem.award(
                supplierOne.getId(),
                new BigDecimal(
                        "90000.00"),
                LocalDate.of(
                        2026,
                        9,
                        5),
                UUID.randomUUID());

        SupplierPerformanceEvaluation evaluation =
                SupplierPerformanceEvaluation.create(
                        UUID.randomUUID(),
                        packageItem.getProjectId(),
                        supplierOne.getId(),
                        packageItem.getId(),
                        LocalDate.of(
                                2026,
                                9,
                                9),
                        new BigDecimal("90.00"),
                        new BigDecimal("88.00"),
                        new BigDecimal("94.00"),
                        new BigDecimal("86.00"),
                        "Strong");

        ProcurementIntelligenceResponse result =
                service.calculate(
                        List.of(
                                packageItem),
                        List.of(
                                bidOne,
                                bidTwo),
                        List.of(
                                supplierOne,
                                supplierTwo),
                        List.of(
                                evaluation));

        assertEquals(
                100.0,
                result.competitionCoveragePercentage());

        assertEquals(
                0,
                result.delayedPackages());

        assertEquals(
                ProcurementRiskLevel.ON_TRACK,
                result.procurementRisk());

        assertTrue(
                result.procurementScore()
                        >= 80);
    }

    @Test
    void noProcurementPlanProducesNeutralNoDataState() {

        ProcurementIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());

        assertEquals(
                ProcurementRiskLevel.NO_DATA,
                result.procurementRisk());

        assertEquals(
                70.0,
                result.procurementScore());
    }

    private ProcurementPackage packageItem(
            LocalDate awardDue,
            LocalDate forecastAward) {

        return ProcurementPackage.create(
                UUID.randomUUID(),
                UUID.randomUUID(),
                UUID.randomUUID(),
                "PKG-TEST",
                "Test Package",
                "Testing",
                new BigDecimal(
                        "100000.00"),
                LocalDate.of(
                        2026,
                        8,
                        1),
                LocalDate.of(
                        2026,
                        8,
                        20),
                awardDue,
                forecastAward,
                LocalDate.of(
                        2026,
                        10,
                        15));
    }

    private Supplier supplier(
            SupplierQualificationStatus status) {

        return Supplier.create(
                UUID.randomUUID(),
                "SUP-A",
                "Supplier A",
                SupplierType.SUBCONTRACTOR,
                "Structure",
                "France",
                null,
                null,
                status);
    }

    private ProcurementBid bid(
            ProcurementPackage packageItem,
            Supplier supplier) {

        return ProcurementBid.create(
                UUID.randomUUID(),
                packageItem.getId(),
                supplier.getId(),
                new BigDecimal(
                        "95000.00"),
                LocalDate.of(
                        2026,
                        8,
                        18),
                new BigDecimal(
                        "85.00"),
                new BigDecimal(
                        "82.00"),
                30,
                "Test");
    }
}
