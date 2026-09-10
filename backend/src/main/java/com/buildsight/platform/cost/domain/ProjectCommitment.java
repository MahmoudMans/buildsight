package com.buildsight.platform.cost.domain;

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
@Table(name = "project_commitments")
public class ProjectCommitment {

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
            name = "cost_code_id",
            nullable = false,
            updatable = false)
    private UUID costCodeId;

    @Column(
            name = "reference",
            nullable = false,
            length = 64,
            updatable = false)
    private String reference;

    @Column(
            name = "vendor_name",
            nullable = false,
            length = 180)
    private String vendorName;

    @Column(
            name = "description",
            length = 1200)
    private String description;

    @Column(
            name = "committed_amount",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal committedAmount;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private CommitmentStatus status;

    @Column(
            name = "commitment_date",
            nullable = false)
    private LocalDate commitmentDate;

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

    protected ProjectCommitment() {
    }

    private ProjectCommitment(
            UUID id,
            UUID projectId,
            UUID costCodeId,
            String reference,
            String vendorName,
            String description,
            BigDecimal committedAmount,
            CommitmentStatus status,
            LocalDate commitmentDate) {

        this.id = Objects.requireNonNull(id);
        this.projectId =
                Objects.requireNonNull(projectId);
        this.costCodeId =
                Objects.requireNonNull(costCodeId);
        this.reference =
                Objects.requireNonNull(reference);
        this.vendorName =
                Objects.requireNonNull(vendorName);
        this.description = description;
        this.committedAmount =
                Objects.requireNonNull(
                        committedAmount);
        this.status =
                Objects.requireNonNull(status);
        this.commitmentDate =
                Objects.requireNonNull(
                        commitmentDate);
    }

    public static ProjectCommitment create(
            UUID id,
            UUID projectId,
            UUID costCodeId,
            String reference,
            String vendorName,
            String description,
            BigDecimal committedAmount,
            CommitmentStatus status,
            LocalDate commitmentDate) {

        return new ProjectCommitment(
                id,
                projectId,
                costCodeId,
                reference,
                vendorName,
                description,
                committedAmount,
                status,
                commitmentDate);
    }

    public void update(
            String vendorName,
            String description,
            BigDecimal committedAmount,
            CommitmentStatus status,
            LocalDate commitmentDate) {

        this.vendorName =
                Objects.requireNonNull(vendorName);

        this.description = description;

        this.committedAmount =
                Objects.requireNonNull(
                        committedAmount);

        this.status =
                Objects.requireNonNull(status);

        this.commitmentDate =
                Objects.requireNonNull(
                        commitmentDate);
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

    public UUID getCostCodeId() {
        return costCodeId;
    }

    public String getReference() {
        return reference;
    }

    public String getVendorName() {
        return vendorName;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getCommittedAmount() {
        return committedAmount;
    }

    public CommitmentStatus getStatus() {
        return status;
    }

    public LocalDate getCommitmentDate() {
        return commitmentDate;
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
