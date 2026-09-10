package com.buildsight.platform.ai.service;

import java.util.UUID;

import com.buildsight.platform.ai.domain.AiSourceType;

public record AiSourceDraft(
        AiSourceType sourceType,
        UUID sourceId,
        UUID sourceParentId,
        String reference,
        String title,
        String content) {
}
