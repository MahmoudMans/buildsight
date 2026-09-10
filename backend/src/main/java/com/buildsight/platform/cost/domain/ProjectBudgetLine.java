package com.buildsight.platform.cost.domain;

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
@Table(name = "project_budget_lines")
public class ProjectBudgetLine {

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
            name = "description",
            length = 1000)
    private String description;

    @Column(
            name = "original_budget",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal originalBudget;

    @Column(
            name = "approved_changes",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal approvedChanges;

    @Column(
            name = "forecast_cost",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal forecastCost;

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

    protected ProjectBudgetLine() {
    }

    private ProjectBudgetLine(
            UUID id,
            UUID projectId,
            UUID costCodeId,
            String description,
            BigDecimal originalBudget,
            BigDecimal approvedChanges,
            BigDecimal forecastCost) {

        this.id = Objects.requireNonNull(id);
        this.projectId =
                Objects.requireNonNull(projectId);
        this.costCodeId =
                Objects.requireNonNull(costCodeId);
        this.description = description;
        this.originalBudget =
                Objects.requireNonNull(originalBudget);
        this.approvedChanges =
                Objects.requireNonNull(approvedChanges);
        this.forecastCost =
                Objects.requireNonNull(forecastCost);
    }

    public static ProjectBudgetLine create(
            UUID id,
            UUID projectId,
            UUID costCodeId,
            String description,
            BigDecimal originalBudget,
            BigDecimal approvedChanges,
            BigDecimal forecastCost) {

        return new ProjectBudgetLine(
                id,
                projectId,
                costCodeId,
                description,
                originalBudget,
                approvedChanges,
                forecastCost);
    }

    public void update(
            String description,
            BigDecimal originalBudget,
            BigDecimal approvedChanges,
            BigDecimal forecastCost) {

        this.description = description;

        this.originalBudget =
                Objects.requireNonNull(
                        originalBudget);

        this.approvedChanges =
                Objects.requireNonNull(
                        approvedChanges);

        this.forecastCost =
                Objects.requireNonNull(
                        forecastCost);
    }

    public BigDecimal revisedBudget() {
        return originalBudget.add(
                approvedChanges);
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

    public String getDescription() {
        return description;
    }

    public BigDecimal getOriginalBudget() {
        return originalBudget;
    }

    public BigDecimal getApprovedChanges() {
        return approvedChanges;
    }

    public BigDecimal getForecastCost() {
        return forecastCost;
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
