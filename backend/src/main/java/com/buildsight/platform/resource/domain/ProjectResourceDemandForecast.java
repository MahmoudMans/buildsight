package com.buildsight.platform.resource.domain;

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
@Table(name = "project_resource_demand_forecasts")
public class ProjectResourceDemandForecast {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "period_start",
            nullable = false)
    private LocalDate periodStart;

    @Column(
            name = "period_end",
            nullable = false)
    private LocalDate periodEnd;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "resource_type",
            nullable = false,
            length = 32)
    private ResourceDemandType resourceType;

    @Column(
            name = "resource_key",
            nullable = false,
            length = 120)
    private String resourceKey;

    @Column(
            name = "required_quantity",
            nullable = false,
            precision = 14,
            scale = 2)
    private BigDecimal requiredQuantity;

    @Column(
            name = "available_quantity",
            nullable = false,
            precision = 14,
            scale = 2)
    private BigDecimal availableQuantity;

    @Column(
            name = "notes",
            length = 2000)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private ResourceForecastStatus status;

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

    protected ProjectResourceDemandForecast() {
    }

    private ProjectResourceDemandForecast(
            UUID id,
            UUID projectId,
            LocalDate periodStart,
            LocalDate periodEnd,
            ResourceDemandType resourceType,
            String resourceKey,
            BigDecimal requiredQuantity,
            BigDecimal availableQuantity,
            String notes) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.periodStart =
                Objects.requireNonNull(periodStart);

        this.periodEnd =
                Objects.requireNonNull(periodEnd);

        this.resourceType =
                Objects.requireNonNull(resourceType);

        this.resourceKey =
                Objects.requireNonNull(resourceKey);

        this.requiredQuantity =
                Objects.requireNonNull(
                        requiredQuantity);

        this.availableQuantity =
                Objects.requireNonNull(
                        availableQuantity);

        this.notes =
                notes;

        this.status =
                ResourceForecastStatus.OPEN;
    }

    public static ProjectResourceDemandForecast create(
            UUID id,
            UUID projectId,
            LocalDate periodStart,
            LocalDate periodEnd,
            ResourceDemandType resourceType,
            String resourceKey,
            BigDecimal requiredQuantity,
            BigDecimal availableQuantity,
            String notes) {

        return new ProjectResourceDemandForecast(
                id,
                projectId,
                periodStart,
                periodEnd,
                resourceType,
                resourceKey,
                requiredQuantity,
                availableQuantity,
                notes);
    }

    public void update(
            LocalDate periodStart,
            LocalDate periodEnd,
            ResourceDemandType resourceType,
            String resourceKey,
            BigDecimal requiredQuantity,
            BigDecimal availableQuantity,
            String notes,
            ResourceForecastStatus status) {

        this.periodStart =
                Objects.requireNonNull(
                        periodStart);

        this.periodEnd =
                Objects.requireNonNull(
                        periodEnd);

        this.resourceType =
                Objects.requireNonNull(
                        resourceType);

        this.resourceKey =
                Objects.requireNonNull(
                        resourceKey);

        this.requiredQuantity =
                Objects.requireNonNull(
                        requiredQuantity);

        this.availableQuantity =
                Objects.requireNonNull(
                        availableQuantity);

        this.notes =
                notes;

        this.status =
                Objects.requireNonNull(
                        status);
    }

    public BigDecimal shortage() {

        return requiredQuantity
                .subtract(
                        availableQuantity)
                .max(
                        BigDecimal.ZERO);
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

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public ResourceDemandType getResourceType() {
        return resourceType;
    }

    public String getResourceKey() {
        return resourceKey;
    }

    public BigDecimal getRequiredQuantity() {
        return requiredQuantity;
    }

    public BigDecimal getAvailableQuantity() {
        return availableQuantity;
    }

    public String getNotes() {
        return notes;
    }

    public ResourceForecastStatus getStatus() {
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
