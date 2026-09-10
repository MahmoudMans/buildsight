package com.buildsight.platform.resource.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.resource.domain.ProjectEquipmentUsageLog;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectEquipmentUsageLogRepository
        extends JpaRepository<ProjectEquipmentUsageLog, UUID> {

    List<ProjectEquipmentUsageLog>
    findByProjectIdOrderByWorkDateDescCreatedAtDesc(
            UUID projectId);

    Optional<ProjectEquipmentUsageLog>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByEquipmentIdAndWorkDate(
            UUID equipmentId,
            LocalDate workDate);
}
