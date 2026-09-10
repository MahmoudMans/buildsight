package com.buildsight.platform.bootstrap;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.commercial.domain.CommercialChangeOrder;
import com.buildsight.platform.commercial.domain.CommercialChangeOrderStatus;
import com.buildsight.platform.commercial.domain.CommercialClaim;
import com.buildsight.platform.commercial.domain.CommercialClaimStatus;
import com.buildsight.platform.commercial.domain.CommercialClaimType;
import com.buildsight.platform.commercial.domain.PaymentCertificate;
import com.buildsight.platform.commercial.domain.PaymentCertificateStatus;
import com.buildsight.platform.commercial.domain.ProjectCashflowPeriod;
import com.buildsight.platform.commercial.repository.CommercialChangeOrderRepository;
import com.buildsight.platform.commercial.repository.CommercialClaimRepository;
import com.buildsight.platform.commercial.repository.PaymentCertificateRepository;
import com.buildsight.platform.commercial.repository.ProjectCashflowPeriodRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(90)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoCommercialSeeder
        implements ApplicationRunner {

    private final ProjectRepository
            projectRepository;

    private final CommercialChangeOrderRepository
            changeRepository;

    private final CommercialClaimRepository
            claimRepository;

    private final PaymentCertificateRepository
            certificateRepository;

    private final ProjectCashflowPeriodRepository
            cashflowRepository;

    public DemoCommercialSeeder(
            ProjectRepository projectRepository,
            CommercialChangeOrderRepository changeRepository,
            CommercialClaimRepository claimRepository,
            PaymentCertificateRepository certificateRepository,
            ProjectCashflowPeriodRepository cashflowRepository) {

        this.projectRepository =
                projectRepository;

        this.changeRepository =
                changeRepository;

        this.claimRepository =
                claimRepository;

        this.certificateRepository =
                certificateRepository;

        this.cashflowRepository =
                cashflowRepository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        for (Project project :
                projectRepository.findAll()) {

            seed(
                    project);
        }
    }

    private void seed(
            Project project) {

        if (changeRepository
                .existsByProjectId(
                        project.getId())) {

            return;
        }

        LocalDate today =
                LocalDate.now();

        boolean stressed =
                project.getCode()
                        .endsWith("004");

        CommercialChangeOrder change =
                CommercialChangeOrder.create(
                        UUID.randomUUID(),
                        project.getId(),
                        reference(
                                project,
                                "CO",
                                1),
                        reference(
                                project,
                                "CHG",
                                1),
                        stressed
                                ? "Public-area redesign commercial change"
                                : "Coordinated services adjustment",
                        stressed
                                ? "Commercial valuation for revised public-area scope."
                                : "Commercial valuation associated with coordinated service adjustment.",
                        stressed
                                ? new BigDecimal("285000.00")
                                : new BigDecimal("45000.00"));

        change.update(
                change.getSourceChangeReference(),
                change.getTitle(),
                change.getDescription(),
                change.getSubmittedAmount(),
                stressed
                        ? new BigDecimal("245000.00")
                        : new BigDecimal("42000.00"),
                stressed
                        ? null
                        : new BigDecimal("41500.00"),
                today.minusDays(
                        stressed
                                ? 24
                                : 20),
                stressed
                        ? today.minusDays(8)
                        : today.minusDays(8),
                stressed
                        ? CommercialChangeOrderStatus.UNDER_REVIEW
                        : CommercialChangeOrderStatus.APPROVED,
                stressed
                        ? today
                        : today.minusDays(9));

        changeRepository.save(
                change);

        CommercialClaim claim =
                CommercialClaim.create(
                        UUID.randomUUID(),
                        project.getId(),
                        reference(
                                project,
                                "CLM",
                                1),
                        CommercialClaimType.DELAY,
                        stressed
                                ? "Delay and disruption claim"
                                : "Minor extension-of-time assessment",
                        stressed
                                ? "Claim arising from delayed coordinated information and restricted progress."
                                : "Time assessment associated with revised access sequencing.",
                        stressed
                                ? new BigDecimal("190000.00")
                                : new BigDecimal("20000.00"),
                        stressed
                                ? 21
                                : 3);

        claim.update(
                claim.getClaimType(),
                claim.getTitle(),
                claim.getBasis(),
                claim.getClaimedAmount(),
                stressed
                        ? new BigDecimal("125000.00")
                        : new BigDecimal("12000.00"),
                stressed
                        ? null
                        : new BigDecimal("10000.00"),
                claim.getClaimedDays(),
                stressed
                        ? 0
                        : 2,
                today.minusDays(
                        stressed
                                ? 21
                                : 18),
                stressed
                        ? today.minusDays(6)
                        : today.minusDays(5),
                stressed
                        ? CommercialClaimStatus.UNDER_REVIEW
                        : CommercialClaimStatus.PARTIALLY_APPROVED,
                today.minusDays(4));

        claimRepository.save(
                claim);

        PaymentCertificate certificate =
                PaymentCertificate.create(
                        UUID.randomUUID(),
                        project.getId(),
                        reference(
                                project,
                                "PC",
                                1),
                        today.minusMonths(1)
                                .withDayOfMonth(1),
                        today.minusMonths(1)
                                .withDayOfMonth(
                                        today.minusMonths(1)
                                                .lengthOfMonth()),
                        today.minusDays(28),
                        today.minusDays(18),
                        stressed
                                ? new BigDecimal("680000.00")
                                : new BigDecimal("425000.00"));

        if (stressed) {

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

        } else {

            BigDecimal certified =
                    new BigDecimal("400000.00");

            BigDecimal retention =
                    new BigDecimal("20000.00");

            BigDecimal paid =
                    new BigDecimal("380000.00");

            certificate.update(
                    certificate.getPeriodStart(),
                    certificate.getPeriodEnd(),
                    certificate.getApplicationDate(),
                    certificate.getCertificationDueDate(),
                    certificate.getApplicationAmount(),
                    certified,
                    retention,
                    today.minusDays(17),
                    today.minusDays(3),
                    paid,
                    today.minusDays(4),
                    PaymentCertificateStatus.PAID);
        }

        certificateRepository.save(
                certificate);

        ProjectCashflowPeriod previous =
                ProjectCashflowPeriod.create(
                        UUID.randomUUID(),
                        project.getId(),
                        today.minusMonths(1)
                                .withDayOfMonth(1),
                        today.minusMonths(1)
                                .withDayOfMonth(
                                        today.minusMonths(1)
                                                .lengthOfMonth()),
                        new BigDecimal("450000"),
                        stressed
                                ? new BigDecimal("330000")
                                : new BigDecimal("445000"),
                        stressed
                                ? new BigDecimal("300000")
                                : new BigDecimal("440000"),
                        new BigDecimal("390000"),
                        stressed
                                ? new BigDecimal("475000")
                                : new BigDecimal("395000"),
                        stressed
                                ? new BigDecimal("460000")
                                : new BigDecimal("392000"));

        ProjectCashflowPeriod current =
                ProjectCashflowPeriod.create(
                        UUID.randomUUID(),
                        project.getId(),
                        today.withDayOfMonth(1),
                        today.withDayOfMonth(
                                today.lengthOfMonth()),
                        new BigDecimal("500000"),
                        stressed
                                ? new BigDecimal("380000")
                                : new BigDecimal("510000"),
                        stressed
                                ? new BigDecimal("125000")
                                : new BigDecimal("210000"),
                        new BigDecimal("430000"),
                        stressed
                                ? new BigDecimal("540000")
                                : new BigDecimal("435000"),
                        stressed
                                ? new BigDecimal("250000")
                                : new BigDecimal("205000"));

        cashflowRepository.saveAll(
                List.of(
                        previous,
                        current));

        System.out.println(
                "[BuildSight] Commercial demo data created for "
                        + project.getCode());
    }

    private String reference(
            Project project,
            String type,
            int number) {

        return type
                + "-"
                + project.getCode()
                        .replace(
                                "BS-",
                                "")
                + "-"
                + String.format(
                        "%02d",
                        number);
    }
}
