package com.buildsight.platform.forecast.api;

import com.buildsight.platform.forecast.api.ForecastModels.PortfolioForecastResponse;
import com.buildsight.platform.forecast.service.PortfolioForecastService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/v1/portfolio/forecast")
public class PortfolioForecastController {

    private final PortfolioForecastService service;

    public PortfolioForecastController(
            PortfolioForecastService service) {

        this.service =
                service;
    }

    @GetMapping
    public PortfolioForecastResponse get() {

        return service.get();
    }
}
