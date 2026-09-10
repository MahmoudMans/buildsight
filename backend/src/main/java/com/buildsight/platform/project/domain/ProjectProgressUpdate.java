package com.buildsight.platform.project.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "project_progress_updates")
public class ProjectProgressUpdate {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(
            name = "progress_percentage",
            nullable = false,
            precision = 5,
            scale = 2)
    private BigDecimal progressPercentage;

    @Column(name = "update_date", nullable = false)
    private LocalDate updateDate;

    @Column(name = "note", length = 1000)
    private String note;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected ProjectProgressUpdate() {
    }

    private ProjectProgressUpdate(
            UUID id,
            UUID projectId,
            BigDecimal progressPercentage,
            LocalDate updateDate,
            String note) {

        this.id = Objects.requireNonNull(id);
        this.projectId = Objects.requireNonNull(projectId);
        this.progressPercentage =
                Objects.requireNonNull(progressPercentage);
        this.updateDate = Objects.requireNonNull(updateDate);
        this.note = note;
    }

    public static ProjectProgressUpdate create(
            UUID id,
            UUID projectId,
            BigDecimal progressPercentage,
            LocalDate updateDate,
            String note) {

        return new ProjectProgressUpdate(
                id,
                projectId,
                progressPercentage,
                updateDate,
                note);
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public BigDecimal getProgressPercentage() {
        return progressPercentage;
    }

    public LocalDate getUpdateDate() {
        return updateDate;
    }

    public String getNote() {
        return note;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
