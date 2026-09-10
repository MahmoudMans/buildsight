package com.buildsight.platform.project.api;

import java.util.UUID;

import com.buildsight.platform.project.service.ProjectCommandCenterService;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/projects")
public class ProjectCommandCenterController {

    private final ProjectCommandCenterService
            commandCenterService;

    public ProjectCommandCenterController(
            ProjectCommandCenterService commandCenterService) {

        this.commandCenterService =
                commandCenterService;
    }

    @GetMapping("/{id}/command-center")
    public ProjectCommandCenterResponse get(
            @PathVariable UUID id) {

        return commandCenterService.get(id);
    }
}
