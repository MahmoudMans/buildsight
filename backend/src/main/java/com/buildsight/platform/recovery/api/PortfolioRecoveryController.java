package com.buildsight.platform.recovery.api;

import com.buildsight.platform.recovery.api.RecoveryModels.PortfolioRecoveryResponse;
import com.buildsight.platform.recovery.service.PortfolioRecoveryService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/v1/portfolio/recovery")
public class PortfolioRecoveryController {

    private final PortfolioRecoveryService service;

    public PortfolioRecoveryController(
            PortfolioRecoveryService service) {

        this.service =
                service;
    }

    @GetMapping
    public PortfolioRecoveryResponse get() {

        return service.get();
    }
}
