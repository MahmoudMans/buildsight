package com.buildsight.platform.quality.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.quality.domain.ProjectPunchItem;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectPunchItemRepository
        extends JpaRepository<ProjectPunchItem, UUID> {

    List<ProjectPunchItem>
    findByProjectIdOrderByRaisedDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectPunchItem>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
