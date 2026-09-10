package com.buildsight.platform.resource.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.resource.domain.ProjectWorkforcePlan;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectWorkforcePlanRepository
        extends JpaRepository<ProjectWorkforcePlan, UUID> {

    List<ProjectWorkforcePlan>
    findByProjectIdOrderByPeriodStartDescTradeAsc(
            UUID projectId);

    Optional<ProjectWorkforcePlan>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectId(
            UUID projectId);
}
