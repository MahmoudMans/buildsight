package com.buildsight.platform.schedule.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.schedule.domain.ProjectScheduleBaseline;
import com.buildsight.platform.schedule.domain.ScheduleBaselineStatus;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectScheduleBaselineRepository
        extends JpaRepository<ProjectScheduleBaseline, UUID> {

    List<ProjectScheduleBaseline>
    findByProjectIdOrderByCreatedAtDesc(
            UUID projectId);

    Optional<ProjectScheduleBaseline>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    Optional<ProjectScheduleBaseline>
    findFirstByProjectIdAndStatusOrderByCreatedAtDesc(
            UUID projectId,
            ScheduleBaselineStatus status);

    boolean existsByProjectIdAndNameIgnoreCase(
            UUID projectId,
            String name);
}
