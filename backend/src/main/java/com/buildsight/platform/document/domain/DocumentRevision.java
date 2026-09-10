package com.buildsight.platform.document.domain;

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
@Table(name = "document_revisions")
public class DocumentRevision {

    @Id
    @Column(
            name = "id",
            nullable = false,
            updatable = false)
    private UUID id;

    @Column(
            name = "document_id",
            nullable = false,
            updatable = false)
    private UUID documentId;

    @Column(
            name = "revision_code",
            nullable = false,
            length = 32,
            updatable = false)
    private String revisionCode;

    @Enumerated(EnumType.STRING)
    @Column(
            name = "revision_status",
            nullable = false,
            length = 32)
    private DocumentRevisionStatus revisionStatus;

    @Column(
            name = "issued_date",
            nullable = false)
    private LocalDate issuedDate;

    @Column(
            name = "file_name",
            nullable = false,
            length = 255,
            updatable = false)
    private String fileName;

    @Column(
            name = "content_type",
            length = 255,
            updatable = false)
    private String contentType;

    @Column(
            name = "file_size",
            nullable = false,
            updatable = false)
    private long fileSize;

    @Column(
            name = "sha256",
            nullable = false,
            length = 64,
            updatable = false)
    private String sha256;

    @Column(
            name = "storage_path",
            nullable = false,
            length = 700,
            updatable = false)
    private String storagePath;

    @Column(
            name = "extracted_text",
            nullable = false,
            columnDefinition = "TEXT")
    private String extractedText;

    @Column(
            name = "search_text",
            nullable = false,
            columnDefinition = "TEXT")
    private String searchText;

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

    protected DocumentRevision() {
    }

    private DocumentRevision(
            UUID id,
            UUID documentId,
            String revisionCode,
            DocumentRevisionStatus revisionStatus,
            LocalDate issuedDate,
            String fileName,
            String contentType,
            long fileSize,
            String sha256,
            String storagePath,
            String extractedText,
            String searchText) {

        this.id =
                Objects.requireNonNull(id);

        this.documentId =
                Objects.requireNonNull(documentId);

        this.revisionCode =
                Objects.requireNonNull(revisionCode);

        this.revisionStatus =
                Objects.requireNonNull(revisionStatus);

        this.issuedDate =
                Objects.requireNonNull(issuedDate);

        this.fileName =
                Objects.requireNonNull(fileName);

        this.contentType =
                contentType;

        this.fileSize =
                fileSize;

        this.sha256 =
                Objects.requireNonNull(sha256);

        this.storagePath =
                Objects.requireNonNull(storagePath);

        this.extractedText =
                Objects.requireNonNull(extractedText);

        this.searchText =
                Objects.requireNonNull(searchText);
    }

    public static DocumentRevision create(
            UUID id,
            UUID documentId,
            String revisionCode,
            DocumentRevisionStatus revisionStatus,
            LocalDate issuedDate,
            String fileName,
            String contentType,
            long fileSize,
            String sha256,
            String storagePath,
            String extractedText,
            String searchText) {

        return new DocumentRevision(
                id,
                documentId,
                revisionCode,
                revisionStatus,
                issuedDate,
                fileName,
                contentType,
                fileSize,
                sha256,
                storagePath,
                extractedText,
                searchText);
    }

    public void changeStatus(
            DocumentRevisionStatus status) {

        this.revisionStatus =
                Objects.requireNonNull(status);
    }

    public void supersede() {
        this.revisionStatus =
                DocumentRevisionStatus.SUPERSEDED;
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

    public UUID getDocumentId() {
        return documentId;
    }

    public String getRevisionCode() {
        return revisionCode;
    }

    public DocumentRevisionStatus getRevisionStatus() {
        return revisionStatus;
    }

    public LocalDate getIssuedDate() {
        return issuedDate;
    }

    public String getFileName() {
        return fileName;
    }

    public String getContentType() {
        return contentType;
    }

    public long getFileSize() {
        return fileSize;
    }

    public String getSha256() {
        return sha256;
    }

    public String getStoragePath() {
        return storagePath;
    }

    public String getExtractedText() {
        return extractedText;
    }

    public String getSearchText() {
        return searchText;
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
