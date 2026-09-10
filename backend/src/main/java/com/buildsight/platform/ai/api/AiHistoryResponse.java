package com.buildsight.platform.ai.api;

import java.time.Instant;
import java.util.UUID;

public record AiHistoryResponse(
        UUID id,
        String question,
        String answer,
        boolean grounded,
        int sourceCount,
        Instant createdAt) {
}
