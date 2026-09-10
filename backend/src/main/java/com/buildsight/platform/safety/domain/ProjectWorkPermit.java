package com.buildsight.platform.safety.domain;

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
@Table(name = "project_work_permits")
public class ProjectWorkPermit {

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
            name = "permit_type",
            nullable = false,
            length = 40)
    private WorkPermitType permitType;

    @Column(
            name = "title",
            nullable = false,
            length = 220)
    private String title;

    @Column(
            name = "location",
            length = 220)
    private String location;

    @Column(
            name = "issuer_name",
            length = 160)
    private String issuerName;

    @Column(
            name = "receiver_name",
            length = 160)
    private String receiverName;

    @Column(
            name = "valid_from",
            nullable = false)
    private LocalDate validFrom;

    @Column(
            name = "valid_until",
            nullable = false)
    private LocalDate validUntil;

    @Column(
            name = "controls",
            columnDefinition = "TEXT")
    private String controls;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private WorkPermitStatus status;

    @Column(name = "closed_date")
    private LocalDate closedDate;

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

    protected ProjectWorkPermit() {
    }

    private ProjectWorkPermit(
            UUID id,
            UUID projectId,
            String reference,
            WorkPermitType permitType,
            String title,
            String location,
            String issuerName,
            String receiverName,
            LocalDate validFrom,
            LocalDate validUntil,
            String controls) {

        this.id = Objects.requireNonNull(id);
        this.projectId = Objects.requireNonNull(projectId);
        this.reference = Objects.requireNonNull(reference);
        this.permitType = Objects.requireNonNull(permitType);
        this.title = Objects.requireNonNull(title);
        this.location = location;
        this.issuerName = issuerName;
        this.receiverName = receiverName;
        this.validFrom = Objects.requireNonNull(validFrom);
        this.validUntil = Objects.requireNonNull(validUntil);
        this.controls = controls;
        this.status = WorkPermitStatus.DRAFT;
    }

    public static ProjectWorkPermit create(
            UUID id,
            UUID projectId,
            String reference,
            WorkPermitType permitType,
            String title,
            String location,
            String issuerName,
            String receiverName,
            LocalDate validFrom,
            LocalDate validUntil,
            String controls) {

        return new ProjectWorkPermit(
                id,
                projectId,
                reference,
                permitType,
                title,
                location,
                issuerName,
                receiverName,
                validFrom,
                validUntil,
                controls);
    }

    public void update(
            WorkPermitType permitType,
            String title,
            String location,
            String issuerName,
            String receiverName,
            LocalDate validFrom,
            LocalDate validUntil,
            String controls,
            WorkPermitStatus status,
            LocalDate currentDate) {

        this.permitType =
                Objects.requireNonNull(permitType);

        this.title =
                Objects.requireNonNull(title);

        this.location =
                location;

        this.issuerName =
                issuerName;

        this.receiverName =
                receiverName;

        this.validFrom =
                Objects.requireNonNull(validFrom);

        this.validUntil =
                Objects.requireNonNull(validUntil);

        this.controls =
                controls;

        this.status =
                Objects.requireNonNull(status);

        if (status == WorkPermitStatus.CLOSED
                || status == WorkPermitStatus.CANCELLED) {

            this.closedDate =
                    Objects.requireNonNull(currentDate);

        } else {
            this.closedDate =
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

    public WorkPermitType getPermitType() {
        return permitType;
    }

    public String getTitle() {
        return title;
    }

    public String getLocation() {
        return location;
    }

    public String getIssuerName() {
        return issuerName;
    }

    public String getReceiverName() {
        return receiverName;
    }

    public LocalDate getValidFrom() {
        return validFrom;
    }

    public LocalDate getValidUntil() {
        return validUntil;
    }

    public String getControls() {
        return controls;
    }

    public WorkPermitStatus getStatus() {
        return status;
    }

    public LocalDate getClosedDate() {
        return closedDate;
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
