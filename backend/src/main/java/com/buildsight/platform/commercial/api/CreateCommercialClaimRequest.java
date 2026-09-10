package com.buildsight.platform.commercial.api;

import java.math.BigDecimal;

import com.buildsight.platform.commercial.domain.CommercialClaimType;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateCommercialClaimRequest(

        @NotBlank
        @Size(max = 64)
        String reference,

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

        @Min(0)
        int claimedDays) {
}
