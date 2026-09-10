package com.buildsight.platform.quality.domain;

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
@Table(name = "project_ncrs")
public class ProjectNcr {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "inspection_id")
    private UUID inspectionId;

    @Column(name = "reference", nullable = false, length = 64, updatable = false)
    private String reference;

    @Column(name = "title", nullable = false, length = 220)
    private String title;

    @Column(name = "description", nullable = false, columnDefinition = "TEXT")
    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 40)
    private NcrCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity", nullable = false, length = 32)
    private NcrSeverity severity;

    @Column(name = "raised_date", nullable = false)
    private LocalDate raisedDate;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(name = "owner_name", length = 160)
    private String ownerName;

    @Column(name = "root_cause", columnDefinition = "TEXT")
    private String rootCause;

    @Column(name = "corrective_action", columnDefinition = "TEXT")
    private String correctiveAction;

    @Column(name = "verification_notes", columnDefinition = "TEXT")
    private String verificationNotes;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private NcrStatus status;

    @Column(name = "closed_date")
    private LocalDate closedDate;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProjectNcr() {
    }

    private ProjectNcr(
            UUID id,
            UUID projectId,
            UUID inspectionId,
            String reference,
            String title,
            String description,
            NcrCategory category,
            NcrSeverity severity,
            LocalDate raisedDate,
            LocalDate dueDate,
            String ownerName) {

        this.id = Objects.requireNonNull(id);
        this.projectId = Objects.requireNonNull(projectId);
        this.inspectionId = inspectionId;
        this.reference = Objects.requireNonNull(reference);
        this.title = Objects.requireNonNull(title);
        this.description = Objects.requireNonNull(description);
        this.category = Objects.requireNonNull(category);
        this.severity = Objects.requireNonNull(severity);
        this.raisedDate = Objects.requireNonNull(raisedDate);
        this.dueDate = Objects.requireNonNull(dueDate);
        this.ownerName = ownerName;
        this.status = NcrStatus.OPEN;
    }

    public static ProjectNcr create(
            UUID id,
            UUID projectId,
            UUID inspectionId,
            String reference,
            String title,
            String description,
            NcrCategory category,
            NcrSeverity severity,
            LocalDate raisedDate,
            LocalDate dueDate,
            String ownerName) {

        return new ProjectNcr(
                id,
                projectId,
                inspectionId,
                reference,
                title,
                description,
                category,
                severity,
                raisedDate,
                dueDate,
                ownerName);
    }

    public void update(
            UUID inspectionId,
            String title,
            String description,
            NcrCategory category,
            NcrSeverity severity,
            LocalDate dueDate,
            String ownerName,
            String rootCause,
            String correctiveAction,
            String verificationNotes,
            NcrStatus status,
            LocalDate currentDate) {

        this.inspectionId = inspectionId;
        this.title = Objects.requireNonNull(title);
        this.description = Objects.requireNonNull(description);
        this.category = Objects.requireNonNull(category);
        this.severity = Objects.requireNonNull(severity);
        this.dueDate = Objects.requireNonNull(dueDate);
        this.ownerName = ownerName;
        this.rootCause = rootCause;
        this.correctiveAction = correctiveAction;
        this.verificationNotes = verificationNotes;
        this.status = Objects.requireNonNull(status);

        if (status == NcrStatus.CLOSED) {
            this.closedDate = Objects.requireNonNull(currentDate);
        } else if (status != NcrStatus.VOID) {
            this.closedDate = null;
        }
    }

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();

        if (createdAt == null) {
            createdAt = now;
        }

        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public UUID getInspectionId() {
        return inspectionId;
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

    public NcrCategory getCategory() {
        return category;
    }

    public NcrSeverity getSeverity() {
        return severity;
    }

    public LocalDate getRaisedDate() {
        return raisedDate;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public String getRootCause() {
        return rootCause;
    }

    public String getCorrectiveAction() {
        return correctiveAction;
    }

    public String getVerificationNotes() {
        return verificationNotes;
    }

    public NcrStatus getStatus() {
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
