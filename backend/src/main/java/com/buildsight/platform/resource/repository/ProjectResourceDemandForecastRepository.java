package com.buildsight.platform.resource.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.resource.domain.ProjectResourceDemandForecast;
import com.buildsight.platform.resource.domain.ResourceDemandType;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectResourceDemandForecastRepository
        extends JpaRepository<ProjectResourceDemandForecast, UUID> {

    List<ProjectResourceDemandForecast>
    findByProjectIdOrderByPeriodStartAscResourceTypeAscResourceKeyAsc(
            UUID projectId);

    Optional<ProjectResourceDemandForecast>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndPeriodStartAndResourceTypeAndResourceKeyIgnoreCase(
            UUID projectId,
            LocalDate periodStart,
            ResourceDemandType resourceType,
            String resourceKey);
}
