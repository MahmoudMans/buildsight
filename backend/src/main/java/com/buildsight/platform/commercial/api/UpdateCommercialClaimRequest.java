package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;
import java.time.LocalDate;

import com.buildsight.platform.commercial.domain.CommercialClaimStatus;
import com.buildsight.platform.commercial.domain.CommercialClaimType;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateCommercialClaimRequest(

        @PositiveOrZero
        long version,

        @NotNull
        CommercialClaimType claimType,

        @NotBlank
        @Size(max = 220)
        String title,

        @NotBlank
        String basis,

        @NotNull
        @DecimalMin("0.00")
        BigDecimal claimedAmount,

        @DecimalMin("0.00")
        BigDecimal assessedAmount,

        @DecimalMin("0.00")
        BigDecimal awardedAmount,

        @Min(0)
        int claimedDays,

        @Min(0)
        int awardedDays,

        LocalDate submittedDate,

        LocalDate responseDueDate,

        @NotNull
        CommercialClaimStatus status) {
}
