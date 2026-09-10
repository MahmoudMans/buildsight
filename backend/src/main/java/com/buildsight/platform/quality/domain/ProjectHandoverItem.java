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
@Table(name = "project_handover_items")
public class ProjectHandoverItem {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "code", nullable = false, length = 64, updatable = false)
    private String code;

    @Column(name = "title", nullable = false, length = 220)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 40)
    private HandoverCategory category;

    @Column(name = "owner_name", length = 160)
    private String ownerName;

    @Column(name = "due_date", nullable = false)
    private LocalDate dueDate;

    @Column(name = "received_date")
    private LocalDate receivedDate;

    @Column(name = "approved_date")
    private LocalDate approvedDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private HandoverStatus status;

    @Column(name = "notes", length = 2000)
    private String notes;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProjectHandoverItem() {
    }

    private ProjectHandoverItem(
            UUID id,
            UUID projectId,
            String code,
            String title,
            HandoverCategory category,
            String ownerName,
            LocalDate dueDate,
            String notes) {

        this.id = Objects.requireNonNull(id);
        this.projectId = Objects.requireNonNull(projectId);
        this.code = Objects.requireNonNull(code);
        this.title = Objects.requireNonNull(title);
        this.category = Objects.requireNonNull(category);
        this.ownerName = ownerName;
        this.dueDate = Objects.requireNonNull(dueDate);
        this.notes = notes;
        this.status = HandoverStatus.NOT_STARTED;
    }

    public static ProjectHandoverItem create(
            UUID id,
            UUID projectId,
            String code,
            String title,
            HandoverCategory category,
            String ownerName,
            LocalDate dueDate,
            String notes) {

        return new ProjectHandoverItem(
                id,
                projectId,
                code,
                title,
                category,
                ownerName,
                dueDate,
                notes);
    }

    public void update(
            String title,
            HandoverCategory category,
            String ownerName,
            LocalDate dueDate,
            HandoverStatus status,
            String notes,
            LocalDate currentDate) {

        this.title = Objects.requireNonNull(title);
        this.category = Objects.requireNonNull(category);
        this.ownerName = ownerName;
        this.dueDate = Objects.requireNonNull(dueDate);
        this.status = Objects.requireNonNull(status);
        this.notes = notes;

        if (status == HandoverStatus.SUBMITTED) {
            if (receivedDate == null) {
                receivedDate = currentDate;
            }

            approvedDate = null;
        }

        if (status == HandoverStatus.APPROVED) {
            if (receivedDate == null) {
                receivedDate = currentDate;
            }

            approvedDate = currentDate;
        }

        if (status == HandoverStatus.REJECTED) {
            approvedDate = null;
        }

        if (status == HandoverStatus.NOT_STARTED) {
            receivedDate = null;
            approvedDate = null;
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

    public String getCode() {
        return code;
    }

    public String getTitle() {
        return title;
    }

    public HandoverCategory getCategory() {
        return category;
    }

    public String getOwnerName() {
        return ownerName;
    }

    public LocalDate getDueDate() {
        return dueDate;
    }

    public LocalDate getReceivedDate() {
        return receivedDate;
    }

    public LocalDate getApprovedDate() {
        return approvedDate;
    }

    public HandoverStatus getStatus() {
        return status;
    }

    public String getNotes() {
        return notes;
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
