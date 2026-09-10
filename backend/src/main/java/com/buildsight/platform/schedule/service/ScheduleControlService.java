package com.buildsight.platform.schedule.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;
import com.buildsight.platform.schedule.api.ScheduleModels.CaptureBaselineRequest;
import com.buildsight.platform.schedule.api.ScheduleModels.CreateDependencyRequest;
import com.buildsight.platform.schedule.api.ScheduleModels.CreateScheduleActivityRequest;
import com.buildsight.platform.schedule.api.ScheduleModels.CreateScheduleConstraintRequest;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleActivityResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleBaselineResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleConstraintResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleControlResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleDependencyResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleIntelligenceResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleLookaheadActivityResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleLookaheadResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.UpdateScheduleActivityRequest;
import com.buildsight.platform.schedule.api.ScheduleModels.UpdateScheduleConstraintRequest;
import com.buildsight.platform.schedule.domain.ProjectScheduleActivity;
import com.buildsight.platform.schedule.domain.ProjectScheduleBaseline;
import com.buildsight.platform.schedule.domain.ProjectScheduleBaselineActivity;
import com.buildsight.platform.schedule.domain.ProjectScheduleConstraint;
import com.buildsight.platform.schedule.domain.ProjectScheduleDependency;
import com.buildsight.platform.schedule.domain.ScheduleActivityStatus;
import com.buildsight.platform.schedule.domain.ScheduleBaselineStatus;
import com.buildsight.platform.schedule.domain.ScheduleConstraintStatus;
import com.buildsight.platform.schedule.repository.ProjectScheduleActivityRepository;
import com.buildsight.platform.schedule.repository.ProjectScheduleBaselineActivityRepository;
import com.buildsight.platform.schedule.repository.ProjectScheduleBaselineRepository;
import com.buildsight.platform.schedule.repository.ProjectScheduleConstraintRepository;
import com.buildsight.platform.schedule.repository.ProjectScheduleDependencyRepository;
import com.buildsight.platform.schedule.service.ScheduleNetworkCalculator.ScheduleActivityNetworkMetric;
import com.buildsight.platform.schedule.service.ScheduleNetworkCalculator.ScheduleNetworkResult;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ScheduleControlService {

    private static final Map<
            ScheduleActivityStatus,
            Set<ScheduleActivityStatus>>
            ACTIVITY_TRANSITIONS =
            activityTransitions();

    private final ProjectRepository
            projectRepository;

    private final ProjectScheduleBaselineRepository
            baselineRepository;

    private final ProjectScheduleBaselineActivityRepository
            baselineActivityRepository;

    private final ProjectScheduleActivityRepository
            activityRepository;

    private final ProjectScheduleDependencyRepository
            dependencyRepository;

    private final ProjectScheduleConstraintRepository
            constraintRepository;

    private final ScheduleNetworkCalculator
            networkCalculator;

    private final ScheduleIntelligenceService
            intelligenceService;

    private final ProjectMapper
            projectMapper;

    private final NamedParameterJdbcTemplate
            jdbcTemplate;

    private final Clock
            clock;

    public ScheduleControlService(
            ProjectRepository projectRepository,
            ProjectScheduleBaselineRepository baselineRepository,
            ProjectScheduleBaselineActivityRepository baselineActivityRepository,
            ProjectScheduleActivityRepository activityRepository,
            ProjectScheduleDependencyRepository dependencyRepository,
            ProjectScheduleConstraintRepository constraintRepository,
            ScheduleNetworkCalculator networkCalculator,
            ScheduleIntelligenceService intelligenceService,
            ProjectMapper projectMapper,
            NamedParameterJdbcTemplate jdbcTemplate,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.baselineRepository =
                baselineRepository;

        this.baselineActivityRepository =
                baselineActivityRepository;

        this.activityRepository =
                activityRepository;

        this.dependencyRepository =
                dependencyRepository;

        this.constraintRepository =
                constraintRepository;

        this.networkCalculator =
                networkCalculator;

        this.intelligenceService =
                intelligenceService;

        this.projectMapper =
                projectMapper;

        this.jdbcTemplate =
                jdbcTemplate;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public ScheduleControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        ScheduleState state =
                state(
                        projectId);

        ScheduleNetworkResult network =
                networkCalculator.calculate(
                        state.activities(),
                        state.dependencies(),
                        LocalDate.now(clock));

        Map<UUID, ProjectScheduleActivity> activityMap =
                state.activities()
                        .stream()
                        .collect(
                                Collectors.toMap(
                                        ProjectScheduleActivity::getId,
                                        activity ->
                                                activity));

        ScheduleIntelligenceResponse intelligence =
                intelligenceService.calculate(
                        project,
                        state.approvedBaseline(),
                        state.baselineActivities(),
                        state.activities(),
                        state.dependencies(),
                        state.constraints());

        return new ScheduleControlResponse(
                projectMapper.toResponse(
                        project),

                intelligence,

                state.baselines()
                        .stream()
                        .map(
                                baseline ->
                                        toBaselineResponse(
                                                baseline,
                                                baselineActivityRepository
                                                        .findByBaselineIdOrderByPlannedStartAscActivityCodeAsc(
                                                                baseline.getId())))
                        .toList(),

                state.activities()
                        .stream()
                        .map(
                                activity ->
                                        toActivityResponse(
                                                activity,
                                                network.metrics()
                                                        .get(
                                                                activity.getId())))
                        .toList(),

                state.dependencies()
                        .stream()
                        .map(
                                dependency ->
                                        toDependencyResponse(
                                                dependency,
                                                activityMap))
                        .toList(),

                state.constraints()
                        .stream()
                        .map(
                                constraint ->
                                        toConstraintResponse(
                                                constraint,
                                                activityMap.get(
                                                        constraint.getActivityId())))
                        .toList());
    }

    @Transactional(readOnly = true)
    public ScheduleIntelligenceResponse intelligence(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        ScheduleState state =
                state(
                        projectId);

        return intelligenceService.calculate(
                project,
                state.approvedBaseline(),
                state.baselineActivities(),
                state.activities(),
                state.dependencies(),
                state.constraints());
    }

    @Transactional(readOnly = true)
    public ScheduleLookaheadResponse lookahead(
            UUID projectId,
            int weeks) {

        requireProject(
                projectId);

        if (weeks != 2
                && weeks != 4
                && weeks != 6) {

            throw new InvalidRequestException(
                    "Lookahead weeks must be 2, 4 or 6.");
        }

        LocalDate today =
                LocalDate.now(
                        clock);

        LocalDate end =
                today.plusWeeks(
                        weeks);

        List<ProjectScheduleActivity> activities =
                activityRepository
                        .findByProjectIdOrderByCurrentStartAscActivityCodeAsc(
                                projectId);

        List<ProjectScheduleDependency> dependencies =
                dependencyRepository
                        .findByProjectIdOrderByCreatedAtAsc(
                                projectId);

        List<ProjectScheduleConstraint> constraints =
                constraintRepository
                        .findByProjectIdOrderByDueDateAscCreatedAtAsc(
                                projectId);

        ScheduleNetworkResult network =
                networkCalculator.calculate(
                        activities,
                        dependencies,
                        today);

        Map<UUID, Long> openConstraintCounts =
                constraints.stream()
                        .filter(
                                constraint ->
                                        constraint.getStatus()
                                                == ScheduleConstraintStatus.OPEN)
                        .collect(
                                Collectors.groupingBy(
                                        ProjectScheduleConstraint::getActivityId,
                                        Collectors.counting()));

        List<ScheduleLookaheadActivityResponse> responses =
                activities.stream()
                        .filter(
                                activity ->
                                        activity.getStatus()
                                                != ScheduleActivityStatus.COMPLETED)
                        .filter(
                                activity ->
                                        !activity.getCurrentStart()
                                                .isBefore(today))
                        .filter(
                                activity ->
                                        !activity.getCurrentStart()
                                                .isAfter(end))
                        .map(
                                activity -> {

                                    ScheduleActivityNetworkMetric metric =
                                            network.metrics()
                                                    .get(
                                                            activity.getId());

                                    long constraintCount =
                                            openConstraintCounts
                                                    .getOrDefault(
                                                            activity.getId(),
                                                            0L);

                                    return new ScheduleLookaheadActivityResponse(
                                            activity.getId(),
                                            activity.getActivityCode(),
                                            activity.getName(),
                                            activity.getDiscipline(),
                                            activity.getCurrentStart(),
                                            activity.getCurrentFinish(),
                                            activity.getProgressPercentage(),
                                            metric == null
                                                    ? 0
                                                    : metric.totalFloatDays(),
                                            metric != null
                                                    && metric.critical(),
                                            metric != null
                                                    && metric.nearCritical(),
                                            constraintCount,
                                            constraintCount > 0);
                                })
                        .toList();

        long critical =
                responses.stream()
                        .filter(
                                ScheduleLookaheadActivityResponse::critical)
                        .count();

        long constrained =
                responses.stream()
                        .filter(
                                ScheduleLookaheadActivityResponse::constrained)
                        .count();

        return new ScheduleLookaheadResponse(
                weeks,
                today,
                end,
                responses.size(),
                critical,
                constrained,
                responses);
    }

    @Transactional
    public ScheduleActivityResponse createActivity(
            UUID projectId,
            CreateScheduleActivityRequest request) {

        requireProject(
                projectId);

        validatePeriod(
                request.currentStart(),
                request.currentFinish());

        validateWorkPackage(
                projectId,
                request.workPackageId());

        String code =
                reference(
                        request.activityCode());

        if (activityRepository
                .existsByProjectIdAndActivityCodeIgnoreCase(
                        projectId,
                        code)) {

            throw new ConflictException(
                    "Schedule activity '%s' already exists."
                            .formatted(code));
        }

        int duration =
                request.originalDurationDays();

        if (duration == 0) {

            duration =
                    Math.max(
                            1,
                            (int) ChronoUnit.DAYS.between(
                                    request.currentStart(),
                                    request.currentFinish())
                                    + 1);
        }

        ProjectScheduleActivity activity =
                ProjectScheduleActivity.create(
                        UUID.randomUUID(),
                        projectId,
                        code,
                        request.name().trim(),
                        normalize(
                                request.discipline()),
                        request.workPackageId(),
                        request.currentStart(),
                        request.currentFinish(),
                        duration);

        ProjectScheduleActivity saved =
                activityRepository.save(
                        activity);

        return toActivityResponse(
                saved,
                null);
    }

    @Transactional
    public ScheduleActivityResponse updateActivity(
            UUID projectId,
            UUID activityId,
            UpdateScheduleActivityRequest request) {

        requireProject(
                projectId);

        ProjectScheduleActivity activity =
                requireActivity(
                        projectId,
                        activityId);

        verifyVersion(
                activity.getVersion(),
                request.version(),
                "schedule activity");

        validateTransition(
                activity.getStatus(),
                request.status());

        validatePeriod(
                request.currentStart(),
                request.currentFinish());

        validateWorkPackage(
                projectId,
                request.workPackageId());

        LocalDate actualStart =
                request.actualStart();

        LocalDate actualFinish =
                request.actualFinish();

        BigDecimal progress =
                request.progressPercentage();

        if (actualStart != null) {

            validateNotFuture(
                    actualStart,
                    "Actual start");
        }

        if (actualFinish != null) {

            validateNotFuture(
                    actualFinish,
                    "Actual finish");
        }

        if (actualStart != null
                && actualFinish != null
                && actualFinish.isBefore(
                        actualStart)) {

            throw new InvalidRequestException(
                    "Actual finish cannot be before actual start.");
        }

        if (request.status()
                == ScheduleActivityStatus.NOT_STARTED) {

            if (progress.signum() != 0) {

                throw new InvalidRequestException(
                        "A NOT_STARTED activity must have 0% progress.");
            }

            actualStart =
                    null;

            actualFinish =
                    null;
        }

        if (request.status()
                == ScheduleActivityStatus.IN_PROGRESS
                && actualStart == null) {

            actualStart =
                    LocalDate.now(
                            clock);
        }

        if (request.status()
                == ScheduleActivityStatus.COMPLETED) {

            progress =
                    new BigDecimal(
                            "100.00");

            if (actualStart == null) {

                actualStart =
                        LocalDate.now(
                                clock);
            }

            if (actualFinish == null) {

                actualFinish =
                        LocalDate.now(
                                clock);
            }
        }

        int remaining =
                request.status()
                                == ScheduleActivityStatus.COMPLETED
                        ? 0
                        : request.remainingDurationDays();

        activity.update(
                request.name().trim(),
                normalize(
                        request.discipline()),
                request.workPackageId(),
                request.currentStart(),
                request.currentFinish(),
                request.originalDurationDays(),
                remaining,
                actualStart,
                actualFinish,
                progress,
                request.status());

        ProjectScheduleActivity saved =
                activityRepository
                        .saveAndFlush(
                                activity);

        ScheduleNetworkResult network =
                currentNetwork(
                        projectId);

        return toActivityResponse(
                saved,
                network.metrics()
                        .get(
                                saved.getId()));
    }

    @Transactional
    public ScheduleDependencyResponse createDependency(
            UUID projectId,
            CreateDependencyRequest request) {

        requireProject(
                projectId);

        if (request.predecessorActivityId()
                .equals(
                        request.successorActivityId())) {

            throw new InvalidRequestException(
                    "An activity cannot depend on itself.");
        }

        ProjectScheduleActivity predecessor =
                requireActivity(
                        projectId,
                        request.predecessorActivityId());

        ProjectScheduleActivity successor =
                requireActivity(
                        projectId,
                        request.successorActivityId());

        if (dependencyRepository
                .existsByProjectIdAndPredecessorActivityIdAndSuccessorActivityIdAndDependencyType(
                        projectId,
                        predecessor.getId(),
                        successor.getId(),
                        request.dependencyType())) {

            throw new ConflictException(
                    "This schedule dependency already exists.");
        }

        ProjectScheduleDependency candidate =
                ProjectScheduleDependency.create(
                        UUID.randomUUID(),
                        projectId,
                        predecessor.getId(),
                        successor.getId(),
                        request.dependencyType(),
                        request.lagDays());

        List<ProjectScheduleActivity> activities =
                activityRepository
                        .findByProjectIdOrderByCurrentStartAscActivityCodeAsc(
                                projectId);

        List<ProjectScheduleDependency> dependencies =
                new java.util.ArrayList<>(
                        dependencyRepository
                                .findByProjectIdOrderByCreatedAtAsc(
                                        projectId));

        dependencies.add(
                candidate);

        ScheduleNetworkResult validation =
                networkCalculator.calculate(
                        activities,
                        dependencies,
                        LocalDate.now(
                                clock));

        if (!validation.valid()) {

            throw new InvalidRequestException(
                    "Dependency rejected because it creates circular schedule logic.");
        }

        ProjectScheduleDependency saved =
                dependencyRepository.save(
                        candidate);

        return new ScheduleDependencyResponse(
                saved.getId(),
                saved.getProjectId(),
                predecessor.getId(),
                predecessor.getActivityCode(),
                successor.getId(),
                successor.getActivityCode(),
                saved.getDependencyType(),
                saved.getLagDays(),
                saved.getCreatedAt());
    }

    @Transactional
    public void deleteDependency(
            UUID projectId,
            UUID dependencyId) {

        requireProject(
                projectId);

        ProjectScheduleDependency dependency =
                dependencyRepository
                        .findByIdAndProjectId(
                                dependencyId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Schedule dependency '%s' was not found."
                                                        .formatted(
                                                                dependencyId)));

        dependencyRepository.delete(
                dependency);
    }

    @Transactional
    public ScheduleConstraintResponse createConstraint(
            UUID projectId,
            CreateScheduleConstraintRequest request) {

        requireProject(
                projectId);

        ProjectScheduleActivity activity =
                requireActivity(
                        projectId,
                        request.activityId());

        ProjectScheduleConstraint constraint =
                ProjectScheduleConstraint.create(
                        UUID.randomUUID(),
                        projectId,
                        activity.getId(),
                        request.constraintType(),
                        request.title().trim(),
                        normalize(
                                request.ownerName()),
                        request.dueDate());

        return toConstraintResponse(
                constraintRepository.save(
                        constraint),
                activity);
    }

    @Transactional
    public ScheduleConstraintResponse updateConstraint(
            UUID projectId,
            UUID constraintId,
            UpdateScheduleConstraintRequest request) {

        requireProject(
                projectId);

        ProjectScheduleConstraint constraint =
                constraintRepository
                        .findByIdAndProjectId(
                                constraintId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Schedule constraint '%s' was not found."
                                                        .formatted(
                                                                constraintId)));

        verifyVersion(
                constraint.getVersion(),
                request.version(),
                "schedule constraint");

        String resolutionNotes =
                normalize(
                        request.resolutionNotes());

        if (request.status()
                        == ScheduleConstraintStatus.RESOLVED
                && resolutionNotes == null) {

            throw new InvalidRequestException(
                    "A resolved schedule constraint requires resolution notes.");
        }

        constraint.update(
                request.constraintType(),
                request.title().trim(),
                normalize(
                        request.ownerName()),
                request.dueDate(),
                request.status(),
                resolutionNotes,
                LocalDate.now(
                        clock));

        ProjectScheduleActivity activity =
                requireActivity(
                        projectId,
                        constraint.getActivityId());

        return toConstraintResponse(
                constraintRepository
                        .saveAndFlush(
                                constraint),
                activity);
    }

    @Transactional
    public ScheduleBaselineResponse captureBaseline(
            UUID projectId,
            CaptureBaselineRequest request) {

        requireProject(
                projectId);

        if (baselineRepository
                .existsByProjectIdAndNameIgnoreCase(
                        projectId,
                        request.name().trim())) {

            throw new ConflictException(
                    "Schedule baseline '%s' already exists."
                            .formatted(
                                    request.name().trim()));
        }

        List<ProjectScheduleActivity> activities =
                activityRepository
                        .findByProjectIdOrderByCurrentStartAscActivityCodeAsc(
                                projectId);

        if (activities.isEmpty()) {

            throw new InvalidRequestException(
                    "At least one schedule activity is required before capturing a baseline.");
        }

        List<ProjectScheduleDependency> dependencies =
                dependencyRepository
                        .findByProjectIdOrderByCreatedAtAsc(
                                projectId);

        ScheduleNetworkResult network =
                networkCalculator.calculate(
                        activities,
                        dependencies,
                        request.dataDate());

        if (!network.valid()) {

            throw new InvalidRequestException(
                    "A baseline cannot be captured while the activity network contains a dependency cycle.");
        }

        ProjectScheduleBaseline baseline =
                ProjectScheduleBaseline.create(
                        UUID.randomUUID(),
                        projectId,
                        request.name().trim(),
                        request.dataDate());

        ProjectScheduleBaseline saved =
                baselineRepository.save(
                        baseline);

        List<ProjectScheduleBaselineActivity> snapshots =
                activities.stream()
                        .map(
                                activity -> {

                                    ScheduleActivityNetworkMetric metric =
                                            network.metrics()
                                                    .get(
                                                            activity.getId());

                                    return ProjectScheduleBaselineActivity.create(
                                            UUID.randomUUID(),
                                            saved.getId(),
                                            activity.getActivityCode(),
                                            activity.getName(),
                                            activity.getCurrentStart(),
                                            activity.getCurrentFinish(),
                                            activity.getOriginalDurationDays(),
                                            metric != null
                                                    && metric.critical());
                                })
                        .toList();

        baselineActivityRepository.saveAll(
                snapshots);

        return toBaselineResponse(
                saved,
                snapshots);
    }

    @Transactional
    public ScheduleBaselineResponse approveBaseline(
            UUID projectId,
            UUID baselineId) {

        requireProject(
                projectId);

        ProjectScheduleBaseline baseline =
                baselineRepository
                        .findByIdAndProjectId(
                                baselineId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Schedule baseline '%s' was not found."
                                                        .formatted(
                                                                baselineId)));

        if (baseline.getStatus()
                != ScheduleBaselineStatus.DRAFT) {

            throw new InvalidRequestException(
                    "Only a DRAFT schedule baseline may be approved.");
        }

        Optional<ProjectScheduleBaseline> currentApproved =
                baselineRepository
                        .findFirstByProjectIdAndStatusOrderByCreatedAtDesc(
                                projectId,
                                ScheduleBaselineStatus.APPROVED);

        currentApproved
                .filter(
                        current ->
                                !current.getId()
                                        .equals(
                                                baseline.getId()))
                .ifPresent(
                        current -> {

                            current.supersede();

                            baselineRepository.save(
                                    current);
                        });

        baseline.approve();

        ProjectScheduleBaseline saved =
                baselineRepository
                        .saveAndFlush(
                                baseline);

        return toBaselineResponse(
                saved,
                baselineActivityRepository
                        .findByBaselineIdOrderByPlannedStartAscActivityCodeAsc(
                                saved.getId()));
    }

    private ScheduleState state(
            UUID projectId) {

        List<ProjectScheduleBaseline> baselines =
                baselineRepository
                        .findByProjectIdOrderByCreatedAtDesc(
                                projectId);

        Optional<ProjectScheduleBaseline> approvedBaseline =
                baselines.stream()
                        .filter(
                                baseline ->
                                        baseline.getStatus()
                                                == ScheduleBaselineStatus.APPROVED)
                        .findFirst();

        List<ProjectScheduleBaselineActivity> baselineActivities =
                approvedBaseline
                        .map(
                                baseline ->
                                        baselineActivityRepository
                                                .findByBaselineIdOrderByPlannedStartAscActivityCodeAsc(
                                                        baseline.getId()))
                        .orElseGet(
                                List::of);

        return new ScheduleState(
                baselines,
                approvedBaseline,
                baselineActivities,
                activityRepository
                        .findByProjectIdOrderByCurrentStartAscActivityCodeAsc(
                                projectId),
                dependencyRepository
                        .findByProjectIdOrderByCreatedAtAsc(
                                projectId),
                constraintRepository
                        .findByProjectIdOrderByDueDateAscCreatedAtAsc(
                                projectId));
    }

    private ScheduleNetworkResult currentNetwork(
            UUID projectId) {

        return networkCalculator.calculate(
                activityRepository
                        .findByProjectIdOrderByCurrentStartAscActivityCodeAsc(
                                projectId),
                dependencyRepository
                        .findByProjectIdOrderByCreatedAtAsc(
                                projectId),
                LocalDate.now(
                        clock));
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

    private ProjectScheduleActivity requireActivity(
            UUID projectId,
            UUID activityId) {

        return activityRepository
                .findByIdAndProjectId(
                        activityId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Schedule activity '%s' was not found."
                                                .formatted(
                                                        activityId)));
    }

    private void validateWorkPackage(
            UUID projectId,
            UUID workPackageId) {

        if (workPackageId == null) {
            return;
        }

        Long count =
                jdbcTemplate.queryForObject(
                        """
                        SELECT COUNT(*)
                        FROM project_work_packages
                        WHERE id = :id
                          AND project_id = :projectId
                        """,

                        new MapSqlParameterSource()
                                .addValue(
                                        "id",
                                        workPackageId)
                                .addValue(
                                        "projectId",
                                        projectId),

                        Long.class);

        if (count == null
                || count == 0) {

            throw new ResourceNotFoundException(
                    "Work package '%s' was not found in this project."
                            .formatted(
                                    workPackageId));
        }
    }

    private void validatePeriod(
            LocalDate start,
            LocalDate finish) {

        if (finish.isBefore(start)) {

            throw new InvalidRequestException(
                    "Activity finish cannot be before activity start.");
        }
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
                    "The %s was changed by another operation. Refresh before submitting your change."
                            .formatted(
                                    resource));
        }
    }

    private void validateTransition(
            ScheduleActivityStatus current,
            ScheduleActivityStatus target) {

        if (current == target) {
            return;
        }

        if (!ACTIVITY_TRANSITIONS
                .getOrDefault(
                        current,
                        Set.of())
                .contains(
                        target)) {

            throw new InvalidRequestException(
                    "Schedule activity status cannot transition from '%s' to '%s'."
                            .formatted(
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

    private ScheduleActivityResponse toActivityResponse(
            ProjectScheduleActivity activity,
            ScheduleActivityNetworkMetric metric) {

        boolean overdue =
                activity.getStatus()
                                != ScheduleActivityStatus.COMPLETED
                        && activity.getCurrentFinish()
                                .isBefore(
                                        LocalDate.now(
                                                clock));

        return new ScheduleActivityResponse(
                activity.getId(),
                activity.getProjectId(),
                activity.getActivityCode(),
                activity.getName(),
                activity.getDiscipline(),
                activity.getWorkPackageId(),
                activity.getCurrentStart(),
                activity.getCurrentFinish(),
                activity.getOriginalDurationDays(),
                activity.getRemainingDurationDays(),
                activity.getActualStart(),
                activity.getActualFinish(),
                activity.getProgressPercentage(),
                activity.getStatus(),
                metric == null
                        ? 0
                        : metric.earlyStartDay(),
                metric == null
                        ? 0
                        : metric.earlyFinishDay(),
                metric == null
                        ? 0
                        : metric.lateStartDay(),
                metric == null
                        ? 0
                        : metric.lateFinishDay(),
                metric == null
                        ? 0
                        : metric.totalFloatDays(),
                metric != null
                        && metric.critical(),
                metric != null
                        && metric.nearCritical(),
                overdue,
                activity.getVersion(),
                activity.getCreatedAt(),
                activity.getUpdatedAt());
    }

    private ScheduleDependencyResponse toDependencyResponse(
            ProjectScheduleDependency dependency,
            Map<UUID, ProjectScheduleActivity> activityMap) {

        ProjectScheduleActivity predecessor =
                activityMap.get(
                        dependency.getPredecessorActivityId());

        ProjectScheduleActivity successor =
                activityMap.get(
                        dependency.getSuccessorActivityId());

        return new ScheduleDependencyResponse(
                dependency.getId(),
                dependency.getProjectId(),
                dependency.getPredecessorActivityId(),
                predecessor == null
                        ? "UNKNOWN"
                        : predecessor.getActivityCode(),
                dependency.getSuccessorActivityId(),
                successor == null
                        ? "UNKNOWN"
                        : successor.getActivityCode(),
                dependency.getDependencyType(),
                dependency.getLagDays(),
                dependency.getCreatedAt());
    }

    private ScheduleConstraintResponse toConstraintResponse(
            ProjectScheduleConstraint constraint,
            ProjectScheduleActivity activity) {

        boolean overdue =
                constraint.getStatus()
                                == ScheduleConstraintStatus.OPEN
                        && constraint.getDueDate()
                                .isBefore(
                                        LocalDate.now(
                                                clock));

        return new ScheduleConstraintResponse(
                constraint.getId(),
                constraint.getProjectId(),
                constraint.getActivityId(),
                activity == null
                        ? "UNKNOWN"
                        : activity.getActivityCode(),
                constraint.getConstraintType(),
                constraint.getTitle(),
                constraint.getOwnerName(),
                constraint.getDueDate(),
                constraint.getStatus(),
                constraint.getResolutionNotes(),
                constraint.getResolvedDate(),
                overdue,
                constraint.getVersion(),
                constraint.getCreatedAt(),
                constraint.getUpdatedAt());
    }

    private ScheduleBaselineResponse toBaselineResponse(
            ProjectScheduleBaseline baseline,
            List<ProjectScheduleBaselineActivity> activities) {

        LocalDate finish =
                activities.stream()
                        .map(
                                ProjectScheduleBaselineActivity::getPlannedFinish)
                        .max(
                                LocalDate::compareTo)
                        .orElse(null);

        return new ScheduleBaselineResponse(
                baseline.getId(),
                baseline.getProjectId(),
                baseline.getName(),
                baseline.getDataDate(),
                baseline.getStatus(),
                baseline.getApprovedAt(),
                activities.size(),
                finish,
                baseline.getVersion(),
                baseline.getCreatedAt(),
                baseline.getUpdatedAt());
    }

    private static Map<
            ScheduleActivityStatus,
            Set<ScheduleActivityStatus>>
    activityTransitions() {

        Map<
                ScheduleActivityStatus,
                Set<ScheduleActivityStatus>>
                map =
                new EnumMap<>(
                        ScheduleActivityStatus.class);

        map.put(
                ScheduleActivityStatus.NOT_STARTED,
                Set.of(
                        ScheduleActivityStatus.IN_PROGRESS,
                        ScheduleActivityStatus.ON_HOLD,
                        ScheduleActivityStatus.COMPLETED));

        map.put(
                ScheduleActivityStatus.IN_PROGRESS,
                Set.of(
                        ScheduleActivityStatus.ON_HOLD,
                        ScheduleActivityStatus.COMPLETED));

        map.put(
                ScheduleActivityStatus.ON_HOLD,
                Set.of(
                        ScheduleActivityStatus.IN_PROGRESS,
                        ScheduleActivityStatus.COMPLETED));

        map.put(
                ScheduleActivityStatus.COMPLETED,
                Set.of());

        return Map.copyOf(
                map);
    }

    private record ScheduleState(
            List<ProjectScheduleBaseline> baselines,
            Optional<ProjectScheduleBaseline> approvedBaseline,
            List<ProjectScheduleBaselineActivity> baselineActivities,
            List<ProjectScheduleActivity> activities,
            List<ProjectScheduleDependency> dependencies,
            List<ProjectScheduleConstraint> constraints) {
    }
}
