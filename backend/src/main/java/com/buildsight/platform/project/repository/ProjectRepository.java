package com.buildsight.platform.project.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.project.domain.Project;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository
        extends JpaRepository<Project, UUID> {

    boolean existsByCodeIgnoreCase(String code);

    Optional<Project> findByCodeIgnoreCase(String code);

    List<Project> findAllByOrderByUpdatedAtDesc();
}
