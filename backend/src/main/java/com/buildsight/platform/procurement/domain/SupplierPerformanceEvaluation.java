package com.buildsight.platform.procurement.domain;

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
@Table(name = "supplier_performance_evaluations")
public class SupplierPerformanceEvaluation {

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
            name = "supplier_id",
            nullable = false,
            updatable = false)
    private UUID supplierId;

    @Column(
            name = "procurement_package_id",
            updatable = false)
    private UUID procurementPackageId;

    @Column(
            name = "evaluation_date",
            nullable = false,
            updatable = false)
    private LocalDate evaluationDate;

    @Column(
            name = "quality_score",
            nullable = false,
            precision = 5,
            scale = 2,
            updatable = false)
    private BigDecimal qualityScore;

    @Column(
            name = "delivery_score",
            nullable = false,
            precision = 5,
            scale = 2,
            updatable = false)
    private BigDecimal deliveryScore;

    @Column(
            name = "safety_score",
            nullable = false,
            precision = 5,
            scale = 2,
            updatable = false)
    private BigDecimal safetyScore;

    @Column(
            name = "commercial_score",
            nullable = false,
            precision = 5,
            scale = 2,
            updatable = false)
    private BigDecimal commercialScore;

    @Column(
            name = "comments",
            length = 1500,
            updatable = false)
    private String comments;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    protected SupplierPerformanceEvaluation() {
    }

    private SupplierPerformanceEvaluation(
            UUID id,
            UUID projectId,
            UUID supplierId,
            UUID procurementPackageId,
            LocalDate evaluationDate,
            BigDecimal qualityScore,
            BigDecimal deliveryScore,
            BigDecimal safetyScore,
            BigDecimal commercialScore,
            String comments) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(
                        projectId);

        this.supplierId =
                Objects.requireNonNull(
                        supplierId);

        this.procurementPackageId =
                procurementPackageId;

        this.evaluationDate =
                Objects.requireNonNull(
                        evaluationDate);

        this.qualityScore =
                Objects.requireNonNull(
                        qualityScore);

        this.deliveryScore =
                Objects.requireNonNull(
                        deliveryScore);

        this.safetyScore =
                Objects.requireNonNull(
                        safetyScore);

        this.commercialScore =
                Objects.requireNonNull(
                        commercialScore);

        this.comments =
                comments;
    }

    public static SupplierPerformanceEvaluation create(
            UUID id,
            UUID projectId,
            UUID supplierId,
            UUID procurementPackageId,
            LocalDate evaluationDate,
            BigDecimal qualityScore,
            BigDecimal deliveryScore,
            BigDecimal safetyScore,
            BigDecimal commercialScore,
            String comments) {

        return new SupplierPerformanceEvaluation(
                id,
                projectId,
                supplierId,
                procurementPackageId,
                evaluationDate,
                qualityScore,
                deliveryScore,
                safetyScore,
                commercialScore,
                comments);
    }

    public double overallScore() {
        return qualityScore.doubleValue()
                        * 0.30
                + deliveryScore.doubleValue()
                        * 0.30
                + safetyScore.doubleValue()
                        * 0.20
                + commercialScore.doubleValue()
                        * 0.20;
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

    public UUID getSupplierId() {
        return supplierId;
    }

    public UUID getProcurementPackageId() {
        return procurementPackageId;
    }

    public LocalDate getEvaluationDate() {
        return evaluationDate;
    }

    public BigDecimal getQualityScore() {
        return qualityScore;
    }

    public BigDecimal getDeliveryScore() {
        return deliveryScore;
    }

    public BigDecimal getSafetyScore() {
        return safetyScore;
    }

    public BigDecimal getCommercialScore() {
        return commercialScore;
    }

    public String getComments() {
        return comments;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
