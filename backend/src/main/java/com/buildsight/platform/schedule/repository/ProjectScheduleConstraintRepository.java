package com.buildsight.platform.schedule.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.schedule.domain.ProjectScheduleConstraint;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectScheduleConstraintRepository
        extends JpaRepository<ProjectScheduleConstraint, UUID> {

    List<ProjectScheduleConstraint>
    findByProjectIdOrderByDueDateAscCreatedAtAsc(
            UUID projectId);

    Optional<ProjectScheduleConstraint>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);
}
