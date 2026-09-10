package com.buildsight.platform.ai.api;

import java.util.UUID;

import com.buildsight.platform.ai.domain.AiSourceType;

public record AiSourceCitationResponse(
        String citation,
        AiSourceType sourceType,
        UUID sourceId,
        UUID sourceParentId,
        String reference,
        String title,
        String snippet,
        double similarity) {
}
