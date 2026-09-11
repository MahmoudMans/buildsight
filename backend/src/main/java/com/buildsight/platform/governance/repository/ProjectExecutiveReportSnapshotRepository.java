package com.buildsight.platform.governance.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.governance.domain.ProjectExecutiveReportSnapshot;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectExecutiveReportSnapshotRepository
        extends JpaRepository<ProjectExecutiveReportSnapshot, UUID> {

    List<ProjectExecutiveReportSnapshot>
    findByProjectIdOrderByReportDateDesc(
            UUID projectId);

    boolean existsByProjectIdAndReportDate(
            UUID projectId,
            LocalDate reportDate);
}
