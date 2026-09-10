package com.buildsight.platform.commercial.service;

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
import com.buildsight.platform.commercial.domain.CommercialChangeOrder;
import com.buildsight.platform.commercial.domain.CommercialChangeOrderStatus;
import com.buildsight.platform.commercial.domain.CommercialClaim;
import com.buildsight.platform.commercial.domain.CommercialClaimStatus;
import com.buildsight.platform.commercial.domain.CommercialClaimType;
import com.buildsight.platform.commercial.domain.PaymentCertificate;
import com.buildsight.platform.commercial.domain.PaymentCertificateStatus;
import com.buildsight.platform.commercial.domain.ProjectCashflowPeriod;

import org.junit.jupiter.api.Test;

class CommercialIntelligenceServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    private final CommercialIntelligenceService service =
            new CommercialIntelligenceService(
                    CLOCK);

    @Test
    void overdueCommercialProcessesAndCashShortfallAreAtRisk() {

        UUID projectId =
                UUID.randomUUID();

        CommercialChangeOrder change =
                CommercialChangeOrder.create(
                        UUID.randomUUID(),
                        projectId,
                        "CO-001",
                        null,
                        "Change",
                        "Change valuation",
                        new BigDecimal("100000"));

        change.update(
                null,
                change.getTitle(),
                change.getDescription(),
                change.getSubmittedAmount(),
                new BigDecimal("90000"),
                null,
                LocalDate.of(
                        2026,
                        8,
                        15),
                LocalDate.of(
                        2026,
                        8,
                        30),
                CommercialChangeOrderStatus.UNDER_REVIEW,
                LocalDate.of(
                        2026,
                        8,
                        15));

        CommercialClaim claim =
                CommercialClaim.create(
                        UUID.randomUUID(),
                        projectId,
                        "CLM-001",
                        CommercialClaimType.DELAY,
                        "Delay claim",
                        "Test basis",
                        new BigDecimal("80000"),
                        14);

        claim.update(
                claim.getClaimType(),
                claim.getTitle(),
                claim.getBasis(),
                claim.getClaimedAmount(),
                new BigDecimal("50000"),
                null,
                claim.getClaimedDays(),
                0,
                LocalDate.of(
                        2026,
                        8,
                        10),
                LocalDate.of(
                        2026,
                        8,
                        25),
                CommercialClaimStatus.UNDER_REVIEW,
                LocalDate.of(
                        2026,
                        8,
                        10));

        PaymentCertificate certificate =
                PaymentCertificate.create(
                        UUID.randomUUID(),
                        projectId,
                        "PC-001",
                        LocalDate.of(
                                2026,
                                7,
                                1),
                        LocalDate.of(
                                2026,
                                7,
                                31),
                        LocalDate.of(
                                2026,
                                8,
                                1),
                        LocalDate.of(
                                2026,
                                8,
                                10),
                        new BigDecimal("250000"));

        certificate.update(
                certificate.getPeriodStart(),
                certificate.getPeriodEnd(),
                certificate.getApplicationDate(),
                certificate.getCertificationDueDate(),
                certificate.getApplicationAmount(),
                null,
                BigDecimal.ZERO,
                null,
                null,
                BigDecimal.ZERO,
                null,
                PaymentCertificateStatus.SUBMITTED);

        ProjectCashflowPeriod cash =
                ProjectCashflowPeriod.create(
                        UUID.randomUUID(),
                        projectId,
                        LocalDate.of(
                                2026,
                                9,
                                1),
                        LocalDate.of(
                                2026,
                                9,
                                30),
                        new BigDecimal("300000"),
                        new BigDecimal("180000"),
                        new BigDecimal("100000"),
                        new BigDecimal("220000"),
                        new BigDecimal("300000"),
                        new BigDecimal("150000"));

        CommercialIntelligenceResponse result =
                service.calculate(
                        List.of(change),
                        List.of(claim),
                        List.of(certificate),
                        List.of(cash));

        assertEquals(
                1,
                result.overdueChangeDecisions());

        assertEquals(
                1,
                result.overdueClaimResponses());

        assertEquals(
                1,
                result.overdueCertifications());

        assertEquals(
                CommercialRiskLevel.AT_RISK,
                result.commercialRisk());

        assertTrue(
                result.commercialScore()
                        < 60);

        assertTrue(
                result.forecastCashflowVariance()
                        .signum() < 0);
    }

    @Test
    void paidCertificateAndControlledCashflowAreOnTrack() {

        UUID projectId =
                UUID.randomUUID();

        PaymentCertificate certificate =
                PaymentCertificate.create(
                        UUID.randomUUID(),
                        projectId,
                        "PC-002",
                        LocalDate.of(
                                2026,
                                7,
                                1),
                        LocalDate.of(
                                2026,
                                7,
                                31),
                        LocalDate.of(
                                2026,
                                8,
                                1),
                        LocalDate.of(
                                2026,
                                8,
                                10),
                        new BigDecimal("200000"));

        certificate.update(
                certificate.getPeriodStart(),
                certificate.getPeriodEnd(),
                certificate.getApplicationDate(),
                certificate.getCertificationDueDate(),
                certificate.getApplicationAmount(),
                new BigDecimal("190000"),
                new BigDecimal("10000"),
                LocalDate.of(
                        2026,
                        8,
                        8),
                LocalDate.of(
                        2026,
                        9,
                        1),
                new BigDecimal("180000"),
                LocalDate.of(
                        2026,
                        8,
                        30),
                PaymentCertificateStatus.PAID);

        CommercialIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(),
                        List.of(certificate),
                        List.of());

        assertEquals(
                0,
                result.overduePayments());

        assertEquals(
                BigDecimal.ZERO.setScale(2),
                result.outstandingCertifiedAmount());

        assertEquals(
                CommercialRiskLevel.ON_TRACK,
                result.commercialRisk());

        assertEquals(
                100,
                result.commercialScore());
    }

    @Test
    void emptyCommercialRegistersReturnNeutralNoData() {

        CommercialIntelligenceResponse result =
                service.calculate(
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());

        assertEquals(
                75,
                result.commercialScore());

        assertEquals(
                CommercialRiskLevel.NO_DATA,
                result.commercialRisk());
    }
}
