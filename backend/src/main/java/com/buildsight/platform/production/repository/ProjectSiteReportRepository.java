package com.buildsight.platform.production.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.production.domain.ProjectSiteReport;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectSiteReportRepository
        extends JpaRepository<ProjectSiteReport, UUID> {

    List<ProjectSiteReport>
    findByProjectIdOrderByReportDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectSiteReport>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
