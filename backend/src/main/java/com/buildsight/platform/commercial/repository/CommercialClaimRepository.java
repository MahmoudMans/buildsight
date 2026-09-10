package com.buildsight.platform.commercial.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.commercial.domain.CommercialClaim;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CommercialClaimRepository
        extends JpaRepository<CommercialClaim, UUID> {

    List<CommercialClaim>
    findByProjectIdOrderByCreatedAtDesc(
            UUID projectId);

    Optional<CommercialClaim>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
