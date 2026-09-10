package com.buildsight.platform.resource.domain;

import java.math.BigDecimal;
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
@Table(name = "project_equipment_usage_logs")
public class ProjectEquipmentUsageLog {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "equipment_id",
            nullable = false,
            updatable = false)
    private UUID equipmentId;

    @Column(name = "work_package_id")
    private UUID workPackageId;

    @Column(
            name = "work_date",
            nullable = false)
    private LocalDate workDate;

    @Column(
            name = "available_hours",
            nullable = false,
            precision = 12,
            scale = 2)
    private BigDecimal availableHours;

    @Column(
            name = "operating_hours",
            nullable = false,
            precision = 12,
            scale = 2)
    private BigDecimal operatingHours;

    @Column(
            name = "idle_hours",
            nullable = false,
            precision = 12,
            scale = 2)
    private BigDecimal idleHours;

    @Column(
            name = "downtime_hours",
            nullable = false,
            precision = 12,
            scale = 2)
    private BigDecimal downtimeHours;

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

    protected ProjectEquipmentUsageLog() {
    }

    private ProjectEquipmentUsageLog(
            UUID id,
            UUID projectId,
            UUID equipmentId,
            UUID workPackageId,
            LocalDate workDate,
            BigDecimal availableHours,
            BigDecimal operatingHours,
            BigDecimal idleHours,
            BigDecimal downtimeHours,
            String notes) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.equipmentId =
                Objects.requireNonNull(equipmentId);

        this.workPackageId =
                workPackageId;

        this.workDate =
                Objects.requireNonNull(workDate);

        this.availableHours =
                Objects.requireNonNull(
                        availableHours);

        this.operatingHours =
                Objects.requireNonNull(
                        operatingHours);

        this.idleHours =
                Objects.requireNonNull(
                        idleHours);

        this.downtimeHours =
                Objects.requireNonNull(
                        downtimeHours);

        this.notes =
                notes;
    }

    public static ProjectEquipmentUsageLog create(
            UUID id,
            UUID projectId,
            UUID equipmentId,
            UUID workPackageId,
            LocalDate workDate,
            BigDecimal availableHours,
            BigDecimal operatingHours,
            BigDecimal idleHours,
            BigDecimal downtimeHours,
            String notes) {

        return new ProjectEquipmentUsageLog(
                id,
                projectId,
                equipmentId,
                workPackageId,
                workDate,
                availableHours,
                operatingHours,
                idleHours,
                downtimeHours,
                notes);
    }

    public void update(
            UUID workPackageId,
            LocalDate workDate,
            BigDecimal availableHours,
            BigDecimal operatingHours,
            BigDecimal idleHours,
            BigDecimal downtimeHours,
            String notes) {

        this.workPackageId =
                workPackageId;

        this.workDate =
                Objects.requireNonNull(
                        workDate);

        this.availableHours =
                Objects.requireNonNull(
                        availableHours);

        this.operatingHours =
                Objects.requireNonNull(
                        operatingHours);

        this.idleHours =
                Objects.requireNonNull(
                        idleHours);

        this.downtimeHours =
                Objects.requireNonNull(
                        downtimeHours);

        this.notes =
                notes;
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

    public UUID getEquipmentId() {
        return equipmentId;
    }

    public UUID getWorkPackageId() {
        return workPackageId;
    }

    public LocalDate getWorkDate() {
        return workDate;
    }

    public BigDecimal getAvailableHours() {
        return availableHours;
    }

    public BigDecimal getOperatingHours() {
        return operatingHours;
    }

    public BigDecimal getIdleHours() {
        return idleHours;
    }

    public BigDecimal getDowntimeHours() {
        return downtimeHours;
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
