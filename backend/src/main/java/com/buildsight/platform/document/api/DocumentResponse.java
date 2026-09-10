package com.buildsight.platform.document.api;

import java.time.Instant;
import java.util.UUID;

import com.buildsight.platform.document.domain.DocumentDiscipline;
import com.buildsight.platform.document.domain.DocumentType;

public record DocumentResponse(
        UUID id,
        UUID projectId,
        String documentNumber,
        String title,
        DocumentType documentType,
        DocumentDiscipline discipline,
        String ownerName,
        long revisionCount,
        String latestRevisionCode,
        String latestRevisionStatus,
        long version,
        Instant createdAt,
        Instant updatedAt) {
}
