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
@Table(name = "project_commercial_change_orders")
public class CommercialChangeOrder {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(
            name = "reference",
            nullable = false,
            length = 64,
            updatable = false)
    private String reference;

    @Column(
            name = "source_change_reference",
            length = 64)
    private String sourceChangeReference;

    @Column(
            name = "title",
            nullable = false,
            length = 220)
    private String title;

    @Column(
            name = "description",
            nullable = false,
            columnDefinition = "TEXT")
    private String description;

    @Column(
            name = "submitted_amount",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal submittedAmount;

    @Column(
            name = "assessed_amount",
            precision = 19,
            scale = 2)
    private BigDecimal assessedAmount;

    @Column(
            name = "approved_amount",
            precision = 19,
            scale = 2)
    private BigDecimal approvedAmount;

    @Column(name = "submitted_date")
    private LocalDate submittedDate;

    @Column(name = "decision_due_date")
    private LocalDate decisionDueDate;

    @Column(name = "decision_date")
    private LocalDate decisionDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 40)
    private CommercialChangeOrderStatus status;

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

    protected CommercialChangeOrder() {
    }

    private CommercialChangeOrder(
            UUID id,
            UUID projectId,
            String reference,
            String sourceChangeReference,
            String title,
            String description,
            BigDecimal submittedAmount) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.reference =
                Objects.requireNonNull(reference);

        this.sourceChangeReference =
                sourceChangeReference;

        this.title =
                Objects.requireNonNull(title);

        this.description =
                Objects.requireNonNull(description);

        this.submittedAmount =
                Objects.requireNonNull(submittedAmount);

        this.status =
                CommercialChangeOrderStatus.DRAFT;
    }

    public static CommercialChangeOrder create(
            UUID id,
            UUID projectId,
            String reference,
            String sourceChangeReference,
            String title,
            String description,
            BigDecimal submittedAmount) {

        return new CommercialChangeOrder(
                id,
                projectId,
                reference,
                sourceChangeReference,
                title,
                description,
                submittedAmount);
    }

    public void update(
            String sourceChangeReference,
            String title,
            String description,
            BigDecimal submittedAmount,
            BigDecimal assessedAmount,
            BigDecimal approvedAmount,
            LocalDate submittedDate,
            LocalDate decisionDueDate,
            CommercialChangeOrderStatus status,
            LocalDate currentDate) {

        this.sourceChangeReference =
                sourceChangeReference;

        this.title =
                Objects.requireNonNull(title);

        this.description =
                Objects.requireNonNull(description);

        this.submittedAmount =
                Objects.requireNonNull(submittedAmount);

        this.assessedAmount =
                assessedAmount;

        this.approvedAmount =
                approvedAmount;

        this.submittedDate =
                submittedDate;

        this.decisionDueDate =
                decisionDueDate;

        this.status =
                Objects.requireNonNull(status);

        if (status
                        == CommercialChangeOrderStatus.APPROVED
                || status
                        == CommercialChangeOrderStatus.REJECTED) {

            this.decisionDate =
                    currentDate;

        } else {
            this.decisionDate =
                    null;
        }
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

    public String getReference() {
        return reference;
    }

    public String getSourceChangeReference() {
        return sourceChangeReference;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public BigDecimal getSubmittedAmount() {
        return submittedAmount;
    }

    public BigDecimal getAssessedAmount() {
        return assessedAmount;
    }

    public BigDecimal getApprovedAmount() {
        return approvedAmount;
    }

    public LocalDate getSubmittedDate() {
        return submittedDate;
    }

    public LocalDate getDecisionDueDate() {
        return decisionDueDate;
    }

    public LocalDate getDecisionDate() {
        return decisionDate;
    }

    public CommercialChangeOrderStatus getStatus() {
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
