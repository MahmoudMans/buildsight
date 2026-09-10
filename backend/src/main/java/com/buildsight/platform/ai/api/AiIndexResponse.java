package com.buildsight.platform.ai.api;

import java.time.Instant;

public record AiIndexResponse(
        long indexedSources,
        long indexedChunks,
        String embeddingModel,
        int embeddingDimensions,
        Instant indexedAt) {
}
