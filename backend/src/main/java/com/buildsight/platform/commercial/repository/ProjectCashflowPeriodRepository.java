package com.buildsight.platform.commercial.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.commercial.domain.ProjectCashflowPeriod;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectCashflowPeriodRepository
        extends JpaRepository<ProjectCashflowPeriod, UUID> {

    List<ProjectCashflowPeriod>
    findByProjectIdOrderByPeriodStartAsc(
            UUID projectId);

    Optional<ProjectCashflowPeriod>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndPeriodStart(
            UUID projectId,
            LocalDate periodStart);
}
