package com.buildsight.platform.ai.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record AiAnswerResponse(
        UUID interactionId,
        String question,
        String answer,
        boolean grounded,
        String chatModel,
        String embeddingModel,
        List<AiSourceCitationResponse> sources,
        Instant createdAt) {
}
