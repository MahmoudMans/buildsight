package com.buildsight.platform.resource.api;

import java.util.UUID;

import com.buildsight.platform.resource.api.ResourceModels.CreateEquipmentRequest;
import com.buildsight.platform.resource.api.ResourceModels.CreateEquipmentUsageRequest;
import com.buildsight.platform.resource.api.ResourceModels.CreateResourceForecastRequest;
import com.buildsight.platform.resource.api.ResourceModels.CreateWorkforceDeploymentRequest;
import com.buildsight.platform.resource.api.ResourceModels.CreateWorkforcePlanRequest;
import com.buildsight.platform.resource.api.ResourceModels.EquipmentResponse;
import com.buildsight.platform.resource.api.ResourceModels.EquipmentUsageResponse;
import com.buildsight.platform.resource.api.ResourceModels.ResourceControlResponse;
import com.buildsight.platform.resource.api.ResourceModels.ResourceForecastResponse;
import com.buildsight.platform.resource.api.ResourceModels.UpdateEquipmentRequest;
import com.buildsight.platform.resource.api.ResourceModels.UpdateEquipmentUsageRequest;
import com.buildsight.platform.resource.api.ResourceModels.UpdateResourceForecastRequest;
import com.buildsight.platform.resource.api.ResourceModels.UpdateWorkforceDeploymentRequest;
import com.buildsight.platform.resource.api.ResourceModels.UpdateWorkforcePlanRequest;
import com.buildsight.platform.resource.api.ResourceModels.WorkforceDeploymentResponse;
import com.buildsight.platform.resource.api.ResourceModels.WorkforcePlanResponse;
import com.buildsight.platform.resource.service.ResourceControlService;

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
        "/api/v1/projects/{projectId}/resources")
public class ResourceControlController {

    private final ResourceControlService service;

    public ResourceControlController(
            ResourceControlService service) {

        this.service =
                service;
    }

    @GetMapping
    public ResourceControlResponse get(
            @PathVariable UUID projectId) {

        return service.get(
                projectId);
    }

    @PostMapping("/workforce-plans")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkforcePlanResponse createPlan(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateWorkforcePlanRequest request) {

        return service.createWorkforcePlan(
                projectId,
                request);
    }

    @PutMapping("/workforce-plans/{planId}")
    public WorkforcePlanResponse updatePlan(
            @PathVariable UUID projectId,
            @PathVariable UUID planId,
            @Valid
            @RequestBody
            UpdateWorkforcePlanRequest request) {

        return service.updateWorkforcePlan(
                projectId,
                planId,
                request);
    }

    @PostMapping("/deployments")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkforceDeploymentResponse createDeployment(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateWorkforceDeploymentRequest request) {

        return service.createDeployment(
                projectId,
                request);
    }

    @PutMapping("/deployments/{deploymentId}")
    public WorkforceDeploymentResponse updateDeployment(
            @PathVariable UUID projectId,
            @PathVariable UUID deploymentId,
            @Valid
            @RequestBody
            UpdateWorkforceDeploymentRequest request) {

        return service.updateDeployment(
                projectId,
                deploymentId,
                request);
    }

    @PostMapping("/equipment")
    @ResponseStatus(HttpStatus.CREATED)
    public EquipmentResponse createEquipment(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateEquipmentRequest request) {

        return service.createEquipment(
                projectId,
                request);
    }

    @PutMapping("/equipment/{equipmentId}")
    public EquipmentResponse updateEquipment(
            @PathVariable UUID projectId,
            @PathVariable UUID equipmentId,
            @Valid
            @RequestBody
            UpdateEquipmentRequest request) {

        return service.updateEquipment(
                projectId,
                equipmentId,
                request);
    }

    @PostMapping("/equipment-usage")
    @ResponseStatus(HttpStatus.CREATED)
    public EquipmentUsageResponse createEquipmentUsage(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateEquipmentUsageRequest request) {

        return service.createEquipmentUsage(
                projectId,
                request);
    }

    @PutMapping("/equipment-usage/{usageId}")
    public EquipmentUsageResponse updateEquipmentUsage(
            @PathVariable UUID projectId,
            @PathVariable UUID usageId,
            @Valid
            @RequestBody
            UpdateEquipmentUsageRequest request) {

        return service.updateEquipmentUsage(
                projectId,
                usageId,
                request);
    }

    @PostMapping("/forecasts")
    @ResponseStatus(HttpStatus.CREATED)
    public ResourceForecastResponse createForecast(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateResourceForecastRequest request) {

        return service.createForecast(
                projectId,
                request);
    }

    @PutMapping("/forecasts/{forecastId}")
    public ResourceForecastResponse updateForecast(
            @PathVariable UUID projectId,
            @PathVariable UUID forecastId,
            @Valid
            @RequestBody
            UpdateResourceForecastRequest request) {

        return service.updateForecast(
                projectId,
                forecastId,
                request);
    }
}
