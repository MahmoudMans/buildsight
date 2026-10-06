package com.buildsight.platform.periodcontrol.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.periodcontrol.domain.ProjectPeriodEndSnapshot;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectPeriodEndSnapshotRepository
        extends JpaRepository<ProjectPeriodEndSnapshot, UUID> {

    List<ProjectPeriodEndSnapshot>
    findByProjectIdOrderByClosedAtDesc(
            UUID projectId);

    Optional<ProjectPeriodEndSnapshot>
    findFirstByProjectIdOrderByClosedAtDesc(
            UUID projectId);

    boolean existsByPeriodId(
            UUID periodId);
}
