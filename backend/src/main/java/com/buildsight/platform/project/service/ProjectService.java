package com.buildsight.platform.project.service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import com.buildsight.platform.common.exception.ConflictException;
import com.buildsight.platform.common.exception.InvalidRequestException;
import com.buildsight.platform.common.exception.ResourceNotFoundException;
import com.buildsight.platform.project.api.ChangeProjectStatusRequest;
import com.buildsight.platform.project.api.CreateProjectRequest;
import com.buildsight.platform.project.api.ProjectResponse;
import com.buildsight.platform.project.api.RecordProgressRequest;
import com.buildsight.platform.project.api.UpdateProjectRequest;
import com.buildsight.platform.project.domain.Project;
import com.buildsight.platform.project.domain.ProjectProgressUpdate;
import com.buildsight.platform.project.domain.ProjectStatus;
import com.buildsight.platform.project.repository.ProjectProgressUpdateRepository;
import com.buildsight.platform.project.repository.ProjectRepository;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProjectService {

    private static final Map<ProjectStatus, Set<ProjectStatus>>
            ALLOWED_TRANSITIONS = Map.of(
                    ProjectStatus.PLANNING,
                    Set.of(
                            ProjectStatus.ACTIVE,
                            ProjectStatus.ON_HOLD,
                            ProjectStatus.CANCELLED),

                    ProjectStatus.ACTIVE,
                    Set.of(
                            ProjectStatus.ON_HOLD,
                            ProjectStatus.COMPLETED,
                            ProjectStatus.CANCELLED),

                    ProjectStatus.ON_HOLD,
                    Set.of(
                            ProjectStatus.ACTIVE,
                            ProjectStatus.CANCELLED),

                    ProjectStatus.COMPLETED,
                    Set.of(),

                    ProjectStatus.CANCELLED,
                    Set.of());

    private final ProjectRepository projectRepository;
    private final ProjectMapper projectMapper;
    private final ProjectProgressUpdateRepository
            progressUpdateRepository;
    private final Clock clock;

    public ProjectService(
            ProjectRepository projectRepository,
            ProjectMapper projectMapper,
            ProjectProgressUpdateRepository progressUpdateRepository,
            Clock clock) {

        this.projectRepository = projectRepository;
        this.projectMapper = projectMapper;
        this.progressUpdateRepository =
                progressUpdateRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ProjectResponse> findAll() {
        return projectRepository
                .findAllByOrderByUpdatedAtDesc()
                .stream()
                .map(projectMapper::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public ProjectResponse findById(UUID id) {
        return projectMapper.toResponse(
                requireProject(id));
    }

    @Transactional
    public ProjectResponse create(
            CreateProjectRequest request) {

        validateDateRange(
                request.plannedStartDate(),
                request.plannedEndDate());

        String normalizedCode =
                request.code()
                        .trim()
                        .toUpperCase(Locale.ROOT);

        if (projectRepository
                .existsByCodeIgnoreCase(normalizedCode)) {

            throw new ConflictException(
                    "A project with code '%s' already exists."
                            .formatted(normalizedCode));
        }

        Project project =
                projectMapper.toEntity(
                        request,
                        normalizedCode);

        Project savedProject =
                projectRepository.save(project);

        return projectMapper.toResponse(savedProject);
    }

    @Transactional
    public ProjectResponse update(
            UUID id,
            UpdateProjectRequest request) {

        Project project = requireProject(id);

        verifyVersion(
                project.getVersion(),
                request.version());

        validateDateRange(
                request.plannedStartDate(),
                request.plannedEndDate());

        project.updateDetails(
                request.name().trim(),
                projectMapper.normalizeNullable(
                        request.description()),
                request.clientName().trim(),
                request.location().trim(),
                request.contractValue(),
                request.approvedBudget(),
                request.plannedStartDate(),
                request.plannedEndDate(),
                request.forecastEndDate());

        Project saved =
                projectRepository.saveAndFlush(project);

        return projectMapper.toResponse(saved);
    }

    @Transactional
    public ProjectResponse changeStatus(
            UUID id,
            ChangeProjectStatusRequest request) {

        Project project = requireProject(id);

        verifyVersion(
                project.getVersion(),
                request.version());

        ProjectStatus current =
                project.getStatus();

        ProjectStatus target =
                request.status();

        if (current == target) {
            return projectMapper.toResponse(project);
        }

        Set<ProjectStatus> allowed =
                ALLOWED_TRANSITIONS.getOrDefault(
                        current,
                        Set.of());

        if (!allowed.contains(target)) {
            throw new InvalidRequestException(
                    "Project status cannot transition from '%s' to '%s'."
                            .formatted(current, target));
        }

        LocalDate today =
                LocalDate.now(clock);

        BigDecimal progressBefore =
                project.getPhysicalProgressPercentage();

        project.changeStatus(
                target,
                today);

        if (target == ProjectStatus.COMPLETED
                && progressBefore.compareTo(
                        new BigDecimal("100.00")) < 0) {

            progressUpdateRepository.save(
                    ProjectProgressUpdate.create(
                            UUID.randomUUID(),
                            project.getId(),
                            new BigDecimal("100.00"),
                            today,
                            "Progress automatically set to 100% when the project was completed."));
        }

        Project saved =
                projectRepository.saveAndFlush(project);

        return projectMapper.toResponse(saved);
    }

    @Transactional
    public ProjectResponse recordProgress(
            UUID id,
            RecordProgressRequest request) {

        Project project = requireProject(id);

        verifyVersion(
                project.getVersion(),
                request.version());

        LocalDate today =
                LocalDate.now(clock);

        if (request.updateDate().isAfter(today)) {
            throw new InvalidRequestException(
                    "Progress update date cannot be in the future.");
        }

        if (request.progressPercentage()
                .compareTo(
                        project.getPhysicalProgressPercentage()) < 0) {

            throw new InvalidRequestException(
                    "Physical progress cannot be lower than the current recorded progress.");
        }

        if (project.getStatus()
                == ProjectStatus.COMPLETED) {

            throw new InvalidRequestException(
                    "Progress cannot be changed after the project is completed.");
        }

        if (project.getStatus()
                == ProjectStatus.CANCELLED) {

            throw new InvalidRequestException(
                    "Progress cannot be changed for a cancelled project.");
        }

        project.recordProgress(
                request.progressPercentage(),
                request.updateDate());

        progressUpdateRepository.save(
                ProjectProgressUpdate.create(
                        UUID.randomUUID(),
                        project.getId(),
                        request.progressPercentage(),
                        request.updateDate(),
                        projectMapper.normalizeNullable(
                                request.note())));

        Project saved =
                projectRepository.saveAndFlush(project);

        return projectMapper.toResponse(saved);
    }

    private Project requireProject(UUID id) {
        return projectRepository
                .findById(id)
                .orElseThrow(() ->
                        new ResourceNotFoundException(
                                "Project '%s' was not found."
                                        .formatted(id)));
    }

    private void validateDateRange(
            LocalDate plannedStartDate,
            LocalDate plannedEndDate) {

        if (plannedEndDate
                .isBefore(plannedStartDate)) {

            throw new InvalidRequestException(
                    "Planned end date cannot be before planned start date.");
        }
    }

    private void verifyVersion(
            long persistedVersion,
            long requestedVersion) {

        if (persistedVersion != requestedVersion) {
            throw new ConflictException(
                    "The project was changed by another operation. Refresh the project before submitting your change.");
        }
    }
}
