package com.buildsight.platform.periodcontrol.domain;

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
@Table(name = "project_progress_periods")
public class ProjectProgressPeriod {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "baseline_version_id",
            nullable = false,
            updatable = false)
    private UUID baselineVersionId;

    @Column(
            name = "period_code",
            nullable = false,
            length = 64,
            updatable = false)
    private String periodCode;

    @Column(
            name = "title",
            nullable = false,
            length = 220)
    private String title;

    @Column(
            name = "start_date",
            nullable = false,
            updatable = false)
    private LocalDate startDate;

    @Column(
            name = "end_date",
            nullable = false,
            updatable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private ProgressPeriodStatus status;

    @Column(name = "closed_at")
    private Instant closedAt;

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

    protected ProjectProgressPeriod() {
    }

    private ProjectProgressPeriod(
            UUID id,
            UUID projectId,
            UUID baselineVersionId,
            String periodCode,
            String title,
            LocalDate startDate,
            LocalDate endDate) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.baselineVersionId =
                Objects.requireNonNull(
                        baselineVersionId);

        this.periodCode =
                Objects.requireNonNull(
                        periodCode);

        this.title =
                Objects.requireNonNull(
                        title);

        this.startDate =
                Objects.requireNonNull(
                        startDate);

        this.endDate =
                Objects.requireNonNull(
                        endDate);

        this.status =
                ProgressPeriodStatus.OPEN;
    }

    public static ProjectProgressPeriod open(
            UUID id,
            UUID projectId,
            UUID baselineVersionId,
            String periodCode,
            String title,
            LocalDate startDate,
            LocalDate endDate) {

        if (endDate.isBefore(startDate)) {

            throw new IllegalArgumentException(
                    "Progress-period end date cannot be before its start date.");
        }

        return new ProjectProgressPeriod(
                id,
                projectId,
                baselineVersionId,
                periodCode,
                title,
                startDate,
                endDate);
    }

    public void close(
            Instant now) {

        if (status != ProgressPeriodStatus.OPEN) {

            throw new IllegalStateException(
                    "Only open progress periods can be closed.");
        }

        status =
                ProgressPeriodStatus.CLOSED;

        closedAt =
                Objects.requireNonNull(
                        now);
    }

    @PrePersist
    void onCreate() {

        Instant now =
                Instant.now();

        if (createdAt == null) {
            createdAt =
                    now;
        }

        updatedAt =
                now;
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

    public UUID getBaselineVersionId() {
        return baselineVersionId;
    }

    public String getPeriodCode() {
        return periodCode;
    }

    public String getTitle() {
        return title;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public ProgressPeriodStatus getStatus() {
        return status;
    }

    public Instant getClosedAt() {
        return closedAt;
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
