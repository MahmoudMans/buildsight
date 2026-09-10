package com.buildsight.platform.project.repository;

import java.util.List;
import java.util.UUID;

import com.buildsight.platform.project.domain.ProjectProgressUpdate;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectProgressUpdateRepository
        extends JpaRepository<ProjectProgressUpdate, UUID> {

    List<ProjectProgressUpdate>
    findTop20ByProjectIdOrderByUpdateDateDescCreatedAtDesc(
            UUID projectId);

    boolean existsByProjectId(UUID projectId);
}
