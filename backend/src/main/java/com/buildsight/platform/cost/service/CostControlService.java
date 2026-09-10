package com.buildsight.platform.cost.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
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
import com.buildsight.platform.cost.api.ActualCostResponse;
import com.buildsight.platform.cost.api.BudgetLineResponse;
import com.buildsight.platform.cost.api.CommitmentResponse;
import com.buildsight.platform.cost.api.CostCodeResponse;
import com.buildsight.platform.cost.api.CostControlResponse;
import com.buildsight.platform.cost.api.CreateActualCostRequest;
import com.buildsight.platform.cost.api.CreateBudgetLineRequest;
import com.buildsight.platform.cost.api.CreateCommitmentRequest;
import com.buildsight.platform.cost.api.CreateCostCodeRequest;
import com.buildsight.platform.cost.api.UpdateBudgetLineRequest;
import com.buildsight.platform.cost.api.UpdateCommitmentRequest;
import com.buildsight.platform.cost.domain.CommitmentStatus;
import com.buildsight.platform.cost.domain.ProjectActualCost;
import com.buildsight.platform.cost.domain.ProjectBudgetLine;
import com.buildsight.platform.cost.domain.ProjectCommitment;
import com.buildsight.platform.cost.domain.ProjectCostCode;
import com.buildsight.platform.cost.repository.ProjectActualCostRepository;
import com.buildsight.platform.cost.repository.ProjectBudgetLineRepository;
import com.buildsight.platform.cost.repository.ProjectCommitmentRepository;
import com.buildsight.platform.cost.repository.ProjectCostCodeRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CostControlService {

    private static final Map<
            CommitmentStatus,
            Set<CommitmentStatus>>
            COMMITMENT_TRANSITIONS =
            commitmentTransitions();

    private final ProjectRepository
            projectRepository;

    private final ProjectCostCodeRepository
            costCodeRepository;

    private final ProjectBudgetLineRepository
            budgetLineRepository;

    private final ProjectCommitmentRepository
            commitmentRepository;

    private final ProjectActualCostRepository
            actualCostRepository;

    private final CostIntelligenceService
            intelligenceService;

    private final ProjectMapper projectMapper;

    private final Clock clock;

    public CostControlService(
            ProjectRepository projectRepository,
            ProjectCostCodeRepository costCodeRepository,
            ProjectBudgetLineRepository budgetLineRepository,
            ProjectCommitmentRepository commitmentRepository,
            ProjectActualCostRepository actualCostRepository,
            CostIntelligenceService intelligenceService,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.costCodeRepository =
                costCodeRepository;

        this.budgetLineRepository =
                budgetLineRepository;

        this.commitmentRepository =
                commitmentRepository;

        this.actualCostRepository =
                actualCostRepository;

        this.intelligenceService =
                intelligenceService;

        this.projectMapper =
                projectMapper;

        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public CostControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        List<ProjectCostCode> costCodes =
                costCodeRepository
                        .findByProjectIdOrderBySortOrderAscCodeAsc(
                                projectId);

        List<ProjectBudgetLine> budgetLines =
                budgetLineRepository
                        .findByProjectIdOrderByCreatedAtAsc(
                                projectId);

        List<ProjectCommitment> commitments =
                commitmentRepository
                        .findByProjectIdOrderByCommitmentDateDescCreatedAtDesc(
                                projectId);

        List<ProjectActualCost> actualCosts =
                actualCostRepository
                        .findByProjectIdOrderByCostDateDescCreatedAtDesc(
                                projectId);

        Map<UUID, ProjectCostCode> costCodeMap =
                costCodes.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectCostCode::getId,
                                        Function.identity()));

        Map<UUID, ProjectCommitment>
                commitmentMap =
                commitments.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectCommitment::getId,
                                        Function.identity()));

        return new CostControlResponse(
                projectMapper.toResponse(
                        project),

                intelligenceService.calculate(
                        project,
                        budgetLines,
                        commitments,
                        actualCosts),

                costCodes.stream()
                        .map(
                                this::toCostCodeResponse)
                        .toList(),

                budgetLines.stream()
                        .map(
                                line ->
                                        toBudgetLineResponse(
                                                line,
                                                requireCostCode(
                                                        costCodeMap,
                                                        line.getCostCodeId())))
                        .toList(),

                commitments.stream()
                        .map(
                                commitment ->
                                        toCommitmentResponse(
                                                commitment,
                                                requireCostCode(
                                                        costCodeMap,
                                                        commitment.getCostCodeId())))
                        .toList(),

                actualCosts.stream()
                        .map(
                                actual ->
                                        toActualCostResponse(
                                                actual,
                                                requireCostCode(
                                                        costCodeMap,
                                                        actual.getCostCodeId()),
                                                actual.getCommitmentId()
                                                                == null
                                                        ? null
                                                        : commitmentMap.get(
                                                                actual.getCommitmentId())))
                        .toList());
    }

    @Transactional
    public CostCodeResponse createCostCode(
            UUID projectId,
            CreateCostCodeRequest request) {

        requireProject(
                projectId);

        String code =
                request.code()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (costCodeRepository
                .existsByProjectIdAndCodeIgnoreCase(
                        projectId,
                        code)) {

            throw new ConflictException(
                    "Cost code '%s' already exists for this project."
                            .formatted(
                                    code));
        }

        ProjectCostCode created =
                ProjectCostCode.create(
                        UUID.randomUUID(),
                        projectId,
                        code,
                        request.name().trim(),
                        request.category(),
                        normalize(
                                request.description()),
                        request.sortOrder());

        return toCostCodeResponse(
                costCodeRepository.save(
                        created));
    }

    @Transactional
    public BudgetLineResponse createBudgetLine(
            UUID projectId,
            CreateBudgetLineRequest request) {

        requireProject(
                projectId);

        ProjectCostCode costCode =
                requireCostCode(
                        projectId,
                        request.costCodeId());

        BigDecimal revisedBudget =
                request.originalBudget()
                        .add(
                                request.approvedChanges());

        validateRevisedBudget(
                revisedBudget);

        BigDecimal forecast =
                request.forecastCost()
                                == null
                        ? revisedBudget
                        : request.forecastCost();

        ProjectBudgetLine line =
                ProjectBudgetLine.create(
                        UUID.randomUUID(),
                        projectId,
                        costCode.getId(),
                        normalize(
                                request.description()),
                        request.originalBudget(),
                        request.approvedChanges(),
                        forecast);

        return toBudgetLineResponse(
                budgetLineRepository.save(
                        line),
                costCode);
    }

    @Transactional
    public BudgetLineResponse updateBudgetLine(
            UUID projectId,
            UUID budgetLineId,
            UpdateBudgetLineRequest request) {

        requireProject(
                projectId);

        ProjectBudgetLine line =
                budgetLineRepository
                        .findByIdAndProjectId(
                                budgetLineId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Budget line '%s' was not found for this project."
                                                        .formatted(
                                                                budgetLineId)));

        verifyVersion(
                line.getVersion(),
                request.version(),
                "budget line");

        BigDecimal revisedBudget =
                request.originalBudget()
                        .add(
                                request.approvedChanges());

        validateRevisedBudget(
                revisedBudget);

        line.update(
                normalize(
                        request.description()),
                request.originalBudget(),
                request.approvedChanges(),
                request.forecastCost());

        ProjectBudgetLine saved =
                budgetLineRepository
                        .saveAndFlush(
                                line);

        return toBudgetLineResponse(
                saved,
                requireCostCode(
                        projectId,
                        saved.getCostCodeId()));
    }

    @Transactional
    public CommitmentResponse createCommitment(
            UUID projectId,
            CreateCommitmentRequest request) {

        requireProject(
                projectId);

        ProjectCostCode costCode =
                requireCostCode(
                        projectId,
                        request.costCodeId());

        if (request.status()
                        == CommitmentStatus.CLOSED
                || request.status()
                        == CommitmentStatus.CANCELLED) {

            throw new InvalidRequestException(
                    "A new commitment must start as DRAFT or APPROVED.");
        }

        String reference =
                request.reference()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (commitmentRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Commitment reference '%s' already exists for this project."
                            .formatted(
                                    reference));
        }

        ProjectCommitment commitment =
                ProjectCommitment.create(
                        UUID.randomUUID(),
                        projectId,
                        costCode.getId(),
                        reference,
                        request.vendorName()
                                .trim(),
                        normalize(
                                request.description()),
                        request.committedAmount(),
                        request.status(),
                        request.commitmentDate());

        return toCommitmentResponse(
                commitmentRepository.save(
                        commitment),
                costCode);
    }

    @Transactional
    public CommitmentResponse updateCommitment(
            UUID projectId,
            UUID commitmentId,
            UpdateCommitmentRequest request) {

        requireProject(
                projectId);

        ProjectCommitment commitment =
                commitmentRepository
                        .findByIdAndProjectId(
                                commitmentId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Commitment '%s' was not found for this project."
                                                        .formatted(
                                                                commitmentId)));

        verifyVersion(
                commitment.getVersion(),
                request.version(),
                "commitment");

        CommitmentStatus current =
                commitment.getStatus();

        CommitmentStatus target =
                request.status();

        if (current != target) {
            Set<CommitmentStatus> allowed =
                    COMMITMENT_TRANSITIONS
                            .getOrDefault(
                                    current,
                                    Set.of());

            if (!allowed.contains(
                    target)) {

                throw new InvalidRequestException(
                        "Commitment status cannot transition from '%s' to '%s'."
                                .formatted(
                                        current,
                                        target));
            }
        }

        if (target
                        == CommitmentStatus.CANCELLED
                && actualCostRepository
                        .existsByCommitmentId(
                                commitmentId)) {

            throw new InvalidRequestException(
                    "A commitment with recorded actual costs cannot be cancelled.");
        }

        commitment.update(
                request.vendorName()
                        .trim(),
                normalize(
                        request.description()),
                request.committedAmount(),
                target,
                request.commitmentDate());

        ProjectCommitment saved =
                commitmentRepository
                        .saveAndFlush(
                                commitment);

        return toCommitmentResponse(
                saved,
                requireCostCode(
                        projectId,
                        saved.getCostCodeId()));
    }

    @Transactional
    public ActualCostResponse createActualCost(
            UUID projectId,
            CreateActualCostRequest request) {

        requireProject(
                projectId);

        ProjectCostCode costCode =
                requireCostCode(
                        projectId,
                        request.costCodeId());

        LocalDate today =
                LocalDate.now(
                        clock);

        if (request.costDate()
                .isAfter(today)) {

            throw new InvalidRequestException(
                    "Actual cost date cannot be in the future.");
        }

        String reference =
                request.reference()
                        .trim()
                        .toUpperCase(
                                Locale.ROOT);

        if (actualCostRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Actual-cost reference '%s' already exists for this project."
                            .formatted(
                                    reference));
        }

        ProjectCommitment commitment =
                null;

        if (request.commitmentId()
                != null) {

            commitment =
                    commitmentRepository
                            .findByIdAndProjectId(
                                    request.commitmentId(),
                                    projectId)
                            .orElseThrow(
                                    () ->
                                            new ResourceNotFoundException(
                                                    "The selected commitment does not belong to this project."));

            if (!commitment.getCostCodeId()
                    .equals(
                            request.costCodeId())) {

                throw new InvalidRequestException(
                        "Actual cost and linked commitment must use the same cost code.");
            }

            if (commitment.getStatus()
                    != CommitmentStatus.APPROVED) {

                throw new InvalidRequestException(
                        "Actual costs may only be linked to an APPROVED commitment.");
            }
        }

        ProjectActualCost actual =
                ProjectActualCost.create(
                        UUID.randomUUID(),
                        projectId,
                        costCode.getId(),
                        commitment == null
                                ? null
                                : commitment.getId(),
                        reference,
                        request.supplierName()
                                .trim(),
                        normalize(
                                request.description()),
                        request.amount(),
                        request.costDate());

        ProjectActualCost saved =
                actualCostRepository.save(
                        actual);

        return toActualCostResponse(
                saved,
                costCode,
                commitment);
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
                                        "Cost code '%s' was not found for this project."
                                                .formatted(
                                                        costCodeId)));
    }

    private ProjectCostCode requireCostCode(
            Map<UUID, ProjectCostCode> map,
            UUID id) {

        ProjectCostCode costCode =
                map.get(id);

        if (costCode == null) {
            throw new IllegalStateException(
                    "Cost-control data references an unknown cost code: "
                            + id);
        }

        return costCode;
    }

    private void validateRevisedBudget(
            BigDecimal revisedBudget) {

        if (revisedBudget.signum()
                < 0) {

            throw new InvalidRequestException(
                    "Original budget plus approved changes cannot be negative.");
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

    private BudgetLineResponse toBudgetLineResponse(
            ProjectBudgetLine line,
            ProjectCostCode costCode) {

        BigDecimal revised =
                line.revisedBudget();

        return new BudgetLineResponse(
                line.getId(),
                line.getProjectId(),
                line.getCostCodeId(),
                costCode.getCode(),
                costCode.getName(),
                line.getDescription(),
                line.getOriginalBudget(),
                line.getApprovedChanges(),
                revised,
                line.getForecastCost(),
                revised.subtract(
                        line.getForecastCost()),
                line.getVersion(),
                line.getCreatedAt(),
                line.getUpdatedAt());
    }

    private CommitmentResponse toCommitmentResponse(
            ProjectCommitment commitment,
            ProjectCostCode costCode) {

        return new CommitmentResponse(
                commitment.getId(),
                commitment.getProjectId(),
                commitment.getCostCodeId(),
                costCode.getCode(),
                costCode.getName(),
                commitment.getReference(),
                commitment.getVendorName(),
                commitment.getDescription(),
                commitment.getCommittedAmount(),
                commitment.getStatus(),
                commitment.getCommitmentDate(),
                commitment.getVersion(),
                commitment.getCreatedAt(),
                commitment.getUpdatedAt());
    }

    private ActualCostResponse toActualCostResponse(
            ProjectActualCost actual,
            ProjectCostCode costCode,
            ProjectCommitment commitment) {

        return new ActualCostResponse(
                actual.getId(),
                actual.getProjectId(),
                actual.getCostCodeId(),
                costCode.getCode(),
                costCode.getName(),
                actual.getCommitmentId(),
                commitment == null
                        ? null
                        : commitment.getReference(),
                actual.getReference(),
                actual.getSupplierName(),
                actual.getDescription(),
                actual.getAmount(),
                actual.getCostDate(),
                actual.getCreatedAt());
    }

    private static Map<
            CommitmentStatus,
            Set<CommitmentStatus>>
    commitmentTransitions() {

        Map<
                CommitmentStatus,
                Set<CommitmentStatus>>
                map =
                new EnumMap<>(
                        CommitmentStatus.class);

        map.put(
                CommitmentStatus.DRAFT,
                Set.of(
                        CommitmentStatus.APPROVED,
                        CommitmentStatus.CANCELLED));

        map.put(
                CommitmentStatus.APPROVED,
                Set.of(
                        CommitmentStatus.CLOSED,
                        CommitmentStatus.CANCELLED));

        map.put(
                CommitmentStatus.CLOSED,
                Set.of());

        map.put(
                CommitmentStatus.CANCELLED,
                Set.of());

        return Map.copyOf(
                map);
    }
}
