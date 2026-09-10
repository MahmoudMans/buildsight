package com.buildsight.platform.procurement.repository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.procurement.domain.ProcurementBid;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcurementBidRepository
        extends JpaRepository<ProcurementBid, UUID> {

    List<ProcurementBid>
    findByProcurementPackageIdInOrderBySubmittedDateDescCreatedAtDesc(
            Collection<UUID> packageIds);

    List<ProcurementBid>
    findByProcurementPackageIdOrderBySubmittedDateDescCreatedAtDesc(
            UUID procurementPackageId);

    Optional<ProcurementBid>
    findByIdAndProcurementPackageId(
            UUID id,
            UUID procurementPackageId);

    boolean existsByProcurementPackageIdAndSupplierId(
            UUID procurementPackageId,
            UUID supplierId);
}
