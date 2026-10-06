package com.buildsight.platform.periodcontrol.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import com.buildsight.platform.forecast.api.ForecastModels.ForecastIntelligenceResponse;
import com.buildsight.platform.governance.api.GovernanceModels.GovernanceIntelligenceResponse;
import com.buildsight.platform.periodcontrol.service.PeriodControlCalculator.ControlEvaluation;
import com.buildsight.platform.recovery.api.RecoveryModels.ChangeImpactIntelligenceResponse;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_period_end_snapshots")
public class ProjectPeriodEndSnapshot {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "period_id",
            nullable = false,
            updatable = false)
    private UUID periodId;

    @Column(
            name = "baseline_version_id",
            nullable = false,
            updatable = false)
    private UUID baselineVersionId;

    @Column(
            name = "period_code",
            nullable = false,
            length = 64,
            updatable = false)
    private String periodCode;

    @Column(
            name = "period_start_date",
            nullable = false,
            updatable = false)
    private LocalDate periodStartDate;

    @Column(
            name = "period_end_date",
            nullable = false,
            updatable = false)
    private LocalDate periodEndDate;

    @Column(
            name = "source_data_date",
            nullable = false,
            updatable = false)
    private LocalDate sourceDataDate;

    @Column(
            name = "baseline_cost_target",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal baselineCostTarget;

    @Column(
            name = "baseline_finish_target",
            nullable = false)
    private LocalDate baselineFinishTarget;

    @Column(
            name = "budget_at_completion",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal budgetAtCompletion;

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
            name = "expected_forecast_cost",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal expectedForecastCost;

    @Column(
            name = "expected_forecast_finish_date",
            nullable = false)
    private LocalDate expectedForecastFinishDate;

    @Column(
            name = "planned_progress_percentage",
            nullable = false,
            precision = 7,
            scale = 2)
    private BigDecimal plannedProgressPercentage;

    @Column(
            name = "earned_progress_percentage",
            nullable = false,
            precision = 7,
            scale = 2)
    private BigDecimal earnedProgressPercentage;

    @Column(
            name = "cost_performance_index",
            nullable = false,
            precision = 12,
            scale = 4)
    private BigDecimal costPerformanceIndex;

    @Column(
            name = "schedule_performance_index",
            nullable = false,
            precision = 12,
            scale = 4)
    private BigDecimal schedulePerformanceIndex;

    @Column(
            name = "cost_variance_to_baseline",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal costVarianceToBaseline;

    @Column(
            name = "finish_variance_days",
            nullable = false)
    private long finishVarianceDays;

    @Column(
            name = "predictive_score",
            nullable = false,
            precision = 7,
            scale = 2)
    private BigDecimal predictiveScore;

    @Column(
            name = "predictive_risk",
            nullable = false,
            length = 32)
    private String predictiveRisk;

    @Column(
            name = "governance_score",
            nullable = false,
            precision = 7,
            scale = 2)
    private BigDecimal governanceScore;

    @Column(
            name = "governance_risk",
            nullable = false,
            length = 32)
    private String governanceRisk;

    @Column(
            name = "recovery_score",
            nullable = false,
            precision = 7,
            scale = 2)
    private BigDecimal recoveryScore;

    @Column(
            name = "recovery_risk",
            nullable = false,
            length = 32)
    private String recoveryRisk;

    @Column(
            name = "change_cost_exposure",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal changeCostExposure;

    @Column(
            name = "recovery_residual_delay_days",
            nullable = false)
    private long recoveryResidualDelayDays;

    @Column(
            name = "open_actions",
            nullable = false)
    private long openActions;

    @Column(
            name = "overdue_actions",
            nullable = false)
    private long overdueActions;

    @Column(
            name = "critical_open_actions",
            nullable = false)
    private long criticalOpenActions;

    @Column(
            name = "blocked_actions",
            nullable = false)
    private long blockedActions;

    @Column(
            name = "period_control_score",
            nullable = false,
            precision = 7,
            scale = 2)
    private BigDecimal periodControlScore;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "period_control_risk",
            nullable = false,
            length = 32)
    private PeriodControlRiskLevel periodControlRisk;

    @Column(
            name = "closed_at",
            nullable = false,
            updatable = false)
    private Instant closedAt;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    protected ProjectPeriodEndSnapshot() {
    }

    private ProjectPeriodEndSnapshot(
            UUID id,
            UUID projectId,
            ProjectProgressPeriod period,
            ProjectControlBaselineVersion baseline,
            ForecastIntelligenceResponse forecast,
            GovernanceIntelligenceResponse governance,
            ChangeImpactIntelligenceResponse recovery,
            ControlEvaluation evaluation,
            Instant closedAt) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.periodId =
                period.getId();

        this.baselineVersionId =
                baseline.getId();

        this.periodCode =
                period.getPeriodCode();

        this.periodStartDate =
                period.getStartDate();

        this.periodEndDate =
                period.getEndDate();

        this.sourceDataDate =
                forecast.dataDate();

        this.baselineCostTarget =
                baseline.getCostTarget();

        this.baselineFinishTarget =
                baseline.getFinishTarget();

        this.budgetAtCompletion =
                forecast.bac();

        this.plannedValue =
                forecast.plannedValue();

        this.earnedValue =
                forecast.earnedValue();

        this.actualCost =
                forecast.actualCost();

        this.expectedForecastCost =
                forecast.expectedForecastCost();

        this.expectedForecastFinishDate =
                forecast.expectedForecastFinishDate();

        this.plannedProgressPercentage =
                BigDecimal.valueOf(
                        evaluation.plannedProgressPercentage());

        this.earnedProgressPercentage =
                BigDecimal.valueOf(
                        evaluation.earnedProgressPercentage());

        this.costPerformanceIndex =
                forecast.cpi();

        this.schedulePerformanceIndex =
                forecast.spi();

        this.costVarianceToBaseline =
                evaluation.costVarianceToBaseline();

        this.finishVarianceDays =
                evaluation.finishVarianceDays();

        this.predictiveScore =
                BigDecimal.valueOf(
                        forecast.predictiveScore());

        this.predictiveRisk =
                forecast.predictiveRisk()
                        .name();

        this.governanceScore =
                BigDecimal.valueOf(
                        governance.governanceScore());

        this.governanceRisk =
                governance.governanceRisk()
                        .name();

        this.recoveryScore =
                BigDecimal.valueOf(
                        recovery.recoveryScore());

        this.recoveryRisk =
                recovery.recoveryRisk()
                        .name();

        this.changeCostExposure =
                recovery.changeCostExposure();

        this.recoveryResidualDelayDays =
                recovery.residualDelayDays();

        this.openActions =
                governance.openActions();

        this.overdueActions =
                governance.overdueActions();

        this.criticalOpenActions =
                governance.criticalOpenActions();

        this.blockedActions =
                governance.blockedActions();

        this.periodControlScore =
                BigDecimal.valueOf(
                        evaluation.controlScore());

        this.periodControlRisk =
                evaluation.controlRisk();

        this.closedAt =
                Objects.requireNonNull(
                        closedAt);
    }

    public static ProjectPeriodEndSnapshot capture(
            UUID id,
            UUID projectId,
            ProjectProgressPeriod period,
            ProjectControlBaselineVersion baseline,
            ForecastIntelligenceResponse forecast,
            GovernanceIntelligenceResponse governance,
            ChangeImpactIntelligenceResponse recovery,
            ControlEvaluation evaluation,
            Instant closedAt) {

        return new ProjectPeriodEndSnapshot(
                id,
                projectId,
                period,
                baseline,
                forecast,
                governance,
                recovery,
                evaluation,
                closedAt);
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

    public UUID getPeriodId() {
        return periodId;
    }

    public UUID getBaselineVersionId() {
        return baselineVersionId;
    }

    public String getPeriodCode() {
        return periodCode;
    }

    public LocalDate getPeriodStartDate() {
        return periodStartDate;
    }

    public LocalDate getPeriodEndDate() {
        return periodEndDate;
    }

    public LocalDate getSourceDataDate() {
        return sourceDataDate;
    }

    public BigDecimal getBaselineCostTarget() {
        return baselineCostTarget;
    }

    public LocalDate getBaselineFinishTarget() {
        return baselineFinishTarget;
    }

    public BigDecimal getBudgetAtCompletion() {
        return budgetAtCompletion;
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

    public BigDecimal getExpectedForecastCost() {
        return expectedForecastCost;
    }

    public LocalDate getExpectedForecastFinishDate() {
        return expectedForecastFinishDate;
    }

    public BigDecimal getPlannedProgressPercentage() {
        return plannedProgressPercentage;
    }

    public BigDecimal getEarnedProgressPercentage() {
        return earnedProgressPercentage;
    }

    public BigDecimal getCostPerformanceIndex() {
        return costPerformanceIndex;
    }

    public BigDecimal getSchedulePerformanceIndex() {
        return schedulePerformanceIndex;
    }

    public BigDecimal getCostVarianceToBaseline() {
        return costVarianceToBaseline;
    }

    public long getFinishVarianceDays() {
        return finishVarianceDays;
    }

    public BigDecimal getPredictiveScore() {
        return predictiveScore;
    }

    public String getPredictiveRisk() {
        return predictiveRisk;
    }

    public BigDecimal getGovernanceScore() {
        return governanceScore;
    }

    public String getGovernanceRisk() {
        return governanceRisk;
    }

    public BigDecimal getRecoveryScore() {
        return recoveryScore;
    }

    public String getRecoveryRisk() {
        return recoveryRisk;
    }

    public BigDecimal getChangeCostExposure() {
        return changeCostExposure;
    }

    public long getRecoveryResidualDelayDays() {
        return recoveryResidualDelayDays;
    }

    public long getOpenActions() {
        return openActions;
    }

    public long getOverdueActions() {
        return overdueActions;
    }

    public long getCriticalOpenActions() {
        return criticalOpenActions;
    }

    public long getBlockedActions() {
        return blockedActions;
    }

    public BigDecimal getPeriodControlScore() {
        return periodControlScore;
    }

    public PeriodControlRiskLevel getPeriodControlRisk() {
        return periodControlRisk;
    }

    public Instant getClosedAt() {
        return closedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
