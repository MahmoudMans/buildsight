package com.buildsight.platform.document.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.document.domain.ProjectDocument;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectDocumentRepository
        extends JpaRepository<ProjectDocument, UUID> {

    List<ProjectDocument>
    findByProjectIdOrderByDocumentNumberAsc(
            UUID projectId);

    Optional<ProjectDocument>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndDocumentNumberIgnoreCase(
            UUID projectId,
            String documentNumber);

    boolean existsByProjectId(
            UUID projectId);
}
