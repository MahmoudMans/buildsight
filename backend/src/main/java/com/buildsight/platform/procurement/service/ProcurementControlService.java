package com.buildsight.platform.procurement.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Collection;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.cost.api.CostCodeResponse;
import com.buildsight.platform.cost.domain.CommitmentStatus;
import com.buildsight.platform.cost.domain.ProjectCommitment;
import com.buildsight.platform.cost.domain.ProjectCostCode;
import com.buildsight.platform.cost.repository.ProjectCommitmentRepository;
import com.buildsight.platform.cost.repository.ProjectCostCodeRepository;
import com.buildsight.platform.procurement.api.AwardProcurementPackageRequest;
import com.buildsight.platform.procurement.api.CreateProcurementBidRequest;
import com.buildsight.platform.procurement.api.CreateProcurementPackageRequest;
import com.buildsight.platform.procurement.api.CreateSupplierPerformanceEvaluationRequest;
import com.buildsight.platform.procurement.api.CreateSupplierRequest;
import com.buildsight.platform.procurement.api.ProcurementBidResponse;
import com.buildsight.platform.procurement.api.ProcurementControlResponse;
import com.buildsight.platform.procurement.api.ProcurementIntelligenceResponse;
import com.buildsight.platform.procurement.api.ProcurementPackageResponse;
import com.buildsight.platform.procurement.api.SupplierPerformanceEvaluationResponse;
import com.buildsight.platform.procurement.api.SupplierResponse;
import com.buildsight.platform.procurement.api.UpdateProcurementBidRequest;
import com.buildsight.platform.procurement.api.UpdateProcurementPackageRequest;
import com.buildsight.platform.procurement.api.UpdateSupplierRequest;
import com.buildsight.platform.procurement.domain.ProcurementBid;
import com.buildsight.platform.procurement.domain.ProcurementBidStatus;
import com.buildsight.platform.procurement.domain.ProcurementPackage;
import com.buildsight.platform.procurement.domain.ProcurementPackageStatus;
import com.buildsight.platform.procurement.domain.Supplier;
import com.buildsight.platform.procurement.domain.SupplierPerformanceEvaluation;
import com.buildsight.platform.procurement.domain.SupplierQualificationStatus;
import com.buildsight.platform.procurement.repository.ProcurementBidRepository;
import com.buildsight.platform.procurement.repository.ProcurementPackageRepository;
import com.buildsight.platform.procurement.repository.SupplierPerformanceEvaluationRepository;
import com.buildsight.platform.procurement.repository.SupplierRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProcurementControlService {

    private static final Map<
            ProcurementPackageStatus,
            Set<ProcurementPackageStatus>>
            PACKAGE_TRANSITIONS =
            packageTransitions();

    private final ProjectRepository
            projectRepository;

    private final ProjectCostCodeRepository
            costCodeRepository;

    private final ProjectCommitmentRepository
            commitmentRepository;

    private final SupplierRepository
            supplierRepository;

    private final ProcurementPackageRepository
            packageRepository;

    private final ProcurementBidRepository
            bidRepository;

    private final SupplierPerformanceEvaluationRepository
            evaluationRepository;

    private final ProcurementIntelligenceService
            intelligenceService;

    private final ProjectMapper
            projectMapper;

    private final Clock clock;

    public ProcurementControlService(
            ProjectRepository projectRepository,
            ProjectCostCodeRepository costCodeRepository,
            ProjectCommitmentRepository commitmentRepository,
            SupplierRepository supplierRepository,
            ProcurementPackageRepository packageRepository,
            ProcurementBidRepository bidRepository,
            SupplierPerformanceEvaluationRepository evaluationRepository,
            ProcurementIntelligenceService intelligenceService,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.costCodeRepository =
                costCodeRepository;

        this.commitmentRepository =
                commitmentRepository;

        this.supplierRepository =
                supplierRepository;

        this.packageRepository =
                packageRepository;

        this.bidRepository =
                bidRepository;

        this.evaluationRepository =
                evaluationRepository;

        this.intelligenceService =
                intelligenceService;

        this.projectMapper =
                projectMapper;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public ProcurementControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        List<ProjectCostCode> costCodes =
                costCodeRepository
                        .findByProjectIdOrderBySortOrderAscCodeAsc(
                                projectId);

        List<Supplier> suppliers =
                supplierRepository
                        .findAllByOrderByNameAsc();

        List<ProcurementPackage> packages =
                packageRepository
                        .findByProjectIdOrderByAwardDueDateAscCreatedAtAsc(
                                projectId);

        List<UUID> packageIds =
                packages.stream()
                        .map(
                                ProcurementPackage::getId)
                        .toList();

        List<ProcurementBid> bids =
                packageIds.isEmpty()
                        ? List.of()
                        : bidRepository
                                .findByProcurementPackageIdInOrderBySubmittedDateDescCreatedAtDesc(
                                        packageIds);

        List<SupplierPerformanceEvaluation>
                evaluations =
                evaluationRepository
                        .findByProjectIdOrderByEvaluationDateDescCreatedAtDesc(
                                projectId);

        List<ProjectCommitment> commitments =
                commitmentRepository
                        .findByProjectIdOrderByCommitmentDateDescCreatedAtDesc(
                                projectId);

        Map<UUID, ProjectCostCode> costCodeMap =
                costCodes.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectCostCode::getId,
                                        Function.identity()));

        Map<UUID, Supplier> supplierMap =
                suppliers.stream()
                        .collect(
                                Collectors.toMap(
                                        Supplier::getId,
                                        Function.identity()));

        Map<UUID, ProcurementPackage> packageMap =
                packages.stream()
                        .collect(
                                Collectors.toMap(
                                        ProcurementPackage::getId,
                                        Function.identity()));

        Map<UUID, ProjectCommitment> commitmentMap =
                commitments.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectCommitment::getId,
                                        Function.identity()));

        Map<UUID, Long> bidCountMap =
                bids.stream()
                        .collect(
                                Collectors.groupingBy(
                                        ProcurementBid::getProcurementPackageId,
                                        Collectors.counting()));

        ProcurementIntelligenceResponse intelligence =
                intelligenceService.calculate(
                        packages,
                        bids,
                        suppliers,
                        evaluations);

        return new ProcurementControlResponse(
                projectMapper.toResponse(
                        project),

                intelligence,

                costCodes.stream()
                        .map(
                                this::toCostCodeResponse)
                        .toList(),

                suppliers.stream()
                        .map(
                                this::toSupplierResponse)
                        .toList(),

                packages.stream()
                        .map(
                                packageItem ->
                                        toPackageResponse(
                                                packageItem,
                                                requireCostCode(
                                                        costCodeMap,
                                                        packageItem.getCostCodeId()),
                                                supplierMap.get(
                                                        packageItem.getAwardedSupplierId()),
                                                commitmentMap.get(
                                                        packageItem.getCommitmentId()),
                                                bidCountMap.getOrDefault(
                                                        packageItem.getId(),
                                                        0L)))
                        .toList(),

                bids.stream()
                        .map(
                                bid ->
                                        toBidResponse(
                                                bid,
                                                requirePackage(
                                                        packageMap,
                                                        bid.getProcurementPackageId()),
                                                requireSupplier(
                                                        supplierMap,
                                                        bid.getSupplierId())))
                        .toList(),

                evaluations.stream()
                        .map(
                                evaluation ->
                                        toEvaluationResponse(
                                                evaluation,
                                                requireSupplier(
                                                        supplierMap,
                                                        evaluation.getSupplierId()),
                                                evaluation.getProcurementPackageId()
                                                                == null
                                                        ? null
                                                        : packageMap.get(
                                                                evaluation.getProcurementPackageId())))
                        .toList());
    }

    @Transactional(readOnly = true)
    public ProcurementIntelligenceResponse intelligence(
            UUID projectId) {

        requireProject(
                projectId);

        List<ProcurementPackage> packages =
                packageRepository
                        .findByProjectIdOrderByAwardDueDateAscCreatedAtAsc(
                                projectId);

        Collection<UUID> packageIds =
                packages.stream()
                        .map(
                                ProcurementPackage::getId)
                        .toList();

        List<ProcurementBid> bids =
                packageIds.isEmpty()
                        ? List.of()
                        : bidRepository
                                .findByProcurementPackageIdInOrderBySubmittedDateDescCreatedAtDesc(
                                        packageIds);

        return intelligenceService.calculate(
                packages,
                bids,
                supplierRepository
                        .findAllByOrderByNameAsc(),
                evaluationRepository
                        .findByProjectIdOrderByEvaluationDateDescCreatedAtDesc(
                                projectId));
    }

    @Transactional(readOnly = true)
    public List<SupplierResponse> suppliers() {

        return supplierRepository
                .findAllByOrderByNameAsc()
                .stream()
                .map(
                        this::toSupplierResponse)
                .toList();
    }

    @Transactional
    public SupplierResponse createSupplier(
            CreateSupplierRequest request) {

        String code =
                request.code()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (supplierRepository
                .existsByCodeIgnoreCase(
                        code)) {

            throw new ConflictException(
                    "Supplier code '%s' already exists."
                            .formatted(
                                    code));
        }

        Supplier supplier =
                Supplier.create(
                        UUID.randomUUID(),
                        code,
                        request.name()
                                .trim(),
                        request.supplierType(),
                        normalize(
                                request.trade()),
                        normalize(
                                request.country()),
                        normalize(
                                request.contactPerson()),
                        normalize(
                                request.email()),
                        request.qualificationStatus());

        return toSupplierResponse(
                supplierRepository.save(
                        supplier));
    }

    @Transactional
    public SupplierResponse updateSupplier(
            UUID supplierId,
            UpdateSupplierRequest request) {

        Supplier supplier =
                requireSupplier(
                        supplierId);

        verifyVersion(
                supplier.getVersion(),
                request.version(),
                "supplier");

        supplier.update(
                request.name()
                        .trim(),
                request.supplierType(),
                normalize(
                        request.trade()),
                normalize(
                        request.country()),
                normalize(
                        request.contactPerson()),
                normalize(
                        request.email()),
                request.qualificationStatus());

        return toSupplierResponse(
                supplierRepository
                        .saveAndFlush(
                                supplier));
    }

    @Transactional
    public ProcurementPackageResponse createPackage(
            UUID projectId,
            CreateProcurementPackageRequest request) {

        requireProject(
                projectId);

        ProjectCostCode costCode =
                requireCostCode(
                        projectId,
                        request.costCodeId());

        validateDates(
                request.plannedIssueDate(),
                request.bidDueDate(),
                request.awardDueDate(),
                request.requiredOnSiteDate());

        String reference =
                request.reference()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (packageRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Procurement package reference '%s' already exists."
                            .formatted(
                                    reference));
        }

        LocalDate forecast =
                request.forecastAwardDate()
                                == null
                        ? request.awardDueDate()
                        : request.forecastAwardDate();

        ProcurementPackage packageItem =
                ProcurementPackage.create(
                        UUID.randomUUID(),
                        projectId,
                        costCode.getId(),
                        reference,
                        request.title()
                                .trim(),
                        normalize(
                                request.description()),
                        request.estimatedValue(),
                        request.plannedIssueDate(),
                        request.bidDueDate(),
                        request.awardDueDate(),
                        forecast,
                        request.requiredOnSiteDate());

        return toPackageResponse(
                packageRepository.save(
                        packageItem),
                costCode,
                null,
                null,
                0);
    }

    @Transactional
    public ProcurementPackageResponse updatePackage(
            UUID projectId,
            UUID packageId,
            UpdateProcurementPackageRequest request) {

        requireProject(
                projectId);

        ProcurementPackage packageItem =
                requirePackage(
                        projectId,
                        packageId);

        verifyVersion(
                packageItem.getVersion(),
                request.version(),
                "procurement package");

        validateDates(
                request.plannedIssueDate(),
                request.bidDueDate(),
                request.awardDueDate(),
                request.requiredOnSiteDate());

        ProcurementPackageStatus current =
                packageItem.getStatus();

        ProcurementPackageStatus target =
                request.status();

        if (target
                == ProcurementPackageStatus.AWARDED) {

            throw new InvalidRequestException(
                    "A procurement package must be awarded through the governed award operation.");
        }

        if (current != target) {
            Set<ProcurementPackageStatus> allowed =
                    PACKAGE_TRANSITIONS
                            .getOrDefault(
                                    current,
                                    Set.of());

            if (!allowed.contains(
                    target)) {

                throw new InvalidRequestException(
                        "Procurement package cannot transition from '%s' to '%s'."
                                .formatted(
                                        current,
                                        target));
            }
        }

        packageItem.updateDetails(
                request.title()
                        .trim(),
                normalize(
                        request.description()),
                request.estimatedValue(),
                request.plannedIssueDate(),
                request.bidDueDate(),
                request.awardDueDate(),
                request.forecastAwardDate(),
                request.requiredOnSiteDate());

        if (current != target) {
            packageItem.changeStatus(
                    target,
                    LocalDate.now(
                            clock));
        }

        ProcurementPackage saved =
                packageRepository
                        .saveAndFlush(
                                packageItem);

        return packageResponse(
                saved);
    }

    @Transactional
    public ProcurementBidResponse createBid(
            UUID projectId,
            UUID packageId,
            CreateProcurementBidRequest request) {

        requireProject(
                projectId);

        ProcurementPackage packageItem =
                requirePackage(
                        projectId,
                        packageId);

        if (packageItem.getStatus()
                        != ProcurementPackageStatus.TENDERING
                && packageItem.getStatus()
                        != ProcurementPackageStatus.EVALUATION) {

            throw new InvalidRequestException(
                    "Bids can only be recorded while a package is TENDERING or in EVALUATION.");
        }

        Supplier supplier =
                requireSupplier(
                        request.supplierId());

        if (supplier.getQualificationStatus()
                        == SupplierQualificationStatus.SUSPENDED
                || supplier.getQualificationStatus()
                        == SupplierQualificationStatus.REJECTED) {

            throw new InvalidRequestException(
                    "Suspended or rejected suppliers cannot submit new procurement bids.");
        }

        if (request.submittedDate()
                .isAfter(
                        LocalDate.now(
                                clock))) {

            throw new InvalidRequestException(
                    "Bid submission date cannot be in the future.");
        }

        if (bidRepository
                .existsByProcurementPackageIdAndSupplierId(
                        packageId,
                        supplier.getId())) {

            throw new ConflictException(
                    "This supplier already has a bid for the selected procurement package.");
        }

        ProcurementBid bid =
                ProcurementBid.create(
                        UUID.randomUUID(),
                        packageId,
                        supplier.getId(),
                        request.bidAmount(),
                        request.submittedDate(),
                        request.technicalScore(),
                        request.commercialScore(),
                        request.deliveryDays(),
                        normalize(
                                request.notes()));

        return toBidResponse(
                bidRepository.save(
                        bid),
                packageItem,
                supplier);
    }

    @Transactional
    public ProcurementBidResponse updateBid(
            UUID projectId,
            UUID packageId,
            UUID bidId,
            UpdateProcurementBidRequest request) {

        requireProject(
                projectId);

        ProcurementPackage packageItem =
                requirePackage(
                        projectId,
                        packageId);

        if (packageItem.getStatus()
                        == ProcurementPackageStatus.AWARDED
                || packageItem.getStatus()
                        == ProcurementPackageStatus.CLOSED
                || packageItem.getStatus()
                        == ProcurementPackageStatus.CANCELLED) {

            throw new InvalidRequestException(
                    "Bids cannot be changed after the procurement package is awarded, closed or cancelled.");
        }

        ProcurementBid bid =
                bidRepository
                        .findByIdAndProcurementPackageId(
                                bidId,
                                packageId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Procurement bid '%s' was not found."
                                                        .formatted(
                                                                bidId)));

        verifyVersion(
                bid.getVersion(),
                request.version(),
                "procurement bid");

        if (request.status()
                == ProcurementBidStatus.SELECTED) {

            throw new InvalidRequestException(
                    "A bid can only become SELECTED through the package award operation.");
        }

        bid.update(
                request.bidAmount(),
                request.submittedDate(),
                request.technicalScore(),
                request.commercialScore(),
                request.deliveryDays(),
                request.status(),
                normalize(
                        request.notes()));

        ProcurementBid saved =
                bidRepository
                        .saveAndFlush(
                                bid);

        return toBidResponse(
                saved,
                packageItem,
                requireSupplier(
                        saved.getSupplierId()));
    }

    @Transactional
    public ProcurementPackageResponse award(
            UUID projectId,
            UUID packageId,
            AwardProcurementPackageRequest request) {

        Project project =
                requireProject(
                        projectId);

        ProcurementPackage packageItem =
                requirePackage(
                        projectId,
                        packageId);

        verifyVersion(
                packageItem.getVersion(),
                request.version(),
                "procurement package");

        if (packageItem.getStatus()
                != ProcurementPackageStatus.EVALUATION) {

            throw new InvalidRequestException(
                    "A procurement package must be in EVALUATION before it can be awarded.");
        }

        LocalDate today =
                LocalDate.now(
                        clock);

        if (request.awardDate()
                .isAfter(
                        today)) {

            throw new InvalidRequestException(
                    "Award date cannot be in the future.");
        }

        ProcurementBid selectedBid =
                bidRepository
                        .findByIdAndProcurementPackageId(
                                request.selectedBidId(),
                                packageId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "The selected bid does not belong to this procurement package."));

        if (selectedBid.getStatus()
                == ProcurementBidStatus.REJECTED) {

            throw new InvalidRequestException(
                    "A rejected bid cannot be awarded.");
        }

        Supplier supplier =
                requireSupplier(
                        selectedBid.getSupplierId());

        SupplierQualificationStatus qualification =
                supplier.getQualificationStatus();

        if (qualification
                        != SupplierQualificationStatus.QUALIFIED
                && qualification
                        != SupplierQualificationStatus.CONDITIONAL) {

            throw new InvalidRequestException(
                    "Only QUALIFIED or CONDITIONAL suppliers can receive a procurement award.");
        }

        String commitmentReference =
                buildCommitmentReference(
                        projectId,
                        packageItem.getReference());

        ProjectCommitment commitment =
                ProjectCommitment.create(
                        UUID.randomUUID(),
                        project.getId(),
                        packageItem.getCostCodeId(),
                        commitmentReference,
                        supplier.getName(),
                        "Procurement award: "
                                + packageItem.getTitle(),
                        request.awardedValue(),
                        CommitmentStatus.APPROVED,
                        request.awardDate());

        commitmentRepository.save(
                commitment);

        List<ProcurementBid> packageBids =
                bidRepository
                        .findByProcurementPackageIdOrderBySubmittedDateDescCreatedAtDesc(
                                packageId);

        for (ProcurementBid bid :
                packageBids) {

            if (bid.getId()
                    .equals(
                            selectedBid.getId())) {

                bid.select();

            } else if (bid.getStatus()
                    != ProcurementBidStatus.REJECTED) {

                bid.reject();
            }
        }

        bidRepository.saveAll(
                packageBids);

        packageItem.award(
                supplier.getId(),
                request.awardedValue(),
                request.awardDate(),
                commitment.getId());

        packageRepository
                .saveAndFlush(
                        packageItem);

        return packageResponse(
                packageItem);
    }

    @Transactional
    public SupplierPerformanceEvaluationResponse
    createPerformanceEvaluation(
            UUID projectId,
            CreateSupplierPerformanceEvaluationRequest request) {

        requireProject(
                projectId);

        Supplier supplier =
                requireSupplier(
                        request.supplierId());

        ProcurementPackage packageItem =
                null;

        if (request.procurementPackageId()
                != null) {

            packageItem =
                    requirePackage(
                            projectId,
                            request.procurementPackageId());

            if (packageItem.getAwardedSupplierId()
                    == null
                    || !packageItem
                            .getAwardedSupplierId()
                            .equals(
                                    supplier.getId())) {

                throw new InvalidRequestException(
                        "The selected supplier was not awarded the selected procurement package.");
            }
        }

        if (request.evaluationDate()
                .isAfter(
                        LocalDate.now(
                                clock))) {

            throw new InvalidRequestException(
                    "Supplier evaluation date cannot be in the future.");
        }

        SupplierPerformanceEvaluation evaluation =
                SupplierPerformanceEvaluation.create(
                        UUID.randomUUID(),
                        projectId,
                        supplier.getId(),
                        packageItem == null
                                ? null
                                : packageItem.getId(),
                        request.evaluationDate(),
                        request.qualityScore(),
                        request.deliveryScore(),
                        request.safetyScore(),
                        request.commercialScore(),
                        normalize(
                                request.comments()));

        SupplierPerformanceEvaluation saved =
                evaluationRepository.save(
                        evaluation);

        return toEvaluationResponse(
                saved,
                supplier,
                packageItem);
    }

    private ProcurementPackageResponse packageResponse(
            ProcurementPackage packageItem) {

        ProjectCostCode costCode =
                requireCostCode(
                        packageItem.getProjectId(),
                        packageItem.getCostCodeId());

        Supplier awardedSupplier =
                packageItem.getAwardedSupplierId()
                                == null
                        ? null
                        : requireSupplier(
                                packageItem.getAwardedSupplierId());

        ProjectCommitment commitment =
                packageItem.getCommitmentId()
                                == null
                        ? null
                        : commitmentRepository
                                .findById(
                                        packageItem.getCommitmentId())
                                .orElse(null);

        long bidCount =
                bidRepository
                        .findByProcurementPackageIdOrderBySubmittedDateDescCreatedAtDesc(
                                packageItem.getId())
                        .size();

        return toPackageResponse(
                packageItem,
                costCode,
                awardedSupplier,
                commitment,
                bidCount);
    }

    private Project requireProject(
            UUID projectId) {

        return projectRepository
                .findById(
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Project '%s' was not found."
                                                .formatted(
                                                        projectId)));
    }

    private ProjectCostCode requireCostCode(
            UUID projectId,
            UUID costCodeId) {

        return costCodeRepository
                .findByIdAndProjectId(
                        costCodeId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Cost code '%s' does not belong to this project."
                                                .formatted(
                                                        costCodeId)));
    }

    private Supplier requireSupplier(
            UUID supplierId) {

        return supplierRepository
                .findById(
                        supplierId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Supplier '%s' was not found."
                                                .formatted(
                                                        supplierId)));
    }

    private ProcurementPackage requirePackage(
            UUID projectId,
            UUID packageId) {

        return packageRepository
                .findByIdAndProjectId(
                        packageId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Procurement package '%s' was not found for this project."
                                                .formatted(
                                                        packageId)));
    }

    private ProjectCostCode requireCostCode(
            Map<UUID, ProjectCostCode> map,
            UUID id) {

        ProjectCostCode result =
                map.get(id);

        if (result == null) {
            throw new IllegalStateException(
                    "Unknown project cost code: "
                            + id);
        }

        return result;
    }

    private Supplier requireSupplier(
            Map<UUID, Supplier> map,
            UUID id) {

        Supplier result =
                map.get(id);

        if (result == null) {
            throw new IllegalStateException(
                    "Unknown supplier: "
                            + id);
        }

        return result;
    }

    private ProcurementPackage requirePackage(
            Map<UUID, ProcurementPackage> map,
            UUID id) {

        ProcurementPackage result =
                map.get(id);

        if (result == null) {
            throw new IllegalStateException(
                    "Unknown procurement package: "
                            + id);
        }

        return result;
    }

    private void validateDates(
            LocalDate plannedIssueDate,
            LocalDate bidDueDate,
            LocalDate awardDueDate,
            LocalDate requiredOnSiteDate) {

        if (bidDueDate.isBefore(
                plannedIssueDate)) {

            throw new InvalidRequestException(
                    "Bid due date cannot be before planned issue date.");
        }

        if (awardDueDate.isBefore(
                bidDueDate)) {

            throw new InvalidRequestException(
                    "Award due date cannot be before bid due date.");
        }

        if (requiredOnSiteDate.isBefore(
                awardDueDate)) {

            throw new InvalidRequestException(
                    "Required-on-site date cannot be before award due date.");
        }
    }

    private void verifyVersion(
            long current,
            long requested,
            String resource) {

        if (current != requested) {
            throw new ConflictException(
                    "The %s was changed by another operation. Refresh before submitting your change."
                            .formatted(
                                    resource));
        }
    }

    private String buildCommitmentReference(
            UUID projectId,
            String packageReference) {

        String base =
                "PROC-"
                        + packageReference
                                .trim()
                                .toUpperCase(
                                        Locale.ROOT);

        if (base.length() > 64) {
            base =
                    base.substring(
                            0,
                            64);
        }

        if (!commitmentRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        base)) {

            return base;
        }

        String suffix =
                "-"
                        + UUID.randomUUID()
                                .toString()
                                .substring(
                                        0,
                                        6)
                                .toUpperCase(
                                        Locale.ROOT);

        int maximumBaseLength =
                64
                        - suffix.length();

        if (base.length()
                > maximumBaseLength) {

            base =
                    base.substring(
                            0,
                            maximumBaseLength);
        }

        return base
                + suffix;
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

    private CostCodeResponse toCostCodeResponse(
            ProjectCostCode costCode) {

        return new CostCodeResponse(
                costCode.getId(),
                costCode.getProjectId(),
                costCode.getCode(),
                costCode.getName(),
                costCode.getCategory(),
                costCode.getDescription(),
                costCode.getSortOrder(),
                costCode.getCreatedAt());
    }

    private SupplierResponse toSupplierResponse(
            Supplier supplier) {

        return new SupplierResponse(
                supplier.getId(),
                supplier.getCode(),
                supplier.getName(),
                supplier.getSupplierType(),
                supplier.getTrade(),
                supplier.getCountry(),
                supplier.getContactPerson(),
                supplier.getEmail(),
                supplier.getQualificationStatus(),
                supplier.getVersion(),
                supplier.getCreatedAt(),
                supplier.getUpdatedAt());
    }

    private ProcurementPackageResponse toPackageResponse(
            ProcurementPackage packageItem,
            ProjectCostCode costCode,
            Supplier awardedSupplier,
            ProjectCommitment commitment,
            long bidCount) {

        return new ProcurementPackageResponse(
                packageItem.getId(),
                packageItem.getProjectId(),
                packageItem.getCostCodeId(),
                costCode.getCode(),
                costCode.getName(),
                packageItem.getReference(),
                packageItem.getTitle(),
                packageItem.getDescription(),
                packageItem.getEstimatedValue(),
                packageItem.getPlannedIssueDate(),
                packageItem.getActualIssueDate(),
                packageItem.getBidDueDate(),
                packageItem.getAwardDueDate(),
                packageItem.getForecastAwardDate(),
                packageItem.getRequiredOnSiteDate(),
                packageItem.getStatus(),
                packageItem.getAwardedSupplierId(),
                awardedSupplier == null
                        ? null
                        : awardedSupplier.getName(),
                packageItem.getAwardedValue(),
                packageItem.getAwardDate(),
                packageItem.getCommitmentId(),
                commitment == null
                        ? null
                        : commitment.getReference(),
                bidCount,
                packageItem.getVersion(),
                packageItem.getCreatedAt(),
                packageItem.getUpdatedAt());
    }

    private ProcurementBidResponse toBidResponse(
            ProcurementBid bid,
            ProcurementPackage packageItem,
            Supplier supplier) {

        double combined =
                bid.getTechnicalScore()
                                .doubleValue()
                                * 0.60
                        + bid.getCommercialScore()
                                .doubleValue()
                                * 0.40;

        return new ProcurementBidResponse(
                bid.getId(),
                bid.getProcurementPackageId(),
                packageItem.getReference(),
                supplier.getId(),
                supplier.getCode(),
                supplier.getName(),
                supplier.getQualificationStatus(),
                bid.getBidAmount(),
                bid.getSubmittedDate(),
                bid.getTechnicalScore(),
                bid.getCommercialScore(),
                Math.round(
                                combined
                                        * 10.0)
                        / 10.0,
                bid.getDeliveryDays(),
                bid.getStatus(),
                bid.getNotes(),
                bid.getVersion(),
                bid.getCreatedAt(),
                bid.getUpdatedAt());
    }

    private SupplierPerformanceEvaluationResponse
    toEvaluationResponse(
            SupplierPerformanceEvaluation evaluation,
            Supplier supplier,
            ProcurementPackage packageItem) {

        return new SupplierPerformanceEvaluationResponse(
                evaluation.getId(),
                evaluation.getProjectId(),
                supplier.getId(),
                supplier.getName(),
                evaluation.getProcurementPackageId(),
                packageItem == null
                        ? null
                        : packageItem.getReference(),
                evaluation.getEvaluationDate(),
                evaluation.getQualityScore(),
                evaluation.getDeliveryScore(),
                evaluation.getSafetyScore(),
                evaluation.getCommercialScore(),
                Math.round(
                                evaluation.overallScore()
                                        * 10.0)
                        / 10.0,
                evaluation.getComments(),
                evaluation.getCreatedAt());
    }

    private static Map<
            ProcurementPackageStatus,
            Set<ProcurementPackageStatus>>
    packageTransitions() {

        Map<
                ProcurementPackageStatus,
                Set<ProcurementPackageStatus>>
                map =
                new EnumMap<>(
                        ProcurementPackageStatus.class);

        map.put(
                ProcurementPackageStatus.PLANNING,
                Set.of(
                        ProcurementPackageStatus.TENDERING,
                        ProcurementPackageStatus.CANCELLED));

        map.put(
                ProcurementPackageStatus.TENDERING,
                Set.of(
                        ProcurementPackageStatus.EVALUATION,
                        ProcurementPackageStatus.CANCELLED));

        map.put(
                ProcurementPackageStatus.EVALUATION,
                Set.of(
                        ProcurementPackageStatus.TENDERING,
                        ProcurementPackageStatus.CANCELLED));

        map.put(
                ProcurementPackageStatus.AWARDED,
                Set.of(
                        ProcurementPackageStatus.CLOSED));

        map.put(
                ProcurementPackageStatus.CLOSED,
                Set.of());

        map.put(
                ProcurementPackageStatus.CANCELLED,
                Set.of());

        return Map.copyOf(
                map);
    }
}
