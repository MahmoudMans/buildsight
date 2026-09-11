package com.buildsight.platform.governance.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

import com.buildsight.platform.governance.api.GovernanceModels.ExecutiveReportResponse;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_executive_report_snapshots")
public class ProjectExecutiveReportSnapshot {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "report_date",
            nullable = false,
            updatable = false)
    private LocalDate reportDate;

    @Column(
            name = "physical_progress_percentage",
            nullable = false,
            precision = 7,
            scale = 2)
    private BigDecimal physicalProgressPercentage;

    @Column(
            name = "schedule_score",
            nullable = false,
            precision = 7,
            scale = 2)
    private BigDecimal scheduleScore;

    @Column(
            name = "schedule_risk",
            nullable = false,
            length = 32)
    private String scheduleRisk;

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

    @Enumerated(EnumType.STRING)
    @Column(
            name = "governance_risk",
            nullable = false,
            length = 32)
    private GovernanceRiskLevel governanceRisk;

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
            name = "open_actions",
            nullable = false)
    private long openActions;

    @Column(
            name = "overdue_actions",
            nullable = false)
    private long overdueActions;

    @Column(
            name = "blocked_actions",
            nullable = false)
    private long blockedActions;

    @Column(
            name = "pending_decisions",
            nullable = false)
    private long pendingDecisions;

    @Column(
            name = "overdue_decisions",
            nullable = false)
    private long overdueDecisions;

    @Column(
            name = "meetings_without_minutes",
            nullable = false)
    private long meetingsWithoutMinutes;

    @Column(
            name = "executive_summary",
            nullable = false,
            columnDefinition = "TEXT")
    private String executiveSummary;

    @Column(
            name = "attention_items",
            columnDefinition = "TEXT")
    private String attentionItems;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    protected ProjectExecutiveReportSnapshot() {
    }

    private ProjectExecutiveReportSnapshot(
            UUID id,
            UUID projectId,
            ExecutiveReportResponse report) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.reportDate =
                report.reportDate();

        this.physicalProgressPercentage =
                BigDecimal.valueOf(
                        report.physicalProgressPercentage());

        this.scheduleScore =
                BigDecimal.valueOf(
                        report.scheduleScore());

        this.scheduleRisk =
                report.scheduleRisk();

        this.predictiveScore =
                BigDecimal.valueOf(
                        report.predictiveScore());

        this.predictiveRisk =
                report.predictiveRisk();

        this.governanceScore =
                BigDecimal.valueOf(
                        report.governanceScore());

        this.governanceRisk =
                report.governanceRisk();

        this.cpi =
                report.cpi();

        this.spi =
                report.spi();

        this.expectedForecastCost =
                report.expectedForecastCost();

        this.expectedForecastFinishDate =
                report.expectedForecastFinishDate();

        this.openActions =
                report.openActions();

        this.overdueActions =
                report.overdueActions();

        this.blockedActions =
                report.blockedActions();

        this.pendingDecisions =
                report.pendingDecisions();

        this.overdueDecisions =
                report.overdueDecisions();

        this.meetingsWithoutMinutes =
                report.meetingsWithoutMinutes();

        this.executiveSummary =
                report.executiveSummary();

        this.attentionItems =
                report.attentionItems()
                        .stream()
                        .map(
                                item ->
                                        "%s | %s | %s | %s"
                                                .formatted(
                                                        item.severity(),
                                                        item.reference(),
                                                        item.title(),
                                                        item.detail()))
                        .collect(
                                Collectors.joining(
                                        "\n"));
    }

    public static ProjectExecutiveReportSnapshot capture(
            UUID id,
            UUID projectId,
            ExecutiveReportResponse report) {

        return new ProjectExecutiveReportSnapshot(
                id,
                projectId,
                report);
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

    public LocalDate getReportDate() {
        return reportDate;
    }

    public BigDecimal getPhysicalProgressPercentage() {
        return physicalProgressPercentage;
    }

    public BigDecimal getScheduleScore() {
        return scheduleScore;
    }

    public String getScheduleRisk() {
        return scheduleRisk;
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

    public GovernanceRiskLevel getGovernanceRisk() {
        return governanceRisk;
    }

    public BigDecimal getCpi() {
        return cpi;
    }

    public BigDecimal getSpi() {
        return spi;
    }

    public BigDecimal getExpectedForecastCost() {
        return expectedForecastCost;
    }

    public LocalDate getExpectedForecastFinishDate() {
        return expectedForecastFinishDate;
    }

    public long getOpenActions() {
        return openActions;
    }

    public long getOverdueActions() {
        return overdueActions;
    }

    public long getBlockedActions() {
        return blockedActions;
    }

    public long getPendingDecisions() {
        return pendingDecisions;
    }

    public long getOverdueDecisions() {
        return overdueDecisions;
    }

    public long getMeetingsWithoutMinutes() {
        return meetingsWithoutMinutes;
    }

    public String getExecutiveSummary() {
        return executiveSummary;
    }

    public String getAttentionItems() {
        return attentionItems;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
