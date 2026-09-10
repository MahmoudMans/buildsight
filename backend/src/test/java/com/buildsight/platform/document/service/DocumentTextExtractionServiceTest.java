package com.buildsight.platform.document.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;

import org.junit.jupiter.api.Test;

class DocumentTextExtractionServiceTest {

    @Test
    void extractsPlainTextLocally() {

        DocumentTextExtractionService service =
                new DocumentTextExtractionService();

        String result =
                service.extract(
                        "BuildSight local document intelligence"
                                .getBytes(
                                        StandardCharsets.UTF_8),
                        "document.txt",
                        "text/plain");

        assertTrue(
                result.contains(
                        "BuildSight"));
    }
}
