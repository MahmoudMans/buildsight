package com.buildsight.platform.governance.api;

import java.util.UUID;

import com.buildsight.platform.governance.api.GovernanceModels.ActionResponse;
import com.buildsight.platform.governance.api.GovernanceModels.CreateActionRequest;
import com.buildsight.platform.governance.api.GovernanceModels.CreateDecisionRequest;
import com.buildsight.platform.governance.api.GovernanceModels.CreateMeetingRequest;
import com.buildsight.platform.governance.api.GovernanceModels.DecisionResponse;
import com.buildsight.platform.governance.api.GovernanceModels.ExecutiveReportResponse;
import com.buildsight.platform.governance.api.GovernanceModels.ExecutiveReportSnapshotResponse;
import com.buildsight.platform.governance.api.GovernanceModels.GovernanceControlResponse;
import com.buildsight.platform.governance.api.GovernanceModels.MeetingResponse;
import com.buildsight.platform.governance.api.GovernanceModels.UpdateActionRequest;
import com.buildsight.platform.governance.api.GovernanceModels.UpdateDecisionRequest;
import com.buildsight.platform.governance.api.GovernanceModels.UpdateMeetingRequest;
import com.buildsight.platform.governance.service.GovernanceControlService;

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
        "/api/v1/projects/{projectId}/governance")
public class GovernanceController {

    private final GovernanceControlService service;

    public GovernanceController(
            GovernanceControlService service) {

        this.service =
                service;
    }

    @GetMapping
    public GovernanceControlResponse get(
            @PathVariable UUID projectId) {

        return service.get(
                projectId);
    }

    @PostMapping("/meetings")
    @ResponseStatus(HttpStatus.CREATED)
    public MeetingResponse createMeeting(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateMeetingRequest request) {

        return service.createMeeting(
                projectId,
                request);
    }

    @PutMapping("/meetings/{meetingId}")
    public MeetingResponse updateMeeting(
            @PathVariable UUID projectId,
            @PathVariable UUID meetingId,
            @Valid
            @RequestBody
            UpdateMeetingRequest request) {

        return service.updateMeeting(
                projectId,
                meetingId,
                request);
    }

    @PostMapping("/decisions")
    @ResponseStatus(HttpStatus.CREATED)
    public DecisionResponse createDecision(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateDecisionRequest request) {

        return service.createDecision(
                projectId,
                request);
    }

    @PutMapping("/decisions/{decisionId}")
    public DecisionResponse updateDecision(
            @PathVariable UUID projectId,
            @PathVariable UUID decisionId,
            @Valid
            @RequestBody
            UpdateDecisionRequest request) {

        return service.updateDecision(
                projectId,
                decisionId,
                request);
    }

    @PostMapping("/actions")
    @ResponseStatus(HttpStatus.CREATED)
    public ActionResponse createAction(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateActionRequest request) {

        return service.createAction(
                projectId,
                request);
    }

    @PutMapping("/actions/{actionId}")
    public ActionResponse updateAction(
            @PathVariable UUID projectId,
            @PathVariable UUID actionId,
            @Valid
            @RequestBody
            UpdateActionRequest request) {

        return service.updateAction(
                projectId,
                actionId,
                request);
    }

    @GetMapping("/executive-report")
    public ExecutiveReportResponse executiveReport(
            @PathVariable UUID projectId) {

        return service.executiveReport(
                projectId);
    }

    @PostMapping("/executive-report/snapshots")
    @ResponseStatus(HttpStatus.CREATED)
    public ExecutiveReportSnapshotResponse captureExecutiveReport(
            @PathVariable UUID projectId) {

        return service.captureExecutiveReport(
                projectId);
    }
}
