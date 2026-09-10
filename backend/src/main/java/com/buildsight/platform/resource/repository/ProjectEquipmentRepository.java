package com.buildsight.platform.resource.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.resource.domain.ProjectEquipment;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectEquipmentRepository
        extends JpaRepository<ProjectEquipment, UUID> {

    List<ProjectEquipment>
    findByProjectIdOrderByCodeAsc(
            UUID projectId);

    Optional<ProjectEquipment>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndCodeIgnoreCase(
            UUID projectId,
            String code);
}
