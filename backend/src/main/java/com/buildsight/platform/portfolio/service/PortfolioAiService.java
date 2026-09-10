package com.buildsight.platform.portfolio.service;

import java.time.Instant;
import java.util.Set;
import java.util.stream.Collectors;

import com.buildsight.platform.ai.service.AiCitationGuard;
import com.buildsight.platform.ai.service.LocalOllamaClient;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.portfolio.api.PortfolioAiBriefResponse;
import com.buildsight.platform.portfolio.api.PortfolioAiStatusResponse;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class PortfolioAiService {

    private final PortfolioExecutiveService
            executiveService;

    private final PortfolioAiPromptBuilder
            promptBuilder;

    private final LocalOllamaClient
            ollamaClient;

    private final AiCitationGuard
            citationGuard;

    private final String
            chatModel;

    public PortfolioAiService(
            PortfolioExecutiveService executiveService,
            PortfolioAiPromptBuilder promptBuilder,
            LocalOllamaClient ollamaClient,
            AiCitationGuard citationGuard,
            @Value(
                    "${buildsight.ai.chat-model:qwen3:4b}")
            String chatModel) {

        this.executiveService =
                executiveService;

        this.promptBuilder =
                promptBuilder;

        this.ollamaClient =
                ollamaClient;

        this.citationGuard =
                citationGuard;

        this.chatModel =
                chatModel;
    }

    public PortfolioAiStatusResponse status() {

        LocalOllamaClient.OllamaAvailability availability =
                ollamaClient
                        .availability();

        boolean available =
                ollamaClient
                        .modelAvailable(
                                availability,
                                chatModel);

        boolean ready =
                availability.reachable()
                        && available;

        String message;

        if (!availability.reachable()) {
            message =
                    "Ollama is not reachable.";

        } else if (!available) {
            message =
                    "The local portfolio chat model is not installed.";

        } else {
            message =
                    "Local portfolio AI briefing is ready.";
        }

        return new PortfolioAiStatusResponse(
                availability.reachable(),
                chatModel,
                available,
                ready,
                message);
    }

    public PortfolioAiBriefResponse brief() {

        PortfolioAiStatusResponse status =
                status();

        if (!status.ready()) {

            throw new InvalidRequestException(
                    status.message());
        }

        var executive =
                executiveService
                        .executive();

        if (executive.projects()
                .isEmpty()) {

            throw new InvalidRequestException(
                    "The BuildSight portfolio contains no projects.");
        }

        PortfolioAiPrompt prompt =
                promptBuilder.build(
                        executive);

        Set<String> allowedCitations =
                prompt.sources()
                        .stream()
                        .map(
                                source ->
                                        source.citation())
                        .collect(
                                Collectors.toSet());

        String answer =
                ollamaClient.chat(
                        chatModel,
                        prompt.prompt());

        boolean grounded =
                citationGuard
                        .isGrounded(
                                answer,
                                allowedCitations);

        if (!grounded) {

            String repaired =
                    ollamaClient.chat(
                            chatModel,
                            promptBuilder.repair(
                                    answer,
                                    prompt));

            if (citationGuard
                    .isGrounded(
                            repaired,
                            allowedCitations)) {

                answer =
                        repaired;

                grounded =
                        true;
            }
        }

        if (!grounded) {

            answer =
                    "BuildSight generated a portfolio briefing, "
                            + "but it did not satisfy the required citation policy. "
                            + "The draft was discarded rather than presented as executive fact.";
        }

        return new PortfolioAiBriefResponse(
                answer,
                grounded,
                chatModel,
                prompt.sources(),
                Instant.now());
    }
}
