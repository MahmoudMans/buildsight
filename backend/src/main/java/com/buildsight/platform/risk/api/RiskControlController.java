package com.buildsight.platform.risk.api;

import java.util.UUID;

import com.buildsight.platform.risk.service.RiskControlService;

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
        "/api/v1/projects/{projectId}/risk-control")
public class RiskControlController {

    private final RiskControlService
            riskControlService;

    public RiskControlController(
            RiskControlService riskControlService) {

        this.riskControlService =
                riskControlService;
    }

    @GetMapping
    public RiskControlResponse get(
            @PathVariable UUID projectId) {

        return riskControlService.get(
                projectId);
    }

    @PostMapping("/risks")
    @ResponseStatus(HttpStatus.CREATED)
    public RiskResponse createRisk(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateRiskRequest request) {

        return riskControlService
                .createRisk(
                        projectId,
                        request);
    }

    @PutMapping("/risks/{riskId}")
    public RiskResponse updateRisk(
            @PathVariable UUID projectId,
            @PathVariable UUID riskId,
            @Valid
            @RequestBody
            UpdateRiskRequest request) {

        return riskControlService
                .updateRisk(
                        projectId,
                        riskId,
                        request);
    }

    @PostMapping("/issues")
    @ResponseStatus(HttpStatus.CREATED)
    public IssueResponse createIssue(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateIssueRequest request) {

        return riskControlService
                .createIssue(
                        projectId,
                        request);
    }

    @PutMapping("/issues/{issueId}")
    public IssueResponse updateIssue(
            @PathVariable UUID projectId,
            @PathVariable UUID issueId,
            @Valid
            @RequestBody
            UpdateIssueRequest request) {

        return riskControlService
                .updateIssue(
                        projectId,
                        issueId,
                        request);
    }

    @PostMapping("/changes")
    @ResponseStatus(HttpStatus.CREATED)
    public ChangeEventResponse createChange(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateChangeEventRequest request) {

        return riskControlService
                .createChange(
                        projectId,
                        request);
    }

    @PutMapping("/changes/{changeId}")
    public ChangeEventResponse updateChange(
            @PathVariable UUID projectId,
            @PathVariable UUID changeId,
            @Valid
            @RequestBody
            UpdateChangeEventRequest request) {

        return riskControlService
                .updateChange(
                        projectId,
                        changeId,
                        request);
    }

    @PostMapping("/delays")
    @ResponseStatus(HttpStatus.CREATED)
    public DelayEventResponse createDelay(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateDelayEventRequest request) {

        return riskControlService
                .createDelay(
                        projectId,
                        request);
    }

    @PutMapping("/delays/{delayId}")
    public DelayEventResponse updateDelay(
            @PathVariable UUID projectId,
            @PathVariable UUID delayId,
            @Valid
            @RequestBody
            UpdateDelayEventRequest request) {

        return riskControlService
                .updateDelay(
                        projectId,
                        delayId,
                        request);
    }
}
