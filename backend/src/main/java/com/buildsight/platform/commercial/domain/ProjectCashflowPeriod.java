package com.buildsight.platform.commercial.domain;

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
@Table(name = "project_cashflow_periods")
public class ProjectCashflowPeriod {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "period_start",
            nullable = false,
            updatable = false)
    private LocalDate periodStart;

    @Column(
            name = "period_end",
            nullable = false)
    private LocalDate periodEnd;

    @Column(
            name = "planned_inflow",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal plannedInflow;

    @Column(
            name = "forecast_inflow",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal forecastInflow;

    @Column(
            name = "actual_inflow",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal actualInflow;

    @Column(
            name = "planned_outflow",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal plannedOutflow;

    @Column(
            name = "forecast_outflow",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal forecastOutflow;

    @Column(
            name = "actual_outflow",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal actualOutflow;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private CashflowPeriodStatus status;

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

    protected ProjectCashflowPeriod() {
    }

    private ProjectCashflowPeriod(
            UUID id,
            UUID projectId,
            LocalDate periodStart,
            LocalDate periodEnd,
            BigDecimal plannedInflow,
            BigDecimal forecastInflow,
            BigDecimal actualInflow,
            BigDecimal plannedOutflow,
            BigDecimal forecastOutflow,
            BigDecimal actualOutflow) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.periodStart =
                Objects.requireNonNull(periodStart);

        this.periodEnd =
                Objects.requireNonNull(periodEnd);

        this.plannedInflow =
                Objects.requireNonNull(plannedInflow);

        this.forecastInflow =
                Objects.requireNonNull(forecastInflow);

        this.actualInflow =
                Objects.requireNonNull(actualInflow);

        this.plannedOutflow =
                Objects.requireNonNull(plannedOutflow);

        this.forecastOutflow =
                Objects.requireNonNull(forecastOutflow);

        this.actualOutflow =
                Objects.requireNonNull(actualOutflow);

        this.status =
                CashflowPeriodStatus.OPEN;
    }

    public static ProjectCashflowPeriod create(
            UUID id,
            UUID projectId,
            LocalDate periodStart,
            LocalDate periodEnd,
            BigDecimal plannedInflow,
            BigDecimal forecastInflow,
            BigDecimal actualInflow,
            BigDecimal plannedOutflow,
            BigDecimal forecastOutflow,
            BigDecimal actualOutflow) {

        return new ProjectCashflowPeriod(
                id,
                projectId,
                periodStart,
                periodEnd,
                plannedInflow,
                forecastInflow,
                actualInflow,
                plannedOutflow,
                forecastOutflow,
                actualOutflow);
    }

    public void update(
            LocalDate periodEnd,
            BigDecimal plannedInflow,
            BigDecimal forecastInflow,
            BigDecimal actualInflow,
            BigDecimal plannedOutflow,
            BigDecimal forecastOutflow,
            BigDecimal actualOutflow,
            CashflowPeriodStatus status) {

        this.periodEnd =
                Objects.requireNonNull(periodEnd);

        this.plannedInflow =
                Objects.requireNonNull(plannedInflow);

        this.forecastInflow =
                Objects.requireNonNull(forecastInflow);

        this.actualInflow =
                Objects.requireNonNull(actualInflow);

        this.plannedOutflow =
                Objects.requireNonNull(plannedOutflow);

        this.forecastOutflow =
                Objects.requireNonNull(forecastOutflow);

        this.actualOutflow =
                Objects.requireNonNull(actualOutflow);

        this.status =
                Objects.requireNonNull(status);
    }

    public BigDecimal plannedNet() {
        return plannedInflow
                .subtract(plannedOutflow);
    }

    public BigDecimal forecastNet() {
        return forecastInflow
                .subtract(forecastOutflow);
    }

    public BigDecimal actualNet() {
        return actualInflow
                .subtract(actualOutflow);
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

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public BigDecimal getPlannedInflow() {
        return plannedInflow;
    }

    public BigDecimal getForecastInflow() {
        return forecastInflow;
    }

    public BigDecimal getActualInflow() {
        return actualInflow;
    }

    public BigDecimal getPlannedOutflow() {
        return plannedOutflow;
    }

    public BigDecimal getForecastOutflow() {
        return forecastOutflow;
    }

    public BigDecimal getActualOutflow() {
        return actualOutflow;
    }

    public CashflowPeriodStatus getStatus() {
        return status;
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
