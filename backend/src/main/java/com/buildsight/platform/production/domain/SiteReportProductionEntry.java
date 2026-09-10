package com.buildsight.platform.production.domain;

import java.math.BigDecimal;
import java.time.Instant;
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
@Table(name = "site_report_production_entries")
public class SiteReportProductionEntry {

    @Id
    @Column(
            name = "id",
            nullable = false,
            updatable = false)
    private UUID id;

    @Column(
            name = "site_report_id",
            nullable = false,
            updatable = false)
    private UUID siteReportId;

    @Column(
            name = "work_package_id",
            nullable = false,
            updatable = false)
    private UUID workPackageId;

    @Column(
            name = "quantity_completed",
            nullable = false,
            precision = 19,
            scale = 3)
    private BigDecimal quantityCompleted;

    @Column(
            name = "labor_hours",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal laborHours;

    @Column(
            name = "equipment_hours",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal equipmentHours;

    @Column(
            name = "crew_size",
            nullable = false)
    private int crewSize;

    @Column(
            name = "notes",
            length = 1500)
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

    protected SiteReportProductionEntry() {
    }

    private SiteReportProductionEntry(
            UUID id,
            UUID siteReportId,
            UUID workPackageId,
            BigDecimal quantityCompleted,
            BigDecimal laborHours,
            BigDecimal equipmentHours,
            int crewSize,
            String notes) {

        this.id =
                Objects.requireNonNull(id);

        this.siteReportId =
                Objects.requireNonNull(
                        siteReportId);

        this.workPackageId =
                Objects.requireNonNull(
                        workPackageId);

        this.quantityCompleted =
                Objects.requireNonNull(
                        quantityCompleted);

        this.laborHours =
                Objects.requireNonNull(
                        laborHours);

        this.equipmentHours =
                Objects.requireNonNull(
                        equipmentHours);

        this.crewSize =
                crewSize;

        this.notes =
                notes;
    }

    public static SiteReportProductionEntry create(
            UUID id,
            UUID siteReportId,
            UUID workPackageId,
            BigDecimal quantityCompleted,
            BigDecimal laborHours,
            BigDecimal equipmentHours,
            int crewSize,
            String notes) {

        return new SiteReportProductionEntry(
                id,
                siteReportId,
                workPackageId,
                quantityCompleted,
                laborHours,
                equipmentHours,
                crewSize,
                notes);
    }

    public void update(
            BigDecimal quantityCompleted,
            BigDecimal laborHours,
            BigDecimal equipmentHours,
            int crewSize,
            String notes) {

        this.quantityCompleted =
                Objects.requireNonNull(
                        quantityCompleted);

        this.laborHours =
                Objects.requireNonNull(
                        laborHours);

        this.equipmentHours =
                Objects.requireNonNull(
                        equipmentHours);

        this.crewSize =
                crewSize;

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

    public UUID getSiteReportId() {
        return siteReportId;
    }

    public UUID getWorkPackageId() {
        return workPackageId;
    }

    public BigDecimal getQuantityCompleted() {
        return quantityCompleted;
    }

    public BigDecimal getLaborHours() {
        return laborHours;
    }

    public BigDecimal getEquipmentHours() {
        return equipmentHours;
    }

    public int getCrewSize() {
        return crewSize;
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
