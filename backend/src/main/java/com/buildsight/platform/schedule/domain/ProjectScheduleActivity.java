package com.buildsight.platform.schedule.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "project_schedule_activities")
public class ProjectScheduleActivity {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "activity_code",
            nullable = false,
            length = 64,
            updatable = false)
    private String activityCode;

    @Column(
            name = "name",
            nullable = false,
            length = 220)
    private String name;

    @Column(
            name = "discipline",
            length = 100)
    private String discipline;

    @Column(name = "work_package_id")
    private UUID workPackageId;

    @Column(
            name = "current_start",
            nullable = false)
    private LocalDate currentStart;

    @Column(
            name = "current_finish",
            nullable = false)
    private LocalDate currentFinish;

    @Column(
            name = "original_duration_days",
            nullable = false)
    private int originalDurationDays;

    @Column(
            name = "remaining_duration_days",
            nullable = false)
    private int remainingDurationDays;

    @Column(name = "actual_start")
    private LocalDate actualStart;

    @Column(name = "actual_finish")
    private LocalDate actualFinish;

    @Column(
            name = "progress_percentage",
            nullable = false,
            precision = 5,
            scale = 2)
    private BigDecimal progressPercentage;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private ScheduleActivityStatus status;

    @Version
    @Column(
            name = "version",
            nullable = false)
    private long version;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    @Column(
            name = "updated_at",
            nullable = false)
    private Instant updatedAt;

    protected ProjectScheduleActivity() {
    }

    private ProjectScheduleActivity(
            UUID id,
            UUID projectId,
            String activityCode,
            String name,
            String discipline,
            UUID workPackageId,
            LocalDate currentStart,
            LocalDate currentFinish,
            int originalDurationDays) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.activityCode =
                Objects.requireNonNull(activityCode);

        this.name =
                Objects.requireNonNull(name);

        this.discipline =
                discipline;

        this.workPackageId =
                workPackageId;

        this.currentStart =
                Objects.requireNonNull(currentStart);

        this.currentFinish =
                Objects.requireNonNull(currentFinish);

        this.originalDurationDays =
                originalDurationDays;

        this.remainingDurationDays =
                originalDurationDays;

        this.progressPercentage =
                BigDecimal.ZERO;

        this.status =
                ScheduleActivityStatus.NOT_STARTED;
    }

    public static ProjectScheduleActivity create(
            UUID id,
            UUID projectId,
            String activityCode,
            String name,
            String discipline,
            UUID workPackageId,
            LocalDate currentStart,
            LocalDate currentFinish,
            int originalDurationDays) {

        return new ProjectScheduleActivity(
                id,
                projectId,
                activityCode,
                name,
                discipline,
                workPackageId,
                currentStart,
                currentFinish,
                originalDurationDays);
    }

    public void update(
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
            ScheduleActivityStatus status) {

        this.name =
                Objects.requireNonNull(name);

        this.discipline =
                discipline;

        this.workPackageId =
                workPackageId;

        this.currentStart =
                Objects.requireNonNull(currentStart);

        this.currentFinish =
                Objects.requireNonNull(currentFinish);

        this.originalDurationDays =
                originalDurationDays;

        this.remainingDurationDays =
                remainingDurationDays;

        this.actualStart =
                actualStart;

        this.actualFinish =
                actualFinish;

        this.progressPercentage =
                Objects.requireNonNull(
                        progressPercentage);

        this.status =
                Objects.requireNonNull(
                        status);
    }

    public long networkDurationDays() {

        if (status == ScheduleActivityStatus.COMPLETED) {
            return 0;
        }

        if (remainingDurationDays > 0) {
            return remainingDurationDays;
        }

        return Math.max(
                1,
                originalDurationDays);
    }

    @PrePersist
    void onCreate() {

        Instant now =
                Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {

        updatedAt =
                Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public String getActivityCode() {
        return activityCode;
    }

    public String getName() {
        return name;
    }

    public String getDiscipline() {
        return discipline;
    }

    public UUID getWorkPackageId() {
        return workPackageId;
    }

    public LocalDate getCurrentStart() {
        return currentStart;
    }

    public LocalDate getCurrentFinish() {
        return currentFinish;
    }

    public int getOriginalDurationDays() {
        return originalDurationDays;
    }

    public int getRemainingDurationDays() {
        return remainingDurationDays;
    }

    public LocalDate getActualStart() {
        return actualStart;
    }

    public LocalDate getActualFinish() {
        return actualFinish;
    }

    public BigDecimal getProgressPercentage() {
        return progressPercentage;
    }

    public ScheduleActivityStatus getStatus() {
        return status;
    }

    public long getVersion() {
        return version;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
