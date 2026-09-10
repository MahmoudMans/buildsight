package com.buildsight.platform.schedule.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.schedule.domain.ProjectScheduleDependency;
import com.buildsight.platform.schedule.domain.ScheduleDependencyType;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectScheduleDependencyRepository
        extends JpaRepository<ProjectScheduleDependency, UUID> {

    List<ProjectScheduleDependency>
    findByProjectIdOrderByCreatedAtAsc(
            UUID projectId);

    Optional<ProjectScheduleDependency>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndPredecessorActivityIdAndSuccessorActivityIdAndDependencyType(
            UUID projectId,
            UUID predecessorActivityId,
            UUID successorActivityId,
            ScheduleDependencyType dependencyType);
}
