package com.buildsight.platform.cost.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.cost.domain.ProjectCommitment;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectCommitmentRepository
        extends JpaRepository<ProjectCommitment, UUID> {

    List<ProjectCommitment>
    findByProjectIdOrderByCommitmentDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectCommitment>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
