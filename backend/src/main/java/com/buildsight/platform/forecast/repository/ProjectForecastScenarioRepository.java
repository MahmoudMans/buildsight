package com.buildsight.platform.forecast.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.forecast.domain.ForecastScenarioStatus;
import com.buildsight.platform.forecast.domain.ProjectForecastScenario;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectForecastScenarioRepository
        extends JpaRepository<ProjectForecastScenario, UUID> {

    List<ProjectForecastScenario>
    findByProjectIdOrderByUpdatedAtDesc(
            UUID projectId);

    Optional<ProjectForecastScenario>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    Optional<ProjectForecastScenario>
    findFirstByProjectIdAndStatusOrderByUpdatedAtDesc(
            UUID projectId,
            ForecastScenarioStatus status);

    boolean existsByProjectIdAndNameIgnoreCase(
            UUID projectId,
            String name);

    boolean existsByProjectId(
            UUID projectId);
}
