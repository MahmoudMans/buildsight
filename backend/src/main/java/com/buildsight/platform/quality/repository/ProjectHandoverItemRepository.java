package com.buildsight.platform.quality.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.quality.domain.ProjectHandoverItem;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectHandoverItemRepository
        extends JpaRepository<ProjectHandoverItem, UUID> {

    List<ProjectHandoverItem>
    findByProjectIdOrderByDueDateAscCodeAsc(
            UUID projectId);

    Optional<ProjectHandoverItem>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndCodeIgnoreCase(
            UUID projectId,
            String code);
}
