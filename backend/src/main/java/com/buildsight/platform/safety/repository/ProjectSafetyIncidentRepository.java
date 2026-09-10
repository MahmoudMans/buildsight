package com.buildsight.platform.safety.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.safety.domain.ProjectSafetyIncident;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectSafetyIncidentRepository
        extends JpaRepository<ProjectSafetyIncident, UUID> {

    List<ProjectSafetyIncident>
    findByProjectIdOrderByOccurredDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectSafetyIncident>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);

    boolean existsByProjectId(
            UUID projectId);
}
