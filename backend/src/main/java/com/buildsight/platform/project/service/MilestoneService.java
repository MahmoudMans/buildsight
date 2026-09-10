package com.buildsight.platform.project.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.project.api.CreateMilestoneRequest;
import com.buildsight.platform.project.api.MilestoneResponse;
import com.buildsight.platform.project.api.UpdateMilestoneRequest;
import com.buildsight.platform.project.domain.MilestoneStatus;
import com.buildsight.platform.project.domain.ProjectMilestone;
import com.buildsight.platform.project.repository.ProjectMilestoneRepository;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MilestoneService {

    private final ProjectRepository projectRepository;
    private final ProjectMilestoneRepository milestoneRepository;
    private final MilestoneMapper milestoneMapper;
    private final ProjectMapper projectMapper;
    private final Clock clock;

    public MilestoneService(
            ProjectRepository projectRepository,
            ProjectMilestoneRepository milestoneRepository,
            MilestoneMapper milestoneMapper,
            ProjectMapper projectMapper,
            Clock clock) {

        this.projectRepository = projectRepository;
        this.milestoneRepository = milestoneRepository;
        this.milestoneMapper = milestoneMapper;
        this.projectMapper = projectMapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<MilestoneResponse> findAll(
            UUID projectId) {

        requireProject(projectId);

        return milestoneRepository
                .findByProjectIdOrderBySortOrderAscPlannedDateAsc(
                        projectId)
                .stream()
                .map(milestoneMapper::toResponse)
                .toList();
    }

    @Transactional
    public MilestoneResponse create(
            UUID projectId,
            CreateMilestoneRequest request) {

        requireProject(projectId);

        LocalDate forecastDate =
                request.forecastDate() == null
                        ? request.plannedDate()
                        : request.forecastDate();

        ProjectMilestone milestone =
                ProjectMilestone.create(
                        UUID.randomUUID(),
                        projectId,
                        request.name().trim(),
                        projectMapper.normalizeNullable(
                                request.description()),
                        request.plannedDate(),
                        forecastDate,
                        null,
                        MilestoneStatus.PLANNED,
                        request.weightPercentage(),
                        request.sortOrder());

        return milestoneMapper.toResponse(
                milestoneRepository.save(milestone));
    }

    @Transactional
    public MilestoneResponse update(
            UUID projectId,
            UUID milestoneId,
            UpdateMilestoneRequest request) {

        requireProject(projectId);

        ProjectMilestone milestone =
                milestoneRepository
                        .findByIdAndProjectId(
                                milestoneId,
                                projectId)
                        .orElseThrow(() ->
                                new ResourceNotFoundException(
                                        "Milestone '%s' was not found for project '%s'."
                                                .formatted(
                                                        milestoneId,
                                                        projectId)));

        if (milestone.getVersion()
                != request.version()) {

            throw new ConflictException(
                    "The milestone was changed by another operation. Refresh before submitting your change.");
        }

        milestone.update(
                request.name().trim(),
                projectMapper.normalizeNullable(
                        request.description()),
                request.plannedDate(),
                request.forecastDate(),
                request.actualDate(),
                request.status(),
                request.weightPercentage(),
                request.sortOrder(),
                LocalDate.now(clock));

        return milestoneMapper.toResponse(
                milestoneRepository
                        .saveAndFlush(milestone));
    }

    private void requireProject(UUID projectId) {
        if (!projectRepository.existsById(projectId)) {
            throw new ResourceNotFoundException(
                    "Project '%s' was not found."
                            .formatted(projectId));
        }
    }
}
