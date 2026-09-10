package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.commercial.domain.CommercialClaimStatus;
import com.buildsight.platform.commercial.domain.CommercialClaimType;

public record CommercialClaimResponse(
        UUID id,
        UUID projectId,
        String reference,
        CommercialClaimType claimType,
        String title,
        String basis,
        BigDecimal claimedAmount,
        BigDecimal assessedAmount,
        BigDecimal awardedAmount,
        int claimedDays,
        int awardedDays,
        LocalDate submittedDate,
        LocalDate responseDueDate,
        LocalDate decisionDate,
        CommercialClaimStatus status,
        boolean overdueResponse,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
