package com.buildsight.platform.ai.repository;

import java.util.List;
import java.util.UUID;

import com.buildsight.platform.ai.domain.AiCopilotInteraction;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AiCopilotInteractionRepository
        extends JpaRepository<AiCopilotInteraction, UUID> {

    List<AiCopilotInteraction>
    findTop20ByProjectIdOrderByCreatedAtDesc(
            UUID projectId);
}
