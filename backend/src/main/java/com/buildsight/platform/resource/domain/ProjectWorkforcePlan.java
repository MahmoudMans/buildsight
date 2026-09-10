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
@Table(name = "project_workforce_plans")
public class ProjectWorkforcePlan {

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

    @Column(
            name = "trade",
            nullable = false,
            length = 100)
    private String trade;

    @Column(name = "work_package_id")
    private UUID workPackageId;

    @Column(
            name = "planned_workers",
            nullable = false)
    private int plannedWorkers;

    @Column(
            name = "planned_regular_hours",
            nullable = false,
            precision = 12,
            scale = 2)
    private BigDecimal plannedRegularHours;

    @Column(
            name = "planned_productive_hours",
            nullable = false,
            precision = 12,
            scale = 2)
    private BigDecimal plannedProductiveHours;

    @Column(
            name = "planned_productivity_rate",
            precision = 18,
            scale = 6)
    private BigDecimal plannedProductivityRate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private WorkforcePlanStatus status;

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

    protected ProjectWorkforcePlan() {
    }

    private ProjectWorkforcePlan(
            UUID id,
            UUID projectId,
            LocalDate periodStart,
            LocalDate periodEnd,
            String trade,
            UUID workPackageId,
            int plannedWorkers,
            BigDecimal plannedRegularHours,
            BigDecimal plannedProductiveHours,
            BigDecimal plannedProductivityRate) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.periodStart =
                Objects.requireNonNull(periodStart);

        this.periodEnd =
                Objects.requireNonNull(periodEnd);

        this.trade =
                Objects.requireNonNull(trade);

        this.workPackageId =
                workPackageId;

        this.plannedWorkers =
                plannedWorkers;

        this.plannedRegularHours =
                Objects.requireNonNull(
                        plannedRegularHours);

        this.plannedProductiveHours =
                Objects.requireNonNull(
                        plannedProductiveHours);

        this.plannedProductivityRate =
                plannedProductivityRate;

        this.status =
                WorkforcePlanStatus.DRAFT;
    }

    public static ProjectWorkforcePlan create(
            UUID id,
            UUID projectId,
            LocalDate periodStart,
            LocalDate periodEnd,
            String trade,
            UUID workPackageId,
            int plannedWorkers,
            BigDecimal plannedRegularHours,
            BigDecimal plannedProductiveHours,
            BigDecimal plannedProductivityRate) {

        return new ProjectWorkforcePlan(
                id,
                projectId,
                periodStart,
                periodEnd,
                trade,
                workPackageId,
                plannedWorkers,
                plannedRegularHours,
                plannedProductiveHours,
                plannedProductivityRate);
    }

    public void update(
            LocalDate periodStart,
            LocalDate periodEnd,
            String trade,
            UUID workPackageId,
            int plannedWorkers,
            BigDecimal plannedRegularHours,
            BigDecimal plannedProductiveHours,
            BigDecimal plannedProductivityRate,
            WorkforcePlanStatus status) {

        this.periodStart =
                Objects.requireNonNull(
                        periodStart);

        this.periodEnd =
                Objects.requireNonNull(
                        periodEnd);

        this.trade =
                Objects.requireNonNull(
                        trade);

        this.workPackageId =
                workPackageId;

        this.plannedWorkers =
                plannedWorkers;

        this.plannedRegularHours =
                Objects.requireNonNull(
                        plannedRegularHours);

        this.plannedProductiveHours =
                Objects.requireNonNull(
                        plannedProductiveHours);

        this.plannedProductivityRate =
                plannedProductivityRate;

        this.status =
                Objects.requireNonNull(
                        status);
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

    public String getTrade() {
        return trade;
    }

    public UUID getWorkPackageId() {
        return workPackageId;
    }

    public int getPlannedWorkers() {
        return plannedWorkers;
    }

    public BigDecimal getPlannedRegularHours() {
        return plannedRegularHours;
    }

    public BigDecimal getPlannedProductiveHours() {
        return plannedProductiveHours;
    }

    public BigDecimal getPlannedProductivityRate() {
        return plannedProductivityRate;
    }

    public WorkforcePlanStatus getStatus() {
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
