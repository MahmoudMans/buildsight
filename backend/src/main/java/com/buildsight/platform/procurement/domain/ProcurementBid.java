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
@Table(name = "procurement_bids")
public class ProcurementBid {

    @Id
    @Column(
            name = "id",
            nullable = false,
            updatable = false)
    private UUID id;

    @Column(
            name = "procurement_package_id",
            nullable = false,
            updatable = false)
    private UUID procurementPackageId;

    @Column(
            name = "supplier_id",
            nullable = false,
            updatable = false)
    private UUID supplierId;

    @Column(
            name = "bid_amount",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal bidAmount;

    @Column(
            name = "submitted_date",
            nullable = false)
    private LocalDate submittedDate;

    @Column(
            name = "technical_score",
            nullable = false,
            precision = 5,
            scale = 2)
    private BigDecimal technicalScore;

    @Column(
            name = "commercial_score",
            nullable = false,
            precision = 5,
            scale = 2)
    private BigDecimal commercialScore;

    @Column(
            name = "delivery_days",
            nullable = false)
    private int deliveryDays;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private ProcurementBidStatus status;

    @Column(
            name = "notes",
            length = 1200)
    private String notes;

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

    protected ProcurementBid() {
    }

    private ProcurementBid(
            UUID id,
            UUID procurementPackageId,
            UUID supplierId,
            BigDecimal bidAmount,
            LocalDate submittedDate,
            BigDecimal technicalScore,
            BigDecimal commercialScore,
            int deliveryDays,
            ProcurementBidStatus status,
            String notes) {

        this.id =
                Objects.requireNonNull(id);

        this.procurementPackageId =
                Objects.requireNonNull(
                        procurementPackageId);

        this.supplierId =
                Objects.requireNonNull(
                        supplierId);

        this.bidAmount =
                Objects.requireNonNull(
                        bidAmount);

        this.submittedDate =
                Objects.requireNonNull(
                        submittedDate);

        this.technicalScore =
                Objects.requireNonNull(
                        technicalScore);

        this.commercialScore =
                Objects.requireNonNull(
                        commercialScore);

        this.deliveryDays =
                deliveryDays;

        this.status =
                Objects.requireNonNull(
                        status);

        this.notes =
                notes;
    }

    public static ProcurementBid create(
            UUID id,
            UUID procurementPackageId,
            UUID supplierId,
            BigDecimal bidAmount,
            LocalDate submittedDate,
            BigDecimal technicalScore,
            BigDecimal commercialScore,
            int deliveryDays,
            String notes) {

        return new ProcurementBid(
                id,
                procurementPackageId,
                supplierId,
                bidAmount,
                submittedDate,
                technicalScore,
                commercialScore,
                deliveryDays,
                ProcurementBidStatus.RECEIVED,
                notes);
    }

    public void update(
            BigDecimal bidAmount,
            LocalDate submittedDate,
            BigDecimal technicalScore,
            BigDecimal commercialScore,
            int deliveryDays,
            ProcurementBidStatus status,
            String notes) {

        this.bidAmount =
                Objects.requireNonNull(
                        bidAmount);

        this.submittedDate =
                Objects.requireNonNull(
                        submittedDate);

        this.technicalScore =
                Objects.requireNonNull(
                        technicalScore);

        this.commercialScore =
                Objects.requireNonNull(
                        commercialScore);

        this.deliveryDays =
                deliveryDays;

        this.status =
                Objects.requireNonNull(
                        status);

        this.notes =
                notes;
    }

    public void select() {
        this.status =
                ProcurementBidStatus.SELECTED;
    }

    public void reject() {
        this.status =
                ProcurementBidStatus.REJECTED;
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

    public UUID getProcurementPackageId() {
        return procurementPackageId;
    }

    public UUID getSupplierId() {
        return supplierId;
    }

    public BigDecimal getBidAmount() {
        return bidAmount;
    }

    public LocalDate getSubmittedDate() {
        return submittedDate;
    }

    public BigDecimal getTechnicalScore() {
        return technicalScore;
    }

    public BigDecimal getCommercialScore() {
        return commercialScore;
    }

    public int getDeliveryDays() {
        return deliveryDays;
    }

    public ProcurementBidStatus getStatus() {
        return status;
    }

    public String getNotes() {
        return notes;
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
