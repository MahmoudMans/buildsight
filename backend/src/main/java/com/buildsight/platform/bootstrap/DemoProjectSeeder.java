package com.buildsight.platform.bootstrap;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectStatus;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoProjectSeeder implements ApplicationRunner {

    private final ProjectRepository projectRepository;

    public DemoProjectSeeder(ProjectRepository projectRepository) {
        this.projectRepository = projectRepository;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (projectRepository.count() > 0) {
            return;
        }

        projectRepository.saveAll(List.of(
                Project.create(
                        UUID.randomUUID(),
                        "BS-2026-001",
                        "Riverside Office Renovation",
                        "Full interior renovation and MEP modernization for a multi-floor office asset.",
                        "Atlas Property Group",
                        "Paris, France",
                        new BigDecimal("4850000.00"),
                        new BigDecimal("4320000.00"),
                        LocalDate.of(2026, 3, 2),
                        LocalDate.of(2027, 1, 29),
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
                        LocalDate.of(2026, 5, 18),
                        LocalDate.of(2027, 8, 27),
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
                        LocalDate.of(2026, 10, 5),
                        LocalDate.of(2027, 7, 16),
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
                        LocalDate.of(2026, 1, 12),
                        LocalDate.of(2026, 12, 18),
                        ProjectStatus.ON_HOLD,
                        new BigDecimal("63.40"))
        ));

        System.out.println(
                "[BuildSight] Local portfolio demo projects created.");
    }
}
