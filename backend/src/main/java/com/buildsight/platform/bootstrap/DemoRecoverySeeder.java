package com.buildsight.platform.bootstrap;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.recovery.domain.ProjectChangeImpactSimulation;
import com.buildsight.platform.recovery.domain.ProjectRecoveryOption;
import com.buildsight.platform.recovery.domain.RecoveryStrategyType;
import com.buildsight.platform.recovery.repository.ProjectChangeImpactSimulationRepository;
import com.buildsight.platform.recovery.repository.ProjectRecoveryOptionRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(140)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoRecoverySeeder
        implements ApplicationRunner {

    private final ProjectRepository
            projectRepository;

    private final ProjectChangeImpactSimulationRepository
            simulationRepository;

    private final ProjectRecoveryOptionRepository
            optionRepository;

    public DemoRecoverySeeder(
            ProjectRepository projectRepository,
            ProjectChangeImpactSimulationRepository simulationRepository,
            ProjectRecoveryOptionRepository optionRepository) {

        this.projectRepository =
                projectRepository;

        this.simulationRepository =
                simulationRepository;

        this.optionRepository =
                optionRepository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        for (Project project :
                projectRepository.findAll()) {

            if (simulationRepository
                    .existsByProjectId(
                            project.getId())) {

                continue;
            }

            seed(
                    project);
        }

        System.out.println(
                "[BuildSight] Change-impact and recovery demo data ready.");
    }

    private void seed(
            Project project) {

        boolean stressed =
                project.getCode()
                        .endsWith("004");

        ProjectChangeImpactSimulation simulation =
                ProjectChangeImpactSimulation.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "SIM-001",
                        stressed
                                ? "Critical procurement and access impact"
                                : "Coordination change impact",
                        stressed
                                ? "CHG-004"
                                : "CHG-001",
                        "Management simulation of combined cost and schedule exposure.",
                        new BigDecimal(
                                stressed
                                        ? "150000"
                                        : "25000"),
                        stressed
                                ? 21
                                : 7,
                        new BigDecimal(
                                stressed
                                        ? "-12"
                                        : "-5"),
                        stressed
                                ? 10
                                : 3,
                        new BigDecimal(
                                stressed
                                        ? "-10"
                                        : "-3"),
                        new BigDecimal(
                                stressed
                                        ? "12"
                                        : "5"),
                        "Simulation assumptions are analytical and do not alter the commercial change record.");

        simulation.approve(
                Instant.now());

        simulationRepository.save(
                simulation);

        ProjectRecoveryOption resequence =
                ProjectRecoveryOption.create(
                        UUID.randomUUID(),
                        project.getId(),
                        simulation.getId(),
                        "REC-001",
                        "Resequence and focused acceleration",
                        RecoveryStrategyType.COMBINED,
                        stressed
                                ? 10
                                : 4,
                        new BigDecimal(
                                stressed
                                        ? "55000"
                                        : "10000"),
                        new BigDecimal(
                                stressed
                                        ? "7"
                                        : "4"),
                        stressed
                                ? 4
                                : 1,
                        new BigDecimal(
                                stressed
                                        ? "6"
                                        : "3"),
                        new BigDecimal(
                                stressed
                                        ? "25"
                                        : "15"),
                        "Resequence unaffected work while adding focused resources to impacted packages.");

        ProjectRecoveryOption acceleration =
                ProjectRecoveryOption.create(
                        UUID.randomUUID(),
                        project.getId(),
                        simulation.getId(),
                        "REC-002",
                        "Full acceleration",
                        RecoveryStrategyType.ACCELERATION,
                        stressed
                                ? 18
                                : 7,
                        new BigDecimal(
                                stressed
                                        ? "110000"
                                        : "28000"),
                        new BigDecimal(
                                stressed
                                        ? "12"
                                        : "7"),
                        stressed
                                ? 7
                                : 2,
                        new BigDecimal(
                                stressed
                                        ? "12"
                                        : "6"),
                        new BigDecimal(
                                stressed
                                        ? "18"
                                        : "10"),
                        "Higher-cost acceleration option focused on maximum programme recovery.");

        optionRepository.saveAll(
                List.of(
                        resequence,
                        acceleration));
    }
}
