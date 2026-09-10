package com.buildsight.platform.safety.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.safety.domain.ProjectSafetyAction;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectSafetyActionRepository
        extends JpaRepository<ProjectSafetyAction, UUID> {

    List<ProjectSafetyAction>
    findByProjectIdOrderByDueDateAscCreatedAtAsc(
            UUID projectId);

    List<ProjectSafetyAction>
    findByIncidentIdOrderByDueDateAscCreatedAtAsc(
            UUID incidentId);

    List<ProjectSafetyAction>
    findByObservationIdOrderByDueDateAscCreatedAtAsc(
            UUID observationId);

    Optional<ProjectSafetyAction>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
