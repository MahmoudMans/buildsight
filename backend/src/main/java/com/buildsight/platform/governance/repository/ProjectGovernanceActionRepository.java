package com.buildsight.platform.governance.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.governance.domain.ProjectGovernanceAction;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectGovernanceActionRepository
        extends JpaRepository<ProjectGovernanceAction, UUID> {

    List<ProjectGovernanceAction>
    findByProjectIdOrderByDueDateAscActionNumberAsc(
            UUID projectId);

    Optional<ProjectGovernanceAction>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndActionNumberIgnoreCase(
            UUID projectId,
            String actionNumber);
}
