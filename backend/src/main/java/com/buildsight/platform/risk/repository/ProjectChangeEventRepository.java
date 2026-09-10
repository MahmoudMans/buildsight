package com.buildsight.platform.risk.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.risk.domain.ProjectChangeEvent;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectChangeEventRepository
        extends JpaRepository<ProjectChangeEvent, UUID> {

    List<ProjectChangeEvent>
    findByProjectIdOrderByRequestedDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectChangeEvent>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
