package com.buildsight.platform.document.domain;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "transmittal_revision_links")
public class TransmittalRevisionLink {

    @Id
    @Column(
            name = "id",
            nullable = false,
            updatable = false)
    private UUID id;

    @Column(
            name = "transmittal_id",
            nullable = false,
            updatable = false)
    private UUID transmittalId;

    @Column(
            name = "document_revision_id",
            nullable = false,
            updatable = false)
    private UUID documentRevisionId;

    @Column(
            name = "created_at",
            nullable = false,
            updatable = false)
    private Instant createdAt;

    protected TransmittalRevisionLink() {
    }

    private TransmittalRevisionLink(
            UUID id,
            UUID transmittalId,
            UUID documentRevisionId) {

        this.id =
                Objects.requireNonNull(id);

        this.transmittalId =
                Objects.requireNonNull(transmittalId);

        this.documentRevisionId =
                Objects.requireNonNull(documentRevisionId);
    }

    public static TransmittalRevisionLink create(
            UUID id,
            UUID transmittalId,
            UUID documentRevisionId) {

        return new TransmittalRevisionLink(
                id,
                transmittalId,
                documentRevisionId);
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt =
                    Instant.now();
        }
    }

    public UUID getId() {
        return id;
    }

    public UUID getTransmittalId() {
        return transmittalId;
    }

    public UUID getDocumentRevisionId() {
        return documentRevisionId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
