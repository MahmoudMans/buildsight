package com.buildsight.platform.resource.service;

import java.math.BigDecimal;
import java.time.Clock;
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
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.project.service.ProjectMapper;
import com.buildsight.platform.resource.api.ResourceModels.CreateEquipmentRequest;
import com.buildsight.platform.resource.api.ResourceModels.CreateEquipmentUsageRequest;
import com.buildsight.platform.resource.api.ResourceModels.CreateResourceForecastRequest;
import com.buildsight.platform.resource.api.ResourceModels.CreateWorkforceDeploymentRequest;
import com.buildsight.platform.resource.api.ResourceModels.CreateWorkforcePlanRequest;
import com.buildsight.platform.resource.api.ResourceModels.EquipmentResponse;
import com.buildsight.platform.resource.api.ResourceModels.EquipmentUsageResponse;
import com.buildsight.platform.resource.api.ResourceModels.ResourceControlResponse;
import com.buildsight.platform.resource.api.ResourceModels.ResourceForecastResponse;
import com.buildsight.platform.resource.api.ResourceModels.ResourceIntelligenceResponse;
import com.buildsight.platform.resource.api.ResourceModels.UpdateEquipmentRequest;
import com.buildsight.platform.resource.api.ResourceModels.UpdateEquipmentUsageRequest;
import com.buildsight.platform.resource.api.ResourceModels.UpdateResourceForecastRequest;
import com.buildsight.platform.resource.api.ResourceModels.UpdateWorkforceDeploymentRequest;
import com.buildsight.platform.resource.api.ResourceModels.UpdateWorkforcePlanRequest;
import com.buildsight.platform.resource.api.ResourceModels.WorkforceDeploymentResponse;
import com.buildsight.platform.resource.api.ResourceModels.WorkforcePlanResponse;
import com.buildsight.platform.resource.domain.EquipmentStatus;
import com.buildsight.platform.resource.domain.ProjectEquipment;
import com.buildsight.platform.resource.domain.ProjectEquipmentUsageLog;
import com.buildsight.platform.resource.domain.ProjectResourceDemandForecast;
import com.buildsight.platform.resource.domain.ProjectWorkforceDeployment;
import com.buildsight.platform.resource.domain.ProjectWorkforcePlan;
import com.buildsight.platform.resource.domain.WorkforcePlanStatus;
import com.buildsight.platform.resource.repository.ProjectEquipmentRepository;
import com.buildsight.platform.resource.repository.ProjectEquipmentUsageLogRepository;
import com.buildsight.platform.resource.repository.ProjectResourceDemandForecastRepository;
import com.buildsight.platform.resource.repository.ProjectWorkforceDeploymentRepository;
import com.buildsight.platform.resource.repository.ProjectWorkforcePlanRepository;

import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ResourceControlService {

    private static final Map<
            WorkforcePlanStatus,
            Set<WorkforcePlanStatus>>
            PLAN_TRANSITIONS =
            planTransitions();

    private static final Map<
            EquipmentStatus,
            Set<EquipmentStatus>>
            EQUIPMENT_TRANSITIONS =
            equipmentTransitions();

    private final ProjectRepository
            projectRepository;

    private final ProjectWorkforcePlanRepository
            planRepository;

    private final ProjectWorkforceDeploymentRepository
            deploymentRepository;

    private final ProjectEquipmentRepository
            equipmentRepository;

    private final ProjectEquipmentUsageLogRepository
            usageRepository;

    private final ProjectResourceDemandForecastRepository
            forecastRepository;

    private final ResourceIntelligenceService
            intelligenceService;

    private final ProjectMapper
            projectMapper;

    private final NamedParameterJdbcTemplate
            jdbcTemplate;

    private final Clock
            clock;

    public ResourceControlService(
            ProjectRepository projectRepository,
            ProjectWorkforcePlanRepository planRepository,
            ProjectWorkforceDeploymentRepository deploymentRepository,
            ProjectEquipmentRepository equipmentRepository,
            ProjectEquipmentUsageLogRepository usageRepository,
            ProjectResourceDemandForecastRepository forecastRepository,
            ResourceIntelligenceService intelligenceService,
            ProjectMapper projectMapper,
            NamedParameterJdbcTemplate jdbcTemplate,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.planRepository =
                planRepository;

        this.deploymentRepository =
                deploymentRepository;

        this.equipmentRepository =
                equipmentRepository;

        this.usageRepository =
                usageRepository;

        this.forecastRepository =
                forecastRepository;

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
    public ResourceControlResponse get(
            UUID projectId) {

        Project project =
                requireProject(
                        projectId);

        List<ProjectWorkforcePlan> plans =
                planRepository
                        .findByProjectIdOrderByPeriodStartDescTradeAsc(
                                projectId);

        List<ProjectWorkforceDeployment> deployments =
                deploymentRepository
                        .findByProjectIdOrderByWorkDateDescCreatedAtDesc(
                                projectId);

        List<ProjectEquipment> equipment =
                equipmentRepository
                        .findByProjectIdOrderByCodeAsc(
                                projectId);

        List<ProjectEquipmentUsageLog> usage =
                usageRepository
                        .findByProjectIdOrderByWorkDateDescCreatedAtDesc(
                                projectId);

        List<ProjectResourceDemandForecast> forecasts =
                forecastRepository
                        .findByProjectIdOrderByPeriodStartAscResourceTypeAscResourceKeyAsc(
                                projectId);

        Map<UUID, String> equipmentCodes =
                equipment.stream()
                        .collect(
                                java.util.stream.Collectors.toMap(
                                        ProjectEquipment::getId,
                                        ProjectEquipment::getCode));

        return new ResourceControlResponse(
                projectMapper.toResponse(
                        project),

                intelligenceService.calculate(
                        plans,
                        deployments,
                        equipment,
                        usage,
                        forecasts),

                plans.stream()
                        .map(this::toPlanResponse)
                        .toList(),

                deployments.stream()
                        .map(this::toDeploymentResponse)
                        .toList(),

                equipment.stream()
                        .map(this::toEquipmentResponse)
                        .toList(),

                usage.stream()
                        .map(
                                log ->
                                        toUsageResponse(
                                                log,
                                                equipmentCodes.get(
                                                        log.getEquipmentId())))
                        .toList(),

                forecasts.stream()
                        .map(this::toForecastResponse)
                        .toList());
    }

    @Transactional(readOnly = true)
    public ResourceIntelligenceResponse intelligence(
            UUID projectId) {

        requireProject(
                projectId);

        return intelligenceService.calculate(
                planRepository
                        .findByProjectIdOrderByPeriodStartDescTradeAsc(
                                projectId),

                deploymentRepository
                        .findByProjectIdOrderByWorkDateDescCreatedAtDesc(
                                projectId),

                equipmentRepository
                        .findByProjectIdOrderByCodeAsc(
                                projectId),

                usageRepository
                        .findByProjectIdOrderByWorkDateDescCreatedAtDesc(
                                projectId),

                forecastRepository
                        .findByProjectIdOrderByPeriodStartAscResourceTypeAscResourceKeyAsc(
                                projectId));
    }

    @Transactional
    public WorkforcePlanResponse createWorkforcePlan(
            UUID projectId,
            CreateWorkforcePlanRequest request) {

        requireProject(
                projectId);

        validatePeriod(
                request.periodStart(),
                request.periodEnd());

        validateHours(
                request.plannedRegularHours(),
                request.plannedProductiveHours(),
                "Planned productive hours cannot exceed planned regular hours.");

        validateWorkPackage(
                projectId,
                request.workPackageId());

        ProjectWorkforcePlan plan =
                ProjectWorkforcePlan.create(
                        UUID.randomUUID(),
                        projectId,
                        request.periodStart(),
                        request.periodEnd(),
                        request.trade().trim(),
                        request.workPackageId(),
                        request.plannedWorkers(),
                        request.plannedRegularHours(),
                        request.plannedProductiveHours(),
                        request.plannedProductivityRate());

        return toPlanResponse(
                planRepository.save(
                        plan));
    }

    @Transactional
    public WorkforcePlanResponse updateWorkforcePlan(
            UUID projectId,
            UUID planId,
            UpdateWorkforcePlanRequest request) {

        requireProject(
                projectId);

        ProjectWorkforcePlan plan =
                planRepository
                        .findByIdAndProjectId(
                                planId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Workforce plan '%s' was not found."
                                                        .formatted(planId)));

        verifyVersion(
                plan.getVersion(),
                request.version(),
                "workforce plan");

        validateTransition(
                PLAN_TRANSITIONS,
                plan.getStatus(),
                request.status(),
                "workforce plan");

        validatePeriod(
                request.periodStart(),
                request.periodEnd());

        validateHours(
                request.plannedRegularHours(),
                request.plannedProductiveHours(),
                "Planned productive hours cannot exceed planned regular hours.");

        validateWorkPackage(
                projectId,
                request.workPackageId());

        if (request.status()
                        == WorkforcePlanStatus.APPROVED
                && (
                    request.plannedWorkers() <= 0
                    || request.plannedRegularHours()
                            .signum() <= 0
                )) {

            throw new InvalidRequestException(
                    "An approved workforce plan requires planned workers and labor hours.");
        }

        plan.update(
                request.periodStart(),
                request.periodEnd(),
                request.trade().trim(),
                request.workPackageId(),
                request.plannedWorkers(),
                request.plannedRegularHours(),
                request.plannedProductiveHours(),
                request.plannedProductivityRate(),
                request.status());

        return toPlanResponse(
                planRepository
                        .saveAndFlush(
                                plan));
    }

    @Transactional
    public WorkforceDeploymentResponse createDeployment(
            UUID projectId,
            CreateWorkforceDeploymentRequest request) {

        requireProject(
                projectId);

        validateNotFuture(
                request.workDate(),
                "Workforce deployment date");

        validateWorkPackage(
                projectId,
                request.workPackageId());

        validateHours(
                request.regularHours()
                        .add(
                                request.overtimeHours()),
                request.productiveHours(),
                "Productive labor hours cannot exceed total labor hours.");

        ProjectWorkforceDeployment deployment =
                ProjectWorkforceDeployment.create(
                        UUID.randomUUID(),
                        projectId,
                        request.workDate(),
                        request.trade().trim(),
                        request.workPackageId(),
                        request.workers(),
                        request.regularHours(),
                        request.overtimeHours(),
                        request.productiveHours(),
                        request.quantityCompleted(),
                        request.plannedProductivityRate(),
                        normalize(
                                request.notes()));

        return toDeploymentResponse(
                deploymentRepository.save(
                        deployment));
    }

    @Transactional
    public WorkforceDeploymentResponse updateDeployment(
            UUID projectId,
            UUID deploymentId,
            UpdateWorkforceDeploymentRequest request) {

        requireProject(
                projectId);

        ProjectWorkforceDeployment deployment =
                deploymentRepository
                        .findByIdAndProjectId(
                                deploymentId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Workforce deployment '%s' was not found."
                                                        .formatted(
                                                                deploymentId)));

        verifyVersion(
                deployment.getVersion(),
                request.version(),
                "workforce deployment");

        validateNotFuture(
                request.workDate(),
                "Workforce deployment date");

        validateWorkPackage(
                projectId,
                request.workPackageId());

        validateHours(
                request.regularHours()
                        .add(
                                request.overtimeHours()),
                request.productiveHours(),
                "Productive labor hours cannot exceed total labor hours.");

        deployment.update(
                request.workDate(),
                request.trade().trim(),
                request.workPackageId(),
                request.workers(),
                request.regularHours(),
                request.overtimeHours(),
                request.productiveHours(),
                request.quantityCompleted(),
                request.plannedProductivityRate(),
                normalize(
                        request.notes()));

        return toDeploymentResponse(
                deploymentRepository
                        .saveAndFlush(
                                deployment));
    }

    @Transactional
    public EquipmentResponse createEquipment(
            UUID projectId,
            CreateEquipmentRequest request) {

        requireProject(
                projectId);

        String code =
                reference(
                        request.code());

        if (equipmentRepository
                .existsByProjectIdAndCodeIgnoreCase(
                        projectId,
                        code)) {

            throw new ConflictException(
                    "Equipment code '%s' already exists."
                            .formatted(code));
        }

        ProjectEquipment equipment =
                ProjectEquipment.create(
                        UUID.randomUUID(),
                        projectId,
                        code,
                        request.description().trim(),
                        request.category().trim(),
                        request.ownership(),
                        request.dailyCost());

        return toEquipmentResponse(
                equipmentRepository.save(
                        equipment));
    }

    @Transactional
    public EquipmentResponse updateEquipment(
            UUID projectId,
            UUID equipmentId,
            UpdateEquipmentRequest request) {

        requireProject(
                projectId);

        ProjectEquipment equipment =
                requireEquipment(
                        projectId,
                        equipmentId);

        verifyVersion(
                equipment.getVersion(),
                request.version(),
                "equipment");

        validateTransition(
                EQUIPMENT_TRANSITIONS,
                equipment.getStatus(),
                request.status(),
                "equipment");

        equipment.update(
                request.description().trim(),
                request.category().trim(),
                request.ownership(),
                request.status(),
                request.dailyCost());

        return toEquipmentResponse(
                equipmentRepository
                        .saveAndFlush(
                                equipment));
    }

    @Transactional
    public EquipmentUsageResponse createEquipmentUsage(
            UUID projectId,
            CreateEquipmentUsageRequest request) {

        requireProject(
                projectId);

        ProjectEquipment equipment =
                requireEquipment(
                        projectId,
                        request.equipmentId());

        validateNotFuture(
                request.workDate(),
                "Equipment usage date");

        validateWorkPackage(
                projectId,
                request.workPackageId());

        validateUsageHours(
                request.availableHours(),
                request.operatingHours(),
                request.idleHours(),
                request.downtimeHours());

        if (usageRepository
                .existsByEquipmentIdAndWorkDate(
                        equipment.getId(),
                        request.workDate())) {

            throw new ConflictException(
                    "Equipment '%s' already has a usage log for %s."
                            .formatted(
                                    equipment.getCode(),
                                    request.workDate()));
        }

        ProjectEquipmentUsageLog log =
                ProjectEquipmentUsageLog.create(
                        UUID.randomUUID(),
                        projectId,
                        equipment.getId(),
                        request.workPackageId(),
                        request.workDate(),
                        request.availableHours(),
                        request.operatingHours(),
                        request.idleHours(),
                        request.downtimeHours(),
                        normalize(
                                request.notes()));

        return toUsageResponse(
                usageRepository.save(
                        log),
                equipment.getCode());
    }

    @Transactional
    public EquipmentUsageResponse updateEquipmentUsage(
            UUID projectId,
            UUID usageId,
            UpdateEquipmentUsageRequest request) {

        requireProject(
                projectId);

        ProjectEquipmentUsageLog log =
                usageRepository
                        .findByIdAndProjectId(
                                usageId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Equipment usage '%s' was not found."
                                                        .formatted(usageId)));

        ProjectEquipment equipment =
                requireEquipment(
                        projectId,
                        log.getEquipmentId());

        verifyVersion(
                log.getVersion(),
                request.version(),
                "equipment usage");

        validateNotFuture(
                request.workDate(),
                "Equipment usage date");

        validateWorkPackage(
                projectId,
                request.workPackageId());

        validateUsageHours(
                request.availableHours(),
                request.operatingHours(),
                request.idleHours(),
                request.downtimeHours());

        log.update(
                request.workPackageId(),
                request.workDate(),
                request.availableHours(),
                request.operatingHours(),
                request.idleHours(),
                request.downtimeHours(),
                normalize(
                        request.notes()));

        return toUsageResponse(
                usageRepository
                        .saveAndFlush(
                                log),
                equipment.getCode());
    }

    @Transactional
    public ResourceForecastResponse createForecast(
            UUID projectId,
            CreateResourceForecastRequest request) {

        requireProject(
                projectId);

        validatePeriod(
                request.periodStart(),
                request.periodEnd());

        String resourceKey =
                request.resourceKey()
                        .trim();

        if (forecastRepository
                .existsByProjectIdAndPeriodStartAndResourceTypeAndResourceKeyIgnoreCase(
                        projectId,
                        request.periodStart(),
                        request.resourceType(),
                        resourceKey)) {

            throw new ConflictException(
                    "A resource forecast for '%s' already exists for this period."
                            .formatted(resourceKey));
        }

        ProjectResourceDemandForecast forecast =
                ProjectResourceDemandForecast.create(
                        UUID.randomUUID(),
                        projectId,
                        request.periodStart(),
                        request.periodEnd(),
                        request.resourceType(),
                        resourceKey,
                        request.requiredQuantity(),
                        request.availableQuantity(),
                        normalize(
                                request.notes()));

        return toForecastResponse(
                forecastRepository.save(
                        forecast));
    }

    @Transactional
    public ResourceForecastResponse updateForecast(
            UUID projectId,
            UUID forecastId,
            UpdateResourceForecastRequest request) {

        requireProject(
                projectId);

        ProjectResourceDemandForecast forecast =
                forecastRepository
                        .findByIdAndProjectId(
                                forecastId,
                                projectId)
                        .orElseThrow(
                                () ->
                                        new ResourceNotFoundException(
                                                "Resource forecast '%s' was not found."
                                                        .formatted(forecastId)));

        verifyVersion(
                forecast.getVersion(),
                request.version(),
                "resource forecast");

        validatePeriod(
                request.periodStart(),
                request.periodEnd());

        forecast.update(
                request.periodStart(),
                request.periodEnd(),
                request.resourceType(),
                request.resourceKey().trim(),
                request.requiredQuantity(),
                request.availableQuantity(),
                normalize(
                        request.notes()),
                request.status());

        return toForecastResponse(
                forecastRepository
                        .saveAndFlush(
                                forecast));
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
                                                .formatted(projectId)));
    }

    private ProjectEquipment requireEquipment(
            UUID projectId,
            UUID equipmentId) {

        return equipmentRepository
                .findByIdAndProjectId(
                        equipmentId,
                        projectId)
                .orElseThrow(
                        () ->
                                new ResourceNotFoundException(
                                        "Equipment '%s' was not found."
                                                .formatted(equipmentId)));
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
                            .formatted(workPackageId));
        }
    }

    private void validatePeriod(
            LocalDate start,
            LocalDate end) {

        if (end.isBefore(start)) {

            throw new InvalidRequestException(
                    "Period end cannot be before period start.");
        }
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

    private void validateHours(
            BigDecimal maximum,
            BigDecimal actual,
            String message) {

        if (actual.compareTo(
                maximum) > 0) {

            throw new InvalidRequestException(
                    message);
        }
    }

    private void validateUsageHours(
            BigDecimal available,
            BigDecimal operating,
            BigDecimal idle,
            BigDecimal downtime) {

        BigDecimal consumed =
                operating
                        .add(idle)
                        .add(downtime);

        if (consumed.compareTo(
                available) > 0) {

            throw new InvalidRequestException(
                    "Operating, idle and downtime hours cannot exceed available equipment hours.");
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

    private WorkforcePlanResponse toPlanResponse(
            ProjectWorkforcePlan plan) {

        return new WorkforcePlanResponse(
                plan.getId(),
                plan.getProjectId(),
                plan.getPeriodStart(),
                plan.getPeriodEnd(),
                plan.getTrade(),
                plan.getWorkPackageId(),
                plan.getPlannedWorkers(),
                plan.getPlannedRegularHours(),
                plan.getPlannedProductiveHours(),
                plan.getPlannedProductivityRate(),
                plan.getStatus(),
                plan.getVersion(),
                plan.getCreatedAt(),
                plan.getUpdatedAt());
    }

    private WorkforceDeploymentResponse toDeploymentResponse(
            ProjectWorkforceDeployment deployment) {

        return new WorkforceDeploymentResponse(
                deployment.getId(),
                deployment.getProjectId(),
                deployment.getWorkDate(),
                deployment.getTrade(),
                deployment.getWorkPackageId(),
                deployment.getWorkers(),
                deployment.getRegularHours(),
                deployment.getOvertimeHours(),
                deployment.totalLaborHours(),
                deployment.getProductiveHours(),
                deployment.getQuantityCompleted(),
                deployment.getPlannedProductivityRate(),
                deployment.actualProductivityRate(),
                deployment.productivityIndex(),
                deployment.getNotes(),
                deployment.getVersion(),
                deployment.getCreatedAt(),
                deployment.getUpdatedAt());
    }

    private EquipmentResponse toEquipmentResponse(
            ProjectEquipment equipment) {

        return new EquipmentResponse(
                equipment.getId(),
                equipment.getProjectId(),
                equipment.getCode(),
                equipment.getDescription(),
                equipment.getCategory(),
                equipment.getOwnership(),
                equipment.getStatus(),
                equipment.getDailyCost(),
                equipment.getVersion(),
                equipment.getCreatedAt(),
                equipment.getUpdatedAt());
    }

    private EquipmentUsageResponse toUsageResponse(
            ProjectEquipmentUsageLog log,
            String equipmentCode) {

        double utilization =
                log.getAvailableHours()
                                .signum() <= 0
                        ? 0
                        : log.getOperatingHours()
                                .multiply(
                                        BigDecimal.valueOf(100))
                                .divide(
                                        log.getAvailableHours(),
                                        6,
                                        java.math.RoundingMode.HALF_UP)
                                .doubleValue();

        return new EquipmentUsageResponse(
                log.getId(),
                log.getProjectId(),
                log.getEquipmentId(),
                equipmentCode,
                log.getWorkPackageId(),
                log.getWorkDate(),
                log.getAvailableHours(),
                log.getOperatingHours(),
                log.getIdleHours(),
                log.getDowntimeHours(),
                Math.round(
                                utilization
                                        * 10.0)
                        / 10.0,
                log.getNotes(),
                log.getVersion(),
                log.getCreatedAt(),
                log.getUpdatedAt());
    }

    private ResourceForecastResponse toForecastResponse(
            ProjectResourceDemandForecast forecast) {

        return new ResourceForecastResponse(
                forecast.getId(),
                forecast.getProjectId(),
                forecast.getPeriodStart(),
                forecast.getPeriodEnd(),
                forecast.getResourceType(),
                forecast.getResourceKey(),
                forecast.getRequiredQuantity(),
                forecast.getAvailableQuantity(),
                forecast.shortage(),
                forecast.getNotes(),
                forecast.getStatus(),
                forecast.getVersion(),
                forecast.getCreatedAt(),
                forecast.getUpdatedAt());
    }

    private static Map<
            WorkforcePlanStatus,
            Set<WorkforcePlanStatus>>
    planTransitions() {

        Map<
                WorkforcePlanStatus,
                Set<WorkforcePlanStatus>>
                map =
                new EnumMap<>(
                        WorkforcePlanStatus.class);

        map.put(
                WorkforcePlanStatus.DRAFT,
                Set.of(
                        WorkforcePlanStatus.APPROVED));

        map.put(
                WorkforcePlanStatus.APPROVED,
                Set.of(
                        WorkforcePlanStatus.CLOSED));

        map.put(
                WorkforcePlanStatus.CLOSED,
                Set.of());

        return Map.copyOf(
                map);
    }

    private static Map<
            EquipmentStatus,
            Set<EquipmentStatus>>
    equipmentTransitions() {

        Map<
                EquipmentStatus,
                Set<EquipmentStatus>>
                map =
                new EnumMap<>(
                        EquipmentStatus.class);

        map.put(
                EquipmentStatus.AVAILABLE,
                Set.of(
                        EquipmentStatus.DEPLOYED,
                        EquipmentStatus.IDLE,
                        EquipmentStatus.MAINTENANCE,
                        EquipmentStatus.OFF_HIRE));

        map.put(
                EquipmentStatus.DEPLOYED,
                Set.of(
                        EquipmentStatus.AVAILABLE,
                        EquipmentStatus.IDLE,
                        EquipmentStatus.MAINTENANCE,
                        EquipmentStatus.OFF_HIRE));

        map.put(
                EquipmentStatus.IDLE,
                Set.of(
                        EquipmentStatus.AVAILABLE,
                        EquipmentStatus.DEPLOYED,
                        EquipmentStatus.MAINTENANCE,
                        EquipmentStatus.OFF_HIRE));

        map.put(
                EquipmentStatus.MAINTENANCE,
                Set.of(
                        EquipmentStatus.AVAILABLE,
                        EquipmentStatus.OFF_HIRE));

        map.put(
                EquipmentStatus.OFF_HIRE,
                Set.of());

        return Map.copyOf(
                map);
    }
}
