package com.buildsight.platform.document.domain;

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
@Table(name = "project_transmittals")
public class ProjectTransmittal {

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
            name = "reference",
            nullable = false,
            length = 64,
            updatable = false)
    private String reference;

    @Column(
            name = "recipient",
            nullable = false,
            length = 220)
    private String recipient;

    @Column(
            name = "purpose",
            nullable = false,
            length = 220)
    private String purpose;

    @Column(
            name = "transmittal_date",
            nullable = false)
    private LocalDate transmittalDate;

    @Column(
            name = "issued_date")
    private LocalDate issuedDate;

    @Column(
            name = "notes",
            length = 2000)
    private String notes;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private TransmittalStatus status;

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

    protected ProjectTransmittal() {
    }

    private ProjectTransmittal(
            UUID id,
            UUID projectId,
            String reference,
            String recipient,
            String purpose,
            LocalDate transmittalDate,
            String notes) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.reference =
                Objects.requireNonNull(reference);

        this.recipient =
                Objects.requireNonNull(recipient);

        this.purpose =
                Objects.requireNonNull(purpose);

        this.transmittalDate =
                Objects.requireNonNull(transmittalDate);

        this.notes =
                notes;

        this.status =
                TransmittalStatus.DRAFT;
    }

    public static ProjectTransmittal create(
            UUID id,
            UUID projectId,
            String reference,
            String recipient,
            String purpose,
            LocalDate transmittalDate,
            String notes) {

        return new ProjectTransmittal(
                id,
                projectId,
                reference,
                recipient,
                purpose,
                transmittalDate,
                notes);
    }

    public void issue(
            LocalDate issuedDate) {

        this.status =
                TransmittalStatus.ISSUED;

        this.issuedDate =
                Objects.requireNonNull(issuedDate);
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

    public String getRecipient() {
        return recipient;
    }

    public String getPurpose() {
        return purpose;
    }

    public LocalDate getTransmittalDate() {
        return transmittalDate;
    }

    public LocalDate getIssuedDate() {
        return issuedDate;
    }

    public String getNotes() {
        return notes;
    }

    public TransmittalStatus getStatus() {
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
