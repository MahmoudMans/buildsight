package com.buildsight.platform.forecast.domain;

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
@Table(name = "project_forecast_scenarios")
public class ProjectForecastScenario {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "name",
            nullable = false,
            length = 180)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "scenario_type",
            nullable = false,
            length = 32)
    private ForecastScenarioType scenarioType;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private ForecastScenarioStatus status;

    @Column(
            name = "cost_adjustment_percentage",
            nullable = false,
            precision = 8,
            scale = 3)
    private BigDecimal costAdjustmentPercentage;

    @Column(
            name = "schedule_adjustment_days",
            nullable = false)
    private int scheduleAdjustmentDays;

    @Column(
            name = "productivity_multiplier",
            nullable = false,
            precision = 8,
            scale = 4)
    private BigDecimal productivityMultiplier;

    @Column(
            name = "procurement_delay_days",
            nullable = false)
    private int procurementDelayDays;

    @Column(
            name = "commercial_exposure_percentage",
            nullable = false,
            precision = 8,
            scale = 3)
    private BigDecimal commercialExposurePercentage;

    @Column(
            name = "risk_contingency_percentage",
            nullable = false,
            precision = 8,
            scale = 3)
    private BigDecimal riskContingencyPercentage;

    @Column(
            name = "resource_capacity_multiplier",
            nullable = false,
            precision = 8,
            scale = 4)
    private BigDecimal resourceCapacityMultiplier;

    @Column(
            name = "notes",
            columnDefinition = "TEXT")
    private String notes;

    @Column(name = "approved_at")
    private Instant approvedAt;

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

    protected ProjectForecastScenario() {
    }

    private ProjectForecastScenario(
            UUID id,
            UUID projectId,
            String name,
            ForecastScenarioType scenarioType,
            BigDecimal costAdjustmentPercentage,
            int scheduleAdjustmentDays,
            BigDecimal productivityMultiplier,
            int procurementDelayDays,
            BigDecimal commercialExposurePercentage,
            BigDecimal riskContingencyPercentage,
            BigDecimal resourceCapacityMultiplier,
            String notes) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.name =
                Objects.requireNonNull(name);

        this.scenarioType =
                Objects.requireNonNull(
                        scenarioType);

        this.status =
                ForecastScenarioStatus.DRAFT;

        this.costAdjustmentPercentage =
                Objects.requireNonNull(
                        costAdjustmentPercentage);

        this.scheduleAdjustmentDays =
                scheduleAdjustmentDays;

        this.productivityMultiplier =
                Objects.requireNonNull(
                        productivityMultiplier);

        this.procurementDelayDays =
                procurementDelayDays;

        this.commercialExposurePercentage =
                Objects.requireNonNull(
                        commercialExposurePercentage);

        this.riskContingencyPercentage =
                Objects.requireNonNull(
                        riskContingencyPercentage);

        this.resourceCapacityMultiplier =
                Objects.requireNonNull(
                        resourceCapacityMultiplier);

        this.notes =
                notes;
    }

    public static ProjectForecastScenario create(
            UUID id,
            UUID projectId,
            String name,
            ForecastScenarioType scenarioType,
            BigDecimal costAdjustmentPercentage,
            int scheduleAdjustmentDays,
            BigDecimal productivityMultiplier,
            int procurementDelayDays,
            BigDecimal commercialExposurePercentage,
            BigDecimal riskContingencyPercentage,
            BigDecimal resourceCapacityMultiplier,
            String notes) {

        return new ProjectForecastScenario(
                id,
                projectId,
                name,
                scenarioType,
                costAdjustmentPercentage,
                scheduleAdjustmentDays,
                productivityMultiplier,
                procurementDelayDays,
                commercialExposurePercentage,
                riskContingencyPercentage,
                resourceCapacityMultiplier,
                notes);
    }

    public void update(
            String name,
            ForecastScenarioType scenarioType,
            BigDecimal costAdjustmentPercentage,
            int scheduleAdjustmentDays,
            BigDecimal productivityMultiplier,
            int procurementDelayDays,
            BigDecimal commercialExposurePercentage,
            BigDecimal riskContingencyPercentage,
            BigDecimal resourceCapacityMultiplier,
            String notes) {

        if (status != ForecastScenarioStatus.DRAFT) {

            throw new IllegalStateException(
                    "Only draft forecast scenarios can be edited.");
        }

        this.name =
                Objects.requireNonNull(name);

        this.scenarioType =
                Objects.requireNonNull(
                        scenarioType);

        this.costAdjustmentPercentage =
                Objects.requireNonNull(
                        costAdjustmentPercentage);

        this.scheduleAdjustmentDays =
                scheduleAdjustmentDays;

        this.productivityMultiplier =
                Objects.requireNonNull(
                        productivityMultiplier);

        this.procurementDelayDays =
                procurementDelayDays;

        this.commercialExposurePercentage =
                Objects.requireNonNull(
                        commercialExposurePercentage);

        this.riskContingencyPercentage =
                Objects.requireNonNull(
                        riskContingencyPercentage);

        this.resourceCapacityMultiplier =
                Objects.requireNonNull(
                        resourceCapacityMultiplier);

        this.notes =
                notes;
    }

    public void approve() {

        if (status != ForecastScenarioStatus.DRAFT) {

            throw new IllegalStateException(
                    "Only draft forecast scenarios can be approved.");
        }

        status =
                ForecastScenarioStatus.APPROVED;

        approvedAt =
                Instant.now();
    }

    public void archive() {

        if (status == ForecastScenarioStatus.ARCHIVED) {
            return;
        }

        status =
                ForecastScenarioStatus.ARCHIVED;
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

    public String getName() {
        return name;
    }

    public ForecastScenarioType getScenarioType() {
        return scenarioType;
    }

    public ForecastScenarioStatus getStatus() {
        return status;
    }

    public BigDecimal getCostAdjustmentPercentage() {
        return costAdjustmentPercentage;
    }

    public int getScheduleAdjustmentDays() {
        return scheduleAdjustmentDays;
    }

    public BigDecimal getProductivityMultiplier() {
        return productivityMultiplier;
    }

    public int getProcurementDelayDays() {
        return procurementDelayDays;
    }

    public BigDecimal getCommercialExposurePercentage() {
        return commercialExposurePercentage;
    }

    public BigDecimal getRiskContingencyPercentage() {
        return riskContingencyPercentage;
    }

    public BigDecimal getResourceCapacityMultiplier() {
        return resourceCapacityMultiplier;
    }

    public String getNotes() {
        return notes;
    }

    public Instant getApprovedAt() {
        return approvedAt;
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
