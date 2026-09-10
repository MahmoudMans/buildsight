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
@Table(name = "project_safety_observations")
public class ProjectSafetyObservation {

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
            name = "observation_type",
            nullable = false,
            length = 40)
    private SafetyObservationType observationType;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "hazard_category",
            nullable = false,
            length = 40)
    private HazardCategory hazardCategory;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "severity",
            nullable = false,
            length = 32)
    private SafetySeverity severity;

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
            name = "location",
            length = 220)
    private String location;

    @Column(
            name = "observed_date",
            nullable = false)
    private LocalDate observedDate;

    @Column(
            name = "observer_name",
            length = 160)
    private String observerName;

    @Column(
            name = "owner_name",
            length = 160)
    private String ownerName;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 40)
    private SafetyObservationStatus status;

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

    protected ProjectSafetyObservation() {
    }

    private ProjectSafetyObservation(
            UUID id,
            UUID projectId,
            String reference,
            SafetyObservationType observationType,
            HazardCategory hazardCategory,
            SafetySeverity severity,
            String title,
            String description,
            String location,
            LocalDate observedDate,
            String observerName,
            String ownerName,
            LocalDate dueDate) {

        this.id = Objects.requireNonNull(id);
        this.projectId = Objects.requireNonNull(projectId);
        this.reference = Objects.requireNonNull(reference);
        this.observationType = Objects.requireNonNull(observationType);
        this.hazardCategory = Objects.requireNonNull(hazardCategory);
        this.severity = Objects.requireNonNull(severity);
        this.title = Objects.requireNonNull(title);
        this.description = Objects.requireNonNull(description);
        this.location = location;
        this.observedDate = Objects.requireNonNull(observedDate);
        this.observerName = observerName;
        this.ownerName = ownerName;
        this.dueDate = dueDate;
        this.status = SafetyObservationStatus.OPEN;
    }

    public static ProjectSafetyObservation create(
            UUID id,
            UUID projectId,
            String reference,
            SafetyObservationType observationType,
            HazardCategory hazardCategory,
            SafetySeverity severity,
            String title,
            String description,
            String location,
            LocalDate observedDate,
            String observerName,
            String ownerName,
            LocalDate dueDate) {

        return new ProjectSafetyObservation(
                id,
                projectId,
                reference,
                observationType,
                hazardCategory,
                severity,
                title,
                description,
                location,
                observedDate,
                observerName,
                ownerName,
                dueDate);
    }

    public void update(
            SafetyObservationType observationType,
            HazardCategory hazardCategory,
            SafetySeverity severity,
            String title,
            String description,
            String location,
            String ownerName,
            LocalDate dueDate,
            SafetyObservationStatus status,
            LocalDate currentDate) {

        this.observationType =
                Objects.requireNonNull(observationType);

        this.hazardCategory =
                Objects.requireNonNull(hazardCategory);

        this.severity =
                Objects.requireNonNull(severity);

        this.title =
                Objects.requireNonNull(title);

        this.description =
                Objects.requireNonNull(description);

        this.location =
                location;

        this.ownerName =
                ownerName;

        this.dueDate =
                dueDate;

        this.status =
                Objects.requireNonNull(status);

        if (status
                == SafetyObservationStatus.CLOSED) {

            this.closedDate =
                    Objects.requireNonNull(currentDate);

        } else if (status
                != SafetyObservationStatus.VOID) {

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

    public SafetyObservationType getObservationType() {
        return observationType;
    }

    public HazardCategory getHazardCategory() {
        return hazardCategory;
    }

    public SafetySeverity getSeverity() {
        return severity;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getLocation() {
        return location;
    }

    public LocalDate getObservedDate() {
        return observedDate;
    }

    public String getObserverName() {
        return observerName;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public SafetyObservationStatus getStatus() {
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
