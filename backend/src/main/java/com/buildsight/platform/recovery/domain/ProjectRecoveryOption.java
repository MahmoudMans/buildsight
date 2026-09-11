package com.buildsight.platform.recovery.domain;

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
@Table(name = "project_recovery_options")
public class ProjectRecoveryOption {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "simulation_id",
            nullable = false,
            updatable = false)
    private UUID simulationId;

    @Column(
            name = "option_number",
            nullable = false,
            length = 64,
            updatable = false)
    private String optionNumber;

    @Column(
            name = "name",
            nullable = false,
            length = 220)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "strategy_type",
            nullable = false,
            length = 40)
    private RecoveryStrategyType strategyType;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private RecoveryOptionStatus status;

    @Column(
            name = "schedule_recovery_days",
            nullable = false)
    private int scheduleRecoveryDays;

    @Column(
            name = "incremental_cost",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal incrementalCost;

    @Column(
            name = "productivity_improvement_percentage",
            nullable = false,
            precision = 8,
            scale = 3)
    private BigDecimal productivityImprovementPercentage;

    @Column(
            name = "procurement_recovery_days",
            nullable = false)
    private int procurementRecoveryDays;

    @Column(
            name = "resource_capacity_improvement_percentage",
            nullable = false,
            precision = 8,
            scale = 3)
    private BigDecimal resourceCapacityImprovementPercentage;

    @Column(
            name = "residual_risk_percentage",
            nullable = false,
            precision = 8,
            scale = 3)
    private BigDecimal residualRiskPercentage;

    @Column(
            name = "notes",
            columnDefinition = "TEXT")
    private String notes;

    @Column(name = "selected_at")
    private Instant selectedAt;

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

    protected ProjectRecoveryOption() {
    }

    private ProjectRecoveryOption(
            UUID id,
            UUID projectId,
            UUID simulationId,
            String optionNumber,
            String name,
            RecoveryStrategyType strategyType,
            int scheduleRecoveryDays,
            BigDecimal incrementalCost,
            BigDecimal productivityImprovementPercentage,
            int procurementRecoveryDays,
            BigDecimal resourceCapacityImprovementPercentage,
            BigDecimal residualRiskPercentage,
            String notes) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.simulationId =
                Objects.requireNonNull(
                        simulationId);

        this.optionNumber =
                Objects.requireNonNull(
                        optionNumber);

        this.name =
                Objects.requireNonNull(
                        name);

        this.strategyType =
                Objects.requireNonNull(
                        strategyType);

        this.status =
                RecoveryOptionStatus.DRAFT;

        this.scheduleRecoveryDays =
                scheduleRecoveryDays;

        this.incrementalCost =
                Objects.requireNonNull(
                        incrementalCost);

        this.productivityImprovementPercentage =
                Objects.requireNonNull(
                        productivityImprovementPercentage);

        this.procurementRecoveryDays =
                procurementRecoveryDays;

        this.resourceCapacityImprovementPercentage =
                Objects.requireNonNull(
                        resourceCapacityImprovementPercentage);

        this.residualRiskPercentage =
                Objects.requireNonNull(
                        residualRiskPercentage);

        this.notes =
                notes;
    }

    public static ProjectRecoveryOption create(
            UUID id,
            UUID projectId,
            UUID simulationId,
            String optionNumber,
            String name,
            RecoveryStrategyType strategyType,
            int scheduleRecoveryDays,
            BigDecimal incrementalCost,
            BigDecimal productivityImprovementPercentage,
            int procurementRecoveryDays,
            BigDecimal resourceCapacityImprovementPercentage,
            BigDecimal residualRiskPercentage,
            String notes) {

        return new ProjectRecoveryOption(
                id,
                projectId,
                simulationId,
                optionNumber,
                name,
                strategyType,
                scheduleRecoveryDays,
                incrementalCost,
                productivityImprovementPercentage,
                procurementRecoveryDays,
                resourceCapacityImprovementPercentage,
                residualRiskPercentage,
                notes);
    }

    public void update(
            String name,
            RecoveryStrategyType strategyType,
            int scheduleRecoveryDays,
            BigDecimal incrementalCost,
            BigDecimal productivityImprovementPercentage,
            int procurementRecoveryDays,
            BigDecimal resourceCapacityImprovementPercentage,
            BigDecimal residualRiskPercentage,
            String notes) {

        if (status != RecoveryOptionStatus.DRAFT) {

            throw new IllegalStateException(
                    "Only draft recovery options can be edited.");
        }

        this.name =
                Objects.requireNonNull(
                        name);

        this.strategyType =
                Objects.requireNonNull(
                        strategyType);

        this.scheduleRecoveryDays =
                scheduleRecoveryDays;

        this.incrementalCost =
                Objects.requireNonNull(
                        incrementalCost);

        this.productivityImprovementPercentage =
                Objects.requireNonNull(
                        productivityImprovementPercentage);

        this.procurementRecoveryDays =
                procurementRecoveryDays;

        this.resourceCapacityImprovementPercentage =
                Objects.requireNonNull(
                        resourceCapacityImprovementPercentage);

        this.residualRiskPercentage =
                Objects.requireNonNull(
                        residualRiskPercentage);

        this.notes =
                notes;
    }

    public void select(
            Instant now) {

        if (status != RecoveryOptionStatus.DRAFT) {

            throw new IllegalStateException(
                    "Only draft recovery options can be selected.");
        }

        status =
                RecoveryOptionStatus.SELECTED;

        selectedAt =
                now;
    }

    public void reject() {

        if (status == RecoveryOptionStatus.DRAFT) {

            status =
                    RecoveryOptionStatus.REJECTED;
        }
    }

    @PrePersist
    void onCreate() {

        Instant now =
                Instant.now();

        if (createdAt == null) {

            createdAt =
                    now;
        }

        updatedAt =
                now;
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

    public UUID getSimulationId() {
        return simulationId;
    }

    public String getOptionNumber() {
        return optionNumber;
    }

    public String getName() {
        return name;
    }

    public RecoveryStrategyType getStrategyType() {
        return strategyType;
    }

    public RecoveryOptionStatus getStatus() {
        return status;
    }

    public int getScheduleRecoveryDays() {
        return scheduleRecoveryDays;
    }

    public BigDecimal getIncrementalCost() {
        return incrementalCost;
    }

    public BigDecimal getProductivityImprovementPercentage() {
        return productivityImprovementPercentage;
    }

    public int getProcurementRecoveryDays() {
        return procurementRecoveryDays;
    }

    public BigDecimal getResourceCapacityImprovementPercentage() {
        return resourceCapacityImprovementPercentage;
    }

    public BigDecimal getResidualRiskPercentage() {
        return residualRiskPercentage;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getSelectedAt() {
        return selectedAt;
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
