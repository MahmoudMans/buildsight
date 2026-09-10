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
@Table(name = "project_commercial_claims")
public class CommercialClaim {

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

    @Enumerated(EnumType.STRING)
    @Column(
            name = "claim_type",
            nullable = false,
            length = 40)
    private CommercialClaimType claimType;

    @Column(
            name = "title",
            nullable = false,
            length = 220)
    private String title;

    @Column(
            name = "basis",
            nullable = false,
            columnDefinition = "TEXT")
    private String basis;

    @Column(
            name = "claimed_amount",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal claimedAmount;

    @Column(
            name = "assessed_amount",
            precision = 19,
            scale = 2)
    private BigDecimal assessedAmount;

    @Column(
            name = "awarded_amount",
            precision = 19,
            scale = 2)
    private BigDecimal awardedAmount;

    @Column(
            name = "claimed_days",
            nullable = false)
    private int claimedDays;

    @Column(
            name = "awarded_days",
            nullable = false)
    private int awardedDays;

    @Column(name = "submitted_date")
    private LocalDate submittedDate;

    @Column(name = "response_due_date")
    private LocalDate responseDueDate;

    @Column(name = "decision_date")
    private LocalDate decisionDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 40)
    private CommercialClaimStatus status;

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

    protected CommercialClaim() {
    }

    private CommercialClaim(
            UUID id,
            UUID projectId,
            String reference,
            CommercialClaimType claimType,
            String title,
            String basis,
            BigDecimal claimedAmount,
            int claimedDays) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.reference =
                Objects.requireNonNull(reference);

        this.claimType =
                Objects.requireNonNull(claimType);

        this.title =
                Objects.requireNonNull(title);

        this.basis =
                Objects.requireNonNull(basis);

        this.claimedAmount =
                Objects.requireNonNull(claimedAmount);

        this.claimedDays =
                claimedDays;

        this.awardedDays =
                0;

        this.status =
                CommercialClaimStatus.DRAFT;
    }

    public static CommercialClaim create(
            UUID id,
            UUID projectId,
            String reference,
            CommercialClaimType claimType,
            String title,
            String basis,
            BigDecimal claimedAmount,
            int claimedDays) {

        return new CommercialClaim(
                id,
                projectId,
                reference,
                claimType,
                title,
                basis,
                claimedAmount,
                claimedDays);
    }

    public void update(
            CommercialClaimType claimType,
            String title,
            String basis,
            BigDecimal claimedAmount,
            BigDecimal assessedAmount,
            BigDecimal awardedAmount,
            int claimedDays,
            int awardedDays,
            LocalDate submittedDate,
            LocalDate responseDueDate,
            CommercialClaimStatus status,
            LocalDate currentDate) {

        this.claimType =
                Objects.requireNonNull(claimType);

        this.title =
                Objects.requireNonNull(title);

        this.basis =
                Objects.requireNonNull(basis);

        this.claimedAmount =
                Objects.requireNonNull(claimedAmount);

        this.assessedAmount =
                assessedAmount;

        this.awardedAmount =
                awardedAmount;

        this.claimedDays =
                claimedDays;

        this.awardedDays =
                awardedDays;

        this.submittedDate =
                submittedDate;

        this.responseDueDate =
                responseDueDate;

        this.status =
                Objects.requireNonNull(status);

        if (status
                        == CommercialClaimStatus.PARTIALLY_APPROVED
                || status
                        == CommercialClaimStatus.APPROVED
                || status
                        == CommercialClaimStatus.REJECTED) {

            this.decisionDate =
                    currentDate;
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

    public CommercialClaimType getClaimType() {
        return claimType;
    }

    public String getTitle() {
        return title;
    }

    public String getBasis() {
        return basis;
    }

    public BigDecimal getClaimedAmount() {
        return claimedAmount;
    }

    public BigDecimal getAssessedAmount() {
        return assessedAmount;
    }

    public BigDecimal getAwardedAmount() {
        return awardedAmount;
    }

    public int getClaimedDays() {
        return claimedDays;
    }

    public int getAwardedDays() {
        return awardedDays;
    }

    public LocalDate getSubmittedDate() {
        return submittedDate;
    }

    public LocalDate getResponseDueDate() {
        return responseDueDate;
    }

    public LocalDate getDecisionDate() {
        return decisionDate;
    }

    public CommercialClaimStatus getStatus() {
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
