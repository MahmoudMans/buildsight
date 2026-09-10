package com.buildsight.platform.cost.repository;

import java.util.List;
import java.util.UUID;

import com.buildsight.platform.cost.domain.ProjectActualCost;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectActualCostRepository
        extends JpaRepository<ProjectActualCost, UUID> {

    List<ProjectActualCost>
    findByProjectIdOrderByCostDateDescCreatedAtDesc(
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);

    boolean existsByCommitmentId(
            UUID commitmentId);
}
