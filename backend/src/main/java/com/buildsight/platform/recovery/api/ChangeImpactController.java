package com.buildsight.platform.recovery.api;

import java.util.UUID;

import com.buildsight.platform.recovery.api.RecoveryModels.ChangeImpactControlResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.ChangeSimulationResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.CreateChangeSimulationRequest;
import com.buildsight.platform.recovery.api.RecoveryModels.CreateRecoveryOptionRequest;
import com.buildsight.platform.recovery.api.RecoveryModels.RecoveryOptionResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.RecoveryPlanSnapshotResponse;
import com.buildsight.platform.recovery.api.RecoveryModels.UpdateChangeSimulationRequest;
import com.buildsight.platform.recovery.api.RecoveryModels.UpdateRecoveryOptionRequest;
import com.buildsight.platform.recovery.service.ChangeImpactControlService;

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
        "/api/v1/projects/{projectId}/recovery")
public class ChangeImpactController {

    private final ChangeImpactControlService service;

    public ChangeImpactController(
            ChangeImpactControlService service) {

        this.service =
                service;
    }

    @GetMapping
    public ChangeImpactControlResponse get(
            @PathVariable UUID projectId) {

        return service.get(
                projectId);
    }

    @PostMapping("/simulations")
    @ResponseStatus(HttpStatus.CREATED)
    public ChangeSimulationResponse createSimulation(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateChangeSimulationRequest request) {

        return service.createSimulation(
                projectId,
                request);
    }

    @PutMapping("/simulations/{simulationId}")
    public ChangeSimulationResponse updateSimulation(
            @PathVariable UUID projectId,
            @PathVariable UUID simulationId,
            @Valid
            @RequestBody
            UpdateChangeSimulationRequest request) {

        return service.updateSimulation(
                projectId,
                simulationId,
                request);
    }

    @PostMapping("/simulations/{simulationId}/approve")
    public ChangeSimulationResponse approveSimulation(
            @PathVariable UUID projectId,
            @PathVariable UUID simulationId) {

        return service.approveSimulation(
                projectId,
                simulationId);
    }

    @PostMapping("/simulations/{simulationId}/archive")
    public ChangeSimulationResponse archiveSimulation(
            @PathVariable UUID projectId,
            @PathVariable UUID simulationId) {

        return service.archiveSimulation(
                projectId,
                simulationId);
    }

    @PostMapping("/simulations/{simulationId}/options")
    @ResponseStatus(HttpStatus.CREATED)
    public RecoveryOptionResponse createOption(
            @PathVariable UUID projectId,
            @PathVariable UUID simulationId,
            @Valid
            @RequestBody
            CreateRecoveryOptionRequest request) {

        return service.createOption(
                projectId,
                simulationId,
                request);
    }

    @PutMapping("/simulations/{simulationId}/options/{optionId}")
    public RecoveryOptionResponse updateOption(
            @PathVariable UUID projectId,
            @PathVariable UUID simulationId,
            @PathVariable UUID optionId,
            @Valid
            @RequestBody
            UpdateRecoveryOptionRequest request) {

        return service.updateOption(
                projectId,
                simulationId,
                optionId,
                request);
    }

    @PostMapping("/simulations/{simulationId}/options/{optionId}/select")
    public RecoveryPlanSnapshotResponse selectOption(
            @PathVariable UUID projectId,
            @PathVariable UUID simulationId,
            @PathVariable UUID optionId) {

        return service.selectOption(
                projectId,
                simulationId,
                optionId);
    }
}
