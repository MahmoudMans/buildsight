package com.buildsight.platform.quality.service;

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
import com.buildsight.platform.quality.api.CreateHandoverItemRequest;
import com.buildsight.platform.quality.api.CreateNcrRequest;
import com.buildsight.platform.quality.api.CreatePunchItemRequest;
import com.buildsight.platform.quality.api.CreateQualityInspectionRequest;
import com.buildsight.platform.quality.api.HandoverItemResponse;
import com.buildsight.platform.quality.api.NcrResponse;
import com.buildsight.platform.quality.api.PunchItemResponse;
import com.buildsight.platform.quality.api.QualityControlResponse;
import com.buildsight.platform.quality.api.QualityInspectionResponse;
import com.buildsight.platform.quality.api.QualityIntelligenceResponse;
import com.buildsight.platform.quality.api.UpdateHandoverItemRequest;
import com.buildsight.platform.quality.api.UpdateNcrRequest;
import com.buildsight.platform.quality.api.UpdatePunchItemRequest;
import com.buildsight.platform.quality.api.UpdateQualityInspectionRequest;
import com.buildsight.platform.quality.domain.HandoverStatus;
import com.buildsight.platform.quality.domain.NcrStatus;
import com.buildsight.platform.quality.domain.ProjectHandoverItem;
import com.buildsight.platform.quality.domain.ProjectNcr;
import com.buildsight.platform.quality.domain.ProjectPunchItem;
import com.buildsight.platform.quality.domain.ProjectQualityInspection;
import com.buildsight.platform.quality.domain.PunchStatus;
import com.buildsight.platform.quality.domain.QualityInspectionResult;
import com.buildsight.platform.quality.domain.QualityInspectionStatus;
import com.buildsight.platform.quality.repository.ProjectHandoverItemRepository;
import com.buildsight.platform.quality.repository.ProjectNcrRepository;
import com.buildsight.platform.quality.repository.ProjectPunchItemRepository;
import com.buildsight.platform.quality.repository.ProjectQualityInspectionRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class QualityControlService {

    private static final Map<
            QualityInspectionStatus,
            Set<QualityInspectionStatus>>
            INSPECTION_TRANSITIONS =
            inspectionTransitions();

    private static final Map<
            NcrStatus,
            Set<NcrStatus>>
            NCR_TRANSITIONS =
            ncrTransitions();

    private static final Map<
            PunchStatus,
            Set<PunchStatus>>
            PUNCH_TRANSITIONS =
            punchTransitions();

    private static final Map<
            HandoverStatus,
            Set<HandoverStatus>>
            HANDOVER_TRANSITIONS =
            handoverTransitions();

    private final ProjectRepository projectRepository;
    private final ProjectQualityInspectionRepository inspectionRepository;
    private final ProjectNcrRepository ncrRepository;
    private final ProjectPunchItemRepository punchRepository;
    private final ProjectHandoverItemRepository handoverRepository;
    private final QualityIntelligenceService intelligenceService;
    private final ProjectMapper projectMapper;
    private final Clock clock;

    public QualityControlService(
            ProjectRepository projectRepository,
            ProjectQualityInspectionRepository inspectionRepository,
            ProjectNcrRepository ncrRepository,
            ProjectPunchItemRepository punchRepository,
            ProjectHandoverItemRepository handoverRepository,
            QualityIntelligenceService intelligenceService,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository = projectRepository;
        this.inspectionRepository = inspectionRepository;
        this.ncrRepository = ncrRepository;
        this.punchRepository = punchRepository;
        this.handoverRepository = handoverRepository;
        this.intelligenceService = intelligenceService;
        this.projectMapper = projectMapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public QualityControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(projectId);

        List<ProjectQualityInspection> inspections =
                inspectionRepository
                        .findByProjectIdOrderByPlannedDateDescCreatedAtDesc(
                                projectId);

        List<ProjectNcr> ncrs =
                ncrRepository
                        .findByProjectIdOrderByRaisedDateDescCreatedAtDesc(
                                projectId);

        List<ProjectPunchItem> punchItems =
                punchRepository
                        .findByProjectIdOrderByRaisedDateDescCreatedAtDesc(
                                projectId);

        List<ProjectHandoverItem> handoverItems =
                handoverRepository
                        .findByProjectIdOrderByDueDateAscCodeAsc(
                                projectId);

        Map<UUID, ProjectQualityInspection> inspectionMap =
                inspections.stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectQualityInspection::getId,
                                        Function.identity()));

        return new QualityControlResponse(
                projectMapper.toResponse(project),

                intelligenceService.calculate(
                        inspections,
                        ncrs,
                        punchItems,
                        handoverItems),

                inspections.stream()
                        .map(this::toInspectionResponse)
                        .toList(),

                ncrs.stream()
                        .map(
                                ncr ->
                                        toNcrResponse(
                                                ncr,
                                                ncr.getInspectionId() == null
                                                        ? null
                                                        : inspectionMap.get(
                                                                ncr.getInspectionId())))
                        .toList(),

                punchItems.stream()
                        .map(this::toPunchResponse)
                        .toList(),

                handoverItems.stream()
                        .map(this::toHandoverResponse)
                        .toList());
    }

    @Transactional(readOnly = true)
    public QualityIntelligenceResponse intelligence(
            UUID projectId) {

        requireProject(projectId);

        return intelligenceService.calculate(
                inspectionRepository
                        .findByProjectIdOrderByPlannedDateDescCreatedAtDesc(
                                projectId),

                ncrRepository
                        .findByProjectIdOrderByRaisedDateDescCreatedAtDesc(
                                projectId),

                punchRepository
                        .findByProjectIdOrderByRaisedDateDescCreatedAtDesc(
                                projectId),

                handoverRepository
                        .findByProjectIdOrderByDueDateAscCodeAsc(
                                projectId));
    }

    @Transactional
    public QualityInspectionResponse createInspection(
            UUID projectId,
            CreateQualityInspectionRequest request) {

        requireProject(projectId);

        String reference =
                normalizeReference(
                        request.reference());

        if (inspectionRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Inspection reference '%s' already exists."
                            .formatted(reference));
        }

        ProjectQualityInspection inspection =
                ProjectQualityInspection.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.title().trim(),
                        request.inspectionType(),
                        request.discipline(),
                        request.plannedDate(),
                        normalize(request.inspectorName()),
                        normalize(request.notes()));

        return toInspectionResponse(
                inspectionRepository.save(
                        inspection));
    }

    @Transactional
    public QualityInspectionResponse updateInspection(
            UUID projectId,
            UUID inspectionId,
            UpdateQualityInspectionRequest request) {

        requireProject(projectId);

        ProjectQualityInspection inspection =
                requireInspection(
                        projectId,
                        inspectionId);

        verifyVersion(
                inspection.getVersion(),
                request.version(),
                "quality inspection");

        validateTransition(
                INSPECTION_TRANSITIONS,
                inspection.getStatus(),
                request.status(),
                "quality inspection");

        if (request.actualDate() != null) {
            validateNotFuture(
                    request.actualDate(),
                    "Inspection actual date");
        }

        if (request.status()
                        == QualityInspectionStatus.COMPLETED
                && request.result()
                        == QualityInspectionResult.NOT_ASSESSED) {

            throw new InvalidRequestException(
                    "A completed inspection requires PASS, PASS_WITH_OBSERVATIONS or FAIL.");
        }

        if (request.status()
                        == QualityInspectionStatus.CANCELLED
                && request.result()
                        != QualityInspectionResult.NOT_ASSESSED) {

            throw new InvalidRequestException(
                    "A cancelled inspection cannot have an inspection result.");
        }

        inspection.update(
                request.title().trim(),
                request.inspectionType(),
                request.discipline(),
                request.plannedDate(),
                request.actualDate(),
                normalize(request.inspectorName()),
                request.status(),
                request.result(),
                normalize(request.notes()),
                LocalDate.now(clock));

        return toInspectionResponse(
                inspectionRepository
                        .saveAndFlush(
                                inspection));
    }

    @Transactional
    public NcrResponse createNcr(
            UUID projectId,
            CreateNcrRequest request) {

        requireProject(projectId);

        validateNotFuture(
                request.raisedDate(),
                "NCR raised date");

        validateDateOrder(
                request.raisedDate(),
                request.dueDate(),
                "NCR due date cannot be before its raised date.");

        ProjectQualityInspection inspection =
                request.inspectionId() == null
                        ? null
                        : requireInspection(
                                projectId,
                                request.inspectionId());

        String reference =
                normalizeReference(
                        request.reference());

        if (ncrRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "NCR reference '%s' already exists."
                            .formatted(reference));
        }

        ProjectNcr ncr =
                ProjectNcr.create(
                        UUID.randomUUID(),
                        projectId,
                        inspection == null
                                ? null
                                : inspection.getId(),
                        reference,
                        request.title().trim(),
                        request.description().trim(),
                        request.category(),
                        request.severity(),
                        request.raisedDate(),
                        request.dueDate(),
                        normalize(request.ownerName()));

        return toNcrResponse(
                ncrRepository.save(ncr),
                inspection);
    }

    @Transactional
    public NcrResponse updateNcr(
            UUID projectId,
            UUID ncrId,
            UpdateNcrRequest request) {

        requireProject(projectId);

        ProjectNcr ncr =
                ncrRepository
                        .findByIdAndProjectId(
                                ncrId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "NCR '%s' was not found."
                                                        .formatted(ncrId)));

        verifyVersion(
                ncr.getVersion(),
                request.version(),
                "NCR");

        validateTransition(
                NCR_TRANSITIONS,
                ncr.getStatus(),
                request.status(),
                "NCR");

        validateDateOrder(
                ncr.getRaisedDate(),
                request.dueDate(),
                "NCR due date cannot be before its raised date.");

        ProjectQualityInspection inspection =
                request.inspectionId() == null
                        ? null
                        : requireInspection(
                                projectId,
                                request.inspectionId());

        String rootCause =
                normalize(request.rootCause());

        String correctiveAction =
                normalize(request.correctiveAction());

        String verificationNotes =
                normalize(request.verificationNotes());

        if ((request.status()
                        == NcrStatus.READY_FOR_VERIFICATION
                || request.status()
                        == NcrStatus.CLOSED)
                && (rootCause == null
                || correctiveAction == null)) {

            throw new InvalidRequestException(
                    "NCR verification requires both root cause and corrective action.");
        }

        if (request.status()
                        == NcrStatus.CLOSED
                && verificationNotes == null) {

            throw new InvalidRequestException(
                    "A closed NCR requires verification notes.");
        }

        ncr.update(
                inspection == null
                        ? null
                        : inspection.getId(),
                request.title().trim(),
                request.description().trim(),
                request.category(),
                request.severity(),
                request.dueDate(),
                normalize(request.ownerName()),
                rootCause,
                correctiveAction,
                verificationNotes,
                request.status(),
                LocalDate.now(clock));

        return toNcrResponse(
                ncrRepository
                        .saveAndFlush(ncr),
                inspection);
    }

    @Transactional
    public PunchItemResponse createPunchItem(
            UUID projectId,
            CreatePunchItemRequest request) {

        requireProject(projectId);

        validateNotFuture(
                request.raisedDate(),
                "Punch item raised date");

        validateDateOrder(
                request.raisedDate(),
                request.dueDate(),
                "Punch item due date cannot be before its raised date.");

        String reference =
                normalizeReference(
                        request.reference());

        if (punchRepository
                .existsByProjectIdAndReferenceIgnoreCase(
                        projectId,
                        reference)) {

            throw new ConflictException(
                    "Punch item reference '%s' already exists."
                            .formatted(reference));
        }

        ProjectPunchItem item =
                ProjectPunchItem.create(
                        UUID.randomUUID(),
                        projectId,
                        reference,
                        request.title().trim(),
                        normalize(request.description()),
                        normalize(request.location()),
                        normalize(request.trade()),
                        request.priority(),
                        request.raisedDate(),
                        request.dueDate(),
                        normalize(request.ownerName()));

        return toPunchResponse(
                punchRepository.save(
                        item));
    }

    @Transactional
    public PunchItemResponse updatePunchItem(
            UUID projectId,
            UUID punchItemId,
            UpdatePunchItemRequest request) {

        requireProject(projectId);

        ProjectPunchItem item =
                punchRepository
                        .findByIdAndProjectId(
                                punchItemId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Punch item '%s' was not found."
                                                        .formatted(
                                                                punchItemId)));

        verifyVersion(
                item.getVersion(),
                request.version(),
                "punch item");

        validateTransition(
                PUNCH_TRANSITIONS,
                item.getStatus(),
                request.status(),
                "punch item");

        validateDateOrder(
                item.getRaisedDate(),
                request.dueDate(),
                "Punch item due date cannot be before its raised date.");

        item.update(
                request.title().trim(),
                normalize(request.description()),
                normalize(request.location()),
                normalize(request.trade()),
                request.priority(),
                request.dueDate(),
                normalize(request.ownerName()),
                request.status(),
                LocalDate.now(clock));

        return toPunchResponse(
                punchRepository
                        .saveAndFlush(item));
    }

    @Transactional
    public HandoverItemResponse createHandoverItem(
            UUID projectId,
            CreateHandoverItemRequest request) {

        requireProject(projectId);

        String code =
                normalizeReference(
                        request.code());

        if (handoverRepository
                .existsByProjectIdAndCodeIgnoreCase(
                        projectId,
                        code)) {

            throw new ConflictException(
                    "Handover code '%s' already exists."
                            .formatted(code));
        }

        ProjectHandoverItem item =
                ProjectHandoverItem.create(
                        UUID.randomUUID(),
                        projectId,
                        code,
                        request.title().trim(),
                        request.category(),
                        normalize(request.ownerName()),
                        request.dueDate(),
                        normalize(request.notes()));

        return toHandoverResponse(
                handoverRepository.save(item));
    }

    @Transactional
    public HandoverItemResponse updateHandoverItem(
            UUID projectId,
            UUID handoverItemId,
            UpdateHandoverItemRequest request) {

        requireProject(projectId);

        ProjectHandoverItem item =
                handoverRepository
                        .findByIdAndProjectId(
                                handoverItemId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Handover item '%s' was not found."
                                                        .formatted(
                                                                handoverItemId)));

        verifyVersion(
                item.getVersion(),
                request.version(),
                "handover item");

        validateTransition(
                HANDOVER_TRANSITIONS,
                item.getStatus(),
                request.status(),
                "handover item");

        item.update(
                request.title().trim(),
                request.category(),
                normalize(request.ownerName()),
                request.dueDate(),
                request.status(),
                normalize(request.notes()),
                LocalDate.now(clock));

        return toHandoverResponse(
                handoverRepository
                        .saveAndFlush(item));
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

    private ProjectQualityInspection requireInspection(
            UUID projectId,
            UUID inspectionId) {

        return inspectionRepository
                .findByIdAndProjectId(
                        inspectionId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Quality inspection '%s' was not found."
                                                .formatted(
                                                        inspectionId)));
    }

    private void validateNotFuture(
            LocalDate date,
            String field) {

        if (date.isAfter(
                LocalDate.now(clock))) {

            throw new InvalidRequestException(
                    field + " cannot be in the future.");
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

    private String normalizeReference(
            String value) {

        return value
                .trim()
                .toUpperCase(Locale.ROOT);
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

    private QualityInspectionResponse toInspectionResponse(
            ProjectQualityInspection inspection) {

        return new QualityInspectionResponse(
                inspection.getId(),
                inspection.getProjectId(),
                inspection.getReference(),
                inspection.getTitle(),
                inspection.getInspectionType(),
                inspection.getDiscipline(),
                inspection.getPlannedDate(),
                inspection.getActualDate(),
                inspection.getInspectorName(),
                inspection.getStatus(),
                inspection.getResult(),
                inspection.getNotes(),
                inspection.getVersion(),
                inspection.getCreatedAt(),
                inspection.getUpdatedAt());
    }

    private NcrResponse toNcrResponse(
            ProjectNcr ncr,
            ProjectQualityInspection inspection) {

        return new NcrResponse(
                ncr.getId(),
                ncr.getProjectId(),
                ncr.getInspectionId(),
                inspection == null
                        ? null
                        : inspection.getReference(),
                ncr.getReference(),
                ncr.getTitle(),
                ncr.getDescription(),
                ncr.getCategory(),
                ncr.getSeverity(),
                ncr.getRaisedDate(),
                ncr.getDueDate(),
                ncr.getOwnerName(),
                ncr.getRootCause(),
                ncr.getCorrectiveAction(),
                ncr.getVerificationNotes(),
                ncr.getStatus(),
                ncr.getClosedDate(),
                isNcrOverdue(ncr),
                ncr.getVersion(),
                ncr.getCreatedAt(),
                ncr.getUpdatedAt());
    }

    private PunchItemResponse toPunchResponse(
            ProjectPunchItem item) {

        return new PunchItemResponse(
                item.getId(),
                item.getProjectId(),
                item.getReference(),
                item.getTitle(),
                item.getDescription(),
                item.getLocation(),
                item.getTrade(),
                item.getPriority(),
                item.getRaisedDate(),
                item.getDueDate(),
                item.getOwnerName(),
                item.getStatus(),
                item.getClosedDate(),
                isPunchOverdue(item),
                item.getVersion(),
                item.getCreatedAt(),
                item.getUpdatedAt());
    }

    private HandoverItemResponse toHandoverResponse(
            ProjectHandoverItem item) {

        return new HandoverItemResponse(
                item.getId(),
                item.getProjectId(),
                item.getCode(),
                item.getTitle(),
                item.getCategory(),
                item.getOwnerName(),
                item.getDueDate(),
                item.getReceivedDate(),
                item.getApprovedDate(),
                item.getStatus(),
                item.getNotes(),
                isHandoverOverdue(item),
                item.getVersion(),
                item.getCreatedAt(),
                item.getUpdatedAt());
    }

    private boolean isNcrOverdue(
            ProjectNcr ncr) {

        return ncr.getStatus() != NcrStatus.CLOSED
                && ncr.getStatus() != NcrStatus.VOID
                && ncr.getDueDate()
                        .isBefore(
                                LocalDate.now(clock));
    }

    private boolean isPunchOverdue(
            ProjectPunchItem item) {

        return item.getStatus() != PunchStatus.CLOSED
                && item.getStatus() != PunchStatus.VOID
                && item.getDueDate()
                        .isBefore(
                                LocalDate.now(clock));
    }

    private boolean isHandoverOverdue(
            ProjectHandoverItem item) {

        return item.getStatus() != HandoverStatus.APPROVED
                && item.getStatus() != HandoverStatus.NOT_REQUIRED
                && item.getDueDate()
                        .isBefore(
                                LocalDate.now(clock));
    }

    private static Map<
            QualityInspectionStatus,
            Set<QualityInspectionStatus>>
    inspectionTransitions() {

        Map<
                QualityInspectionStatus,
                Set<QualityInspectionStatus>>
                map =
                new EnumMap<>(
                        QualityInspectionStatus.class);

        map.put(
                QualityInspectionStatus.PLANNED,
                Set.of(
                        QualityInspectionStatus.IN_PROGRESS,
                        QualityInspectionStatus.COMPLETED,
                        QualityInspectionStatus.CANCELLED));

        map.put(
                QualityInspectionStatus.IN_PROGRESS,
                Set.of(
                        QualityInspectionStatus.COMPLETED,
                        QualityInspectionStatus.CANCELLED));

        map.put(
                QualityInspectionStatus.COMPLETED,
                Set.of());

        map.put(
                QualityInspectionStatus.CANCELLED,
                Set.of());

        return Map.copyOf(map);
    }

    private static Map<
            NcrStatus,
            Set<NcrStatus>>
    ncrTransitions() {

        Map<
                NcrStatus,
                Set<NcrStatus>>
                map =
                new EnumMap<>(
                        NcrStatus.class);

        map.put(
                NcrStatus.OPEN,
                Set.of(
                        NcrStatus.CORRECTIVE_ACTION_IN_PROGRESS,
                        NcrStatus.VOID));

        map.put(
                NcrStatus.CORRECTIVE_ACTION_IN_PROGRESS,
                Set.of(
                        NcrStatus.OPEN,
                        NcrStatus.READY_FOR_VERIFICATION,
                        NcrStatus.VOID));

        map.put(
                NcrStatus.READY_FOR_VERIFICATION,
                Set.of(
                        NcrStatus.CORRECTIVE_ACTION_IN_PROGRESS,
                        NcrStatus.CLOSED));

        map.put(
                NcrStatus.CLOSED,
                Set.of());

        map.put(
                NcrStatus.VOID,
                Set.of());

        return Map.copyOf(map);
    }

    private static Map<
            PunchStatus,
            Set<PunchStatus>>
    punchTransitions() {

        Map<
                PunchStatus,
                Set<PunchStatus>>
                map =
                new EnumMap<>(
                        PunchStatus.class);

        map.put(
                PunchStatus.OPEN,
                Set.of(
                        PunchStatus.IN_PROGRESS,
                        PunchStatus.VOID));

        map.put(
                PunchStatus.IN_PROGRESS,
                Set.of(
                        PunchStatus.OPEN,
                        PunchStatus.READY_FOR_INSPECTION,
                        PunchStatus.VOID));

        map.put(
                PunchStatus.READY_FOR_INSPECTION,
                Set.of(
                        PunchStatus.IN_PROGRESS,
                        PunchStatus.CLOSED));

        map.put(
                PunchStatus.CLOSED,
                Set.of());

        map.put(
                PunchStatus.VOID,
                Set.of());

        return Map.copyOf(map);
    }

    private static Map<
            HandoverStatus,
            Set<HandoverStatus>>
    handoverTransitions() {

        Map<
                HandoverStatus,
                Set<HandoverStatus>>
                map =
                new EnumMap<>(
                        HandoverStatus.class);

        map.put(
                HandoverStatus.NOT_STARTED,
                Set.of(
                        HandoverStatus.SUBMITTED,
                        HandoverStatus.NOT_REQUIRED));

        map.put(
                HandoverStatus.SUBMITTED,
                Set.of(
                        HandoverStatus.APPROVED,
                        HandoverStatus.REJECTED));

        map.put(
                HandoverStatus.REJECTED,
                Set.of(
                        HandoverStatus.SUBMITTED,
                        HandoverStatus.NOT_REQUIRED));

        map.put(
                HandoverStatus.APPROVED,
                Set.of());

        map.put(
                HandoverStatus.NOT_REQUIRED,
                Set.of());

        return Map.copyOf(map);
    }
}
