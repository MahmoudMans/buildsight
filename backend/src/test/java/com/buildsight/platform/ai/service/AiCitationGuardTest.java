package com.buildsight.platform.ai.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;

import org.junit.jupiter.api.Test;

class AiCitationGuardTest {

    private final AiCitationGuard
            guard =
            new AiCitationGuard();

    @Test
    void acceptsOnlySuppliedCitations() {

        assertTrue(
                guard.isGrounded(
                        "The package is delayed [S1] and the RFI remains open [S2].",
                        Set.of(
                                "[S1]",
                                "[S2]")));
    }

    @Test
    void rejectsInventedCitation() {

        assertFalse(
                guard.isGrounded(
                        "The package is delayed [S9].",
                        Set.of(
                                "[S1]",
                                "[S2]")));
    }

    @Test
    void rejectsAnswerWithoutCitation() {

        assertFalse(
                guard.isGrounded(
                        "The package is delayed.",
                        Set.of(
                                "[S1]")));
    }
}
