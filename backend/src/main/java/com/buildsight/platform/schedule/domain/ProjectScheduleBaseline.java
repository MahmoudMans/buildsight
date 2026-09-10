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
@Table(name = "project_schedule_baselines")
public class ProjectScheduleBaseline {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "name",
            nullable = false,
            length = 180)
    private String name;

    @Column(
            name = "data_date",
            nullable = false)
    private LocalDate dataDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private ScheduleBaselineStatus status;

    @Column(name = "approved_at")
    private Instant approvedAt;

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

    protected ProjectScheduleBaseline() {
    }

    private ProjectScheduleBaseline(
            UUID id,
            UUID projectId,
            String name,
            LocalDate dataDate) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.name =
                Objects.requireNonNull(name);

        this.dataDate =
                Objects.requireNonNull(dataDate);

        this.status =
                ScheduleBaselineStatus.DRAFT;
    }

    public static ProjectScheduleBaseline create(
            UUID id,
            UUID projectId,
            String name,
            LocalDate dataDate) {

        return new ProjectScheduleBaseline(
                id,
                projectId,
                name,
                dataDate);
    }

    public void approve() {

        if (status != ScheduleBaselineStatus.DRAFT) {

            throw new IllegalStateException(
                    "Only a draft schedule baseline may be approved.");
        }

        status =
                ScheduleBaselineStatus.APPROVED;

        approvedAt =
                Instant.now();
    }

    public void supersede() {

        if (status == ScheduleBaselineStatus.APPROVED) {

            status =
                    ScheduleBaselineStatus.SUPERSEDED;
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

    public String getName() {
        return name;
    }

    public LocalDate getDataDate() {
        return dataDate;
    }

    public ScheduleBaselineStatus getStatus() {
        return status;
    }

    public Instant getApprovedAt() {
        return approvedAt;
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
