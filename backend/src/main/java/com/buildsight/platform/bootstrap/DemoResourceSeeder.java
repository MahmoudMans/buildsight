package com.buildsight.platform.bootstrap;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.resource.domain.EquipmentOwnership;
import com.buildsight.platform.resource.domain.EquipmentStatus;
import com.buildsight.platform.resource.domain.ProjectEquipment;
import com.buildsight.platform.resource.domain.ProjectEquipmentUsageLog;
import com.buildsight.platform.resource.domain.ProjectResourceDemandForecast;
import com.buildsight.platform.resource.domain.ProjectWorkforceDeployment;
import com.buildsight.platform.resource.domain.ProjectWorkforcePlan;
import com.buildsight.platform.resource.domain.ResourceDemandType;
import com.buildsight.platform.resource.domain.WorkforcePlanStatus;
import com.buildsight.platform.resource.repository.ProjectEquipmentRepository;
import com.buildsight.platform.resource.repository.ProjectEquipmentUsageLogRepository;
import com.buildsight.platform.resource.repository.ProjectResourceDemandForecastRepository;
import com.buildsight.platform.resource.repository.ProjectWorkforceDeploymentRepository;
import com.buildsight.platform.resource.repository.ProjectWorkforcePlanRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(100)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoResourceSeeder
        implements ApplicationRunner {

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

    private final NamedParameterJdbcTemplate
            jdbcTemplate;

    public DemoResourceSeeder(
            ProjectRepository projectRepository,
            ProjectWorkforcePlanRepository planRepository,
            ProjectWorkforceDeploymentRepository deploymentRepository,
            ProjectEquipmentRepository equipmentRepository,
            ProjectEquipmentUsageLogRepository usageRepository,
            ProjectResourceDemandForecastRepository forecastRepository,
            NamedParameterJdbcTemplate jdbcTemplate) {

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

        this.jdbcTemplate =
                jdbcTemplate;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        for (Project project :
                projectRepository.findAll()) {

            seed(
                    project);
        }
    }

    private void seed(
            Project project) {

        if (planRepository
                .existsByProjectId(
                        project.getId())) {

            return;
        }

        LocalDate today =
                LocalDate.now();

        boolean stressed =
                project.getCode()
                        .endsWith("004");

        UUID workPackageId =
                firstWorkPackage(
                        project.getId());

        ProjectWorkforcePlan plan =
                ProjectWorkforcePlan.create(
                        UUID.randomUUID(),
                        project.getId(),
                        today.minusDays(6),
                        today,
                        stressed
                                ? "Finishes"
                                : "MEP",
                        workPackageId,
                        stressed
                                ? 18
                                : 12,
                        stressed
                                ? new BigDecimal("864")
                                : new BigDecimal("576"),
                        stressed
                                ? new BigDecimal("650")
                                : new BigDecimal("475"),
                        new BigDecimal("0.075"));

        plan.update(
                plan.getPeriodStart(),
                plan.getPeriodEnd(),
                plan.getTrade(),
                plan.getWorkPackageId(),
                plan.getPlannedWorkers(),
                plan.getPlannedRegularHours(),
                plan.getPlannedProductiveHours(),
                plan.getPlannedProductivityRate(),
                WorkforcePlanStatus.APPROVED);

        planRepository.save(
                plan);

        ProjectWorkforceDeployment deployment =
                ProjectWorkforceDeployment.create(
                        UUID.randomUUID(),
                        project.getId(),
                        today.minusDays(1),
                        plan.getTrade(),
                        workPackageId,
                        stressed
                                ? 13
                                : 12,
                        stressed
                                ? new BigDecimal("104")
                                : new BigDecimal("96"),
                        stressed
                                ? new BigDecimal("28")
                                : new BigDecimal("6"),
                        stressed
                                ? new BigDecimal("68")
                                : new BigDecimal("87"),
                        stressed
                                ? new BigDecimal("2.8")
                                : new BigDecimal("7.0"),
                        new BigDecimal("0.075"),
                        stressed
                                ? "Trade deployment below planned efficiency."
                                : "Normal daily workforce deployment.");

        deploymentRepository.save(
                deployment);

        ProjectEquipment equipment =
                ProjectEquipment.create(
                        UUID.randomUUID(),
                        project.getId(),
                        equipmentCode(
                                project,
                                1),
                        stressed
                                ? "Mobile access platform"
                                : "Material hoist",
                        stressed
                                ? "Access Equipment"
                                : "Lifting Equipment",
                        EquipmentOwnership.RENTED,
                        stressed
                                ? new BigDecimal("650")
                                : new BigDecimal("420"));

        equipment.update(
                equipment.getDescription(),
                equipment.getCategory(),
                equipment.getOwnership(),
                stressed
                        ? EquipmentStatus.IDLE
                        : EquipmentStatus.DEPLOYED,
                equipment.getDailyCost());

        equipmentRepository.save(
                equipment);

        ProjectEquipmentUsageLog usage =
                ProjectEquipmentUsageLog.create(
                        UUID.randomUUID(),
                        project.getId(),
                        equipment.getId(),
                        workPackageId,
                        today.minusDays(1),
                        new BigDecimal("10"),
                        stressed
                                ? new BigDecimal("1.5")
                                : new BigDecimal("7.8"),
                        stressed
                                ? new BigDecimal("6.5")
                                : new BigDecimal("1.5"),
                        stressed
                                ? new BigDecimal("2")
                                : new BigDecimal("0.7"),
                        stressed
                                ? "Equipment remained materially underutilized."
                                : "Equipment utilization within expected range.");

        usageRepository.save(
                usage);

        ProjectResourceDemandForecast laborForecast =
                ProjectResourceDemandForecast.create(
                        UUID.randomUUID(),
                        project.getId(),
                        today.plusDays(1),
                        today.plusDays(14),
                        ResourceDemandType.LABOR,
                        plan.getTrade(),
                        stressed
                                ? new BigDecimal("24")
                                : new BigDecimal("14"),
                        stressed
                                ? new BigDecimal("13")
                                : new BigDecimal("15"),
                        "Forward workforce demand.");

        ProjectResourceDemandForecast equipmentForecast =
                ProjectResourceDemandForecast.create(
                        UUID.randomUUID(),
                        project.getId(),
                        today.plusDays(1),
                        today.plusDays(14),
                        ResourceDemandType.EQUIPMENT,
                        equipment.getCategory(),
                        stressed
                                ? new BigDecimal("4")
                                : new BigDecimal("2"),
                        stressed
                                ? new BigDecimal("1")
                                : new BigDecimal("2"),
                        "Forward equipment demand.");

        forecastRepository.saveAll(
                List.of(
                        laborForecast,
                        equipmentForecast));

        System.out.println(
                "[BuildSight] Resource demo data created for "
                        + project.getCode());
    }

    private UUID firstWorkPackage(
            UUID projectId) {

        List<UUID> ids =
                jdbcTemplate.query(
                        """
                        SELECT id
                        FROM project_work_packages
                        WHERE project_id = :projectId
                        ORDER BY id
                        LIMIT 1
                        """,

                        Map.of(
                                "projectId",
                                projectId),

                        (
                                resultSet,
                                rowNumber) ->
                                resultSet.getObject(
                                        "id",
                                        UUID.class));

        return ids.isEmpty()
                ? null
                : ids.get(0);
    }

    private String equipmentCode(
            Project project,
            int number) {

        return "EQ-"
                + project.getCode()
                        .replace(
                                "BS-",
                                "")
                + "-"
                + String.format(
                        "%02d",
                        number);
    }
}
