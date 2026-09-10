package com.buildsight.platform.procurement.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.procurement.domain.Supplier;

import org.springframework.data.jpa.repository.JpaRepository;

public interface SupplierRepository
        extends JpaRepository<Supplier, UUID> {

    List<Supplier>
    findAllByOrderByNameAsc();

    Optional<Supplier>
    findByCodeIgnoreCase(
            String code);

    boolean existsByCodeIgnoreCase(
            String code);
}
