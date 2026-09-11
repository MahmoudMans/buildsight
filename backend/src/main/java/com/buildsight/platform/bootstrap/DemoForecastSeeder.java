package com.buildsight.platform.bootstrap;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.forecast.domain.ForecastScenarioType;
import com.buildsight.platform.forecast.domain.ProjectForecastScenario;
import com.buildsight.platform.forecast.repository.ProjectForecastScenarioRepository;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(120)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoForecastSeeder
        implements ApplicationRunner {

    private final ProjectRepository
            projectRepository;

    private final ProjectForecastScenarioRepository
            scenarioRepository;

    public DemoForecastSeeder(
            ProjectRepository projectRepository,
            ProjectForecastScenarioRepository scenarioRepository) {

        this.projectRepository =
                projectRepository;

        this.scenarioRepository =
                scenarioRepository;
    }

    @Override
    @Transactional
    public void run(
            ApplicationArguments args) {

        for (Project project :
                projectRepository.findAll()) {

            if (scenarioRepository
                    .existsByProjectId(
                            project.getId())) {

                continue;
            }

            ProjectForecastScenario base =
                    scenario(
                            project,
                            "Management Base Case",
                            ForecastScenarioType.BASE,
                            "0",
                            0,
                            "1.00",
                            0,
                            "0",
                            "3",
                            "1.00",
                            "Current management assumptions.");

            ProjectForecastScenario optimistic =
                    scenario(
                            project,
                            "Recovery Case",
                            ForecastScenarioType.OPTIMISTIC,
                            "-3",
                            -7,
                            "1.08",
                            0,
                            "0",
                            "2",
                            "1.08",
                            "Productivity recovery and stronger resource availability.");

            ProjectForecastScenario downside =
                    scenario(
                            project,
                            "Downside Case",
                            ForecastScenarioType.PESSIMISTIC,
                            "8",
                            14,
                            "0.88",
                            10,
                            "4",
                            "8",
                            "0.90",
                            "Combined cost pressure, procurement delay and reduced productivity.");

            base.approve();

            scenarioRepository.saveAll(
                    List.of(
                            base,
                            optimistic,
                            downside));
        }

        System.out.println(
                "[BuildSight] Forecast scenario demo data ready.");
    }

    private ProjectForecastScenario scenario(
            Project project,
            String name,
            ForecastScenarioType type,
            String cost,
            int schedule,
            String productivity,
            int procurement,
            String commercial,
            String contingency,
            String resources,
            String notes) {

        return ProjectForecastScenario.create(
                UUID.randomUUID(),
                project.getId(),
                name,
                type,
                new BigDecimal(
                        cost),
                schedule,
                new BigDecimal(
                        productivity),
                procurement,
                new BigDecimal(
                        commercial),
                new BigDecimal(
                        contingency),
                new BigDecimal(
                        resources),
                notes);
    }
}
