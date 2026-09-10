package com.buildsight.platform.project.service;

import com.buildsight.platform.project.api.MilestoneResponse;
import com.buildsight.platform.project.domain.ProjectMilestone;

import org.springframework.stereotype.Component;

@Component
public class MilestoneMapper {

    public MilestoneResponse toResponse(
            ProjectMilestone milestone) {

        return new MilestoneResponse(
                milestone.getId(),
                milestone.getProjectId(),
                milestone.getName(),
                milestone.getDescription(),
                milestone.getPlannedDate(),
                milestone.getForecastDate(),
                milestone.getActualDate(),
                milestone.getStatus(),
                milestone.getWeightPercentage(),
                milestone.getSortOrder(),
                milestone.getVersion(),
                milestone.getCreatedAt(),
                milestone.getUpdatedAt());
    }
}
