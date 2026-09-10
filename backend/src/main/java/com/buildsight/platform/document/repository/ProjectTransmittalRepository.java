package com.buildsight.platform.document.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.document.domain.ProjectTransmittal;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectTransmittalRepository
        extends JpaRepository<ProjectTransmittal, UUID> {

    List<ProjectTransmittal>
    findByProjectIdOrderByTransmittalDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectTransmittal>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
