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
@Table(name = "project_payment_certificates")
public class PaymentCertificate {

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
            name = "period_start",
            nullable = false)
    private LocalDate periodStart;

    @Column(
            name = "period_end",
            nullable = false)
    private LocalDate periodEnd;

    @Column(
            name = "application_date",
            nullable = false)
    private LocalDate applicationDate;

    @Column(
            name = "certification_due_date",
            nullable = false)
    private LocalDate certificationDueDate;

    @Column(
            name = "application_amount",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal applicationAmount;

    @Column(
            name = "certified_amount",
            precision = 19,
            scale = 2)
    private BigDecimal certifiedAmount;

    @Column(
            name = "retention_amount",
            precision = 19,
            scale = 2)
    private BigDecimal retentionAmount;

    @Column(name = "certified_date")
    private LocalDate certifiedDate;

    @Column(name = "payment_due_date")
    private LocalDate paymentDueDate;

    @Column(
            name = "amount_paid",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal amountPaid;

    @Column(name = "last_payment_date")
    private LocalDate lastPaymentDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 40)
    private PaymentCertificateStatus status;

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

    protected PaymentCertificate() {
    }

    private PaymentCertificate(
            UUID id,
            UUID projectId,
            String reference,
            LocalDate periodStart,
            LocalDate periodEnd,
            LocalDate applicationDate,
            LocalDate certificationDueDate,
            BigDecimal applicationAmount) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.reference =
                Objects.requireNonNull(reference);

        this.periodStart =
                Objects.requireNonNull(periodStart);

        this.periodEnd =
                Objects.requireNonNull(periodEnd);

        this.applicationDate =
                Objects.requireNonNull(applicationDate);

        this.certificationDueDate =
                Objects.requireNonNull(certificationDueDate);

        this.applicationAmount =
                Objects.requireNonNull(applicationAmount);

        this.amountPaid =
                BigDecimal.ZERO;

        this.status =
                PaymentCertificateStatus.DRAFT;
    }

    public static PaymentCertificate create(
            UUID id,
            UUID projectId,
            String reference,
            LocalDate periodStart,
            LocalDate periodEnd,
            LocalDate applicationDate,
            LocalDate certificationDueDate,
            BigDecimal applicationAmount) {

        return new PaymentCertificate(
                id,
                projectId,
                reference,
                periodStart,
                periodEnd,
                applicationDate,
                certificationDueDate,
                applicationAmount);
    }

    public void update(
            LocalDate periodStart,
            LocalDate periodEnd,
            LocalDate applicationDate,
            LocalDate certificationDueDate,
            BigDecimal applicationAmount,
            BigDecimal certifiedAmount,
            BigDecimal retentionAmount,
            LocalDate certifiedDate,
            LocalDate paymentDueDate,
            BigDecimal amountPaid,
            LocalDate lastPaymentDate,
            PaymentCertificateStatus status) {

        this.periodStart =
                Objects.requireNonNull(periodStart);

        this.periodEnd =
                Objects.requireNonNull(periodEnd);

        this.applicationDate =
                Objects.requireNonNull(applicationDate);

        this.certificationDueDate =
                Objects.requireNonNull(certificationDueDate);

        this.applicationAmount =
                Objects.requireNonNull(applicationAmount);

        this.certifiedAmount =
                certifiedAmount;

        this.retentionAmount =
                retentionAmount;

        this.certifiedDate =
                certifiedDate;

        this.paymentDueDate =
                paymentDueDate;

        this.amountPaid =
                Objects.requireNonNull(amountPaid);

        this.lastPaymentDate =
                lastPaymentDate;

        this.status =
                Objects.requireNonNull(status);
    }

    public BigDecimal netCertifiedAmount() {

        if (certifiedAmount == null) {
            return BigDecimal.ZERO;
        }

        BigDecimal retention =
                retentionAmount == null
                        ? BigDecimal.ZERO
                        : retentionAmount;

        return certifiedAmount
                .subtract(retention)
                .max(BigDecimal.ZERO);
    }

    public BigDecimal outstandingAmount() {

        return netCertifiedAmount()
                .subtract(amountPaid)
                .max(BigDecimal.ZERO);
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

    public LocalDate getPeriodStart() {
        return periodStart;
    }

    public LocalDate getPeriodEnd() {
        return periodEnd;
    }

    public LocalDate getApplicationDate() {
        return applicationDate;
    }

    public LocalDate getCertificationDueDate() {
        return certificationDueDate;
    }

    public BigDecimal getApplicationAmount() {
        return applicationAmount;
    }

    public BigDecimal getCertifiedAmount() {
        return certifiedAmount;
    }

    public BigDecimal getRetentionAmount() {
        return retentionAmount;
    }

    public LocalDate getCertifiedDate() {
        return certifiedDate;
    }

    public LocalDate getPaymentDueDate() {
        return paymentDueDate;
    }

    public BigDecimal getAmountPaid() {
        return amountPaid;
    }

    public LocalDate getLastPaymentDate() {
        return lastPaymentDate;
    }

    public PaymentCertificateStatus getStatus() {
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
