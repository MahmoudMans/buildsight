package com.buildsight.platform.document.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.document.domain.DocumentRevision;

import org.springframework.data.jpa.repository.JpaRepository;

public interface DocumentRevisionRepository
        extends JpaRepository<DocumentRevision, UUID> {

    List<DocumentRevision>
    findByDocumentIdInOrderByCreatedAtDesc(
            Collection<UUID> documentIds);

    List<DocumentRevision>
    findByDocumentIdOrderByCreatedAtDesc(
            UUID documentId);

    Optional<DocumentRevision>
    findByIdAndDocumentId(
            UUID id,
            UUID documentId);

    boolean existsByDocumentIdAndRevisionCodeIgnoreCase(
            UUID documentId,
            String revisionCode);
}
