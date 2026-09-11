package com.buildsight.platform.forecast.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.forecast.domain.ProjectEvmSnapshot;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectEvmSnapshotRepository
        extends JpaRepository<ProjectEvmSnapshot, UUID> {

    List<ProjectEvmSnapshot>
    findByProjectIdOrderByDataDateDesc(
            UUID projectId);

    Optional<ProjectEvmSnapshot>
    findFirstByProjectIdOrderByDataDateDesc(
            UUID projectId);

    boolean existsByProjectIdAndDataDate(
            UUID projectId,
            LocalDate dataDate);

    long countByProjectId(
            UUID projectId);
}
