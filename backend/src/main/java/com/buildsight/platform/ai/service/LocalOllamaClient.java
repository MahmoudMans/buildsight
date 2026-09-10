package com.buildsight.platform.ai.service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import com.buildsight.platform.common.exception.InvalidRequestException;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Service
public class LocalOllamaClient {

    private final RestClient restClient;

    public LocalOllamaClient(
            @Value(
                    "${buildsight.ollama.base-url:http://localhost:11434}")
            String baseUrl) {

        this.restClient =
                RestClient.builder()
                        .baseUrl(
                                baseUrl)
                        .build();
    }

    public OllamaAvailability availability() {

        try {
            OllamaTagsResponse response =
                    restClient.get()
                            .uri(
                                    "/api/tags")
                            .retrieve()
                            .body(
                                    OllamaTagsResponse.class);

            if (response == null
                    || response.models() == null) {

                return new OllamaAvailability(
                        true,
                        Set.of());
            }

            Set<String> models =
                    response.models()
                            .stream()
                            .flatMap(
                                    model ->
                                            List.of(
                                                            model.name(),
                                                            model.model())
                                                    .stream())
                            .filter(
                                    value ->
                                            value != null
                                                    && !value.isBlank())
                            .collect(
                                    Collectors.toUnmodifiableSet());

            return new OllamaAvailability(
                    true,
                    models);

        } catch (RestClientException exception) {

            return new OllamaAvailability(
                    false,
                    Set.of());
        }
    }

    public List<List<Double>> embed(
            List<String> inputs,
            String model,
            int dimensions) {

        if (inputs == null
                || inputs.isEmpty()) {

            return List.of();
        }

        try {
            OllamaEmbedResponse response =
                    restClient.post()
                            .uri(
                                    "/api/embed")
                            .body(
                                    new OllamaEmbedRequest(
                                            model,
                                            inputs,
                                            true,
                                            dimensions))
                            .retrieve()
                            .body(
                                    OllamaEmbedResponse.class);

            if (response == null
                    || response.embeddings() == null
                    || response.embeddings().size()
                            != inputs.size()) {

                throw new InvalidRequestException(
                        "Ollama returned an invalid embedding response.");
            }

            List<List<Double>> validated =
                    new ArrayList<>();

            for (List<Double> embedding :
                    response.embeddings()) {

                if (embedding == null
                        || embedding.size()
                                != dimensions) {

                    throw new InvalidRequestException(
                            "The embedding model did not return the configured "
                                    + dimensions
                                    + " dimensions.");
                }

                validated.add(
                        List.copyOf(
                                embedding));
            }

            return List.copyOf(
                    validated);

        } catch (InvalidRequestException exception) {

            throw exception;

        } catch (RestClientException exception) {

            throw new InvalidRequestException(
                    "BuildSight could not generate local embeddings. "
                            + "Ensure Ollama is running and model '"
                            + model
                            + "' is installed.");
        }
    }

    public String chat(
            String model,
            String prompt) {

        try {
            OllamaChatResponse response =
                    restClient.post()
                            .uri(
                                    "/api/chat")
                            .body(
                                    new OllamaChatRequest(
                                            model,
                                            List.of(
                                                    new OllamaChatMessage(
                                                            "user",
                                                            prompt)),
                                            false,
                                            false,
                                            Map.of(
                                                    "temperature",
                                                    0.1,
                                                    "num_predict",
                                                    900)))
                            .retrieve()
                            .body(
                                    OllamaChatResponse.class);

            if (response == null
                    || response.message() == null
                    || response.message().content() == null
                    || response.message()
                            .content()
                            .isBlank()) {

                throw new InvalidRequestException(
                        "Ollama returned an empty local AI response.");
            }

            return response.message()
                    .content()
                    .trim();

        } catch (InvalidRequestException exception) {

            throw exception;

        } catch (RestClientException exception) {

            throw new InvalidRequestException(
                    "BuildSight could not generate a local AI answer. "
                            + "Ensure Ollama is running and model '"
                            + model
                            + "' is installed.");
        }
    }

    public boolean modelAvailable(
            OllamaAvailability availability,
            String model) {

        if (!availability.reachable()) {
            return false;
        }

        return availability.models()
                .stream()
                .anyMatch(
                        installed ->
                                installed.equals(
                                        model));
    }

    public record OllamaAvailability(
            boolean reachable,
            Set<String> models) {
    }

    public record OllamaEmbedRequest(
            String model,
            List<String> input,
            boolean truncate,
            int dimensions) {
    }

    public record OllamaEmbedResponse(
            List<List<Double>> embeddings) {
    }

    public record OllamaChatMessage(
            String role,
            String content) {
    }

    public record OllamaChatRequest(
            String model,
            List<OllamaChatMessage> messages,
            boolean stream,
            boolean think,
            Map<String, Object> options) {
    }

    public record OllamaChatResponse(
            OllamaChatMessage message) {
    }

    public record OllamaModel(
            String name,
            String model) {
    }

    public record OllamaTagsResponse(
            List<OllamaModel> models) {
    }
}
