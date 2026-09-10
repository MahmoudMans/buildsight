package com.buildsight.platform.ai.api;

import java.util.List;
import java.util.UUID;

import com.buildsight.platform.ai.service.ProjectAiCopilotService;
import com.buildsight.platform.ai.service.ProjectAiIndexService;

import jakarta.validation.Valid;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/v1/projects/{projectId}/ai")
public class ProjectAiController {

    private final ProjectAiIndexService
            indexService;

    private final ProjectAiCopilotService
            copilotService;

    public ProjectAiController(
            ProjectAiIndexService indexService,
            ProjectAiCopilotService copilotService) {

        this.indexService =
                indexService;

        this.copilotService =
                copilotService;
    }

    @GetMapping("/status")
    public AiStatusResponse status(
            @PathVariable UUID projectId) {

        return copilotService
                .status(
                        projectId);
    }

    @PostMapping("/index/rebuild")
    public AiIndexResponse rebuild(
            @PathVariable UUID projectId) {

        return indexService
                .rebuild(
                        projectId);
    }

    @PostMapping("/ask")
    public AiAnswerResponse ask(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            AiAskRequest request) {

        return copilotService
                .ask(
                        projectId,
                        request.question());
    }

    @PostMapping("/attention-brief")
    public AiAnswerResponse attentionBrief(
            @PathVariable UUID projectId) {

        return copilotService
                .attentionBrief(
                        projectId);
    }

    @GetMapping("/history")
    public List<AiHistoryResponse> history(
            @PathVariable UUID projectId) {

        return copilotService
                .history(
                        projectId);
    }
}
