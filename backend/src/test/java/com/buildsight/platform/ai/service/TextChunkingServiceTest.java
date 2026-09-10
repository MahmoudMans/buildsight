package com.buildsight.platform.ai.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;

import org.junit.jupiter.api.Test;

class TextChunkingServiceTest {

    private final TextChunkingService
            service =
            new TextChunkingService();

    @Test
    void shortTextRemainsSingleChunk() {

        List<String> chunks =
                service.chunk(
                        "BuildSight controlled construction information.");

        assertEquals(
                1,
                chunks.size());

        assertTrue(
                chunks.get(0)
                        .contains(
                                "BuildSight"));
    }

    @Test
    void longTextProducesBoundedOverlappingChunks() {

        String text =
                "construction information coordination "
                        .repeat(
                                180);

        List<String> chunks =
                service.chunk(
                        text);

        assertTrue(
                chunks.size()
                        > 1);

        assertTrue(
                chunks.stream()
                        .allMatch(
                                chunk ->
                                        chunk.length()
                                                <= 1400));

        assertFalse(
                chunks.stream()
                        .anyMatch(
                                String::isBlank));
    }

    @Test
    void emptyTextProducesNoChunks() {

        assertTrue(
                service.chunk(
                                "   ")
                        .isEmpty());
    }
}
