package com.buildsight.platform.ai.service;

import java.util.UUID;

import com.buildsight.platform.ai.domain.AiSourceType;

public record AiRetrievedChunk(
        UUID id,
        AiSourceType sourceType,
        UUID sourceId,
        UUID sourceParentId,
        String reference,
        String title,
        String content,
        double similarity) {
}
