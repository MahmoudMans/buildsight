package com.buildsight.platform.schedule.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.project.api.ScheduleRiskLevel;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectStatus;
import com.buildsight.platform.schedule.domain.ProjectScheduleActivity;
import com.buildsight.platform.schedule.domain.ProjectScheduleBaseline;
import com.buildsight.platform.schedule.domain.ProjectScheduleBaselineActivity;
import com.buildsight.platform.schedule.domain.ProjectScheduleConstraint;
import com.buildsight.platform.schedule.domain.ProjectScheduleDependency;
import com.buildsight.platform.schedule.domain.ScheduleConstraintType;
import com.buildsight.platform.schedule.domain.ScheduleDependencyType;

import org.junit.jupiter.api.Test;

class ScheduleIntelligenceServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(
                    Instant.parse(
                            "2026-09-10T10:00:00Z"),
                    ZoneOffset.UTC);

    private final ScheduleIntelligenceService service =
            new ScheduleIntelligenceService(
                    new ScheduleNetworkCalculator(),
                    CLOCK);

    @Test
    void baselineSlippageAndCriticalConstraintProduceAtRiskSchedule() {

        Project project =
                project();

        ProjectScheduleActivity a =
                activity(
                        project,
                        "A",
                        LocalDate.of(
                                2026,
                                9,
                                10),
                        10);

        ProjectScheduleActivity b =
                activity(
                        project,
                        "B",
                        LocalDate.of(
                                2026,
                                9,
                                20),
                        15);

        ProjectScheduleDependency dependency =
                ProjectScheduleDependency.create(
                        UUID.randomUUID(),
                        project.getId(),
                        a.getId(),
                        b.getId(),
                        ScheduleDependencyType.FS,
                        0);

        ProjectScheduleConstraint constraint =
                ProjectScheduleConstraint.create(
                        UUID.randomUUID(),
                        project.getId(),
                        b.getId(),
                        ScheduleConstraintType.MATERIAL,
                        "Material release",
                        "Procurement",
                        LocalDate.of(
                                2026,
                                9,
                                5));

        ProjectScheduleBaseline baseline =
                ProjectScheduleBaseline.create(
                        UUID.randomUUID(),
                        project.getId(),
                        "Baseline 01",
                        LocalDate.of(
                                2026,
                                8,
                                1));

        baseline.approve();

        List<ProjectScheduleBaselineActivity> baselineActivities =
                List.of(
                        ProjectScheduleBaselineActivity.create(
                                UUID.randomUUID(),
                                baseline.getId(),
                                "A",
                                "A",
                                LocalDate.of(
                                        2026,
                                        8,
                                        1),
                                LocalDate.of(
                                        2026,
                                        8,
                                        5),
                                5,
                                true),

                        ProjectScheduleBaselineActivity.create(
                                UUID.randomUUID(),
                                baseline.getId(),
                                "B",
                                "B",
                                LocalDate.of(
                                        2026,
                                        8,
                                        6),
                                LocalDate.of(
                                        2026,
                                        8,
                                        15),
                                10,
                                true));

        var result =
                service.calculate(
                        project,
                        Optional.of(
                                baseline),
                        baselineActivities,
                        List.of(
                                a,
                                b),
                        List.of(
                                dependency),
                        List.of(
                                constraint));

        assertTrue(
                result.networkValid());

        assertEquals(
                2,
                result.criticalActivities());

        assertEquals(
                1,
                result.constrainedCriticalActivities());

        assertEquals(
                1,
                result.overdueConstraints());

        assertTrue(
                result.baselineFinishVarianceDays()
                        > 0);

        assertEquals(
                ScheduleRiskLevel.AT_RISK,
                result.scheduleRisk());

        assertTrue(
                result.scheduleScore()
                        < 60);
    }

    @Test
    void noDetailedScheduleReturnsNeutralWatchScore() {

        var result =
                service.calculate(
                        project(),
                        Optional.empty(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of());

        assertEquals(
                75,
                result.scheduleScore());

        assertEquals(
                ScheduleRiskLevel.WATCH,
                result.scheduleRisk());
    }

    private Project project() {

        return Project.create(
                UUID.randomUUID(),
                "BS-SCH",
                "Schedule Test",
                "Schedule",
                "Client",
                "Paris",
                new BigDecimal(
                        "1000000"),
                new BigDecimal(
                        "900000"),
                LocalDate.of(
                        2026,
                        7,
                        1),
                LocalDate.of(
                        2026,
                        12,
                        31),
                ProjectStatus.ACTIVE,
                new BigDecimal(
                        "30"));
    }

    private ProjectScheduleActivity activity(
            Project project,
            String code,
            LocalDate start,
            int duration) {

        return ProjectScheduleActivity.create(
                UUID.randomUUID(),
                project.getId(),
                code,
                code,
                "General",
                null,
                start,
                start.plusDays(
                        duration - 1L),
                duration);
    }
}
