package com.buildsight.platform.risk.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.risk.domain.ProjectRisk;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRiskRepository
        extends JpaRepository<ProjectRisk, UUID> {

    List<ProjectRisk>
    findByProjectIdOrderByCreatedAtDesc(
            UUID projectId);

    Optional<ProjectRisk>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);

    boolean existsByProjectId(
            UUID projectId);
}
