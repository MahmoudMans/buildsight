package com.buildsight.platform.procurement.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.procurement.domain.ProcurementPackage;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcurementPackageRepository
        extends JpaRepository<ProcurementPackage, UUID> {

    List<ProcurementPackage>
    findByProjectIdOrderByAwardDueDateAscCreatedAtAsc(
            UUID projectId);

    Optional<ProcurementPackage>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);

    boolean existsByProjectId(
            UUID projectId);
}
