package com.buildsight.platform.portfolio.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.portfolio.api.PortfolioBenchmarksResponse;
import com.buildsight.platform.portfolio.api.PortfolioExecutiveResponse;
import com.buildsight.platform.portfolio.api.PortfolioProjectSnapshotResponse;
import com.buildsight.platform.portfolio.api.PortfolioSummaryResponse;
import com.buildsight.platform.project.api.ProjectHealthBand;
import com.buildsight.platform.project.domain.ProjectStatus;

import org.junit.jupiter.api.Test;

class PortfolioAiPromptBuilderTest {

    @Test
    void portfolioPromptUsesControlledCitationSources() {

        UUID projectId =
                UUID.randomUUID();

        PortfolioProjectSnapshotResponse project =
                new PortfolioProjectSnapshotResponse(
                        projectId,
                        "BS-001",
                        "Test Project",
                        "Client",
                        "Paris",
                        ProjectStatus.ACTIVE,
                        62,
                        ProjectHealthBand.WATCH,
                        10,
                        new BigDecimal("100000"),
                        new BigDecimal("100000"),
                        new BigDecimal("105000"),
                        new BigDecimal("50000"),
                        new BigDecimal("20000"),
                        new BigDecimal("-5000"),
                        70,
                        1,
                        68,
                        1,
                        0,
                        7,
                        65,
                        1,
                        62,
                        0.8,
                        1,
                        0,
                        72,
                        1,
                        0,
                        1,
                        0,
                        78,
                        60,
                        1);

        PortfolioSummaryResponse summary =
                new PortfolioSummaryResponse(
                        1,
                        0,
                        1,
                        0,
                        0,
                        0,
                        1,
                        0,
                        new BigDecimal("100000"),
                        new BigDecimal("100000"),
                        new BigDecimal("105000"),
                        new BigDecimal("50000"),
                        new BigDecimal("20000"),
                        new BigDecimal("-5000"),
                        62,
                        ProjectHealthBand.WATCH,
                        1,
                        1,
                        0,
                        1,
                        1,
                        0,
                        0,
                        0,
                        0,
                        5);

        PortfolioExecutiveResponse executive =
                new PortfolioExecutiveResponse(
                        LocalDate.of(
                                2026,
                                9,
                                10),
                        summary,
                        new PortfolioBenchmarksResponse(
                                62,
                                70,
                                68,
                                65,
                                62,
                                72,
                                0.8,
                                "BS-001",
                                "BS-001"),
                        List.of(
                                project),
                        List.of(),
                        List.of());

        PortfolioAiPrompt result =
                new PortfolioAiPromptBuilder()
                        .build(
                                executive);

        assertEquals(
                2,
                result.sources()
                        .size());

        assertEquals(
                "[S1]",
                result.sources()
                        .get(0)
                        .citation());

        assertEquals(
                "[S2]",
                result.sources()
                        .get(1)
                        .citation());

        assertTrue(
                result.prompt()
                        .contains(
                                "Use ONLY the BuildSight evidence"));

        assertTrue(
                result.prompt()
                        .contains(
                                "BS-001"));

        assertTrue(
                result.prompt()
                        .contains(
                                "[S2]"));
    }
}
