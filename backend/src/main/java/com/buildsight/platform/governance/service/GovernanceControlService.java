package com.buildsight.platform.governance.service;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.EnumMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.governance.api.GovernanceModels.ActionResponse;
import com.buildsight.platform.governance.api.GovernanceModels.CreateActionRequest;
import com.buildsight.platform.governance.api.GovernanceModels.CreateDecisionRequest;
import com.buildsight.platform.governance.api.GovernanceModels.CreateMeetingRequest;
import com.buildsight.platform.governance.api.GovernanceModels.DecisionResponse;
import com.buildsight.platform.governance.api.GovernanceModels.ExecutiveReportResponse;
import com.buildsight.platform.governance.api.GovernanceModels.ExecutiveReportSnapshotResponse;
import com.buildsight.platform.governance.api.GovernanceModels.GovernanceControlResponse;
import com.buildsight.platform.governance.api.GovernanceModels.GovernanceIntelligenceResponse;
import com.buildsight.platform.governance.api.GovernanceModels.MeetingResponse;
import com.buildsight.platform.governance.api.GovernanceModels.UpdateActionRequest;
import com.buildsight.platform.governance.api.GovernanceModels.UpdateDecisionRequest;
import com.buildsight.platform.governance.api.GovernanceModels.UpdateMeetingRequest;
import com.buildsight.platform.governance.domain.GovernanceActionStatus;
import com.buildsight.platform.governance.domain.GovernanceDecisionStatus;
import com.buildsight.platform.governance.domain.GovernanceMeetingStatus;
import com.buildsight.platform.governance.domain.ProjectExecutiveReportSnapshot;
import com.buildsight.platform.governance.domain.ProjectGovernanceAction;
import com.buildsight.platform.governance.domain.ProjectGovernanceDecision;
import com.buildsight.platform.governance.domain.ProjectGovernanceMeeting;
import com.buildsight.platform.governance.repository.ProjectExecutiveReportSnapshotRepository;
import com.buildsight.platform.governance.repository.ProjectGovernanceActionRepository;
import com.buildsight.platform.governance.repository.ProjectGovernanceDecisionRepository;
import com.buildsight.platform.governance.repository.ProjectGovernanceMeetingRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GovernanceControlService {

    private static final Map<
            GovernanceDecisionStatus,
            Set<GovernanceDecisionStatus>>
            DECISION_TRANSITIONS =
            decisionTransitions();

    private static final Map<
            GovernanceActionStatus,
            Set<GovernanceActionStatus>>
            ACTION_TRANSITIONS =
            actionTransitions();

    private final ProjectRepository
            projectRepository;

    private final ProjectGovernanceMeetingRepository
            meetingRepository;

    private final ProjectGovernanceDecisionRepository
            decisionRepository;

    private final ProjectGovernanceActionRepository
            actionRepository;

    private final ProjectExecutiveReportSnapshotRepository
            reportSnapshotRepository;

    private final GovernanceIntelligenceService
            intelligenceService;

    private final ExecutiveReportService
            executiveReportService;

    private final ProjectMapper
            projectMapper;

    private final Clock
            clock;

    public GovernanceControlService(
            ProjectRepository projectRepository,
            ProjectGovernanceMeetingRepository meetingRepository,
            ProjectGovernanceDecisionRepository decisionRepository,
            ProjectGovernanceActionRepository actionRepository,
            ProjectExecutiveReportSnapshotRepository reportSnapshotRepository,
            GovernanceIntelligenceService intelligenceService,
            ExecutiveReportService executiveReportService,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.meetingRepository =
                meetingRepository;

        this.decisionRepository =
                decisionRepository;

        this.actionRepository =
                actionRepository;

        this.reportSnapshotRepository =
                reportSnapshotRepository;

        this.intelligenceService =
                intelligenceService;

        this.executiveReportService =
                executiveReportService;

        this.projectMapper =
                projectMapper;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public GovernanceControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        List<ProjectGovernanceMeeting> meetings =
                meetings(
                        projectId);

        List<ProjectGovernanceDecision> decisions =
                decisions(
                        projectId);

        List<ProjectGovernanceAction> actions =
                actions(
                        projectId);

        GovernanceIntelligenceResponse intelligence =
                intelligenceService
                        .calculate(
                                meetings,
                                decisions,
                                actions);

        ExecutiveReportResponse executiveReport =
                executiveReportService
                        .generate(
                                projectId);

        return new GovernanceControlResponse(
                projectMapper.toResponse(
                        project),

                intelligence,

                executiveReport,

                meetings.stream()
                        .map(
                                this::response)
                        .toList(),

                decisions.stream()
                        .map(
                                this::response)
                        .toList(),

                actions.stream()
                        .map(
                                this::response)
                        .toList(),

                reportSnapshotRepository
                        .findByProjectIdOrderByReportDateDesc(
                                projectId)
                        .stream()
                        .map(
                                this::response)
                        .toList());
    }

    @Transactional(readOnly = true)
    public GovernanceIntelligenceResponse intelligence(
            UUID projectId) {

        requireProject(
                projectId);

        return intelligenceService
                .calculate(
                        meetings(
                                projectId),
                        decisions(
                                projectId),
                        actions(
                                projectId));
    }

    @Transactional
    public MeetingResponse createMeeting(
            UUID projectId,
            CreateMeetingRequest request) {

        requireProject(
                projectId);

        String number =
                reference(
                        request.meetingNumber());

        if (meetingRepository
                .existsByProjectIdAndMeetingNumberIgnoreCase(
                        projectId,
                        number)) {

            throw new ConflictException(
                    "Meeting '%s' already exists."
                            .formatted(
                                    number));
        }

        ProjectGovernanceMeeting meeting =
                ProjectGovernanceMeeting.create(
                        UUID.randomUUID(),
                        projectId,
                        number,
                        request.title()
                                .trim(),
                        request.meetingType(),
                        request.scheduledAt(),
                        normalize(
                                request.chairName()));

        return response(
                meetingRepository.save(
                        meeting));
    }

    @Transactional
    public MeetingResponse updateMeeting(
            UUID projectId,
            UUID meetingId,
            UpdateMeetingRequest request) {

        requireProject(
                projectId);

        ProjectGovernanceMeeting meeting =
                requireMeeting(
                        projectId,
                        meetingId);

        verifyVersion(
                meeting.getVersion(),
                request.version(),
                "meeting");

        if (
                request.status()
                        == GovernanceMeetingStatus.HELD
                && request.heldAt()
                        != null
                && request.heldAt()
                        .isAfter(
                                Instant.now(
                                        clock))) {

            throw new InvalidRequestException(
                    "Held date cannot be in the future.");
        }

        meeting.update(
                request.title()
                        .trim(),
                request.meetingType(),
                request.scheduledAt(),
                request.heldAt(),
                request.status(),
                normalize(
                        request.chairName()),
                normalize(
                        request.minutes()),
                request.nextMeetingAt());

        return response(
                meetingRepository
                        .saveAndFlush(
                                meeting));
    }

    @Transactional
    public DecisionResponse createDecision(
            UUID projectId,
            CreateDecisionRequest request) {

        requireProject(
                projectId);

        validateMeeting(
                projectId,
                request.meetingId());

        validateNotFuture(
                request.decisionDate(),
                "Decision date");

        String number =
                reference(
                        request.decisionNumber());

        if (decisionRepository
                .existsByProjectIdAndDecisionNumberIgnoreCase(
                        projectId,
                        number)) {

            throw new ConflictException(
                    "Decision '%s' already exists."
                            .formatted(
                                    number));
        }

        ProjectGovernanceDecision decision =
                ProjectGovernanceDecision.create(
                        UUID.randomUUID(),
                        projectId,
                        request.meetingId(),
                        number,
                        request.title()
                                .trim(),
                        normalize(
                                request.description()),
                        request.decisionDate(),
                        normalize(
                                request.ownerName()),
                        request.dueDate(),
                        request.impactArea(),
                        normalize(
                                request.rationale()));

        return response(
                decisionRepository.save(
                        decision));
    }

    @Transactional
    public DecisionResponse updateDecision(
            UUID projectId,
            UUID decisionId,
            UpdateDecisionRequest request) {

        requireProject(
                projectId);

        validateMeeting(
                projectId,
                request.meetingId());

        validateNotFuture(
                request.decisionDate(),
                "Decision date");

        ProjectGovernanceDecision decision =
                requireDecision(
                        projectId,
                        decisionId);

        verifyVersion(
                decision.getVersion(),
                request.version(),
                "decision");

        validateDecisionTransition(
                decision.getStatus(),
                request.status());

        decision.update(
                request.meetingId(),
                request.title()
                        .trim(),
                normalize(
                        request.description()),
                request.decisionDate(),
                normalize(
                        request.ownerName()),
                request.dueDate(),
                request.impactArea(),
                normalize(
                        request.rationale()),
                request.status());

        return response(
                decisionRepository
                        .saveAndFlush(
                                decision));
    }

    @Transactional
    public ActionResponse createAction(
            UUID projectId,
            CreateActionRequest request) {

        requireProject(
                projectId);

        validateMeeting(
                projectId,
                request.meetingId());

        validateDecision(
                projectId,
                request.decisionId());

        String number =
                reference(
                        request.actionNumber());

        if (actionRepository
                .existsByProjectIdAndActionNumberIgnoreCase(
                        projectId,
                        number)) {

            throw new ConflictException(
                    "Action '%s' already exists."
                            .formatted(
                                    number));
        }

        ProjectGovernanceAction action =
                ProjectGovernanceAction.create(
                        UUID.randomUUID(),
                        projectId,
                        request.meetingId(),
                        request.decisionId(),
                        number,
                        request.title()
                                .trim(),
                        normalize(
                                request.description()),
                        normalize(
                                request.ownerName()),
                        request.priority(),
                        request.dueDate());

        return response(
                actionRepository.save(
                        action));
    }

    @Transactional
    public ActionResponse updateAction(
            UUID projectId,
            UUID actionId,
            UpdateActionRequest request) {

        requireProject(
                projectId);

        validateMeeting(
                projectId,
                request.meetingId());

        validateDecision(
                projectId,
                request.decisionId());

        ProjectGovernanceAction action =
                requireAction(
                        projectId,
                        actionId);

        verifyVersion(
                action.getVersion(),
                request.version(),
                "action");

        validateActionTransition(
                action.getStatus(),
                request.status());

        String blockerReason =
                normalize(
                        request.blockerReason());

        if (
                request.status()
                        == GovernanceActionStatus.BLOCKED
                && blockerReason == null) {

            throw new InvalidRequestException(
                    "A blocked action requires a blocker reason.");
        }

        action.update(
                request.meetingId(),
                request.decisionId(),
                request.title()
                        .trim(),
                normalize(
                        request.description()),
                normalize(
                        request.ownerName()),
                request.priority(),
                request.dueDate(),
                request.status(),
                blockerReason,
                Instant.now(
                        clock));

        return response(
                actionRepository
                        .saveAndFlush(
                                action));
    }

    @Transactional(readOnly = true)
    public ExecutiveReportResponse executiveReport(
            UUID projectId) {

        requireProject(
                projectId);

        return executiveReportService
                .generate(
                        projectId);
    }

    @Transactional
    public ExecutiveReportSnapshotResponse captureExecutiveReport(
            UUID projectId) {

        requireProject(
                projectId);

        LocalDate today =
                LocalDate.now(
                        clock);

        if (reportSnapshotRepository
                .existsByProjectIdAndReportDate(
                        projectId,
                        today)) {

            throw new ConflictException(
                    "An executive report snapshot already exists for today.");
        }

        ExecutiveReportResponse report =
                executiveReportService
                        .generate(
                                projectId);

        ProjectExecutiveReportSnapshot snapshot =
                ProjectExecutiveReportSnapshot.capture(
                        UUID.randomUUID(),
                        projectId,
                        report);

        return response(
                reportSnapshotRepository.save(
                        snapshot));
    }

    private List<ProjectGovernanceMeeting> meetings(
            UUID projectId) {

        return meetingRepository
                .findByProjectIdOrderByScheduledAtDescMeetingNumberAsc(
                        projectId);
    }

    private List<ProjectGovernanceDecision> decisions(
            UUID projectId) {

        return decisionRepository
                .findByProjectIdOrderByDecisionDateDescDecisionNumberAsc(
                        projectId);
    }

    private List<ProjectGovernanceAction> actions(
            UUID projectId) {

        return actionRepository
                .findByProjectIdOrderByDueDateAscActionNumberAsc(
                        projectId);
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

    private ProjectGovernanceMeeting requireMeeting(
            UUID projectId,
            UUID meetingId) {

        return meetingRepository
                .findByIdAndProjectId(
                        meetingId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Meeting '%s' was not found."
                                                .formatted(
                                                        meetingId)));
    }

    private ProjectGovernanceDecision requireDecision(
            UUID projectId,
            UUID decisionId) {

        return decisionRepository
                .findByIdAndProjectId(
                        decisionId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Decision '%s' was not found."
                                                .formatted(
                                                        decisionId)));
    }

    private ProjectGovernanceAction requireAction(
            UUID projectId,
            UUID actionId) {

        return actionRepository
                .findByIdAndProjectId(
                        actionId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Action '%s' was not found."
                                                .formatted(
                                                        actionId)));
    }

    private void validateMeeting(
            UUID projectId,
            UUID meetingId) {

        if (meetingId == null) {
            return;
        }

        requireMeeting(
                projectId,
                meetingId);
    }

    private void validateDecision(
            UUID projectId,
            UUID decisionId) {

        if (decisionId == null) {
            return;
        }

        requireDecision(
                projectId,
                decisionId);
    }

    private void validateNotFuture(
            LocalDate value,
            String label) {

        if (value.isAfter(
                LocalDate.now(
                        clock))) {

            throw new InvalidRequestException(
                    label
                            + " cannot be in the future.");
        }
    }

    private void verifyVersion(
            long current,
            long requested,
            String resource) {

        if (current != requested) {

            throw new ConflictException(
                    "The %s changed in another operation. Refresh before submitting."
                            .formatted(
                                    resource));
        }
    }

    private void validateDecisionTransition(
            GovernanceDecisionStatus current,
            GovernanceDecisionStatus target) {

        if (current == target) {
            return;
        }

        if (!DECISION_TRANSITIONS
                .getOrDefault(
                        current,
                        Set.of())
                .contains(
                        target)) {

            throw new InvalidRequestException(
                    "Decision status cannot transition from '%s' to '%s'."
                            .formatted(
                                    current,
                                    target));
        }
    }

    private void validateActionTransition(
            GovernanceActionStatus current,
            GovernanceActionStatus target) {

        if (current == target) {
            return;
        }

        if (!ACTION_TRANSITIONS
                .getOrDefault(
                        current,
                        Set.of())
                .contains(
                        target)) {

            throw new InvalidRequestException(
                    "Action status cannot transition from '%s' to '%s'."
                            .formatted(
                                    current,
                                    target));
        }
    }

    private MeetingResponse response(
            ProjectGovernanceMeeting meeting) {

        boolean missingMinutes =
                meeting.getStatus()
                                == GovernanceMeetingStatus.HELD
                        && (
                                meeting.getMinutes()
                                        == null
                                || meeting.getMinutes()
                                        .isBlank());

        return new MeetingResponse(
                meeting.getId(),
                meeting.getProjectId(),
                meeting.getMeetingNumber(),
                meeting.getTitle(),
                meeting.getMeetingType(),
                meeting.getScheduledAt(),
                meeting.getHeldAt(),
                meeting.getStatus(),
                meeting.getChairName(),
                meeting.getMinutes(),
                meeting.getNextMeetingAt(),
                missingMinutes,
                meeting.getVersion(),
                meeting.getCreatedAt(),
                meeting.getUpdatedAt());
    }

    private DecisionResponse response(
            ProjectGovernanceDecision decision) {

        boolean overdue =
                decision.getDueDate()
                                != null
                        && decision.getDueDate()
                                .isBefore(
                                        LocalDate.now(
                                                clock))
                        && decision.getStatus()
                                != GovernanceDecisionStatus.IMPLEMENTED
                        && decision.getStatus()
                                != GovernanceDecisionStatus.REJECTED
                        && decision.getStatus()
                                != GovernanceDecisionStatus.SUPERSEDED;

        return new DecisionResponse(
                decision.getId(),
                decision.getProjectId(),
                decision.getMeetingId(),
                decision.getDecisionNumber(),
                decision.getTitle(),
                decision.getDescription(),
                decision.getDecisionDate(),
                decision.getOwnerName(),
                decision.getDueDate(),
                decision.getImpactArea(),
                decision.getRationale(),
                decision.getStatus(),
                overdue,
                decision.getVersion(),
                decision.getCreatedAt(),
                decision.getUpdatedAt());
    }

    private ActionResponse response(
            ProjectGovernanceAction action) {

        boolean overdue =
                action.getStatus()
                                != GovernanceActionStatus.DONE
                        && action.getStatus()
                                != GovernanceActionStatus.VOID
                        && action.getDueDate()
                                .isBefore(
                                        LocalDate.now(
                                                clock));

        return new ActionResponse(
                action.getId(),
                action.getProjectId(),
                action.getMeetingId(),
                action.getDecisionId(),
                action.getActionNumber(),
                action.getTitle(),
                action.getDescription(),
                action.getOwnerName(),
                action.getPriority(),
                action.getDueDate(),
                action.getStatus(),
                action.getBlockerReason(),
                action.getCompletedAt(),
                overdue,
                action.getVersion(),
                action.getCreatedAt(),
                action.getUpdatedAt());
    }

    private ExecutiveReportSnapshotResponse response(
            ProjectExecutiveReportSnapshot snapshot) {

        return new ExecutiveReportSnapshotResponse(
                snapshot.getId(),
                snapshot.getProjectId(),
                snapshot.getReportDate(),
                snapshot.getPhysicalProgressPercentage(),
                snapshot.getScheduleScore(),
                snapshot.getScheduleRisk(),
                snapshot.getPredictiveScore(),
                snapshot.getPredictiveRisk(),
                snapshot.getGovernanceScore(),
                snapshot.getGovernanceRisk(),
                snapshot.getCpi(),
                snapshot.getSpi(),
                snapshot.getExpectedForecastCost(),
                snapshot.getExpectedForecastFinishDate(),
                snapshot.getOpenActions(),
                snapshot.getOverdueActions(),
                snapshot.getBlockedActions(),
                snapshot.getPendingDecisions(),
                snapshot.getOverdueDecisions(),
                snapshot.getMeetingsWithoutMinutes(),
                snapshot.getExecutiveSummary(),
                snapshot.getAttentionItems(),
                snapshot.getCreatedAt());
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

    private static Map<
            GovernanceDecisionStatus,
            Set<GovernanceDecisionStatus>>
    decisionTransitions() {

        Map<
                GovernanceDecisionStatus,
                Set<GovernanceDecisionStatus>>
                result =
                new EnumMap<>(
                        GovernanceDecisionStatus.class);

        result.put(
                GovernanceDecisionStatus.PROPOSED,
                Set.of(
                        GovernanceDecisionStatus.APPROVED,
                        GovernanceDecisionStatus.REJECTED,
                        GovernanceDecisionStatus.SUPERSEDED));

        result.put(
                GovernanceDecisionStatus.APPROVED,
                Set.of(
                        GovernanceDecisionStatus.IMPLEMENTED,
                        GovernanceDecisionStatus.SUPERSEDED));

        result.put(
                GovernanceDecisionStatus.REJECTED,
                Set.of());

        result.put(
                GovernanceDecisionStatus.IMPLEMENTED,
                Set.of());

        result.put(
                GovernanceDecisionStatus.SUPERSEDED,
                Set.of());

        return Map.copyOf(
                result);
    }

    private static Map<
            GovernanceActionStatus,
            Set<GovernanceActionStatus>>
    actionTransitions() {

        Map<
                GovernanceActionStatus,
                Set<GovernanceActionStatus>>
                result =
                new EnumMap<>(
                        GovernanceActionStatus.class);

        result.put(
                GovernanceActionStatus.OPEN,
                Set.of(
                        GovernanceActionStatus.IN_PROGRESS,
                        GovernanceActionStatus.BLOCKED,
                        GovernanceActionStatus.DONE,
                        GovernanceActionStatus.VOID));

        result.put(
                GovernanceActionStatus.IN_PROGRESS,
                Set.of(
                        GovernanceActionStatus.BLOCKED,
                        GovernanceActionStatus.DONE,
                        GovernanceActionStatus.VOID));

        result.put(
                GovernanceActionStatus.BLOCKED,
                Set.of(
                        GovernanceActionStatus.IN_PROGRESS,
                        GovernanceActionStatus.DONE,
                        GovernanceActionStatus.VOID));

        result.put(
                GovernanceActionStatus.DONE,
                Set.of());

        result.put(
                GovernanceActionStatus.VOID,
                Set.of());

        return Map.copyOf(
                result);
    }
}
