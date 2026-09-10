package com.buildsight.platform.risk.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.risk.domain.ProjectIssue;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectIssueRepository
        extends JpaRepository<ProjectIssue, UUID> {

    List<ProjectIssue>
    findByProjectIdOrderByCreatedAtDesc(
            UUID projectId);

    Optional<ProjectIssue>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
