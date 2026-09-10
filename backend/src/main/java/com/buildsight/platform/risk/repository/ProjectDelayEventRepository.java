package com.buildsight.platform.risk.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.risk.domain.ProjectDelayEvent;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectDelayEventRepository
        extends JpaRepository<ProjectDelayEvent, UUID> {

    List<ProjectDelayEvent>
    findByProjectIdOrderByStartDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectDelayEvent>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
