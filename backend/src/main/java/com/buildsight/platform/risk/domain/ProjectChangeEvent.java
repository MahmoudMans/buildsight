package com.buildsight.platform.risk.domain;

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
@Table(name = "project_change_events")
public class ProjectChangeEvent {

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
            name = "title",
            nullable = false,
            length = 180)
    private String title;

    @Column(
            name = "description",
            length = 1800)
    private String description;

    @Column(
            name = "originator",
            length = 160)
    private String originator;

    @Column(
            name = "requested_date",
            nullable = false)
    private LocalDate requestedDate;

    @Column(
            name = "decision_date")
    private LocalDate decisionDate;

    @Column(
            name = "cost_impact",
            nullable = false,
            precision = 19,
            scale = 2)
    private BigDecimal costImpact;

    @Column(
            name = "schedule_impact_days",
            nullable = false)
    private int scheduleImpactDays;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "status",
            nullable = false,
            length = 32)
    private ChangeEventStatus status;

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

    protected ProjectChangeEvent() {
    }

    private ProjectChangeEvent(
            UUID id,
            UUID projectId,
            String reference,
            String title,
            String description,
            String originator,
            LocalDate requestedDate,
            BigDecimal costImpact,
            int scheduleImpactDays) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(
                        projectId);

        this.reference =
                Objects.requireNonNull(
                        reference);

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.originator =
                originator;

        this.requestedDate =
                Objects.requireNonNull(
                        requestedDate);

        this.costImpact =
                Objects.requireNonNull(
                        costImpact);

        this.scheduleImpactDays =
                scheduleImpactDays;

        this.status =
                ChangeEventStatus.DRAFT;
    }

    public static ProjectChangeEvent create(
            UUID id,
            UUID projectId,
            String reference,
            String title,
            String description,
            String originator,
            LocalDate requestedDate,
            BigDecimal costImpact,
            int scheduleImpactDays) {

        return new ProjectChangeEvent(
                id,
                projectId,
                reference,
                title,
                description,
                originator,
                requestedDate,
                costImpact,
                scheduleImpactDays);
    }

    public void update(
            String title,
            String description,
            String originator,
            LocalDate requestedDate,
            LocalDate decisionDate,
            BigDecimal costImpact,
            int scheduleImpactDays,
            ChangeEventStatus status,
            LocalDate currentDate) {

        this.title =
                Objects.requireNonNull(
                        title);

        this.description =
                description;

        this.originator =
                originator;

        this.requestedDate =
                Objects.requireNonNull(
                        requestedDate);

        this.costImpact =
                Objects.requireNonNull(
                        costImpact);

        this.scheduleImpactDays =
                scheduleImpactDays;

        this.status =
                Objects.requireNonNull(
                        status);

        if ((status
                        == ChangeEventStatus.APPROVED
                || status
                        == ChangeEventStatus.REJECTED
                || status
                        == ChangeEventStatus.IMPLEMENTED)
                && decisionDate == null) {

            this.decisionDate =
                    Objects.requireNonNull(
                            currentDate);

        } else {
            this.decisionDate =
                    decisionDate;
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

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getOriginator() {
        return originator;
    }

    public LocalDate getRequestedDate() {
        return requestedDate;
    }

    public LocalDate getDecisionDate() {
        return decisionDate;
    }

    public BigDecimal getCostImpact() {
        return costImpact;
    }

    public int getScheduleImpactDays() {
        return scheduleImpactDays;
    }

    public ChangeEventStatus getStatus() {
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
