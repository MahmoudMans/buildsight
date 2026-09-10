package com.buildsight.platform.schedule.domain;

import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_schedule_baseline_activities")
public class ProjectScheduleBaselineActivity {

    @Id
    private UUID id;

    @Column(
            name = "baseline_id",
            nullable = false,
            updatable = false)
    private UUID baselineId;

    @Column(
            name = "activity_code",
            nullable = false,
            length = 64,
            updatable = false)
    private String activityCode;

    @Column(
            name = "name",
            nullable = false,
            length = 220,
            updatable = false)
    private String name;

    @Column(
            name = "planned_start",
            nullable = false,
            updatable = false)
    private LocalDate plannedStart;

    @Column(
            name = "planned_finish",
            nullable = false,
            updatable = false)
    private LocalDate plannedFinish;

    @Column(
            name = "duration_days",
            nullable = false,
            updatable = false)
    private int durationDays;

    @Column(
            name = "critical",
            nullable = false,
            updatable = false)
    private boolean critical;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    protected ProjectScheduleBaselineActivity() {
    }

    private ProjectScheduleBaselineActivity(
            UUID id,
            UUID baselineId,
            String activityCode,
            String name,
            LocalDate plannedStart,
            LocalDate plannedFinish,
            int durationDays,
            boolean critical) {

        this.id =
                Objects.requireNonNull(id);

        this.baselineId =
                Objects.requireNonNull(baselineId);

        this.activityCode =
                Objects.requireNonNull(activityCode);

        this.name =
                Objects.requireNonNull(name);

        this.plannedStart =
                Objects.requireNonNull(plannedStart);

        this.plannedFinish =
                Objects.requireNonNull(plannedFinish);

        this.durationDays =
                durationDays;

        this.critical =
                critical;
    }

    public static ProjectScheduleBaselineActivity create(
            UUID id,
            UUID baselineId,
            String activityCode,
            String name,
            LocalDate plannedStart,
            LocalDate plannedFinish,
            int durationDays,
            boolean critical) {

        return new ProjectScheduleBaselineActivity(
                id,
                baselineId,
                activityCode,
                name,
                plannedStart,
                plannedFinish,
                durationDays,
                critical);
    }

    @PrePersist
    void onCreate() {

        if (createdAt == null) {
            createdAt =
                    Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getBaselineId() {
        return baselineId;
    }

    public String getActivityCode() {
        return activityCode;
    }

    public String getName() {
        return name;
    }

    public LocalDate getPlannedStart() {
        return plannedStart;
    }

    public LocalDate getPlannedFinish() {
        return plannedFinish;
    }

    public int getDurationDays() {
        return durationDays;
    }

    public boolean isCritical() {
        return critical;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
