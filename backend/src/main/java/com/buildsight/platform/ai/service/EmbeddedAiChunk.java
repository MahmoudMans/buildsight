package com.buildsight.platform.ai.service;

import java.util.List;

public record EmbeddedAiChunk(
        AiChunkDraft chunk,
        List<Double> embedding,
        String embeddingModel) {
}
