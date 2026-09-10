package com.buildsight.platform.ai.service;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.buildsight.platform.ai.api.AiAnswerResponse;
import com.buildsight.platform.ai.api.AiHistoryResponse;
import com.buildsight.platform.ai.api.AiSourceCitationResponse;
import com.buildsight.platform.ai.api.AiStatusResponse;
import com.buildsight.platform.ai.domain.AiCopilotInteraction;
import com.buildsight.platform.ai.repository.AiCopilotInteractionRepository;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectAiCopilotService {

    private static final String
            ATTENTION_QUESTION =
            "What needs project leadership's attention right now? "
                    + "Prioritize the most important cost, schedule, procurement, "
                    + "risk, production and information-management concerns. "
                    + "Separate confirmed issues from areas that merely require monitoring.";

    private final ProjectRepository
            projectRepository;

    private final AiVectorStore
            vectorStore;

    private final LocalOllamaClient
            ollamaClient;

    private final AiPromptBuilder
            promptBuilder;

    private final AiCitationGuard
            citationGuard;

    private final AiCopilotInteractionRepository
            interactionRepository;

    private final String
            chatModel;

    private final String
            embeddingModel;

    private final int
            embeddingDimensions;

    private final int
            retrievalLimit;

    public ProjectAiCopilotService(
            ProjectRepository projectRepository,
            AiVectorStore vectorStore,
            LocalOllamaClient ollamaClient,
            AiPromptBuilder promptBuilder,
            AiCitationGuard citationGuard,
            AiCopilotInteractionRepository interactionRepository,
            @Value(
                    "${buildsight.ai.chat-model:qwen3:4b}")
            String chatModel,
            @Value(
                    "${buildsight.ai.embedding-model:qwen3-embedding:0.6b}")
            String embeddingModel,
            @Value(
                    "${buildsight.ai.embedding-dimensions:1024}")
            int embeddingDimensions,
            @Value(
                    "${buildsight.ai.retrieval-limit:8}")
            int retrievalLimit) {

        this.projectRepository =
                projectRepository;

        this.vectorStore =
                vectorStore;

        this.ollamaClient =
                ollamaClient;

        this.promptBuilder =
                promptBuilder;

        this.citationGuard =
                citationGuard;

        this.interactionRepository =
                interactionRepository;

        this.chatModel =
                chatModel;

        this.embeddingModel =
                embeddingModel;

        this.embeddingDimensions =
                embeddingDimensions;

        this.retrievalLimit =
                Math.max(
                        1,
                        retrievalLimit);
    }

    @Transactional(readOnly = true)
    public AiStatusResponse status(
            UUID projectId) {

        requireProject(
                projectId);

        LocalOllamaClient.OllamaAvailability availability =
                ollamaClient
                        .availability();

        boolean chatAvailable =
                ollamaClient
                        .modelAvailable(
                                availability,
                                chatModel);

        boolean embeddingAvailable =
                ollamaClient
                        .modelAvailable(
                                availability,
                                embeddingModel);

        long chunks =
                vectorStore.count(
                        projectId);

        boolean ready =
                availability.reachable()
                        && chatAvailable
                        && embeddingAvailable
                        && chunks > 0;

        String message;

        if (!availability.reachable()) {

            message =
                    "Ollama is not reachable.";

        } else if (!chatAvailable
                || !embeddingAvailable) {

            message =
                    "One or more local AI models are not installed.";

        } else if (chunks == 0) {

            message =
                    "Models are available. Rebuild the project AI index.";

        } else {
            message =
                    "Local AI is ready and project evidence is indexed.";
        }

        return new AiStatusResponse(
                availability.reachable(),
                chatModel,
                chatAvailable,
                embeddingModel,
                embeddingAvailable,
                embeddingDimensions,
                chunks,
                vectorStore.latestIndexedAt(
                        projectId),
                ready,
                message);
    }

    public AiAnswerResponse ask(
            UUID projectId,
            String question) {

        requireProject(
                projectId);

        String normalizedQuestion =
                question == null
                        ? ""
                        : question.trim();

        if (normalizedQuestion.length()
                < 3) {

            throw new InvalidRequestException(
                    "Question is too short.");
        }

        if (vectorStore.count(
                projectId)
                == 0) {

            throw new InvalidRequestException(
                    "The local AI index is empty. Rebuild the AI index first.");
        }

        LocalOllamaClient.OllamaAvailability availability =
                ollamaClient
                        .availability();

        if (!availability.reachable()) {

            throw new InvalidRequestException(
                    "Ollama is not reachable.");
        }

        if (!ollamaClient.modelAvailable(
                availability,
                chatModel)) {

            throw new InvalidRequestException(
                    "Local chat model '"
                            + chatModel
                            + "' is not installed.");
        }

        if (!ollamaClient.modelAvailable(
                availability,
                embeddingModel)) {

            throw new InvalidRequestException(
                    "Local embedding model '"
                            + embeddingModel
                            + "' is not installed.");
        }

        List<Double> queryEmbedding =
                ollamaClient
                        .embed(
                                List.of(
                                        normalizedQuestion),
                                embeddingModel,
                                embeddingDimensions)
                        .get(0);

        List<AiRetrievedChunk> retrieved =
                vectorStore.nearest(
                        projectId,
                        queryEmbedding,
                        retrievalLimit);

        if (retrieved.isEmpty()) {

            return persist(
                    projectId,
                    normalizedQuestion,
                    "BuildSight could not retrieve project evidence for this question.",
                    false,
                    List.of());
        }

        List<AiSourceCitationResponse> citations =
                buildCitations(
                        retrieved);

        Set<String> allowed =
                citations.stream()
                        .map(
                                AiSourceCitationResponse::citation)
                        .collect(
                                LinkedHashSet::new,
                                Set::add,
                                Set::addAll);

        String prompt =
                promptBuilder
                        .buildQuestionPrompt(
                                normalizedQuestion,
                                retrieved);

        String answer =
                ollamaClient.chat(
                        chatModel,
                        prompt);

        boolean grounded =
                citationGuard.isGrounded(
                        answer,
                        allowed);

        if (!grounded) {

            String repaired =
                    ollamaClient.chat(
                            chatModel,
                            promptBuilder.buildRepairPrompt(
                                    normalizedQuestion,
                                    answer,
                                    retrieved));

            if (citationGuard.isGrounded(
                    repaired,
                    allowed)) {

                answer =
                        repaired;

                grounded =
                        true;
            }
        }

        if (!grounded) {

            answer =
                    "BuildSight retrieved relevant project evidence, "
                            + "but the local model did not produce an answer "
                            + "that satisfied the strict citation policy. "
                            + "The generated draft was discarded. Review the "
                            + "retrieved evidence below or rephrase the question.";
        }

        return persist(
                projectId,
                normalizedQuestion,
                answer,
                grounded,
                citations);
    }

    public AiAnswerResponse attentionBrief(
            UUID projectId) {

        return ask(
                projectId,
                ATTENTION_QUESTION);
    }

    @Transactional(readOnly = true)
    public List<AiHistoryResponse> history(
            UUID projectId) {

        requireProject(
                projectId);

        return interactionRepository
                .findTop20ByProjectIdOrderByCreatedAtDesc(
                        projectId)
                .stream()
                .map(
                        interaction ->
                                new AiHistoryResponse(
                                        interaction.getId(),
                                        interaction.getQuestion(),
                                        interaction.getAnswer(),
                                        interaction.isGrounded(),
                                        interaction.getSourceCount(),
                                        interaction.getCreatedAt()))
                .toList();
    }

    @Transactional
    protected AiAnswerResponse persist(
            UUID projectId,
            String question,
            String answer,
            boolean grounded,
            List<AiSourceCitationResponse> citations) {

        String citationReferences =
                citations.stream()
                        .map(
                                source ->
                                        source.citation()
                                                + "="
                                                + source.reference())
                        .reduce(
                                "",
                                (
                                        left,
                                        right) ->
                                        left.isBlank()
                                                ? right
                                                : left
                                                        + "\n"
                                                        + right);

        AiCopilotInteraction interaction =
                AiCopilotInteraction.create(
                        UUID.randomUUID(),
                        projectId,
                        question,
                        answer,
                        grounded,
                        chatModel,
                        embeddingModel,
                        citationReferences,
                        citations.size());

        AiCopilotInteraction saved =
                interactionRepository
                        .save(
                                interaction);

        return new AiAnswerResponse(
                saved.getId(),
                question,
                answer,
                grounded,
                chatModel,
                embeddingModel,
                citations,
                saved.getCreatedAt() == null
                        ? Instant.now()
                        : saved.getCreatedAt());
    }

    private List<AiSourceCitationResponse> buildCitations(
            List<AiRetrievedChunk> retrieved) {

        return java.util.stream.IntStream
                .range(
                        0,
                        retrieved.size())
                .mapToObj(
                        index -> {

                            AiRetrievedChunk source =
                                    retrieved.get(
                                            index);

                            return new AiSourceCitationResponse(
                                    "[S"
                                            + (index + 1)
                                            + "]",
                                    source.sourceType(),
                                    source.sourceId(),
                                    source.sourceParentId(),
                                    source.reference(),
                                    source.title(),
                                    snippet(
                                            source.content()),
                                    roundThree(
                                            source.similarity()));
                        })
                .toList();
    }

    private String snippet(
            String text) {

        if (text == null) {
            return "";
        }

        String normalized =
                text.replaceAll(
                                "\\s+",
                                " ")
                        .trim();

        if (normalized.length()
                <= 360) {

            return normalized;
        }

        return normalized.substring(
                        0,
                        357)
                + "...";
    }

    private double roundThree(
            double value) {

        return Math.round(
                        value
                                * 1000.0)
                / 1000.0;
    }

    private void requireProject(
            UUID projectId) {

        if (!projectRepository
                .existsById(
                        projectId)) {

            throw new ResourceNotFoundException(
                    "Project '%s' was not found."
                            .formatted(
                                    projectId));
        }
    }
}
