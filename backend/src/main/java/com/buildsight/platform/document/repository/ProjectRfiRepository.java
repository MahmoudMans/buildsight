package com.buildsight.platform.document.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.document.domain.ProjectRfi;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRfiRepository
        extends JpaRepository<ProjectRfi, UUID> {

    List<ProjectRfi>
    findByProjectIdOrderByRaisedDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectRfi>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
