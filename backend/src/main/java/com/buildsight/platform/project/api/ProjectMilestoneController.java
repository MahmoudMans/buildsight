package com.buildsight.platform.project.api;

import java.net.URI;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.project.service.MilestoneService;

import jakarta.validation.Valid;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping(
        "/api/v1/projects/{projectId}/milestones")
public class ProjectMilestoneController {

    private final MilestoneService milestoneService;

    public ProjectMilestoneController(
            MilestoneService milestoneService) {

        this.milestoneService = milestoneService;
    }

    @GetMapping
    public List<MilestoneResponse> findAll(
            @PathVariable UUID projectId) {

        return milestoneService.findAll(projectId);
    }

    @PostMapping
    public ResponseEntity<MilestoneResponse> create(
            @PathVariable UUID projectId,
            @Valid
            @RequestBody
            CreateMilestoneRequest request) {

        MilestoneResponse created =
                milestoneService.create(
                        projectId,
                        request);

        return ResponseEntity
                .created(
                        URI.create(
                                "/api/v1/projects/"
                                        + projectId
                                        + "/milestones/"
                                        + created.id()))
                .body(created);
    }

    @PutMapping("/{milestoneId}")
    public MilestoneResponse update(
            @PathVariable UUID projectId,
            @PathVariable UUID milestoneId,
            @Valid
            @RequestBody
            UpdateMilestoneRequest request) {

        return milestoneService.update(
                projectId,
                milestoneId,
                request);
    }
}
