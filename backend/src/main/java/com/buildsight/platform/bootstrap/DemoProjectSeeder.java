package com.buildsight.platform.bootstrap;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.project.domain.MilestoneStatus;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectMilestone;
import com.buildsight.platform.project.domain.ProjectProgressUpdate;
import com.buildsight.platform.project.domain.ProjectStatus;
import com.buildsight.platform.project.repository.ProjectMilestoneRepository;
import com.buildsight.platform.project.repository.ProjectProgressUpdateRepository;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(10)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoProjectSeeder
        implements ApplicationRunner {

    private final ProjectRepository projectRepository;
    private final ProjectMilestoneRepository
            milestoneRepository;
    private final ProjectProgressUpdateRepository
            progressRepository;

    public DemoProjectSeeder(
            ProjectRepository projectRepository,
            ProjectMilestoneRepository milestoneRepository,
            ProjectProgressUpdateRepository progressRepository) {

        this.projectRepository = projectRepository;
        this.milestoneRepository =
                milestoneRepository;
        this.progressRepository =
                progressRepository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        seedProjects();

        seedCommandCenterData(
                "BS-2026-001");

        seedCommandCenterData(
                "BS-2026-002");

        seedCommandCenterData(
                "BS-2026-003");

        seedCommandCenterData(
                "BS-2026-004");
    }

    private void seedProjects() {
        if (projectRepository.count() > 0) {
            return;
        }

        projectRepository.saveAll(
                List.of(
                        Project.create(
                                UUID.randomUUID(),
                                "BS-2026-001",
                                "Riverside Office Renovation",
                                "Full interior renovation and MEP modernization for a multi-floor office asset.",
                                "Atlas Property Group",
                                "Paris, France",
                                new BigDecimal("4850000.00"),
                                new BigDecimal("4320000.00"),
                                LocalDate.of(
                                        2026,
                                        3,
                                        2),
                                LocalDate.of(
                                        2027,
                                        1,
                                        29),
                                ProjectStatus.ACTIVE,
                                new BigDecimal("48.50")),

                        Project.create(
                                UUID.randomUUID(),
                                "BS-2026-002",
                                "Marina Residence Phase II",
                                "Construction of a residential complex including structural, finishing and external works.",
                                "North Coast Developments",
                                "Tunis, Tunisia",
                                new BigDecimal("7650000.00"),
                                new BigDecimal("7010000.00"),
                                LocalDate.of(
                                        2026,
                                        5,
                                        18),
                                LocalDate.of(
                                        2027,
                                        8,
                                        27),
                                ProjectStatus.ACTIVE,
                                new BigDecimal("31.20")),

                        Project.create(
                                UUID.randomUUID(),
                                "BS-2026-003",
                                "Central Logistics Hub",
                                "Warehouse extension, logistics infrastructure and site circulation improvements.",
                                "Meridian Logistics",
                                "Lyon, France",
                                new BigDecimal("3280000.00"),
                                new BigDecimal("3100000.00"),
                                LocalDate.of(
                                        2026,
                                        10,
                                        5),
                                LocalDate.of(
                                        2027,
                                        7,
                                        16),
                                ProjectStatus.PLANNING,
                                new BigDecimal("0.00")),

                        Project.create(
                                UUID.randomUUID(),
                                "BS-2026-004",
                                "Grand Hotel Retrofit",
                                "Phased refurbishment of guest floors, public areas and building services.",
                                "Azure Hospitality",
                                "Nice, France",
                                new BigDecimal("5940000.00"),
                                new BigDecimal("5720000.00"),
                                LocalDate.of(
                                        2026,
                                        1,
                                        12),
                                LocalDate.of(
                                        2026,
                                        12,
                                        18),
                                ProjectStatus.ON_HOLD,
                                new BigDecimal("63.40"))
                ));

        projectRepository.flush();

        System.out.println(
                "[BuildSight] Local portfolio demo projects created.");
    }

    private void seedCommandCenterData(
            String projectCode) {

        Project project =
                projectRepository
                        .findByCodeIgnoreCase(projectCode)
                        .orElse(null);

        if (project == null) {
            return;
        }

        if (!milestoneRepository
                .existsByProjectId(project.getId())) {

            milestoneRepository.saveAll(
                    milestonesFor(
                            projectCode,
                            project.getId()));
        }

        if (!progressRepository
                .existsByProjectId(project.getId())) {

            progressRepository.saveAll(
                    progressFor(
                            projectCode,
                            project.getId()));
        }
    }

    private List<ProjectMilestone> milestonesFor(
            String projectCode,
            UUID projectId) {

        return switch (projectCode) {
            case "BS-2026-001" -> List.of(
                    milestone(
                            projectId,
                            "Design approval",
                            "Issued-for-construction design package approved.",
                            LocalDate.of(
                                    2026,
                                    4,
                                    15),
                            LocalDate.of(
                                    2026,
                                    4,
                                    18),
                            LocalDate.of(
                                    2026,
                                    4,
                                    17),
                            MilestoneStatus.COMPLETED,
                            "15.00",
                            10),

                    milestone(
                            projectId,
                            "Structural modifications",
                            "Primary structural alteration package completed.",
                            LocalDate.of(
                                    2026,
                                    7,
                                    15),
                            LocalDate.of(
                                    2026,
                                    7,
                                    20),
                            LocalDate.of(
                                    2026,
                                    7,
                                    20),
                            MilestoneStatus.COMPLETED,
                            "25.00",
                            20),

                    milestone(
                            projectId,
                            "MEP first fix",
                            "Mechanical, electrical and plumbing first-fix completion.",
                            LocalDate.of(
                                    2026,
                                    9,
                                    30),
                            LocalDate.of(
                                    2026,
                                    10,
                                    10),
                            null,
                            MilestoneStatus.IN_PROGRESS,
                            "25.00",
                            30),

                    milestone(
                            projectId,
                            "Practical completion",
                            "Operational handover and practical completion.",
                            LocalDate.of(
                                    2027,
                                    1,
                                    29),
                            LocalDate.of(
                                    2027,
                                    2,
                                    8),
                            null,
                            MilestoneStatus.PLANNED,
                            "35.00",
                            40)
            );

            case "BS-2026-002" -> List.of(
                    milestone(
                            projectId,
                            "Substructure complete",
                            "Foundations and substructure works complete.",
                            LocalDate.of(
                                    2026,
                                    8,
                                    20),
                            LocalDate.of(
                                    2026,
                                    8,
                                    25),
                            LocalDate.of(
                                    2026,
                                    8,
                                    24),
                            MilestoneStatus.COMPLETED,
                            "20.00",
                            10),

                    milestone(
                            projectId,
                            "Structure level 5",
                            "Superstructure reaches level five.",
                            LocalDate.of(
                                    2026,
                                    11,
                                    25),
                            LocalDate.of(
                                    2026,
                                    12,
                                    5),
                            null,
                            MilestoneStatus.IN_PROGRESS,
                            "25.00",
                            20),

                    milestone(
                            projectId,
                            "Envelope watertight",
                            "Building envelope achieves watertight condition.",
                            LocalDate.of(
                                    2027,
                                    3,
                                    12),
                            LocalDate.of(
                                    2027,
                                    3,
                                    19),
                            null,
                            MilestoneStatus.PLANNED,
                            "25.00",
                            30),

                    milestone(
                            projectId,
                            "Residential handover",
                            "Final residential handover milestone.",
                            LocalDate.of(
                                    2027,
                                    8,
                                    27),
                            LocalDate.of(
                                    2027,
                                    9,
                                    3),
                            null,
                            MilestoneStatus.PLANNED,
                            "30.00",
                            40)
            );

            case "BS-2026-003" -> List.of(
                    milestone(
                            projectId,
                            "Mobilization",
                            "Site establishment and mobilization.",
                            LocalDate.of(
                                    2026,
                                    10,
                                    5),
                            LocalDate.of(
                                    2026,
                                    10,
                                    5),
                            null,
                            MilestoneStatus.PLANNED,
                            "10.00",
                            10),

                    milestone(
                            projectId,
                            "Steel frame complete",
                            "Primary warehouse steel frame complete.",
                            LocalDate.of(
                                    2027,
                                    2,
                                    12),
                            LocalDate.of(
                                    2027,
                                    2,
                                    12),
                            null,
                            MilestoneStatus.PLANNED,
                            "35.00",
                            20),

                    milestone(
                            projectId,
                            "Operational readiness",
                            "Warehouse and logistics systems operationally ready.",
                            LocalDate.of(
                                    2027,
                                    7,
                                    16),
                            LocalDate.of(
                                    2027,
                                    7,
                                    16),
                            null,
                            MilestoneStatus.PLANNED,
                            "55.00",
                            30)
            );

            case "BS-2026-004" -> List.of(
                    milestone(
                            projectId,
                            "Guest floors phase 1",
                            "First guest-floor refurbishment phase.",
                            LocalDate.of(
                                    2026,
                                    5,
                                    20),
                            LocalDate.of(
                                    2026,
                                    5,
                                    28),
                            LocalDate.of(
                                    2026,
                                    5,
                                    27),
                            MilestoneStatus.COMPLETED,
                            "25.00",
                            10),

                    milestone(
                            projectId,
                            "Public areas",
                            "Public-area refurbishment completion.",
                            LocalDate.of(
                                    2026,
                                    8,
                                    20),
                            LocalDate.of(
                                    2026,
                                    9,
                                    3),
                            null,
                            MilestoneStatus.BLOCKED,
                            "25.00",
                            20),

                    milestone(
                            projectId,
                            "MEP commissioning",
                            "Building-services testing and commissioning.",
                            LocalDate.of(
                                    2026,
                                    11,
                                    15),
                            LocalDate.of(
                                    2026,
                                    11,
                                    28),
                            null,
                            MilestoneStatus.PLANNED,
                            "25.00",
                            30),

                    milestone(
                            projectId,
                            "Hotel reopening",
                            "Operational handover and reopening.",
                            LocalDate.of(
                                    2026,
                                    12,
                                    18),
                            LocalDate.of(
                                    2027,
                                    1,
                                    15),
                            null,
                            MilestoneStatus.PLANNED,
                            "25.00",
                            40)
            );

            default -> List.of();
        };
    }

    private List<ProjectProgressUpdate> progressFor(
            String projectCode,
            UUID projectId) {

        return switch (projectCode) {
            case "BS-2026-001" -> List.of(
                    progress(
                            projectId,
                            "18.00",
                            LocalDate.of(
                                    2026,
                                    5,
                                    1),
                            "Demolition and enabling works complete."),

                    progress(
                            projectId,
                            "34.50",
                            LocalDate.of(
                                    2026,
                                    7,
                                    20),
                            "Structural alteration package completed."),

                    progress(
                            projectId,
                            "48.50",
                            LocalDate.of(
                                    2026,
                                    9,
                                    1),
                            "MEP first-fix work advancing across active floors.")
            );

            case "BS-2026-002" -> List.of(
                    progress(
                            projectId,
                            "9.00",
                            LocalDate.of(
                                    2026,
                                    6,
                                    15),
                            "Mobilization and excavation underway."),

                    progress(
                            projectId,
                            "21.50",
                            LocalDate.of(
                                    2026,
                                    8,
                                    1),
                            "Foundation package substantially complete."),

                    progress(
                            projectId,
                            "31.20",
                            LocalDate.of(
                                    2026,
                                    9,
                                    2),
                            "Superstructure activities progressing.")
            );

            case "BS-2026-003" -> List.of(
                    progress(
                            projectId,
                            "0.00",
                            LocalDate.of(
                                    2026,
                                    9,
                                    1),
                            "Preconstruction and mobilization planning.")
            );

            case "BS-2026-004" -> List.of(
                    progress(
                            projectId,
                            "28.00",
                            LocalDate.of(
                                    2026,
                                    4,
                                    30),
                            "Initial guest-floor work progressing."),

                    progress(
                            projectId,
                            "52.50",
                            LocalDate.of(
                                    2026,
                                    7,
                                    31),
                            "Phase-one guest-floor refurbishment complete."),

                    progress(
                            projectId,
                            "63.40",
                            LocalDate.of(
                                    2026,
                                    8,
                                    28),
                            "Public-area work paused pending design resolution.")
            );

            default -> List.of();
        };
    }

    private ProjectMilestone milestone(
            UUID projectId,
            String name,
            String description,
            LocalDate plannedDate,
            LocalDate forecastDate,
            LocalDate actualDate,
            MilestoneStatus status,
            String weight,
            int sortOrder) {

        return ProjectMilestone.create(
                UUID.randomUUID(),
                projectId,
                name,
                description,
                plannedDate,
                forecastDate,
                actualDate,
                status,
                new BigDecimal(weight),
                sortOrder);
    }

    private ProjectProgressUpdate progress(
            UUID projectId,
            String percentage,
            LocalDate date,
            String note) {

        return ProjectProgressUpdate.create(
                UUID.randomUUID(),
                projectId,
                new BigDecimal(percentage),
                date,
                note);
    }
}
