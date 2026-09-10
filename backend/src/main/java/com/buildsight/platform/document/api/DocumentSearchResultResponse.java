package com.buildsight.platform.document.api;

import java.util.UUID;

public record DocumentSearchResultResponse(
        String resultType,
        UUID entityId,
        UUID parentId,
        String reference,
        String title,
        String snippet,
        double score) {
}
