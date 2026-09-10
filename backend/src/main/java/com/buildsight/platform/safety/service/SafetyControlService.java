package com.buildsight.platform.safety.service;

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
import com.buildsight.platform.safety.api.CreateSafetyActionRequest;
import com.buildsight.platform.safety.api.CreateSafetyIncidentRequest;
import com.buildsight.platform.safety.api.CreateSafetyObservationRequest;
import com.buildsight.platform.safety.api.CreateWorkPermitRequest;
import com.buildsight.platform.safety.api.SafetyActionResponse;
import com.buildsight.platform.safety.api.SafetyControlResponse;
import com.buildsight.platform.safety.api.SafetyIncidentResponse;
import com.buildsight.platform.safety.api.SafetyIntelligenceResponse;
import com.buildsight.platform.safety.api.SafetyObservationResponse;
import com.buildsight.platform.safety.api.UpdateSafetyActionRequest;
import com.buildsight.platform.safety.api.UpdateSafetyIncidentRequest;
import com.buildsight.platform.safety.api.UpdateSafetyObservationRequest;
import com.buildsight.platform.safety.api.UpdateWorkPermitRequest;
import com.buildsight.platform.safety.api.WorkPermitResponse;
import com.buildsight.platform.safety.domain.ProjectSafetyAction;
import com.buildsight.platform.safety.domain.ProjectSafetyIncident;
import com.buildsight.platform.safety.domain.ProjectSafetyObservation;
import com.buildsight.platform.safety.domain.ProjectWorkPermit;
import com.buildsight.platform.safety.domain.SafetyActionStatus;
import com.buildsight.platform.safety.domain.SafetyIncidentStatus;
import com.buildsight.platform.safety.domain.SafetyObservationStatus;
import com.buildsight.platform.safety.domain.SafetyObservationType;
import com.buildsight.platform.safety.domain.WorkPermitStatus;
import com.buildsight.platform.safety.repository.ProjectSafetyActionRepository;
import com.buildsight.platform.safety.repository.ProjectSafetyIncidentRepository;
import com.buildsight.platform.safety.repository.ProjectSafetyObservationRepository;
import com.buildsight.platform.safety.repository.ProjectWorkPermitRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SafetyControlService {

    private static final Map<
            SafetyIncidentStatus,
            Set<SafetyIncidentStatus>>
            INCIDENT_TRANSITIONS =
            incidentTransitions();

    private static final Map<
            SafetyObservationStatus,
            Set<SafetyObservationStatus>>
            OBSERVATION_TRANSITIONS =
            observationTransitions();

    private static final Map<
            SafetyActionStatus,
            Set<SafetyActionStatus>>
            ACTION_TRANSITIONS =
            actionTransitions();

    private static final Map<
            WorkPermitStatus,
            Set<WorkPermitStatus>>
            PERMIT_TRANSITIONS =
            permitTransitions();

    private final ProjectRepository projectRepository;

    private final ProjectSafetyIncidentRepository
            incidentRepository;

    private final ProjectSafetyObservationRepository
            observationRepository;

    private final ProjectSafetyActionRepository
            actionRepository;

    private final ProjectWorkPermitRepository
            permitRepository;

    private final SafetyIntelligenceService
            intelligenceService;

    private final ProjectMapper
            projectMapper;

    private final Clock clock;

    public SafetyControlService(
            ProjectRepository projectRepository,
            ProjectSafetyIncidentRepository incidentRepository,
            ProjectSafetyObservationRepository observationRepository,
            ProjectSafetyActionRepository actionRepository,
            ProjectWorkPermitRepository permitRepository,
            SafetyIntelligenceService intelligenceService,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.incidentRepository =
                incidentRepository;

        this.observationRepository =
                observationRepository;

        this.actionRepository =
                actionRepository;

        this.permitRepository =
                permitRepository;

        this.intelligenceService =
                intelligenceService;

        this.projectMapper =
                projectMapper;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public SafetyControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        List<ProjectSafetyIncident> incidents =
                incidentRepository
                        .findByProjectIdOrderByOccurredDateDescCreatedAtDesc(
                                projectId);

        List<ProjectSafetyObservation> observations =
                observationRepository
                        .findByProjectIdOrderByObservedDateDescCreatedAtDesc(
                                projectId);

        List<ProjectSafetyAction> actions =
                actionRepository
                        .findByProjectIdOrderByDueDateAscCreatedAtAsc(
                                projectId);

        List<ProjectWorkPermit> permits =
                permitRepository
                        .findByProjectIdOrderByValidUntilAscCreatedAtDesc(
                                projectId);

        Map<UUID, ProjectSafetyIncident> incidentMap =
                incidents.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectSafetyIncident::getId,
                                        Function.identity()));

        Map<UUID, ProjectSafetyObservation> observationMap =
                observations.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectSafetyObservation::getId,
                                        Function.identity()));

        return new SafetyControlResponse(
                projectMapper.toResponse(
                        project),

                intelligenceService.calculate(
                        incidents,
                        observations,
                        actions,
                        permits),

                incidents.stream()
                        .map(this::toIncidentResponse)
                        .toList(),

                observations.stream()
                        .map(this::toObservationResponse)
                        .toList(),

                actions.stream()
                        .map(
                                action ->
                                        toActionResponse(
                                                action,
                                                action.getIncidentId() == null
                                                        ? null
                                                        : incidentMap.get(
                                                                action.getIncidentId()),
                                                action.getObservationId() == null
                                                        ? null
                                                        : observationMap.get(
                                                                action.getObservationId())))
                        .toList(),

                permits.stream()
                        .map(this::toPermitResponse)
                        .toList());
    }

    @Transactional(readOnly = true)
    public SafetyIntelligenceResponse intelligence(
            UUID projectId) {

        requireProject(projectId);

        return intelligenceService.calculate(
                incidentRepository
                        .findByProjectIdOrderByOccurredDateDescCreatedAtDesc(
                                projectId),

                observationRepository
                        .findByProjectIdOrderByObservedDateDescCreatedAtDesc(
                                projectId),

                actionRepository
                        .findByProjectIdOrderByDueDateAscCreatedAtAsc(
                                projectId),

                permitRepository
                        .findByProjectIdOrderByValidUntilAscCreatedAtDesc(
                                projectId));
    }

    @Transactional
    public SafetyIncidentResponse createIncident(
            UUID projectId,
            CreateSafetyIncidentRequest request) {

        requireProject(projectId);

        validateNotFuture(
                request.occurredDate(),
                "Incident occurrence date");

        validateNotFuture(
                request.reportedDate(),
                "Incident reported date");

        if (request.reportedDate()
                .isBefore(
                        request.occurredDate())) {

            throw new InvalidRequestException(
                    "Incident reported date cannot be before occurrence date.");
        }

        String reference =
                reference(
                        request.reference());

        if (incidentRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Safety incident reference '%s' already exists."
                            .formatted(reference));
        }

        ProjectSafetyIncident incident =
                ProjectSafetyIncident.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.incidentType(),
                        request.severity(),
                        request.title().trim(),
                        request.description().trim(),
                        normalize(
                                request.location()),
                        request.occurredDate(),
                        request.reportedDate(),
                        request.peopleAffected(),
                        request.lostTimeDays(),
                        normalize(
                                request.immediateAction()));

        return toIncidentResponse(
                incidentRepository.save(
                        incident));
    }

    @Transactional
    public SafetyIncidentResponse updateIncident(
            UUID projectId,
            UUID incidentId,
            UpdateSafetyIncidentRequest request) {

        requireProject(projectId);

        ProjectSafetyIncident incident =
                requireIncident(
                        projectId,
                        incidentId);

        verifyVersion(
                incident.getVersion(),
                request.version(),
                "safety incident");

        validateTransition(
                INCIDENT_TRANSITIONS,
                incident.getStatus(),
                request.status(),
                "safety incident");

        String rootCause =
                normalize(
                        request.rootCause());

        String investigationNotes =
                normalize(
                        request.investigationNotes());

        if (request.status()
                        == SafetyIncidentStatus.CLOSED
                && (rootCause == null
                || investigationNotes == null)) {

            throw new InvalidRequestException(
                    "A closed safety incident requires root cause and investigation notes.");
        }

        if (request.status()
                == SafetyIncidentStatus.CLOSED) {

            boolean unresolvedActions =
                    actionRepository
                            .findByIncidentIdOrderByDueDateAscCreatedAtAsc(
                                    incidentId)
                            .stream()
                            .anyMatch(
                                    this::isOpenAction);

            if (unresolvedActions) {

                throw new InvalidRequestException(
                        "Safety incident cannot be closed while linked corrective actions remain open.");
            }
        }

        incident.update(
                request.incidentType(),
                request.severity(),
                request.title().trim(),
                request.description().trim(),
                normalize(
                        request.location()),
                request.peopleAffected(),
                request.lostTimeDays(),
                normalize(
                        request.immediateAction()),
                rootCause,
                investigationNotes,
                request.status(),
                LocalDate.now(clock));

        return toIncidentResponse(
                incidentRepository
                        .saveAndFlush(
                                incident));
    }

    @Transactional
    public SafetyObservationResponse createObservation(
            UUID projectId,
            CreateSafetyObservationRequest request) {

        requireProject(projectId);

        validateNotFuture(
                request.observedDate(),
                "Observation date");

        String reference =
                reference(
                        request.reference());

        if (observationRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Safety observation reference '%s' already exists."
                            .formatted(reference));
        }

        if (isUnsafe(
                request.observationType())
                && request.dueDate() == null) {

            throw new InvalidRequestException(
                    "Unsafe observations require a target action date.");
        }

        ProjectSafetyObservation observation =
                ProjectSafetyObservation.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.observationType(),
                        request.hazardCategory(),
                        request.severity(),
                        request.title().trim(),
                        request.description().trim(),
                        normalize(
                                request.location()),
                        request.observedDate(),
                        normalize(
                                request.observerName()),
                        normalize(
                                request.ownerName()),
                        request.dueDate());

        return toObservationResponse(
                observationRepository.save(
                        observation));
    }

    @Transactional
    public SafetyObservationResponse updateObservation(
            UUID projectId,
            UUID observationId,
            UpdateSafetyObservationRequest request) {

        requireProject(projectId);

        ProjectSafetyObservation observation =
                requireObservation(
                        projectId,
                        observationId);

        verifyVersion(
                observation.getVersion(),
                request.version(),
                "safety observation");

        validateTransition(
                OBSERVATION_TRANSITIONS,
                observation.getStatus(),
                request.status(),
                "safety observation");

        if (isUnsafe(
                request.observationType())
                && request.status()
                        != SafetyObservationStatus.CLOSED
                && request.status()
                        != SafetyObservationStatus.VOID
                && request.dueDate() == null) {

            throw new InvalidRequestException(
                    "Open unsafe observations require a target action date.");
        }

        if (request.status()
                == SafetyObservationStatus.CLOSED) {

            boolean unresolvedActions =
                    actionRepository
                            .findByObservationIdOrderByDueDateAscCreatedAtAsc(
                                    observationId)
                            .stream()
                            .anyMatch(
                                    this::isOpenAction);

            if (unresolvedActions) {

                throw new InvalidRequestException(
                        "Safety observation cannot be closed while linked actions remain open.");
            }
        }

        observation.update(
                request.observationType(),
                request.hazardCategory(),
                request.severity(),
                request.title().trim(),
                request.description().trim(),
                normalize(
                        request.location()),
                normalize(
                        request.ownerName()),
                request.dueDate(),
                request.status(),
                LocalDate.now(clock));

        return toObservationResponse(
                observationRepository
                        .saveAndFlush(
                                observation));
    }

    @Transactional
    public SafetyActionResponse createAction(
            UUID projectId,
            CreateSafetyActionRequest request) {

        requireProject(projectId);

        if (request.incidentId() != null
                && request.observationId() != null) {

            throw new InvalidRequestException(
                    "A safety action may reference either an incident or an observation, not both.");
        }

        ProjectSafetyIncident incident =
                request.incidentId() == null
                        ? null
                        : requireIncident(
                                projectId,
                                request.incidentId());

        ProjectSafetyObservation observation =
                request.observationId() == null
                        ? null
                        : requireObservation(
                                projectId,
                                request.observationId());

        String reference =
                reference(
                        request.reference());

        if (actionRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Safety action reference '%s' already exists."
                            .formatted(reference));
        }

        ProjectSafetyAction action =
                ProjectSafetyAction.create(
                        UUID.randomUUID(),
                        projectId,
                        incident == null
                                ? null
                                : incident.getId(),
                        observation == null
                                ? null
                                : observation.getId(),
                        reference,
                        request.title().trim(),
                        request.actionDescription().trim(),
                        normalize(
                                request.ownerName()),
                        request.dueDate());

        return toActionResponse(
                actionRepository.save(
                        action),
                incident,
                observation);
    }

    @Transactional
    public SafetyActionResponse updateAction(
            UUID projectId,
            UUID actionId,
            UpdateSafetyActionRequest request) {

        requireProject(projectId);

        ProjectSafetyAction action =
                actionRepository
                        .findByIdAndProjectId(
                                actionId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Safety action '%s' was not found."
                                                        .formatted(actionId)));

        verifyVersion(
                action.getVersion(),
                request.version(),
                "safety action");

        validateTransition(
                ACTION_TRANSITIONS,
                action.getStatus(),
                request.status(),
                "safety action");

        String verification =
                normalize(
                        request.verificationNotes());

        if (request.status()
                        == SafetyActionStatus.CLOSED
                && verification == null) {

            throw new InvalidRequestException(
                    "A closed safety action requires verification notes.");
        }

        action.update(
                request.title().trim(),
                request.actionDescription().trim(),
                normalize(
                        request.ownerName()),
                request.dueDate(),
                request.status(),
                verification,
                LocalDate.now(clock));

        ProjectSafetyIncident incident =
                action.getIncidentId() == null
                        ? null
                        : requireIncident(
                                projectId,
                                action.getIncidentId());

        ProjectSafetyObservation observation =
                action.getObservationId() == null
                        ? null
                        : requireObservation(
                                projectId,
                                action.getObservationId());

        return toActionResponse(
                actionRepository
                        .saveAndFlush(
                                action),
                incident,
                observation);
    }

    @Transactional
    public WorkPermitResponse createPermit(
            UUID projectId,
            CreateWorkPermitRequest request) {

        requireProject(projectId);

        validateDateOrder(
                request.validFrom(),
                request.validUntil(),
                "Permit validity end cannot be before its start.");

        String reference =
                reference(
                        request.reference());

        if (permitRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Work permit reference '%s' already exists."
                            .formatted(reference));
        }

        ProjectWorkPermit permit =
                ProjectWorkPermit.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.permitType(),
                        request.title().trim(),
                        normalize(
                                request.location()),
                        normalize(
                                request.issuerName()),
                        normalize(
                                request.receiverName()),
                        request.validFrom(),
                        request.validUntil(),
                        normalize(
                                request.controls()));

        return toPermitResponse(
                permitRepository.save(
                        permit));
    }

    @Transactional
    public WorkPermitResponse updatePermit(
            UUID projectId,
            UUID permitId,
            UpdateWorkPermitRequest request) {

        requireProject(projectId);

        ProjectWorkPermit permit =
                permitRepository
                        .findByIdAndProjectId(
                                permitId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Work permit '%s' was not found."
                                                        .formatted(permitId)));

        verifyVersion(
                permit.getVersion(),
                request.version(),
                "work permit");

        validateTransition(
                PERMIT_TRANSITIONS,
                permit.getStatus(),
                request.status(),
                "work permit");

        validateDateOrder(
                request.validFrom(),
                request.validUntil(),
                "Permit validity end cannot be before its start.");

        String controls =
                normalize(
                        request.controls());

        if (request.status()
                == WorkPermitStatus.ACTIVE) {

            LocalDate today =
                    LocalDate.now(clock);

            if (today.isBefore(
                    request.validFrom())) {

                throw new InvalidRequestException(
                        "A work permit cannot become ACTIVE before its validity start date.");
            }

            if (today.isAfter(
                    request.validUntil())) {

                throw new InvalidRequestException(
                        "An expired work permit cannot become ACTIVE.");
            }

            if (controls == null) {

                throw new InvalidRequestException(
                        "An active work permit requires documented controls.");
            }
        }

        permit.update(
                request.permitType(),
                request.title().trim(),
                normalize(
                        request.location()),
                normalize(
                        request.issuerName()),
                normalize(
                        request.receiverName()),
                request.validFrom(),
                request.validUntil(),
                controls,
                request.status(),
                LocalDate.now(clock));

        return toPermitResponse(
                permitRepository
                        .saveAndFlush(
                                permit));
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

    private ProjectSafetyIncident requireIncident(
            UUID projectId,
            UUID incidentId) {

        return incidentRepository
                .findByIdAndProjectId(
                        incidentId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Safety incident '%s' was not found."
                                                .formatted(incidentId)));
    }

    private ProjectSafetyObservation requireObservation(
            UUID projectId,
            UUID observationId) {

        return observationRepository
                .findByIdAndProjectId(
                        observationId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Safety observation '%s' was not found."
                                                .formatted(observationId)));
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

    private void validateDateOrder(
            LocalDate start,
            LocalDate end,
            String message) {

        if (end.isBefore(start)) {

            throw new InvalidRequestException(
                    message);
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

    private boolean isOpenAction(
            ProjectSafetyAction action) {

        return action.getStatus()
                        != SafetyActionStatus.CLOSED
                && action.getStatus()
                        != SafetyActionStatus.VOID;
    }

    private boolean isUnsafe(
            SafetyObservationType type) {

        return type
                        == SafetyObservationType.UNSAFE_ACT
                || type
                        == SafetyObservationType.UNSAFE_CONDITION;
    }

    private String reference(
            String value) {

        return value
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

    private SafetyIncidentResponse toIncidentResponse(
            ProjectSafetyIncident incident) {

        return new SafetyIncidentResponse(
                incident.getId(),
                incident.getProjectId(),
                incident.getReference(),
                incident.getIncidentType(),
                incident.getSeverity(),
                incident.getTitle(),
                incident.getDescription(),
                incident.getLocation(),
                incident.getOccurredDate(),
                incident.getReportedDate(),
                incident.getPeopleAffected(),
                incident.getLostTimeDays(),
                incident.getImmediateAction(),
                incident.getRootCause(),
                incident.getInvestigationNotes(),
                incident.getStatus(),
                incident.getClosedDate(),
                incident.getVersion(),
                incident.getCreatedAt(),
                incident.getUpdatedAt());
    }

    private SafetyObservationResponse toObservationResponse(
            ProjectSafetyObservation observation) {

        boolean overdue =
                isUnsafe(
                        observation.getObservationType())
                        && observation.getStatus()
                                != SafetyObservationStatus.CLOSED
                        && observation.getStatus()
                                != SafetyObservationStatus.VOID
                        && observation.getDueDate() != null
                        && observation.getDueDate()
                                .isBefore(
                                        LocalDate.now(clock));

        return new SafetyObservationResponse(
                observation.getId(),
                observation.getProjectId(),
                observation.getReference(),
                observation.getObservationType(),
                observation.getHazardCategory(),
                observation.getSeverity(),
                observation.getTitle(),
                observation.getDescription(),
                observation.getLocation(),
                observation.getObservedDate(),
                observation.getObserverName(),
                observation.getOwnerName(),
                observation.getDueDate(),
                observation.getStatus(),
                observation.getClosedDate(),
                overdue,
                observation.getVersion(),
                observation.getCreatedAt(),
                observation.getUpdatedAt());
    }

    private SafetyActionResponse toActionResponse(
            ProjectSafetyAction action,
            ProjectSafetyIncident incident,
            ProjectSafetyObservation observation) {

        boolean overdue =
                isOpenAction(action)
                        && action.getDueDate()
                                .isBefore(
                                        LocalDate.now(clock));

        return new SafetyActionResponse(
                action.getId(),
                action.getProjectId(),
                action.getIncidentId(),
                incident == null
                        ? null
                        : incident.getReference(),
                action.getObservationId(),
                observation == null
                        ? null
                        : observation.getReference(),
                action.getReference(),
                action.getTitle(),
                action.getActionDescription(),
                action.getOwnerName(),
                action.getDueDate(),
                action.getStatus(),
                action.getVerificationNotes(),
                action.getClosedDate(),
                overdue,
                action.getVersion(),
                action.getCreatedAt(),
                action.getUpdatedAt());
    }

    private WorkPermitResponse toPermitResponse(
            ProjectWorkPermit permit) {

        boolean expired =
                (permit.getStatus()
                                == WorkPermitStatus.ACTIVE
                        || permit.getStatus()
                                == WorkPermitStatus.SUSPENDED)
                        && permit.getValidUntil()
                                .isBefore(
                                        LocalDate.now(clock));

        return new WorkPermitResponse(
                permit.getId(),
                permit.getProjectId(),
                permit.getReference(),
                permit.getPermitType(),
                permit.getTitle(),
                permit.getLocation(),
                permit.getIssuerName(),
                permit.getReceiverName(),
                permit.getValidFrom(),
                permit.getValidUntil(),
                permit.getControls(),
                permit.getStatus(),
                permit.getClosedDate(),
                expired,
                permit.getVersion(),
                permit.getCreatedAt(),
                permit.getUpdatedAt());
    }

    private static Map<
            SafetyIncidentStatus,
            Set<SafetyIncidentStatus>>
    incidentTransitions() {

        Map<
                SafetyIncidentStatus,
                Set<SafetyIncidentStatus>>
                map =
                new EnumMap<>(
                        SafetyIncidentStatus.class);

        map.put(
                SafetyIncidentStatus.REPORTED,
                Set.of(
                        SafetyIncidentStatus.UNDER_INVESTIGATION,
                        SafetyIncidentStatus.ACTION_IN_PROGRESS,
                        SafetyIncidentStatus.VOID));

        map.put(
                SafetyIncidentStatus.UNDER_INVESTIGATION,
                Set.of(
                        SafetyIncidentStatus.ACTION_IN_PROGRESS,
                        SafetyIncidentStatus.CLOSED,
                        SafetyIncidentStatus.VOID));

        map.put(
                SafetyIncidentStatus.ACTION_IN_PROGRESS,
                Set.of(
                        SafetyIncidentStatus.UNDER_INVESTIGATION,
                        SafetyIncidentStatus.CLOSED,
                        SafetyIncidentStatus.VOID));

        map.put(
                SafetyIncidentStatus.CLOSED,
                Set.of());

        map.put(
                SafetyIncidentStatus.VOID,
                Set.of());

        return Map.copyOf(map);
    }

    private static Map<
            SafetyObservationStatus,
            Set<SafetyObservationStatus>>
    observationTransitions() {

        Map<
                SafetyObservationStatus,
                Set<SafetyObservationStatus>>
                map =
                new EnumMap<>(
                        SafetyObservationStatus.class);

        map.put(
                SafetyObservationStatus.OPEN,
                Set.of(
                        SafetyObservationStatus.ACTION_IN_PROGRESS,
                        SafetyObservationStatus.CLOSED,
                        SafetyObservationStatus.VOID));

        map.put(
                SafetyObservationStatus.ACTION_IN_PROGRESS,
                Set.of(
                        SafetyObservationStatus.OPEN,
                        SafetyObservationStatus.CLOSED,
                        SafetyObservationStatus.VOID));

        map.put(
                SafetyObservationStatus.CLOSED,
                Set.of());

        map.put(
                SafetyObservationStatus.VOID,
                Set.of());

        return Map.copyOf(map);
    }

    private static Map<
            SafetyActionStatus,
            Set<SafetyActionStatus>>
    actionTransitions() {

        Map<
                SafetyActionStatus,
                Set<SafetyActionStatus>>
                map =
                new EnumMap<>(
                        SafetyActionStatus.class);

        map.put(
                SafetyActionStatus.OPEN,
                Set.of(
                        SafetyActionStatus.IN_PROGRESS,
                        SafetyActionStatus.VOID));

        map.put(
                SafetyActionStatus.IN_PROGRESS,
                Set.of(
                        SafetyActionStatus.OPEN,
                        SafetyActionStatus.READY_FOR_VERIFICATION,
                        SafetyActionStatus.VOID));

        map.put(
                SafetyActionStatus.READY_FOR_VERIFICATION,
                Set.of(
                        SafetyActionStatus.IN_PROGRESS,
                        SafetyActionStatus.CLOSED));

        map.put(
                SafetyActionStatus.CLOSED,
                Set.of());

        map.put(
                SafetyActionStatus.VOID,
                Set.of());

        return Map.copyOf(map);
    }

    private static Map<
            WorkPermitStatus,
            Set<WorkPermitStatus>>
    permitTransitions() {

        Map<
                WorkPermitStatus,
                Set<WorkPermitStatus>>
                map =
                new EnumMap<>(
                        WorkPermitStatus.class);

        map.put(
                WorkPermitStatus.DRAFT,
                Set.of(
                        WorkPermitStatus.ACTIVE,
                        WorkPermitStatus.CANCELLED));

        map.put(
                WorkPermitStatus.ACTIVE,
                Set.of(
                        WorkPermitStatus.SUSPENDED,
                        WorkPermitStatus.CLOSED,
                        WorkPermitStatus.CANCELLED));

        map.put(
                WorkPermitStatus.SUSPENDED,
                Set.of(
                        WorkPermitStatus.ACTIVE,
                        WorkPermitStatus.CLOSED,
                        WorkPermitStatus.CANCELLED));

        map.put(
                WorkPermitStatus.CLOSED,
                Set.of());

        map.put(
                WorkPermitStatus.CANCELLED,
                Set.of());

        return Map.copyOf(map);
    }
}
