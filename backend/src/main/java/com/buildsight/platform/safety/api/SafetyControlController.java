package com.buildsight.platform.safety.api;

import java.util.UUID;

import com.buildsight.platform.safety.service.SafetyControlService;

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
        "/api/v1/projects/{projectId}/safety")
public class SafetyControlController {

    private final SafetyControlService service;

    public SafetyControlController(
            SafetyControlService service) {

        this.service =
                service;
    }

    @GetMapping
    public SafetyControlResponse get(
            @PathVariable UUID projectId) {

        return service.get(
                projectId);
    }

    @PostMapping("/incidents")
    @ResponseStatus(HttpStatus.CREATED)
    public SafetyIncidentResponse createIncident(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateSafetyIncidentRequest request) {

        return service.createIncident(
                projectId,
                request);
    }

    @PutMapping("/incidents/{incidentId}")
    public SafetyIncidentResponse updateIncident(
            @PathVariable UUID projectId,
            @PathVariable UUID incidentId,
            @Valid
            @RequestBody
            UpdateSafetyIncidentRequest request) {

        return service.updateIncident(
                projectId,
                incidentId,
                request);
    }

    @PostMapping("/observations")
    @ResponseStatus(HttpStatus.CREATED)
    public SafetyObservationResponse createObservation(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateSafetyObservationRequest request) {

        return service.createObservation(
                projectId,
                request);
    }

    @PutMapping("/observations/{observationId}")
    public SafetyObservationResponse updateObservation(
            @PathVariable UUID projectId,
            @PathVariable UUID observationId,
            @Valid
            @RequestBody
            UpdateSafetyObservationRequest request) {

        return service.updateObservation(
                projectId,
                observationId,
                request);
    }

    @PostMapping("/actions")
    @ResponseStatus(HttpStatus.CREATED)
    public SafetyActionResponse createAction(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateSafetyActionRequest request) {

        return service.createAction(
                projectId,
                request);
    }

    @PutMapping("/actions/{actionId}")
    public SafetyActionResponse updateAction(
            @PathVariable UUID projectId,
            @PathVariable UUID actionId,
            @Valid
            @RequestBody
            UpdateSafetyActionRequest request) {

        return service.updateAction(
                projectId,
                actionId,
                request);
    }

    @PostMapping("/permits")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkPermitResponse createPermit(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateWorkPermitRequest request) {

        return service.createPermit(
                projectId,
                request);
    }

    @PutMapping("/permits/{permitId}")
    public WorkPermitResponse updatePermit(
            @PathVariable UUID projectId,
            @PathVariable UUID permitId,
            @Valid
            @RequestBody
            UpdateWorkPermitRequest request) {

        return service.updatePermit(
                projectId,
                permitId,
                request);
    }
}
