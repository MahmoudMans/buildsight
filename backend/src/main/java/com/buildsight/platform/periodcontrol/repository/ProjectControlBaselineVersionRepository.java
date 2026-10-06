package com.buildsight.platform.periodcontrol.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.periodcontrol.domain.ControlBaselineStatus;
import com.buildsight.platform.periodcontrol.domain.ProjectControlBaselineVersion;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectControlBaselineVersionRepository
        extends JpaRepository<ProjectControlBaselineVersion, UUID> {

    List<ProjectControlBaselineVersion>
    findByProjectIdOrderByCreatedAtDescVersionCodeAsc(
            UUID projectId);

    Optional<ProjectControlBaselineVersion>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    Optional<ProjectControlBaselineVersion>
    findFirstByProjectIdAndStatusOrderByApprovedAtDescCreatedAtDesc(
            UUID projectId,
            ControlBaselineStatus status);

    boolean existsByProjectIdAndVersionCodeIgnoreCase(
            UUID projectId,
            String versionCode);

    boolean existsByProjectId(
            UUID projectId);

    long countByProjectId(
            UUID projectId);
}
