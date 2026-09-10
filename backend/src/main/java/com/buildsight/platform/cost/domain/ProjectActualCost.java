package com.buildsight.platform.cost.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_actual_costs")
public class ProjectActualCost {

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
            name = "commitment_id",
            updatable = false)
    private UUID commitmentId;

    @Column(
            name = "reference",
            nullable = false,
            length = 64,
            updatable = false)
    private String reference;

    @Column(
            name = "supplier_name",
            nullable = false,
            length = 180,
            updatable = false)
    private String supplierName;

    @Column(
            name = "description",
            length = 1200,
            updatable = false)
    private String description;

    @Column(
            name = "amount",
            nullable = false,
            precision = 19,
            scale = 2,
            updatable = false)
    private BigDecimal amount;

    @Column(
            name = "cost_date",
            nullable = false,
            updatable = false)
    private LocalDate costDate;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    protected ProjectActualCost() {
    }

    private ProjectActualCost(
            UUID id,
            UUID projectId,
            UUID costCodeId,
            UUID commitmentId,
            String reference,
            String supplierName,
            String description,
            BigDecimal amount,
            LocalDate costDate) {

        this.id = Objects.requireNonNull(id);
        this.projectId =
                Objects.requireNonNull(projectId);
        this.costCodeId =
                Objects.requireNonNull(costCodeId);
        this.commitmentId = commitmentId;
        this.reference =
                Objects.requireNonNull(reference);
        this.supplierName =
                Objects.requireNonNull(supplierName);
        this.description = description;
        this.amount =
                Objects.requireNonNull(amount);
        this.costDate =
                Objects.requireNonNull(costDate);
    }

    public static ProjectActualCost create(
            UUID id,
            UUID projectId,
            UUID costCodeId,
            UUID commitmentId,
            String reference,
            String supplierName,
            String description,
            BigDecimal amount,
            LocalDate costDate) {

        return new ProjectActualCost(
                id,
                projectId,
                costCodeId,
                commitmentId,
                reference,
                supplierName,
                description,
                amount,
                costDate);
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
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

    public UUID getCommitmentId() {
        return commitmentId;
    }

    public String getReference() {
        return reference;
    }

    public String getSupplierName() {
        return supplierName;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getAmount() {
        return amount;
    }

    public LocalDate getCostDate() {
        return costDate;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
