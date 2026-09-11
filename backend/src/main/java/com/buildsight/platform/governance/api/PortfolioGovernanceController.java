package com.buildsight.platform.governance.api;

import com.buildsight.platform.governance.api.GovernanceModels.PortfolioGovernanceResponse;
import com.buildsight.platform.governance.service.PortfolioGovernanceService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/v1/portfolio/governance")
public class PortfolioGovernanceController {

    private final PortfolioGovernanceService service;

    public PortfolioGovernanceController(
            PortfolioGovernanceService service) {

        this.service =
                service;
    }

    @GetMapping
    public PortfolioGovernanceResponse get() {

        return service.get();
    }
}
