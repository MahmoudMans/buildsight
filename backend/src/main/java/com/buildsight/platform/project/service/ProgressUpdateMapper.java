package com.buildsight.platform.project.service;

import com.buildsight.platform.project.api.ProgressUpdateResponse;
import com.buildsight.platform.project.domain.ProjectProgressUpdate;

import org.springframework.stereotype.Component;

@Component
public class ProgressUpdateMapper {

    public ProgressUpdateResponse toResponse(
            ProjectProgressUpdate update) {

        return new ProgressUpdateResponse(
                update.getId(),
                update.getProjectId(),
                update.getProgressPercentage(),
                update.getUpdateDate(),
                update.getNote(),
                update.getCreatedAt());
    }
}
