package com.buildsight.platform.cost.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.cost.domain.ProjectBudgetLine;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectBudgetLineRepository
        extends JpaRepository<ProjectBudgetLine, UUID> {

    List<ProjectBudgetLine>
    findByProjectIdOrderByCreatedAtAsc(
            UUID projectId);

    Optional<ProjectBudgetLine>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);
}
