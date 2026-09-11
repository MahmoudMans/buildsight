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
@Table(name = "project_governance_decisions")
public class ProjectGovernanceDecision {

    @Id
    private UUID id;

    @Column(
            name = "project_id",
            nullable = false,
            updatable = false)
    private UUID projectId;

    @Column(name = "meeting_id")
    private UUID meetingId;

    @Column(
            name = "decision_number",
            nullable = false,
            length = 64,
            updatable = false)
    private String decisionNumber;

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
            name = "decision_date",
            nullable = false)
    private LocalDate decisionDate;

    @Column(
            name = "owner_name",
            length = 160)
    private String ownerName;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "impact_area",
            nullable = false,
            length = 40)
    private GovernanceDecisionImpactArea impactArea;

    @Column(
            name = "rationale",
            columnDefinition = "TEXT")
    private String rationale;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private GovernanceDecisionStatus status;

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

    protected ProjectGovernanceDecision() {
    }

    private ProjectGovernanceDecision(
            UUID id,
            UUID projectId,
            UUID meetingId,
            String decisionNumber,
            String title,
            String description,
            LocalDate decisionDate,
            String ownerName,
            LocalDate dueDate,
            GovernanceDecisionImpactArea impactArea,
            String rationale) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.meetingId =
                meetingId;

        this.decisionNumber =
                Objects.requireNonNull(
                        decisionNumber);

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.decisionDate =
                Objects.requireNonNull(
                        decisionDate);

        this.ownerName =
                ownerName;

        this.dueDate =
                dueDate;

        this.impactArea =
                Objects.requireNonNull(
                        impactArea);

        this.rationale =
                rationale;

        this.status =
                GovernanceDecisionStatus.PROPOSED;
    }

    public static ProjectGovernanceDecision create(
            UUID id,
            UUID projectId,
            UUID meetingId,
            String decisionNumber,
            String title,
            String description,
            LocalDate decisionDate,
            String ownerName,
            LocalDate dueDate,
            GovernanceDecisionImpactArea impactArea,
            String rationale) {

        return new ProjectGovernanceDecision(
                id,
                projectId,
                meetingId,
                decisionNumber,
                title,
                description,
                decisionDate,
                ownerName,
                dueDate,
                impactArea,
                rationale);
    }

    public void update(
            UUID meetingId,
            String title,
            String description,
            LocalDate decisionDate,
            String ownerName,
            LocalDate dueDate,
            GovernanceDecisionImpactArea impactArea,
            String rationale,
            GovernanceDecisionStatus status) {

        this.meetingId =
                meetingId;

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.decisionDate =
                Objects.requireNonNull(
                        decisionDate);

        this.ownerName =
                ownerName;

        this.dueDate =
                dueDate;

        this.impactArea =
                Objects.requireNonNull(
                        impactArea);

        this.rationale =
                rationale;

        this.status =
                Objects.requireNonNull(
                        status);
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

    public String getDecisionNumber() {
        return decisionNumber;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public LocalDate getDecisionDate() {
        return decisionDate;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public GovernanceDecisionImpactArea getImpactArea() {
        return impactArea;
    }

    public String getRationale() {
        return rationale;
    }

    public GovernanceDecisionStatus getStatus() {
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
