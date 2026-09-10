package com.buildsight.platform.procurement.repository;

import java.util.List;
import java.util.UUID;

import com.buildsight.platform.procurement.domain.SupplierPerformanceEvaluation;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierPerformanceEvaluationRepository
        extends JpaRepository<
                SupplierPerformanceEvaluation,
                UUID> {

    List<SupplierPerformanceEvaluation>
    findByProjectIdOrderByEvaluationDateDescCreatedAtDesc(
            UUID projectId);
}
