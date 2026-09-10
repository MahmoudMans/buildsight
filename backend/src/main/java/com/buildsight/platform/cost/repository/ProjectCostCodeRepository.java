package com.buildsight.platform.cost.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.cost.domain.ProjectCostCode;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectCostCodeRepository
        extends JpaRepository<ProjectCostCode, UUID> {

    List<ProjectCostCode>
    findByProjectIdOrderBySortOrderAscCodeAsc(
            UUID projectId);

    Optional<ProjectCostCode>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndCodeIgnoreCase(
            UUID projectId,
            String code);

    boolean existsByProjectId(
            UUID projectId);
}
