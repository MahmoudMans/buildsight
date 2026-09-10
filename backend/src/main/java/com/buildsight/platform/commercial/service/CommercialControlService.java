package com.buildsight.platform.commercial.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.buildsight.platform.commercial.api.CashflowPeriodResponse;
import com.buildsight.platform.commercial.api.CommercialChangeOrderResponse;
import com.buildsight.platform.commercial.api.CommercialClaimResponse;
import com.buildsight.platform.commercial.api.CommercialControlResponse;
import com.buildsight.platform.commercial.api.CommercialIntelligenceResponse;
import com.buildsight.platform.commercial.api.CreateCashflowPeriodRequest;
import com.buildsight.platform.commercial.api.CreateCommercialChangeOrderRequest;
import com.buildsight.platform.commercial.api.CreateCommercialClaimRequest;
import com.buildsight.platform.commercial.api.CreatePaymentCertificateRequest;
import com.buildsight.platform.commercial.api.PaymentCertificateResponse;
import com.buildsight.platform.commercial.api.UpdateCashflowPeriodRequest;
import com.buildsight.platform.commercial.api.UpdateCommercialChangeOrderRequest;
import com.buildsight.platform.commercial.api.UpdateCommercialClaimRequest;
import com.buildsight.platform.commercial.api.UpdatePaymentCertificateRequest;
import com.buildsight.platform.commercial.domain.CashflowPeriodStatus;
import com.buildsight.platform.commercial.domain.CommercialChangeOrder;
import com.buildsight.platform.commercial.domain.CommercialChangeOrderStatus;
import com.buildsight.platform.commercial.domain.CommercialClaim;
import com.buildsight.platform.commercial.domain.CommercialClaimStatus;
import com.buildsight.platform.commercial.domain.PaymentCertificate;
import com.buildsight.platform.commercial.domain.PaymentCertificateStatus;
import com.buildsight.platform.commercial.domain.ProjectCashflowPeriod;
import com.buildsight.platform.commercial.repository.CommercialChangeOrderRepository;
import com.buildsight.platform.commercial.repository.CommercialClaimRepository;
import com.buildsight.platform.commercial.repository.PaymentCertificateRepository;
import com.buildsight.platform.commercial.repository.ProjectCashflowPeriodRepository;
import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CommercialControlService {

    private static final Map<
            CommercialChangeOrderStatus,
            Set<CommercialChangeOrderStatus>>
            CHANGE_TRANSITIONS =
            changeTransitions();

    private static final Map<
            CommercialClaimStatus,
            Set<CommercialClaimStatus>>
            CLAIM_TRANSITIONS =
            claimTransitions();

    private static final Map<
            PaymentCertificateStatus,
            Set<PaymentCertificateStatus>>
            CERTIFICATE_TRANSITIONS =
            certificateTransitions();

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

    private final CommercialIntelligenceService
            intelligenceService;

    private final ProjectMapper
            projectMapper;

    private final Clock
            clock;

    public CommercialControlService(
            ProjectRepository projectRepository,
            CommercialChangeOrderRepository changeRepository,
            CommercialClaimRepository claimRepository,
            PaymentCertificateRepository certificateRepository,
            ProjectCashflowPeriodRepository cashflowRepository,
            CommercialIntelligenceService intelligenceService,
            ProjectMapper projectMapper,
            Clock clock) {

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

        this.intelligenceService =
                intelligenceService;

        this.projectMapper =
                projectMapper;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public CommercialControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        List<CommercialChangeOrder> changes =
                changeRepository
                        .findByProjectIdOrderByCreatedAtDesc(
                                projectId);

        List<CommercialClaim> claims =
                claimRepository
                        .findByProjectIdOrderByCreatedAtDesc(
                                projectId);

        List<PaymentCertificate> certificates =
                certificateRepository
                        .findByProjectIdOrderByPeriodEndDescCreatedAtDesc(
                                projectId);

        List<ProjectCashflowPeriod> cashflow =
                cashflowRepository
                        .findByProjectIdOrderByPeriodStartAsc(
                                projectId);

        return new CommercialControlResponse(
                projectMapper.toResponse(
                        project),

                intelligenceService.calculate(
                        changes,
                        claims,
                        certificates,
                        cashflow),

                changes.stream()
                        .map(this::toChangeResponse)
                        .toList(),

                claims.stream()
                        .map(this::toClaimResponse)
                        .toList(),

                certificates.stream()
                        .map(this::toCertificateResponse)
                        .toList(),

                cashflow.stream()
                        .map(this::toCashflowResponse)
                        .toList());
    }

    @Transactional(readOnly = true)
    public CommercialIntelligenceResponse intelligence(
            UUID projectId) {

        requireProject(projectId);

        return intelligenceService.calculate(
                changeRepository
                        .findByProjectIdOrderByCreatedAtDesc(
                                projectId),

                claimRepository
                        .findByProjectIdOrderByCreatedAtDesc(
                                projectId),

                certificateRepository
                        .findByProjectIdOrderByPeriodEndDescCreatedAtDesc(
                                projectId),

                cashflowRepository
                        .findByProjectIdOrderByPeriodStartAsc(
                                projectId));
    }

    @Transactional
    public CommercialChangeOrderResponse createChangeOrder(
            UUID projectId,
            CreateCommercialChangeOrderRequest request) {

        requireProject(projectId);

        String reference =
                reference(
                        request.reference());

        if (changeRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Commercial change-order reference '%s' already exists."
                            .formatted(reference));
        }

        CommercialChangeOrder change =
                CommercialChangeOrder.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        normalizeReference(
                                request.sourceChangeReference()),
                        request.title().trim(),
                        request.description().trim(),
                        request.submittedAmount());

        return toChangeResponse(
                changeRepository.save(
                        change));
    }

    @Transactional
    public CommercialChangeOrderResponse updateChangeOrder(
            UUID projectId,
            UUID changeOrderId,
            UpdateCommercialChangeOrderRequest request) {

        requireProject(projectId);

        CommercialChangeOrder change =
                changeRepository
                        .findByIdAndProjectId(
                                changeOrderId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Commercial change order '%s' was not found."
                                                        .formatted(
                                                                changeOrderId)));

        verifyVersion(
                change.getVersion(),
                request.version(),
                "commercial change order");

        validateTransition(
                CHANGE_TRANSITIONS,
                change.getStatus(),
                request.status(),
                "commercial change order");

        LocalDate submittedDate =
                request.submittedDate();

        LocalDate decisionDueDate =
                request.decisionDueDate();

        if (request.status()
                        != CommercialChangeOrderStatus.DRAFT
                && request.status()
                        != CommercialChangeOrderStatus.VOID) {

            if (submittedDate == null) {
                submittedDate =
                        LocalDate.now(clock);
            }

            if (decisionDueDate == null) {
                throw new InvalidRequestException(
                        "A submitted commercial change requires a decision due date.");
            }

            if (decisionDueDate.isBefore(
                    submittedDate)) {

                throw new InvalidRequestException(
                        "Change-order decision due date cannot be before submission.");
            }
        }

        if (request.status()
                == CommercialChangeOrderStatus.APPROVED) {

            if (request.approvedAmount() == null) {

                throw new InvalidRequestException(
                        "An approved commercial change requires an approved amount.");
            }
        }

        change.update(
                normalizeReference(
                        request.sourceChangeReference()),
                request.title().trim(),
                request.description().trim(),
                request.submittedAmount(),
                request.assessedAmount(),
                request.approvedAmount(),
                submittedDate,
                decisionDueDate,
                request.status(),
                LocalDate.now(clock));

        return toChangeResponse(
                changeRepository
                        .saveAndFlush(
                                change));
    }

    @Transactional
    public CommercialClaimResponse createClaim(
            UUID projectId,
            CreateCommercialClaimRequest request) {

        requireProject(projectId);

        String reference =
                reference(
                        request.reference());

        if (claimRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Commercial claim reference '%s' already exists."
                            .formatted(reference));
        }

        CommercialClaim claim =
                CommercialClaim.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.claimType(),
                        request.title().trim(),
                        request.basis().trim(),
                        request.claimedAmount(),
                        request.claimedDays());

        return toClaimResponse(
                claimRepository.save(
                        claim));
    }

    @Transactional
    public CommercialClaimResponse updateClaim(
            UUID projectId,
            UUID claimId,
            UpdateCommercialClaimRequest request) {

        requireProject(projectId);

        CommercialClaim claim =
                claimRepository
                        .findByIdAndProjectId(
                                claimId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Commercial claim '%s' was not found."
                                                        .formatted(claimId)));

        verifyVersion(
                claim.getVersion(),
                request.version(),
                "commercial claim");

        validateTransition(
                CLAIM_TRANSITIONS,
                claim.getStatus(),
                request.status(),
                "commercial claim");

        LocalDate submittedDate =
                request.submittedDate();

        LocalDate responseDueDate =
                request.responseDueDate();

        if (request.status()
                        != CommercialClaimStatus.DRAFT
                && request.status()
                        != CommercialClaimStatus.VOID) {

            if (submittedDate == null) {
                submittedDate =
                        LocalDate.now(clock);
            }

            if ((request.status()
                            == CommercialClaimStatus.SUBMITTED
                    || request.status()
                            == CommercialClaimStatus.UNDER_REVIEW)
                    && responseDueDate == null) {

                throw new InvalidRequestException(
                        "A submitted claim requires a response due date.");
            }
        }

        if (responseDueDate != null
                && submittedDate != null
                && responseDueDate.isBefore(
                        submittedDate)) {

            throw new InvalidRequestException(
                    "Claim response due date cannot be before submission.");
        }

        if (request.status()
                        == CommercialClaimStatus.PARTIALLY_APPROVED
                || request.status()
                        == CommercialClaimStatus.APPROVED
                || request.status()
                        == CommercialClaimStatus.SETTLED) {

            if (request.awardedAmount() == null) {

                throw new InvalidRequestException(
                        "An approved or settled claim requires an awarded amount.");
            }

            if (request.awardedDays()
                    > request.claimedDays()) {

                throw new InvalidRequestException(
                        "Awarded extension days cannot exceed claimed days.");
            }
        }

        BigDecimal awardedAmount =
                request.status()
                                == CommercialClaimStatus.REJECTED
                        ? BigDecimal.ZERO
                        : request.awardedAmount();

        int awardedDays =
                request.status()
                                == CommercialClaimStatus.REJECTED
                        ? 0
                        : request.awardedDays();

        claim.update(
                request.claimType(),
                request.title().trim(),
                request.basis().trim(),
                request.claimedAmount(),
                request.assessedAmount(),
                awardedAmount,
                request.claimedDays(),
                awardedDays,
                submittedDate,
                responseDueDate,
                request.status(),
                LocalDate.now(clock));

        return toClaimResponse(
                claimRepository
                        .saveAndFlush(
                                claim));
    }

    @Transactional
    public PaymentCertificateResponse createPaymentCertificate(
            UUID projectId,
            CreatePaymentCertificateRequest request) {

        requireProject(projectId);

        validatePeriod(
                request.periodStart(),
                request.periodEnd());

        validateNotFuture(
                request.applicationDate(),
                "Payment application date");

        if (request.certificationDueDate()
                .isBefore(
                        request.applicationDate())) {

            throw new InvalidRequestException(
                    "Certification due date cannot be before application date.");
        }

        String reference =
                reference(
                        request.reference());

        if (certificateRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Payment certificate reference '%s' already exists."
                            .formatted(reference));
        }

        PaymentCertificate certificate =
                PaymentCertificate.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.periodStart(),
                        request.periodEnd(),
                        request.applicationDate(),
                        request.certificationDueDate(),
                        request.applicationAmount());

        return toCertificateResponse(
                certificateRepository.save(
                        certificate));
    }

    @Transactional
    public PaymentCertificateResponse updatePaymentCertificate(
            UUID projectId,
            UUID certificateId,
            UpdatePaymentCertificateRequest request) {

        requireProject(projectId);

        PaymentCertificate certificate =
                certificateRepository
                        .findByIdAndProjectId(
                                certificateId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Payment certificate '%s' was not found."
                                                        .formatted(
                                                                certificateId)));

        verifyVersion(
                certificate.getVersion(),
                request.version(),
                "payment certificate");

        validateTransition(
                CERTIFICATE_TRANSITIONS,
                certificate.getStatus(),
                request.status(),
                "payment certificate");

        validatePeriod(
                request.periodStart(),
                request.periodEnd());

        if (request.certificationDueDate()
                .isBefore(
                        request.applicationDate())) {

            throw new InvalidRequestException(
                    "Certification due date cannot be before application date.");
        }

        BigDecimal certified =
                request.certifiedAmount();

        BigDecimal retention =
                request.retentionAmount() == null
                        ? BigDecimal.ZERO
                        : request.retentionAmount();

        LocalDate certifiedDate =
                request.certifiedDate();

        LocalDate paymentDue =
                request.paymentDueDate();

        BigDecimal amountPaid =
                request.amountPaid();

        LocalDate paymentDate =
                request.lastPaymentDate();

        boolean certifiedStatus =
                request.status()
                                == PaymentCertificateStatus.CERTIFIED
                        || request.status()
                                == PaymentCertificateStatus.PARTIALLY_PAID
                        || request.status()
                                == PaymentCertificateStatus.PAID;

        if (certifiedStatus) {

            if (certified == null) {

                throw new InvalidRequestException(
                        "A certified payment application requires a certified amount.");
            }

            if (retention.compareTo(
                    certified) > 0) {

                throw new InvalidRequestException(
                        "Retention cannot exceed the certified amount.");
            }

            if (certifiedDate == null) {
                certifiedDate =
                        LocalDate.now(clock);
            }

            if (paymentDue == null) {

                throw new InvalidRequestException(
                        "A certified payment requires a payment due date.");
            }

            if (paymentDue.isBefore(
                    certifiedDate)) {

                throw new InvalidRequestException(
                        "Payment due date cannot be before certification date.");
            }
        }

        BigDecimal netCertified =
                certified == null
                        ? BigDecimal.ZERO
                        : certified
                                .subtract(retention)
                                .max(BigDecimal.ZERO);

        if (amountPaid.compareTo(
                netCertified) > 0) {

            throw new InvalidRequestException(
                    "Amount paid cannot exceed the net certified amount.");
        }

        if (request.status()
                == PaymentCertificateStatus.PARTIALLY_PAID) {

            if (amountPaid.signum() <= 0
                    || amountPaid.compareTo(
                            netCertified) >= 0) {

                throw new InvalidRequestException(
                        "PARTIALLY_PAID requires payment above zero but below net certified value.");
            }

            if (paymentDate == null) {
                paymentDate =
                        LocalDate.now(clock);
            }
        }

        if (request.status()
                == PaymentCertificateStatus.PAID) {

            if (amountPaid.compareTo(
                    netCertified) < 0) {

                throw new InvalidRequestException(
                        "PAID requires the full net certified amount to be recorded as paid.");
            }

            if (paymentDate == null) {
                paymentDate =
                        LocalDate.now(clock);
            }
        }

        certificate.update(
                request.periodStart(),
                request.periodEnd(),
                request.applicationDate(),
                request.certificationDueDate(),
                request.applicationAmount(),
                certified,
                retention,
                certifiedDate,
                paymentDue,
                amountPaid,
                paymentDate,
                request.status());

        return toCertificateResponse(
                certificateRepository
                        .saveAndFlush(
                                certificate));
    }

    @Transactional
    public CashflowPeriodResponse createCashflowPeriod(
            UUID projectId,
            CreateCashflowPeriodRequest request) {

        requireProject(projectId);

        validatePeriod(
                request.periodStart(),
                request.periodEnd());

        if (cashflowRepository
                .existsByProjectIdAndPeriodStart(
                        projectId,
                        request.periodStart())) {

            throw new ConflictException(
                    "A cash-flow period starting '%s' already exists."
                            .formatted(
                                    request.periodStart()));
        }

        ProjectCashflowPeriod period =
                ProjectCashflowPeriod.create(
                        UUID.randomUUID(),
                        projectId,
                        request.periodStart(),
                        request.periodEnd(),
                        request.plannedInflow(),
                        request.forecastInflow(),
                        request.actualInflow(),
                        request.plannedOutflow(),
                        request.forecastOutflow(),
                        request.actualOutflow());

        return toCashflowResponse(
                cashflowRepository.save(
                        period));
    }

    @Transactional
    public CashflowPeriodResponse updateCashflowPeriod(
            UUID projectId,
            UUID periodId,
            UpdateCashflowPeriodRequest request) {

        requireProject(projectId);

        ProjectCashflowPeriod period =
                cashflowRepository
                        .findByIdAndProjectId(
                                periodId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Cash-flow period '%s' was not found."
                                                        .formatted(periodId)));

        verifyVersion(
                period.getVersion(),
                request.version(),
                "cash-flow period");

        validatePeriod(
                period.getPeriodStart(),
                request.periodEnd());

        period.update(
                request.periodEnd(),
                request.plannedInflow(),
                request.forecastInflow(),
                request.actualInflow(),
                request.plannedOutflow(),
                request.forecastOutflow(),
                request.actualOutflow(),
                request.status());

        return toCashflowResponse(
                cashflowRepository
                        .saveAndFlush(
                                period));
    }

    private Project requireProject(
            UUID projectId) {

        return projectRepository
                .findById(projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Project '%s' was not found."
                                                .formatted(projectId)));
    }

    private void validateNotFuture(
            LocalDate date,
            String field) {

        if (date.isAfter(
                LocalDate.now(clock))) {

            throw new InvalidRequestException(
                    field
                            + " cannot be in the future.");
        }
    }

    private void validatePeriod(
            LocalDate start,
            LocalDate end) {

        if (end.isBefore(start)) {

            throw new InvalidRequestException(
                    "Period end cannot be before period start.");
        }
    }

    private void verifyVersion(
            long current,
            long requested,
            String resource) {

        if (current != requested) {

            throw new ConflictException(
                    "The %s was changed by another operation. Refresh before submitting your change."
                            .formatted(resource));
        }
    }

    private <T extends Enum<T>>
    void validateTransition(
            Map<T, Set<T>> transitions,
            T current,
            T target,
            String resource) {

        if (current == target) {
            return;
        }

        if (!transitions
                .getOrDefault(
                        current,
                        Set.of())
                .contains(target)) {

            throw new InvalidRequestException(
                    "%s status cannot transition from '%s' to '%s'."
                            .formatted(
                                    resource,
                                    current,
                                    target));
        }
    }

    private String reference(
            String value) {

        return value
                .trim()
                .toUpperCase(
                        Locale.ROOT);
    }

    private String normalizeReference(
            String value) {

        String normalized =
                normalize(value);

        return normalized == null
                ? null
                : normalized.toUpperCase(
                        Locale.ROOT);
    }

    private String normalize(
            String value) {

        if (value == null) {
            return null;
        }

        String trimmed =
                value.trim();

        return trimmed.isBlank()
                ? null
                : trimmed;
    }

    private CommercialChangeOrderResponse toChangeResponse(
            CommercialChangeOrder change) {

        boolean overdue =
                isPendingChange(change)
                        && change.getDecisionDueDate() != null
                        && change.getDecisionDueDate()
                                .isBefore(
                                        LocalDate.now(clock));

        return new CommercialChangeOrderResponse(
                change.getId(),
                change.getProjectId(),
                change.getReference(),
                change.getSourceChangeReference(),
                change.getTitle(),
                change.getDescription(),
                change.getSubmittedAmount(),
                change.getAssessedAmount(),
                change.getApprovedAmount(),
                change.getSubmittedDate(),
                change.getDecisionDueDate(),
                change.getDecisionDate(),
                change.getStatus(),
                overdue,
                change.getVersion(),
                change.getCreatedAt(),
                change.getUpdatedAt());
    }

    private CommercialClaimResponse toClaimResponse(
            CommercialClaim claim) {

        boolean overdue =
                (claim.getStatus()
                                == CommercialClaimStatus.SUBMITTED
                        || claim.getStatus()
                                == CommercialClaimStatus.UNDER_REVIEW)
                        && claim.getResponseDueDate() != null
                        && claim.getResponseDueDate()
                                .isBefore(
                                        LocalDate.now(clock));

        return new CommercialClaimResponse(
                claim.getId(),
                claim.getProjectId(),
                claim.getReference(),
                claim.getClaimType(),
                claim.getTitle(),
                claim.getBasis(),
                claim.getClaimedAmount(),
                claim.getAssessedAmount(),
                claim.getAwardedAmount(),
                claim.getClaimedDays(),
                claim.getAwardedDays(),
                claim.getSubmittedDate(),
                claim.getResponseDueDate(),
                claim.getDecisionDate(),
                claim.getStatus(),
                overdue,
                claim.getVersion(),
                claim.getCreatedAt(),
                claim.getUpdatedAt());
    }

    private PaymentCertificateResponse toCertificateResponse(
            PaymentCertificate certificate) {

        LocalDate today =
                LocalDate.now(clock);

        boolean overdueCertification =
                certificate.getStatus()
                                == PaymentCertificateStatus.SUBMITTED
                        && certificate.getCertificationDueDate()
                                .isBefore(today);

        boolean overduePayment =
                (certificate.getStatus()
                                == PaymentCertificateStatus.CERTIFIED
                        || certificate.getStatus()
                                == PaymentCertificateStatus.PARTIALLY_PAID)
                        && certificate.getPaymentDueDate() != null
                        && certificate.getPaymentDueDate()
                                .isBefore(today)
                        && certificate.outstandingAmount()
                                .signum() > 0;

        return new PaymentCertificateResponse(
                certificate.getId(),
                certificate.getProjectId(),
                certificate.getReference(),
                certificate.getPeriodStart(),
                certificate.getPeriodEnd(),
                certificate.getApplicationDate(),
                certificate.getCertificationDueDate(),
                certificate.getApplicationAmount(),
                certificate.getCertifiedAmount(),
                certificate.getRetentionAmount(),
                certificate.netCertifiedAmount(),
                certificate.getCertifiedDate(),
                certificate.getPaymentDueDate(),
                certificate.getAmountPaid(),
                certificate.outstandingAmount(),
                certificate.getLastPaymentDate(),
                certificate.getStatus(),
                overdueCertification,
                overduePayment,
                certificate.getVersion(),
                certificate.getCreatedAt(),
                certificate.getUpdatedAt());
    }

    private CashflowPeriodResponse toCashflowResponse(
            ProjectCashflowPeriod period) {

        return new CashflowPeriodResponse(
                period.getId(),
                period.getProjectId(),
                period.getPeriodStart(),
                period.getPeriodEnd(),
                period.getPlannedInflow(),
                period.getForecastInflow(),
                period.getActualInflow(),
                period.getPlannedOutflow(),
                period.getForecastOutflow(),
                period.getActualOutflow(),
                period.plannedNet(),
                period.forecastNet(),
                period.actualNet(),
                period.forecastNet()
                        .subtract(
                                period.plannedNet()),
                period.getStatus(),
                period.getVersion(),
                period.getCreatedAt(),
                period.getUpdatedAt());
    }

    private boolean isPendingChange(
            CommercialChangeOrder change) {

        return change.getStatus()
                        == CommercialChangeOrderStatus.SUBMITTED
                || change.getStatus()
                        == CommercialChangeOrderStatus.UNDER_REVIEW;
    }

    private static Map<
            CommercialChangeOrderStatus,
            Set<CommercialChangeOrderStatus>>
    changeTransitions() {

        Map<
                CommercialChangeOrderStatus,
                Set<CommercialChangeOrderStatus>>
                map =
                new EnumMap<>(
                        CommercialChangeOrderStatus.class);

        map.put(
                CommercialChangeOrderStatus.DRAFT,
                Set.of(
                        CommercialChangeOrderStatus.SUBMITTED,
                        CommercialChangeOrderStatus.VOID));

        map.put(
                CommercialChangeOrderStatus.SUBMITTED,
                Set.of(
                        CommercialChangeOrderStatus.UNDER_REVIEW,
                        CommercialChangeOrderStatus.APPROVED,
                        CommercialChangeOrderStatus.REJECTED,
                        CommercialChangeOrderStatus.VOID));

        map.put(
                CommercialChangeOrderStatus.UNDER_REVIEW,
                Set.of(
                        CommercialChangeOrderStatus.APPROVED,
                        CommercialChangeOrderStatus.REJECTED,
                        CommercialChangeOrderStatus.VOID));

        map.put(
                CommercialChangeOrderStatus.APPROVED,
                Set.of());

        map.put(
                CommercialChangeOrderStatus.REJECTED,
                Set.of());

        map.put(
                CommercialChangeOrderStatus.VOID,
                Set.of());

        return Map.copyOf(map);
    }

    private static Map<
            CommercialClaimStatus,
            Set<CommercialClaimStatus>>
    claimTransitions() {

        Map<
                CommercialClaimStatus,
                Set<CommercialClaimStatus>>
                map =
                new EnumMap<>(
                        CommercialClaimStatus.class);

        map.put(
                CommercialClaimStatus.DRAFT,
                Set.of(
                        CommercialClaimStatus.SUBMITTED,
                        CommercialClaimStatus.VOID));

        map.put(
                CommercialClaimStatus.SUBMITTED,
                Set.of(
                        CommercialClaimStatus.UNDER_REVIEW,
                        CommercialClaimStatus.PARTIALLY_APPROVED,
                        CommercialClaimStatus.APPROVED,
                        CommercialClaimStatus.REJECTED,
                        CommercialClaimStatus.VOID));

        map.put(
                CommercialClaimStatus.UNDER_REVIEW,
                Set.of(
                        CommercialClaimStatus.PARTIALLY_APPROVED,
                        CommercialClaimStatus.APPROVED,
                        CommercialClaimStatus.REJECTED,
                        CommercialClaimStatus.VOID));

        map.put(
                CommercialClaimStatus.PARTIALLY_APPROVED,
                Set.of(
                        CommercialClaimStatus.SETTLED));

        map.put(
                CommercialClaimStatus.APPROVED,
                Set.of(
                        CommercialClaimStatus.SETTLED));

        map.put(
                CommercialClaimStatus.REJECTED,
                Set.of());

        map.put(
                CommercialClaimStatus.SETTLED,
                Set.of());

        map.put(
                CommercialClaimStatus.VOID,
                Set.of());

        return Map.copyOf(map);
    }

    private static Map<
            PaymentCertificateStatus,
            Set<PaymentCertificateStatus>>
    certificateTransitions() {

        Map<
                PaymentCertificateStatus,
                Set<PaymentCertificateStatus>>
                map =
                new EnumMap<>(
                        PaymentCertificateStatus.class);

        map.put(
                PaymentCertificateStatus.DRAFT,
                Set.of(
                        PaymentCertificateStatus.SUBMITTED,
                        PaymentCertificateStatus.VOID));

        map.put(
                PaymentCertificateStatus.SUBMITTED,
                Set.of(
                        PaymentCertificateStatus.CERTIFIED,
                        PaymentCertificateStatus.REJECTED,
                        PaymentCertificateStatus.VOID));

        map.put(
                PaymentCertificateStatus.CERTIFIED,
                Set.of(
                        PaymentCertificateStatus.PARTIALLY_PAID,
                        PaymentCertificateStatus.PAID));

        map.put(
                PaymentCertificateStatus.PARTIALLY_PAID,
                Set.of(
                        PaymentCertificateStatus.PAID));

        map.put(
                PaymentCertificateStatus.PAID,
                Set.of());

        map.put(
                PaymentCertificateStatus.REJECTED,
                Set.of());

        map.put(
                PaymentCertificateStatus.VOID,
                Set.of());

        return Map.copyOf(map);
    }
}
