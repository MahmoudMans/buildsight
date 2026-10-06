package com.buildsight.platform.periodcontrol.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.forecast.service.ForecastControlService;
import com.buildsight.platform.governance.api.GovernanceModels.GovernanceIntelligenceResponse;
import com.buildsight.platform.governance.service.GovernanceControlService;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.CaptureBaselineRequest;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.ControlBaselineResponse;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.CreateProgressPeriodRequest;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PeriodControlIntelligenceResponse;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PeriodControlResponse;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PeriodEndReadinessResponse;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PeriodEndSnapshotResponse;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.ProgressPeriodResponse;
import com.buildsight.platform.periodcontrol.domain.ControlBaselineStatus;
import com.buildsight.platform.periodcontrol.domain.ProgressPeriodStatus;
import com.buildsight.platform.periodcontrol.domain.ProjectControlBaselineVersion;
import com.buildsight.platform.periodcontrol.domain.ProjectPeriodEndSnapshot;
import com.buildsight.platform.periodcontrol.domain.ProjectProgressPeriod;
import com.buildsight.platform.periodcontrol.repository.ProjectControlBaselineVersionRepository;
import com.buildsight.platform.periodcontrol.repository.ProjectPeriodEndSnapshotRepository;
import com.buildsight.platform.periodcontrol.repository.ProjectProgressPeriodRepository;
import com.buildsight.platform.periodcontrol.service.PeriodControlCalculator.ControlEvaluation;
import com.buildsight.platform.periodcontrol.service.PeriodControlCalculator.ControlInput;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;
import com.buildsight.platform.recovery.api.RecoveryModels.ChangeImpactIntelligenceResponse;
import com.buildsight.platform.recovery.service.ChangeImpactControlService;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PeriodControlService {

    private final ProjectRepository
            projectRepository;

    private final ProjectControlBaselineVersionRepository
            baselineRepository;

    private final ProjectProgressPeriodRepository
            periodRepository;

    private final ProjectPeriodEndSnapshotRepository
            snapshotRepository;

    private final ForecastControlService
            forecastControlService;

    private final GovernanceControlService
            governanceControlService;

    private final ChangeImpactControlService
            changeImpactControlService;

    private final PeriodControlCalculator
            calculator;

    private final ProjectMapper
            projectMapper;

    private final Clock
            clock;

    public PeriodControlService(
            ProjectRepository projectRepository,
            ProjectControlBaselineVersionRepository baselineRepository,
            ProjectProgressPeriodRepository periodRepository,
            ProjectPeriodEndSnapshotRepository snapshotRepository,
            ForecastControlService forecastControlService,
            GovernanceControlService governanceControlService,
            ChangeImpactControlService changeImpactControlService,
            PeriodControlCalculator calculator,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.baselineRepository =
                baselineRepository;

        this.periodRepository =
                periodRepository;

        this.snapshotRepository =
                snapshotRepository;

        this.forecastControlService =
                forecastControlService;

        this.governanceControlService =
                governanceControlService;

        this.changeImpactControlService =
                changeImpactControlService;

        this.calculator =
                calculator;

        this.projectMapper =
                projectMapper;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public PeriodControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        ForecastIntelligenceResponse forecast =
                forecastControlService
                        .intelligence(
                                projectId);

        List<ProjectControlBaselineVersion> baselines =
                baselineRepository
                        .findByProjectIdOrderByCreatedAtDescVersionCodeAsc(
                                projectId);

        List<ProjectProgressPeriod> periods =
                periodRepository
                        .findByProjectIdOrderByEndDateDescPeriodCodeDesc(
                                projectId);

        Optional<ProjectProgressPeriod> openPeriod =
                periods.stream()
                        .filter(
                                period ->
                                        period.getStatus()
                                                == ProgressPeriodStatus.OPEN)
                        .findFirst();

        return new PeriodControlResponse(
                projectMapper.toResponse(
                        project),

                forecast,

                intelligence(
                        projectId,
                        forecast),

                baselines.stream()
                        .map(
                                this::response)
                        .toList(),

                periods.stream()
                        .map(
                                this::response)
                        .toList(),

                openPeriod
                        .map(
                                period ->
                                        readiness(
                                                projectId,
                                                period,
                                                forecast))
                        .orElse(null),

                snapshotRepository
                        .findByProjectIdOrderByClosedAtDesc(
                                projectId)
                        .stream()
                        .map(
                                this::response)
                        .toList());
    }

    @Transactional(readOnly = true)
    public PeriodControlIntelligenceResponse intelligence(
            UUID projectId) {

        requireProject(
                projectId);

        ForecastIntelligenceResponse forecast =
                forecastControlService
                        .intelligence(
                                projectId);

        return intelligence(
                projectId,
                forecast);
    }

    @Transactional
    public ControlBaselineResponse captureBaseline(
            UUID projectId,
            CaptureBaselineRequest request) {

        requireProject(
                projectId);

        String versionCode =
                reference(
                        request.versionCode());

        if (baselineRepository
                .existsByProjectIdAndVersionCodeIgnoreCase(
                        projectId,
                        versionCode)) {

            throw new ConflictException(
                    "Control baseline '%s' already exists."
                            .formatted(
                                    versionCode));
        }

        ForecastIntelligenceResponse forecast =
                forecastControlService
                        .intelligence(
                                projectId);

        ProjectControlBaselineVersion baseline =
                ProjectControlBaselineVersion.capture(
                        UUID.randomUUID(),
                        projectId,
                        versionCode,
                        request.title()
                                .trim(),
                        normalize(
                                request.reason()),
                        optionalReference(
                                request.changeReference()),
                        forecast.dataDate(),
                        money(
                                forecast.bac()),
                        money(
                                forecast.expectedForecastCost()),
                        forecast.expectedForecastFinishDate(),
                        BigDecimal.valueOf(
                                forecast.predictiveScore()));

        return response(
                baselineRepository.save(
                        baseline));
    }

    @Transactional
    public ControlBaselineResponse approveBaseline(
            UUID projectId,
            UUID baselineId) {

        requireProject(
                projectId);

        ProjectControlBaselineVersion baseline =
                requireBaseline(
                        projectId,
                        baselineId);

        Instant now =
                Instant.now(
                        clock);

        baselineRepository
                .findFirstByProjectIdAndStatusOrderByApprovedAtDescCreatedAtDesc(
                        projectId,
                        ControlBaselineStatus.APPROVED)
                .filter(
                        current ->
                                !current.getId()
                                        .equals(
                                                baselineId))
                .ifPresent(
                        current -> {

                            try {

                                current.supersede(
                                        now);

                            } catch (
                                    IllegalStateException exception) {

                                throw new InvalidRequestException(
                                        exception.getMessage());
                            }

                            baselineRepository.save(
                                    current);
                        });

        try {

            baseline.approve(
                    now);

        } catch (
                IllegalStateException exception) {

            throw new InvalidRequestException(
                    exception.getMessage());
        }

        return response(
                baselineRepository
                        .saveAndFlush(
                                baseline));
    }

    @Transactional
    public ProgressPeriodResponse createPeriod(
            UUID projectId,
            CreateProgressPeriodRequest request) {

        requireProject(
                projectId);

        if (request.endDate()
                .isBefore(
                        request.startDate())) {

            throw new InvalidRequestException(
                    "Progress-period end date cannot be before its start date.");
        }

        if (periodRepository
                .existsByProjectIdAndStatus(
                        projectId,
                        ProgressPeriodStatus.OPEN)) {

            throw new ConflictException(
                    "Only one progress period can be open at a time.");
        }

        String periodCode =
                reference(
                        request.periodCode());

        if (periodRepository
                .existsByProjectIdAndPeriodCodeIgnoreCase(
                        projectId,
                        periodCode)) {

            throw new ConflictException(
                    "Progress period '%s' already exists."
                            .formatted(
                                    periodCode));
        }

        boolean overlaps =
                periodRepository
                        .findByProjectIdOrderByEndDateDescPeriodCodeDesc(
                                projectId)
                        .stream()
                        .anyMatch(
                                existing ->
                                        !request.endDate()
                                                .isBefore(
                                                        existing.getStartDate())
                                        && !request.startDate()
                                                .isAfter(
                                                        existing.getEndDate()));

        if (overlaps) {

            throw new ConflictException(
                    "The requested progress period overlaps an existing period.");
        }

        ProjectControlBaselineVersion baseline =
                activeBaseline(
                        projectId);

        ProjectProgressPeriod period =
                ProjectProgressPeriod.open(
                        UUID.randomUUID(),
                        projectId,
                        baseline.getId(),
                        periodCode,
                        request.title()
                                .trim(),
                        request.startDate(),
                        request.endDate());

        return response(
                periodRepository.save(
                        period));
    }

    @Transactional(readOnly = true)
    public PeriodEndReadinessResponse readiness(
            UUID projectId,
            UUID periodId) {

        requireProject(
                projectId);

        ProjectProgressPeriod period =
                requirePeriod(
                        projectId,
                        periodId);

        ForecastIntelligenceResponse forecast =
                forecastControlService
                        .intelligence(
                                projectId);

        return readiness(
                projectId,
                period,
                forecast);
    }

    @Transactional
    public PeriodEndSnapshotResponse closePeriod(
            UUID projectId,
            UUID periodId) {

        requireProject(
                projectId);

        ProjectProgressPeriod period =
                requirePeriod(
                        projectId,
                        periodId);

        if (period.getStatus()
                != ProgressPeriodStatus.OPEN) {

            throw new InvalidRequestException(
                    "Only an open progress period can be closed.");
        }

        if (snapshotRepository
                .existsByPeriodId(
                        periodId)) {

            throw new ConflictException(
                    "A period-end snapshot already exists for this period.");
        }

        ForecastIntelligenceResponse forecast =
                forecastControlService
                        .intelligence(
                                projectId);

        PeriodEndReadinessResponse readiness =
                readiness(
                        projectId,
                        period,
                        forecast);

        if (!readiness.canClose()) {

            throw new InvalidRequestException(
                    "Period cannot be closed: "
                            + String.join(
                                    "; ",
                                    readiness.blockers()));
        }

        ProjectControlBaselineVersion baseline =
                requireBaseline(
                        projectId,
                        period.getBaselineVersionId());

        GovernanceIntelligenceResponse governance =
                governanceControlService
                        .intelligence(
                                projectId);

        ChangeImpactIntelligenceResponse recovery =
                changeImpactControlService
                        .intelligence(
                                projectId);

        ControlEvaluation evaluation =
                evaluate(
                        baseline,
                        forecast,
                        governance,
                        recovery);

        Instant now =
                Instant.now(
                        clock);

        ProjectPeriodEndSnapshot snapshot =
                ProjectPeriodEndSnapshot.capture(
                        UUID.randomUUID(),
                        projectId,
                        period,
                        baseline,
                        forecast,
                        governance,
                        recovery,
                        evaluation,
                        now);

        ProjectPeriodEndSnapshot saved =
                snapshotRepository.save(
                        snapshot);

        try {

            period.close(
                    now);

        } catch (
                IllegalStateException exception) {

            throw new InvalidRequestException(
                    exception.getMessage());
        }

        periodRepository
                .saveAndFlush(
                        period);

        return response(
                saved);
    }

    private PeriodControlIntelligenceResponse intelligence(
            UUID projectId,
            ForecastIntelligenceResponse forecast) {

        Optional<ProjectControlBaselineVersion> baseline =
                baselineRepository
                        .findFirstByProjectIdAndStatusOrderByApprovedAtDescCreatedAtDesc(
                                projectId,
                                ControlBaselineStatus.APPROVED);

        if (baseline.isEmpty()) {

            return PeriodControlIntelligenceResponse.noBaseline(
                    forecast);
        }

        GovernanceIntelligenceResponse governance =
                governanceControlService
                        .intelligence(
                                projectId);

        ChangeImpactIntelligenceResponse recovery =
                changeImpactControlService
                        .intelligence(
                                projectId);

        ControlEvaluation evaluation =
                evaluate(
                        baseline.get(),
                        forecast,
                        governance,
                        recovery);

        Optional<ProjectProgressPeriod> open =
                periodRepository
                        .findFirstByProjectIdAndStatusOrderByStartDateDesc(
                                projectId,
                                ProgressPeriodStatus.OPEN);

        Optional<ProjectPeriodEndSnapshot> latest =
                snapshotRepository
                        .findFirstByProjectIdOrderByClosedAtDesc(
                                projectId);

        return new PeriodControlIntelligenceResponse(
                forecast.dataDate(),

                baselineRepository
                        .countByProjectId(
                                projectId),

                baseline.get()
                        .getVersionCode(),

                baseline.get()
                        .getCostTarget(),

                baseline.get()
                        .getFinishTarget(),

                open.isPresent()
                        ? 1
                        : 0,

                open.map(
                                ProjectProgressPeriod::getPeriodCode)
                        .orElse(null),

                open.map(
                                ProjectProgressPeriod::getEndDate)
                        .orElse(null),

                periodRepository
                        .countByProjectIdAndStatus(
                                projectId,
                                ProgressPeriodStatus.CLOSED),

                latest.map(
                                ProjectPeriodEndSnapshot::getPeriodCode)
                        .orElse(null),

                forecast.expectedForecastCost(),
                forecast.expectedForecastFinishDate(),

                evaluation.costVarianceToBaseline(),
                evaluation.finishVarianceDays(),

                evaluation.plannedProgressPercentage(),
                evaluation.earnedProgressPercentage(),

                forecast.cpi(),
                forecast.spi(),

                forecast.predictiveScore(),
                forecast.predictiveRisk()
                        .name(),

                governance.governanceScore(),
                governance.governanceRisk()
                        .name(),

                recovery.recoveryScore(),
                recovery.recoveryRisk()
                        .name(),

                evaluation.controlScore(),
                evaluation.controlRisk(),

                "Period Control compares the current predictive position with the approved control baseline and preserves immutable evidence at each reporting-period close.");
    }

    private ControlEvaluation evaluate(
            ProjectControlBaselineVersion baseline,
            ForecastIntelligenceResponse forecast,
            GovernanceIntelligenceResponse governance,
            ChangeImpactIntelligenceResponse recovery) {

        return calculator.evaluate(
                new ControlInput(
                        baseline.getCostTarget(),
                        baseline.getFinishTarget(),

                        forecast.bac(),

                        forecast.plannedValue(),
                        forecast.earnedValue(),

                        forecast.expectedForecastCost(),
                        forecast.expectedForecastFinishDate(),

                        forecast.cpi(),
                        forecast.spi(),

                        forecast.predictiveRisk()
                                .name(),

                        governance.governanceRisk()
                                .name(),

                        recovery.recoveryRisk()
                                .name()));
    }

    private PeriodEndReadinessResponse readiness(
            UUID projectId,
            ProjectProgressPeriod period,
            ForecastIntelligenceResponse forecast) {

        List<String> blockers =
                new ArrayList<>();

        List<String> warnings =
                new ArrayList<>();

        LocalDate today =
                LocalDate.now(
                        clock);

        if (period.getStatus()
                != ProgressPeriodStatus.OPEN) {

            blockers.add(
                    "The progress period is already closed.");
        }

        ProjectControlBaselineVersion baseline =
                requireBaseline(
                        projectId,
                        period.getBaselineVersionId());

        if (
                baseline.getStatus()
                        != ControlBaselineStatus.APPROVED
                && baseline.getStatus()
                        != ControlBaselineStatus.SUPERSEDED) {

            blockers.add(
                    "The period is not pinned to an approved control baseline.");
        }

        if (today.isBefore(
                period.getEndDate())) {

            blockers.add(
                    "The period end date has not been reached.");
        }

        if (forecast.dataDate()
                .isBefore(
                        period.getEndDate())) {

            blockers.add(
                    "Forecast data date is earlier than the reporting-period end date.");
        }

        if (snapshotRepository
                .existsByPeriodId(
                        period.getId())) {

            blockers.add(
                    "A period-end snapshot already exists.");
        }

        GovernanceIntelligenceResponse governance =
                governanceControlService
                        .intelligence(
                                projectId);

        ChangeImpactIntelligenceResponse recovery =
                changeImpactControlService
                        .intelligence(
                                projectId);

        if (governance.overdueActions()
                > 0) {

            warnings.add(
                    "%d governance actions are overdue."
                            .formatted(
                                    governance.overdueActions()));
        }

        if (governance.criticalOpenActions()
                > 0) {

            warnings.add(
                    "%d critical governance actions remain open."
                            .formatted(
                                    governance.criticalOpenActions()));
        }

        if (governance.blockedActions()
                > 0) {

            warnings.add(
                    "%d governance actions are blocked."
                            .formatted(
                                    governance.blockedActions()));
        }

        if (governance.meetingsWithoutMinutes()
                > 0) {

            warnings.add(
                    "%d held meetings do not have minutes."
                            .formatted(
                                    governance.meetingsWithoutMinutes()));
        }

        if ("AT_RISK".equals(
                forecast.predictiveRisk()
                        .name())) {

            warnings.add(
                    "Predictive controls are currently AT_RISK.");
        }

        if ("AT_RISK".equals(
                recovery.recoveryRisk()
                        .name())) {

            warnings.add(
                    "Change/recovery controls are currently AT_RISK.");
        }

        if (recovery.residualDelayDays()
                > 0) {

            warnings.add(
                    "The current recovery position retains %d residual delay days."
                            .formatted(
                                    recovery.residualDelayDays()));
        }

        return new PeriodEndReadinessResponse(
                period.getId(),
                period.getPeriodCode(),

                period.getEndDate(),
                today,
                forecast.dataDate(),

                blockers.isEmpty(),

                List.copyOf(
                        blockers),

                List.copyOf(
                        warnings));
    }

    private ControlBaselineResponse response(
            ProjectControlBaselineVersion baseline) {

        return new ControlBaselineResponse(
                baseline.getId(),
                baseline.getProjectId(),

                baseline.getVersionCode(),
                baseline.getTitle(),

                baseline.getReason(),
                baseline.getChangeReference(),

                baseline.getStatus(),

                baseline.getSourceDataDate(),

                baseline.getBudgetAtCompletion(),

                baseline.getCostTarget(),

                baseline.getFinishTarget(),

                baseline.getCapturedPredictiveScore(),

                baseline.getApprovedAt(),
                baseline.getSupersededAt(),

                baseline.getVersion(),

                baseline.getCreatedAt(),
                baseline.getUpdatedAt());
    }

    private ProgressPeriodResponse response(
            ProjectProgressPeriod period) {

        String baselineCode =
                baselineRepository
                        .findById(
                                period.getBaselineVersionId())
                        .map(
                                ProjectControlBaselineVersion::getVersionCode)
                        .orElse(
                                "UNKNOWN");

        return new ProgressPeriodResponse(
                period.getId(),
                period.getProjectId(),
                period.getBaselineVersionId(),

                baselineCode,

                period.getPeriodCode(),
                period.getTitle(),

                period.getStartDate(),
                period.getEndDate(),

                period.getStatus(),

                period.getClosedAt(),

                period.getVersion(),

                period.getCreatedAt(),
                period.getUpdatedAt());
    }

    private PeriodEndSnapshotResponse response(
            ProjectPeriodEndSnapshot snapshot) {

        return new PeriodEndSnapshotResponse(
                snapshot.getId(),
                snapshot.getProjectId(),
                snapshot.getPeriodId(),
                snapshot.getBaselineVersionId(),

                snapshot.getPeriodCode(),

                snapshot.getPeriodStartDate(),
                snapshot.getPeriodEndDate(),

                snapshot.getSourceDataDate(),

                snapshot.getBaselineCostTarget(),
                snapshot.getBaselineFinishTarget(),

                snapshot.getBudgetAtCompletion(),
                snapshot.getPlannedValue(),
                snapshot.getEarnedValue(),
                snapshot.getActualCost(),

                snapshot.getExpectedForecastCost(),
                snapshot.getExpectedForecastFinishDate(),

                snapshot.getPlannedProgressPercentage(),
                snapshot.getEarnedProgressPercentage(),

                snapshot.getCostPerformanceIndex(),
                snapshot.getSchedulePerformanceIndex(),

                snapshot.getCostVarianceToBaseline(),
                snapshot.getFinishVarianceDays(),

                snapshot.getPredictiveScore(),
                snapshot.getPredictiveRisk(),

                snapshot.getGovernanceScore(),
                snapshot.getGovernanceRisk(),

                snapshot.getRecoveryScore(),
                snapshot.getRecoveryRisk(),

                snapshot.getChangeCostExposure(),
                snapshot.getRecoveryResidualDelayDays(),

                snapshot.getOpenActions(),
                snapshot.getOverdueActions(),
                snapshot.getCriticalOpenActions(),
                snapshot.getBlockedActions(),

                snapshot.getPeriodControlScore(),
                snapshot.getPeriodControlRisk(),

                snapshot.getClosedAt(),
                snapshot.getCreatedAt());
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

    private ProjectControlBaselineVersion requireBaseline(
            UUID projectId,
            UUID baselineId) {

        return baselineRepository
                .findByIdAndProjectId(
                        baselineId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Control baseline '%s' was not found."
                                                .formatted(
                                                        baselineId)));
    }

    private ProjectControlBaselineVersion activeBaseline(
            UUID projectId) {

        return baselineRepository
                .findFirstByProjectIdAndStatusOrderByApprovedAtDescCreatedAtDesc(
                        projectId,
                        ControlBaselineStatus.APPROVED)
                .orElseThrow(
                        () ->
                                new InvalidRequestException(
                                        "An approved control baseline is required before opening a progress period."));
    }

    private ProjectProgressPeriod requirePeriod(
            UUID projectId,
            UUID periodId) {

        return periodRepository
                .findByIdAndProjectId(
                        periodId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Progress period '%s' was not found."
                                                .formatted(
                                                        periodId)));
    }

    private String reference(
            String value) {

        return value
                .trim()
                .toUpperCase(
                        Locale.ROOT);
    }

    private String optionalReference(
            String value) {

        String normalized =
                normalize(
                        value);

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

    private BigDecimal money(
            BigDecimal value) {

        return value.setScale(
                2,
                RoundingMode.HALF_UP);
    }
}
