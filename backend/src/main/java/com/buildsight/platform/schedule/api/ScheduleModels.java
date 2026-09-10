package com.buildsight.platform.schedule.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.project.api.ProjectResponse;
import com.buildsight.platform.project.api.ScheduleRiskLevel;
import com.buildsight.platform.schedule.domain.ScheduleActivityStatus;
import com.buildsight.platform.schedule.domain.ScheduleBaselineStatus;
import com.buildsight.platform.schedule.domain.ScheduleConstraintStatus;
import com.buildsight.platform.schedule.domain.ScheduleConstraintType;
import com.buildsight.platform.schedule.domain.ScheduleDependencyType;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public final class ScheduleModels {

    private ScheduleModels() {
    }

    public record CreateScheduleActivityRequest(
            @NotBlank
            @Size(max = 64)
            String activityCode,

            @NotBlank
            @Size(max = 220)
            String name,

            @Size(max = 100)
            String discipline,

            UUID workPackageId,

            @NotNull
            LocalDate currentStart,

            @NotNull
            LocalDate currentFinish,

            @Min(0)
            int originalDurationDays) {
    }

    public record UpdateScheduleActivityRequest(
            @PositiveOrZero
            long version,

            @NotBlank
            @Size(max = 220)
            String name,

            @Size(max = 100)
            String discipline,

            UUID workPackageId,

            @NotNull
            LocalDate currentStart,

            @NotNull
            LocalDate currentFinish,

            @Min(0)
            int originalDurationDays,

            @Min(0)
            int remainingDurationDays,

            LocalDate actualStart,

            LocalDate actualFinish,

            @NotNull
            @DecimalMin("0.00")
            @DecimalMax("100.00")
            BigDecimal progressPercentage,

            @NotNull
            ScheduleActivityStatus status) {
    }

    public record ScheduleActivityResponse(
            UUID id,
            UUID projectId,
            String activityCode,
            String name,
            String discipline,
            UUID workPackageId,
            LocalDate currentStart,
            LocalDate currentFinish,
            int originalDurationDays,
            int remainingDurationDays,
            LocalDate actualStart,
            LocalDate actualFinish,
            BigDecimal progressPercentage,
            ScheduleActivityStatus status,
            long earlyStartDay,
            long earlyFinishDay,
            long lateStartDay,
            long lateFinishDay,
            long totalFloatDays,
            boolean critical,
            boolean nearCritical,
            boolean overdue,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CreateDependencyRequest(
            @NotNull
            UUID predecessorActivityId,

            @NotNull
            UUID successorActivityId,

            @NotNull
            ScheduleDependencyType dependencyType,

            int lagDays) {
    }

    public record ScheduleDependencyResponse(
            UUID id,
            UUID projectId,
            UUID predecessorActivityId,
            String predecessorCode,
            UUID successorActivityId,
            String successorCode,
            ScheduleDependencyType dependencyType,
            int lagDays,
            Instant createdAt) {
    }

    public record CreateScheduleConstraintRequest(
            @NotNull
            UUID activityId,

            @NotNull
            ScheduleConstraintType constraintType,

            @NotBlank
            @Size(max = 220)
            String title,

            @Size(max = 160)
            String ownerName,

            @NotNull
            LocalDate dueDate) {
    }

    public record UpdateScheduleConstraintRequest(
            @PositiveOrZero
            long version,

            @NotNull
            ScheduleConstraintType constraintType,

            @NotBlank
            @Size(max = 220)
            String title,

            @Size(max = 160)
            String ownerName,

            @NotNull
            LocalDate dueDate,

            @NotNull
            ScheduleConstraintStatus status,

            String resolutionNotes) {
    }

    public record ScheduleConstraintResponse(
            UUID id,
            UUID projectId,
            UUID activityId,
            String activityCode,
            ScheduleConstraintType constraintType,
            String title,
            String ownerName,
            LocalDate dueDate,
            ScheduleConstraintStatus status,
            String resolutionNotes,
            LocalDate resolvedDate,
            boolean overdue,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CaptureBaselineRequest(
            @NotBlank
            @Size(max = 180)
            String name,

            @NotNull
            LocalDate dataDate) {
    }

    public record ScheduleBaselineResponse(
            UUID id,
            UUID projectId,
            String name,
            LocalDate dataDate,
            ScheduleBaselineStatus status,
            Instant approvedAt,
            long activityCount,
            LocalDate baselineFinishDate,
            long version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ScheduleIntelligenceResponse(
            LocalDate dataDate,
            boolean networkValid,
            String networkError,
            long activityCount,
            long completedActivities,
            long inProgressActivities,
            long overdueActivities,
            long criticalActivities,
            long nearCriticalActivities,
            long criticalPathLengthDays,
            double averageTotalFloatDays,
            long openConstraints,
            long overdueConstraints,
            long constrainedCriticalActivities,
            long lookahead14DayActivities,
            long lookahead28DayActivities,
            long lookahead42DayActivities,
            String approvedBaselineName,
            LocalDate baselineFinishDate,
            LocalDate cpmForecastFinishDate,
            long baselineFinishVarianceDays,
            long projectFinishVarianceDays,
            double scheduleScore,
            ScheduleRiskLevel scheduleRisk,
            List<String> criticalPathActivityCodes,
            String explanation) {

        public static ScheduleIntelligenceResponse legacy(
                LocalDate dataDate,
                LocalDate forecastFinish,
                long projectFinishVarianceDays,
                double scheduleScore,
                ScheduleRiskLevel scheduleRisk) {

            return new ScheduleIntelligenceResponse(
                    dataDate,
                    true,
                    null,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    0,
                    null,
                    null,
                    forecastFinish,
                    0,
                    projectFinishVarianceDays,
                    scheduleScore,
                    scheduleRisk,
                    List.of(),
                    "Legacy project-level schedule fallback.");
        }
    }

    public record ScheduleLookaheadActivityResponse(
            UUID activityId,
            String activityCode,
            String name,
            String discipline,
            LocalDate currentStart,
            LocalDate currentFinish,
            BigDecimal progressPercentage,
            long totalFloatDays,
            boolean critical,
            boolean nearCritical,
            long openConstraints,
            boolean constrained) {
    }

    public record ScheduleLookaheadResponse(
            int weeks,
            LocalDate fromDate,
            LocalDate toDate,
            long activityCount,
            long criticalActivities,
            long constrainedActivities,
            List<ScheduleLookaheadActivityResponse> activities) {
    }

    public record ScheduleControlResponse(
            ProjectResponse project,
            ScheduleIntelligenceResponse intelligence,
            List<ScheduleBaselineResponse> baselines,
            List<ScheduleActivityResponse> activities,
            List<ScheduleDependencyResponse> dependencies,
            List<ScheduleConstraintResponse> constraints) {
    }
}
