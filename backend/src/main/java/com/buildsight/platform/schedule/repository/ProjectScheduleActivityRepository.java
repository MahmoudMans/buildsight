package com.buildsight.platform.schedule.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.schedule.domain.ProjectScheduleActivity;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectScheduleActivityRepository
        extends JpaRepository<ProjectScheduleActivity, UUID> {

    List<ProjectScheduleActivity>
    findByProjectIdOrderByCurrentStartAscActivityCodeAsc(
            UUID projectId);

    Optional<ProjectScheduleActivity>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndActivityCodeIgnoreCase(
            UUID projectId,
            String activityCode);

    boolean existsByProjectId(
            UUID projectId);
}
