package com.buildsight.platform.procurement.domain;

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
@Table(name = "procurement_packages")
public class ProcurementPackage {

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
            name = "reference",
            nullable = false,
            length = 64,
            updatable = false)
    private String reference;

    @Column(
            name = "title",
            nullable = false,
            length = 180)
    private String title;

    @Column(
            name = "description",
            length = 1500)
    private String description;

    @Column(
            name = "estimated_value",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal estimatedValue;

    @Column(
            name = "planned_issue_date",
            nullable = false)
    private LocalDate plannedIssueDate;

    @Column(
            name = "actual_issue_date")
    private LocalDate actualIssueDate;

    @Column(
            name = "bid_due_date",
            nullable = false)
    private LocalDate bidDueDate;

    @Column(
            name = "award_due_date",
            nullable = false)
    private LocalDate awardDueDate;

    @Column(
            name = "forecast_award_date",
            nullable = false)
    private LocalDate forecastAwardDate;

    @Column(
            name = "required_on_site_date",
            nullable = false)
    private LocalDate requiredOnSiteDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private ProcurementPackageStatus status;

    @Column(
            name = "awarded_supplier_id")
    private UUID awardedSupplierId;

    @Column(
            name = "awarded_value",
            precision = 19,
            scale = 2)
    private BigDecimal awardedValue;

    @Column(
            name = "award_date")
    private LocalDate awardDate;

    @Column(
            name = "commitment_id")
    private UUID commitmentId;

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

    protected ProcurementPackage() {
    }

    private ProcurementPackage(
            UUID id,
            UUID projectId,
            UUID costCodeId,
            String reference,
            String title,
            String description,
            BigDecimal estimatedValue,
            LocalDate plannedIssueDate,
            LocalDate actualIssueDate,
            LocalDate bidDueDate,
            LocalDate awardDueDate,
            LocalDate forecastAwardDate,
            LocalDate requiredOnSiteDate,
            ProcurementPackageStatus status) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(
                        projectId);

        this.costCodeId =
                Objects.requireNonNull(
                        costCodeId);

        this.reference =
                Objects.requireNonNull(
                        reference);

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.estimatedValue =
                Objects.requireNonNull(
                        estimatedValue);

        this.plannedIssueDate =
                Objects.requireNonNull(
                        plannedIssueDate);

        this.actualIssueDate =
                actualIssueDate;

        this.bidDueDate =
                Objects.requireNonNull(
                        bidDueDate);

        this.awardDueDate =
                Objects.requireNonNull(
                        awardDueDate);

        this.forecastAwardDate =
                Objects.requireNonNull(
                        forecastAwardDate);

        this.requiredOnSiteDate =
                Objects.requireNonNull(
                        requiredOnSiteDate);

        this.status =
                Objects.requireNonNull(
                        status);
    }

    public static ProcurementPackage create(
            UUID id,
            UUID projectId,
            UUID costCodeId,
            String reference,
            String title,
            String description,
            BigDecimal estimatedValue,
            LocalDate plannedIssueDate,
            LocalDate bidDueDate,
            LocalDate awardDueDate,
            LocalDate forecastAwardDate,
            LocalDate requiredOnSiteDate) {

        return new ProcurementPackage(
                id,
                projectId,
                costCodeId,
                reference,
                title,
                description,
                estimatedValue,
                plannedIssueDate,
                null,
                bidDueDate,
                awardDueDate,
                forecastAwardDate,
                requiredOnSiteDate,
                ProcurementPackageStatus.PLANNING);
    }

    public void updateDetails(
            String title,
            String description,
            BigDecimal estimatedValue,
            LocalDate plannedIssueDate,
            LocalDate bidDueDate,
            LocalDate awardDueDate,
            LocalDate forecastAwardDate,
            LocalDate requiredOnSiteDate) {

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.estimatedValue =
                Objects.requireNonNull(
                        estimatedValue);

        this.plannedIssueDate =
                Objects.requireNonNull(
                        plannedIssueDate);

        this.bidDueDate =
                Objects.requireNonNull(
                        bidDueDate);

        this.awardDueDate =
                Objects.requireNonNull(
                        awardDueDate);

        this.forecastAwardDate =
                Objects.requireNonNull(
                        forecastAwardDate);

        this.requiredOnSiteDate =
                Objects.requireNonNull(
                        requiredOnSiteDate);
    }

    public void changeStatus(
            ProcurementPackageStatus target,
            LocalDate effectiveDate) {

        this.status =
                Objects.requireNonNull(
                        target);

        if (target
                        == ProcurementPackageStatus.TENDERING
                && actualIssueDate == null) {

            actualIssueDate =
                    Objects.requireNonNull(
                            effectiveDate);
        }
    }

    public void award(
            UUID supplierId,
            BigDecimal awardedValue,
            LocalDate awardDate,
            UUID commitmentId) {

        this.awardedSupplierId =
                Objects.requireNonNull(
                        supplierId);

        this.awardedValue =
                Objects.requireNonNull(
                        awardedValue);

        this.awardDate =
                Objects.requireNonNull(
                        awardDate);

        this.commitmentId =
                Objects.requireNonNull(
                        commitmentId);

        this.forecastAwardDate =
                awardDate;

        this.status =
                ProcurementPackageStatus.AWARDED;
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

    public UUID getCostCodeId() {
        return costCodeId;
    }

    public String getReference() {
        return reference;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getEstimatedValue() {
        return estimatedValue;
    }

    public LocalDate getPlannedIssueDate() {
        return plannedIssueDate;
    }

    public LocalDate getActualIssueDate() {
        return actualIssueDate;
    }

    public LocalDate getBidDueDate() {
        return bidDueDate;
    }

    public LocalDate getAwardDueDate() {
        return awardDueDate;
    }

    public LocalDate getForecastAwardDate() {
        return forecastAwardDate;
    }

    public LocalDate getRequiredOnSiteDate() {
        return requiredOnSiteDate;
    }

    public ProcurementPackageStatus getStatus() {
        return status;
    }

    public UUID getAwardedSupplierId() {
        return awardedSupplierId;
    }

    public BigDecimal getAwardedValue() {
        return awardedValue;
    }

    public LocalDate getAwardDate() {
        return awardDate;
    }

    public UUID getCommitmentId() {
        return commitmentId;
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
