package com.buildsight.platform.quality.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.quality.domain.ProjectNcr;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectNcrRepository
        extends JpaRepository<ProjectNcr, UUID> {

    List<ProjectNcr>
    findByProjectIdOrderByRaisedDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectNcr>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
