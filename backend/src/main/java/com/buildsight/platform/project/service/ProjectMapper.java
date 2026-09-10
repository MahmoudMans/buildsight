package com.buildsight.platform.project.service;

import java.math.BigDecimal;
import java.util.UUID;

import com.buildsight.platform.project.api.CreateProjectRequest;
import com.buildsight.platform.project.api.ProjectResponse;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectStatus;

import org.springframework.stereotype.Component;

@Component
public class ProjectMapper {

    public Project toEntity(
            CreateProjectRequest request,
            String normalizedCode) {

        return Project.create(
                UUID.randomUUID(),
                normalizedCode,
                request.name().trim(),
                normalizeNullable(request.description()),
                request.clientName().trim(),
                request.location().trim(),
                request.contractValue(),
                request.approvedBudget(),
                request.plannedStartDate(),
                request.plannedEndDate(),
                ProjectStatus.PLANNING,
                BigDecimal.ZERO);
    }

    public ProjectResponse toResponse(Project project) {
        return new ProjectResponse(
                project.getId(),
                project.getCode(),
                project.getName(),
                project.getDescription(),
                project.getClientName(),
                project.getLocation(),
                project.getContractValue(),
                project.getApprovedBudget(),
                project.getPlannedStartDate(),
                project.getPlannedEndDate(),
                project.getActualStartDate(),
                project.getActualEndDate(),
                project.getStatus(),
                project.getPhysicalProgressPercentage(),
                project.getVersion(),
                project.getCreatedAt(),
                project.getUpdatedAt());
    }

    private String normalizeNullable(String value) {
        if (value == null) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }
}
