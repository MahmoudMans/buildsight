package com.buildsight.platform.risk.domain;

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
@Table(name = "project_delay_events")
public class ProjectDelayEvent {

    @Id
    @Column(
            name = "id",
            nullable = false,
            updatable = false)
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "reference",
            nullable = false,
            length = 64,
            updatable = false)
    private String reference;

    @Column(
            name = "title",
            nullable = false,
            length = 180)
    private String title;

    @Column(
            name = "description",
            length = 1800)
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "cause",
            nullable = false,
            length = 40)
    private DelayCause cause;

    @Column(
            name = "owner_name",
            length = 160)
    private String ownerName;

    @Column(
            name = "start_date",
            nullable = false)
    private LocalDate startDate;

    @Column(
            name = "end_date")
    private LocalDate endDate;

    @Column(
            name = "forecast_delay_days",
            nullable = false)
    private int forecastDelayDays;

    @Column(
            name = "excusable",
            nullable = false)
    private boolean excusable;

    @Column(
            name = "compensable",
            nullable = false)
    private boolean compensable;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private DelayStatus status;

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

    protected ProjectDelayEvent() {
    }

    private ProjectDelayEvent(
            UUID id,
            UUID projectId,
            String reference,
            String title,
            String description,
            DelayCause cause,
            String ownerName,
            LocalDate startDate,
            int forecastDelayDays,
            boolean excusable,
            boolean compensable) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(
                        projectId);

        this.reference =
                Objects.requireNonNull(
                        reference);

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.cause =
                Objects.requireNonNull(
                        cause);

        this.ownerName =
                ownerName;

        this.startDate =
                Objects.requireNonNull(
                        startDate);

        this.forecastDelayDays =
                forecastDelayDays;

        this.excusable =
                excusable;

        this.compensable =
                compensable;

        this.status =
                DelayStatus.OPEN;
    }

    public static ProjectDelayEvent create(
            UUID id,
            UUID projectId,
            String reference,
            String title,
            String description,
            DelayCause cause,
            String ownerName,
            LocalDate startDate,
            int forecastDelayDays,
            boolean excusable,
            boolean compensable) {

        return new ProjectDelayEvent(
                id,
                projectId,
                reference,
                title,
                description,
                cause,
                ownerName,
                startDate,
                forecastDelayDays,
                excusable,
                compensable);
    }

    public void update(
            String title,
            String description,
            DelayCause cause,
            String ownerName,
            LocalDate startDate,
            LocalDate endDate,
            int forecastDelayDays,
            boolean excusable,
            boolean compensable,
            DelayStatus status,
            LocalDate currentDate) {

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.cause =
                Objects.requireNonNull(
                        cause);

        this.ownerName =
                ownerName;

        this.startDate =
                Objects.requireNonNull(
                        startDate);

        this.forecastDelayDays =
                forecastDelayDays;

        this.excusable =
                excusable;

        this.compensable =
                compensable;

        this.status =
                Objects.requireNonNull(
                        status);

        if (status
                        == DelayStatus.RESOLVED
                && endDate == null) {

            this.endDate =
                    Objects.requireNonNull(
                            currentDate);

        } else {
            this.endDate =
                    endDate;
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

    public String getReference() {
        return reference;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public DelayCause getCause() {
        return cause;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public int getForecastDelayDays() {
        return forecastDelayDays;
    }

    public boolean isExcusable() {
        return excusable;
    }

    public boolean isCompensable() {
        return compensable;
    }

    public DelayStatus getStatus() {
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
