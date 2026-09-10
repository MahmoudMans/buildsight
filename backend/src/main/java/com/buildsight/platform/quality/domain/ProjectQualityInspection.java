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
@Table(name = "project_quality_inspections")
public class ProjectQualityInspection {

    @Id
    private UUID id;

    @Column(name = "project_id", nullable = false, updatable = false)
    private UUID projectId;

    @Column(name = "reference", nullable = false, length = 64, updatable = false)
    private String reference;

    @Column(name = "title", nullable = false, length = 220)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "inspection_type", nullable = false, length = 40)
    private QualityInspectionType inspectionType;

    @Enumerated(EnumType.STRING)
    @Column(name = "discipline", nullable = false, length = 40)
    private QualityDiscipline discipline;

    @Column(name = "planned_date", nullable = false)
    private LocalDate plannedDate;

    @Column(name = "actual_date")
    private LocalDate actualDate;

    @Column(name = "inspector_name", length = 160)
    private String inspectorName;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private QualityInspectionStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "result", nullable = false, length = 40)
    private QualityInspectionResult result;

    @Column(name = "notes", length = 2500)
    private String notes;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProjectQualityInspection() {
    }

    private ProjectQualityInspection(
            UUID id,
            UUID projectId,
            String reference,
            String title,
            QualityInspectionType inspectionType,
            QualityDiscipline discipline,
            LocalDate plannedDate,
            String inspectorName,
            String notes) {

        this.id = Objects.requireNonNull(id);
        this.projectId = Objects.requireNonNull(projectId);
        this.reference = Objects.requireNonNull(reference);
        this.title = Objects.requireNonNull(title);
        this.inspectionType = Objects.requireNonNull(inspectionType);
        this.discipline = Objects.requireNonNull(discipline);
        this.plannedDate = Objects.requireNonNull(plannedDate);
        this.inspectorName = inspectorName;
        this.notes = notes;
        this.status = QualityInspectionStatus.PLANNED;
        this.result = QualityInspectionResult.NOT_ASSESSED;
    }

    public static ProjectQualityInspection create(
            UUID id,
            UUID projectId,
            String reference,
            String title,
            QualityInspectionType inspectionType,
            QualityDiscipline discipline,
            LocalDate plannedDate,
            String inspectorName,
            String notes) {

        return new ProjectQualityInspection(
                id,
                projectId,
                reference,
                title,
                inspectionType,
                discipline,
                plannedDate,
                inspectorName,
                notes);
    }

    public void update(
            String title,
            QualityInspectionType inspectionType,
            QualityDiscipline discipline,
            LocalDate plannedDate,
            LocalDate actualDate,
            String inspectorName,
            QualityInspectionStatus status,
            QualityInspectionResult result,
            String notes,
            LocalDate currentDate) {

        this.title = Objects.requireNonNull(title);
        this.inspectionType = Objects.requireNonNull(inspectionType);
        this.discipline = Objects.requireNonNull(discipline);
        this.plannedDate = Objects.requireNonNull(plannedDate);
        this.inspectorName = inspectorName;
        this.status = Objects.requireNonNull(status);
        this.result = Objects.requireNonNull(result);
        this.notes = notes;

        if (status == QualityInspectionStatus.COMPLETED) {
            this.actualDate =
                    actualDate == null
                            ? Objects.requireNonNull(currentDate)
                            : actualDate;
        } else {
            this.actualDate = actualDate;
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

    public QualityInspectionType getInspectionType() {
        return inspectionType;
    }

    public QualityDiscipline getDiscipline() {
        return discipline;
    }

    public LocalDate getPlannedDate() {
        return plannedDate;
    }

    public LocalDate getActualDate() {
        return actualDate;
    }

    public String getInspectorName() {
        return inspectorName;
    }

    public QualityInspectionStatus getStatus() {
        return status;
    }

    public QualityInspectionResult getResult() {
        return result;
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
