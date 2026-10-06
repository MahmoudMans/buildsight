package com.buildsight.platform.periodcontrol.api;

import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PortfolioPeriodControlResponse;
import com.buildsight.platform.periodcontrol.service.PortfolioPeriodControlService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/v1/portfolio/period-control")
public class PortfolioPeriodControlController {

    private final PortfolioPeriodControlService service;

    public PortfolioPeriodControlController(
            PortfolioPeriodControlService service) {

        this.service =
                service;
    }

    @GetMapping
    public PortfolioPeriodControlResponse get() {

        return service.get();
    }
}
