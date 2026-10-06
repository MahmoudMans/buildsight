package com.buildsight.platform.periodcontrol.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.periodcontrol.domain.ProgressPeriodStatus;
import com.buildsight.platform.periodcontrol.domain.ProjectProgressPeriod;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectProgressPeriodRepository
        extends JpaRepository<ProjectProgressPeriod, UUID> {

    List<ProjectProgressPeriod>
    findByProjectIdOrderByEndDateDescPeriodCodeDesc(
            UUID projectId);

    Optional<ProjectProgressPeriod>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    Optional<ProjectProgressPeriod>
    findFirstByProjectIdAndStatusOrderByStartDateDesc(
            UUID projectId,
            ProgressPeriodStatus status);

    boolean existsByProjectIdAndPeriodCodeIgnoreCase(
            UUID projectId,
            String periodCode);

    boolean existsByProjectIdAndStatus(
            UUID projectId,
            ProgressPeriodStatus status);

    boolean existsByProjectId(
            UUID projectId);

    long countByProjectIdAndStatus(
            UUID projectId,
            ProgressPeriodStatus status);
}
