package com.buildsight.platform.project.service;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.project.api.CreateProjectRequest;
import com.buildsight.platform.project.api.ProjectResponse;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {

    private final ProjectRepository projectRepository;
    private final ProjectMapper projectMapper;

    public ProjectService(
            ProjectRepository projectRepository,
            ProjectMapper projectMapper) {

        this.projectRepository = projectRepository;
        this.projectMapper = projectMapper;
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> findAll() {
        return projectRepository.findAllByOrderByUpdatedAtDesc()
                .stream()
                .map(projectMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse findById(UUID id) {
        return projectRepository.findById(id)
                .map(projectMapper::toResponse)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Project '%s' was not found.".formatted(id)));
    }

    @Transactional
    public ProjectResponse create(CreateProjectRequest request) {
        validateDateRange(request);

        String normalizedCode =
                request.code().trim().toUpperCase(Locale.ROOT);

        if (projectRepository.existsByCodeIgnoreCase(normalizedCode)) {
            throw new ConflictException(
                    "A project with code '%s' already exists."
                            .formatted(normalizedCode));
        }

        Project project =
                projectMapper.toEntity(request, normalizedCode);

        Project savedProject = projectRepository.save(project);

        return projectMapper.toResponse(savedProject);
    }

    private void validateDateRange(CreateProjectRequest request) {
        if (request.plannedEndDate()
                .isBefore(request.plannedStartDate())) {

            throw new InvalidRequestException(
                    "Planned end date cannot be before planned start date.");
        }
    }
}
