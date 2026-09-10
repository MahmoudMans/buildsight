package com.buildsight.platform.schedule.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.schedule.domain.ProjectScheduleActivity;
import com.buildsight.platform.schedule.domain.ProjectScheduleDependency;
import com.buildsight.platform.schedule.domain.ScheduleDependencyType;

import org.junit.jupiter.api.Test;

class ScheduleNetworkCalculatorTest {

    private final ScheduleNetworkCalculator calculator =
            new ScheduleNetworkCalculator();

    @Test
    void finishStartChainProducesCriticalPathAndZeroFloat() {

        LocalDate dataDate =
                LocalDate.of(
                        2026,
                        9,
                        10);

        ProjectScheduleActivity a =
                activity(
                        "A",
                        dataDate,
                        5);

        ProjectScheduleActivity b =
                activity(
                        "B",
                        dataDate.plusDays(5),
                        4);

        ProjectScheduleActivity c =
                activity(
                        "C",
                        dataDate.plusDays(9),
                        3);

        var result =
                calculator.calculate(
                        List.of(
                                a,
                                b,
                                c),
                        List.of(
                                dependency(
                                        a,
                                        b),
                                dependency(
                                        b,
                                        c)),
                        dataDate);

        assertTrue(
                result.valid());

        assertEquals(
                12,
                result.projectDurationDays());

        assertEquals(
                List.of(
                        "A",
                        "B",
                        "C"),
                result.criticalActivityCodes());

        assertEquals(
                0,
                result.metrics()
                        .get(
                                a.getId())
                        .totalFloatDays());

        assertEquals(
                0,
                result.metrics()
                        .get(
                                b.getId())
                        .totalFloatDays());

        assertEquals(
                0,
                result.metrics()
                        .get(
                                c.getId())
                        .totalFloatDays());
    }

    @Test
    void parallelShortActivityGetsPositiveFloat() {

        LocalDate dataDate =
                LocalDate.of(
                        2026,
                        9,
                        10);

        ProjectScheduleActivity start =
                activity(
                        "START",
                        dataDate,
                        2);

        ProjectScheduleActivity longPath =
                activity(
                        "LONG",
                        dataDate.plusDays(2),
                        10);

        ProjectScheduleActivity shortPath =
                activity(
                        "SHORT",
                        dataDate.plusDays(2),
                        3);

        ProjectScheduleActivity finish =
                activity(
                        "FINISH",
                        dataDate.plusDays(12),
                        2);

        var result =
                calculator.calculate(
                        List.of(
                                start,
                                longPath,
                                shortPath,
                                finish),
                        List.of(
                                dependency(
                                        start,
                                        longPath),
                                dependency(
                                        start,
                                        shortPath),
                                dependency(
                                        longPath,
                                        finish),
                                dependency(
                                        shortPath,
                                        finish)),
                        dataDate);

        assertTrue(
                result.valid());

        assertTrue(
                result.metrics()
                        .get(
                                shortPath.getId())
                        .totalFloatDays()
                        > 0);

        assertFalse(
                result.metrics()
                        .get(
                                shortPath.getId())
                        .critical());

        assertTrue(
                result.metrics()
                        .get(
                                longPath.getId())
                        .critical());
    }

    @Test
    void circularDependenciesInvalidateNetwork() {

        LocalDate dataDate =
                LocalDate.of(
                        2026,
                        9,
                        10);

        ProjectScheduleActivity a =
                activity(
                        "A",
                        dataDate,
                        3);

        ProjectScheduleActivity b =
                activity(
                        "B",
                        dataDate,
                        3);

        var result =
                calculator.calculate(
                        List.of(
                                a,
                                b),
                        List.of(
                                dependency(
                                        a,
                                        b),
                                dependency(
                                        b,
                                        a)),
                        dataDate);

        assertFalse(
                result.valid());

        assertTrue(
                result.error()
                        .contains(
                                "cycle"));
    }

    private ProjectScheduleActivity activity(
            String code,
            LocalDate start,
            int duration) {

        return ProjectScheduleActivity.create(
                UUID.randomUUID(),
                UUID.randomUUID(),
                code,
                code,
                "General",
                null,
                start,
                start.plusDays(
                        duration - 1L),
                duration);
    }

    private ProjectScheduleDependency dependency(
            ProjectScheduleActivity predecessor,
            ProjectScheduleActivity successor) {

        return ProjectScheduleDependency.create(
                UUID.randomUUID(),
                predecessor.getProjectId(),
                predecessor.getId(),
                successor.getId(),
                ScheduleDependencyType.FS,
                0);
    }
}
