package com.buildsight.platform.schedule.domain;

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
@Table(name = "project_schedule_constraints")
public class ProjectScheduleConstraint {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "activity_id",
            nullable = false,
            updatable = false)
    private UUID activityId;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "constraint_type",
            nullable = false,
            length = 40)
    private ScheduleConstraintType constraintType;

    @Column(
            name = "title",
            nullable = false,
            length = 220)
    private String title;

    @Column(
            name = "owner_name",
            length = 160)
    private String ownerName;

    @Column(
            name = "due_date",
            nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private ScheduleConstraintStatus status;

    @Column(
            name = "resolution_notes",
            columnDefinition = "TEXT")
    private String resolutionNotes;

    @Column(name = "resolved_date")
    private LocalDate resolvedDate;

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

    protected ProjectScheduleConstraint() {
    }

    private ProjectScheduleConstraint(
            UUID id,
            UUID projectId,
            UUID activityId,
            ScheduleConstraintType constraintType,
            String title,
            String ownerName,
            LocalDate dueDate) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.activityId =
                Objects.requireNonNull(activityId);

        this.constraintType =
                Objects.requireNonNull(
                        constraintType);

        this.title =
                Objects.requireNonNull(title);

        this.ownerName =
                ownerName;

        this.dueDate =
                Objects.requireNonNull(dueDate);

        this.status =
                ScheduleConstraintStatus.OPEN;
    }

    public static ProjectScheduleConstraint create(
            UUID id,
            UUID projectId,
            UUID activityId,
            ScheduleConstraintType constraintType,
            String title,
            String ownerName,
            LocalDate dueDate) {

        return new ProjectScheduleConstraint(
                id,
                projectId,
                activityId,
                constraintType,
                title,
                ownerName,
                dueDate);
    }

    public void update(
            ScheduleConstraintType constraintType,
            String title,
            String ownerName,
            LocalDate dueDate,
            ScheduleConstraintStatus status,
            String resolutionNotes,
            LocalDate currentDate) {

        this.constraintType =
                Objects.requireNonNull(
                        constraintType);

        this.title =
                Objects.requireNonNull(title);

        this.ownerName =
                ownerName;

        this.dueDate =
                Objects.requireNonNull(dueDate);

        this.status =
                Objects.requireNonNull(status);

        this.resolutionNotes =
                resolutionNotes;

        if (status == ScheduleConstraintStatus.OPEN) {

            this.resolvedDate =
                    null;

        } else {

            this.resolvedDate =
                    currentDate;
        }
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

    public UUID getActivityId() {
        return activityId;
    }

    public ScheduleConstraintType getConstraintType() {
        return constraintType;
    }

    public String getTitle() {
        return title;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public ScheduleConstraintStatus getStatus() {
        return status;
    }

    public String getResolutionNotes() {
        return resolutionNotes;
    }

    public LocalDate getResolvedDate() {
        return resolvedDate;
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
