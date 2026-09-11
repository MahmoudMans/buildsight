package com.buildsight.platform.forecast.api;

import java.util.UUID;

import com.buildsight.platform.forecast.api.ForecastModels.CreateForecastScenarioRequest;
import com.buildsight.platform.forecast.api.ForecastModels.EvmSnapshotResponse;
import com.buildsight.platform.forecast.api.ForecastModels.ForecastControlResponse;
import com.buildsight.platform.forecast.api.ForecastModels.ForecastScenarioResponse;
import com.buildsight.platform.forecast.api.ForecastModels.UpdateForecastScenarioRequest;
import com.buildsight.platform.forecast.service.ForecastControlService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/v1/projects/{projectId}/forecast")
public class ForecastControlController {

    private final ForecastControlService service;

    public ForecastControlController(
            ForecastControlService service) {

        this.service =
                service;
    }

    @GetMapping
    public ForecastControlResponse get(
            @PathVariable UUID projectId) {

        return service.get(
                projectId);
    }

    @PostMapping("/snapshots")
    @ResponseStatus(HttpStatus.CREATED)
    public EvmSnapshotResponse captureSnapshot(
            @PathVariable UUID projectId) {

        return service.captureSnapshot(
                projectId);
    }

    @PostMapping("/scenarios")
    @ResponseStatus(HttpStatus.CREATED)
    public ForecastScenarioResponse createScenario(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateForecastScenarioRequest request) {

        return service.createScenario(
                projectId,
                request);
    }

    @PutMapping("/scenarios/{scenarioId}")
    public ForecastScenarioResponse updateScenario(
            @PathVariable UUID projectId,
            @PathVariable UUID scenarioId,
            @Valid
            @RequestBody
            UpdateForecastScenarioRequest request) {

        return service.updateScenario(
                projectId,
                scenarioId,
                request);
    }

    @PostMapping("/scenarios/{scenarioId}/approve")
    public ForecastScenarioResponse approveScenario(
            @PathVariable UUID projectId,
            @PathVariable UUID scenarioId) {

        return service.approveScenario(
                projectId,
                scenarioId);
    }

    @PostMapping("/scenarios/{scenarioId}/archive")
    public ForecastScenarioResponse archiveScenario(
            @PathVariable UUID projectId,
            @PathVariable UUID scenarioId) {

        return service.archiveScenario(
                projectId,
                scenarioId);
    }
}
