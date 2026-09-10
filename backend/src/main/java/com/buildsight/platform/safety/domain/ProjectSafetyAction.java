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
@Table(name = "project_safety_actions")
public class ProjectSafetyAction {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(name = "incident_id")
    private UUID incidentId;

    @Column(name = "observation_id")
    private UUID observationId;

    @Column(
            name = "reference",
            nullable = false,
            length = 64,
            updatable = false)
    private String reference;

    @Column(
            name = "title",
            nullable = false,
            length = 220)
    private String title;

    @Column(
            name = "action_description",
            nullable = false,
            columnDefinition = "TEXT")
    private String actionDescription;

    @Column(
            name = "owner_name",
            length = 160)
    private String ownerName;

    @Column(
            name = "due_date",
            nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 40)
    private SafetyActionStatus status;

    @Column(
            name = "verification_notes",
            columnDefinition = "TEXT")
    private String verificationNotes;

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

    protected ProjectSafetyAction() {
    }

    private ProjectSafetyAction(
            UUID id,
            UUID projectId,
            UUID incidentId,
            UUID observationId,
            String reference,
            String title,
            String actionDescription,
            String ownerName,
            LocalDate dueDate) {

        this.id = Objects.requireNonNull(id);
        this.projectId = Objects.requireNonNull(projectId);
        this.incidentId = incidentId;
        this.observationId = observationId;
        this.reference = Objects.requireNonNull(reference);
        this.title = Objects.requireNonNull(title);
        this.actionDescription = Objects.requireNonNull(actionDescription);
        this.ownerName = ownerName;
        this.dueDate = Objects.requireNonNull(dueDate);
        this.status = SafetyActionStatus.OPEN;
    }

    public static ProjectSafetyAction create(
            UUID id,
            UUID projectId,
            UUID incidentId,
            UUID observationId,
            String reference,
            String title,
            String actionDescription,
            String ownerName,
            LocalDate dueDate) {

        return new ProjectSafetyAction(
                id,
                projectId,
                incidentId,
                observationId,
                reference,
                title,
                actionDescription,
                ownerName,
                dueDate);
    }

    public void update(
            String title,
            String actionDescription,
            String ownerName,
            LocalDate dueDate,
            SafetyActionStatus status,
            String verificationNotes,
            LocalDate currentDate) {

        this.title =
                Objects.requireNonNull(title);

        this.actionDescription =
                Objects.requireNonNull(actionDescription);

        this.ownerName =
                ownerName;

        this.dueDate =
                Objects.requireNonNull(dueDate);

        this.status =
                Objects.requireNonNull(status);

        this.verificationNotes =
                verificationNotes;

        if (status == SafetyActionStatus.CLOSED) {

            this.closedDate =
                    Objects.requireNonNull(currentDate);

        } else if (status != SafetyActionStatus.VOID) {

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

    public UUID getIncidentId() {
        return incidentId;
    }

    public UUID getObservationId() {
        return observationId;
    }

    public String getReference() {
        return reference;
    }

    public String getTitle() {
        return title;
    }

    public String getActionDescription() {
        return actionDescription;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public SafetyActionStatus getStatus() {
        return status;
    }

    public String getVerificationNotes() {
        return verificationNotes;
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
