package com.buildsight.platform.periodcontrol.domain;

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
@Table(name = "project_control_baseline_versions")
public class ProjectControlBaselineVersion {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "version_code",
            nullable = false,
            length = 64,
            updatable = false)
    private String versionCode;

    @Column(
            name = "title",
            nullable = false,
            length = 220)
    private String title;

    @Column(
            name = "reason",
            columnDefinition = "TEXT")
    private String reason;

    @Column(
            name = "change_reference",
            length = 120)
    private String changeReference;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private ControlBaselineStatus status;

    @Column(
            name = "source_data_date",
            nullable = false)
    private LocalDate sourceDataDate;

    @Column(
            name = "budget_at_completion",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal budgetAtCompletion;

    @Column(
            name = "cost_target",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal costTarget;

    @Column(
            name = "finish_target",
            nullable = false)
    private LocalDate finishTarget;

    @Column(
            name = "captured_predictive_score",
            nullable = false,
            precision = 7,
            scale = 2)
    private BigDecimal capturedPredictiveScore;

    @Column(name = "approved_at")
    private Instant approvedAt;

    @Column(name = "superseded_at")
    private Instant supersededAt;

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

    protected ProjectControlBaselineVersion() {
    }

    private ProjectControlBaselineVersion(
            UUID id,
            UUID projectId,
            String versionCode,
            String title,
            String reason,
            String changeReference,
            LocalDate sourceDataDate,
            BigDecimal budgetAtCompletion,
            BigDecimal costTarget,
            LocalDate finishTarget,
            BigDecimal capturedPredictiveScore) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.versionCode =
                Objects.requireNonNull(
                        versionCode);

        this.title =
                Objects.requireNonNull(
                        title);

        this.reason =
                reason;

        this.changeReference =
                changeReference;

        this.status =
                ControlBaselineStatus.DRAFT;

        this.sourceDataDate =
                Objects.requireNonNull(
                        sourceDataDate);

        this.budgetAtCompletion =
                Objects.requireNonNull(
                        budgetAtCompletion);

        this.costTarget =
                Objects.requireNonNull(
                        costTarget);

        this.finishTarget =
                Objects.requireNonNull(
                        finishTarget);

        this.capturedPredictiveScore =
                Objects.requireNonNull(
                        capturedPredictiveScore);
    }

    public static ProjectControlBaselineVersion capture(
            UUID id,
            UUID projectId,
            String versionCode,
            String title,
            String reason,
            String changeReference,
            LocalDate sourceDataDate,
            BigDecimal budgetAtCompletion,
            BigDecimal costTarget,
            LocalDate finishTarget,
            BigDecimal capturedPredictiveScore) {

        return new ProjectControlBaselineVersion(
                id,
                projectId,
                versionCode,
                title,
                reason,
                changeReference,
                sourceDataDate,
                budgetAtCompletion,
                costTarget,
                finishTarget,
                capturedPredictiveScore);
    }

    public void approve(
            Instant now) {

        if (status != ControlBaselineStatus.DRAFT) {

            throw new IllegalStateException(
                    "Only draft control baselines can be approved.");
        }

        status =
                ControlBaselineStatus.APPROVED;

        approvedAt =
                Objects.requireNonNull(
                        now);
    }

    public void supersede(
            Instant now) {

        if (status != ControlBaselineStatus.APPROVED) {

            throw new IllegalStateException(
                    "Only approved control baselines can be superseded.");
        }

        status =
                ControlBaselineStatus.SUPERSEDED;

        supersededAt =
                Objects.requireNonNull(
                        now);
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

    public String getVersionCode() {
        return versionCode;
    }

    public String getTitle() {
        return title;
    }

    public String getReason() {
        return reason;
    }

    public String getChangeReference() {
        return changeReference;
    }

    public ControlBaselineStatus getStatus() {
        return status;
    }

    public LocalDate getSourceDataDate() {
        return sourceDataDate;
    }

    public BigDecimal getBudgetAtCompletion() {
        return budgetAtCompletion;
    }

    public BigDecimal getCostTarget() {
        return costTarget;
    }

    public LocalDate getFinishTarget() {
        return finishTarget;
    }

    public BigDecimal getCapturedPredictiveScore() {
        return capturedPredictiveScore;
    }

    public Instant getApprovedAt() {
        return approvedAt;
    }

    public Instant getSupersededAt() {
        return supersededAt;
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
