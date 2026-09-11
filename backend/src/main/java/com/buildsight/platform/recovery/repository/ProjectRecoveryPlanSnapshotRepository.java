package com.buildsight.platform.recovery.repository;

import java.util.List;
import java.util.UUID;

import com.buildsight.platform.recovery.domain.ProjectRecoveryPlanSnapshot;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRecoveryPlanSnapshotRepository
        extends JpaRepository<ProjectRecoveryPlanSnapshot, UUID> {

    List<ProjectRecoveryPlanSnapshot>
    findByProjectIdOrderBySelectedAtDesc(
            UUID projectId);

    boolean existsBySimulationId(
            UUID simulationId);
}
