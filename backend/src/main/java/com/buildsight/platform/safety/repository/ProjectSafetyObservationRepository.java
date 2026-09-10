package com.buildsight.platform.safety.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.safety.domain.ProjectSafetyObservation;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectSafetyObservationRepository
        extends JpaRepository<ProjectSafetyObservation, UUID> {

    List<ProjectSafetyObservation>
    findByProjectIdOrderByObservedDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectSafetyObservation>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
