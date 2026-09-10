package com.buildsight.platform.schedule.api;

import java.util.UUID;

import com.buildsight.platform.schedule.api.ScheduleModels.CaptureBaselineRequest;
import com.buildsight.platform.schedule.api.ScheduleModels.CreateDependencyRequest;
import com.buildsight.platform.schedule.api.ScheduleModels.CreateScheduleActivityRequest;
import com.buildsight.platform.schedule.api.ScheduleModels.CreateScheduleConstraintRequest;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleActivityResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleBaselineResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleConstraintResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleControlResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleDependencyResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.ScheduleLookaheadResponse;
import com.buildsight.platform.schedule.api.ScheduleModels.UpdateScheduleActivityRequest;
import com.buildsight.platform.schedule.api.ScheduleModels.UpdateScheduleConstraintRequest;
import com.buildsight.platform.schedule.service.ScheduleControlService;

import jakarta.validation.Valid;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/v1/projects/{projectId}/schedule")
public class ScheduleControlController {

    private final ScheduleControlService service;

    public ScheduleControlController(
            ScheduleControlService service) {

        this.service =
                service;
    }

    @GetMapping
    public ScheduleControlResponse get(
            @PathVariable UUID projectId) {

        return service.get(
                projectId);
    }

    @GetMapping("/lookahead")
    public ScheduleLookaheadResponse lookahead(
            @PathVariable UUID projectId,
            @RequestParam(defaultValue = "2") int weeks) {

        return service.lookahead(
                projectId,
                weeks);
    }

    @PostMapping("/activities")
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleActivityResponse createActivity(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateScheduleActivityRequest request) {

        return service.createActivity(
                projectId,
                request);
    }

    @PutMapping("/activities/{activityId}")
    public ScheduleActivityResponse updateActivity(
            @PathVariable UUID projectId,
            @PathVariable UUID activityId,
            @Valid
            @RequestBody
            UpdateScheduleActivityRequest request) {

        return service.updateActivity(
                projectId,
                activityId,
                request);
    }

    @PostMapping("/dependencies")
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleDependencyResponse createDependency(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateDependencyRequest request) {

        return service.createDependency(
                projectId,
                request);
    }

    @DeleteMapping("/dependencies/{dependencyId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteDependency(
            @PathVariable UUID projectId,
            @PathVariable UUID dependencyId) {

        service.deleteDependency(
                projectId,
                dependencyId);
    }

    @PostMapping("/constraints")
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleConstraintResponse createConstraint(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateScheduleConstraintRequest request) {

        return service.createConstraint(
                projectId,
                request);
    }

    @PutMapping("/constraints/{constraintId}")
    public ScheduleConstraintResponse updateConstraint(
            @PathVariable UUID projectId,
            @PathVariable UUID constraintId,
            @Valid
            @RequestBody
            UpdateScheduleConstraintRequest request) {

        return service.updateConstraint(
                projectId,
                constraintId,
                request);
    }

    @PostMapping("/baselines")
    @ResponseStatus(HttpStatus.CREATED)
    public ScheduleBaselineResponse captureBaseline(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CaptureBaselineRequest request) {

        return service.captureBaseline(
                projectId,
                request);
    }

    @PostMapping("/baselines/{baselineId}/approve")
    public ScheduleBaselineResponse approveBaseline(
            @PathVariable UUID projectId,
            @PathVariable UUID baselineId) {

        return service.approveBaseline(
                projectId,
                baselineId);
    }
}
