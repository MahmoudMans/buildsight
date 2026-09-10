package com.buildsight.platform.portfolio.api;

import java.util.UUID;

import com.buildsight.platform.portfolio.service.PortfolioAiService;
import com.buildsight.platform.portfolio.service.PortfolioExecutiveService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/portfolio")
public class PortfolioExecutiveController {

    private final PortfolioExecutiveService
            executiveService;

    private final PortfolioAiService
            aiService;

    public PortfolioExecutiveController(
            PortfolioExecutiveService executiveService,
            PortfolioAiService aiService) {

        this.executiveService =
                executiveService;

        this.aiService =
                aiService;
    }

    @GetMapping("/executive")
    public PortfolioExecutiveResponse executive() {

        return executiveService
                .executive();
    }

    @GetMapping(
            "/projects/{projectId}/comparison")
    public PortfolioProjectComparisonResponse comparison(
            @PathVariable UUID projectId) {

        return executiveService
                .comparison(
                        projectId);
    }

    @GetMapping("/ai/status")
    public PortfolioAiStatusResponse aiStatus() {

        return aiService
                .status();
    }

    @PostMapping("/ai/brief")
    public PortfolioAiBriefResponse aiBrief() {

        return aiService
                .brief();
    }
}
