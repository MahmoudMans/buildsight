package com.buildsight.platform.commercial.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.commercial.domain.CommercialChangeOrder;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CommercialChangeOrderRepository
        extends JpaRepository<CommercialChangeOrder, UUID> {

    List<CommercialChangeOrder>
    findByProjectIdOrderByCreatedAtDesc(
            UUID projectId);

    Optional<CommercialChangeOrder>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);

    boolean existsByProjectId(
            UUID projectId);
}
