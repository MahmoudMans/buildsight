package com.buildsight.platform.document.api;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

import com.buildsight.platform.document.domain.DocumentRevisionStatus;

public record DocumentRevisionResponse(
        UUID id,
        UUID documentId,
        String documentNumber,
        String documentTitle,
        String revisionCode,
        DocumentRevisionStatus revisionStatus,
        LocalDate issuedDate,
        String fileName,
        String contentType,
        long fileSize,
        String sha256,
        int extractedCharacterCount,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
