package com.buildsight.platform.project.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.project.domain.ProjectMilestone;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectMilestoneRepository
        extends JpaRepository<ProjectMilestone, UUID> {

    List<ProjectMilestone>
    findByProjectIdOrderBySortOrderAscPlannedDateAsc(UUID projectId);

    Optional<ProjectMilestone>
    findByIdAndProjectId(UUID id, UUID projectId);

    boolean existsByProjectId(UUID projectId);
}
