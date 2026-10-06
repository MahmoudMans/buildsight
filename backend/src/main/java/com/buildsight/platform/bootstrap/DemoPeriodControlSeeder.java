package com.buildsight.platform.bootstrap;

import java.time.Clock;
import java.time.LocalDate;

import com.buildsight.platform.periodcontrol.api.PeriodControlModels.CaptureBaselineRequest;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.CreateProgressPeriodRequest;
import com.buildsight.platform.periodcontrol.repository.ProjectControlBaselineVersionRepository;
import com.buildsight.platform.periodcontrol.repository.ProjectProgressPeriodRepository;
import com.buildsight.platform.periodcontrol.service.PeriodControlService;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(150)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoPeriodControlSeeder
        implements ApplicationRunner {

    private final ProjectRepository
            projectRepository;

    private final ProjectControlBaselineVersionRepository
            baselineRepository;

    private final ProjectProgressPeriodRepository
            periodRepository;

    private final PeriodControlService
            periodControlService;

    private final Clock
            clock;

    public DemoPeriodControlSeeder(
            ProjectRepository projectRepository,
            ProjectControlBaselineVersionRepository baselineRepository,
            ProjectProgressPeriodRepository periodRepository,
            PeriodControlService periodControlService,
            Clock clock) {

        this.projectRepository =
                projectRepository;

        this.baselineRepository =
                baselineRepository;

        this.periodRepository =
                periodRepository;

        this.periodControlService =
                periodControlService;

        this.clock =
                clock;
    }

    @Override
    public void run(
            ApplicationArguments args) {

        LocalDate today =
                LocalDate.now(
                        clock);

        for (Project project :
                projectRepository.findAll()) {

            if (!baselineRepository
                    .existsByProjectId(
                            project.getId())) {

                var baseline =
                        periodControlService
                                .captureBaseline(
                                        project.getId(),
                                        new CaptureBaselineRequest(
                                                "CBL-001",
                                                "Initial control baseline",
                                                "Initial period-control baseline captured from the approved predictive position.",
                                                null));

                periodControlService
                        .approveBaseline(
                                project.getId(),
                                baseline.id());
            }

            if (!periodRepository
                    .existsByProjectId(
                            project.getId())) {

                periodControlService
                        .createPeriod(
                                project.getId(),
                                new CreateProgressPeriodRequest(
                                        today.getYear()
                                                + "-"
                                                + "%02d".formatted(
                                                        today.getMonthValue()),
                                        today.getMonth()
                                                .name()
                                                .replace(
                                                        "_",
                                                        " ")
                                                + " "
                                                + today.getYear(),
                                        today.withDayOfMonth(
                                                1),
                                        today.withDayOfMonth(
                                                today.lengthOfMonth())));
            }
        }

        System.out.println(
                "[BuildSight] Period-control demo data ready.");
    }
}
