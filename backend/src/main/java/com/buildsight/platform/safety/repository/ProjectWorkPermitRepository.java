package com.buildsight.platform.safety.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.safety.domain.ProjectWorkPermit;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectWorkPermitRepository
        extends JpaRepository<ProjectWorkPermit, UUID> {

    List<ProjectWorkPermit>
    findByProjectIdOrderByValidUntilAscCreatedAtDesc(
            UUID projectId);

    Optional<ProjectWorkPermit>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
