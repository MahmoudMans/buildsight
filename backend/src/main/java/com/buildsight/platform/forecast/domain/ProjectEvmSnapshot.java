package com.buildsight.platform.forecast.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_evm_snapshots")
public class ProjectEvmSnapshot {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "data_date",
            nullable = false,
            updatable = false)
    private LocalDate dataDate;

    @Column(
            name = "bac",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal bac;

    @Column(
            name = "planned_value",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal plannedValue;

    @Column(
            name = "earned_value",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal earnedValue;

    @Column(
            name = "actual_cost",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal actualCost;

    @Column(
            name = "cost_variance",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal costVariance;

    @Column(
            name = "schedule_variance",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal scheduleVariance;

    @Column(
            name = "cpi",
            nullable = false,
            precision = 12,
            scale = 4)
    private BigDecimal cpi;

    @Column(
            name = "spi",
            nullable = false,
            precision = 12,
            scale = 4)
    private BigDecimal spi;

    @Column(
            name = "estimate_at_completion",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal estimateAtCompletion;

    @Column(
            name = "estimate_to_complete",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal estimateToComplete;

    @Column(
            name = "variance_at_completion",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal varianceAtCompletion;

    @Column(
            name = "tcpi",
            nullable = false,
            precision = 12,
            scale = 4)
    private BigDecimal tcpi;

    @Column(
            name = "forecast_finish_date",
            nullable = false)
    private LocalDate forecastFinishDate;

    @Column(
            name = "schedule_variance_days",
            nullable = false)
    private long scheduleVarianceDays;

    @Column(
            name = "predictive_score",
            nullable = false,
            precision = 7,
            scale = 2)
    private BigDecimal predictiveScore;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "predictive_risk",
            nullable = false,
            length = 32)
    private ForecastRiskLevel predictiveRisk;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    protected ProjectEvmSnapshot() {
    }

    private ProjectEvmSnapshot(
            UUID id,
            UUID projectId,
            ForecastIntelligenceResponse current) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.dataDate =
                current.dataDate();

        this.bac =
                current.bac();

        this.plannedValue =
                current.plannedValue();

        this.earnedValue =
                current.earnedValue();

        this.actualCost =
                current.actualCost();

        this.costVariance =
                current.costVariance();

        this.scheduleVariance =
                current.scheduleVariance();

        this.cpi =
                current.cpi();

        this.spi =
                current.spi();

        this.estimateAtCompletion =
                current.estimateAtCompletion();

        this.estimateToComplete =
                current.estimateToComplete();

        this.varianceAtCompletion =
                current.varianceAtCompletion();

        this.tcpi =
                current.tcpi();

        this.forecastFinishDate =
                current.expectedForecastFinishDate();

        this.scheduleVarianceDays =
                current.scheduleVarianceDays();

        this.predictiveScore =
                BigDecimal.valueOf(
                        current.predictiveScore());

        this.predictiveRisk =
                current.predictiveRisk();
    }

    public static ProjectEvmSnapshot capture(
            UUID id,
            UUID projectId,
            ForecastIntelligenceResponse current) {

        return new ProjectEvmSnapshot(
                id,
                projectId,
                current);
    }

    @PrePersist
    void onCreate() {

        if (createdAt == null) {

            createdAt =
                    Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public LocalDate getDataDate() {
        return dataDate;
    }

    public BigDecimal getBac() {
        return bac;
    }

    public BigDecimal getPlannedValue() {
        return plannedValue;
    }

    public BigDecimal getEarnedValue() {
        return earnedValue;
    }

    public BigDecimal getActualCost() {
        return actualCost;
    }

    public BigDecimal getCostVariance() {
        return costVariance;
    }

    public BigDecimal getScheduleVariance() {
        return scheduleVariance;
    }

    public BigDecimal getCpi() {
        return cpi;
    }

    public BigDecimal getSpi() {
        return spi;
    }

    public BigDecimal getEstimateAtCompletion() {
        return estimateAtCompletion;
    }

    public BigDecimal getEstimateToComplete() {
        return estimateToComplete;
    }

    public BigDecimal getVarianceAtCompletion() {
        return varianceAtCompletion;
    }

    public BigDecimal getTcpi() {
        return tcpi;
    }

    public LocalDate getForecastFinishDate() {
        return forecastFinishDate;
    }

    public long getScheduleVarianceDays() {
        return scheduleVarianceDays;
    }

    public BigDecimal getPredictiveScore() {
        return predictiveScore;
    }

    public ForecastRiskLevel getPredictiveRisk() {
        return predictiveRisk;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
