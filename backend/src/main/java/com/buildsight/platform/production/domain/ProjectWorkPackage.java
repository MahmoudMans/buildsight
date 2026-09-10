package com.buildsight.platform.production.domain;

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
@Table(name = "project_work_packages")
public class ProjectWorkPackage {

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
            name = "code",
            nullable = false,
            length = 40,
            updatable = false)
    private String code;

    @Column(
            name = "name",
            nullable = false,
            length = 180)
    private String name;

    @Column(
            name = "description",
            length = 1500)
    private String description;

    @Column(
            name = "unit",
            nullable = false,
            length = 32)
    private String unit;

    @Column(
            name = "planned_quantity",
            nullable = false,
            precision = 19,
            scale = 3)
    private BigDecimal plannedQuantity;

    @Column(
            name = "planned_labor_hours",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal plannedLaborHours;

    @Column(
            name = "planned_start_date",
            nullable = false)
    private LocalDate plannedStartDate;

    @Column(
            name = "planned_end_date",
            nullable = false)
    private LocalDate plannedEndDate;

    @Column(
            name = "actual_start_date")
    private LocalDate actualStartDate;

    @Column(
            name = "actual_end_date")
    private LocalDate actualEndDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private WorkPackageStatus status;

    @Column(
            name = "block_reason",
            length = 1200)
    private String blockReason;

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

    protected ProjectWorkPackage() {
    }

    private ProjectWorkPackage(
            UUID id,
            UUID projectId,
            String code,
            String name,
            String description,
            String unit,
            BigDecimal plannedQuantity,
            BigDecimal plannedLaborHours,
            LocalDate plannedStartDate,
            LocalDate plannedEndDate) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.code =
                Objects.requireNonNull(code);

        this.name =
                Objects.requireNonNull(name);

        this.description =
                description;

        this.unit =
                Objects.requireNonNull(unit);

        this.plannedQuantity =
                Objects.requireNonNull(
                        plannedQuantity);

        this.plannedLaborHours =
                Objects.requireNonNull(
                        plannedLaborHours);

        this.plannedStartDate =
                Objects.requireNonNull(
                        plannedStartDate);

        this.plannedEndDate =
                Objects.requireNonNull(
                        plannedEndDate);

        this.status =
                WorkPackageStatus.PLANNED;
    }

    public static ProjectWorkPackage create(
            UUID id,
            UUID projectId,
            String code,
            String name,
            String description,
            String unit,
            BigDecimal plannedQuantity,
            BigDecimal plannedLaborHours,
            LocalDate plannedStartDate,
            LocalDate plannedEndDate) {

        return new ProjectWorkPackage(
                id,
                projectId,
                code,
                name,
                description,
                unit,
                plannedQuantity,
                plannedLaborHours,
                plannedStartDate,
                plannedEndDate);
    }

    public void update(
            String name,
            String description,
            String unit,
            BigDecimal plannedQuantity,
            BigDecimal plannedLaborHours,
            LocalDate plannedStartDate,
            LocalDate plannedEndDate,
            WorkPackageStatus status,
            String blockReason,
            LocalDate effectiveDate) {

        this.name =
                Objects.requireNonNull(name);

        this.description =
                description;

        this.unit =
                Objects.requireNonNull(unit);

        this.plannedQuantity =
                Objects.requireNonNull(
                        plannedQuantity);

        this.plannedLaborHours =
                Objects.requireNonNull(
                        plannedLaborHours);

        this.plannedStartDate =
                Objects.requireNonNull(
                        plannedStartDate);

        this.plannedEndDate =
                Objects.requireNonNull(
                        plannedEndDate);

        this.status =
                Objects.requireNonNull(
                        status);

        if ((status
                        == WorkPackageStatus.IN_PROGRESS
                || status
                        == WorkPackageStatus.BLOCKED)
                && actualStartDate == null) {

            actualStartDate =
                    Objects.requireNonNull(
                            effectiveDate);
        }

        if (status
                == WorkPackageStatus.COMPLETED) {

            if (actualStartDate == null) {
                actualStartDate =
                        Objects.requireNonNull(
                                effectiveDate);
            }

            actualEndDate =
                    Objects.requireNonNull(
                            effectiveDate);

            this.blockReason =
                    null;

        } else if (status
                == WorkPackageStatus.BLOCKED) {

            this.blockReason =
                    blockReason;

        } else {
            this.blockReason =
                    null;
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

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getUnit() {
        return unit;
    }

    public BigDecimal getPlannedQuantity() {
        return plannedQuantity;
    }

    public BigDecimal getPlannedLaborHours() {
        return plannedLaborHours;
    }

    public LocalDate getPlannedStartDate() {
        return plannedStartDate;
    }

    public LocalDate getPlannedEndDate() {
        return plannedEndDate;
    }

    public LocalDate getActualStartDate() {
        return actualStartDate;
    }

    public LocalDate getActualEndDate() {
        return actualEndDate;
    }

    public WorkPackageStatus getStatus() {
        return status;
    }

    public String getBlockReason() {
        return blockReason;
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
