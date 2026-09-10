package com.buildsight.platform.safety.api;

import java.time.LocalDate;

import com.buildsight.platform.safety.domain.WorkPermitStatus;
import com.buildsight.platform.safety.domain.WorkPermitType;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record UpdateWorkPermitRequest(

        @PositiveOrZero
        long version,

        @NotNull
        WorkPermitType permitType,

        @NotBlank
        @Size(max = 220)
        String title,

        @Size(max = 220)
        String location,

        @Size(max = 160)
        String issuerName,

        @Size(max = 160)
        String receiverName,

        @NotNull
        LocalDate validFrom,

        @NotNull
        LocalDate validUntil,

        String controls,

        @NotNull
        WorkPermitStatus status) {
}
