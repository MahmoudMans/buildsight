package com.buildsight.platform.bootstrap;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;
import com.buildsight.platform.schedule.domain.ProjectScheduleActivity;
import com.buildsight.platform.schedule.domain.ProjectScheduleBaseline;
import com.buildsight.platform.schedule.domain.ProjectScheduleBaselineActivity;
import com.buildsight.platform.schedule.domain.ProjectScheduleConstraint;
import com.buildsight.platform.schedule.domain.ProjectScheduleDependency;
import com.buildsight.platform.schedule.domain.ScheduleActivityStatus;
import com.buildsight.platform.schedule.domain.ScheduleConstraintType;
import com.buildsight.platform.schedule.domain.ScheduleDependencyType;
import com.buildsight.platform.schedule.repository.ProjectScheduleActivityRepository;
import com.buildsight.platform.schedule.repository.ProjectScheduleBaselineActivityRepository;
import com.buildsight.platform.schedule.repository.ProjectScheduleBaselineRepository;
import com.buildsight.platform.schedule.repository.ProjectScheduleConstraintRepository;
import com.buildsight.platform.schedule.repository.ProjectScheduleDependencyRepository;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(110)
@ConditionalOnProperty(
        name = "buildsight.demo.seed-enabled",
        havingValue = "true")
public class DemoScheduleSeeder
        implements ApplicationRunner {

    private final ProjectRepository
            projectRepository;

    private final ProjectScheduleActivityRepository
            activityRepository;

    private final ProjectScheduleDependencyRepository
            dependencyRepository;

    private final ProjectScheduleConstraintRepository
            constraintRepository;

    private final ProjectScheduleBaselineRepository
            baselineRepository;

    private final ProjectScheduleBaselineActivityRepository
            baselineActivityRepository;

    public DemoScheduleSeeder(
            ProjectRepository projectRepository,
            ProjectScheduleActivityRepository activityRepository,
            ProjectScheduleDependencyRepository dependencyRepository,
            ProjectScheduleConstraintRepository constraintRepository,
            ProjectScheduleBaselineRepository baselineRepository,
            ProjectScheduleBaselineActivityRepository baselineActivityRepository) {

        this.projectRepository =
                projectRepository;

        this.activityRepository =
                activityRepository;

        this.dependencyRepository =
                dependencyRepository;

        this.constraintRepository =
                constraintRepository;

        this.baselineRepository =
                baselineRepository;

        this.baselineActivityRepository =
                baselineActivityRepository;
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

        if (activityRepository
                .existsByProjectId(
                        project.getId())) {

            return;
        }

        LocalDate today =
                LocalDate.now();

        boolean stressed =
                project.getCode()
                        .endsWith("004");

        ProjectScheduleActivity design =
                activity(
                        project,
                        "SCH-100",
                        "Complete coordinated design",
                        "Design",
                        today.minusDays(35),
                        today.minusDays(20),
                        16);

        design.update(
                design.getName(),
                design.getDiscipline(),
                null,
                design.getCurrentStart(),
                design.getCurrentFinish(),
                design.getOriginalDurationDays(),
                0,
                today.minusDays(35),
                today.minusDays(19),
                new BigDecimal("100"),
                ScheduleActivityStatus.COMPLETED);

        ProjectScheduleActivity procurement =
                activity(
                        project,
                        "SCH-200",
                        "Procure long-lead materials",
                        "Procurement",
                        today.minusDays(18),
                        stressed
                                ? today.plusDays(8)
                                : today.minusDays(2),
                        stressed
                                ? 27
                                : 17);

        procurement.update(
                procurement.getName(),
                procurement.getDiscipline(),
                null,
                procurement.getCurrentStart(),
                procurement.getCurrentFinish(),
                procurement.getOriginalDurationDays(),
                stressed
                        ? 8
                        : 0,
                today.minusDays(18),
                stressed
                        ? null
                        : today.minusDays(2),
                stressed
                        ? new BigDecimal("72")
                        : new BigDecimal("100"),
                stressed
                        ? ScheduleActivityStatus.IN_PROGRESS
                        : ScheduleActivityStatus.COMPLETED);

        ProjectScheduleActivity install =
                activity(
                        project,
                        "SCH-300",
                        "Primary installation works",
                        "Construction",
                        stressed
                                ? today.plusDays(7)
                                : today.plusDays(1),
                        stressed
                                ? today.plusDays(32)
                                : today.plusDays(20),
                        stressed
                                ? 26
                                : 20);

        ProjectScheduleActivity test =
                activity(
                        project,
                        "SCH-400",
                        "Testing and commissioning",
                        "Commissioning",
                        stressed
                                ? today.plusDays(33)
                                : today.plusDays(21),
                        stressed
                                ? today.plusDays(47)
                                : today.plusDays(31),
                        stressed
                                ? 15
                                : 11);

        ProjectScheduleActivity handover =
                activity(
                        project,
                        "SCH-500",
                        "Handover and completion",
                        "Closeout",
                        stressed
                                ? today.plusDays(48)
                                : today.plusDays(32),
                        stressed
                                ? today.plusDays(55)
                                : today.plusDays(38),
                        stressed
                                ? 8
                                : 7);

        activityRepository.saveAll(
                List.of(
                        design,
                        procurement,
                        install,
                        test,
                        handover));

        dependencyRepository.saveAll(
                List.of(
                        dependency(
                                project,
                                design,
                                procurement),
                        dependency(
                                project,
                                procurement,
                                install),
                        dependency(
                                project,
                                install,
                                test),
                        dependency(
                                project,
                                test,
                                handover)));

        if (stressed) {

            constraintRepository.save(
                    ProjectScheduleConstraint.create(
                            UUID.randomUUID(),
                            project.getId(),
                            install.getId(),
                            ScheduleConstraintType.MATERIAL,
                            "Long-lead finish material release",
                            "Procurement Manager",
                            today.minusDays(2)));
        }

        ProjectScheduleBaseline baseline =
                ProjectScheduleBaseline.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "Contract Baseline 01",
                        today.minusDays(45));

        baseline.approve();

        baselineRepository.save(
                baseline);

        baselineActivityRepository.saveAll(
                List.of(
                        baseline(
                                baseline,
                                design,
                                today.minusDays(40),
                                today.minusDays(25),
                                true),
                        baseline(
                                baseline,
                                procurement,
                                today.minusDays(24),
                                today.minusDays(8),
                                true),
                        baseline(
                                baseline,
                                install,
                                today.minusDays(7),
                                today.plusDays(12),
                                true),
                        baseline(
                                baseline,
                                test,
                                today.plusDays(13),
                                today.plusDays(23),
                                true),
                        baseline(
                                baseline,
                                handover,
                                today.plusDays(24),
                                today.plusDays(30),
                                true)));

        System.out.println(
                "[BuildSight] Schedule demo data created for "
                        + project.getCode());
    }

    private ProjectScheduleActivity activity(
            Project project,
            String code,
            String name,
            String discipline,
            LocalDate start,
            LocalDate finish,
            int duration) {

        return ProjectScheduleActivity.create(
                UUID.randomUUID(),
                project.getId(),
                code,
                name,
                discipline,
                null,
                start,
                finish,
                duration);
    }

    private ProjectScheduleDependency dependency(
            Project project,
            ProjectScheduleActivity predecessor,
            ProjectScheduleActivity successor) {

        return ProjectScheduleDependency.create(
                UUID.randomUUID(),
                project.getId(),
                predecessor.getId(),
                successor.getId(),
                ScheduleDependencyType.FS,
                0);
    }

    private ProjectScheduleBaselineActivity baseline(
            ProjectScheduleBaseline baseline,
            ProjectScheduleActivity activity,
            LocalDate start,
            LocalDate finish,
            boolean critical) {

        return ProjectScheduleBaselineActivity.create(
                UUID.randomUUID(),
                baseline.getId(),
                activity.getActivityCode(),
                activity.getName(),
                start,
                finish,
                Math.max(
                        1,
                        (int) java.time.temporal.ChronoUnit.DAYS.between(
                                start,
                                finish)
                                + 1),
                critical);
    }
}
