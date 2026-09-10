package com.buildsight.platform.document.api;

import com.buildsight.platform.document.domain.DocumentRevisionStatus;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;

public record UpdateDocumentRevisionStatusRequest(

        @PositiveOrZero
        long version,

        @NotNull
        DocumentRevisionStatus status) {
}
