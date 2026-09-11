package com.buildsight.platform.recovery.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.recovery.domain.ChangeSimulationStatus;
import com.buildsight.platform.recovery.domain.ProjectChangeImpactSimulation;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectChangeImpactSimulationRepository
        extends JpaRepository<ProjectChangeImpactSimulation, UUID> {

    List<ProjectChangeImpactSimulation>
    findByProjectIdOrderByUpdatedAtDescSimulationNumberAsc(
            UUID projectId);

    Optional<ProjectChangeImpactSimulation>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    Optional<ProjectChangeImpactSimulation>
    findFirstByProjectIdAndStatusOrderByUpdatedAtDesc(
            UUID projectId,
            ChangeSimulationStatus status);

    boolean existsByProjectIdAndSimulationNumberIgnoreCase(
            UUID projectId,
            String simulationNumber);

    long countByProjectId(
            UUID projectId);

    boolean existsByProjectId(
            UUID projectId);
}
