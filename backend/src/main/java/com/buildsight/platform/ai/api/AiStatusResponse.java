package com.buildsight.platform.ai.api;

import java.time.Instant;

public record AiStatusResponse(
        boolean ollamaReachable,
        String chatModel,
        boolean chatModelAvailable,
        String embeddingModel,
        boolean embeddingModelAvailable,
        int embeddingDimensions,
        long indexedChunks,
        Instant lastIndexedAt,
        boolean ready,
        String message) {
}
