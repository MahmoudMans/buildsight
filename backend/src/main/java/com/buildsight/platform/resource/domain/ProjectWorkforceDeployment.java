package com.buildsight.platform.resource.domain;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;

@Entity
@Table(name = "project_workforce_deployments")
public class ProjectWorkforceDeployment {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "work_date",
            nullable = false)
    private LocalDate workDate;

    @Column(
            name = "trade",
            nullable = false,
            length = 100)
    private String trade;

    @Column(name = "work_package_id")
    private UUID workPackageId;

    @Column(
            name = "workers",
            nullable = false)
    private int workers;

    @Column(
            name = "regular_hours",
            nullable = false,
            precision = 12,
            scale = 2)
    private BigDecimal regularHours;

    @Column(
            name = "overtime_hours",
            nullable = false,
            precision = 12,
            scale = 2)
    private BigDecimal overtimeHours;

    @Column(
            name = "productive_hours",
            nullable = false,
            precision = 12,
            scale = 2)
    private BigDecimal productiveHours;

    @Column(
            name = "quantity_completed",
            nullable = false,
            precision = 18,
            scale = 4)
    private BigDecimal quantityCompleted;

    @Column(
            name = "planned_productivity_rate",
            precision = 18,
            scale = 6)
    private BigDecimal plannedProductivityRate;

    @Column(
            name = "notes",
            length = 2500)
    private String notes;

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

    protected ProjectWorkforceDeployment() {
    }

    private ProjectWorkforceDeployment(
            UUID id,
            UUID projectId,
            LocalDate workDate,
            String trade,
            UUID workPackageId,
            int workers,
            BigDecimal regularHours,
            BigDecimal overtimeHours,
            BigDecimal productiveHours,
            BigDecimal quantityCompleted,
            BigDecimal plannedProductivityRate,
            String notes) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.workDate =
                Objects.requireNonNull(workDate);

        this.trade =
                Objects.requireNonNull(trade);

        this.workPackageId =
                workPackageId;

        this.workers =
                workers;

        this.regularHours =
                Objects.requireNonNull(
                        regularHours);

        this.overtimeHours =
                Objects.requireNonNull(
                        overtimeHours);

        this.productiveHours =
                Objects.requireNonNull(
                        productiveHours);

        this.quantityCompleted =
                Objects.requireNonNull(
                        quantityCompleted);

        this.plannedProductivityRate =
                plannedProductivityRate;

        this.notes =
                notes;
    }

    public static ProjectWorkforceDeployment create(
            UUID id,
            UUID projectId,
            LocalDate workDate,
            String trade,
            UUID workPackageId,
            int workers,
            BigDecimal regularHours,
            BigDecimal overtimeHours,
            BigDecimal productiveHours,
            BigDecimal quantityCompleted,
            BigDecimal plannedProductivityRate,
            String notes) {

        return new ProjectWorkforceDeployment(
                id,
                projectId,
                workDate,
                trade,
                workPackageId,
                workers,
                regularHours,
                overtimeHours,
                productiveHours,
                quantityCompleted,
                plannedProductivityRate,
                notes);
    }

    public void update(
            LocalDate workDate,
            String trade,
            UUID workPackageId,
            int workers,
            BigDecimal regularHours,
            BigDecimal overtimeHours,
            BigDecimal productiveHours,
            BigDecimal quantityCompleted,
            BigDecimal plannedProductivityRate,
            String notes) {

        this.workDate =
                Objects.requireNonNull(
                        workDate);

        this.trade =
                Objects.requireNonNull(
                        trade);

        this.workPackageId =
                workPackageId;

        this.workers =
                workers;

        this.regularHours =
                Objects.requireNonNull(
                        regularHours);

        this.overtimeHours =
                Objects.requireNonNull(
                        overtimeHours);

        this.productiveHours =
                Objects.requireNonNull(
                        productiveHours);

        this.quantityCompleted =
                Objects.requireNonNull(
                        quantityCompleted);

        this.plannedProductivityRate =
                plannedProductivityRate;

        this.notes =
                notes;
    }

    public BigDecimal totalLaborHours() {

        return regularHours
                .add(
                        overtimeHours);
    }

    public BigDecimal actualProductivityRate() {

        if (productiveHours.signum() <= 0) {
            return BigDecimal.ZERO;
        }

        return quantityCompleted
                .divide(
                        productiveHours,
                        6,
                        RoundingMode.HALF_UP);
    }

    public BigDecimal productivityIndex() {

        if (plannedProductivityRate == null
                || plannedProductivityRate.signum() <= 0) {

            return BigDecimal.ZERO;
        }

        return actualProductivityRate()
                .divide(
                        plannedProductivityRate,
                        6,
                        RoundingMode.HALF_UP);
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

    public LocalDate getWorkDate() {
        return workDate;
    }

    public String getTrade() {
        return trade;
    }

    public UUID getWorkPackageId() {
        return workPackageId;
    }

    public int getWorkers() {
        return workers;
    }

    public BigDecimal getRegularHours() {
        return regularHours;
    }

    public BigDecimal getOvertimeHours() {
        return overtimeHours;
    }

    public BigDecimal getProductiveHours() {
        return productiveHours;
    }

    public BigDecimal getQuantityCompleted() {
        return quantityCompleted;
    }

    public BigDecimal getPlannedProductivityRate() {
        return plannedProductivityRate;
    }

    public String getNotes() {
        return notes;
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
