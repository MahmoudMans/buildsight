package com.buildsight.platform.periodcontrol.api;

import java.util.UUID;

import com.buildsight.platform.periodcontrol.api.PeriodControlModels.CaptureBaselineRequest;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.ControlBaselineResponse;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.CreateProgressPeriodRequest;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PeriodControlResponse;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PeriodEndReadinessResponse;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.PeriodEndSnapshotResponse;
import com.buildsight.platform.periodcontrol.api.PeriodControlModels.ProgressPeriodResponse;
import com.buildsight.platform.periodcontrol.service.PeriodControlService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/v1/projects/{projectId}/period-control")
public class PeriodControlController {

    private final PeriodControlService service;

    public PeriodControlController(
            PeriodControlService service) {

        this.service =
                service;
    }

    @GetMapping
    public PeriodControlResponse get(
            @PathVariable UUID projectId) {

        return service.get(
                projectId);
    }

    @PostMapping("/baselines")
    @ResponseStatus(HttpStatus.CREATED)
    public ControlBaselineResponse captureBaseline(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CaptureBaselineRequest request) {

        return service.captureBaseline(
                projectId,
                request);
    }

    @PostMapping("/baselines/{baselineId}/approve")
    public ControlBaselineResponse approveBaseline(
            @PathVariable UUID projectId,
            @PathVariable UUID baselineId) {

        return service.approveBaseline(
                projectId,
                baselineId);
    }

    @PostMapping("/periods")
    @ResponseStatus(HttpStatus.CREATED)
    public ProgressPeriodResponse createPeriod(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateProgressPeriodRequest request) {

        return service.createPeriod(
                projectId,
                request);
    }

    @GetMapping("/periods/{periodId}/readiness")
    public PeriodEndReadinessResponse readiness(
            @PathVariable UUID projectId,
            @PathVariable UUID periodId) {

        return service.readiness(
                projectId,
                periodId);
    }

    @PostMapping("/periods/{periodId}/close")
    public PeriodEndSnapshotResponse closePeriod(
            @PathVariable UUID projectId,
            @PathVariable UUID periodId) {

        return service.closePeriod(
                projectId,
                periodId);
    }
}
