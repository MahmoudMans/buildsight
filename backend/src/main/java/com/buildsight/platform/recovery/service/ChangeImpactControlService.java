package com.buildsight.platform.recovery.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.forecast.service.ForecastControlService;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;
import com.buildsight.platform.recovery.api.RecoveryModels.ChangeImpactControlResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.ChangeImpactEvaluationResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.ChangeImpactIntelligenceResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.ChangeSimulationResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.CreateChangeSimulationRequest;
import com.buildsight.platform.recovery.api.RecoveryModels.CreateRecoveryOptionRequest;
import com.buildsight.platform.recovery.api.RecoveryModels.RecoveryOptionEvaluationResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.RecoveryOptionResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.RecoveryPlanSnapshotResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.UpdateChangeSimulationRequest;
import com.buildsight.platform.recovery.api.RecoveryModels.UpdateRecoveryOptionRequest;
import com.buildsight.platform.recovery.domain.ChangeSimulationStatus;
import com.buildsight.platform.recovery.domain.ProjectChangeImpactSimulation;
import com.buildsight.platform.recovery.domain.ProjectRecoveryOption;
import com.buildsight.platform.recovery.domain.ProjectRecoveryPlanSnapshot;
import com.buildsight.platform.recovery.domain.RecoveryOptionStatus;
import com.buildsight.platform.recovery.repository.ProjectChangeImpactSimulationRepository;
import com.buildsight.platform.recovery.repository.ProjectRecoveryOptionRepository;
import com.buildsight.platform.recovery.repository.ProjectRecoveryPlanSnapshotRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ChangeImpactControlService {

    private final ProjectRepository
            projectRepository;

    private final ProjectChangeImpactSimulationRepository
            simulationRepository;

    private final ProjectRecoveryOptionRepository
            optionRepository;

    private final ProjectRecoveryPlanSnapshotRepository
            snapshotRepository;

    private final ForecastControlService
            forecastControlService;

    private final ChangeImpactSimulationEngine
            engine;

    private final ProjectMapper
            projectMapper;

    private final Clock
            clock;

    public ChangeImpactControlService(
            ProjectRepository projectRepository,
            ProjectChangeImpactSimulationRepository simulationRepository,
            ProjectRecoveryOptionRepository optionRepository,
            ProjectRecoveryPlanSnapshotRepository snapshotRepository,
            ForecastControlService forecastControlService,
            ChangeImpactSimulationEngine engine,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.simulationRepository =
                simulationRepository;

        this.optionRepository =
                optionRepository;

        this.snapshotRepository =
                snapshotRepository;

        this.forecastControlService =
                forecastControlService;

        this.engine =
                engine;

        this.projectMapper =
                projectMapper;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public ChangeImpactControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        ForecastIntelligenceResponse baseline =
                forecastControlService
                        .intelligence(
                                projectId);

        List<ProjectChangeImpactSimulation> simulations =
                simulationRepository
                        .findByProjectIdOrderByUpdatedAtDescSimulationNumberAsc(
                                projectId);

        return new ChangeImpactControlResponse(
                projectMapper.toResponse(
                        project),

                baseline,

                intelligence(
                        projectId,
                        baseline,
                        simulations),

                simulations.stream()
                        .map(
                                simulation ->
                                        response(
                                                simulation,
                                                baseline))
                        .toList(),

                snapshotRepository
                        .findByProjectIdOrderBySelectedAtDesc(
                                projectId)
                        .stream()
                        .map(
                                this::response)
                        .toList());
    }

    @Transactional(readOnly = true)
    public ChangeImpactIntelligenceResponse intelligence(
            UUID projectId) {

        requireProject(
                projectId);

        ForecastIntelligenceResponse baseline =
                forecastControlService
                        .intelligence(
                                projectId);

        List<ProjectChangeImpactSimulation> simulations =
                simulationRepository
                        .findByProjectIdOrderByUpdatedAtDescSimulationNumberAsc(
                                projectId);

        return intelligence(
                projectId,
                baseline,
                simulations);
    }

    @Transactional
    public ChangeSimulationResponse createSimulation(
            UUID projectId,
            CreateChangeSimulationRequest request) {

        requireProject(
                projectId);

        String number =
                reference(
                        request.simulationNumber());

        if (simulationRepository
                .existsByProjectIdAndSimulationNumberIgnoreCase(
                        projectId,
                        number)) {

            throw new ConflictException(
                    "Change-impact simulation '%s' already exists."
                            .formatted(
                                    number));
        }

        ProjectChangeImpactSimulation simulation =
                ProjectChangeImpactSimulation.create(
                        UUID.randomUUID(),
                        projectId,
                        number,
                        request.title()
                                .trim(),
                        reference(
                                request.sourceChangeReference()),
                        normalize(
                                request.description()),
                        request.directCostImpact(),
                        request.delayDays(),
                        request.productivityChangePercentage(),
                        request.procurementDelayDays(),
                        request.resourceCapacityChangePercentage(),
                        request.riskContingencyPercentage(),
                        normalize(
                                request.notes()));

        ProjectChangeImpactSimulation saved =
                simulationRepository.save(
                        simulation);

        return response(
                saved,
                forecastControlService
                        .intelligence(
                                projectId));
    }

    @Transactional
    public ChangeSimulationResponse updateSimulation(
            UUID projectId,
            UUID simulationId,
            UpdateChangeSimulationRequest request) {

        requireProject(
                projectId);

        ProjectChangeImpactSimulation simulation =
                requireSimulation(
                        projectId,
                        simulationId);

        verifyVersion(
                simulation.getVersion(),
                request.version(),
                "change-impact simulation");

        try {

            simulation.update(
                    request.title()
                            .trim(),
                    reference(
                            request.sourceChangeReference()),
                    normalize(
                            request.description()),
                    request.directCostImpact(),
                    request.delayDays(),
                    request.productivityChangePercentage(),
                    request.procurementDelayDays(),
                    request.resourceCapacityChangePercentage(),
                    request.riskContingencyPercentage(),
                    normalize(
                            request.notes()));

        } catch (
                IllegalStateException exception) {

            throw new InvalidRequestException(
                    exception.getMessage());
        }

        ProjectChangeImpactSimulation saved =
                simulationRepository
                        .saveAndFlush(
                                simulation);

        return response(
                saved,
                forecastControlService
                        .intelligence(
                                projectId));
    }

    @Transactional
    public ChangeSimulationResponse approveSimulation(
            UUID projectId,
            UUID simulationId) {

        requireProject(
                projectId);

        ProjectChangeImpactSimulation simulation =
                requireSimulation(
                        projectId,
                        simulationId);

        simulationRepository
                .findFirstByProjectIdAndStatusOrderByUpdatedAtDesc(
                        projectId,
                        ChangeSimulationStatus.APPROVED)
                .filter(
                        existing ->
                                !existing.getId()
                                        .equals(
                                                simulationId))
                .ifPresent(
                        existing -> {

                            existing.archive();

                            simulationRepository.save(
                                    existing);
                        });

        try {

            simulation.approve(
                    Instant.now(
                            clock));

        } catch (
                IllegalStateException exception) {

            throw new InvalidRequestException(
                    exception.getMessage());
        }

        return response(
                simulationRepository
                        .saveAndFlush(
                                simulation),
                forecastControlService
                        .intelligence(
                                projectId));
    }

    @Transactional
    public ChangeSimulationResponse archiveSimulation(
            UUID projectId,
            UUID simulationId) {

        requireProject(
                projectId);

        ProjectChangeImpactSimulation simulation =
                requireSimulation(
                        projectId,
                        simulationId);

        simulation.archive();

        return response(
                simulationRepository
                        .saveAndFlush(
                                simulation),
                forecastControlService
                        .intelligence(
                                projectId));
    }

    @Transactional
    public RecoveryOptionResponse createOption(
            UUID projectId,
            UUID simulationId,
            CreateRecoveryOptionRequest request) {

        requireProject(
                projectId);

        ProjectChangeImpactSimulation simulation =
                requireSimulation(
                        projectId,
                        simulationId);

        if (simulation.getStatus()
                == ChangeSimulationStatus.ARCHIVED) {

            throw new InvalidRequestException(
                    "Recovery options cannot be added to an archived simulation.");
        }

        String number =
                reference(
                        request.optionNumber());

        if (optionRepository
                .existsBySimulationIdAndOptionNumberIgnoreCase(
                        simulationId,
                        number)) {

            throw new ConflictException(
                    "Recovery option '%s' already exists."
                            .formatted(
                                    number));
        }

        ProjectRecoveryOption option =
                ProjectRecoveryOption.create(
                        UUID.randomUUID(),
                        projectId,
                        simulationId,
                        number,
                        request.name()
                                .trim(),
                        request.strategyType(),
                        request.scheduleRecoveryDays(),
                        request.incrementalCost(),
                        request.productivityImprovementPercentage(),
                        request.procurementRecoveryDays(),
                        request.resourceCapacityImprovementPercentage(),
                        request.residualRiskPercentage(),
                        normalize(
                                request.notes()));

        ProjectRecoveryOption saved =
                optionRepository.save(
                        option);

        ForecastIntelligenceResponse baseline =
                forecastControlService
                        .intelligence(
                                projectId);

        ChangeImpactEvaluationResponse impact =
                engine.impact(
                        baseline,
                        simulation);

        return response(
                saved,
                engine.recovery(
                        baseline,
                        impact,
                        saved),
                false);
    }

    @Transactional
    public RecoveryOptionResponse updateOption(
            UUID projectId,
            UUID simulationId,
            UUID optionId,
            UpdateRecoveryOptionRequest request) {

        requireProject(
                projectId);

        ProjectChangeImpactSimulation simulation =
                requireSimulation(
                        projectId,
                        simulationId);

        ProjectRecoveryOption option =
                requireOption(
                        simulationId,
                        optionId);

        verifyVersion(
                option.getVersion(),
                request.version(),
                "recovery option");

        try {

            option.update(
                    request.name()
                            .trim(),
                    request.strategyType(),
                    request.scheduleRecoveryDays(),
                    request.incrementalCost(),
                    request.productivityImprovementPercentage(),
                    request.procurementRecoveryDays(),
                    request.resourceCapacityImprovementPercentage(),
                    request.residualRiskPercentage(),
                    normalize(
                            request.notes()));

        } catch (
                IllegalStateException exception) {

            throw new InvalidRequestException(
                    exception.getMessage());
        }

        ProjectRecoveryOption saved =
                optionRepository
                        .saveAndFlush(
                                option);

        ForecastIntelligenceResponse baseline =
                forecastControlService
                        .intelligence(
                                projectId);

        ChangeImpactEvaluationResponse impact =
                engine.impact(
                        baseline,
                        simulation);

        return response(
                saved,
                engine.recovery(
                        baseline,
                        impact,
                        saved),
                false);
    }

    @Transactional
    public RecoveryPlanSnapshotResponse selectOption(
            UUID projectId,
            UUID simulationId,
            UUID optionId) {

        requireProject(
                projectId);

        ProjectChangeImpactSimulation simulation =
                requireSimulation(
                        projectId,
                        simulationId);

        if (simulation.getStatus()
                != ChangeSimulationStatus.APPROVED) {

            throw new InvalidRequestException(
                    "The change-impact simulation must be approved before selecting a recovery plan.");
        }

        if (snapshotRepository
                .existsBySimulationId(
                        simulationId)) {

            throw new ConflictException(
                    "A recovery plan has already been selected for this simulation.");
        }

        ProjectRecoveryOption option =
                requireOption(
                        simulationId,
                        optionId);

        if (optionRepository
                .findFirstBySimulationIdAndStatus(
                        simulationId,
                        RecoveryOptionStatus.SELECTED)
                .isPresent()) {

            throw new ConflictException(
                    "A recovery option is already selected for this simulation.");
        }

        Instant now =
                Instant.now(
                        clock);

        try {

            option.select(
                    now);

        } catch (
                IllegalStateException exception) {

            throw new InvalidRequestException(
                    exception.getMessage());
        }

        List<ProjectRecoveryOption> options =
                optionRepository
                        .findBySimulationIdOrderByCreatedAtAscOptionNumberAsc(
                                simulationId);

        for (ProjectRecoveryOption candidate :
                options) {

            if (
                    !candidate.getId()
                            .equals(
                                    optionId)
                    && candidate.getStatus()
                            == RecoveryOptionStatus.DRAFT) {

                candidate.reject();
            }
        }

        optionRepository.saveAll(
                options);

        optionRepository.saveAndFlush(
                option);

        ForecastIntelligenceResponse baseline =
                forecastControlService
                        .intelligence(
                                projectId);

        ChangeImpactEvaluationResponse impact =
                engine.impact(
                        baseline,
                        simulation);

        RecoveryOptionEvaluationResponse recovery =
                engine.recovery(
                        baseline,
                        impact,
                        option);

        ProjectRecoveryPlanSnapshot snapshot =
                ProjectRecoveryPlanSnapshot.capture(
                        UUID.randomUUID(),
                        projectId,
                        simulationId,
                        optionId,
                        now,
                        impact,
                        recovery);

        return response(
                snapshotRepository.save(
                        snapshot));
    }

    private ChangeImpactIntelligenceResponse intelligence(
            UUID projectId,
            ForecastIntelligenceResponse baseline,
            List<ProjectChangeImpactSimulation> simulations) {

        Optional<ProjectChangeImpactSimulation> active =
                simulations.stream()
                        .filter(
                                simulation ->
                                        simulation.getStatus()
                                                == ChangeSimulationStatus.APPROVED)
                        .findFirst();

        if (active.isEmpty()) {

            active =
                    simulations.stream()
                            .filter(
                                    simulation ->
                                            simulation.getStatus()
                                                    == ChangeSimulationStatus.DRAFT)
                            .findFirst();
        }

        if (active.isEmpty()) {

            return ChangeImpactIntelligenceResponse.noData(
                    baseline);
        }

        ProjectChangeImpactSimulation simulation =
                active.get();

        ChangeImpactEvaluationResponse impact =
                engine.impact(
                        baseline,
                        simulation);

        List<ProjectRecoveryOption> options =
                optionRepository
                        .findBySimulationIdOrderByCreatedAtAscOptionNumberAsc(
                                simulation.getId());

        Optional<OptionEvaluation> recommended =
                recommended(
                        baseline,
                        impact,
                        options);

        return new ChangeImpactIntelligenceResponse(
                baseline.dataDate(),

                simulationRepository
                        .countByProjectId(
                                projectId),

                simulation.getSimulationNumber(),
                simulation.getTitle(),
                simulation.getStatus()
                        .name(),

                impact.baselineForecastCost(),
                impact.impactedForecastCost(),
                impact.totalChangeCostExposure(),

                impact.baselineForecastFinishDate(),
                impact.impactedForecastFinishDate(),

                impact.scheduleImpactDays(),

                recommended
                        .map(
                                value ->
                                        value.option()
                                                .getOptionNumber())
                        .orElse(null),

                recommended
                        .map(
                                value ->
                                        value.option()
                                                .getName())
                        .orElse(null),

                recommended
                        .map(
                                value ->
                                        value.evaluation()
                                                .recoveryCostVsImpacted())
                        .orElse(
                                BigDecimal.ZERO),

                recommended
                        .map(
                                value ->
                                        value.evaluation()
                                                .recoverableDays())
                        .orElse(0L),

                recommended
                        .map(
                                value ->
                                        value.evaluation()
                                                .residualDelayDays())
                        .orElse(
                                impact.scheduleImpactDays()),

                recommended
                        .map(
                                value ->
                                        value.evaluation()
                                                .recoveredForecastCost())
                        .orElse(
                                impact.impactedForecastCost()),

                recommended
                        .map(
                                value ->
                                        value.evaluation()
                                                .recoveredForecastFinishDate())
                        .orElse(
                                impact.impactedForecastFinishDate()),

                recommended
                        .map(
                                value ->
                                        value.evaluation()
                                                .costPerDayRecovered())
                        .orElse(
                                BigDecimal.ZERO),

                recommended
                        .map(
                                value ->
                                        value.evaluation()
                                                .recoveryScore())
                        .orElse(
                                impact.impactScore()),

                recommended
                        .map(
                                value ->
                                        value.evaluation()
                                                .recoveryRisk())
                        .orElse(
                                impact.impactRisk()),

                "Change & Recovery Intelligence compares the current predictive forecast with explicit change-impact assumptions and transparent recovery strategies. It does not modify the authoritative commercial or change-control record.");
    }

    private ChangeSimulationResponse response(
            ProjectChangeImpactSimulation simulation,
            ForecastIntelligenceResponse baseline) {

        ChangeImpactEvaluationResponse impact =
                engine.impact(
                        baseline,
                        simulation);

        List<ProjectRecoveryOption> options =
                optionRepository
                        .findBySimulationIdOrderByCreatedAtAscOptionNumberAsc(
                                simulation.getId());

        Optional<OptionEvaluation> recommendation =
                recommended(
                        baseline,
                        impact,
                        options);

        UUID recommendedId =
                recommendation
                        .map(
                                value ->
                                        value.option()
                                                .getId())
                        .orElse(null);

        List<RecoveryOptionResponse> responses =
                options.stream()
                        .map(
                                option -> {

                                    RecoveryOptionEvaluationResponse evaluation =
                                            engine.recovery(
                                                    baseline,
                                                    impact,
                                                    option);

                                    return response(
                                            option,
                                            evaluation,
                                            option.getId()
                                                    .equals(
                                                            recommendedId));
                                })
                        .toList();

        return new ChangeSimulationResponse(
                simulation.getId(),
                simulation.getProjectId(),

                simulation.getSimulationNumber(),
                simulation.getTitle(),
                simulation.getSourceChangeReference(),
                simulation.getDescription(),

                simulation.getStatus(),

                simulation.getDirectCostImpact(),
                simulation.getDelayDays(),
                simulation.getProductivityChangePercentage(),
                simulation.getProcurementDelayDays(),
                simulation.getResourceCapacityChangePercentage(),
                simulation.getRiskContingencyPercentage(),

                simulation.getNotes(),

                simulation.getApprovedAt(),

                simulation.getVersion(),

                simulation.getCreatedAt(),
                simulation.getUpdatedAt(),

                impact,

                responses);
    }

    private Optional<OptionEvaluation> recommended(
            ForecastIntelligenceResponse baseline,
            ChangeImpactEvaluationResponse impact,
            List<ProjectRecoveryOption> options) {

        return options.stream()
                .filter(
                        option ->
                                option.getStatus()
                                        != RecoveryOptionStatus.REJECTED)
                .map(
                        option ->
                                new OptionEvaluation(
                                        option,
                                        engine.recovery(
                                                baseline,
                                                impact,
                                                option)))
                .max(
                        Comparator
                                .comparingDouble(
                                        (
                                                OptionEvaluation value) ->
                                                value.evaluation()
                                                        .recoveryScore())
                                .thenComparing(
                                        value ->
                                                value.evaluation()
                                                        .recoveryCostVsImpacted()
                                                        .negate()));
    }

    private RecoveryOptionResponse response(
            ProjectRecoveryOption option,
            RecoveryOptionEvaluationResponse evaluation,
            boolean recommended) {

        return new RecoveryOptionResponse(
                option.getId(),
                option.getProjectId(),
                option.getSimulationId(),

                option.getOptionNumber(),
                option.getName(),

                option.getStrategyType(),
                option.getStatus(),

                option.getScheduleRecoveryDays(),
                option.getIncrementalCost(),
                option.getProductivityImprovementPercentage(),
                option.getProcurementRecoveryDays(),
                option.getResourceCapacityImprovementPercentage(),
                option.getResidualRiskPercentage(),

                option.getNotes(),

                recommended,

                option.getSelectedAt(),

                option.getVersion(),

                option.getCreatedAt(),
                option.getUpdatedAt(),

                evaluation);
    }

    private RecoveryPlanSnapshotResponse response(
            ProjectRecoveryPlanSnapshot snapshot) {

        return new RecoveryPlanSnapshotResponse(
                snapshot.getId(),
                snapshot.getProjectId(),
                snapshot.getSimulationId(),
                snapshot.getRecoveryOptionId(),

                snapshot.getSelectedAt(),

                snapshot.getBaselineForecastCost(),
                snapshot.getImpactedForecastCost(),
                snapshot.getRecoveredForecastCost(),

                snapshot.getBaselineForecastFinishDate(),
                snapshot.getImpactedForecastFinishDate(),
                snapshot.getRecoveredForecastFinishDate(),

                snapshot.getChangeCostExposure(),
                snapshot.getRecoveryCost(),

                snapshot.getImpactDelayDays(),
                snapshot.getRecoveredDays(),
                snapshot.getResidualDelayDays(),

                snapshot.getCostPerDayRecovered(),

                snapshot.getRecoveryScore(),
                snapshot.getRecoveryRisk(),

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

    private ProjectChangeImpactSimulation requireSimulation(
            UUID projectId,
            UUID simulationId) {

        return simulationRepository
                .findByIdAndProjectId(
                        simulationId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Change-impact simulation '%s' was not found."
                                                .formatted(
                                                        simulationId)));
    }

    private ProjectRecoveryOption requireOption(
            UUID simulationId,
            UUID optionId) {

        return optionRepository
                .findByIdAndSimulationId(
                        optionId,
                        simulationId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Recovery option '%s' was not found."
                                                .formatted(
                                                        optionId)));
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

    private record OptionEvaluation(
            ProjectRecoveryOption option,
            RecoveryOptionEvaluationResponse evaluation) {
    }
}
