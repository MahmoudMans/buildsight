package com.buildsight.platform.resource.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.resource.domain.ProjectWorkforceDeployment;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectWorkforceDeploymentRepository
        extends JpaRepository<ProjectWorkforceDeployment, UUID> {

    List<ProjectWorkforceDeployment>
    findByProjectIdOrderByWorkDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectWorkforceDeployment>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);
}
