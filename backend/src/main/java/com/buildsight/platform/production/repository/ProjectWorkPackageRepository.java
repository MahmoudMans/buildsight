package com.buildsight.platform.production.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.production.domain.ProjectWorkPackage;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectWorkPackageRepository
        extends JpaRepository<ProjectWorkPackage, UUID> {

    List<ProjectWorkPackage>
    findByProjectIdOrderByPlannedStartDateAscCodeAsc(
            UUID projectId);

    Optional<ProjectWorkPackage>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndCodeIgnoreCase(
            UUID projectId,
            String code);

    boolean existsByProjectId(
            UUID projectId);
}
