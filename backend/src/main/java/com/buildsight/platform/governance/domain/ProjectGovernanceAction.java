package com.buildsight.platform.governance.domain;

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
@Table(name = "project_governance_actions")
public class ProjectGovernanceAction {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(name = "meeting_id")
    private UUID meetingId;

    @Column(name = "decision_id")
    private UUID decisionId;

    @Column(
            name = "action_number",
            nullable = false,
            length = 64,
            updatable = false)
    private String actionNumber;

    @Column(
            name = "title",
            nullable = false,
            length = 220)
    private String title;

    @Column(
            name = "description",
            columnDefinition = "TEXT")
    private String description;

    @Column(
            name = "owner_name",
            length = 160)
    private String ownerName;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "priority",
            nullable = false,
            length = 32)
    private GovernanceActionPriority priority;

    @Column(
            name = "due_date",
            nullable = false)
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private GovernanceActionStatus status;

    @Column(
            name = "blocker_reason",
            columnDefinition = "TEXT")
    private String blockerReason;

    @Column(name = "completed_at")
    private Instant completedAt;

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

    protected ProjectGovernanceAction() {
    }

    private ProjectGovernanceAction(
            UUID id,
            UUID projectId,
            UUID meetingId,
            UUID decisionId,
            String actionNumber,
            String title,
            String description,
            String ownerName,
            GovernanceActionPriority priority,
            LocalDate dueDate) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.meetingId =
                meetingId;

        this.decisionId =
                decisionId;

        this.actionNumber =
                Objects.requireNonNull(
                        actionNumber);

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.ownerName =
                ownerName;

        this.priority =
                Objects.requireNonNull(
                        priority);

        this.dueDate =
                Objects.requireNonNull(
                        dueDate);

        this.status =
                GovernanceActionStatus.OPEN;
    }

    public static ProjectGovernanceAction create(
            UUID id,
            UUID projectId,
            UUID meetingId,
            UUID decisionId,
            String actionNumber,
            String title,
            String description,
            String ownerName,
            GovernanceActionPriority priority,
            LocalDate dueDate) {

        return new ProjectGovernanceAction(
                id,
                projectId,
                meetingId,
                decisionId,
                actionNumber,
                title,
                description,
                ownerName,
                priority,
                dueDate);
    }

    public void update(
            UUID meetingId,
            UUID decisionId,
            String title,
            String description,
            String ownerName,
            GovernanceActionPriority priority,
            LocalDate dueDate,
            GovernanceActionStatus status,
            String blockerReason,
            Instant now) {

        this.meetingId =
                meetingId;

        this.decisionId =
                decisionId;

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.ownerName =
                ownerName;

        this.priority =
                Objects.requireNonNull(
                        priority);

        this.dueDate =
                Objects.requireNonNull(
                        dueDate);

        this.status =
                Objects.requireNonNull(
                        status);

        if (status == GovernanceActionStatus.BLOCKED) {

            this.blockerReason =
                    blockerReason;

        } else {

            this.blockerReason =
                    null;
        }

        if (status == GovernanceActionStatus.DONE) {

            if (completedAt == null) {

                completedAt =
                        now;
            }

        } else {

            completedAt =
                    null;
        }
    }

    @PrePersist
    void onCreate() {

        Instant now =
                Instant.now();

        if (createdAt == null) {

            createdAt =
                    now;
        }

        updatedAt =
                now;
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

    public UUID getMeetingId() {
        return meetingId;
    }

    public UUID getDecisionId() {
        return decisionId;
    }

    public String getActionNumber() {
        return actionNumber;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public GovernanceActionPriority getPriority() {
        return priority;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public GovernanceActionStatus getStatus() {
        return status;
    }

    public String getBlockerReason() {
        return blockerReason;
    }

    public Instant getCompletedAt() {
        return completedAt;
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
