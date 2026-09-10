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
@Table(name = "project_punch_items")
public class ProjectPunchItem {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "reference", nullable = false, length = 64, updatable = false)
    private String reference;

    @Column(name = "title", nullable = false, length = 220)
    private String title;

    @Column(name = "description", length = 2500)
    private String description;

    @Column(name = "location", length = 220)
    private String location;

    @Column(name = "trade", length = 120)
    private String trade;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", nullable = false, length = 32)
    private PunchPriority priority;

    @Column(name = "raised_date", nullable = false)
    private LocalDate raisedDate;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(name = "owner_name", length = 160)
    private String ownerName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 40)
    private PunchStatus status;

    @Column(name = "closed_date")
    private LocalDate closedDate;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProjectPunchItem() {
    }

    private ProjectPunchItem(
            UUID id,
            UUID projectId,
            String reference,
            String title,
            String description,
            String location,
            String trade,
            PunchPriority priority,
            LocalDate raisedDate,
            LocalDate dueDate,
            String ownerName) {

        this.id = Objects.requireNonNull(id);
        this.projectId = Objects.requireNonNull(projectId);
        this.reference = Objects.requireNonNull(reference);
        this.title = Objects.requireNonNull(title);
        this.description = description;
        this.location = location;
        this.trade = trade;
        this.priority = Objects.requireNonNull(priority);
        this.raisedDate = Objects.requireNonNull(raisedDate);
        this.dueDate = Objects.requireNonNull(dueDate);
        this.ownerName = ownerName;
        this.status = PunchStatus.OPEN;
    }

    public static ProjectPunchItem create(
            UUID id,
            UUID projectId,
            String reference,
            String title,
            String description,
            String location,
            String trade,
            PunchPriority priority,
            LocalDate raisedDate,
            LocalDate dueDate,
            String ownerName) {

        return new ProjectPunchItem(
                id,
                projectId,
                reference,
                title,
                description,
                location,
                trade,
                priority,
                raisedDate,
                dueDate,
                ownerName);
    }

    public void update(
            String title,
            String description,
            String location,
            String trade,
            PunchPriority priority,
            LocalDate dueDate,
            String ownerName,
            PunchStatus status,
            LocalDate currentDate) {

        this.title = Objects.requireNonNull(title);
        this.description = description;
        this.location = location;
        this.trade = trade;
        this.priority = Objects.requireNonNull(priority);
        this.dueDate = Objects.requireNonNull(dueDate);
        this.ownerName = ownerName;
        this.status = Objects.requireNonNull(status);

        if (status == PunchStatus.CLOSED) {
            this.closedDate = Objects.requireNonNull(currentDate);
        } else if (status != PunchStatus.VOID) {
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

    public String getReference() {
        return reference;
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

    public String getTrade() {
        return trade;
    }

    public PunchPriority getPriority() {
        return priority;
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

    public PunchStatus getStatus() {
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
