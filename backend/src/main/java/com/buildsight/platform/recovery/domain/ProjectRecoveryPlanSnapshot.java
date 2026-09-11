package com.buildsight.platform.recovery.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import com.buildsight.platform.recovery.api.RecoveryModels.ChangeImpactEvaluationResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.RecoveryOptionEvaluationResponse;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_recovery_plan_snapshots")
public class ProjectRecoveryPlanSnapshot {

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
            name = "recovery_option_id",
            nullable = false,
            updatable = false)
    private UUID recoveryOptionId;

    @Column(
            name = "selected_at",
            nullable = false,
            updatable = false)
    private Instant selectedAt;

    @Column(
            name = "baseline_forecast_cost",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal baselineForecastCost;

    @Column(
            name = "impacted_forecast_cost",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal impactedForecastCost;

    @Column(
            name = "recovered_forecast_cost",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal recoveredForecastCost;

    @Column(
            name = "baseline_forecast_finish_date",
            nullable = false)
    private LocalDate baselineForecastFinishDate;

    @Column(
            name = "impacted_forecast_finish_date",
            nullable = false)
    private LocalDate impactedForecastFinishDate;

    @Column(
            name = "recovered_forecast_finish_date",
            nullable = false)
    private LocalDate recoveredForecastFinishDate;

    @Column(
            name = "change_cost_exposure",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal changeCostExposure;

    @Column(
            name = "recovery_cost",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal recoveryCost;

    @Column(
            name = "impact_delay_days",
            nullable = false)
    private long impactDelayDays;

    @Column(
            name = "recovered_days",
            nullable = false)
    private long recoveredDays;

    @Column(
            name = "residual_delay_days",
            nullable = false)
    private long residualDelayDays;

    @Column(
            name = "cost_per_day_recovered",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal costPerDayRecovered;

    @Column(
            name = "recovery_score",
            nullable = false,
            precision = 7,
            scale = 2)
    private BigDecimal recoveryScore;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "recovery_risk",
            nullable = false,
            length = 32)
    private RecoveryRiskLevel recoveryRisk;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    protected ProjectRecoveryPlanSnapshot() {
    }

    private ProjectRecoveryPlanSnapshot(
            UUID id,
            UUID projectId,
            UUID simulationId,
            UUID recoveryOptionId,
            Instant selectedAt,
            ChangeImpactEvaluationResponse impact,
            RecoveryOptionEvaluationResponse recovery) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.simulationId =
                Objects.requireNonNull(
                        simulationId);

        this.recoveryOptionId =
                Objects.requireNonNull(
                        recoveryOptionId);

        this.selectedAt =
                Objects.requireNonNull(
                        selectedAt);

        this.baselineForecastCost =
                impact.baselineForecastCost();

        this.impactedForecastCost =
                impact.impactedForecastCost();

        this.recoveredForecastCost =
                recovery.recoveredForecastCost();

        this.baselineForecastFinishDate =
                impact.baselineForecastFinishDate();

        this.impactedForecastFinishDate =
                impact.impactedForecastFinishDate();

        this.recoveredForecastFinishDate =
                recovery.recoveredForecastFinishDate();

        this.changeCostExposure =
                impact.totalChangeCostExposure();

        this.recoveryCost =
                recovery.recoveryCostVsImpacted();

        this.impactDelayDays =
                impact.scheduleImpactDays();

        this.recoveredDays =
                recovery.recoverableDays();

        this.residualDelayDays =
                recovery.residualDelayDays();

        this.costPerDayRecovered =
                recovery.costPerDayRecovered();

        this.recoveryScore =
                BigDecimal.valueOf(
                        recovery.recoveryScore());

        this.recoveryRisk =
                recovery.recoveryRisk();
    }

    public static ProjectRecoveryPlanSnapshot capture(
            UUID id,
            UUID projectId,
            UUID simulationId,
            UUID recoveryOptionId,
            Instant selectedAt,
            ChangeImpactEvaluationResponse impact,
            RecoveryOptionEvaluationResponse recovery) {

        return new ProjectRecoveryPlanSnapshot(
                id,
                projectId,
                simulationId,
                recoveryOptionId,
                selectedAt,
                impact,
                recovery);
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

    public UUID getSimulationId() {
        return simulationId;
    }

    public UUID getRecoveryOptionId() {
        return recoveryOptionId;
    }

    public Instant getSelectedAt() {
        return selectedAt;
    }

    public BigDecimal getBaselineForecastCost() {
        return baselineForecastCost;
    }

    public BigDecimal getImpactedForecastCost() {
        return impactedForecastCost;
    }

    public BigDecimal getRecoveredForecastCost() {
        return recoveredForecastCost;
    }

    public LocalDate getBaselineForecastFinishDate() {
        return baselineForecastFinishDate;
    }

    public LocalDate getImpactedForecastFinishDate() {
        return impactedForecastFinishDate;
    }

    public LocalDate getRecoveredForecastFinishDate() {
        return recoveredForecastFinishDate;
    }

    public BigDecimal getChangeCostExposure() {
        return changeCostExposure;
    }

    public BigDecimal getRecoveryCost() {
        return recoveryCost;
    }

    public long getImpactDelayDays() {
        return impactDelayDays;
    }

    public long getRecoveredDays() {
        return recoveredDays;
    }

    public long getResidualDelayDays() {
        return residualDelayDays;
    }

    public BigDecimal getCostPerDayRecovered() {
        return costPerDayRecovered;
    }

    public BigDecimal getRecoveryScore() {
        return recoveryScore;
    }

    public RecoveryRiskLevel getRecoveryRisk() {
        return recoveryRisk;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
