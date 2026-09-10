package com.buildsight.platform.risk.service;

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
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;
import com.buildsight.platform.risk.api.ChangeEventResponse;
import com.buildsight.platform.risk.api.CreateChangeEventRequest;
import com.buildsight.platform.risk.api.CreateDelayEventRequest;
import com.buildsight.platform.risk.api.CreateIssueRequest;
import com.buildsight.platform.risk.api.CreateRiskRequest;
import com.buildsight.platform.risk.api.DelayEventResponse;
import com.buildsight.platform.risk.api.IssueResponse;
import com.buildsight.platform.risk.api.RiskControlResponse;
import com.buildsight.platform.risk.api.RiskExposureBand;
import com.buildsight.platform.risk.api.RiskIntelligenceResponse;
import com.buildsight.platform.risk.api.RiskResponse;
import com.buildsight.platform.risk.api.UpdateChangeEventRequest;
import com.buildsight.platform.risk.api.UpdateDelayEventRequest;
import com.buildsight.platform.risk.api.UpdateIssueRequest;
import com.buildsight.platform.risk.api.UpdateRiskRequest;
import com.buildsight.platform.risk.domain.ChangeEventStatus;
import com.buildsight.platform.risk.domain.DelayStatus;
import com.buildsight.platform.risk.domain.IssueStatus;
import com.buildsight.platform.risk.domain.ProjectChangeEvent;
import com.buildsight.platform.risk.domain.ProjectDelayEvent;
import com.buildsight.platform.risk.domain.ProjectIssue;
import com.buildsight.platform.risk.domain.ProjectRisk;
import com.buildsight.platform.risk.domain.RiskStatus;
import com.buildsight.platform.risk.repository.ProjectChangeEventRepository;
import com.buildsight.platform.risk.repository.ProjectDelayEventRepository;
import com.buildsight.platform.risk.repository.ProjectIssueRepository;
import com.buildsight.platform.risk.repository.ProjectRiskRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RiskControlService {

    private static final Map<
            RiskStatus,
            Set<RiskStatus>>
            RISK_TRANSITIONS =
            riskTransitions();

    private static final Map<
            IssueStatus,
            Set<IssueStatus>>
            ISSUE_TRANSITIONS =
            issueTransitions();

    private static final Map<
            ChangeEventStatus,
            Set<ChangeEventStatus>>
            CHANGE_TRANSITIONS =
            changeTransitions();

    private static final Map<
            DelayStatus,
            Set<DelayStatus>>
            DELAY_TRANSITIONS =
            delayTransitions();

    private final ProjectRepository
            projectRepository;

    private final ProjectRiskRepository
            riskRepository;

    private final ProjectIssueRepository
            issueRepository;

    private final ProjectChangeEventRepository
            changeRepository;

    private final ProjectDelayEventRepository
            delayRepository;

    private final RiskIntelligenceService
            intelligenceService;

    private final ProjectMapper
            projectMapper;

    private final Clock
            clock;

    public RiskControlService(
            ProjectRepository projectRepository,
            ProjectRiskRepository riskRepository,
            ProjectIssueRepository issueRepository,
            ProjectChangeEventRepository changeRepository,
            ProjectDelayEventRepository delayRepository,
            RiskIntelligenceService intelligenceService,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.riskRepository =
                riskRepository;

        this.issueRepository =
                issueRepository;

        this.changeRepository =
                changeRepository;

        this.delayRepository =
                delayRepository;

        this.intelligenceService =
                intelligenceService;

        this.projectMapper =
                projectMapper;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public RiskControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        List<ProjectRisk> risks =
                riskRepository
                        .findByProjectIdOrderByCreatedAtDesc(
                                projectId);

        List<ProjectIssue> issues =
                issueRepository
                        .findByProjectIdOrderByCreatedAtDesc(
                                projectId);

        List<ProjectChangeEvent> changes =
                changeRepository
                        .findByProjectIdOrderByRequestedDateDescCreatedAtDesc(
                                projectId);

        List<ProjectDelayEvent> delays =
                delayRepository
                        .findByProjectIdOrderByStartDateDescCreatedAtDesc(
                                projectId);

        Map<UUID, ProjectRisk> riskMap =
                risks.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectRisk::getId,
                                        Function.identity()));

        return new RiskControlResponse(
                projectMapper.toResponse(
                        project),

                intelligenceService.calculate(
                        risks,
                        issues,
                        changes,
                        delays),

                risks.stream()
                        .map(
                                this::toRiskResponse)
                        .toList(),

                issues.stream()
                        .map(
                                issue ->
                                        toIssueResponse(
                                                issue,
                                                issue.getSourceRiskId()
                                                                == null
                                                        ? null
                                                        : riskMap.get(
                                                                issue.getSourceRiskId())))
                        .toList(),

                changes.stream()
                        .map(
                                this::toChangeResponse)
                        .toList(),

                delays.stream()
                        .map(
                                this::toDelayResponse)
                        .toList());
    }

    @Transactional(readOnly = true)
    public RiskIntelligenceResponse intelligence(
            UUID projectId) {

        requireProject(
                projectId);

        return intelligenceService.calculate(
                riskRepository
                        .findByProjectIdOrderByCreatedAtDesc(
                                projectId),

                issueRepository
                        .findByProjectIdOrderByCreatedAtDesc(
                                projectId),

                changeRepository
                        .findByProjectIdOrderByRequestedDateDescCreatedAtDesc(
                                projectId),

                delayRepository
                        .findByProjectIdOrderByStartDateDescCreatedAtDesc(
                                projectId));
    }

    @Transactional
    public RiskResponse createRisk(
            UUID projectId,
            CreateRiskRequest request) {

        requireProject(
                projectId);

        String reference =
                normalizeReference(
                        request.reference());

        if (riskRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Risk reference '%s' already exists."
                            .formatted(
                                    reference));
        }

        ProjectRisk risk =
                ProjectRisk.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.title()
                                .trim(),
                        normalize(
                                request.description()),
                        request.category(),
                        normalize(
                                request.ownerName()),
                        request.probability(),
                        request.impact(),
                        request.residualProbability(),
                        request.residualImpact(),
                        normalize(
                                request.mitigationPlan()),
                        request.mitigationDueDate());

        return toRiskResponse(
                riskRepository.save(
                        risk));
    }

    @Transactional
    public RiskResponse updateRisk(
            UUID projectId,
            UUID riskId,
            UpdateRiskRequest request) {

        requireProject(
                projectId);

        ProjectRisk risk =
                requireRisk(
                        projectId,
                        riskId);

        verifyVersion(
                risk.getVersion(),
                request.version(),
                "risk");

        validateTransition(
                RISK_TRANSITIONS,
                risk.getStatus(),
                request.status(),
                "risk");

        risk.update(
                request.title()
                        .trim(),
                normalize(
                        request.description()),
                request.category(),
                normalize(
                        request.ownerName()),
                request.probability(),
                request.impact(),
                request.residualProbability(),
                request.residualImpact(),
                normalize(
                        request.mitigationPlan()),
                request.mitigationDueDate(),
                request.status());

        return toRiskResponse(
                riskRepository
                        .saveAndFlush(
                                risk));
    }

    @Transactional
    public IssueResponse createIssue(
            UUID projectId,
            CreateIssueRequest request) {

        requireProject(
                projectId);

        ProjectRisk sourceRisk =
                request.sourceRiskId()
                                == null
                        ? null
                        : requireRisk(
                                projectId,
                                request.sourceRiskId());

        String reference =
                normalizeReference(
                        request.reference());

        if (issueRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Issue reference '%s' already exists."
                            .formatted(
                                    reference));
        }

        ProjectIssue issue =
                ProjectIssue.create(
                        UUID.randomUUID(),
                        projectId,
                        sourceRisk == null
                                ? null
                                : sourceRisk.getId(),
                        reference,
                        request.title()
                                .trim(),
                        normalize(
                                request.description()),
                        request.severity(),
                        normalize(
                                request.ownerName()),
                        request.targetResolutionDate());

        return toIssueResponse(
                issueRepository.save(
                        issue),
                sourceRisk);
    }

    @Transactional
    public IssueResponse updateIssue(
            UUID projectId,
            UUID issueId,
            UpdateIssueRequest request) {

        requireProject(
                projectId);

        ProjectIssue issue =
                issueRepository
                        .findByIdAndProjectId(
                                issueId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Issue '%s' was not found."
                                                        .formatted(
                                                                issueId)));

        verifyVersion(
                issue.getVersion(),
                request.version(),
                "issue");

        validateTransition(
                ISSUE_TRANSITIONS,
                issue.getStatus(),
                request.status(),
                "issue");

        ProjectRisk sourceRisk =
                request.sourceRiskId()
                                == null
                        ? null
                        : requireRisk(
                                projectId,
                                request.sourceRiskId());

        issue.update(
                sourceRisk == null
                        ? null
                        : sourceRisk.getId(),
                request.title()
                        .trim(),
                normalize(
                        request.description()),
                request.severity(),
                normalize(
                        request.ownerName()),
                request.targetResolutionDate(),
                request.status());

        return toIssueResponse(
                issueRepository
                        .saveAndFlush(
                                issue),
                sourceRisk);
    }

    @Transactional
    public ChangeEventResponse createChange(
            UUID projectId,
            CreateChangeEventRequest request) {

        requireProject(
                projectId);

        validateNotFuture(
                request.requestedDate(),
                "Change request date");

        String reference =
                normalizeReference(
                        request.reference());

        if (changeRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Change reference '%s' already exists."
                            .formatted(
                                    reference));
        }

        ProjectChangeEvent change =
                ProjectChangeEvent.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.title()
                                .trim(),
                        normalize(
                                request.description()),
                        normalize(
                                request.originator()),
                        request.requestedDate(),
                        request.costImpact(),
                        request.scheduleImpactDays());

        return toChangeResponse(
                changeRepository.save(
                        change));
    }

    @Transactional
    public ChangeEventResponse updateChange(
            UUID projectId,
            UUID changeId,
            UpdateChangeEventRequest request) {

        requireProject(
                projectId);

        ProjectChangeEvent change =
                changeRepository
                        .findByIdAndProjectId(
                                changeId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Change event '%s' was not found."
                                                        .formatted(
                                                                changeId)));

        verifyVersion(
                change.getVersion(),
                request.version(),
                "change event");

        validateTransition(
                CHANGE_TRANSITIONS,
                change.getStatus(),
                request.status(),
                "change event");

        validateNotFuture(
                request.requestedDate(),
                "Change request date");

        if (request.decisionDate()
                != null) {

            validateNotFuture(
                    request.decisionDate(),
                    "Change decision date");

            if (request.decisionDate()
                    .isBefore(
                            request.requestedDate())) {

                throw new InvalidRequestException(
                        "Change decision date cannot be before the request date.");
            }
        }

        change.update(
                request.title()
                        .trim(),
                normalize(
                        request.description()),
                normalize(
                        request.originator()),
                request.requestedDate(),
                request.decisionDate(),
                request.costImpact(),
                request.scheduleImpactDays(),
                request.status(),
                LocalDate.now(
                        clock));

        return toChangeResponse(
                changeRepository
                        .saveAndFlush(
                                change));
    }

    @Transactional
    public DelayEventResponse createDelay(
            UUID projectId,
            CreateDelayEventRequest request) {

        requireProject(
                projectId);

        validateNotFuture(
                request.startDate(),
                "Delay start date");

        String reference =
                normalizeReference(
                        request.reference());

        if (delayRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Delay reference '%s' already exists."
                            .formatted(
                                    reference));
        }

        ProjectDelayEvent delay =
                ProjectDelayEvent.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.title()
                                .trim(),
                        normalize(
                                request.description()),
                        request.cause(),
                        normalize(
                                request.ownerName()),
                        request.startDate(),
                        request.forecastDelayDays(),
                        request.excusable(),
                        request.compensable());

        return toDelayResponse(
                delayRepository.save(
                        delay));
    }

    @Transactional
    public DelayEventResponse updateDelay(
            UUID projectId,
            UUID delayId,
            UpdateDelayEventRequest request) {

        requireProject(
                projectId);

        ProjectDelayEvent delay =
                delayRepository
                        .findByIdAndProjectId(
                                delayId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Delay event '%s' was not found."
                                                        .formatted(
                                                                delayId)));

        verifyVersion(
                delay.getVersion(),
                request.version(),
                "delay event");

        validateTransition(
                DELAY_TRANSITIONS,
                delay.getStatus(),
                request.status(),
                "delay event");

        validateNotFuture(
                request.startDate(),
                "Delay start date");

        if (request.endDate()
                != null
                && request.endDate()
                        .isBefore(
                                request.startDate())) {

            throw new InvalidRequestException(
                    "Delay end date cannot be before the delay start date.");
        }

        delay.update(
                request.title()
                        .trim(),
                normalize(
                        request.description()),
                request.cause(),
                normalize(
                        request.ownerName()),
                request.startDate(),
                request.endDate(),
                request.forecastDelayDays(),
                request.excusable(),
                request.compensable(),
                request.status(),
                LocalDate.now(
                        clock));

        return toDelayResponse(
                delayRepository
                        .saveAndFlush(
                                delay));
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

    private ProjectRisk requireRisk(
            UUID projectId,
            UUID riskId) {

        return riskRepository
                .findByIdAndProjectId(
                        riskId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Risk '%s' was not found."
                                                .formatted(
                                                        riskId)));
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

        Set<T> allowed =
                transitions.getOrDefault(
                        current,
                        Set.of());

        if (!allowed.contains(
                target)) {

            throw new InvalidRequestException(
                    "%s status cannot transition from '%s' to '%s'."
                            .formatted(
                                    resource,
                                    current,
                                    target));
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

    private void validateNotFuture(
            LocalDate date,
            String field) {

        if (date.isAfter(
                LocalDate.now(
                        clock))) {

            throw new InvalidRequestException(
                    field
                            + " cannot be in the future.");
        }
    }

    private String normalizeReference(
            String reference) {

        return reference
                .trim()
                .toUpperCase(
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

    private RiskResponse toRiskResponse(
            ProjectRisk risk) {

        return new RiskResponse(
                risk.getId(),
                risk.getProjectId(),
                risk.getReference(),
                risk.getTitle(),
                risk.getDescription(),
                risk.getCategory(),
                risk.getOwnerName(),
                risk.getProbability(),
                risk.getImpact(),
                risk.inherentScore(),
                risk.getResidualProbability(),
                risk.getResidualImpact(),
                risk.residualScore(),
                exposureBand(
                        risk.residualScore()),
                risk.getMitigationPlan(),
                risk.getMitigationDueDate(),
                risk.getStatus(),
                risk.getVersion(),
                risk.getCreatedAt(),
                risk.getUpdatedAt());
    }

    private IssueResponse toIssueResponse(
            ProjectIssue issue,
            ProjectRisk sourceRisk) {

        return new IssueResponse(
                issue.getId(),
                issue.getProjectId(),
                issue.getSourceRiskId(),
                sourceRisk == null
                        ? null
                        : sourceRisk.getReference(),
                issue.getReference(),
                issue.getTitle(),
                issue.getDescription(),
                issue.getSeverity(),
                issue.getOwnerName(),
                issue.getTargetResolutionDate(),
                issue.getStatus(),
                issue.getVersion(),
                issue.getCreatedAt(),
                issue.getUpdatedAt());
    }

    private ChangeEventResponse toChangeResponse(
            ProjectChangeEvent change) {

        return new ChangeEventResponse(
                change.getId(),
                change.getProjectId(),
                change.getReference(),
                change.getTitle(),
                change.getDescription(),
                change.getOriginator(),
                change.getRequestedDate(),
                change.getDecisionDate(),
                change.getCostImpact(),
                change.getScheduleImpactDays(),
                change.getStatus(),
                change.getVersion(),
                change.getCreatedAt(),
                change.getUpdatedAt());
    }

    private DelayEventResponse toDelayResponse(
            ProjectDelayEvent delay) {

        return new DelayEventResponse(
                delay.getId(),
                delay.getProjectId(),
                delay.getReference(),
                delay.getTitle(),
                delay.getDescription(),
                delay.getCause(),
                delay.getOwnerName(),
                delay.getStartDate(),
                delay.getEndDate(),
                delay.getForecastDelayDays(),
                delay.isExcusable(),
                delay.isCompensable(),
                delay.getStatus(),
                delay.getVersion(),
                delay.getCreatedAt(),
                delay.getUpdatedAt());
    }

    private RiskExposureBand exposureBand(
            int residualScore) {

        if (residualScore <= 6) {
            return RiskExposureBand.LOW;
        }

        if (residualScore <= 12) {
            return RiskExposureBand.MODERATE;
        }

        if (residualScore <= 19) {
            return RiskExposureBand.HIGH;
        }

        return RiskExposureBand.CRITICAL;
    }

    private static Map<
            RiskStatus,
            Set<RiskStatus>>
    riskTransitions() {

        Map<
                RiskStatus,
                Set<RiskStatus>>
                map =
                new EnumMap<>(
                        RiskStatus.class);

        map.put(
                RiskStatus.OPEN,
                Set.of(
                        RiskStatus.MITIGATING,
                        RiskStatus.ACCEPTED,
                        RiskStatus.CLOSED));

        map.put(
                RiskStatus.MITIGATING,
                Set.of(
                        RiskStatus.OPEN,
                        RiskStatus.ACCEPTED,
                        RiskStatus.CLOSED));

        map.put(
                RiskStatus.ACCEPTED,
                Set.of(
                        RiskStatus.CLOSED));

        map.put(
                RiskStatus.CLOSED,
                Set.of());

        return Map.copyOf(
                map);
    }

    private static Map<
            IssueStatus,
            Set<IssueStatus>>
    issueTransitions() {

        Map<
                IssueStatus,
                Set<IssueStatus>>
                map =
                new EnumMap<>(
                        IssueStatus.class);

        map.put(
                IssueStatus.OPEN,
                Set.of(
                        IssueStatus.IN_PROGRESS,
                        IssueStatus.RESOLVED,
                        IssueStatus.CLOSED));

        map.put(
                IssueStatus.IN_PROGRESS,
                Set.of(
                        IssueStatus.OPEN,
                        IssueStatus.RESOLVED,
                        IssueStatus.CLOSED));

        map.put(
                IssueStatus.RESOLVED,
                Set.of(
                        IssueStatus.IN_PROGRESS,
                        IssueStatus.CLOSED));

        map.put(
                IssueStatus.CLOSED,
                Set.of());

        return Map.copyOf(
                map);
    }

    private static Map<
            ChangeEventStatus,
            Set<ChangeEventStatus>>
    changeTransitions() {

        Map<
                ChangeEventStatus,
                Set<ChangeEventStatus>>
                map =
                new EnumMap<>(
                        ChangeEventStatus.class);

        map.put(
                ChangeEventStatus.DRAFT,
                Set.of(
                        ChangeEventStatus.UNDER_REVIEW,
                        ChangeEventStatus.REJECTED));

        map.put(
                ChangeEventStatus.UNDER_REVIEW,
                Set.of(
                        ChangeEventStatus.APPROVED,
                        ChangeEventStatus.REJECTED));

        map.put(
                ChangeEventStatus.APPROVED,
                Set.of(
                        ChangeEventStatus.IMPLEMENTED));

        map.put(
                ChangeEventStatus.REJECTED,
                Set.of());

        map.put(
                ChangeEventStatus.IMPLEMENTED,
                Set.of());

        return Map.copyOf(
                map);
    }

    private static Map<
            DelayStatus,
            Set<DelayStatus>>
    delayTransitions() {

        Map<
                DelayStatus,
                Set<DelayStatus>>
                map =
                new EnumMap<>(
                        DelayStatus.class);

        map.put(
                DelayStatus.OPEN,
                Set.of(
                        DelayStatus.MITIGATING,
                        DelayStatus.RESOLVED));

        map.put(
                DelayStatus.MITIGATING,
                Set.of(
                        DelayStatus.OPEN,
                        DelayStatus.RESOLVED));

        map.put(
                DelayStatus.RESOLVED,
                Set.of());

        return Map.copyOf(
                map);
    }
}
