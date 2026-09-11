package com.buildsight.platform.governance.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.governance.domain.ProjectGovernanceDecision;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectGovernanceDecisionRepository
        extends JpaRepository<ProjectGovernanceDecision, UUID> {

    List<ProjectGovernanceDecision>
    findByProjectIdOrderByDecisionDateDescDecisionNumberAsc(
            UUID projectId);

    Optional<ProjectGovernanceDecision>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndDecisionNumberIgnoreCase(
            UUID projectId,
            String decisionNumber);
}
