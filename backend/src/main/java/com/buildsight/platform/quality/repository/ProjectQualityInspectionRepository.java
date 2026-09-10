package com.buildsight.platform.quality.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.quality.domain.ProjectQualityInspection;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectQualityInspectionRepository
        extends JpaRepository<ProjectQualityInspection, UUID> {

    List<ProjectQualityInspection>
    findByProjectIdOrderByPlannedDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectQualityInspection>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);

    boolean existsByProjectId(
            UUID projectId);
}
