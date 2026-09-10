package com.buildsight.platform.procurement.api;

import java.time.Instant;
import java.util.UUID;

import com.buildsight.platform.procurement.domain.SupplierQualificationStatus;
import com.buildsight.platform.procurement.domain.SupplierType;

public record SupplierResponse(
        UUID id,
        String code,
        String name,
        SupplierType supplierType,
        String trade,
        String country,
        String contactPerson,
        String email,
        SupplierQualificationStatus qualificationStatus,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
