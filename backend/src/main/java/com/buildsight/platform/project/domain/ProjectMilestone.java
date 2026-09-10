package com.buildsight.platform.project.domain;

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
@Table(name = "project_milestones")
public class ProjectMilestone {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "name", nullable = false, length = 180)
    private String name;

    @Column(name = "description", length = 1200)
    private String description;

    @Column(name = "planned_date", nullable = false)
    private LocalDate plannedDate;

    @Column(name = "forecast_date", nullable = false)
    private LocalDate forecastDate;

    @Column(name = "actual_date")
    private LocalDate actualDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private MilestoneStatus status;

    @Column(
            name = "weight_percentage",
            nullable = false,
            precision = 5,
            scale = 2)
    private BigDecimal weightPercentage;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProjectMilestone() {
    }

    private ProjectMilestone(
            UUID id,
            UUID projectId,
            String name,
            String description,
            LocalDate plannedDate,
            LocalDate forecastDate,
            LocalDate actualDate,
            MilestoneStatus status,
            BigDecimal weightPercentage,
            int sortOrder) {

        this.id = Objects.requireNonNull(id);
        this.projectId = Objects.requireNonNull(projectId);
        this.name = Objects.requireNonNull(name);
        this.description = description;
        this.plannedDate = Objects.requireNonNull(plannedDate);
        this.forecastDate = Objects.requireNonNull(forecastDate);
        this.actualDate = actualDate;
        this.status = Objects.requireNonNull(status);
        this.weightPercentage =
                Objects.requireNonNull(weightPercentage);
        this.sortOrder = sortOrder;
    }

    public static ProjectMilestone create(
            UUID id,
            UUID projectId,
            String name,
            String description,
            LocalDate plannedDate,
            LocalDate forecastDate,
            LocalDate actualDate,
            MilestoneStatus status,
            BigDecimal weightPercentage,
            int sortOrder) {

        return new ProjectMilestone(
                id,
                projectId,
                name,
                description,
                plannedDate,
                forecastDate,
                actualDate,
                status,
                weightPercentage,
                sortOrder);
    }

    public void update(
            String name,
            String description,
            LocalDate plannedDate,
            LocalDate forecastDate,
            LocalDate actualDate,
            MilestoneStatus status,
            BigDecimal weightPercentage,
            int sortOrder,
            LocalDate currentDate) {

        this.name = Objects.requireNonNull(name);
        this.description = description;
        this.plannedDate = Objects.requireNonNull(plannedDate);
        this.forecastDate = Objects.requireNonNull(forecastDate);
        this.status = Objects.requireNonNull(status);
        this.weightPercentage =
                Objects.requireNonNull(weightPercentage);
        this.sortOrder = sortOrder;

        if (status == MilestoneStatus.COMPLETED) {
            this.actualDate =
                    actualDate == null
                            ? Objects.requireNonNull(currentDate)
                            : actualDate;
        } else {
            this.actualDate = actualDate;
        }
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
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

    public String getDescription() {
        return description;
    }

    public LocalDate getPlannedDate() {
        return plannedDate;
    }

    public LocalDate getForecastDate() {
        return forecastDate;
    }

    public LocalDate getActualDate() {
        return actualDate;
    }

    public MilestoneStatus getStatus() {
        return status;
    }

    public BigDecimal getWeightPercentage() {
        return weightPercentage;
    }

    public int getSortOrder() {
        return sortOrder;
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
