package com.buildsight.platform.risk.domain;

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
@Table(name = "project_issues")
public class ProjectIssue {

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
            name = "source_risk_id")
    private UUID sourceRiskId;

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

    @Enumerated(EnumType.STRING)
    @Column(
            name = "severity",
            nullable = false,
            length = 32)
    private IssueSeverity severity;

    @Column(
            name = "owner_name",
            length = 160)
    private String ownerName;

    @Column(
            name = "target_resolution_date",
            nullable = false)
    private LocalDate targetResolutionDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private IssueStatus status;

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

    protected ProjectIssue() {
    }

    private ProjectIssue(
            UUID id,
            UUID projectId,
            UUID sourceRiskId,
            String reference,
            String title,
            String description,
            IssueSeverity severity,
            String ownerName,
            LocalDate targetResolutionDate,
            IssueStatus status) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(
                        projectId);

        this.sourceRiskId =
                sourceRiskId;

        this.reference =
                Objects.requireNonNull(
                        reference);

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.severity =
                Objects.requireNonNull(
                        severity);

        this.ownerName =
                ownerName;

        this.targetResolutionDate =
                Objects.requireNonNull(
                        targetResolutionDate);

        this.status =
                Objects.requireNonNull(
                        status);
    }

    public static ProjectIssue create(
            UUID id,
            UUID projectId,
            UUID sourceRiskId,
            String reference,
            String title,
            String description,
            IssueSeverity severity,
            String ownerName,
            LocalDate targetResolutionDate) {

        return new ProjectIssue(
                id,
                projectId,
                sourceRiskId,
                reference,
                title,
                description,
                severity,
                ownerName,
                targetResolutionDate,
                IssueStatus.OPEN);
    }

    public void update(
            UUID sourceRiskId,
            String title,
            String description,
            IssueSeverity severity,
            String ownerName,
            LocalDate targetResolutionDate,
            IssueStatus status) {

        this.sourceRiskId =
                sourceRiskId;

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.severity =
                Objects.requireNonNull(
                        severity);

        this.ownerName =
                ownerName;

        this.targetResolutionDate =
                Objects.requireNonNull(
                        targetResolutionDate);

        this.status =
                Objects.requireNonNull(
                        status);
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

    public UUID getSourceRiskId() {
        return sourceRiskId;
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

    public IssueSeverity getSeverity() {
        return severity;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public LocalDate getTargetResolutionDate() {
        return targetResolutionDate;
    }

    public IssueStatus getStatus() {
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
