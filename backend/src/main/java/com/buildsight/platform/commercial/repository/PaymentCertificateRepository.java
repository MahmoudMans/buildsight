package com.buildsight.platform.commercial.repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.buildsight.platform.commercial.domain.PaymentCertificate;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentCertificateRepository
        extends JpaRepository<PaymentCertificate, UUID> {

    List<PaymentCertificate>
    findByProjectIdOrderByPeriodEndDescCreatedAtDesc(
            UUID projectId);

    Optional<PaymentCertificate>
    findByIdAndProjectId(
            UUID id,
            UUID projectId);

    boolean existsByProjectIdAndReferenceIgnoreCase(
            UUID projectId,
            String reference);
}
