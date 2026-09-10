package com.buildsight.platform.document.domain;

import java.time.Instant;
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
@Table(name = "project_documents")
public class ProjectDocument {

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
            name = "document_number",
            nullable = false,
            length = 80,
            updatable = false)
    private String documentNumber;

    @Column(
            name = "title",
            nullable = false,
            length = 220)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "document_type",
            nullable = false,
            length = 40)
    private DocumentType documentType;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "discipline",
            nullable = false,
            length = 40)
    private DocumentDiscipline discipline;

    @Column(
            name = "owner_name",
            length = 160)
    private String ownerName;

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

    protected ProjectDocument() {
    }

    private ProjectDocument(
            UUID id,
            UUID projectId,
            String documentNumber,
            String title,
            DocumentType documentType,
            DocumentDiscipline discipline,
            String ownerName) {

        this.id =
                Objects.requireNonNull(id);

        this.projectId =
                Objects.requireNonNull(projectId);

        this.documentNumber =
                Objects.requireNonNull(documentNumber);

        this.title =
                Objects.requireNonNull(title);

        this.documentType =
                Objects.requireNonNull(documentType);

        this.discipline =
                Objects.requireNonNull(discipline);

        this.ownerName =
                ownerName;
    }

    public static ProjectDocument create(
            UUID id,
            UUID projectId,
            String documentNumber,
            String title,
            DocumentType documentType,
            DocumentDiscipline discipline,
            String ownerName) {

        return new ProjectDocument(
                id,
                projectId,
                documentNumber,
                title,
                documentType,
                discipline,
                ownerName);
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

    public String getDocumentNumber() {
        return documentNumber;
    }

    public String getTitle() {
        return title;
    }

    public DocumentType getDocumentType() {
        return documentType;
    }

    public DocumentDiscipline getDiscipline() {
        return discipline;
    }

    public String getOwnerName() {
        return ownerName;
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
