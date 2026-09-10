package com.buildsight.platform.resource.domain;

import java.math.BigDecimal;
import java.time.Instant;
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
@Table(name = "project_equipment")
public class ProjectEquipment {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "code",
            nullable = false,
            length = 64,
            updatable = false)
    private String code;

    @Column(
            name = "description",
            nullable = false,
            length = 220)
    private String description;

    @Column(
            name = "category",
            nullable = false,
            length = 100)
    private String category;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "ownership",
            nullable = false,
            length = 32)
    private EquipmentOwnership ownership;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private EquipmentStatus status;

    @Column(
            name = "daily_cost",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal dailyCost;

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

    protected ProjectEquipment() {
    }

    private ProjectEquipment(
            UUID id,
            UUID projectId,
            String code,
            String description,
            String category,
            EquipmentOwnership ownership,
            BigDecimal dailyCost) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.code =
                Objects.requireNonNull(code);

        this.description =
                Objects.requireNonNull(description);

        this.category =
                Objects.requireNonNull(category);

        this.ownership =
                Objects.requireNonNull(ownership);

        this.dailyCost =
                Objects.requireNonNull(dailyCost);

        this.status =
                EquipmentStatus.AVAILABLE;
    }

    public static ProjectEquipment create(
            UUID id,
            UUID projectId,
            String code,
            String description,
            String category,
            EquipmentOwnership ownership,
            BigDecimal dailyCost) {

        return new ProjectEquipment(
                id,
                projectId,
                code,
                description,
                category,
                ownership,
                dailyCost);
    }

    public void update(
            String description,
            String category,
            EquipmentOwnership ownership,
            EquipmentStatus status,
            BigDecimal dailyCost) {

        this.description =
                Objects.requireNonNull(
                        description);

        this.category =
                Objects.requireNonNull(
                        category);

        this.ownership =
                Objects.requireNonNull(
                        ownership);

        this.status =
                Objects.requireNonNull(
                        status);

        this.dailyCost =
                Objects.requireNonNull(
                        dailyCost);
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

    public String getDescription() {
        return description;
    }

    public String getCategory() {
        return category;
    }

    public EquipmentOwnership getOwnership() {
        return ownership;
    }

    public EquipmentStatus getStatus() {
        return status;
    }

    public BigDecimal getDailyCost() {
        return dailyCost;
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
