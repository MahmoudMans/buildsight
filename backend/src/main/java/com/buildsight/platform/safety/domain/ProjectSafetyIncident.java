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
@Table(name = "project_safety_incidents")
public class ProjectSafetyIncident {

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
            name = "incident_type",
            nullable = false,
            length = 40)
    private SafetyIncidentType incidentType;

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
            name = "occurred_date",
            nullable = false)
    private LocalDate occurredDate;

    @Column(
            name = "reported_date",
            nullable = false)
    private LocalDate reportedDate;

    @Column(
            name = "people_affected",
            nullable = false)
    private int peopleAffected;

    @Column(
            name = "lost_time_days",
            nullable = false)
    private int lostTimeDays;

    @Column(
            name = "immediate_action",
            columnDefinition = "TEXT")
    private String immediateAction;

    @Column(
            name = "root_cause",
            columnDefinition = "TEXT")
    private String rootCause;

    @Column(
            name = "investigation_notes",
            columnDefinition = "TEXT")
    private String investigationNotes;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 40)
    private SafetyIncidentStatus status;

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

    protected ProjectSafetyIncident() {
    }

    private ProjectSafetyIncident(
            UUID id,
            UUID projectId,
            String reference,
            SafetyIncidentType incidentType,
            SafetySeverity severity,
            String title,
            String description,
            String location,
            LocalDate occurredDate,
            LocalDate reportedDate,
            int peopleAffected,
            int lostTimeDays,
            String immediateAction) {

        this.id = Objects.requireNonNull(id);
        this.projectId = Objects.requireNonNull(projectId);
        this.reference = Objects.requireNonNull(reference);
        this.incidentType = Objects.requireNonNull(incidentType);
        this.severity = Objects.requireNonNull(severity);
        this.title = Objects.requireNonNull(title);
        this.description = Objects.requireNonNull(description);
        this.location = location;
        this.occurredDate = Objects.requireNonNull(occurredDate);
        this.reportedDate = Objects.requireNonNull(reportedDate);
        this.peopleAffected = peopleAffected;
        this.lostTimeDays = lostTimeDays;
        this.immediateAction = immediateAction;
        this.status = SafetyIncidentStatus.REPORTED;
    }

    public static ProjectSafetyIncident create(
            UUID id,
            UUID projectId,
            String reference,
            SafetyIncidentType incidentType,
            SafetySeverity severity,
            String title,
            String description,
            String location,
            LocalDate occurredDate,
            LocalDate reportedDate,
            int peopleAffected,
            int lostTimeDays,
            String immediateAction) {

        return new ProjectSafetyIncident(
                id,
                projectId,
                reference,
                incidentType,
                severity,
                title,
                description,
                location,
                occurredDate,
                reportedDate,
                peopleAffected,
                lostTimeDays,
                immediateAction);
    }

    public void update(
            SafetyIncidentType incidentType,
            SafetySeverity severity,
            String title,
            String description,
            String location,
            int peopleAffected,
            int lostTimeDays,
            String immediateAction,
            String rootCause,
            String investigationNotes,
            SafetyIncidentStatus status,
            LocalDate currentDate) {

        this.incidentType = Objects.requireNonNull(incidentType);
        this.severity = Objects.requireNonNull(severity);
        this.title = Objects.requireNonNull(title);
        this.description = Objects.requireNonNull(description);
        this.location = location;
        this.peopleAffected = peopleAffected;
        this.lostTimeDays = lostTimeDays;
        this.immediateAction = immediateAction;
        this.rootCause = rootCause;
        this.investigationNotes = investigationNotes;
        this.status = Objects.requireNonNull(status);

        if (status == SafetyIncidentStatus.CLOSED) {
            this.closedDate =
                    Objects.requireNonNull(currentDate);

        } else if (status != SafetyIncidentStatus.VOID) {
            this.closedDate = null;
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

    public SafetyIncidentType getIncidentType() {
        return incidentType;
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

    public LocalDate getOccurredDate() {
        return occurredDate;
    }

    public LocalDate getReportedDate() {
        return reportedDate;
    }

    public int getPeopleAffected() {
        return peopleAffected;
    }

    public int getLostTimeDays() {
        return lostTimeDays;
    }

    public String getImmediateAction() {
        return immediateAction;
    }

    public String getRootCause() {
        return rootCause;
    }

    public String getInvestigationNotes() {
        return investigationNotes;
    }

    public SafetyIncidentStatus getStatus() {
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
