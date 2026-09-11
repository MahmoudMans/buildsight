package com.buildsight.platform.forecast.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.forecast.api.ForecastModels.CreateForecastScenarioRequest;
import com.buildsight.platform.forecast.api.ForecastModels.EvmSnapshotResponse;
import com.buildsight.platform.forecast.api.ForecastModels.ForecastControlResponse;
import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.forecast.api.ForecastModels.ForecastScenarioResponse;
import com.buildsight.platform.forecast.api.ForecastModels.UpdateForecastScenarioRequest;
import com.buildsight.platform.forecast.domain.ForecastScenarioStatus;
import com.buildsight.platform.forecast.domain.ProjectEvmSnapshot;
import com.buildsight.platform.forecast.domain.ProjectForecastScenario;
import com.buildsight.platform.forecast.repository.ProjectEvmSnapshotRepository;
import com.buildsight.platform.forecast.repository.ProjectForecastScenarioRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ForecastControlService {

    private final ProjectRepository
            projectRepository;

    private final ProjectForecastScenarioRepository
            scenarioRepository;

    private final ProjectEvmSnapshotRepository
            snapshotRepository;

    private final ForecastIntelligenceService
            intelligenceService;

    private final ForecastScenarioEngine
            scenarioEngine;

    private final ProjectMapper
            projectMapper;

    private final Clock
            clock;

    public ForecastControlService(
            ProjectRepository projectRepository,
            ProjectForecastScenarioRepository scenarioRepository,
            ProjectEvmSnapshotRepository snapshotRepository,
            ForecastIntelligenceService intelligenceService,
            ForecastScenarioEngine scenarioEngine,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.scenarioRepository =
                scenarioRepository;

        this.snapshotRepository =
                snapshotRepository;

        this.intelligenceService =
                intelligenceService;

        this.scenarioEngine =
                scenarioEngine;

        this.projectMapper =
                projectMapper;

        this.clock =
                clock;
    }

    @Transactional(readOnly = true)
    public ForecastControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        ForecastIntelligenceResponse intelligence =
                intelligenceService
                        .calculate(
                                projectId);

        List<ForecastScenarioResponse> scenarios =
                scenarioRepository
                        .findByProjectIdOrderByUpdatedAtDesc(
                                projectId)
                        .stream()
                        .map(
                                scenario ->
                                        response(
                                                scenario,
                                                intelligence))
                        .toList();

        List<EvmSnapshotResponse> history =
                snapshotRepository
                        .findByProjectIdOrderByDataDateDesc(
                                projectId)
                        .stream()
                        .map(
                                this::response)
                        .toList();

        return new ForecastControlResponse(
                projectMapper.toResponse(
                        project),
                intelligence,
                scenarios,
                history);
    }

    @Transactional(readOnly = true)
    public ForecastIntelligenceResponse intelligence(
            UUID projectId) {

        requireProject(
                projectId);

        return intelligenceService
                .calculate(
                        projectId);
    }

    @Transactional
    public EvmSnapshotResponse captureSnapshot(
            UUID projectId) {

        requireProject(
                projectId);

        LocalDate today =
                LocalDate.now(
                        clock);

        if (snapshotRepository
                .existsByProjectIdAndDataDate(
                        projectId,
                        today)) {

            throw new ConflictException(
                    "An EVM snapshot already exists for today.");
        }

        ForecastIntelligenceResponse current =
                intelligenceService
                        .calculate(
                                projectId);

        ProjectEvmSnapshot snapshot =
                ProjectEvmSnapshot.capture(
                        UUID.randomUUID(),
                        projectId,
                        current);

        return response(
                snapshotRepository.save(
                        snapshot));
    }

    @Transactional
    public ForecastScenarioResponse createScenario(
            UUID projectId,
            CreateForecastScenarioRequest request) {

        requireProject(
                projectId);

        String name =
                request.name()
                        .trim();

        if (scenarioRepository
                .existsByProjectIdAndNameIgnoreCase(
                        projectId,
                        name)) {

            throw new ConflictException(
                    "Forecast scenario '%s' already exists."
                            .formatted(
                                    name));
        }

        validateAssumptions(
                request.costAdjustmentPercentage(),
                request.scheduleAdjustmentDays(),
                request.productivityMultiplier(),
                request.procurementDelayDays(),
                request.commercialExposurePercentage(),
                request.riskContingencyPercentage(),
                request.resourceCapacityMultiplier());

        ProjectForecastScenario scenario =
                ProjectForecastScenario.create(
                        UUID.randomUUID(),
                        projectId,
                        name,
                        request.scenarioType(),
                        request.costAdjustmentPercentage(),
                        request.scheduleAdjustmentDays(),
                        request.productivityMultiplier(),
                        request.procurementDelayDays(),
                        request.commercialExposurePercentage(),
                        request.riskContingencyPercentage(),
                        request.resourceCapacityMultiplier(),
                        normalize(
                                request.notes()));

        ProjectForecastScenario saved =
                scenarioRepository.save(
                        scenario);

        return response(
                saved,
                intelligenceService.calculate(
                        projectId));
    }

    @Transactional
    public ForecastScenarioResponse updateScenario(
            UUID projectId,
            UUID scenarioId,
            UpdateForecastScenarioRequest request) {

        requireProject(
                projectId);

        ProjectForecastScenario scenario =
                requireScenario(
                        projectId,
                        scenarioId);

        verifyVersion(
                scenario.getVersion(),
                request.version());

        if (scenario.getStatus()
                != ForecastScenarioStatus.DRAFT) {

            throw new InvalidRequestException(
                    "Only a DRAFT forecast scenario can be edited.");
        }

        validateAssumptions(
                request.costAdjustmentPercentage(),
                request.scheduleAdjustmentDays(),
                request.productivityMultiplier(),
                request.procurementDelayDays(),
                request.commercialExposurePercentage(),
                request.riskContingencyPercentage(),
                request.resourceCapacityMultiplier());

        scenario.update(
                request.name()
                        .trim(),
                request.scenarioType(),
                request.costAdjustmentPercentage(),
                request.scheduleAdjustmentDays(),
                request.productivityMultiplier(),
                request.procurementDelayDays(),
                request.commercialExposurePercentage(),
                request.riskContingencyPercentage(),
                request.resourceCapacityMultiplier(),
                normalize(
                        request.notes()));

        ProjectForecastScenario saved =
                scenarioRepository
                        .saveAndFlush(
                                scenario);

        return response(
                saved,
                intelligenceService.calculate(
                        projectId));
    }

    @Transactional
    public ForecastScenarioResponse approveScenario(
            UUID projectId,
            UUID scenarioId) {

        requireProject(
                projectId);

        ProjectForecastScenario scenario =
                requireScenario(
                        projectId,
                        scenarioId);

        scenarioRepository
                .findFirstByProjectIdAndStatusOrderByUpdatedAtDesc(
                        projectId,
                        ForecastScenarioStatus.APPROVED)
                .filter(
                        existing ->
                                !existing.getId()
                                        .equals(
                                                scenarioId))
                .ifPresent(
                        existing -> {

                            existing.archive();

                            scenarioRepository.save(
                                    existing);
                        });

        try {

            scenario.approve();

        } catch (
                IllegalStateException exception) {

            throw new InvalidRequestException(
                    exception.getMessage());
        }

        ProjectForecastScenario saved =
                scenarioRepository
                        .saveAndFlush(
                                scenario);

        return response(
                saved,
                intelligenceService.calculate(
                        projectId));
    }

    @Transactional
    public ForecastScenarioResponse archiveScenario(
            UUID projectId,
            UUID scenarioId) {

        requireProject(
                projectId);

        ProjectForecastScenario scenario =
                requireScenario(
                        projectId,
                        scenarioId);

        scenario.archive();

        ProjectForecastScenario saved =
                scenarioRepository
                        .saveAndFlush(
                                scenario);

        return response(
                saved,
                intelligenceService.calculate(
                        projectId));
    }

    private ForecastScenarioResponse response(
            ProjectForecastScenario scenario,
            ForecastIntelligenceResponse intelligence) {

        return new ForecastScenarioResponse(
                scenario.getId(),
                scenario.getProjectId(),
                scenario.getName(),
                scenario.getScenarioType(),
                scenario.getStatus(),
                scenario.getCostAdjustmentPercentage(),
                scenario.getScheduleAdjustmentDays(),
                scenario.getProductivityMultiplier(),
                scenario.getProcurementDelayDays(),
                scenario.getCommercialExposurePercentage(),
                scenario.getRiskContingencyPercentage(),
                scenario.getResourceCapacityMultiplier(),
                scenario.getNotes(),
                scenario.getApprovedAt(),
                scenario.getVersion(),
                scenario.getCreatedAt(),
                scenario.getUpdatedAt(),
                scenarioEngine.evaluate(
                        intelligence,
                        scenario));
    }

    private EvmSnapshotResponse response(
            ProjectEvmSnapshot snapshot) {

        return new EvmSnapshotResponse(
                snapshot.getId(),
                snapshot.getProjectId(),
                snapshot.getDataDate(),
                snapshot.getBac(),
                snapshot.getPlannedValue(),
                snapshot.getEarnedValue(),
                snapshot.getActualCost(),
                snapshot.getCostVariance(),
                snapshot.getScheduleVariance(),
                snapshot.getCpi(),
                snapshot.getSpi(),
                snapshot.getEstimateAtCompletion(),
                snapshot.getEstimateToComplete(),
                snapshot.getVarianceAtCompletion(),
                snapshot.getTcpi(),
                snapshot.getForecastFinishDate(),
                snapshot.getScheduleVarianceDays(),
                snapshot.getPredictiveScore(),
                snapshot.getPredictiveRisk(),
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

    private ProjectForecastScenario requireScenario(
            UUID projectId,
            UUID scenarioId) {

        return scenarioRepository
                .findByIdAndProjectId(
                        scenarioId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Forecast scenario '%s' was not found."
                                                .formatted(
                                                        scenarioId)));
    }

    private void verifyVersion(
            long current,
            long requested) {

        if (current != requested) {

            throw new ConflictException(
                    "The forecast scenario changed in another operation. Refresh before submitting.");
        }
    }

    private void validateAssumptions(
            BigDecimal costAdjustmentPercentage,
            int scheduleAdjustmentDays,
            BigDecimal productivityMultiplier,
            int procurementDelayDays,
            BigDecimal commercialExposurePercentage,
            BigDecimal riskContingencyPercentage,
            BigDecimal resourceCapacityMultiplier) {

        range(
                costAdjustmentPercentage,
                new BigDecimal("-30"),
                new BigDecimal("100"),
                "Cost adjustment");

        if (scheduleAdjustmentDays < -60
                || scheduleAdjustmentDays > 365) {

            throw new InvalidRequestException(
                    "Schedule adjustment must be between -60 and 365 days.");
        }

        range(
                productivityMultiplier,
                new BigDecimal("0.50"),
                new BigDecimal("1.50"),
                "Productivity multiplier");

        if (procurementDelayDays < 0
                || procurementDelayDays > 365) {

            throw new InvalidRequestException(
                    "Procurement delay must be between 0 and 365 days.");
        }

        range(
                commercialExposurePercentage,
                BigDecimal.ZERO,
                new BigDecimal("50"),
                "Commercial exposure");

        range(
                riskContingencyPercentage,
                BigDecimal.ZERO,
                new BigDecimal("50"),
                "Risk contingency");

        range(
                resourceCapacityMultiplier,
                new BigDecimal("0.50"),
                new BigDecimal("1.50"),
                "Resource capacity multiplier");
    }

    private void range(
            BigDecimal value,
            BigDecimal minimum,
            BigDecimal maximum,
            String label) {

        if (value.compareTo(
                        minimum)
                < 0
                || value.compareTo(
                                maximum)
                        > 0) {

            throw new InvalidRequestException(
                    "%s is outside the permitted range."
                            .formatted(
                                    label));
        }
    }

    private String normalize(
            String value) {

        if (value == null) {
            return null;
        }

        String trimmed =
                value.trim();

        return trimmed.isEmpty()
                ? null
                : trimmed;
    }
}
